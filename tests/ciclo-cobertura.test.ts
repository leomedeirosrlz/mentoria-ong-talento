// Cobertura de sessão em duas gerações:
//  · 007 US11 — `passosCobertosCandidatos`: quais passos a ficha oferece no
//    checkbox "a sessão também cobriu". Espelha o recorte do salvarRegistro —
//    se divergirem, a UI oferece o que a action recusa (ou esconde o que ela
//    aceita).
//  · 018/0226 — a sessão combinada gravada: UM registro na âncora com os
//    demais nºs em `cobertura` e `sessao_id` no grupo. A régua "tem
//    conteúdo?" passou a ser `encontroTemConteudo` (próprio OU coberto) —
//    estes testes trancam o efeito em cada leitor: coberto não é pendência,
//    não é limbo, não é candidato e a rota de registro o trata como entregue.

import { describe, expect, it } from "vitest";
import {
  bucketsDoEncontro,
  emLimbo,
  jornadaDaDupla,
  passosCobertosCandidatos,
  passosDaTrilha,
  saudadeDaDupla,
} from "@/lib/ciclo";
import {
  estadoDaRotaRegistro,
  filaRegistrosPendentes,
} from "@/lib/registro-contexto";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  mkAvaliacao,
  mkDupla,
  mkEncontro,
  mkProfile,
  mkRegistro,
} from "./helpers";

const PASSOS = passosDaTrilha("dpp", CICLO_16);
// 15/11/2025 — oficiais 1..6 já venceram (6º = 11/11, 7º só em 11/18)
const AGORA = new Date("2025-11-15T15:00:00Z");
const SESSAO = "sessao-56";

/** Âncora de uma sessão combinada: realizado com registro cobrindo `cob`. */
const ancora = (numero: number, dia: string, cob: number[]) =>
  mkEncontro(numero, {
    status: "realizado",
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    duracao_min: 120,
    sessao_id: SESSAO,
    registro: mkRegistro({ cobertura: cob }),
  });

/** Coberto pela sessão: realizado na mesma data/sessao_id, sem registro. */
const coberto = (numero: number, dia: string) =>
  mkEncontro(numero, {
    status: "realizado",
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    duracao_min: 120,
    sessao_id: SESSAO,
    registro: null,
  });

// ---------- passosCobertosCandidatos (007 US11) ----------

describe("passosCobertosCandidatos", () => {
  it("passo vencido sem row entra; o próprio, o último e os não-vencidos ficam de fora", () => {
    const candidatos = passosCobertosCandidatos(PASSOS, [], 6, AGORA).map(
      (p) => p.numero
    );
    expect(candidatos).toEqual([1, 2, 3, 4, 5]);
    expect(candidatos).not.toContain(6); // é o da ficha atual
    expect(candidatos).not.toContain(16); // fechamento é gesto próprio
    expect(candidatos).not.toContain(7); // oficial 18/11 ainda não venceu
  });

  it("realizado sem registro e agendado/remarcado vencido entram; fatos gravados ficam de fora", () => {
    const encontros = [
      encRealizado(1, "2025-11-10", null), // realizado SEM registro → entra
      encRealizado(2, "2025-11-09"), // realizado COM registro → fora
      encAgendado(3, "2025-11-11"), // agendado já vencido → entra
      encAgendado(4, "2025-11-20"), // agendado futuro → fora (cobrir não é desmarcação)
      mkEncontro(5, {
        status: "nao_aconteceu",
        data_hora: "2025-11-10T22:00:00Z",
      }), // fato registrado → fora
      mkEncontro(7, {
        status: "remarcado",
        data_hora: "2025-11-12T22:00:00Z",
      }), // remarcado vencido → entra
    ];
    const candidatos = passosCobertosCandidatos(
      PASSOS,
      encontros,
      6,
      AGORA
    ).map((p) => p.numero);
    expect(candidatos).toEqual([1, 3, 7]);
  });

  it("agendado sem data ('a combinar') é compromisso aberto — entra", () => {
    const encontros = [mkEncontro(2, { status: "agendado" })];
    const candidatos = passosCobertosCandidatos(
      PASSOS,
      encontros,
      6,
      AGORA
    ).map((p) => p.numero);
    expect(candidatos).toContain(2);
  });

  it("passo já coberto por uma sessão anterior está FEITO — não volta como candidato", () => {
    // o 5º cobriu o 6º numa sessão passada; registrar o 8º hoje não pode
    // oferecer o 6º de novo — cobrir duas vezes duplicaria a entrega. O 7º
    // (vencido em 18/11, sem row) entra pra provar que só o coberto saiu.
    const depois18 = new Date("2025-11-19T15:00:00Z");
    const encontros = [ancora(5, "2025-11-04", [6]), coberto(6, "2025-11-04")];
    const candidatos = passosCobertosCandidatos(
      PASSOS,
      encontros,
      8,
      depois18
    ).map((p) => p.numero);
    expect(candidatos).toContain(7);
    expect(candidatos).not.toContain(6);
  });
});

// ---------- sessão combinada: coberto não é pendência (018) ----------

