import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getJovemDuplas } from "../queries-jovem";
import { demoRole } from "../demo/mode";
import {
  demoTerceirosDaDupla,
  demoTerceiroPorToken,
  demoConsolidadoTerceirosJovem,
} from "../demo/terceiros-data";

// Leituras da avaliação por terceiros (0103 — guia DPP semana 1→2).
//
// Escopo é o da RLS: contatos + respostas só pra mentor da dupla, supervisor
// e coordenação — o jovem NUNCA vê nome de quem respondeu; ele só lê a
// consolidação curada depois de publicada (terceiros_consolidacao com
// publicado_em marcado).
//
// A leitura pública do /t/<token> sai pela RPC security definer
// terceiro_por_token — anon não tem grant de tabela (molde /f, /assinar).

export type TerceiroVinculo = "amigo" | "familiar" | "colega" | "outro";
export type TerceiroStatus = "pendente" | "respondido" | "expirado";

export type TerceiroResposta = {
  id: string;
  contato_id: string;
  pontos_fortes: string;
  a_melhorar: string;
  respondido_em: string;
};

export type TerceiroContato = {
  id: string;
  dupla_id: string;
  nome: string;
  vinculo: TerceiroVinculo;
  whatsapp: string | null;
  token: string;
  expira_em: string;
  status: TerceiroStatus;
  respondido_em: string | null;
  created_at: string;
  resposta?: TerceiroResposta | null;
};

export type TerceiroConsolidacao = {
  dupla_id: string;
  consolidado: string | null;
  publicado_em: string | null;
  escrito_por: string | null;
  updated_at: string;
};

export type TerceirosDaDupla = {
  contatos: TerceiroContato[];
  consolidacao: TerceiroConsolidacao | null;
};

/** Contatos (com resposta embutida quando respondido) + a consolidação da
 *  dupla. Devolve vazio quando o papel não alcança a dupla (RLS). */
export const getTerceirosDaDupla = cache(
  async (duplaId: string): Promise<TerceirosDaDupla> => {
    if (await demoRole()) return demoTerceirosDaDupla(duplaId);
    const supabase = await createClient();
    const [{ data: contatos, error: eC }, { data: consol, error: eS }] =
      await Promise.all([
        supabase
          .from("terceiros_contatos")
          .select(
            "id, dupla_id, nome, vinculo, whatsapp, token, expira_em, status, respondido_em, created_at, resposta:terceiros_respostas(id, contato_id, pontos_fortes, a_melhorar, respondido_em)"
          )
          .eq("dupla_id", duplaId)
          .order("created_at"),
        supabase
          .from("terceiros_consolidacao")
          .select("dupla_id, consolidado, publicado_em, escrito_por, updated_at")
          .eq("dupla_id", duplaId)
          .maybeSingle(),
      ]);
    if (eC) console.error("getTerceirosDaDupla/contatos:", eC);
    if (eS) console.error("getTerceirosDaDupla/consolidacao:", eS);
    const lista = (contatos ?? []).map((c) => ({
      ...(c as Omit<TerceiroContato, "resposta"> & {
        resposta?: TerceiroResposta[] | TerceiroResposta | null;
      }),
      // unique FK → o embedded vem como array de 1 (postgrest pode devolver
      // objeto ou array conforme a cardinalidade inferida — normalizo)
      resposta: Array.isArray(c.resposta)
        ? (c.resposta[0] ?? null)
        : (c.resposta ?? null),
    })) as TerceiroContato[];
    return {
      contatos: lista,
      consolidacao: (consol as TerceiroConsolidacao | null) ?? null,
    };
  }
);

/** O consolidado publicado da dupla DPP VIVA do jovem logado — a única peça
 *  de terceiros que ele lê (a policy já exige publicado_em e filtra pras
 *  duplas dele via jovem_duplas). A remanejada também pode ter consolidado,
 *  então filtro pela dupla em curso — e o cruzamento é por dupla_id contra
 *  getJovemDuplas, NUNCA embed em `duplas` base (mentorado não tem SELECT
 *  nela — lição 0068/0089). Mesmo critério de `duplaAtual` da home. */
export const getConsolidadoTerceirosJovem = cache(
  async (): Promise<{ consolidado: string; publicado_em: string } | null> => {
    if (await demoRole()) return demoConsolidadoTerceirosJovem();
    const supabase = await createClient();
    // cache()ada — a home chama getJovemDuplas no mesmo render, é 1 ida só
    const duplas = await getJovemDuplas();
    const vivas = new Set(
      duplas
        .filter((d) => d.status === "ativa" || d.status === "pausada")
        .map((d) => d.id)
    );
    if (!vivas.size) return null;
    const { data, error } = await supabase
      .from("terceiros_consolidacao")
      .select("consolidado, publicado_em, dupla_id")
      .not("publicado_em", "is", null)
      .order("publicado_em", { ascending: false });
    if (error) {
      console.error("getConsolidadoTerceirosJovem:", error);
      return null;
    }
    const viva = (data ?? []).find((r) => vivas.has(r.dupla_id));
    if (!viva?.consolidado || !viva.publicado_em) return null;
    return {
      consolidado: viva.consolidado,
      publicado_em: viva.publicado_em,
    };
  }
);

// ---------- público (/t/<token>) ----------

export type TerceiroPublico = {
  status: TerceiroStatus;
  convidado: { nome: string };
  alvo: { jovem_nome: string };
};

export type TerceiroTokenResult =
  | { kind: "ok"; info: TerceiroPublico }
  | { kind: "nao_encontrado" }
  | { kind: "erro" };

/** cache(): generateMetadata e a página dividem a mesma chamada. */
export const terceiroPorToken = cache(
  async (token: string): Promise<TerceiroTokenResult> => {
    if (await demoRole()) {
      const info = demoTerceiroPorToken(token);
      return info ? { kind: "ok", info } : { kind: "nao_encontrado" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("terceiro_por_token", {
      p_token: token,
    });
    if (error) {
      console.error("terceiroPorToken:", error);
      return { kind: "erro" };
    }
    if (!data) return { kind: "nao_encontrado" };
    return { kind: "ok", info: data as TerceiroPublico };
  }
);
