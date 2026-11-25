// Import de cronograma — sinais de complexidade + camada de IA (spec 009
// US1). O que se prova aqui é o módulo puro: classificação determinística
// do documento e o normalizarComIa com `chamar` injetado. O wiring da
// action (tier forte, reserva de limite, auditoria) vive em
// importar-cronograma-action.test.ts.

import { describe, expect, it } from "vitest";
import {
  conteudoQuaseVazio,
  documentoComplexo,
  extensaoDoArquivo,
  type Extraido,
} from "@/lib/importar-cronograma/extrair";
import {
  normalizarComIa,
  TOOL_CHOICE_CRONOGRAMA,
  TOOL_CRONOGRAMA,
  textoDoExtraido,
  type ChamarCronograma,
} from "@/lib/importar-cronograma/ia";
import type { IaToolCall, MsgChat } from "@/lib/ia/provider";

// ---------- fixtures ----------

const texto = (t: string, paginas?: number): Extraido => ({
  formato: "texto",
  texto: t,
  paginas,
});
const tabela = (linhas: string[][], abas?: number): Extraido => ({
  formato: "tabela",
  linhas,
  abas,
});

const toolCall = (args: unknown): MsgChat => ({
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: "tc1",
      type: "function",
      function: {
        name: "entregar_cronograma",
        arguments: typeof args === "string" ? args : JSON.stringify(args),
      },
    } satisfies IaToolCall,
  ],
});

const RESPOSTA = {
  turma: "Turma 7",
  nome: "Calendário oficial 2026",
  eventos: [
    { tipo: "etapa_preparacao", titulo: "Inscrições", data: "2026-05-01", data_fim: "2026-05-20" },
    { tipo: "encontro", numero: 1, titulo: "Apresentação", data: "2026-06-02" },
    { tipo: "encontro", numero: 2, titulo: "Confiança", data: "2026-06-09" },
    { tipo: "evento_encerramento", titulo: "Celebração", data: "2026-10-20" },
  ],
};

const chamarOk = (
  args: unknown = RESPOSTA,
  extra: { truncado?: boolean } = {}
): ChamarCronograma =>
  async () => ({
    ok: true,
    mensagem: toolCall(args),
    modelo: "modelo-forte-x",
    usage: { prompt_tokens: 900, completion_tokens: 400 },
    ...extra,
  });

// ---------- classificação determinística ----------

describe("documentoComplexo — sinais determinísticos (FR-001)", () => {
  it("confiança alta sem indícios resolve no determinístico", () => {
    expect(documentoComplexo(texto("x".repeat(500)), 1)).toBe(false);
    expect(documentoComplexo(texto("x".repeat(500)), 0.6)).toBe(false);
  });

  it("confiança baixa (parser falhou) dispara a IA sem clique", () => {
    expect(documentoComplexo(texto("x".repeat(500)), 0.59)).toBe(true);
    expect(documentoComplexo(texto("x".repeat(500)), 0)).toBe(true);
    const linhas = [["etapa", "data", "obs"], ...Array.from({ length: 10 }, (_, i) => [`linha ${i}`, "x".repeat(10), ""])];
    expect(documentoComplexo(tabela(linhas, 1), 0.2)).toBe(true);
  });

  it("multi-sheet é indício direto mesmo com confiança alta", () => {
    const linhas = Array.from({ length: 30 }, (_, i) => [
      `Encontro ${i + 1}`,
      "02/06/2026",
    ]);
    expect(documentoComplexo(tabela(linhas, 3), 1)).toBe(true);
    expect(documentoComplexo(tabela(linhas, 1), 1)).toBe(false);
  });

  it("quase vazio (escaneado) NÃO vai à IA — cai no aviso honesto", () => {
    expect(documentoComplexo(texto("   ".repeat(20), 8), 0)).toBe(false);
    expect(documentoComplexo(tabela([[" "]]), 0)).toBe(false);
  });
});

