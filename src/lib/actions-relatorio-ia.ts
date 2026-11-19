"use server";

// "Perguntar à Liza" nos relatórios operacionais (REALIZA-456 / US5): gera,
// deduplica e persiste o card da aba em relatorio_ia_cards. O prompt leva
// só os agregados refeitos no servidor (contexto-servidor.ts) — texto
// livre de pessoa nunca entra. O banco é a fronteira: RLS coord no select
// e RPC definer na escrita.

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries";
import { temPapel } from "@/lib/types";
import { demoAtivo } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import {
  chamarModelo,
  providerConfigurado,
  type UsoIa,
} from "@/lib/ia/provider";
import {
  esforcoDoTier,
  fallbacksDoTier,
  getIaConfig,
  modeloDoTier,
} from "@/lib/ia/config";
import { consumirLimiteIa } from "@/lib/ia/rate-limit";
import type { EventoIa } from "@/lib/ia/tools";
import {
  ABAS_LIZA,
  ABA_LIZA_ROTULO,
  PERGUNTA_PADRAO,
  PROMPT_RELATORIO_V,
  promptLiza,
  recorteDescricao,
  recorteKey,
  recorteTexto,
  type AbaLiza,
  type RecorteLiza,
} from "@/lib/relatorios/contexto";
import { contextoDaSecao } from "@/lib/relatorios/contexto-servidor";
import { RESPOSTA_LIZA_DEMO } from "@/lib/demo/relatorio-liza";
import type { Json } from "@/lib/database.types";

export type CardLiza = {
  id: string;
  secao: string;
  recorte: Json;
  recorte_key: string;
  contexto_hash: string;
  pergunta: string;
  resposta_md: string;
  modelo: string | null;
  tier: string | null;
  request_id: string | null;
  gerado_por: string;
  gerado_em: string;
  superseded_by: string | null;
};

export type ResultadoPerguntar =
  | { ok: true; card: CardLiza }
  | { ok: false; erro: string };

const PERGUNTA_MAX = 500;

/** Busca a row vigente da aba+recorte — a página usa pra montar o card e o
 *  badge "desatualizado"; a action usa pra deduplicar antes de gerar. */
