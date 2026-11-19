// REALIZA-34 — camada 3: fallback de IA quando o parser determinístico
// sai com confiança baixa ou o usuário pede. Usa o provider configurado
// (chamarModelo com toolChoice forçado) — o "Gemini" autorizado pelo Jira
// resolve como provider da casa, sem client paralelo. A saída passa pelas
// mesmas validações do caminho determinístico antes de ir à revisão.
import { chamarModelo, providerConfigurado } from "@/lib/ia/provider";
import type { EventoRascunho } from "@/lib/gerador-cronograma";
import { validaEventos } from "@/lib/gerador-cronograma";
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

const TOOL = {
  type: "function" as const,
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

const SYSTEM = `Você extrai cronogramas de programas de mentoria pra um formato estrito.
Regras:
- Encontros são sessões semanais/quinzenais numeradas (1..N) entre mentor e jovem.
- "Etapas de preparação" acontecem antes do Encontro 1 (inscrições, triagem, onboarding) e podem ter período (data e data_fim) ou data única.
- "Formação" é treinamento de mentores. "Recesso" tem data e data_fim. "Encerramento" é o evento final.
- Datas sempre YYYY-MM-DD. Sem ano no texto? Use o ano que fecha a sequência coerente.
- Título curto e descritivo, sem a data embutida.
- Se o documento não parecer um cronograma de mentoria, devolva eventos como array vazio.
- Chame a função entregar_cronograma UMA vez com o resultado completo.`;

function textoDoExtraido(extraido: Extraido): string {
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
    titulo: String(e.titulo ?? "").trim().slice(0, 120) || "Evento",
    fase: typeof e.fase === "string" && e.fase.trim() ? e.fase.trim() : null,
    instrumentos: Array.isArray(e.instrumentos)
      ? e.instrumentos.filter((i): i is string => typeof i === "string").slice(0, 12)
      : [],
    status: "pendente",
    observacao: typeof e.observacao === "string" && e.observacao.trim() ? e.observacao.trim() : null,
  };
}

/** Reprocessa o conteúdo extraído com o provider de IA configurado.
 *  Retorna o rascunho sanitizado ou erro pt-BR; nunca lança. */
export async function normalizarComIa(
  extraido: Extraido
): Promise<{ ok: true; rascunho: RascunhoImportacao } | { ok: false; erro: string }> {
  if (!providerConfigurado())
    return { ok: false, erro: "A IA não está configurada neste ambiente." };

  const texto = textoDoExtraido(extraido).slice(0, MAX_CHARS);
  const res = await chamarModelo(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Documento do cronograma:\n\n${texto}` },
    ],
    undefined,
    {
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "entregar_cronograma" } },
      timeoutMs: 45_000,
    }
  );
  if (!res.ok) return { ok: false, erro: res.erro };

  const call = res.mensagem.tool_calls?.find(
    (c) => c.function.name === "entregar_cronograma"
  );
  if (!call) return { ok: false, erro: "A IA respondeu sem o cronograma estruturado — revise manualmente ou tente de novo." };

  let payload: { turma?: string | null; nome?: string | null; eventos?: unknown[] };
  try {
    payload = JSON.parse(call.function.arguments);
  } catch {
    return { ok: false, erro: "A IA devolveu um formato inválido — revise manualmente ou tente de novo." };
  }

  const eventos = (Array.isArray(payload.eventos) ? payload.eventos : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map(saneEvento)
    .filter((e) => e.titulo);
  const erroValidacao = validaEventos(eventos);

  const avisos: string[] = ["Este rascunho foi montado pela IA — confira cada linha antes de gravar."];
  if (erroValidacao) avisos.push(`A prévia ainda precisa de ajuste: ${erroValidacao}`);
  const turma =
    typeof payload.turma === "string" && payload.turma.trim() ? payload.turma.trim().slice(0, 80) : null;
  if (!turma) avisos.push("A turma não foi identificada — informe o nome antes de gravar.");

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
  };
}
