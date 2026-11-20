// Rota dedicada de registro (REALIZA-473): a tabela de decisão e as filas que
// a ficha e a rota compartilham. Tudo puro — sem Next, sem Supabase; as datas
// entram por parâmetro. Se divergirem da action, a tela oferece o que o
// servidor recusa (ou esconde o que ele aceita).
import { describe, expect, it } from "vitest";
import { passosDaTrilha } from "@/lib/ciclo";
import { materiaisDoNumero } from "@/lib/materiais";
import {
  combinadosPendentesDaDupla,
  estadoDaRotaRegistro,
  filaRegistrosPendentes,
  passoDoEncontro,
} from "@/lib/registro-contexto";
import type { Dupla, Material } from "@/lib/types";
import {
  CICLO_16,
  ESP_5,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncaminhamento,
  mkEncontro,
  mkProfile,
  mkRegistro,
} from "./helpers";

const MENTOR = mkProfile({ id: "mentor-1", nome: "Mentora Teste" });
const AGORA = new Date("2025-11-15T15:00:00Z");
const PASSOS = passosDaTrilha("dpp", CICLO_16);
const PASSOS_ESP = passosDaTrilha("especialista", [], ESP_5);

const duplaCom = (over: Partial<Dupla> = {}) =>
  mkDupla({ mentor: MENTOR, ...over });

const avaliar = (dupla: Dupla, encontroId: string, ritoPendente = false) =>
  estadoDaRotaRegistro({
    dupla,
    encontroId,
    passos: dupla.trilha === "especialista" ? PASSOS_ESP : PASSOS,
    meId: MENTOR.id,
    agora: AGORA,
    ritoPendente,
  });

// ---------- estadoDaRotaRegistro ----------

describe("estadoDaRotaRegistro", () => {
  it("realizado sem registro abre o form com o passo do guia", () => {
    // Arrange
    const enc = encRealizado(4, "2025-10-28", null);
    const dupla = duplaCom({ encontros: [enc] });

    // Act
    const estado = avaliar(dupla, enc.id);

    // Assert
    expect(estado.tipo).toBe("ok");
    if (estado.tipo !== "ok") return;
    expect(estado.encontro.id).toBe(enc.id);
    expect(estado.passo?.numero).toBe(4);
    expect(estado.passo?.titulo).toBe("Encontro 4");
  });

  it("agendado vencido abre; agendado futuro espera o horário", () => {
    // Arrange
    const vencido = encAgendado(3, "2025-11-14");
    const futuro = encAgendado(4, "2025-11-20");
    const dupla = duplaCom({ encontros: [vencido, futuro] });

    // Act
    const passado = avaliar(dupla, vencido.id);
    const adiante = avaliar(dupla, futuro.id);

    // Assert
    expect(passado.tipo).toBe("ok");
    expect(adiante.tipo).toBe("bloqueado");
    if (adiante.tipo !== "bloqueado") return;
    expect(adiante.motivo).toBe("ainda_nao_aconteceu");
    expect(adiante.encontro?.id).toBe(futuro.id);
  });

  it("nao_aconteceu/cancelado com data passada abrem — o salvar corrige o status", () => {
    // Arrange
    const naoAconteceu = mkEncontro(5, {
      status: "nao_aconteceu",
      data_hora: "2025-11-04T22:00:00Z",
    });
    const cancelado = mkEncontro(6, {
      status: "cancelado",
      data_hora: "2025-11-11T22:00:00Z",
    });
    const dupla = duplaCom({ encontros: [naoAconteceu, cancelado] });

    // Act
    const a = avaliar(dupla, naoAconteceu.id);
    const b = avaliar(dupla, cancelado.id);

    // Assert
    expect(a.tipo).toBe("ok");
    expect(b.tipo).toBe("ok");
  });

  it("sem data_hora e não realizado ainda não aconteceu", () => {
    // Arrange
    const semData = mkEncontro(7, { status: "agendado", data_hora: null });
    const dupla = duplaCom({ encontros: [semData] });

    // Act
    const estado = avaliar(dupla, semData.id);

    // Assert
    expect(estado.tipo).toBe("bloqueado");
    if (estado.tipo !== "bloqueado") return;
    expect(estado.motivo).toBe("ainda_nao_aconteceu");
  });

  it("encontro já registrado é bloqueado — editar mora na ficha", () => {
    // Arrange
    const enc = encRealizado(2, "2025-10-14", mkRegistro({ id: "r-2" }));
    const dupla = duplaCom({ encontros: [enc] });

    // Act
    const estado = avaliar(dupla, enc.id);

    // Assert
    expect(estado.tipo).toBe("bloqueado");
    if (estado.tipo !== "bloqueado") return;
    expect(estado.motivo).toBe("ja_registrado");
  });

  it("dupla pausada e encerrada ficam inativas; concluída só abre com rito pendente", () => {
    // Arrange
    const enc = encRealizado(1, "2025-10-07", null);
    const pausada = duplaCom({ status: "pausada", encontros: [enc] });
    const encerrada = duplaCom({ status: "encerrada", encontros: [enc] });
    const concluida = duplaCom({ status: "concluida", encontros: [enc] });

    // Act
    const a = avaliar(pausada, enc.id);
    const b = avaliar(encerrada, enc.id);
    const c = avaliar(concluida, enc.id);

    // Assert
    expect([a.tipo === "bloqueado" && a.motivo]).toEqual(["dupla_inativa"]);
    expect([b.tipo === "bloqueado" && b.motivo]).toEqual(["dupla_inativa"]);
    expect([c.tipo === "bloqueado" && c.motivo]).toEqual(["dupla_inativa"]);
    // o último encontro que fechou a jornada ainda aceita registro (0102)
    expect(avaliar(concluida, enc.id, true).tipo).toBe("ok");
  });

  it("quem não é o mentor da dupla não registra", () => {
    // Arrange
    const enc = encRealizado(3, "2025-10-21", null);
    const dupla = duplaCom({
      encontros: [enc],
      mentor: mkProfile({ id: "outro-mentor" }),
    });

    // Act
    const estado = avaliar(dupla, enc.id);

    // Assert
    expect(estado.tipo).toBe("bloqueado");
    if (estado.tipo !== "bloqueado") return;
    expect(estado.motivo).toBe("nao_e_mentor");
  });

  it("encontroId de outra dupla devolve sem_encontro (404)", () => {
    // Arrange
    const enc = encRealizado(2, "2025-10-14", null);
    const dupla = duplaCom({ encontros: [enc] });

    // Act
    const estado = avaliar(dupla, "e-de-outra-dupla");

    // Assert
    expect(estado).toEqual({ tipo: "bloqueado", motivo: "sem_encontro" });
  });
});

