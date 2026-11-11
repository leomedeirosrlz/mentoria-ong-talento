import { describe, expect, it } from "vitest";
import {
  aplicarSemantico,
  candidatosParaIa,
  CONFIANCA_MIN_IA,
  matchSemantico,
  parseSaidaSemantico,
  payloadMatchSemantico,
  promptMatchSemantico,
  TOOL_CHOICE_MATCH,
  TOOL_MATCH_SEMANTICO,
  wa4De,
  type ChamarSemantico,
  type SaidaSemantico,
} from "@/lib/importar/match-semantico";
import {
  argsMatchSemantico,
  MAX_CHAMADAS_IA_LOTE,
  novoLoteId,
} from "@/lib/importar/lote";
import type { DuplaCandidata } from "@/lib/importar-registros";
import type { IaToolCall, MsgChat } from "@/lib/ia/provider";

// ---------- fixtures ----------

const dupla = (
  id: string,
  mentorNome: string,
  mentoradoNome: string,
  extra: Partial<DuplaCandidata> = {}
): DuplaCandidata => ({
  id,
  mentor_id: `m-${id}`,
  mentorado_id: `j-${id}`,
  status: "ativa",
  trilha: "dpp",
  mentorNome,
  mentoradoNome,
  cronograma_id: "cron-1",
  iniciada_em: "2026-02-01",
  score: 61,
  ...extra,
});

const CANDS = [
  dupla("d1", "Nicolly Barbosa", "Fernando Toledo"),
  dupla("d2", "Nicolly Souza", "Fernando Toledo"),
  dupla("d3", "Ana Clara", "Julio Almeida"),
];

const toolCall = (args: unknown): MsgChat => ({
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: "tc1",
      type: "function",
      function: {
        name: "match_semantico",
        arguments: typeof args === "string" ? args : JSON.stringify(args),
      },
    } satisfies IaToolCall,
  ],
});

// ---------- payload minimizado por construção ----------

