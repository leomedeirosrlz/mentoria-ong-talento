import { describe, expect, it } from "vitest";
import type { PdmDoc, PdmItem } from "@/lib/pdm";
import {
  metasAtivas,
  montaArvorePdm,
  parseSubmetasLinhas,
  PDM_MAX_SUBITENS,
  progressoPdm,
  resumoPdm,
  subitensAtivos,
} from "@/lib/pdm";

// Domínio puro do PDM vivo (REALIZA-181): montagem da árvore recursiva,
// órfãos, progresso excluindo descartadas, resumo pro encerramento e o
// parser das linhas de submetas (espelho da função SQL).

let seq = 0;
function item(parcial: Partial<PdmItem>): PdmItem {
  seq += 1;
  return {
    id: parcial.id ?? `id-${seq}`,
    parentId: null,
    titulo: parcial.titulo ?? `item ${seq}`,
    porque: null,
    indicador: null,
    areaVida: null,
    prazoAlvo: null,
    status: "ativa",
    atingidaEm: null,
    ordem: parcial.ordem ?? seq,
    origem: "manual",
    origemCampo: null,
    ...parcial,
  };
}

describe("montaArvorePdm", () => {
  it("monta metas e submetas aninhadas, ordenadas por ordem", () => {
    const arvore = montaArvorePdm([
      item({ id: "m2", titulo: "B", ordem: 2 }),
      item({ id: "s1", parentId: "m1", ordem: 2 }),
      item({ id: "m1", titulo: "A", ordem: 1 }),
      item({ id: "s0", parentId: "m1", ordem: 1 }),
      item({ id: "ss1", parentId: "s1", ordem: 1 }),
    ]);
    expect(arvore.map((n) => n.id)).toEqual(["m1", "m2"]);
    expect(arvore[0].filhos.map((n) => n.id)).toEqual(["s0", "s1"]);
    expect(arvore[0].filhos[1].filhos[0].id).toBe("ss1");
  });

  it("órfãos viram raízes em vez de sumir", () => {
    const arvore = montaArvorePdm([
      item({ id: "m1", ordem: 1 }),
      item({ id: "orf", parentId: "nao-existe", ordem: 2 }),
    ]);
    expect(arvore.map((n) => n.id).sort()).toEqual(["m1", "orf"]);
  });

  it("profundidade arbitrária resolve", () => {
    const arvore = montaArvorePdm([
      item({ id: "a", ordem: 1 }),
      item({ id: "b", parentId: "a" }),
      item({ id: "c", parentId: "b" }),
      item({ id: "d", parentId: "c" }),
      item({ id: "e", parentId: "d" }),
    ]);
    let no = arvore[0];
    for (const id of ["b", "c", "d", "e"]) {
      expect(no.filhos).toHaveLength(1);
      no = no.filhos[0];
      expect(no.id).toBe(id);
    }
    expect(no.filhos).toHaveLength(0);
  });
});

describe("progressoPdm", () => {
  it("conta só metas (raiz), exclui descartadas e subitens", () => {
    const itens = [
      item({ status: "atingida" }),
      item({ status: "ativa" }),
      item({ status: "descartada" }),
      item({ parentId: "x", status: "atingida" }), // subitem não conta
    ];
    const p = progressoPdm(itens);
    expect(p.total).toBe(2);
    expect(p.atingidas).toBe(1);
    expect(p.pct).toBe(50);
  });

  it("doc vazio dá 0, não NaN", () => {
    expect(progressoPdm([]).pct).toBe(0);
  });
});

describe("resumoPdm", () => {
  const doc = (itens: PdmItem[]): PdmDoc => ({
    duplaId: "d1",
    visao: "v",
    visaoEm: null,
    itens,
  });

  it("null sem doc e sem itens", () => {
    expect(resumoPdm(null)).toBeNull();
    expect(resumoPdm(doc([]))).toBeNull();
  });

  it("totais + lista de atingidas na prioridade", () => {
    const r = resumoPdm(
      doc([
        item({ id: "a", titulo: "A", status: "atingida", ordem: 2, atingidaEm: "2026-01-10T10:00:00Z" }),
        item({ id: "b", titulo: "B", status: "ativa", ordem: 1 }),
        item({ id: "c", titulo: "C", status: "atingida", ordem: 3, atingidaEm: null }),
        item({ id: "d", titulo: "D", status: "descartada", ordem: 4 }),
      ])
    );
    expect(r?.total).toBe(3);
    expect(r?.atingidas).toBe(2);
    expect(r?.atingidasLista.map((m) => m.titulo)).toEqual(["A", "C"]);
  });
});

describe("caps", () => {
  it("metasAtivas/subitensAtivos excluem descartadas (o teto ignora o lixo)", () => {
    const itens = [
      item({}),
      item({ status: "descartada" }),
      item({ parentId: "a" }),
      item({ parentId: "a", status: "descartada" }),
      item({ parentId: "a" }),
    ];
    expect(metasAtivas(itens)).toHaveLength(1);
    expect(subitensAtivos(itens)).toBe(2);
  });
});

describe("parseSubmetasLinhas", () => {
  it("uma linha por item; ignora vazias e tira prefixos", () => {
    expect(
      parseSubmetasLinhas("1. Montar currículo\n\n- Inscrever nos programas\n2) Treinar entrevista")
    ).toEqual([
      "Montar currículo",
      "Inscrever nos programas",
      "Treinar entrevista",
    ]);
  });

  it("numeração inline numa linha só também separa (texto colado)", () => {
    expect(
      parseSubmetasLinhas(
        "1. Montar o currículo com a Luana da ONG (até sexta). 2. Me inscrever nos 3 programas de aprendiz da cidade (até 15/09). 3. Treinar entrevista com o Ricardo."
      )
    ).toEqual([
      "Montar o currículo com a Luana da ONG (até sexta).",
      "Me inscrever nos 3 programas de aprendiz da cidade (até 15/09).",
      "Treinar entrevista com o Ricardo.",
    ]);
  });

  it("não quebra em números do meio da frase", () => {
    expect(
      parseSubmetasLinhas("Treinar 1.500 questões até dezembro")
    ).toEqual(["Treinar 1.500 questões até dezembro"]);
  });

  it("corta em 20 linhas sem falhar", () => {
    const linhas = Array.from({ length: 30 }, (_, i) => `${i + 1}. item ${i + 1}`).join("\n");
    const r = parseSubmetasLinhas(linhas);
    expect(r).toHaveLength(PDM_MAX_SUBITENS);
    expect(r[0]).toBe("item 1");
  });

  it("vazio e null devolvem []", () => {
    expect(parseSubmetasLinhas("")).toEqual([]);
    expect(parseSubmetasLinhas(null)).toEqual([]);
    expect(parseSubmetasLinhas("   \n \n")).toEqual([]);
  });
});