describe("conteudoQuaseVazio — densidade de texto", () => {
  it("PDF com pouca densidade por página é escaneado", () => {
    expect(conteudoQuaseVazio(texto("x".repeat(150), 10))).toBe(true); // 15/pág
    expect(conteudoQuaseVazio(texto("x".repeat(500), 10))).toBe(false); // 50/pág
  });

  it("sem paginas (docx/txt) decide pelo total", () => {
    expect(conteudoQuaseVazio(texto("x".repeat(119)))).toBe(true);
    expect(conteudoQuaseVazio(texto("x".repeat(120)))).toBe(false);
  });

  it("tabela decide pela soma das células", () => {
    expect(conteudoQuaseVazio(tabela([["a", "b"]]))).toBe(true);
    expect(
      conteudoQuaseVazio(tabela([["x".repeat(50)], ["y".repeat(50)]]))
    ).toBe(false);
  });
});

describe("extensaoDoArquivo", () => {
  it("devolve a extensão sem o ponto", () => {
    expect(extensaoDoArquivo("cronograma.PDF")).toBe("pdf");
    expect(extensaoDoArquivo("planilha.xlsx")).toBe("xlsx");
    expect(extensaoDoArquivo("sem-extensao")).toBe("");
  });
});

// ---------- normalizarComIa com chamar injetado ----------

