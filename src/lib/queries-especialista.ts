import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { toDateStr } from "./ciclo";
import { demoRole } from "./demo/mode";
import {
  demoEspecialistas,
  demoMinhaGrade,
  demoMinhasExcecoes,
  demoPropostas,
  demoSlotsLivres,
  demoSolicitacoesDaDupla,
  demoSolicitacoesVisiveis,
} from "./demo/queries";
import { demoTrilhaFechamento } from "./demo/encerramento-data";
import { getMe } from "./queries";
import type {
  ExcecaoEspecialista,
  GradeJanela,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "./types";

/** A leitura é da view `solicitacoes_mural` (0030/0074): as mesmas colunas
 *  da tabela + `mentorado_nome`/`especialista_nome`/`status_efetivo` — o nome
 *  do jovem vem escopado por papel na view (só o nome; um embed de mentorados
 *  voltaria null pra quem a RLS de mentorados não alcança, ex.: o
 *  especialista no mural). `status_efetivo` é a leitura com expiração lazy.
 *  Só `nome` nos embeds de profiles — as demais colunas públicas não fazem
 *  falta aqui e email/whatsapp/documento_path dariam permission denied (0026). */
const SOLICITACAO_SELECT = `
  id, mentorado_id, dupla_dpp_id, demanda, motivo,
  especialista_desejado_id, especialista_id, dupla_id,
  status, status_efetivo, slot_proposto, origem, turma,
  justificativa_recusa,
  created_by, created_at, respondida_em, mentorado_nome, especialista_nome,
  devolutiva_pdm, trilha_encerrada_em,
  solicitante:profiles!solicitacoes_especialista_created_by_fkey(nome),
  especialista:profiles!solicitacoes_especialista_especialista_id_fkey(nome),
  desejado:profiles!solicitacoes_especialista_especialista_desejado_id_fkey(nome)
`;

/** Embed to-one pode voltar como array no tipo do supabase-js. */
function norm(v: unknown): { nome: string } | null {
  const o = Array.isArray(v) ? v[0] : v;
  return (o as { nome: string } | null) ?? null;
}

function normalize(row: Record<string, unknown>): SolicitacaoEspecialista {
  // mentorado_nome/especialista_nome são colunas planas da view — a UI
  // consome `mentorado.nome`/`especialista.nome` nos dois caminhos
  const { mentorado_nome, especialista_nome, ...rest } = row;
  return {
    ...(rest as unknown as SolicitacaoEspecialista),
    mentorado:
      typeof mentorado_nome === "string" && mentorado_nome
        ? { nome: mentorado_nome }
        : null,
    solicitante: norm(row.solicitante),
    desejado: norm(row.desejado),
    especialista:
      norm(row.especialista) ??
      (typeof especialista_nome === "string" && especialista_nome
        ? { nome: especialista_nome }
        : null),
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
 *  especialista → em aberto dirigidas/broadcast + as que engajou;
 *  mentor/supervisor → das suas duplas; mentorado → os próprios pedidos).
 *  Ordena por status_efetivo (texto — "aberta" casualmente encabeça o
 *  alfabeto) e, dentro do mesmo estado, pelos mais recentes; a prioridade
 *  de triagem é trabalho dos filtros de cada superfície, não da ordem. */
export const getSolicitacoesVisiveis = cache(
  async (): Promise<SolicitacaoEspecialista[]> => {
    const demo = await demoRole();
    if (demo) return demoSolicitacoesVisiveis(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacoes_mural")
      .select(SOLICITACAO_SELECT)
      .order("status_efetivo", { ascending: true })
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

// ---------- thread de propostas (0074) ----------

const PROPOSTA_SELECT = `
  id, solicitacao_id, autor_id, slot_proposto, mensagem, created_at,
  autor:profiles!solicitacao_propostas_autor_id_fkey(nome)
`;

function normProposta(row: Record<string, unknown>): SolicitacaoProposta {
  return {
    ...(row as unknown as SolicitacaoProposta),
    autor: norm(row.autor),
  };
}

/** Thread completa de uma negociação, cronológica — a policy libera as
 *  partes (autor, especialista engajado/dirigido, coordenação, jovem dono). */
export const getPropostas = cache(
  async (solicitacaoId: string): Promise<SolicitacaoProposta[]> => {
    const demo = await demoRole();
    if (demo) return demoPropostas(demo, solicitacaoId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solicitacao_propostas")
      .select(PROPOSTA_SELECT)
      .eq("solicitacao_id", solicitacaoId)
      .order("created_at");
    if (error) {
      console.error("getPropostas:", error);
      return [];
    }
    return (data ?? []).map((r) => normProposta(r));
  }
);

/** solicitacao_id → thread, numa query só — o mural da home e a ficha
 *  carregam as negociações abertas sem N+1. */
export async function getPropostasMap(
  solicitacaoIds: string[]
): Promise<Record<string, SolicitacaoProposta[]>> {
  if (!solicitacaoIds.length) return {};
  const demo = await demoRole();
  if (demo) {
    return Object.fromEntries(
      solicitacaoIds.map((id) => [id, demoPropostas(demo, id)])
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitacao_propostas")
    .select(PROPOSTA_SELECT)
    .in("solicitacao_id", solicitacaoIds)
    .order("created_at");
  if (error) {
    console.error("getPropostasMap:", error);
    return {};
  }
  const mapa: Record<string, SolicitacaoProposta[]> = {};
  for (const r of data ?? []) {
    const p = normProposta(r);
    (mapa[p.solicitacao_id] ??= []).push(p);
  }
  return mapa;
}

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

// ---------- agenda real do especialista (0073) ----------

/** Grade semanal do especialista logado — a policy da tabela já escopa ao
 *  dono/coord, mas o eq deixa o recorte explícito (a única consumidora é a
 *  própria /agenda; um coord que precisar da grade de outro monta select
 *  próprio, como faz em toda tabela admin-only). */
export const getMinhaGrade = cache(async (): Promise<GradeJanela[]> => {
  const demo = await demoRole();
  if (demo) return demoMinhaGrade(demo);
  const me = await getMe();
  if (!me) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("especialista_grade")
    .select("id, dia_semana, hora_inicio, hora_fim")
    .eq("profile_id", me.id)
    .order("dia_semana")
    .order("hora_inicio");
  if (error) {
    console.error("getMinhaGrade:", error);
    return [];
  }
  return (data ?? []) as GradeJanela[];
});

/** Exceções datadas do especialista logado — só as de hoje em diante: uma
 *  exceção passada não muda mais a projeção e a lista ficaria infinita. */
export const getMinhasExcecoes = cache(
  async (): Promise<ExcecaoEspecialista[]> => {
    const demo = await demoRole();
    if (demo) return demoMinhasExcecoes(demo);
    const me = await getMe();
    if (!me) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("especialista_excecoes")
      .select("id, data, hora_inicio, hora_fim, tipo")
      .eq("profile_id", me.id)
      .gte("data", toDateStr(new Date()))
      .order("data")
      .order("hora_inicio");
    if (error) {
      console.error("getMinhasExcecoes:", error);
      return [];
    }
    return (data ?? []) as ExcecaoEspecialista[];
  }
);

/** Slots de início livres de um especialista — a RPC é definer e aberta a
 *  autenticado (é a oferta pública do catálogo): o especialista pré-visualiza
 *  a própria agenda e o jovem vê a do especialista da dupla ativa dele.
 *  `dias` = horizonte da projeção (a RPC usa [desde, ate] inclusivos). */
export const getSlotsLivres = cache(
  async (profileId: string, dias = 21): Promise<string[]> => {
    const demo = await demoRole();
    if (demo) return demoSlotsLivres(profileId, dias);
    const supabase = await createClient();
    const hoje = new Date();
    const { data, error } = await supabase.rpc("especialista_slots_livres", {
      p_especialista: profileId,
      p_desde: toDateStr(hoje),
      p_ate: toDateStr(new Date(hoje.getTime() + dias * 86400000)),
    });
    if (error) {
      console.error("getSlotsLivres:", error);
      return [];
    }
    return (data ?? []).map((r: { inicio: string }) => r.inicio);
  }
);
