// Spec 022 US3 — guarda do gate de largura do /f/<token>: só os 4
// instrumentos sob medida ganham a coluna de documento no desktop; todo
// o resto (360, intakes, desfecho, forms genéricos, link sem sistema)
// fica na coluna estreita de leitura. A decisão é por sistema, nunca
// por tipo de link nem global — e nunca alarga antes de sm (mobile
// segue full-bleed como sempre foi).

import { describe, expect, it } from "vitest";
import { ehInstrumento, larguraPublicaForm } from "@/lib/forms/instrumentos";
import {
  INSTRUMENTOS_SISTEMA,
  SISTEMA_LABEL,
  type FormularioSistema,
} from "@/lib/forms/schema";

const TODOS = Object.keys(SISTEMA_LABEL) as FormularioSistema[];

describe("larguraPublicaForm", () => {
  it("devolve a coluna de documento pros 4 instrumentos sob medida", () => {
    expect(INSTRUMENTOS_SISTEMA).toEqual([
      "visao",
      "metas",
      "pdm",
      "roda_vida",
    ]);
    for (const s of INSTRUMENTOS_SISTEMA) {
      expect(larguraPublicaForm(s)).toBe("max-w-xl sm:max-w-3xl");
    }
  });

  it("demais sistemas e link sem sistema seguem na coluna estreita", () => {
    const demais = TODOS.filter(
      (s) => !(INSTRUMENTOS_SISTEMA as readonly string[]).includes(s)
    );
    // a lista existe: 360, avaliações finais, trilha, checklist, intakes, desfecho
    expect(demais.length).toBe(TODOS.length - 4);
    for (const s of demais) {
      expect(ehInstrumento(s)).toBe(false);
      expect(larguraPublicaForm(s)).toBe("max-w-xl");
    }
    expect(larguraPublicaForm(null)).toBe("max-w-xl");
    expect(larguraPublicaForm(undefined)).toBe("max-w-xl");
  });

  it("competencias_mentor é instrumento de dupla mas não de layout", () => {
    // emitido pela ficha (0190) mas renderiza no genérico — não pode
    // herdar a coluna de documento por engano
    expect(larguraPublicaForm("competencias_mentor")).toBe("max-w-xl");
  });

  it("a base sem prefixo é sempre a coluna estreita — mobile não muda", () => {
    for (const s of [...TODOS, null, undefined] as const) {
      expect(larguraPublicaForm(s).split(" ")[0]).toBe("max-w-xl");
    }
  });
});