describe("normalizarComIa", () => {
  it("tool_call válida vira rascunho viaIa com telemetria", async () => {
    const r = await normalizarComIa(texto("cronograma turma 7"), chamarOk());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rascunho.viaIa).toBe(true);
    expect(r.rascunho.turma).toBe("Turma 7");
    expect(r.rascunho.nome).toBe("Calendário oficial 2026");
    expect(r.rascunho.eventos).toHaveLength(4);
    expect(r.rascunho.eventos[1]).toMatchObject({
      tipo: "encontro",
      numero: 1,
      data: "2026-06-02",
      status: "pendente",
    });
    expect(r.rascunho.confianca).toBe(0.8);
    expect(r.rascunho.avisos[0]).toContain("montado pela IA");
    expect(r.modelo).toBe("modelo-forte-x");
    expect(r.tokensIn).toBe(900);
    expect(r.tokensOut).toBe(400);
  });

  it("documento vai ao modelo no user message; tool e choice são os anunciados", async () => {
    let visto: { msgs: MsgChat[]; tools: unknown; choice: unknown } | null =
      null;
    const chamar: ChamarCronograma = async (msgs, tools, choice) => {
      visto = { msgs, tools, choice };
      return {
        ok: true,
        mensagem: toolCall(RESPOSTA),
      };
    };
    await normalizarComIa(
      texto("TEXTO-DO-CRONOGRAMA-ÚNICO encontro 1"),
      chamar
    );
    expect(visto!.tools).toEqual([TOOL_CRONOGRAMA]);
    expect(visto!.choice).toEqual(TOOL_CHOICE_CRONOGRAMA);
    expect(visto!.msgs[0].role).toBe("system");
    expect(visto!.msgs[1].content).toContain("TEXTO-DO-CRONOGRAMA-ÚNICO");
  });

  it("arguments truncado recupera os eventos completos + aviso (FR-003)", async () => {
    const truncado = JSON.stringify(RESPOSTA).slice(0, -60); // corta no meio do último evento
    const r = await normalizarComIa(texto("x".repeat(300)), chamarOk(truncado));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.truncado).toBe(true);
    expect(r.rascunho.eventos.length).toBeGreaterThanOrEqual(2);
    // turma/nome inteiros antes do array sobrevivem ao corte
    expect(r.rascunho.turma).toBe("Turma 7");
    expect(
      r.rascunho.avisos.some((a) => a.includes("veio incompleta"))
    ).toBe(true);
  });

  it("salvamento respeita strings com chaves/aspas escapadas dentro", async () => {
    const args = `{"turma":"Turma {x} \\"alfa\\"","eventos":[{"tipo":"encontro","numero":1,"titulo":"a }b {c","data":"2026-06-02"},{"tipo":"encontro","numero":2,"titulo":"E2","data":"2026-06-09"},{"tipo":"encontro","numero":3,"tit`;
    const r = await normalizarComIa(texto("x".repeat(300)), chamarOk(args));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rascunho.eventos).toHaveLength(2);
    expect(r.rascunho.eventos[0].titulo).toBe("a }b {c");
    expect(r.rascunho.turma).toBe('Turma {x} "alfa"');
    expect(r.truncado).toBe(true);
  });

  it("chamar que lança exceção → {ok:false} (a action nunca propaga)", async () => {
    const chamar: ChamarCronograma = async () => {
      throw new Error("abort");
    };
    const r = await normalizarComIa(texto("x".repeat(300)), chamar);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("falhou");
  });

  it("arguments totalmente quebrado sem eventos recuperáveis → erro", async () => {
    const r = await normalizarComIa(
      texto("x".repeat(300)),
      chamarOk('{"turma": "Turma 8", "even')
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("formato inválido");
  });

  it("resposta sem tool_call → erro, nada é parseado de texto livre", async () => {
    const chamar: ChamarCronograma = async () => ({
      ok: true,
      mensagem: {
        role: "assistant",
        content: JSON.stringify(RESPOSTA),
      },
    });
    const r = await normalizarComIa(texto("x".repeat(300)), chamar);
    expect(r.ok).toBe(false);
  });

  it("falha do provider → {ok:false} com o erro", async () => {
    const chamar: ChamarCronograma = async () => ({
      ok: false,
      erro: "indisponível",
    });
    const r = await normalizarComIa(texto("x".repeat(300)), chamar);
    expect(r).toEqual({ ok: false, erro: "indisponível" });
  });

  it("documento >30k chars é cortado antes do modelo, com aviso", async () => {
    let visto: MsgChat[] | null = null;
    const chamar: ChamarCronograma = async (msgs) => {
      visto = msgs;
      return { ok: true, mensagem: toolCall(RESPOSTA) };
    };
    const grande = "x".repeat(45_000);
    const r = await normalizarComIa(texto(grande), chamar);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const enviado = visto![1].content as string;
    expect(enviado.length).toBeLessThanOrEqual(30_100);
    expect(r.rascunho.avisos.some((a) => a.includes("leu só o começo"))).toBe(
      true
    );
  });

  it("eventos vazio → rascunho ok com confiança baixa e aviso de turma", async () => {
    const r = await normalizarComIa(
      texto("x".repeat(300)),
      chamarOk({ turma: null, nome: null, eventos: [] })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rascunho.eventos).toHaveLength(0);
    expect(r.rascunho.confianca).toBe(0.2);
    expect(r.rascunho.avisos.some((a) => a.includes("turma"))).toBe(true);
  });

  it("saneamento: tipo estranho cai em etapa_preparacao, data inválida vira null", async () => {
    const r = await normalizarComIa(
      texto("x".repeat(300)),
      chamarOk({
        turma: "T1",
        eventos: [
          { tipo: "festa", titulo: "Algo", data: "02/06/2026", instrumentos: ["a", 3, "b"] },
          { tipo: "encontro", numero: "2", titulo: "", data: "2026-06-09" },
        ],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rascunho.eventos[0].tipo).toBe("etapa_preparacao");
    expect(r.rascunho.eventos[0].data).toBeNull();
    expect(r.rascunho.eventos[0].instrumentos).toEqual(["a", "b"]);
    // título vazio cai fora — o filtro descarta o evento inútil
    expect(r.rascunho.eventos).toHaveLength(1);
  });

  it("tool_call de outro nome → erro", async () => {
    const chamar: ChamarCronograma = async () => ({
      ok: true,
      mensagem: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "tc9",
            type: "function",
            function: { name: "outra_tool", arguments: "{}" },
          },
        ],
      },
    });
    const r = await normalizarComIa(texto("x".repeat(300)), chamar);
    expect(r.ok).toBe(false);
  });
});

// ---------- textoDoExtraido (base dos args minimizados) ----------

describe("textoDoExtraido", () => {
  it("tabela vira linhas unidas por pipe", () => {
    expect(textoDoExtraido(tabela([["a", "", "b"], ["c"]]))).toBe("a | b\nc");
  });
});
