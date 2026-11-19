// REALIZA-34 — camada 3: fallback de IA quando o parser determinístico
// sai com confiança baixa ou o usuário pede. Spec 009 US1: a chamada é
// feita pelo caller (a action amarra ao chamarModelo real com o tier
// `forte` da ia_config — modelo, esforço e cadeia de fallbacks quentes,
// nunca IA_MODEL solto). A saída passa pelas mesmas validações do
// caminho determinístico antes de ir à revisão humana — obrigatória.
// Módulo puro pra teste: `chamar` injetado, import type é apagado e o
// vitest não arrasta o provider pra dentro do node.
import type { EventoRascunho } from "@/lib/gerador-cronograma";
import { validaEventos } from "@/lib/gerador-cronograma";
import type {
  IaToolChoice,
  IaToolDef,
  MsgChat,
  UsoIa,
} from "@/lib/ia/provider";
import type { Extraido } from "./extrair";
import type { RascunhoImportacao } from "./normalizar";

const MAX_CHARS = 30_000;

const TIPOS = [
  "etapa_preparacao",
  "encontro",
  "recesso",
  "formacao",
  "evento_encerramento",
] as const;

export const TOOL_CRONOGRAMA: IaToolDef = {
  type: "function",
  function: {
    name: "entregar_cronograma",
    description:
      "Devolve o cronograma de mentoria extraído do documento, já no schema canônico do produto.",
    parameters: {
      type: "object",
      required: ["eventos"],
      properties: {
        turma: { type: ["string", "null"], description: "Label da turma, ex. 'Turma 3' ou '2026/2027'." },
        nome: { type: ["string", "null"], description: "Nome sugerido pro cronograma." },
        eventos: {
          type: "array",
          items: {
            type: "object",
            required: ["tipo", "titulo"],
            properties: {
              tipo: { type: "string", enum: TIPOS },
              numero: { type: ["integer", "null"], description: "Só em encontro: 1, 2, ..." },
              data: { type: ["string", "null"], description: "YYYY-MM-DD" },
              data_fim: { type: ["string", "null"], description: "Fim de período (etapas e recessos)." },
              titulo: { type: "string" },
              fase: { type: ["string", "null"], description: "Fase do guia DPP, se identificável." },
              instrumentos: { type: "array", items: { type: "string" } },
              observacao: { type: ["string", "null"] },
            },
          },
        },
      },
    },
  },
};

/** tool_choice da chamada: a única ferramenta anunciada é obrigatória —
 *  texto solto do modelo nunca é parseado. */
export const TOOL_CHOICE_CRONOGRAMA: IaToolChoice = {
  type: "function",
  function: { name: "entregar_cronograma" },
};

const SYSTEM = `Você extrai cronogramas de programas de mentoria pra um formato estrito.
Regras:
- Encontros são sessões semanais/quinzenais numeradas (1..N) entre mentor e jovem.
- "Etapas de preparação" acontecem antes do Encontro 1 (inscrições, triagem, onboarding) e podem ter período (data e data_fim) ou data única.
- "Formação" é treinamento de mentores. "Recesso" tem data e data_fim. "Encerramento" é o evento final.
- Datas sempre YYYY-MM-DD. Sem ano no texto? Use o ano que fecha a sequência coerente.
- Título curto e descritivo, sem a data embutida.
- Documento em colunas ou tabela mesclada: leia o conjunto, não a ordem visual — cada evento é uma linha lógica.
- Se o documento não parecer um cronograma de mentoria, devolva eventos como array vazio.
- Chame a função entregar_cronograma UMA vez com o resultado completo.`;

/** Documento como texto corrido — tabela vira "a | b | c" por linha. É o
 *  que vai ao modelo E o que entra em args.chars da auditoria. */
export function textoDoExtraido(extraido: Extraido): string {
  if (extraido.formato === "texto") return extraido.texto;
  return extraido.linhas.map((r) => r.filter(Boolean).join(" | ")).join("\n");
}

function saneEvento(e: Record<string, unknown>): EventoRascunho {
  const tipo = TIPOS.includes(e.tipo as (typeof TIPOS)[number])
    ? (e.tipo as EventoRascunho["tipo"])
    : "etapa_preparacao";
  const data = typeof e.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.data) ? e.data : null;
  const fim = typeof e.data_fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.data_fim) ? e.data_fim : null;
  return {
    tipo,
    numero: tipo === "encontro" && Number.isInteger(e.numero) ? (e.numero as number) : null,
    data,
    data_fim: data ? fim : null,
    titulo: String(e.titulo ?? "").trim().slice(0, 120),
    fase: typeof e.fase === "string" && e.fase.trim() ? e.fase.trim() : null,
    instrumentos: Array.isArray(e.instrumentos)
      ? e.instrumentos.filter((i): i is string => typeof i === "string").slice(0, 10)
      : [],
    status: "pendente",
    observacao: typeof e.observacao === "string" && e.observacao.trim() ? e.observacao.trim() : null,
  };
}

/** JSON quebrado por corte (finish_reason=length) ou malformação:
 *  recupera os objetos completos dentro do array "eventos" — varre com
 *  balanceamento de chaves respeitando strings, parseia um a um e para
 *  no primeiro pedaço truncado. A resposta cortada no evento 23 não joga
 *  fora os 22 que chegaram — viram prévia com aviso (FR-003). */
