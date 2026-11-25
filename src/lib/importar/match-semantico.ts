// Match semântico da importação assistida (REALIZA-180, fase 1).
//
// O determinístico (scoreLinha) deixa na fila 'manual' o que não consegue
// decidir — empate técnico, apelido fora do roster, grafia irreconhecível.
// Aqui o modelo escolhe ENTRE os top-5 que o determinístico já produziu:
// classificação estruturada, saída só por function-calling, candidatos
// minimizados por construção ({i, mentorNome, mentoradoNome, trilha, wa4}).
//
// Invariantes duras:
//   · sugestão NUNCA vira 'auto' nem 'ok' — 'manual' → 'provavel' é o teto;
//     a confirmação é sempre o clique humano no Select;
//   · sem tool_call válida a linha fica EXATAMENTE como o determinístico a
//     deixou — falha de provider não piora nenhuma linha;
//   · dados_civis, e-mail, form_bruto, reflexões e whatsapp inteiro nunca
//     entram no payload — a regra de review é o shape, não a boa vontade
//     do prompt.
//
// Módulo puro pra teste: quem chama injeta `chamar` (a action o amarra ao
// chamarModelo real); import type é apagado, então o vitest não arrasta o
// provider nem a árvore de tools pra dentro do node.

import { z } from "zod";
import type {
  DuplaCandidata,
  Evidencia,
  NivelMatch,
} from "../importar-registros";
import type {
  IaToolCall,
  IaToolChoice,
  IaToolDef,
  MsgChat,
  UsoIa,
} from "../ia/provider";

/** Confiança mínima pra sugestão entrar — abaixo disso a linha segue
 *  'manual' sem palpite (a IA não aprova o que ela mesma duvida). */
export const CONFIANCA_MIN_IA = 70;

/** Candidata como o modelo a vê — minimizada por construção. `wa4` são os
 *  últimos 4 dígitos do whatsapp do mentorado: desambigua "a do whatsapp
 *  41 9…" sem o número inteiro sair do perímetro. */
export type CandidatoIa = {
  i: number;
  mentorNome: string;
  mentoradoNome: string;
  trilha: string;
  wa4: string | null;
};

/** O que a IA sugere por linha — nunca altera o LinhaReg determinístico,
 *  entra como overlay da prévia até o clique humano. */
export type SugestaoIa = {
  duplaId: string;
  confianca: number;
  razao: string;
};

/** Últimos 4 dígitos do whatsapp — único pedaço do telefone que chega ao
 *  modelo. Curto demais (<4 dígitos) vira null: um "wa4" que é o número
 *  todo seria PII disfarçada. */
export function wa4De(whatsapp: string | null | undefined): string | null {
  const d = (whatsapp ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : null;
}

/** Top-5 do scoreLinha → payload minimizado do modelo. O índice `i` é a
 *  posição na lista — o `indice` devolvido aponta pra ela. */
export function candidatosParaIa(
  candidatos: DuplaCandidata[],
  wa4PorMentorado: Map<string, string | null>
): CandidatoIa[] {
  return candidatos.slice(0, 5).map((c, i) => ({
    i,
    mentorNome: c.mentorNome,
    mentoradoNome: c.mentoradoNome,
    trilha: c.trilha,
    wa4: wa4PorMentorado.get(c.mentorado_id) ?? null,
  }));
}

/** O payload exato enviado ao modelo — exportado pra o teste afirmar o
 *  shape (só esses campos; nenhuma coluna do form nem PII além dos nomes
 *  resolvidos e o wa4). */
export function payloadMatchSemantico(
  mentorTxt: string,
  mentoradoTxt: string,
  candidatos: CandidatoIa[]
): { mentorTxt: string; mentoradoTxt: string; candidatos: CandidatoIa[] } {
  return { mentorTxt, mentoradoTxt, candidatos };
}

const SYSTEM_MATCH =
  "Você decide a qual dupla cadastrada pertence uma resposta do formulário semanal de mentoria. " +
  "O formulário traz os nomes como a pessoa digitou: podem ter apelido, erro de grafia, sobrenome faltando ou só um dos nomes. " +
  "Você recebe até 5 duplas candidatas já filtradas; escolha pelo campo indice (posição 0 a 4) ou indice null quando nenhuma for claramente a certa. " +
  "Use wa4 (últimos dígitos do whatsapp do mentorado) só como desempate. " +
  "confianca vai de 0 a 100: use 70 ou mais somente quando uma candidata é claramente a certa; na dúvida, indice null. " +
  "razao é UMA frase curta em pt-BR explicando o que decidiu (apelido, grafia, trilha, wa4) pra pessoa que revisa. " +
  "Responda somente pela função match_semantico.";

/** Schema da saída — o mesmo zod valida o arguments devolvido e gera o
 *  JSON Schema anunciado (uma fonte só, sem drift). */
const saidaSchema = z
  .object({
    indice: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("posição da candidata escolhida (0 a 4) ou null se nenhuma convence"),
    confianca: z.coerce
      .number()
      .min(0)
      .max(100)
      .describe("0 a 100 — 70+ só quando a escolha é clara"),
    razao: z
      .string()
      .min(1)
      .max(220)
      .describe("uma frase curta em pt-BR explicando a escolha"),
  })
  .strict();

export type SaidaSemantico = z.infer<typeof saidaSchema>;

export const TOOL_MATCH_SEMANTICO: IaToolDef = {
  type: "function",
  function: {
    name: "match_semantico",
    description:
      "Escolhe a dupla cadastrada que corresponde ao par mentor x mentorado da resposta do form, entre as candidatas recebidas.",
    parameters: z.toJSONSchema(saidaSchema) as Record<string, unknown>,
  },
};

/** tool_choice da chamada: a única ferramenta anunciada é obrigatória —
 *  texto solto do modelo nunca é parseado. */
export const TOOL_CHOICE_MATCH: IaToolChoice = {
  type: "function",
  function: { name: "match_semantico" },
};

export function promptMatchSemantico(
  mentorTxt: string,
  mentoradoTxt: string,
  candidatos: CandidatoIa[]
): MsgChat[] {
  return [
    { role: "system", content: SYSTEM_MATCH },
    {
      role: "user",
      content: JSON.stringify(
        payloadMatchSemantico(mentorTxt, mentoradoTxt, candidatos)
      ),
    },
  ];
}

/** tool_call → saída tipada. Ausente, JSON quebrado ou fora do schema
 *  viram {ok:false} — o caller deixa a linha como estava e audita o erro. */
export function parseSaidaSemantico(
  mensagem: Pick<MsgChat, "tool_calls">
): { ok: true; saida: SaidaSemantico } | { ok: false; erro: string } {
  const call = (mensagem.tool_calls ?? []).find(
    (c): c is IaToolCall =>
      c?.type === "function" && c.function?.name === "match_semantico"
  );
  if (!call) return { ok: false, erro: "resposta sem tool_call match_semantico" };
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { ok: false, erro: "arguments da tool_call inválidos" };
  }
  const parsed = saidaSchema.safeParse(args);
  if (!parsed.success) return { ok: false, erro: "arguments fora do schema" };
  return { ok: true, saida: parsed.data };
}

