"use server";

// REALIZA-34 — importação de cronograma por arquivo. As duas actions SÓ
// leem o arquivo e devolvem rascunho: nada persiste aqui — a gravação é
// sempre a `criarCronograma` depois da revisão humana no builder.
// Spec 009 US1: documento com sinais de complexidade vai ao tier `forte`
// sem exigir o clique — mesma régua do import de registros (reserva
// consumirLimiteIa por processamento + evento ia_eventos por chamada,
// args minimizados: nunca o conteúdo do documento). Provider indisponível
// ou limite devolve o rascunho determinístico com aviso honesto, nunca
// erro fatal — a revisão humana segue obrigatória em todos os caminhos.
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { chamarModelo, providerConfigurado } from "@/lib/ia/provider";
import {
  esforcoDoTier,
  fallbacksDoTier,
  getIaConfig,
  modeloDoTier,
} from "@/lib/ia/config";
import { consumirLimiteIa } from "@/lib/ia/rate-limit";
import { registrarEventosImportacao } from "@/lib/importar/lote";
import {
  conteudoQuaseVazio,
  documentoComplexo,
  extrairConteudo,
  extensaoDoArquivo,
  type Extraido,
} from "@/lib/importar-cronograma/extrair";
import {
  normalizarCronograma,
  type RascunhoImportacao,
} from "@/lib/importar-cronograma/normalizar";
import {
  normalizarComIa,
  textoDoExtraido,
} from "@/lib/importar-cronograma/ia";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function gate(): Promise<{ supabase: Supa } | { error: string }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação importa cronogramas." };
  return { supabase };
}

/** Tier da rodada — cronograma completo pede o modelo forte; a escolha
 *  concreta do slug fica na config viva (ajuste quente no /ia). */
const TIER_IMPORT = "forte" as const;
/** Orçamento explícito (spec 009 FR-003/NFR): max_tokens cobre o
 *  arguments inteiro de um cronograma de ~30 eventos — tokens de
 *  raciocínio consomem o mesmo teto, então o default por esforço não
 *  basta. O timeout fica abaixo do orçamento da action; a cadeia de
 *  fallbacks e a reserva dividem o mesmo deadline. */
const MAX_TOKENS_CRONOGRAMA = 16_000;
const TIMEOUT_CRONOGRAMA_MS = 45_000;

type ResultadoIa =
  | { ok: true; rascunho: RascunhoImportacao }
  | { ok: false; erro: string; motivo: "limite" | "falha" };

/** Processamento por IA do documento extraído: reserva de rate limit no
 *  canal `importacao`, chamada no tier `forte` da config viva e auditoria
 *  — o mesmo molde do `enriquecerPrevComIa` do import de registros. */
async function rodarIaCronograma(
  supabase: Supa,
  extraido: Extraido,
  ext: string
): Promise<ResultadoIa> {
  const lote = crypto.randomUUID();
  const chars = textoDoExtraido(extraido).length;
  const lim = await consumirLimiteIa(
    supabase,
    { lote, formato: ext || "arquivo", chars },
    "importacao"
  );
  if (!lim.permitido)
    return {
      ok: false,
      erro: "O uso da IA atingiu o limite agora. Tente de novo em instantes.",
      motivo: "limite",
    };

  const iaCfg = await getIaConfig(supabase);
  const t0 = Date.now();
  const r = await normalizarComIa(extraido, (msgs, tools, toolChoice) =>
    chamarModelo(msgs, lote, {
      modelo: modeloDoTier(iaCfg, TIER_IMPORT),
      esforco: esforcoDoTier(iaCfg, TIER_IMPORT),
      fallbacks: fallbacksDoTier(iaCfg, TIER_IMPORT),
      tools,
      toolChoice,
      timeoutMs: TIMEOUT_CRONOGRAMA_MS,
      maxTokens: MAX_TOKENS_CRONOGRAMA,
    })
  );
  await registrarEventosImportacao(supabase, [
    {
      canal: "importacao",
      tool: "entregar_cronograma",
      args: {
        lote,
        formato: ext || "arquivo",
        paginas:
          extraido.formato === "texto" ? (extraido.paginas ?? null) : null,
        linhas:
          extraido.formato === "tabela" ? extraido.linhas.length : null,
        chars,
        tier: TIER_IMPORT,
        truncado: (r.ok && r.truncado) || undefined,
      },
      ok: r.ok,
      erro: r.ok ? null : r.erro,
      duracao_ms: Date.now() - t0,
      modelo: r.ok ? (r.modelo ?? null) : null,
      tier: TIER_IMPORT,
      tokens_in: r.ok ? (r.tokensIn ?? null) : null,
      tokens_out: r.ok ? (r.tokensOut ?? null) : null,
      request_id: lim.requestId,
    },
  ]);
  return r.ok
    ? { ok: true, rascunho: r.rascunho }
    : { ok: false, erro: r.erro, motivo: "falha" };
}

