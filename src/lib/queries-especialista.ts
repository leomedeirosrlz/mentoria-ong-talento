import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { semanaBounds, toDateStr } from "./ciclo";
import { demoRole } from "./demo/mode";
import {
  demoDevolutivas,
  demoEspecialistas,
  demoMinhaGrade,
  demoMinhasExcecoes,
  demoPropostas,
  demoSlotsLivres,
  demoSolicitacoesDaDupla,
  demoSolicitacoesVisiveis,
  demoTrilhasDosJovens,
} from "./demo/queries";
import { demoTrilhaFechamento } from "./demo/encerramento-data";
import { demoAvaliacaoEspDaDupla } from "./demo/forms-data";
import { getMe } from "./queries";
import type {
  Devolutiva,
  ExcecaoEspecialista,
  GradeJanela,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
  TrilhaJovem,
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
    solicitante:
      norm(row.solicitante) ??
      // o embed do criador volta null quando o leitor não alcança o profile
      // dele (profiles_select, 0076) — pedido do jovem resolve pelo
      // mentorado_nome achatado da view; pedido de staff não tem nome plano
      // e a UI cai no fallback honesto
      (row.origem === "jovem" &&
      typeof mentorado_nome === "string" &&
      mentorado_nome
        ? { nome: mentorado_nome }
        : null),
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
 *  "direcionar a um especialista específico" do dialog de solicitação.
 *  0087: o papel é relação — o !inner em profile_papeis pega também o
 *  híbrido cujo primário é mentor_dpp. */
export const getEspecialistas = cache(
  async (): Promise<{ id: string; nome: string; areas: string[] | null }[]> => {
    const demo = await demoRole();
    if (demo) return demoEspecialistas();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, areas, profile_papeis!inner(papel)")
      .eq("profile_papeis.papel", "mentor_especialista")
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("getEspecialistas:", error);
      return [];
    }
    // o !inner devolve o profile UMA vez por linha de papel — o papel em
    // 2 escopos listaria o mesmo nome duas vezes no select; dedupe por id.
    // O embed não volta pro client: a linha dedupada carrega só os 3 campos
    const unicos = new Map<
      string,
      { id: string; nome: string; areas: string[] | null }
    >();
    for (const p of (data ?? []) as {
      id: string;
      nome: string;
      areas: string[] | null;
    }[]) {
      if (!unicos.has(p.id)) {
        unicos.set(p.id, { id: p.id, nome: p.nome, areas: p.areas });
      }
    }
    // a collation do banco ordena acentos depois de Z — pt-BR no app
    return [...unicos.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
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

/** Exceções datadas do especialista logado — a partir da SEGUNDA da semana
 *  corrente (não de hoje): a grade visual desenha seg→dom inteira, e um
 *  bloqueio/extra de segunda continua visível quando hoje é quarta. Semanas
 *  anteriores ficam fora — exceção velha não muda a projeção e a lista
 *  ficaria infinita. */
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
      .gte("data", semanaBounds(new Date()).seg)
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

/** Feed de devolutivas de uma dupla (0086) — a policy lê pro autor, pra
 *  coordenação e pro jovem dono da trilha; a ficha da dupla esp monta com
 *  o embed do autor (staff lê profiles). */
export const getDevolutivasDupla = cache(
  async (duplaId: string): Promise<Devolutiva[]> => {
    const demo = await demoRole();
    if (demo) return demoDevolutivas(demo, [duplaId]);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("devolutivas")
      .select("id, dupla_id, autor_id, texto, created_at, autor:profiles(nome)")
      .eq("dupla_id", duplaId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("getDevolutivasDupla:", error);
      return [];
    }
    return (data ?? []).map((d) => ({
      ...(d as Omit<typeof d, "autor">),
      autor: Array.isArray(d.autor) ? (d.autor[0] ?? null) : d.autor,
    })) as Devolutiva[];
  }
);

/** Trilhas de especialista do mentorado de uma dupla DPP — RPC definer
 *  `trilha_do_jovem` (0092): a RLS exclui o DPP de duplas/encontros/registros
 *  da trilha esp, então a projeção completa sai pelo definer validando
 *  mentor/supervisor da dupla DPP ou coordenação. Retorna {} por dupla sem
 *  trilha (e degrada pra vazio com log, seguindo os loaders da ficha). */
export const getTrilhasDosJovens = cache(
  async (duplaDppIds: string[]): Promise<Record<string, TrilhaJovem[]>> => {
    if (duplaDppIds.length === 0) return {};
    const demo = await demoRole();
    if (demo) return demoTrilhasDosJovens(demo, duplaDppIds);
    const supabase = await createClient();
    const pares = await Promise.all(
      duplaDppIds.map(async (id) => {
        const { data, error } = await supabase.rpc("trilha_do_jovem", {
          p_dupla_dpp_id: id,
        });
        if (error) {
          console.error("getTrilhasDosJovens:", error);
          return [id, []] as const;
        }
        return [id, (data ?? []) as unknown as TrilhaJovem[]] as const;
      })
    );
    return Object.fromEntries(pares);
  }
);

export type AvaliacaoEspDupla = {
  respondido: boolean;
  respondido_em: string | null;
  /** vem só quando o caller é o especialista da trilha (o respondente) —
   *  a coord recebe o estado e opera o link por /formularios/[id]. */
  token?: string | null;
};

/** Estado do link da avaliação geral da trilha esp (0104) — a RPC definer
 *  atravessa o RLS coord-only de formulario_links só até onde o papel vai:
 *  especialista da dupla ganha o token de volta (caminho quando a
 *  notificação se perdeu), coord ganha o status. */
export const getAvaliacaoEspDaDupla = cache(
  async (duplaId: string): Promise<AvaliacaoEspDupla | null> => {
    const demo = await demoRole();
    if (demo) return demoAvaliacaoEspDaDupla(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("avaliacao_esp_da_dupla", {
      p_dupla: duplaId,
    });
    if (error) {
      console.error("getAvaliacaoEspDaDupla:", error);
      return null;
    }
    return data as AvaliacaoEspDupla | null;
  }
);
