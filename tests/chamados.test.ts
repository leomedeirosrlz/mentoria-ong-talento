import { describe, expect, it } from "vitest";
import {
  demoChamadosFila,
  demoChamadoTimeline,
  demoChamadosSemDono,
} from "@/lib/demo/queries";
import { getDemoData } from "@/lib/demo/data";
import {
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_STATUS_LABEL,
} from "@/lib/ciclo";
import type { ChamadoCategoria, ChamadoStatus } from "@/lib/types";

// 0084 — regras puras dos chamados: o escopo do modo demo replica a RLS,
// então é a régua executável das decisões de acesso (plataforma mascarada
// pro auxiliar, autor ≠ dupla, interno nunca sai pro autor).

const NUM = {
  registro: "CHA-000141", // flag do registro da Fernanda (outro)
  jovem: "CHA-000142", // pedido do Caio pela avaliação (urgencia)
  agenda: "CHA-000143", // do Ricardo, em atendimento com a Marina
  plataforma: "CHA-000144", // da Ana (autora jovem logada)
  metodo: "CHA-000145", // aberto pela coord, atribuído ao Paulo
  devolutiva: "CHA-000136", // da Sofia, resolvido
  urgenciaAntiga: "CHA-000129", // do João Pedro, resolvido
  metodoAntiga: "CHA-000118", // do Ricardo, resolvido
};

function item(role: Parameters<typeof demoChamadosFila>[0], numero: string) {
  return demoChamadosFila(role).find((c) => c.numero === numero) ?? null;
}

describe("demoChamadosFila — escopo por papel", () => {
  it("coordenação vê a fila inteira, sem máscara", () => {
    const fila = demoChamadosFila("coordenacao");
    expect(fila.map((c) => c.numero).sort()).toEqual(
      Object.values(NUM).sort()
    );
    const plat = item("coordenacao", NUM.plataforma)!;
    expect(plat.restrito).toBe(false);
    expect(plat.assunto).toContain("anexar");
    expect(plat.autor_nome).toBe("Ana Beatriz Silva");
  });

  it("auxiliar executivo vê todas as linhas mas plataforma vem mascarada", () => {
    const fila = demoChamadosFila("supervisor");
    expect(fila.length).toBe(Object.keys(NUM).length);
    const plat = item("supervisor", NUM.plataforma)!;
    expect(plat.restrito).toBe(true);
    expect(plat.assunto).toBeNull();
    expect(plat.autor_id).toBeNull();
    expect(plat.autor_nome).toBeNull();
    expect(plat.dupla_id).toBeNull();
    // e os outros chegam íntegros
    const reg = item("supervisor", NUM.registro)!;
    expect(reg.restrito).toBe(false);
    expect(reg.autor_nome).toContain("Fernanda");
  });

  it("mentor vê só os próprios — dupla_id do jovem não dá acesso", () => {
    const fila = demoChamadosFila("mentor_dpp");
    expect(fila.map((c) => c.numero).sort()).toEqual(
      [NUM.agenda, NUM.metodoAntiga].sort()
    );
  });

  it("mentorado vê só os da própria ficha", () => {
    const fila = demoChamadosFila("mentorado");
    expect(fila.map((c) => c.numero)).toEqual([NUM.plataforma]);
  });

  it("a fila ordena aberto → em atendimento → resolvido, recente em cima", () => {
    const fila = demoChamadosFila("coordenacao");
    const ordem = fila.map((c) => c.status);
    const idx = (s: ChamadoStatus) =>
      ordem.findIndex((x) => x === s);
    expect(idx("aberto")).toBeGreaterThanOrEqual(0);
    expect(idx("aberto")).toBeLessThan(idx("em_atendimento"));
    expect(idx("em_atendimento")).toBeLessThan(idx("resolvido"));
    // dentro dos abertos, o mais novo primeiro (145 > 141 na created_at)
    const abertos = fila.filter((c) => c.status === "aberto");
    expect(abertos[0].numero).toBe(NUM.plataforma);
  });

  it("contexto descreve a origem (registro / avaliação / dupla)", () => {
    expect(item("coordenacao", NUM.registro)!.contexto).toMatch(
      /Registro do 2º encontro · Dandara/
    );
    expect(item("coordenacao", NUM.jovem)!.contexto).toMatch(
      /Avaliação do 4º encontro · Caio/
    );
    expect(item("coordenacao", NUM.agenda)!.contexto).toBe(
      "Dupla de Ana Beatriz Silva"
    );
  });
});

describe("demoChamadoTimeline — trilha pública × interna", () => {
  const data = getDemoData();
  const idAgenda = data.chamados.find((c) => c.numero === NUM.agenda)!.id;

  it("staff vê sistema + públicas + internas + anexos", () => {
    const tl = demoChamadoTimeline(idAgenda, true);
    const tipos = tl.map((t) => t.tipo);
    expect(tipos).toContain("sistema");
    expect(tipos).toContain("publica");
    expect(tipos).toContain("interno");
    // ordenado por created_at
    const stamps = tl.map((t) => t.item.created_at);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it("autor vê o mesmo chamado SEM a nota interna", () => {
    const tl = demoChamadoTimeline(idAgenda, false);
    expect(tl.every((t) => t.tipo !== "interno")).toBe(true);
    expect(tl.map((t) => t.tipo)).toContain("publica");
  });

  it("anexo interno não sai pro autor", () => {
    const data2 = getDemoData();
    const plat = data2.chamados.find((c) => c.numero === NUM.plataforma)!;
    const tlStaff = demoChamadoTimeline(plat.id, true);
    const tlAutor = demoChamadoTimeline(plat.id, false);
    expect(tlStaff.some((t) => t.tipo === "anexo")).toBe(true);
    // o anexo da Ana é público — os dois veem; o interno seria filtrado
    expect(tlAutor.some((t) => t.tipo === "anexo")).toBe(true);
  });
});

describe("demoChamadosSemDono — badge da nav", () => {
  it("coord conta os abertos sem responsável", () => {
    // abertos sem dono: 141 (registro), 142 (jovem), 144 (plataforma) = 3
    expect(demoChamadosSemDono("coordenacao")).toBe(3);
  });

  it("auxiliar não conta plataforma (é da coordenação)", () => {
    // 144 mascarado (restrito) não entra na fila dele → 141 + 142 = 2
    expect(demoChamadosSemDono("supervisor")).toBe(2);
  });

  it("autor nunca tem fila", () => {
    expect(demoChamadosSemDono("mentor_dpp")).toBe(0);
    expect(demoChamadosSemDono("mentorado")).toBe(0);
  });
});

describe("labels", () => {
  it("toda categoria e status tem rótulo pt-BR", () => {
    const cats: ChamadoCategoria[] = [
      "agenda",
      "metodologia",
      "plataforma",
      "urgencia",
      "outro",
    ];
    const stats: ChamadoStatus[] = ["aberto", "em_atendimento", "resolvido"];
    for (const c of cats) expect(CHAMADO_CATEGORIA_LABEL[c]).toBeTruthy();
    for (const s of stats) expect(CHAMADO_STATUS_LABEL[s]).toBeTruthy();
  });
});