export type ResultadoImportacao = {
  rascunho: RascunhoImportacao;
  /** o rascunho do parser quando a IA respondeu — a resposta divergente
   *  coexiste como rascunho distinto e a pessoa escolhe qual revisar. */
  rascunhoAlternativo: RascunhoImportacao | null;
  /** provider configurado — a UI só oferece "Tentar com IA" se true. */
  iaDisponivel: boolean;
};

export async function importarCronogramaRascunho(
  formData: FormData
): Promise<{ ok: true; resultado: ResultadoImportacao } | { error: string }> {
  const g = await gate();
  if ("error" in g) return g;

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Envie o arquivo do cronograma." };

  const ext = await extrairConteudo(file);
  if (!ext.ok) return { error: ext.erro };

  const extraido = ext.extraido;
  const rascunho = normalizarCronograma(extraido);
  if (conteudoQuaseVazio(extraido))
    rascunho.avisos.push(
      "Pouco texto legível no arquivo. Se o PDF for escaneado (imagem), converta pra texto antes de importar."
    );

  const iaDisponivel = providerConfigurado();
  // auto-disparo: complexo vai ao forte sem clique; simples resolve no
  // determinístico e a IA fica a pedido (botão) — cenários 1 e 2 da US1
  if (
    iaDisponivel &&
    !(await demoAtivo()) &&
    documentoComplexo(extraido, rascunho.confianca)
  ) {
    const r = await rodarIaCronograma(
      g.supabase,
      extraido,
      extensaoDoArquivo(file.name)
    );
    if (r.ok)
      return {
        ok: true,
        resultado: {
          rascunho: r.rascunho,
          rascunhoAlternativo: rascunho,
          iaDisponivel: true,
        },
      };
    rascunho.avisos.push(
      r.motivo === "limite"
        ? "O uso da IA atingiu o limite agora. Revise a leitura automática ou reprocesse em instantes."
        : "O processamento por IA ficou indisponível. Revise a leitura automática ou tente reprocessar."
    );
  }
  return {
    ok: true,
    resultado: { rascunho, rascunhoAlternativo: null, iaDisponivel },
  };
}

/** Camada 3 a pedido: reprocessa o MESMO arquivo com a IA. O cliente manda
 *  o arquivo de novo (não há storage — a reextração é barata e garante que
 *  a IA leia exatamente o que a camada 1 leu). */
export async function importarCronogramaComIa(
  formData: FormData
): Promise<{ ok: true; resultado: ResultadoImportacao } | { error: string }> {
  const g = await gate();
  if ("error" in g) return g;
  if (await demoAtivo())
    return { error: "No modo demonstração a IA não processa arquivos." };
  if (!providerConfigurado())
    return { error: "A IA não está configurada neste ambiente." };

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Envie o arquivo do cronograma." };

  const ext = await extrairConteudo(file);
  if (!ext.ok) return { error: ext.erro };
  // escaneado não vai ao modelo nem a pedido — é o mesmo veto do
  // auto-disparo, com mensagem honesta em vez de chamada vazia
  if (conteudoQuaseVazio(ext.extraido))
    return {
      error:
        "O arquivo tem pouco texto legível. Se o PDF for escaneado (imagem), converta pra texto e tente de novo.",
    };

  const r = await rodarIaCronograma(
    g.supabase,
    ext.extraido,
    extensaoDoArquivo(file.name)
  );
  if (!r.ok) return { error: r.erro };
  return {
    ok: true,
    resultado: {
      rascunho: r.rascunho,
      rascunhoAlternativo: normalizarCronograma(ext.extraido),
      iaDisponivel: true,
    },
  };
}
