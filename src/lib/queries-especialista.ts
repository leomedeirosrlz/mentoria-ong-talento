import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoEspecialistas,
  demoSolicitacoesDaDupla,
  demoSolicitacoesVisiveis,
} from "./demo/queries";
import { demoTrilhaFechamento } from "./demo/encerramento-data";
import type { SolicitacaoEspecialista } from "./types";

/** A leitura é da view `solicitacoes_mural` (0030): as mesmas colunas da
 *  tabela + `mentorado_nome` — o nome do jovem vem escopado por papel na
 *  view (só o nome; um embed de mentorados voltaria null pra quem a RLS de
 *  mentorados não alcança, ex.: o especialista no mural).
 *  Só `nome` nos embeds de profiles — as demais colunas públicas não fazem
 *  falta aqui e email/whatsapp/documento_path dariam permission denied (0026). */
const SOLICITACAO_SELECT = `
  id, mentorado_id, dupla_dpp_id, demanda,
  especialista_desejado_id, especialista_id, dupla_id,
  status, created_by, created_at, respondida_em, mentorado_nome,
  devolutiva_pdm, trilha_encerrada_em,
  solicitante:profiles!solicitacoes_especialista_created_by_fkey(nome),
  especialista:profiles!solicitacoes_especialista_especialista_id_fkey(nome)
`;

/** Embed to-one pode voltar como array no tipo do supabase-js. */
function norm(v: unknown): { nome: string } | null {
  const o = Array.isArray(v) ? v[0] : v;
  return (o as { nome: string } | null) ?? null;
}

function normalize(row: Record<string, unknown>): SolicitacaoEspecialista {
  // mentorado_nome é coluna plana da view — a UI consome `mentorado.nome`
  const { mentorado_nome, ...rest } = row;
  return {
    ...(rest as unknown as SolicitacaoEspecialista),
    mentorado:
      typeof mentorado_nome === "string" && mentorado_nome
        ? { nome: mentorado_nome }
        : null,
    solicitante: norm(row.solicitante),
    especialista: norm(row.especialista),
  };
}

/** Todas as solicitações da dupla DPP, mais recentes primeiro — um jovem pode
 *  passar por várias trilhas de especialista no ciclo, e cada fechamento
 *  devolve uma devolutiva pro PDM. O chip do header usa a primeira; a seção
 *  de devolutivas lista todas. */
export const getSolicitacoesDaDupla = cache(
  async (duplaDppId: string): Promise<SolicitacaoEspecialista[]> => {
    // modo demo: a dupla precisa estar no escopo do papel (sol_select, 0027)
    const demo = await demoRole();
    if (demo) {
      // a devolutiva do encerramento da trilha mora num dataset à parte
      // (0037 — encerramento-data.ts), mergeada aqui como a view faria
      return demoSolicitacoesDaDupla(demo, duplaDppId).map((s) => {
        const f = demoTrilhaFechamento(s.id);
        return f ? { ...s, ...f } : s;
      });
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacoes_mural")
      .select(SOLICITACAO_SELECT)
      .eq("dupla_dpp_id", duplaDppId)
      .order("created_at", { ascending: false });
    // complemento da ficha — falha degrada pra vazio, com log
    if (error) {
      console.error("getSolicitacoesDaDupla:", error);
      return [];
    }
    return (data ?? []).map((r) => normalize(r));
  }
);

/** Última solicitação da dupla DPP (qualquer status) — alimenta o chip do
 *  header da ficha. Cancelada também volta: o chip decide não renderizar, mas
 *  o caller pode usar a informação (ex.: esconder o botão de solicitar). */
export const getSolicitacaoDaDupla = cache(
  async (duplaDppId: string): Promise<SolicitacaoEspecialista | null> => {
    return (await getSolicitacoesDaDupla(duplaDppId))[0] ?? null;
  }
);

/** O que o papel atual pode ver — a RLS faz o escopo (coord → tudo;
 *  especialista → abertas + as que aceitou; mentor/supervisor → das suas
 *  duplas). Ordenação: abertas primeiro (a ordem alfabética do status já dá
 *  aberta → aceita → cancelada), mais recentes antes dentro de cada grupo. */
export const getSolicitacoesVisiveis = cache(
  async (): Promise<SolicitacaoEspecialista[]> => {
    const demo = await demoRole();
    if (demo) return demoSolicitacoesVisiveis(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacoes_mural")
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

/** Especialistas ativos (id + nome + áreas de atuação, 0030) — pro select
 *  "direcionar a um especialista específico" do dialog de solicitação. */
export const getEspecialistas = cache(
  async (): Promise<{ id: string; nome: string; areas: string[] | null }[]> => {
    const demo = await demoRole();
    if (demo) return demoEspecialistas();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, areas")
      .eq("role", "mentor_especialista")
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("getEspecialistas:", error);
      return [];
    }
    // a collation do banco ordena acentos depois de Z — pt-BR no app
    return (
      (data ?? []) as { id: string; nome: string; areas: string[] | null }[]
    ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
);
