import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoRole } from "./demo/mode";
import {
  demoAvaliacaoLinkMeta,
  demoAvaliacaoLinks,
  demoAvaliacaoPorToken,
  demoEspecialistaAvaliacoes,
  demoJovemAvaliacoes,
  demoMediaDpp,
} from "./demo/queries";
import type {
  AvaliacaoEncontro,
  AvaliacaoLink,
  EspecialistaAvaliacao,
} from "./types";

// Leituras da avaliação estrela do jovem (REALIZA-109 / D4, migration 0071).
// As fronteiras de privacidade moram no banco e esta camada só projeta:
//   · token público → RPC avaliacao_por_token (anon não tem grant de tabela)
//   · jovem logado → as próprias linhas (RLS: branch exists(jovem_duplas))
//   · coord/sup → a mesma tabela escopada às duplas do papel
//   · mentor DPP → agregado quantizado pela RPC avaliacao_media_dpp
//   · especialista → view definer especialista_avaliacoes (só estrelas)
// Nada aqui faz select("*") onde o banco expõe colunas restritas de propósito.

// ---------- página pública /avaliar/<token> ----------

/** O que avaliacao_por_token devolve (0071) — contexto do encontro sem
 *  vazar nada além: nem encontro_id (a RPC não o expõe; ver
 *  linkAvaliacaoMeta), nem nome completo do mentor (só o 1º nome). */
export type AvaliacaoTokenInfo = {
  status: "pendente" | "respondido" | "expirado";
  /** híbrido (0070): 'outra_pessoa' = sessão autenticada que não é a do
   *  destinatário do link; a RPC devolve só status+alvo nesse caso. */
  identidade: "anon" | "ok" | "outra_pessoa";
  /** a avaliação já existe mesmo com link pendente (respondeu logado) —
   *  a página trata como "já respondida". */
  respondida?: boolean;
  encontro?: {
    numero: number;
    data_hora: string | null;
    realizado_em: string | null;
  };
  mentor?: { nome: string };
  alvo: { jovem_nome: string };
};

/** Mesma dicotomia do formularioPorToken: "nao_encontrado" (link inexistente
 *  — a RPC devolveu null) e "erro" (falha de rede/RPC) são estados
 *  diferentes na tela: um é terminal, o outro pede retry. */
export type AvaliacaoTokenResult =
  | { kind: "ok"; info: AvaliacaoTokenInfo }
  | { kind: "nao_encontrado" }
  | { kind: "erro" };

/** Contexto do link de avaliação pra página pública — RPC security definer,
 *  executável por anon e authenticated (o token na URL é o fator de posse).
 *  cache(): generateMetadata e a página dividem a mesma chamada. */
