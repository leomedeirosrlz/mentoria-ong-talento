import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SolicitacaoEspecialista } from "./types";

/** Só `nome` nos embeds de profiles — as demais colunas públicas não fazem
 *  falta aqui e email/whatsapp/documento_path dariam permission denied (0026).
 *  O embed `mentorado` volta null pra quem a RLS de mentorados não alcança
 *  (ex.: especialista vendo o mural — a privacidade do jovem vale mais que a
 *  conveniência do nome; a demanda em si é o conteúdo). */
const SOLICITACAO_SELECT = `
  id, mentorado_id, dupla_dpp_id, demanda,
  especialista_desejado_id, especialista_id, dupla_id,
  status, created_by, created_at, respondida_em,
  mentorado:mentorados!mentorado_id(nome),
  solicitante:profiles!solicitacoes_especialista_created_by_fkey(nome),
  especialista:profiles!solicitacoes_especialista_especialista_id_fkey(nome)
`;

/** Embed to-one pode voltar como array no tipo do supabase-js. */
function norm(v: unknown): { nome: string } | null {
  const o = Array.isArray(v) ? v[0] : v;
  return (o as { nome: string } | null) ?? null;
}

function normalize(row: Record<string, unknown>): SolicitacaoEspecialista {
  return {
    ...(row as unknown as SolicitacaoEspecialista),
    mentorado: norm(row.mentorado),
    solicitante: norm(row.solicitante),
    especialista: norm(row.especialista),
  };
}

/** Última solicitação da dupla DPP (qualquer status) — alimenta o chip do
 *  header da ficha. Cancelada também volta: o chip decide não renderizar, mas
 *  o caller pode usar a informação (ex.: esconder o botão de solicitar). */
export const getSolicitacaoDaDupla = cache(
  async (duplaDppId: string): Promise<SolicitacaoEspecialista | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacoes_especialista")
      .select(SOLICITACAO_SELECT)
      .eq("dupla_dpp_id", duplaDppId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // chip é complemento do header — falha degrada pra "sem chip", com log
    if (error) {
      console.error("getSolicitacaoDaDupla:", error);
      return null;
    }
    return data ? normalize(data) : null;
  }
);

/** O que o papel atual pode ver — a RLS faz o escopo (coord → tudo;
 *  especialista → abertas + as que aceitou; mentor/supervisor → das suas
 *  duplas). Ordenação: abertas primeiro (a ordem alfabética do status já dá
 *  aberta → aceita → cancelada), mais recentes antes dentro de cada grupo. */
export const getSolicitacoesVisiveis = cache(
  async (): Promise<SolicitacaoEspecialista[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacoes_especialista")
      .select(SOLICITACAO_SELECT)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    // o mural do especialista e o card da coordenação degradam pra vazio —
    // com log, porque erro silencioso esconde bug
    if (error) {
      console.error("getSolicitacoesVisiveis:", error);
      return [];
    }
    return (data ?? []).map((r) => normalize(r));
  }
);

/** Especialistas ativos (id + nome) — pro select "direcionar a um
 *  especialista específico" do dialog de solicitação. */
export const getEspecialistas = cache(
  async (): Promise<{ id: string; nome: string }[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("role", "mentor_especialista")
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("getEspecialistas:", error);
      return [];
    }
    // a collation do banco ordena acentos depois de Z — pt-BR no app
    return ((data ?? []) as { id: string; nome: string }[]).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }
);