/** Overlay da sugestão sobre a linha — o que muda quando a IA convence.
 *  `duplaId`/`nivel` sobem a 'provavel' (teto: nunca 'auto', status segue
 *  'revisar'); a razão vira Evidencia 'sparkle' na trilha da linha. */
export type OverlaySemantico = {
  sugeridoIa: SugestaoIa;
  duplaId: string;
  nivel: "provavel";
  mentorNome: string;
  mentoradoNome: string;
  evidencia: Evidencia;
};

/** Aplica a saída do modelo sobre a linha. Regras duras: só promove
 *  'manual' (auto/provavel do determinístico não são tocados); confiança
 *  ≥70 e índice dentro do range, senão null — a linha fica como estava. */
export function aplicarSemantico(
  saida: SaidaSemantico,
  candidatos: DuplaCandidata[],
  atual: { nivel: NivelMatch | null }
): OverlaySemantico | null {
  if (atual.nivel !== "manual") return null;
  if (saida.confianca < CONFIANCA_MIN_IA) return null;
  if (saida.indice == null || saida.indice < 0 || saida.indice >= candidatos.length) {
    return null;
  }
  const d = candidatos[saida.indice];
  return {
    sugeridoIa: {
      duplaId: d.id,
      confianca: saida.confianca,
      razao: saida.razao,
    },
    duplaId: d.id,
    nivel: "provavel",
    mentorNome: d.mentorNome,
    mentoradoNome: d.mentoradoNome,
    evidencia: {
      icone: "sparkle",
      texto: saida.razao,
      peso: 0,
      lado: "par",
    },
  };
}

/** Fronteira com o provider — a action amarra ao chamarModelo real; o
 *  teste injeta um stub (timeout, resposta sem tool_call, args quebrados). */
export type ChamarSemantico = (
  msgs: MsgChat[],
  tools: IaToolDef[],
  toolChoice: IaToolChoice
) => Promise<
  | { ok: true; mensagem: MsgChat; usage?: UsoIa; modelo?: string }
  | { ok: false; erro: string }
>;

/** Uma rodada do match: prompt → chamada → parse. Nunca lança — qualquer
 *  falha sai como {ok:false} e quem chamou deixa a linha intocada. */
export async function matchSemantico(
  entrada: { mentorTxt: string; mentoradoTxt: string; candidatos: CandidatoIa[] },
  deps: { chamar: ChamarSemantico }
): Promise<
  | {
      ok: true;
      saida: SaidaSemantico;
      modelo?: string;
      tokensIn?: number;
      tokensOut?: number;
    }
  | { ok: false; erro: string; modelo?: string }
> {
  const msgs = promptMatchSemantico(
    entrada.mentorTxt,
    entrada.mentoradoTxt,
    entrada.candidatos
  );
  let r: Awaited<ReturnType<ChamarSemantico>>;
  try {
    r = await deps.chamar(msgs, [TOOL_MATCH_SEMANTICO], TOOL_CHOICE_MATCH);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha na chamada" };
  }
  if (!r.ok) return { ok: false, erro: r.erro };
  const parsed = parseSaidaSemantico(r.mensagem);
  if (!parsed.ok) {
    return { ok: false, erro: parsed.erro, modelo: r.modelo };
  }
  return {
    ok: true,
    saida: parsed.saida,
    modelo: r.modelo,
    tokensIn: r.usage?.prompt_tokens,
    tokensOut: r.usage?.completion_tokens,
  };
}