describe("sessão combinada — pendência e limbo", () => {
  it("coberto não acende registro pendente nem limbo no semáforo", () => {
    const dupla = mkDupla({
      encontros: [ancora(5, "2025-11-04", [6]), coberto(6, "2025-11-04")],
    });

    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-11-12"));

    expect(s.registroPendente).toBe(false);
    expect(s.sinais.map((x) => x.tipo)).not.toContain("registro_pendente");
  });

  it("a pendência real ao lado continua aparecendo — só o coberto sai", () => {
    const dupla = mkDupla({
      encontros: [
        ancora(2, "2025-10-14", [3]),
        coberto(3, "2025-10-14"),
        encRealizado(4, "2025-10-28", null), // este sim deve registro
      ],
    });

    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-11-12"));

    expect(s.registroPendente).toBe(true);
    expect(s.sinais.map((x) => x.tipo)).toContain("registro_pendente");
  });

  it("emLimbo respeita o mapa: agendado vencido coberto não está em limbo", () => {
    // estado transiente entre a fase 1 (sessao_id linkado) e a fase 2 (flip
    // pra realizado) do salvarRegistro — a régua já trata como entregue
    const enc = encAgendado(6, "2025-11-04");
    const mapa = new Map([[6, 5]]);
    expect(emLimbo(enc, AGORA.getTime(), mapa)).toBe(false);
    // sem a cobertura, o mesmo agendado vencido é limbo de verdade
    expect(emLimbo(enc, AGORA.getTime(), new Map())).toBe(true);
  });

  it("buckets: o coberto senta em realizados junto da âncora, não em pendentes", () => {
    const dupla = mkDupla({
      encontros: [
        ancora(5, "2025-11-04", [6]),
        coberto(6, "2025-11-04"),
        encRealizado(4, "2025-10-28", null),
      ],
    });
    const itens = dupla.encontros.map((encontro) => ({ encontro, dupla }));

    const b = bucketsDoEncontro(itens, AGORA.getTime());

    expect(b.realizados.map((x) => x.encontro.numero)).toEqual([5, 6]);
    expect(b.pendentes.map((x) => x.encontro.numero)).toEqual([4]);
  });
});

describe("sessão combinada — avaliação do jovem", () => {
  it("avaliacaoJovemPendente não conta o coberto — a resposta cobre o grupo", () => {
    const sessao = mkDupla({
      encontros: [
        {
          ...ancora(5, "2025-11-04", [6]),
          avaliacao_jovem: mkAvaliacao({
            encontro_id: "e-5",
            cobertura: [5, 6],
          }),
        },
        { ...coberto(6, "2025-11-04"), avaliacao_jovem: null },
      ],
    });

    const s = saudadeDaDupla(sessao, CICLO_16, dt("2025-11-12"));

    expect(s.avaliacaoJovemPendente).toBe(0);
  });

  it("sessão sem resposta nenhuma conta uma pendência por encontro realizado", () => {
    const dupla = mkDupla({
      encontros: [ancora(5, "2025-11-04", [6]), coberto(6, "2025-11-04")],
    });

    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-11-12"));

    expect(s.avaliacaoJovemPendente).toBe(2);
  });
});

describe("sessão combinada — jornada", () => {
  it("âncora e coberto leem realizado_completo; o passo sem cobertura segue pendente", () => {
    const dupla = mkDupla({
      encontros: [
        ancora(5, "2025-11-04", [6]),
        coberto(6, "2025-11-04"),
        encRealizado(7, "2025-11-11", null),
      ],
    });

    const j = jornadaDaDupla(dupla, PASSOS, AGORA);

    expect(j.nos[4].estado).toBe("realizado_completo"); // âncora
    expect(j.nos[5].estado).toBe("realizado_completo"); // coberto
    expect(j.nos[6].estado).toBe("pendente_registro"); // ainda deve
    expect(j.comRegistro).toBe(2);
    expect(j.pendentesRegistro).toBe(1);
    // os dois contam como feitos — a jornada anda pelo grupo inteiro
    expect(j.feitos).toBe(3);
  });
});

// ---------- rota de registro: coberto = já entregue (018) ----------

describe("sessão combinada — rota de registro", () => {
  const MENTOR = mkProfile({ id: "mentor-1", nome: "Mentora Teste" });
  const avaliar = (
    dupla: ReturnType<typeof mkDupla>,
    encontroId: string
  ) =>
    estadoDaRotaRegistro({
      dupla,
      encontroId,
      passos: PASSOS,
      meId: MENTOR.id,
      agora: AGORA,
      ritoPendente: false,
    });

  it("encontro coberto é bloqueado como ja_registrado — editar mora na âncora", () => {
    const a = ancora(5, "2025-11-04", [6]);
    const c = coberto(6, "2025-11-04");
    const dupla = mkDupla({ mentor: MENTOR, encontros: [a, c] });

    const estado = avaliar(dupla, c.id);

    expect(estado.tipo).toBe("bloqueado");
    if (estado.tipo === "bloqueado") {
      expect(estado.motivo).toBe("ja_registrado");
    }
  });

  it("âncora com registro segue ja_registrado — a tabela não mudou pra ela", () => {
    const a = ancora(5, "2025-11-04", [6]);
    const dupla = mkDupla({ mentor: MENTOR, encontros: [a, coberto(6, "2025-11-04")] });

    const estado = avaliar(dupla, a.id);

    expect(estado.tipo).toBe("bloqueado");
    if (estado.tipo === "bloqueado") {
      expect(estado.motivo).toBe("ja_registrado");
    }
  });

  it("filaRegistrosPendentes exclui o coberto e mantém o que realmente falta", () => {
    const a = ancora(5, "2025-11-04", [6]);
    const c = coberto(6, "2025-11-04");
    const devendo = encRealizado(4, "2025-10-28", null);
    const dupla = mkDupla({ encontros: [a, c, devendo] });

    const fila = filaRegistrosPendentes(dupla, { agora: AGORA });

    expect(fila).toEqual([{ encontroId: devendo.id, numero: 4 }]);
  });
});