// ---------- passoDoEncontro ----------

describe("passoDoEncontro", () => {
  it("DPP usa o número do encontro como identidade do passo", () => {
    // Arrange
    const enc = mkEncontro(8);
    const dupla = duplaCom({ encontros: [enc] });

    // Act
    const passo = passoDoEncontro(dupla, enc, PASSOS);

    // Assert
    expect(passo?.numero).toBe(8);
  });

  it("especialista resolve pelo rank das tentativas — a 3ª tentativa cobre o passo 2", () => {
    // Arrange
    // tentativa 1 realizado (passo 1), 2 furou, 3 é a cartada atual
    const t1 = encRealizado(1, "2025-10-07");
    const t2 = mkEncontro(2, { status: "nao_aconteceu", data_hora: "2025-10-14T22:00:00Z" });
    const t3 = mkEncontro(3, { status: "agendado", data_hora: "2025-10-21T22:00:00Z" });
    const dupla = duplaCom({
      trilha: "especialista",
      encontros: [t1, t2, t3],
    });

    // Act
    const passo = passoDoEncontro(dupla, t3, PASSOS_ESP);

    // Assert
    expect(passo?.numero).toBe(2);
    expect(passo?.titulo).toBe("Diagnóstico");
  });
});

// ---------- filaRegistrosPendentes ----------

describe("filaRegistrosPendentes", () => {
  it("ordem por número, exclui o atual e ignora futuro com data", () => {
    // Arrange
    const realizado = encRealizado(2, "2025-10-14", null);
    const vencido = encAgendado(1, "2025-10-10");
    const comRegistro = encRealizado(3, "2025-10-21");
    const futuro = encAgendado(4, "2025-11-20");
    const dupla = duplaCom({
      encontros: [realizado, vencido, comRegistro, futuro],
    });

    // Act
    const fila = filaRegistrosPendentes(dupla, {
      excluirEncontroId: realizado.id,
      agora: AGORA,
    });

    // Assert
    expect(fila).toEqual([{ encontroId: vencido.id, numero: 1 }]);
  });

  it("inclui realizado sem registro e agendado vencido, na ordem do guia", () => {
    // Arrange
    const e5 = encRealizado(5, "2025-11-04", null);
    const e2 = encAgendado(2, "2025-10-12");
    const e4 = mkEncontro(4, {
      status: "remarcado",
      data_hora: "2025-10-28T22:00:00Z",
    });
    const dupla = duplaCom({ encontros: [e5, e2, e4] });

    // Act
    const fila = filaRegistrosPendentes(dupla, { agora: AGORA });

    // Assert
    expect(fila.map((f) => f.numero)).toEqual([2, 4, 5]);
  });
});

