import { describe, expect, it } from "vitest";
import {
  instrumentosOrigemPdm,
  respostaOrigemDoItem,
} from "@/lib/pdm-origem";

const campos = [
  { id: "meta_1", tipo: "texto", label: "Meta 1", obrigatorio: true },
  { id: "submetas_1", tipo: "texto_longo", label: "Submetas", obrigatorio: false },
] as never[];

function instrumento(
  entregas: {
    link_id: string;
    status: string;
    respondido_em?: string;
    respostas: Record<string, unknown> | null;
  }[]
) {
  return {
    sistema: "pdm",
    titulo: "Plano de Desenvolvimento de Metas",
    campos,
    entregas,
  };
}

describe("respostaOrigemDoItem", () => {
  it("casa meta projetada com a resposta exata pelo título normalizado", () => {
    const instrumentos = instrumentosOrigemPdm([
      instrumento([
        {
          link_id: "l1",
          status: "respondido",
          respondido_em: "2026-01-01T10:00:00Z",
          respostas: { meta_1: "Passar em álgebra!" },
        },
        {
          link_id: "l2",
          status: "respondido",
          respondido_em: "2026-02-01T10:00:00Z",
          respostas: { meta_1: "Outra meta" },
        },
      ]),
    ]);
    const r = respostaOrigemDoItem(
      { titulo: "passar em algebra", origem: "pdm", origemCampo: "meta_1" },
      instrumentos
    );
    expect(r?.entrega.linkId).toBe("l1");
    expect(r?.certeza).toBe("exata");
    expect(r?.ancora).toBe("pdm-resposta-meta-1");
  });

  it("casa submeta pelo índice do slot e aponta a âncora da meta mãe", () => {
    const instrumentos = instrumentosOrigemPdm([
      instrumento([
        {
          link_id: "l1",
          status: "respondido",
          respondido_em: "2026-01-01T10:00:00Z",
          respostas: {
            meta_1: "Passar em álgebra",
            submetas_1: "Revisar apostila\nFazer simulado",
          },
        },
      ]),
    ]);
    const r = respostaOrigemDoItem(
      { titulo: "fazer simulado", origem: "pdm", origemCampo: "sub_1_2" },
      instrumentos
    );
    expect(r?.certeza).toBe("exata");
    expect(r?.ancora).toBe("pdm-resposta-meta-1");
  });

  it("item editado cai na resposta mais recente marcada como provável", () => {
    const instrumentos = instrumentosOrigemPdm([
      instrumento([
        {
          link_id: "l2",
          status: "respondido",
          respondido_em: "2026-02-01T10:00:00Z",
          respostas: { meta_1: "Outra meta" },
        },
      ]),
    ]);
    const r = respostaOrigemDoItem(
      { titulo: "Título reescrito à mão", origem: "pdm", origemCampo: "meta_1" },
      instrumentos
    );
    expect(r?.entrega.linkId).toBe("l2");
    expect(r?.certeza).toBe("provavel");
  });

  it("manual não resolve e pendente não entra no recorte", () => {
    const instrumentos = instrumentosOrigemPdm([
      instrumento([
        { link_id: "lp", status: "pendente", respostas: null },
      ]),
    ]);
    expect(instrumentos).toEqual([]);
    expect(
      respostaOrigemDoItem(
        { titulo: "x", origem: "manual", origemCampo: null },
        instrumentos
      )
    ).toBeNull();
  });
});