function eventosParciaisDoArguments(
  argumentsStr: string
): Record<string, unknown>[] {
  const m = /"eventos"\s*:\s*\[/.exec(argumentsStr);
  if (!m) return [];
  let i = m.index + m[0].length;
  const objetos: Record<string, unknown>[] = [];
  while (i < argumentsStr.length) {
    while (i < argumentsStr.length && /[\s,]/.test(argumentsStr[i])) i++;
    if (i >= argumentsStr.length || argumentsStr[i] === "]") break;
    if (argumentsStr[i] !== "{") break;
    let depth = 0;
    let j = i;
    let inStr = false;
    let esc = false;
    for (; j < argumentsStr.length; j++) {
      const c = argumentsStr[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) break;
    }
    if (depth !== 0) break; // último objeto cortado no meio
    try {
      const o = JSON.parse(argumentsStr.slice(i, j + 1));
      if (o && typeof o === "object" && !Array.isArray(o)) objetos.push(o);
    } catch {
      // objeto completo mas inválido — pula e tenta o próximo
    }
    i = j + 1;
  }
  return objetos;
}

/** String escapada de um campo de topo em arguments quebrado — só roda
 *  no caminho de recuperação, quando o JSON inteiro já falhou o parse. */
function campoString(argumentsStr: string, campo: string): string | null {
  const m = new RegExp(
    `"${campo}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
    "u"
  ).exec(argumentsStr);
  if (!m) return null;
  try {
    const v = JSON.parse(`"${m[1]}"`) as unknown;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Fronteira com o provider — a action amarra ao chamarModelo real (tier
 *  `forte`, fallbacks e max_tokens do cronograma); o teste injeta stub
 *  (timeout, resposta sem tool_call, arguments truncados). */
export type ChamarCronograma = (
  msgs: MsgChat[],
  tools: IaToolDef[],
  toolChoice: IaToolChoice
) => Promise<
  | {
      ok: true;
      mensagem: MsgChat;
      usage?: UsoIa;
      modelo?: string;
      truncado?: boolean;
    }
  | { ok: false; erro: string }
>;

/** Reprocessa o conteúdo extraído com o provider de IA configurado.
 *  Retorna o rascunho sanitizado + telemetria da chamada, ou erro pt-BR;
 *  nunca lança. */
export async function normalizarComIa(
  extraido: Extraido,
  chamar: ChamarCronograma
): Promise<
  | {
      ok: true;
      rascunho: RascunhoImportacao;
      modelo?: string;
      tokensIn?: number;
      tokensOut?: number;
      /** a saída veio cortada (length) e o rascunho foi montado do que
       *  chegou — a prévia avisa; a auditoria registra */
      truncado?: boolean;
    }
  | { ok: false; erro: string }
> {
  const texto = textoDoExtraido(extraido);
  const cortadoEntrada = texto.length > MAX_CHARS;
  // a costura injetada pode lançar (abort do AbortSignal, fetch que
  // rejeita fora do fluxo do provider) — a action nunca propaga exceção,
  // então aqui vira {ok:false} como qualquer falha do modelo
  let res;
  try {
    res = await chamar(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Documento do cronograma:\n\n${texto.slice(0, MAX_CHARS)}`,
        },
      ],
      [TOOL_CRONOGRAMA],
      TOOL_CHOICE_CRONOGRAMA
    );
  } catch {
    return { ok: false, erro: "O processamento por IA falhou. Tente de novo." };
  }
  if (!res.ok) return { ok: false, erro: res.erro };

  const call = res.mensagem.tool_calls?.find(
    (c) => c.function.name === "entregar_cronograma"
  );
  if (!call)
    return {
      ok: false,
      erro: "A IA respondeu sem o cronograma estruturado. Revise manualmente ou tente de novo.",
    };

  let payload: { turma?: string | null; nome?: string | null; eventos?: unknown[] };
  // arguments cortado pelo teto de saída chega quebrado — salva o que
  // veio completo em vez de virar "formato inválido" (spec 009 FR-003).
  // JSON íntegro com finish_reason=length não perdeu nada: não avisa.
  let truncouSaida = false;
  try {
    payload = JSON.parse(call.function.arguments);
  } catch {
    const parciais = eventosParciaisDoArguments(call.function.arguments);
    if (!parciais.length)
      return {
        ok: false,
        erro: "A IA devolveu um formato inválido. Revise manualmente ou tente de novo.",
      };
    // o corte quase sempre acontece dentro de "eventos" — turma e nome
    // costumam vir inteiros antes do array; resgata os que sobreviveram
    payload = {
      turma: campoString(call.function.arguments, "turma"),
      nome: campoString(call.function.arguments, "nome"),
      eventos: parciais,
    };
    truncouSaida = true;
  }

  const eventos = (Array.isArray(payload.eventos) ? payload.eventos : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map(saneEvento)
    .filter((e) => e.titulo);
  const erroValidacao = validaEventos(eventos);

  const avisos: string[] = [
    "Este rascunho foi montado pela IA. Confira cada linha antes de gravar.",
  ];
  if (cortadoEntrada)
    avisos.push(
      "O documento é longo e a IA leu só o começo. Confira se faltou alguma parte no fim."
    );
  if (truncouSaida)
    avisos.push(
      "A resposta da IA veio incompleta. Confira se faltam eventos no fim da prévia."
    );
  if (erroValidacao) avisos.push(`A prévia ainda precisa de ajuste: ${erroValidacao}`);
  const turma =
    typeof payload.turma === "string" && payload.turma.trim() ? payload.turma.trim().slice(0, 80) : null;
  if (!turma) avisos.push("A turma não foi identificada. Informe o nome antes de gravar.");

  return {
    ok: true,
    rascunho: {
      turma,
      nome:
        typeof payload.nome === "string" && payload.nome.trim()
          ? payload.nome.trim().slice(0, 120)
          : null,
      eventos,
      avisos,
      confianca: eventos.length ? 0.8 : 0.2,
      viaIa: true,
    },
    modelo: res.modelo,
    tokensIn: res.usage?.prompt_tokens,
    tokensOut: res.usage?.completion_tokens,
    truncado: truncouSaida || undefined,
  };
}