describe("payload do match — minimização", () => {
  it("candidato leva só {i, mentorNome, mentoradoNome, trilha, wa4}", () => {
    const wa4 = new Map([["j-d1", "8741"], ["j-d2", null]]);
    const cands = candidatosParaIa(CANDS, wa4);
    expect(cands).toHaveLength(3);
    expect(cands[0]).toEqual({
      i: 0,
      mentorNome: "Nicolly Barbosa",
      mentoradoNome: "Fernando Toledo",
      trilha: "dpp",
      wa4: "8741",
    });
    expect(cands[1].wa4).toBeNull();
    // nada além do contrato: id, mentor_id/mentorado_id, status, score,
    // cronograma_id, iniciada_em ficam no servidor
    for (const c of cands) {
      expect(Object.keys(c).sort()).toEqual(
        ["i", "mentorNome", "mentoradoNome", "trilha", "wa4"].sort()
      );
    }
  });

  it("payload tem só {mentorTxt, mentoradoTxt, candidatos} — sem PII do form", () => {
    const p = payloadMatchSemantico(
      "Fer Toledo",
      "Nicolly",
      candidatosParaIa(CANDS, new Map())
    );
    expect(Object.keys(p).sort()).toEqual(
      ["candidatos", "mentorTxt", "mentoradoTxt"].sort()
    );
    const serial = JSON.stringify(p);
    for (const proibido of [
      "dados_civis",
      "email",
      "e_mail",
      "form_bruto",
      "reflexoes",
      "whatsapp",
      "cpf",
      "data_nascimento",
      "observacoes",
    ]) {
      expect(serial).not.toContain(proibido);
    }
    // o whatsapp inteiro nunca aparece — só os 4 dígitos do wa4
    const comWa = payloadMatchSemantico(
      "a",
      "b",
      candidatosParaIa(CANDS, new Map([["j-d1", "8741"]]))
    );
    const s2 = JSON.stringify(comWa);
    expect(s2).toContain('"wa4":"8741"');
    expect(s2).not.toContain("41998877441");
  });

  it("mensagens levam o payload minimizado na vez do modelo", () => {
    const msgs = promptMatchSemantico(
      "Fer Toledo",
      "Nicolly",
      candidatosParaIa(CANDS, new Map())
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    const user = JSON.parse(msgs[1].content as string);
    expect(Object.keys(user).sort()).toEqual(
      ["candidatos", "mentorTxt", "mentoradoTxt"].sort()
    );
    expect(user.candidatos[0]).not.toHaveProperty("id");
    expect(user.candidatos[0]).not.toHaveProperty("score");
  });

  it("wa4 = últimos 4 dígitos; curto demais ou ausente vira null", () => {
    expect(wa4De("+55 41 98877-4419")).toBe("4419");
    expect(wa4De("41988774419")).toBe("4419");
    expect(wa4De("(41) 9 8877-4419")).toBe("4419");
    expect(wa4De("123")).toBeNull();
    expect(wa4De("")).toBeNull();
    expect(wa4De(null)).toBeNull();
    expect(wa4De(undefined)).toBeNull();
  });
});

// ---------- parse da saída (tool_call, nunca texto livre) ----------

describe("parseSaidaSemantico", () => {
  it("tool_call válida vira saída tipada", () => {
    const r = parseSaidaSemantico(
      toolCall({ indice: 1, confianca: 85, razao: "grafia bate" })
    );
    expect(r).toEqual({
      ok: true,
      saida: { indice: 1, confianca: 85, razao: "grafia bate" },
    });
  });

  it("sem tool_call → erro, nada é parseado do texto", () => {
    const msg: MsgChat = {
      role: "assistant",
      content: '{"indice":0,"confianca":99,"razao":"x"}',
    };
    expect(parseSaidaSemantico(msg).ok).toBe(false);
  });

  it("tool_call de outro nome → erro", () => {
    const m = toolCall({ indice: 0, confianca: 90, razao: "x" });
    m.tool_calls![0].function.name = "outra_tool";
    expect(parseSaidaSemantico(m).ok).toBe(false);
  });

  it("arguments quebrados / fora do schema → erro", () => {
    expect(parseSaidaSemantico(toolCall("{indice:")).ok).toBe(false);
    expect(
      parseSaidaSemantico(toolCall({ indice: 0, confianca: 90 })).ok
    ).toBe(false); // razao ausente
    expect(
      parseSaidaSemantico(
        toolCall({ indice: 0, confianca: 90, razao: "x", extra: 1 })
      ).ok
    ).toBe(false); // campo fora do strict
  });

  it("confiança string coage pra número", () => {
    const r = parseSaidaSemantico(
      toolCall({ indice: 0, confianca: "85", razao: "veio string" })
    );
    expect(r).toEqual({
      ok: true,
      saida: { indice: 0, confianca: 85, razao: "veio string" },
    });
  });

  it("indice null é saída válida (modelo preferiu não arriscar)", () => {
    const r = parseSaidaSemantico(
      toolCall({ indice: null, confianca: 40, razao: "empate real" })
    );
    expect(r).toEqual({
      ok: true,
      saida: { indice: null, confianca: 40, razao: "empate real" },
    });
  });
});

// ---------- aplicarSemantico: o teto é 'provavel' ----------

describe("aplicarSemantico", () => {
  const saida = (over: Partial<SaidaSemantico> = {}): SaidaSemantico => ({
    indice: 1,
    confianca: 85,
    razao: "a outra Nicolly bate pelo sobrenome",
    ...over,
  });

  it("confiança abaixo do piso não promove", () => {
    const r = aplicarSemantico(
      saida({ confianca: CONFIANCA_MIN_IA - 1 }),
      CANDS,
      { nivel: "manual" }
    );
    expect(r).toBeNull();
  });

  it("indice fora do range ou null → linha inalterada (null)", () => {
    expect(
      aplicarSemantico(saida({ indice: 3 }), CANDS, { nivel: "manual" })
    ).toBeNull();
    expect(
      aplicarSemantico(saida({ indice: -1 }), CANDS, { nivel: "manual" })
    ).toBeNull();
    expect(
      aplicarSemantico(saida({ indice: null, confianca: 100 }), CANDS, {
        nivel: "manual",
      })
    ).toBeNull();
  });

  it("manual → provavel é o teto: confiança 100 nunca vira auto", () => {
    const r = aplicarSemantico(saida({ confianca: 100 }), CANDS, {
      nivel: "manual",
    });
    expect(r).not.toBeNull();
    expect(r!.nivel).toBe("provavel");
    expect(r!.duplaId).toBe("d2");
    expect(r!.sugeridoIa).toEqual({
      duplaId: "d2",
      confianca: 100,
      razao: "a outra Nicolly bate pelo sobrenome",
    });
    expect(r!.mentorNome).toBe("Nicolly Souza");
    expect(r!.mentoradoNome).toBe("Fernando Toledo");
  });

  it("razão vira Evidencia sparkle na trilha da linha", () => {
    const r = aplicarSemantico(saida(), CANDS, { nivel: "manual" });
    expect(r!.evidencia).toEqual({
      icone: "sparkle",
      texto: "a outra Nicolly bate pelo sobrenome",
      peso: 0,
      lado: "par",
    });
  });

  it("linha já resolvida (auto/provavel) nunca é tocada", () => {
    for (const nivel of ["auto", "provavel"] as const) {
      expect(
        aplicarSemantico(saida({ confianca: 100 }), CANDS, { nivel })
      ).toBeNull();
    }
  });
});

// ---------- matchSemantico com provider injetado ----------

describe("matchSemantico", () => {
  const entrada = {
    mentorTxt: "Fer Toledo",
    mentoradoTxt: "Nicolly",
    candidatos: candidatosParaIa(CANDS, new Map([["j-d2", "8741"]])),
  };

  it("falha do provider (timeout/5xx) → {ok:false}, nada quebra", async () => {
    const chamar: ChamarSemantico = async () => ({
      ok: false,
      erro: "indisponível",
    });
    const r = await matchSemantico(entrada, { chamar });
    expect(r.ok).toBe(false);
  });

  it("chamar que lança exceção → {ok:false}", async () => {
    const chamar: ChamarSemantico = async () => {
      throw new Error("timeout");
    };
    const r = await matchSemantico(entrada, { chamar });
    expect(r).toEqual({ ok: false, erro: "timeout" });
  });

  it("resposta sem tool_call → {ok:false}", async () => {
    const chamar: ChamarSemantico = async () => ({
      ok: true,
      mensagem: { role: "assistant", content: "acho que é a primeira" },
    });
    const r = await matchSemantico(entrada, { chamar });
    expect(r.ok).toBe(false);
  });

  it("sucesso devolve saida + telemetria; msgs levam o payload minimizado", async () => {
    let visto: MsgChat[] | null = null;
    const chamar: ChamarSemantico = async (msgs, tools, choice) => {
      visto = msgs;
      expect(tools).toEqual([TOOL_MATCH_SEMANTICO]);
      expect(choice).toEqual(TOOL_CHOICE_MATCH);
      return {
        ok: true,
        mensagem: toolCall({ indice: 1, confianca: 88, razao: "wa4 bate" }),
        usage: { prompt_tokens: 120, completion_tokens: 20 },
        modelo: "mimo-test",
      };
    };
    const r = await matchSemantico(entrada, { chamar });
    expect(r).toEqual({
      ok: true,
      saida: { indice: 1, confianca: 88, razao: "wa4 bate" },
      modelo: "mimo-test",
      tokensIn: 120,
      tokensOut: 20,
    });
    const user = JSON.parse(visto![1].content as string);
    expect(user.mentorTxt).toBe("Fer Toledo");
    expect(user.candidatos).toHaveLength(3);
    expect(user.candidatos[1].wa4).toBe("8741");
  });
});

// ---------- auditoria: metadados, nunca conteúdo ----------

describe("auditoria do lote", () => {
  it("args do match_semantico têm exatamente {lote, n, txtLen}", () => {
    const lote = novoLoteId();
    const args = argsMatchSemantico(lote, 5, 42);
    expect(args).toEqual({ lote, n: 5, txtLen: 42 });
    const serial = JSON.stringify(args);
    for (const proibido of [
      "mentorTxt",
      "mentoradoTxt",
      "razao",
      "candidatos",
      "wa4",
      "indice",
    ]) {
      expect(serial).not.toContain(proibido);
    }
  });

  it("novoLoteId devolve uuid", () => {
    expect(novoLoteId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(novoLoteId()).not.toBe(novoLoteId());
  });

  it("teto do lote é 30 chamadas", () => {
    expect(MAX_CHAMADAS_IA_LOTE).toBe(30);
  });
});
