import { describe, expect, it } from "vitest";
import {
  datasDaLinha,
  normalizarCronograma,
} from "@/lib/importar-cronograma/normalizar";
import { validaEventos } from "@/lib/gerador-cronograma";

// REALIZA-34 — fixtures no formato que a coordenação recebe de verdade:
// planilha gradeada, PDF texto corrido (uma linha por página), variante
// com datas sem ano e layout fraco (poucos eventos → confiança baixa).

describe("datasDaLinha", () => {
  it("dd/mm/aaaa", () => {
    expect(datasDaLinha("Encontro 1 — 24/06/2026")).toEqual([
      { data: "2026-06-24", temAno: true },
    ]);
  });

  it("dd/mm sem ano", () => {
    expect(datasDaLinha("Encontro 5 — 28/07")).toEqual([
      { data: "0000-07-28", temAno: false },
    ]);
  });

  it("intervalo dd/mm a dd/mm", () => {
    const ds = datasDaLinha("Recesso — 15/12/2026 a 10/01/2027");
    expect(ds.map((d) => d.data)).toEqual(["2026-12-15", "2027-01-10"]);
  });

  it("por extenso", () => {
    expect(datasDaLinha("Encontro 2 — 1º de julho de 2026")).toEqual([
      { data: "2026-07-01", temAno: true },
    ]);
  });

  it("ISO não vira dd/mm", () => {
    expect(datasDaLinha("Evento em 2026-06-24 confirmado")).toEqual([
      { data: "2026-06-24", temAno: true },
    ]);
  });
});

const TABELA: string[][] = [
  ["Cronograma da Turma 3 — Mentoria"],
  ["", ""],
  ["Etapa", "Data", "Observação"],
  ["Inscrições", "20/05/2026 a 10/06/2026", ""],
  ["Triagem e matching", "11/06/2026 a 20/06/2026", ""],
  ["Formação de mentores", "19/06/2026 e 20/06/2026", ""],
  ...Array.from({ length: 16 }, (_, i) => {
    // T3 — encontros às quartas, semanais a partir de 24/06/2026
    const d = new Date(Date.UTC(2026, 5, 24 + i * 7));
    const iso = d.toISOString().slice(0, 10);
    return [`Encontro ${i + 1}`, iso, ""];
  }),
  ["Recesso", "15/12/2026 a 10/01/2027", ""],
  ["Encerramento", "20/10/2026", ""],
];

describe("normalizarCronograma — tabela", () => {
  const r = normalizarCronograma({ formato: "tabela", linhas: TABELA });

  it("detecta a turma", () => expect(r.turma).toBe("Turma 3"));

  it("materializa a sequência canônica válida", () => {
    expect(validaEventos(r.eventos)).toBeNull();
  });

  it("16 encontros numerados e datados", () => {
    const encs = r.eventos.filter((e) => e.tipo === "encontro");
    expect(encs).toHaveLength(16);
    expect(encs.map((e) => e.numero)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    );
    expect(encs[0].data).toBe("2026-06-24");
    expect(encs.every((e) => e.data)).toBe(true);
  });

  it("encontros herdam fase/instrumentos do guia DPP", () => {
    const encs = r.eventos.filter((e) => e.tipo === "encontro");
    expect(encs[0].fase).toBe("Criar vínculo e construir o PDM");
    expect(encs[0].instrumentos.length).toBeGreaterThan(0);
  });

  it("recesso com período e encerramento reconhecidos", () => {
    const rec = r.eventos.find((e) => e.tipo === "recesso");
    expect(rec?.data).toBe("2026-12-15");
    expect(rec?.data_fim).toBe("2027-01-10");
    expect(
      r.eventos.some((e) => e.tipo === "evento_encerramento")
    ).toBe(true);
  });

  it("confiança alta e sem aviso de ausência", () => {
    expect(r.confianca).toBeGreaterThanOrEqual(0.9);
    expect(r.avisos).toEqual([]);
  });
});

describe("normalizarCronograma — texto (PDF corrido)", () => {
  const texto = [
    "Cronograma oficial — Turma 3 · 2026/2027",
    "Inscrições: 20/05 a 10/06/2026",
    "Encontro 1 — 24/06/2026 Boas-vindas",
    "Encontro 2 — 01/07/2026 Avaliação por terceiros",
    "Encontro 3 — 08/07/2026 Visão e metas",
    "Encontro 4 — 15/07",
    "Encontro 5 — 22/07",
    "Encontro 6 — 29/07",
    "Encontro 7 — 05/08",
    "Encontro 8 — 12/08",
    "Encontro 9 — 26/08",
    "Encontro 10 — 02/09",
    "Encontro 11 — 09/09",
    "Encontro 12 — 16/09",
    "Encontro 13 — 23/09",
    "Encontro 14 — 30/09",
    "Encontro 15 — 07/10",
    "Encontro 16 — 14/10",
    "Recesso de fim de ano — 15/12 a 10/01",
    "Evento de encerramento — 21/10",
  ].join("\n");

  const r = normalizarCronograma({ formato: "texto", texto });

  it("detecta turma e 16 encontros", () => {
    expect(r.turma).toBe("Turma 3");
    expect(r.eventos.filter((e) => e.tipo === "encontro")).toHaveLength(16);
  });

  it("datas sem ano herdam a âncora 2026", () => {
    const encs = r.eventos.filter((e) => e.tipo === "encontro");
    expect(encs[3].data).toBe("2026-07-15");
    expect(encs[15].data).toBe("2026-10-14");
  });

  it("recesso vira o ano seguinte quando passa da virada", () => {
    const rec = r.eventos.find((e) => e.tipo === "recesso");
    expect(rec?.data).toBe("2026-12-15");
    expect(rec?.data_fim).toBe("2027-01-10");
  });
});

describe("normalizarCronograma — layout fraco", () => {
  const r = normalizarCronograma({
    formato: "texto",
    texto: "Documento genérico sem cronograma. Um parágrafo sobre o projeto.",
  });

  it("zero eventos, confiança baixa e aviso", () => {
    expect(r.eventos).toHaveLength(0);
    expect(r.confianca).toBeLessThan(0.6);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});
