// Camada de IA — leituras que recebem o client JÁ AUTENTICADO do caller
// (o transporte decide a identidade: o chat interno usa o client da sessão
// de cookies; o MCP externo, quando chegar, injeta o client do JWT validado
// — spec §0/§6 de docs/planos/ia-chatbot-mcp.md). Diferente de
// src/lib/queries.ts, que monta o próprio client a partir dos cookies e só
// funciona dentro do request do app.
//
// Duas fronteiras, no mesmo desenho do app:
//   · a RLS do banco faz o escopo — cada query roda com o JWT do usuário,
//     sem service role e sem re-implementar permissão;
//   · allowlist por construção — os selects pedem só campos estruturados:
//     dados_civis, curriculo_*, contato cru e texto livre de registro
//     (reflexoes/observacoes/detalhes/tema) NÃO passam no select, nem como
//     trânsito. O que a tool devolve nunca pode vazar o que não foi pedido.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppRole,
  AvaliacaoEncontro,
  CicloEvento,
  DuplaStatus,
  Encaminhamento,
  Mentorado,
  MentorProfile,
  Profile,
  Registro,
  Trilha,
} from "@/lib/types";
import type { InstrumentoDupla } from "@/lib/forms/queries";

/** Papéis efetivos do dono do client — a mesma my_papeis() que o getMe usa
 *  (0085): a leitura sai de uma fonte só (o banco), nunca de claim
 *  adivinhada. O gate da tool decide por INTERSEÇÃO — um papel que vive
 *  só como secundário (o híbrido DPP+especialista) também libera a tool.
 *  [] = sem sessão ou profile sem papel — nada passa no gate. */
export const papeisDoUsuario = cache(
  async (supabase: SupabaseClient): Promise<AppRole[]> => {
    const { data, error } = await supabase.rpc("my_papeis");
    if (error) {
      console.error("papeisDoUsuario:", error);
      return [];
    }
    return (data as AppRole[] | null) ?? [];
  }
);

// ---------- semáforo por dupla ----------

/** Projeção com EXATAMENTE os campos que saudadeDaDupla consome
 *  (dupla.status/trilha/cronograma_id/iniciada_em; encontros→numero/status/
 *  datas; registro→precisa_apoio/avaliacao/dificuldade; avaliacao_jovem→
 *  pedir_apoio; encaminhamentos→status/prazo) + os nomes pra montar a
 *  resposta. reflexoes/observacoes/dificuldade_detalhe/proximo_passo_detalhe/
 *  tema ficam fora por construção — se o semáforo passar a ler outro campo,
 *  ampliar aqui junto (o type DuplaIa mostra o que a tool enxerga). */
export const IA_SAUDE_SELECT = `
  id, turma, trilha, status, cronograma_id, iniciada_em, demanda,
  mentor:profiles!duplas_mentor_id_fkey(nome),
  mentorado:mentorados(nome),
  supervisor:profiles!duplas_supervisor_id_fkey(nome),
  encontros(
    numero, status, data_hora, realizado_em,
    registro:registros(precisa_apoio, avaliacao, dificuldade),
    avaliacao_jovem:avaliacoes_encontro(pedir_apoio)
  ),
  encaminhamentos(status, prazo)
`;

/** A dupla como a tool a recebe — projeção mínima e allowlisted (sem as
 *  colunas que a IA não deve trafegar). Passa por cast pra Dupla só na
 *  fronteira do saudadeDaDupla, que lê exatamente estes campos. */
export type DuplaIa = {
  id: string;
  turma: string;
  trilha: Trilha;
  status: DuplaStatus;
  cronograma_id: string | null;
  iniciada_em: string | null;
  demanda: string | null;
  mentor: { nome: string } | null;
  mentorado: { nome: string } | null;
  supervisor: { nome: string } | null;
  encontros: {
    numero: number;
    status: string;
    data_hora: string | null;
    realizado_em: string | null;
    registro: Pick<
      Registro,
      "precisa_apoio" | "avaliacao" | "dificuldade"
    > | null;
    avaliacao_jovem: Pick<AvaliacaoEncontro, "pedir_apoio"> | null;
  }[];
  encaminhamentos: Pick<Encaminhamento, "status" | "prazo">[];
};