// ---------- combinadosPendentesDaDupla ----------

describe("combinadosPendentesDaDupla", () => {
  it("exclui feito e ordena por prazo com nulos no fim", () => {
    // Arrange
    const dupla = duplaCom({
      encaminhamentos: [
        mkEncaminhamento({ id: "sem-prazo", prazo: null }),
        mkEncaminhamento({ id: "depois", prazo: "2025-12-01" }),
        mkEncaminhamento({ id: "feito", prazo: "2025-10-01", status: "feito" }),
        mkEncaminhamento({ id: "antes", prazo: "2025-11-20" }),
      ],
    });

    // Act
    const pendentes = combinadosPendentesDaDupla(dupla);

    // Assert
    expect(pendentes.map((c) => c.id)).toEqual([
      "antes",
      "depois",
      "sem-prazo",
    ]);
  });

  it("dupla sem combinados devolve lista vazia", () => {
    expect(combinadosPendentesDaDupla(duplaCom())).toEqual([]);
  });
});

// ---------- materiaisDoNumero ----------

const material = (over: Partial<Material>): Material => ({
  id: `m-${Math.random().toString(36).slice(2, 8)}`,
  titulo: "Material",
  descricao: null,
  tipo: "conteudo",
  url: null,
  path: null,
  audiencia: "todos",
  audiencias: null,
  encontro_num: null,
  ordem: 50,
  ...over,
});

describe("materiaisDoNumero", () => {
  it("filtra pela audiência da trilha — DPP não recebe material de especialista", () => {
    // Arrange
    const dpp = material({
      id: "do-dpp",
      encontro_num: 3,
      audiencias: ["mentor_dpp"],
    });
    const esp = material({
      id: "do-esp",
      encontro_num: 3,
      audiencias: ["mentor_especialista"],
    });
    const todos = material({
      id: "de-todos",
      encontro_num: 3,
      audiencias: ["todos"],
    });

    // Act
    const daDpp = materiaisDoNumero({
      materiais: [dpp, esp, todos],
      trilha: "dpp",
      numero: 3,
    });
    const daEsp = materiaisDoNumero({
      materiais: [dpp, esp, todos],
      trilha: "especialista",
      numero: 3,
    });

    // Assert
    expect(daDpp.map((m) => m.id)).toContain("do-dpp");
    expect(daDpp.map((m) => m.id)).toContain("de-todos");
    expect(daDpp.map((m) => m.id)).not.toContain("do-esp");
    expect(daEsp.map((m) => m.id)).toEqual(["do-esp", "de-todos"]);
  });

  it("enriquece com os docs do guia do encontro", () => {
    // Act
    const lista = materiaisDoNumero({
      materiais: [],
      eventosDaDupla: CICLO_16,
      trilha: "dpp",
      numero: 4,
    });

    // Assert
    const paths = lista.map((m) => m.path);
    expect(paths).toContain("doc:roteiro-encontro-04");
    expect(paths).toContain("doc:instrumento-pdm");
  });

  it("dedup por slug: a linha real do catálogo vence a sintética", () => {
    // Arrange
    const real = material({
      id: "roteiro-real",
      encontro_num: 4,
      path: "doc:roteiro-encontro-04",
      audiencias: ["todos"],
    });

    // Act
    const lista = materiaisDoNumero({
      materiais: [real],
      eventosDaDupla: CICLO_16,
      trilha: "dpp",
      numero: 4,
    });

    // Assert
    const roteiros = lista.filter((m) => m.path === "doc:roteiro-encontro-04");
    expect(roteiros).toHaveLength(1);
    expect(roteiros[0].id).toBe("roteiro-real");
  });

  it("não vaza material de outro número", () => {
    // Arrange
    const doNumero5 = material({ id: "m5", encontro_num: 5 });

    // Act
    const lista = materiaisDoNumero({
      materiais: [doNumero5],
      trilha: "dpp",
      numero: 4,
    });

    // Assert
    expect(lista.map((m) => m.id)).not.toContain("m5");
  });
});
