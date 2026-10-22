import { describe, expect, it } from "vitest";
import {
  aplicaOutro,
  campoRespondido,
  coletaRespostas,
  leDeFormData,
  validaRespostas,
} from "./resposta";
import { visivel, type FormularioCampo } from "./schema";

// Coleta/validação do /f/<token> (REALIZA-70 + fronteiras novas da 0115):
// espelho client-side da RPC — o teste garante que os dois lados leem o
// mesmo contrato de dados (arquivo, grid, visible_if, "Outro: <texto>").

const C = (
  id: string,
  tipo: FormularioCampo["tipo"],
  extra: Partial<FormularioCampo> = {}
): FormularioCampo => ({ id, tipo, label: id, obrigatorio: true, ...extra });

describe("visivel", () => {
  const cond = C("filha", "texto_longo", {
    obrigatorio: false,
    visible_if: { campo: "mae", em: ["sim"] },
  });

  it("sem condição, sempre visível", () => {
    expect(visivel(C("a", "texto"), {})).toBe(true);
  });

  it("só aparece quando a resposta do gatilho casa", () => {
    expect(visivel(cond, {})).toBe(false);
    expect(visivel(cond, { mae: "nao" })).toBe(false);
    expect(visivel(cond, { mae: "sim" })).toBe(true);
  });

  it("gatilho multi_select: vale quando a opção está na lista", () => {
    const c = C("f", "texto", {
      visible_if: { campo: "m", em: ["x"] },
    });
    expect(visivel(c, { m: ["x", "y"] })).toBe(true);
    expect(visivel(c, { m: ["y"] })).toBe(false);
  });
});

describe("campoRespondido", () => {
  it("arquivo conta pelo path (objeto ou JSON do hidden)", () => {
    const c = C("cv", "arquivo");
    expect(campoRespondido(c, null)).toBe(false);
    expect(campoRespondido(c, { nome: "a.pdf" })).toBe(false);
    expect(campoRespondido(c, { path: "l/1.pdf", nome: "a.pdf" })).toBe(true);
    expect(campoRespondido(c, '{"path":"l/1.pdf"}')).toBe(true);
    expect(campoRespondido(c, "lixo{não-json")).toBe(false);
  });

  it("grid conta por célula ou hora marcada", () => {
    const c = C("disp", "grid_disponibilidade");
    expect(campoRespondido(c, { celulas: [], horas: [] })).toBe(false);
    expect(
      campoRespondido(c, { celulas: [{ dia: "seg", periodo: "noite" }] })
    ).toBe(true);
    expect(
      campoRespondido(
        c,
        JSON.stringify({ celulas: [], horas: [{ dia: "seg", hora: 18 }] })
      )
    ).toBe(true);
  });
});

describe("coletaRespostas", () => {
  it("arquivo/grid chegam pelo hidden JSON (mesmo canal do controlado)", () => {
    const fd = new FormData();
    fd.set("cv", JSON.stringify({ path: "l/u.pdf", nome: "cv.pdf", tamanho: 10 }));
    fd.set("disp", JSON.stringify({ celulas: [], horas: [] }));
    const { respostas } = coletaRespostas(
      [C("cv", "arquivo"), C("disp", "grid_disponibilidade", { obrigatorio: false })],
      leDeFormData(fd)
    );
    expect(respostas.cv).toEqual({ path: "l/u.pdf", nome: "cv.pdf", tamanho: 10 });
    // grid vazia não entra no payload (opcional vazia = não respondida)
    expect(respostas.disp).toBeUndefined();
  });

  it("hidden com lixo não vira resposta nem erro", () => {
    const fd = new FormData();
    fd.set("disp", "{lixo");
    const { respostas } = coletaRespostas(
      [C("disp", "grid_disponibilidade", { obrigatorio: false })],
      leDeFormData(fd)
    );
    expect(respostas.disp).toBeUndefined();
  });
});

describe("aplicaOutro", () => {
  const sel = C("cor", "select", {
    permite_outro: true,
    opcoes: ["Negra", "Branca"],
  });
  const multi = C("tags", "multi_select", {
    permite_outro: true,
    opcoes: ["a", "b"],
  });

  it('compõe "Outro: <texto>" no formato do sanitizer', () => {
    const r = aplicaOutro([sel], { cor: "Outro" }, () => "quilombola");
    expect(r.cor).toBe("Outro: quilombola");
  });

  it("multi_select compõe por item sem tocar nas demais opções", () => {
    const r = aplicaOutro([multi], { tags: ["a", "Outro"] }, () => "zzz");
    expect(r.tags).toEqual(["a", "Outro: zzz"]);
  });

  it("texto vazio deixa 'Outro' nu — a validação cobra em seguida", () => {
    const r = aplicaOutro([sel], { cor: "Outro" }, () => "");
    expect(r.cor).toBe("Outro");
  });

  it("campo sem permite_outro nunca mexe no valor", () => {
    const r = aplicaOutro(
      [C("cor", "select", { opcoes: ["x"] })],
      { cor: "Outro" },
      () => "y"
    );
    expect(r.cor).toBe("Outro");
  });
});

describe("validaRespostas", () => {
  it('"Outro" sem texto é erro — o servidor só aceita "Outro: <1-120>"', () => {
    const sel = C("cor", "select", {
      permite_outro: true,
      opcoes: ["Negra", "Branca"],
    });
    const mapa = validaRespostas([sel], { cor: "Outro" }, new Set());
    expect(mapa.cor).toBe('Descreva a opção "Outro".');
    // com o texto composto, passa
    const ok = validaRespostas([sel], { cor: "Outro: x" }, new Set());
    expect(ok.cor).toBeUndefined();
  });

  it("obriga arquivo e grade com mensagens próprias", () => {
    const mapa = validaRespostas(
      [C("cv", "arquivo"), C("disp", "grid_disponibilidade")],
      {},
      new Set()
    );
    expect(mapa.cv).toBe("Anexe o arquivo.");
    expect(mapa.disp).toBe("Marque os horários livres.");
  });

  it("pergunta condicional fora da condição não é validada (a RPC pula junto)", () => {
    // quem chama passa só as perguntas visíveis — o espelho é por
    // construção: a filha fora da lista nunca gera erro
    const mapa = validaRespostas(
      [C("mae", "sim_nao")],
      { mae: "nao" },
      new Set()
    );
    expect(mapa).toEqual({});
  });
});