/** Duplas vivas (ativa/pausada) no escopo do papel — coord recebe todas,
 *  auxiliar executivo as supervisionadas, mentor as suas (RLS). */
export const getDuplasVivasIa = cache(
  async (supabase: SupabaseClient): Promise<DuplaIa[]> => {
    const { data, error } = await supabase
      .from("duplas")
      .select(IA_SAUDE_SELECT)
      .in("status", ["ativa", "pausada"]);
    if (error) throw error;
    return (data ?? []) as unknown as DuplaIa[];
  }
);

/** Uma dupla por id, no escopo do papel — null quando a RLS não a entrega
 *  (inexistente ou fora do alcance: o "não achei" é honesto, não vaza
 *  existência). */
export const getDuplaIa = cache(
  async (supabase: SupabaseClient, id: string): Promise<DuplaIa | null> => {
    const { data, error } = await supabase
      .from("duplas")
      .select(IA_SAUDE_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as DuplaIa | null) ?? null;
  }
);

/** Calendário oficial — insumo do semáforo (o recorte por cronograma é
 *  feito dentro de saudadeDaDupla, como na UI). */
export const getCicloEventosIa = cache(
  async (supabase: SupabaseClient): Promise<CicloEvento[]> => {
    const { data, error } = await supabase
      .from("ciclo_eventos")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
);

// ---------- registros da dupla (campos estruturados apenas) ----------

/** Follow-ups estruturados — NUNCA tema/ferramenta/reflexoes/observacoes/
 *  dificuldade_detalhe/proximo_passo_detalhe (texto livre sobre menor fica
 *  fora do schema da tool, spec §0). Exportado pro teste garantir a
 *  allowlist. */
export const IA_REGISTRO_SELECT = `
  atividades, avaliacao, dificuldade, precisa_apoio, proximo_passo, created_at,
  encontro:encontros!registros_encontro_id_fkey!inner(numero, data_hora, realizado_em)
`;

export type RegistroIa = {
  atividades: string[];
  avaliacao: Registro["avaliacao"];
  dificuldade: Registro["dificuldade"];
  precisa_apoio: boolean;
  proximo_passo: Registro["proximo_passo"];
  created_at: string;
  encontro: {
    numero: number;
    data_hora: string | null;
    realizado_em: string | null;
  };
};

/** Registros visíveis pelo papel numa dupla — o !inner no encontro deixa
 *  filtrar por dupla_id e ordenar pelo encontro, mesma mecânica de
 *  getRegistros (queries.ts). Papel sem leitura recebe [] da RLS. */
export const getRegistrosDaDuplaIa = cache(
  async (
    supabase: SupabaseClient,
    duplaId: string,
    limite: number
  ): Promise<RegistroIa[]> => {
    const { data, error } = await supabase
      .from("registros")
      .select(IA_REGISTRO_SELECT)
      .eq("encontro.dupla_id", duplaId)
      .order("encontro(realizado_em)", {
        ascending: false,
        nullsFirst: false,
      })
      .order("encontro(numero)", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data ?? []) as unknown as RegistroIa[];
  }
);

// ---------- fila "aguardando par" + capacidade (coord-only) ----------

/** form_bruto id→payload das views *_pessoal — só a coluna do carimbo do
 *  intake (a fila ordena por "desde"; dados_civis/motivação etc. não entram
 *  no select, ao contrário do merge completo de getPessoalMap). Fora da
 *  coordenação a view devolve zero linhas — degrada pra mapa vazio, como
 *  getPessoalMap. */
async function getFormBrutoMap(
  supabase: SupabaseClient,
  view: "profiles_pessoal" | "mentorados_pessoal"
): Promise<Map<string, Record<string, unknown> | null>> {
  const { data, error } = await supabase.from(view).select("id, form_bruto");
  if (error) {
    console.error(`getFormBrutoMap(${view}):`, error);
    return new Map();
  }
  return new Map(
    (data ?? []).map(
      (r: { id: string; form_bruto: Record<string, unknown> | null }) => [
        r.id,
        r.form_bruto,
      ]
    )
  );
}

/** Pick do Profile/Mentorado — a fila só precisa destes campos e o Pick
 *  mantém a opcionalidade do tipo cheio: `as Profile[]`/`as Mentorado[]`
 *  continuam casts legítimos na fronteira das funções puras (o superset
 *  viria do select; o que falta é só o que o banco não mandou — whatsapp,
 *  email — e a fila não toca). */
export type PessoaFilaIa = Pick<
  Profile,
  | "id"
  | "nome"
  | "role"
  | "papeis"
  | "ativo"
  | "origem"
  | "consent_lgpd_em"
  | "created_at"
  | "form_bruto"
>;

export type MentoradoFilaIa = Pick<
  Mentorado,
  | "id"
  | "nome"
  | "ong_origem"
  | "origem"
  | "situacao"
  | "created_at"
  | "form_bruto"
>;

/** Insumos da fila derivada — o mesmo recorte que a /pessoas monta pra
 *  filaMentorados/filaMentores (ocupados = dupla ativa|pausada; histórico =
 *  qualquer dupla; contagem por mentor das vivas). Mentorado sem whatsapp:
 *  contato cru não sai pela tool. */
export const getFilaInsumos = cache(
  async (
    supabase: SupabaseClient
  ): Promise<{
    pessoas: PessoaFilaIa[];
    mentorados: MentoradoFilaIa[];
    mentorProfiles: Record<string, MentorProfile>;
    ocupados: Set<string>;
    historico: Set<string>;
    contagemPorMentor: Record<string, number>;
  }> => {
    const [pessoas, mentorados, brutoP, brutoM, duplas, mps] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, nome, role, ativo, origem, consent_lgpd_em, created_at, profile_papeis(papel)"
          ),
        supabase
          .from("mentorados")
          .select("id, nome, ong_origem, origem, situacao, created_at"),
        getFormBrutoMap(supabase, "profiles_pessoal"),
        getFormBrutoMap(supabase, "mentorados_pessoal"),
        supabase.from("duplas").select("mentor_id, mentorado_id, status, trilha"),
        supabase
          .from("mentor_profiles")
          .select("profile_id, tipo, capacidade, capacidade_especialista"),
      ]);
    if (pessoas.error) throw pessoas.error;
    if (mentorados.error) throw mentorados.error;
    if (duplas.error) throw duplas.error;
    if (mps.error) throw mps.error;

    const vivas = (duplas.data ?? []).filter(
      (d: { status: DuplaStatus }) =>
        d.status === "ativa" || d.status === "pausada"
    );
    const ocupados = new Set<string>(
      vivas.map((d: { mentorado_id: string }) => d.mentorado_id)
    );
    const historico = new Set<string>(
      (duplas.data ?? []).map((d: { mentorado_id: string }) => d.mentorado_id)
    );
    // contagem por mentor E trilha (WP6b — a filaMentores lê chave por pool)
    const contagemPorMentor: Record<string, number> = {};
    for (const d of vivas) {
      const viva = d as { mentor_id: string; trilha: string | null };
      const chave = `${viva.mentor_id}:${viva.trilha ?? "dpp"}`;
      contagemPorMentor[chave] = (contagemPorMentor[chave] ?? 0) + 1;
    }
    const mentorProfiles: Record<string, MentorProfile> = {};
    for (const mp of (mps.data ?? []) as MentorProfile[]) {
      mentorProfiles[mp.profile_id] = mp;
    }
    return {
      pessoas: ((pessoas.data ?? []) as (PessoaFilaIa & {
        profile_papeis?: { papel: AppRole }[];
      })[]).map((p) => {
        const { profile_papeis, ...rest } = p;
        return {
          ...rest,
          papeis: (profile_papeis ?? []).map((r) => r.papel),
          form_bruto: brutoP.get(p.id) ?? null,
        };
      }),
      mentorados: ((mentorados.data ?? []) as MentoradoFilaIa[]).map((m) => ({
        ...m,
        form_bruto: brutoM.get(m.id) ?? null,
      })),
      mentorProfiles,
      ocupados,
      historico,
      contagemPorMentor,
    };
  }
);