export async function cardVigenteDaAba(
  aba: AbaLiza,
  recorte: RecorteLiza
): Promise<CardLiza | null> {
  if (await demoAtivo()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("relatorio_ia_cards")
    .select("*")
    .eq("secao", aba)
    .eq("recorte_key", recorteKey(recorte))
    .is("superseded_by", null)
    .maybeSingle();
  if (error) {
    console.error("cardVigenteDaAba:", error);
    return null;
  }
  return data as CardLiza | null;
}

export async function perguntarLizaRelatorio(input: {
  aba: AbaLiza;
  recorte?: Partial<Omit<RecorteLiza, "aba">>;
  pergunta?: string;
  /** regeneração explícita: ignora a dedup por contexto+pergunta (o banco
   *  ainda deduplica — o card novo só nasce se contexto ou pergunta
   *  mudaram, ou a dedup devolve a vigente). */
  forcar?: boolean;
}): Promise<ResultadoPerguntar> {
  try {
    if (!ABAS_LIZA.includes(input.aba)) {
      return { ok: false, erro: "Seção de relatório desconhecida." };
    }
    const recorte: RecorteLiza = { aba: input.aba, ...input.recorte };
    const pergunta =
      input.pergunta?.trim().slice(0, PERGUNTA_MAX) || PERGUNTA_PADRAO;
    const key = recorteKey(recorte);

    // ---------- demo: resposta enlatada, sem provider e sem persistência ----------
    if (await demoAtivo()) {
      const { contexto, hash } = await contextoDaSecao(input.aba, recorte, {
        supabase: null,
        demo: getDemoData(),
      });
      void contexto;
      return {
        ok: true,
        card: {
          id: `demo-${key}`,
          secao: input.aba,
          recorte: recorteDescricao(recorte) as Json,
          recorte_key: key,
          contexto_hash: hash,
          pergunta,
          resposta_md: RESPOSTA_LIZA_DEMO[input.aba],
          modelo: "demo",
          tier: null,
          request_id: null,
          gerado_por: "demo",
          gerado_em: new Date().toISOString(),
          superseded_by: null,
        },
      };
    }

    // ---------- gates ----------
    const me = await getMe();
    if (!me || !temPapel(me, "coordenacao")) {
      return {
        ok: false,
        erro: "Apenas a coordenação pode perguntar à Liza nos relatórios.",
      };
    }
    if (!providerConfigurado()) {
      return { ok: false, erro: "A Liza não está configurada neste ambiente." };
    }

    const supabase = await createClient();
    const { contexto, hash } = await contextoDaSecao(input.aba, recorte, {
      supabase,
      demo: null,
    });

    // dedup barato: vigente de mesmo contexto e mesma pergunta → devolve
    // sem queimar chamada de modelo (SC-006: mesma pergunta/contexto custa zero)
    if (!input.forcar) {
      const vigente = await cardVigenteDaAba(input.aba, recorte);
      if (
        vigente &&
        vigente.contexto_hash === hash &&
        vigente.pergunta === pergunta
      ) {
        return { ok: true, card: vigente };
      }
    }

    // ---------- limite (canal 'relatorio', fail-closed) ----------
    const limite = await consumirLimiteIa(
      supabase,
      { secao: input.aba, recorte_key: key },
      "relatorio"
    );
    if (!limite.permitido) {
      return {
        ok: false,
        erro:
          "Limite de uso da Liza atingido. Aguarde um instante e tente de novo.",
      };
    }

    // ---------- geração (tier forte + fallback da cadeia) ----------
    const cfg = await getIaConfig(supabase);
    const t0 = Date.now();
    const res = await chamarModelo(
      promptLiza({
        secao: ABA_LIZA_ROTULO[input.aba],
        recorte: recorteTexto(recorte),
        contexto,
        pergunta,
      }),
      undefined,
      {
        modelo: modeloDoTier(cfg, "forte"),
        esforco: esforcoDoTier(cfg, "forte"),
        fallbacks: fallbacksDoTier(cfg, "forte"),
        timeoutMs: 60_000,
      }
    );
    if (!res.ok || !res.mensagem.content?.trim()) {
      return { ok: false, erro: res.ok ? "A resposta veio vazia. Tente de novo." : res.erro };
    }
    const respostaMd = res.mensagem.content.trim().slice(0, 8000);
    const uso: UsoIa | undefined = res.usage;

    // ---------- persistência (dedup+supersede atômicos na RPC) ----------
    const { data: card, error: erroCard } = await supabase
      .rpc("relatorio_ia_card_registrar", {
        p_secao: input.aba,
        p_recorte: recorteDescricao(recorte) as Json,
        p_recorte_key: key,
        p_contexto_hash: hash,
        p_pergunta: pergunta,
        p_resposta_md: respostaMd,
        p_modelo: res.modelo ?? null,
        p_tier: "forte",
        p_request_id: limite.requestId,
      })
      .single();
    if (erroCard || !card) {
      console.error("relatorio_ia_card_registrar:", erroCard);
      Sentry.captureException(erroCard ?? new Error("card vazio"), {
        extra: { aba: input.aba, recorte_key: key },
      });
      return {
        ok: false,
        erro: "A resposta foi gerada mas não consegui gravar o card. Tente de novo.",
      };
    }

    // ---------- evento de custo/auditoria no canal 'relatorio' ----------
    const evento: EventoIa = {
      canal: "relatorio",
      tool: "resposta",
      args: {
        secao: input.aba,
        recorte_key: key,
        prompt_v: PROMPT_RELATORIO_V,
        truncado: res.truncado || undefined,
      },
      ok: true,
      duracao_ms: Date.now() - t0,
      modelo: res.modelo ?? null,
      tier: "forte",
      tokens_in:
        uso?.prompt_tokens ?? uso?.opencode?.tokens?.input ?? null,
      tokens_out:
        uso?.completion_tokens ?? uso?.opencode?.tokens?.output ?? null,
      tokens_reasoning: uso?.opencode?.tokens?.reasoning ?? null,
      cache_read: uso?.opencode?.tokens?.cache_read ?? null,
      custo_usd: uso?.cost ?? null,
      allowance_usd: uso?.opencode?.allowance ?? null,
      billing_source: uso?.opencode?.billing_source ?? null,
      request_id: limite.requestId,
    };
    try {
      const { error: erroLote } = await supabase.rpc(
        "registrar_ia_eventos_lote",
        { p_eventos: [evento] }
      );
      if (erroLote) console.error("registrar_ia_eventos_lote:", erroLote);
    } catch (e) {
      console.error("registrar_ia_eventos_lote:", e);
    }

    revalidatePath("/relatorios/operacionais");
    return { ok: true, card: card as CardLiza };
  } catch (e) {
    console.error("perguntarLizaRelatorio:", e);
    Sentry.captureException(e);
    return {
      ok: false,
      erro: "Não consegui gerar a resposta agora. Tente de novo em instantes.",
    };
  }
}