export const avaliacaoPorToken = cache(
  async (token: string): Promise<AvaliacaoTokenResult> => {
    const demo = await demoRole();
    if (demo) {
      const info = demoAvaliacaoPorToken(token);
      return info ? { kind: "ok", info } : { kind: "nao_encontrado" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("avaliacao_por_token", {
      p_token: token,
    });
    if (error) {
      console.error("avaliacaoPorToken:", error);
      return { kind: "erro" };
    }
    if (!data) return { kind: "nao_encontrado" };
    return { kind: "ok", info: data as AvaliacaoTokenInfo };
  }
);

/** Metadados do link que a RPC não devolve — leitura service role, escopo
 *  mínimo e só no servidor (o JWT do usuário não alcança avaliacao_links:
 *  a policy é coord-only, e o jovem anon não tem grant de tabela).
 *  Dois usos legítimos: (a) a submit RPC exige p_encontro_id casado ao
 *  token, mas avaliacao_por_token não o retorna — a ligação token↔encontro
 *  é validada de novo dentro do banco, então ler aqui não é confiar no
 *  client; (b) a trilha decide se o toggle "mentor pode ler" aparece no
 *  form (na especialista o mentor nunca lê a linha — toggle inerte seria
 *  copy desonesta). Nunca importar este módulo em componente client. */
export const linkAvaliacaoMeta = cache(
  async (
    token: string
  ): Promise<{ encontro_id: string; dupla_id: string; trilha: string } | null> => {
    const demo = await demoRole();
    if (demo) return demoAvaliacaoLinkMeta(token);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("avaliacao_links")
      .select("encontro_id, dupla_id, dupla:duplas(trilha)")
      .eq("token", token)
      .maybeSingle();
    if (error) {
      console.error("linkAvaliacaoMeta:", error);
      return null;
    }
    if (!data) return null;
    const d = data as {
      encontro_id: string;
      dupla_id: string;
      dupla: { trilha: string } | { trilha: string }[] | null;
    };
    const dupla = Array.isArray(d.dupla) ? (d.dupla[0] ?? null) : d.dupla;
    return { encontro_id: d.encontro_id, dupla_id: d.dupla_id, trilha: dupla?.trilha ?? "dpp" };
  }
);

// ---------- jovem logado (/jovem) ----------

/** Avaliação do jovem com o mínimo do encontro pra rotular a linha
 *  ("Encontro 4 · em dd/mm") — o embed respeita a mesma RLS das duas
 *  tabelas: a dele chega por exists(jovem_duplas) nas duas. */
export type JovemAvaliacao = AvaliacaoEncontro & {
  encontro: { numero: number; realizado_em: string | null } | null;
};

const JOVEM_AVALIACAO_COLS = `
  id, dupla_id, encontro_id, estrelas, sentimento, avancei, temas,
  comentario, pedir_apoio, avaliacao_visivel_mentor,
  respondido_por_profile_id, created_at,
  encontro:encontros(numero, realizado_em)
`;

/** As avaliações que o jovem já enviou — a policy avaliacoes_select
 *  (branch mentorado → exists jovem_duplas) escopa às duplas dele; o
 *  histórico (dupla concluída) também vem. */
export const getJovemAvaliacoes = cache(
  async (): Promise<JovemAvaliacao[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemAvaliacoes(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("avaliacoes_encontro")
      .select(JOVEM_AVALIACAO_COLS)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getJovemAvaliacoes:", error);
      return [];
    }
    return (data ?? []) as unknown as JovemAvaliacao[];
  }
);

// ---------- coordenação/supervisão ----------

/** Links tokenizados da dupla (0071: policy coord-only). Serve pra ficha da
 *  dupla oferecer "copiar link" / encaminhar por WhatsApp ao jovem sem
 *  login — o canal que o trigger minta a cada encontro realizado. */
export const getAvaliacaoLinks = cache(
  async (duplaId: string): Promise<AvaliacaoLink[]> => {
    const demo = await demoRole();
    if (demo) return demoAvaliacaoLinks(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("avaliacao_links")
      .select("id, token, encontro_id, dupla_id, status, expira_em, respondido_em, respondido_por_profile_id, created_at")
      .eq("dupla_id", duplaId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("getAvaliacaoLinks:", error);
      return [];
    }
    return (data ?? []) as AvaliacaoLink[];
  }
);

/** Média quantizada do DPP (0071): liberada em lotes de ≥3 avaliações pra
 *  fechar o ataque por diferença. A RPC valida "sou o mentor daquela dupla
 *  DPP" e levanta 'dupla não encontrada' pra qualquer outro papel — por
 *  isso a página só chama quando souMentor && trilha dpp. */
export type AvaliacaoMediaDpp = {
  n: number;
  liberado: boolean;
  /** quantizada no 0,5 mais próximo — ex.: 4.5 */
  media?: number;
  /** snapshot: quantas avaliações entraram na média liberada (k = n/3*3) */
  base?: number;
};

export const getAvaliacaoMediaDpp = cache(
  async (duplaId: string): Promise<AvaliacaoMediaDpp | null> => {
    const demo = await demoRole();
    if (demo) return demoMediaDpp(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("avaliacao_media_dpp", {
      p_dupla_id: duplaId,
    });
    if (error) {
      console.error("getAvaliacaoMediaDpp:", error);
      return null;
    }
    return data as AvaliacaoMediaDpp | null;
  }
);

/** Estrelas das sessões do especialista — a view definer (0071) projeta SÓ
 *  id/encontro/estrelas: com 1 avaliador, qualquer campo a mais identifica
 *  o jovem e abre retaliação. A view retorna [] fora do papel, então a
 *  página só chama quando souMentor && trilha especialista. */
export const getEspecialistaAvaliacoes = cache(
  async (duplaId: string): Promise<EspecialistaAvaliacao[]> => {
    const demo = await demoRole();
    if (demo) return demoEspecialistaAvaliacoes(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("especialista_avaliacoes")
      .select("id, dupla_id, encontro_id, estrelas, numero, realizado_em, created_at")
      .eq("dupla_id", duplaId)
      .order("numero", { ascending: true });
    if (error) {
      console.error("getEspecialistaAvaliacoes:", error);
      return [];
    }
    return (data ?? []) as EspecialistaAvaliacao[];
  }
);