/** Recorte mínimo pro X/Y por mentor — sem as views *_pessoal (a capacidade
 *  não precisa do carimbo da fila). */
export const getCapacidadeInsumos = cache(
  async (
    supabase: SupabaseClient
  ): Promise<{
    pessoas: Pick<Profile, "id" | "nome" | "role" | "papeis" | "ativo">[];
    mentorProfiles: Record<string, MentorProfile>;
    contagemPorMentor: Record<string, number>;
  }> => {
    const [pessoas, duplas, mps] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, role, ativo, profile_papeis(papel)"),
      supabase.from("duplas").select("mentor_id, status, trilha"),
      supabase
        .from("mentor_profiles")
        .select("profile_id, tipo, capacidade, capacidade_especialista"),
    ]);
    if (pessoas.error) throw pessoas.error;
    if (duplas.error) throw duplas.error;
    if (mps.error) throw mps.error;
    const contagemPorMentor: Record<string, number> = {};
    for (const d of (duplas.data ?? []) as {
      mentor_id: string;
      status: DuplaStatus;
      trilha: string | null;
    }[]) {
      if (d.status === "ativa" || d.status === "pausada") {
        const chave = `${d.mentor_id}:${d.trilha ?? "dpp"}`;
        contagemPorMentor[chave] = (contagemPorMentor[chave] ?? 0) + 1;
      }
    }
    const mentorProfiles: Record<string, MentorProfile> = {};
    for (const mp of (mps.data ?? []) as MentorProfile[]) {
      mentorProfiles[mp.profile_id] = mp;
    }
    return {
      pessoas: ((pessoas.data ?? []) as (Pick<
        Profile,
        "id" | "nome" | "role" | "ativo"
      > & { profile_papeis?: { papel: AppRole }[] })[]).map((p) => {
        const { profile_papeis, ...rest } = p;
        return {
          ...rest,
          papeis: (profile_papeis ?? []).map((r) => r.papel),
        };
      }),
      mentorProfiles,
      contagemPorMentor,
    };
  }
);

