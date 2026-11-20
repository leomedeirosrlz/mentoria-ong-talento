import { describe, expect, it } from "vitest";
import { montarResumoDupla } from "@/lib/dupla-resumo";
import { CICLO_16, dt, encRealizado, mkDupla, mkRegistro } from "./helpers";

const HOJE = dt("2025-10-15");

/** Registro legado salvo só com os defaults do form. */
const REGISTRO_VAZIO = mkRegistro({
  tema: null,
  ferramenta: null,
  reflexoes: null,
  observacoes: null,
  atividades: [],
  avaliacao: null,
  dificuldade: null,
  proximo_passo: null,
});

describe("montarResumoDupla — registro entregue", () => {
  it("registro vazio legado entra como pendência de registro", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", REGISTRO_VAZIO)],
    });

    const { resumo } = montarResumoDupla(dupla, CICLO_16, HOJE);

    expect(resumo.encontros.pendentes_registro).toEqual([1]);
    expect(resumo.encontros.feitos).toBe(1);
  });

  it("registro com conteúdo não é pendência", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", mkRegistro({ tema: "Escuta ativa" }))],
    });

    const { resumo } = montarResumoDupla(dupla, CICLO_16, HOJE);

    expect(resumo.encontros.pendentes_registro).toEqual([]);
  });
});