// ---------- ficha da dupla pro jovem (view escopada) ----------

export type JovemDuplaIa = {
  id: string;
  trilha: Trilha;
  status: DuplaStatus;
  turma: string;
  iniciada_em: string | null;
  demanda: string | null;
  mentor_nome: string | null;
  supervisor_nome: string | null;
};

/** A dupla do jovem pela view jovem_duplas (0067) — o papel 'mentorado' não
 *  tem grant na tabela duplas; a view já resolve os nomes dos adultos sem
 *  abrir profiles. Os encontros ele lê direto (encontros_select tem o ramo
 *  da própria dupla). */
export const getJovemDuplaIa = cache(
  async (
    supabase: SupabaseClient,
    duplaId: string
  ): Promise<{
    dupla: JovemDuplaIa;
    encontros: {
      numero: number;
      status: string;
      data_hora: string | null;
      realizado_em: string | null;
      link: string | null;
    }[];
  } | null> => {
    const { data, error } = await supabase
      .from("jovem_duplas")
      .select(
        "id, trilha, status, turma, iniciada_em, demanda, mentor_nome, supervisor_nome"
      )
      .eq("id", duplaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: encontros, error: e2 } = await supabase
      .from("encontros")
      .select("numero, status, data_hora, realizado_em, link")
      .eq("dupla_id", duplaId)
      .order("numero", { ascending: true });
    if (e2) throw e2;
    return {
      dupla: data as unknown as JovemDuplaIa,
      encontros: (encontros ?? []) as {
        numero: number;
        status: string;
        data_hora: string | null;
        realizado_em: string | null;
        link: string | null;
      }[],
    };
  }
);

// ---------- instrumentos da dupla (RPC homônima, 0080) ----------

/** Respostas dos 4 instrumentos oficiais da dupla — a RPC security definer
 *  já carrega o escopo (coord, mentor/supervisor/mentorado DA DUPLA) e a
 *  allowlist (só os 4 sistemas de trabalho; respostas só quando respondido).
 *  Passa direto — a tool não re-fatia o que já saiu curado. */
export async function getInstrumentosDaDuplaIa(
  supabase: SupabaseClient,
  duplaId: string
): Promise<InstrumentoDupla[]> {
  const { data, error } = await supabase.rpc("instrumentos_da_dupla", {
    p_dupla_id: duplaId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as InstrumentoDupla[];
}
