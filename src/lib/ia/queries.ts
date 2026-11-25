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
import { CacheTtl } from "./cache";
import { perguntaFts } from "@/lib/ia/busca-guias";

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
  mentor:profiles!duplas_mentor_id_fkey(nome, nome_social),
  mentorado:mentorados(nome, nome_social),
  supervisor:profiles!duplas_supervisor_id_fkey(nome, nome_social),
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
  mentor: { nome: string; nome_social: string | null; whatsapp?: string | null } | null;
  mentorado: { nome: string; nome_social: string | null; whatsapp?: string | null } | null;
  supervisor: { nome: string; nome_social: string | null; whatsapp?: string | null } | null;
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

/** IA_SAUDE_SELECT + whatsapp on the three people — only on the SINGLE-dupla
 *  slice (ficha_dupla is its only consumer): the WhatsApp draft block needs
 *  the number to build the direct wa.me link. List tools keep no raw
 *  contact — bulk phone export to the model stays off the table. */
const IA_FICHA_SELECT = IA_SAUDE_SELECT.replace(
  "(nome, nome_social)",
  "(nome, nome_social, whatsapp)"
);

/** Uma dupla por id, no escopo do papel — null quando a RLS não a entrega
 *  (inexistente ou fora do alcance: o "não achei" é honesto, não vaza
 *  existência). */
export const getDuplaIa = cache(
  async (supabase: SupabaseClient, id: string): Promise<DuplaIa | null> => {
    const { data, error } = await supabase
      .from("duplas")
      .select(IA_FICHA_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as DuplaIa | null) ?? null;
  }
);

/** WhatsApp of the jovem's dupla adults (jovem_contatos view, 0067 —
 *  definer scoped by my_mentorado_id): mentor and supervisor. The "text my
 *  mentor" draft picks the number from here. */
export const getJovemContatoIa = cache(
  async (
    supabase: SupabaseClient,
    duplaId: string
  ): Promise<{ papel: string; whatsapp: string | null }[]> => {
    const { data, error } = await supabase
      .from("jovem_contatos")
      .select("papel, whatsapp")
      .eq("dupla_id", duplaId);
    if (error) throw error;
    return (data ?? []) as { papel: string; whatsapp: string | null }[];
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

/** id → carimbo do intake das views *_pessoal — a fila ordena por "desde"
 *  e a ÚNICA chave que esperaDesde/carimboFormBruto lê no form_bruto é
 *  "Carimbo de data/hora". O payload cru ainda atravessa o fetch (o
 *  PostgREST não consegue fatiar chave JSON com espaço/'/' no select —
 *  tirar de vez exigiria coluna computada/RPC no banco), mas morre na
 *  borda: o mapa guarda só {"Carimbo de data/hora": v} — documentos,
 *  contato, nascimento e o resto do intake nunca chegam aos objetos que a
 *  tool e as funções puras tocam (ao contrário do merge completo de
 *  getPessoalMap, que é tela da coordenação). Fora da coordenação a view
 *  devolve zero linhas — degrada pra mapa vazio, como getPessoalMap. */
async function getCarimboMap(
  supabase: SupabaseClient,
  view: "profiles_pessoal" | "mentorados_pessoal"
): Promise<Map<string, Record<string, unknown> | null>> {
  const { data, error } = await supabase.from(view).select("id, form_bruto");
  if (error) {
    console.error(`getCarimboMap(${view}):`, error);
    return new Map();
  }
  return new Map(
    (data ?? []).map(
      (r: { id: string; form_bruto: Record<string, unknown> | null }) => [
        r.id,
        r.form_bruto == null
          ? null
          : { "Carimbo de data/hora": r.form_bruto["Carimbo de data/hora"] },
      ]
    )
  );
}

/** Pick do Profile/Mentorado — a fila só precisa destes campos e o Pick
 *  mantém a opcionalidade do tipo cheio: `as Profile[]`/`as Mentorado[]`
 *  continuam casts legítimos na fronteira das funções puras (o superset
 *  viria do select; o que falta é só o que o banco não mandou — whatsapp,
 *  email — e a fila não toca). `form_bruto` aqui já vem reduzido pelo
 *  getCarimboMap: é o objeto {"Carimbo de data/hora": v} | null, não o
 *  intake inteiro — esperaDesde só lê essa chave. */
export type PessoaFilaIa = Pick<
  Profile,
  | "id"
  | "nome"
  | "nome_social"
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
  | "nome_social"
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
    const [pessoas, mentorados, carimboP, carimboM, duplas, mps] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, nome, nome_social, role, ativo, origem, consent_lgpd_em, created_at, profile_papeis(papel)"
          ),
        supabase
          .from("mentorados")
          .select("id, nome, nome_social, ong_origem, origem, situacao, created_at"),
        getCarimboMap(supabase, "profiles_pessoal"),
        getCarimboMap(supabase, "mentorados_pessoal"),
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
          form_bruto: carimboP.get(p.id) ?? null,
        };
      }),
      mentorados: ((mentorados.data ?? []) as MentoradoFilaIa[]).map((m) => ({
        ...m,
        form_bruto: carimboM.get(m.id) ?? null,
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
    pessoas: Pick<
      Profile,
      "id" | "nome" | "nome_social" | "role" | "papeis" | "ativo"
    >[];
    mentorProfiles: Record<string, MentorProfile>;
    contagemPorMentor: Record<string, number>;
  }> => {
    const [pessoas, duplas, mps] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, nome_social, role, ativo, profile_papeis(papel)"),
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
        "id" | "nome" | "nome_social" | "role" | "ativo"
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
  mentor_nome_social: string | null;
  supervisor_nome: string | null;
  supervisor_nome_social: string | null;
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
        "id, trilha, status, turma, iniciada_em, demanda, mentor_nome, mentor_nome_social, supervisor_nome, supervisor_nome_social"
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

// ---------- índice de duplas + agenda do período ----------

/** A linha do índice de duplas — projeção mínima pra descobrir dupla_id
 *  e dar contexto na resposta (nomes, trilha, status, turma). */
export type DuplaResumoIa = {
  id: string;
  trilha: Trilha;
  status: DuplaStatus;
  turma: string;
  mentor: { nome: string; nome_social: string | null } | null;
  mentorado: { nome: string; nome_social: string | null } | null;
};

/** Índice enxuto das duplas vivas no escopo do papel — é como o modelo
 *  descobre `dupla_id` antes das tools por-id ("minha dupla" → a dele).
 *  Sem encontros/registros: o detalhe vem de ficha_dupla/registros_da_dupla.
 *  Corta em 60 pra caber no contexto e devolve junto o total REAL do
 *  escopo (count exato na mesma query — o PostgREST conta sob a RLS sem
 *  round-trip extra) — total > duplas.length avisa a tool que a lista
 *  veio parcial, senão o modelo responderia como se tivesse visto o
 *  universo inteiro. */
export const getDuplasResumoIa = cache(
  async (
    supabase: SupabaseClient
  ): Promise<{ duplas: DuplaResumoIa[]; total: number }> => {
    const { data, error, count } = await supabase
      .from("duplas")
      .select(
        `id, trilha, status, turma,
         mentor:profiles!duplas_mentor_id_fkey(nome, nome_social),
         mentorado:mentorados(nome, nome_social)`,
        { count: "exact" }
      )
      .in("status", ["ativa", "pausada"])
      .order("turma")
      .limit(60);
    if (error) throw error;
    const duplas = (data ?? []) as unknown as DuplaResumoIa[];
    // count vem null se o PostgREST não devolver o cabeçalho — o total
    // honesto degrada pro tamanho da página (nunca promete corte que não
    // houve; no pior caso omite a sinalização, como antes)
    return { duplas, total: count ?? duplas.length };
  }
);

/** Encontros numa janela — visíveis pela RLS (mentor vê os das próprias
 *  duplas, supervisor as supervisionadas, coord tudo). O !inner na dupla
 *  filtra de novo pelo lado do embed: encontro de dupla invisível não
 *  aparece nem órfão. */
export const getAgendaPeriodoIa = cache(
  async (
    supabase: SupabaseClient,
    desdeIso: string,
    ateIso: string
  ) => {
    const { data, error } = await supabase
      .from("encontros")
      .select(
        `numero, status, data_hora, realizado_em,
         dupla:duplas!inner(
           id,
           mentor:profiles!duplas_mentor_id_fkey(nome, nome_social),
           mentorado:mentorados(nome, nome_social)
         )`
      )
      .gte("data_hora", desdeIso)
      .lte("data_hora", ateIso)
      .order("data_hora", { ascending: true })
      .limit(80);
    if (error) throw error;
    return (data ?? []) as unknown as {
      numero: number;
      status: string;
      data_hora: string | null;
      realizado_em: string | null;
      dupla: {
        id: string;
        mentor: { nome: string; nome_social: string | null } | null;
        mentorado: { nome: string; nome_social: string | null } | null;
      };
    }[];
  }
);

/** Janela passada de encontros pra agregação (esperados × realizados por
 *  dupla/período) — mesmo escopo RLS + !inner da agenda_do_periodo, mas sem
 *  teto de data (remarcado pra depois de hoje entra como "futuro" na
 *  contagem) e com trilha pra separar DPP de especialista. dupla_id
 *  restringe a uma dupla quando a pergunta é pontual. */
export const getHistoricoEncontrosIa = cache(
  async (supabase: SupabaseClient, desdeIso: string, duplaId?: string) => {
    let q = supabase
      .from("encontros")
      .select(
        `numero, status, data_hora, realizado_em,
         dupla:duplas!inner(
           id, trilha,
           mentor:profiles!duplas_mentor_id_fkey(nome, nome_social),
           mentorado:mentorados(nome, nome_social)
         )`
      )
      .gte("data_hora", desdeIso)
      .order("data_hora", { ascending: true })
      .limit(600);
    if (duplaId) q = q.eq("dupla_id", duplaId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as {
      numero: number;
      status: string;
      data_hora: string | null;
      realizado_em: string | null;
      dupla: {
        id: string;
        trilha: string | null;
        mentor: { nome: string; nome_social: string | null } | null;
        mentorado: { nome: string; nome_social: string | null } | null;
      };
    }[];
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

// ---------- RAG dos guias (match_ia_chunks, 0136) ----------

/** Um trecho citável dos guias oficiais. A referência que o modelo cita é
 *  guia/secao ("Guia do Mentor DPP, cap. 10") — `pagina` é só o id
 *  sintético do chunk dentro do documento (ingerir-guias.mjs: si×100+ci),
 *  não a página do PDF: fica aqui pra identidade/dedup e NÃO sai pro
 *  modelo nem pro card de fontes. */
export type FonteGuia = {
  guia: string;
  secao: string | null;
  pagina: number | null;
  trecho: string;
  score: number;
};

/** Um chunk do corpus com o texto inteiro e os metadados de citação da
 *  0165 (`material` = slug do doc nativo, `secaoAnchor` = âncora da seção
 *  na página do documento — ambos null até o re-ingest). */
export type ChunkCitavel = {
  texto: string;
  material: string | null;
  secaoAnchor: string | null;
};

/** Texto inteiro dos chunks vencedores. O `trecho` da RPC é a janela de
 *  ~40 palavras do ts_headline (ou 220 chars no hit vetorial) e cortava
 *  a frase nas duas pontas: o modelo respondia com meio fato (P1). A
 *  leitura é direta — ia_chunks é select pra authenticated (0136). */
export async function textosChunksIa(
  supabase: SupabaseClient,
  chaves: { guia: string; pagina: number | null }[]
): Promise<Map<string, ChunkCitavel>> {
  const guias = [...new Set(chaves.map((c) => c.guia))];
  const paginas = [
    ...new Set(chaves.flatMap((c) => (c.pagina == null ? [] : [c.pagina]))),
  ];
  if (!guias.length || !paginas.length) return new Map();
  const { data, error } = await supabase
    .from("ia_chunks")
    .select("guia, pagina, texto, material, secao_anchor")
    .in("guia", guias)
    .in("pagina", paginas);
  if (error) throw error;
  return new Map(
    (data ?? []).map((r) => [
      `${r.guia}|${r.pagina}`,
      {
        texto: r.texto as string,
        material: (r.material as string | null) ?? null,
        secaoAnchor: (r.secao_anchor as string | null) ?? null,
      },
    ])
  );
}

/** Busca FTS portuguese no corpus dos guias (docs/rag/*.md ingeridos em
 *  ia_chunks). A RPC é definer e o conteúdo é institucional (sem PII), mas
 *  o client autenticado do caller segue sendo o transporte — mesmo padrão
 *  das outras queries. */
export async function matchGuiaIa(
  supabase: SupabaseClient,
  pergunta: string,
  limite = 4,
  /** vetor da pergunta (0150): null = só o braço FTS — a RPC decide a
   *  fusão RRF quando o vetor chega */
  embedding?: number[] | null
): Promise<FonteGuia[]> {
  const { data, error } = await supabase.rpc("match_ia_chunks", {
    p_query: perguntaFts(pergunta),
    p_limit: limite,
    // PostgREST espera o literal vetorial "[a,b,c]", não um array JSON
    ...(embedding ? { p_embedding: `[${embedding.join(",")}]` } : {}),
  });
  if (error) throw error;
  return (data ?? []) as unknown as FonteGuia[];
}

// ---------- chamados + pessoas (REALIZA-325) ----------

/** Chamados no escopo que a RLS já dá: staff vê a fila inteira (view
 *  chamados_fila), autor vê os próprios. Pro resumo da tool basta o
 *  essencial — conteúdo da conversa do chamado fica fora (mesma regra de
 *  minimização dos registros). */
export type ChamadoIa = {
  id: string;
  numero: string;
  categoria: string;
  assunto: string;
  status: string;
  dupla_id: string | null;
  created_at: string;
};

export async function getChamadosIa(
  supabase: SupabaseClient,
  limite = 15
): Promise<ChamadoIa[]> {
  const { data, error } = await supabase
    .from("chamados")
    .select("id, numero, categoria, assunto, status, dupla_id, created_at")
    .neq("status", "resolvido")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as unknown as ChamadoIa[];
}

/** Busca de pessoas por nome (staff): perfil mínimo pra identificar e
 *  pra alimentar outras tools com ids — contato e campos sensíveis não
 *  saem pela tool. A RLS de profiles decide o que volta. */
export async function getPessoasBuscaIa(
  supabase: SupabaseClient,
  nome: string,
  limite = 8
): Promise<
  { id: string; nome: string; nome_social: string | null; role: string | null }[]
> {
  // %_ são curinga do ilike; ,()." quebram a sintaxe do .or() do PostgREST
  // — sem o escape o termo abria oráculo de enumeração em qualquer coluna
  // (sdd D3, pacote nov/2026)
  const termo = nome.trim().replace(/[%_,()."\\]/g, "");
  if (termo.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, nome_social, role")
    .or(`nome.ilike.%${termo}%,nome_social.ilike.%${termo}%`)
    .eq("ativo", true)
    .order("nome")
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    nome: string;
    nome_social: string | null;
    role: string | null;
  }[];
}

/** Eventos de auditoria da Liza pra tela /ia (sdd D4): o recorte por dias
 *  sai do clock aqui — fora do componente — e a RLS já faz o escopo
 *  (coordenação lê tudo, outras pessoas só os próprios eventos). Pagina em
 *  blocos de IA_EVENTOS_PAGINA: o PostgREST corta em max_rows (1000,
 *  supabase/config.toml) e um .limit maior voltava silenciosamente
 *  truncado. `truncado` sinaliza o teto atingido — a tela avisa que o
 *  recorte mostra só os eventos mais recentes. */
const IA_EVENTOS_PAGINA = 1000;
const IA_EVENTOS_TETO = 20000;

export async function getIaEventos(supabase: SupabaseClient, dias: number) {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const eventos: Record<string, unknown>[] = [];
  let truncado = false;
  for (let i = 0; i < IA_EVENTOS_TETO; i += IA_EVENTOS_PAGINA) {
    const { data, error } = await supabase
      .from("ia_eventos")
      .select(
        "profile_id, canal, tool, request_id, ok, args, duracao_ms, modelo, tier, tokens_in, tokens_out, tokens_reasoning, cache_read, custo_usd, allowance_usd, billing_source, iteracoes, created_at"
      )
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .range(i, i + IA_EVENTOS_PAGINA - 1);
    if (error) throw error;
    eventos.push(...(data ?? []));
    if ((data ?? []).length < IA_EVENTOS_PAGINA) break;
  }
  // página cheia no último bloco = pode haver mais além do teto
  truncado = eventos.length >= IA_EVENTOS_TETO;
  return { eventos, truncado };
}

export type PainelIaDados = {
  eventos: Record<string, unknown>[];
  truncado: boolean;
  /** profile_id → nome de exibição, só das pessoas presentes nos eventos */
  nomes: Map<string, string>;
};

// Cache do painel /ia: os chips de canal/modelo filtram em memória, então
// cada clique refazia até 20 páginas de ia_eventos + profiles pro MESMO
// período. 60s cobre a navegação entre chips sem atrasar muito o dado novo.
const PAINEL_IA_TTL_MS = 60_000;
const cachePainelIa = new CacheTtl<PainelIaDados>(PAINEL_IA_TTL_MS, 3);

export function limparCachePainelIa() {
  cachePainelIa.limpar();
  cacheConsumoPlano.limpar();
}

/** Chave do cache do painel, ou null = não cachear. Exceção consciente ao
 *  "nada recortado pela RLS" de cache.ts: só a coordenação tem chave, e
 *  pra ela o recorte é o conjunto inteiro (ia_eventos_select, 0083:
 *  `my_role() = 'coordenacao'` lê tudo; profiles_select, 0141, idem) —
 *  qualquer pessoa da coordenação veria exatamente as mesmas linhas, então
 *  dividir a leitura entre elas não vaza nada. Outro papel só vê os
 *  próprios eventos e nunca entra aqui. O prefixo `coord|` deixa isso
 *  explícito na chave. Demo não passa por este caminho (page.tsx). */
export function chavePainelIa(
  papel: AppRole | null | undefined,
  dias: number
): string | null {
  return papel === "coordenacao" ? `coord|${dias}` : null;
}

/** Eventos do período + nomes das pessoas que aparecem neles. `papel` é o
 *  do viewer JÁ verificado pela página; fora da coordenação lê direto. */
export async function getPainelIa(
  supabase: SupabaseClient,
  papel: AppRole | null | undefined,
  dias: number
): Promise<PainelIaDados> {
  // falha em profiles mantém o painel no ar com "Sem nome" (como antes),
  // mas esse resultado degradado não fica 60s no cache
  let semNomes = false;
  const carregar = async (): Promise<PainelIaDados> => {
    const { eventos, truncado } = await getIaEventos(supabase, dias);
    const ids = [
      ...new Set(
        eventos
          .map((e) => e.profile_id as string | null)
          .filter((x): x is string => !!x)
      ),
    ];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: ps, error } = await supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("id", ids);
      if (error) {
        console.error("getPainelIa profiles:", error);
        semNomes = true;
      }
      for (const p of (ps ?? []) as { id: string; nome: string | null; nome_social: string | null }[])
        nomes.set(p.id, p.nome_social ?? p.nome ?? "Sem nome");
    }
    return { eventos, truncado, nomes };
  };
  const chave = chavePainelIa(papel, dias);
  return chave
    ? cachePainelIa.obter(chave, carregar, () => !semNomes)
    : carregar();
}

/** Consumo do plano Go pra previsão do painel /ia: só modelo, allowance e
 *  data das respostas desde `desdeMs` (começo do ciclo ou 30 dias), sem
 *  depender do período escolhido nos chips. Select de 3 colunas e só
 *  linhas com allowance: a leitura mais barata que responde "o plano
 *  aguenta até renovar?". Mesmo cache coord-only de 60s do painel. */
const cacheConsumoPlano = new CacheTtl<Record<string, unknown>[]>(PAINEL_IA_TTL_MS, 2);

export async function getConsumoPlanoIa(
  supabase: SupabaseClient,
  papel: AppRole | null | undefined,
  desdeMs: number
): Promise<Record<string, unknown>[]> {
  // arredonda pra hora cheia: a chave do cache e o filtro andam juntos
  const desde = new Date(Math.floor(desdeMs / 3600_000) * 3600_000).toISOString();
  const carregar = async () => {
    const linhas: Record<string, unknown>[] = [];
    for (let i = 0; i < IA_EVENTOS_TETO; i += IA_EVENTOS_PAGINA) {
      const { data, error } = await supabase
        .from("ia_eventos")
        .select("modelo, allowance_usd, created_at")
        .eq("tool", "resposta")
        .not("allowance_usd", "is", null)
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .range(i, i + IA_EVENTOS_PAGINA - 1);
      if (error) throw error;
      linhas.push(...(data ?? []));
      if ((data ?? []).length < IA_EVENTOS_PAGINA) break;
    }
    return linhas;
  };
  const base = chavePainelIa(papel, 0);
  return base
    ? cacheConsumoPlano.obter(`${base}|plano|${desde}`, carregar)
    : carregar();
}

// ---------- mentorado (sdd D5, pacote liza nov/2026) ----------
// Leituras do jovem pelas MESMAS fronteiras do shell /jovem: views definer
// `jovem_*` (0067+) e tabelas de policy aberta — nunca duplas/mentorados/
// profiles base, que o papel não tem grant. Funcionam com o JWT da sessão
// e com o impersonado do MCP (my_mentorado_id/my_role leem o JWT do caller).

/** A dupla do jovem por descoberta (sem id — destrava as outras tools):
 *  jovem_duplas já é escopada por my_mentorado_id(). Com duas duplas
 *  (DPP + trilha de especialista) a DPP é "a dupla" — ela carrega o par. */
export async function getMinhaDuplaIa(
  supabase: SupabaseClient
): Promise<JovemDuplaIa | null> {
  const { data, error } = await supabase
    .from("jovem_duplas")
    .select(
      "id, trilha, status, turma, iniciada_em, demanda, mentor_nome, mentor_nome_social, supervisor_nome, supervisor_nome_social"
    )
    .order("iniciada_em", { ascending: false });
  if (error) throw error;
  const lista = (data ?? []) as JovemDuplaIa[];
  // trilha NULL conta como dpp (coalesce na 0087)
  return lista.find((d) => d.trilha !== "especialista") ?? lista[0] ?? null;
}

export type JovemEncontroIa = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  realizado_em: string | null;
  duracao_min: number | null;
  status: string;
  link: string | null;
};

/** Agenda do jovem — a RLS de encontros escopa às duplas dele via
 *  exists(jovem_duplas) (0068). Próximos primeiro; os passados recentes
 *  fecham o "como foi" sem virar histórico inteiro. */
export async function getJovemAgendaIa(
  supabase: SupabaseClient,
  limite = 8
): Promise<{ proximos: JovemEncontroIa[]; passados: JovemEncontroIa[] }> {
  const { data, error } = await supabase
    .from("encontros")
    .select("id, dupla_id, numero, data_hora, realizado_em, duracao_min, status, link")
    .order("data_hora", { ascending: true, nullsFirst: false })
    .limit(40);
  if (error) throw error;
  const todos = (data ?? []) as JovemEncontroIa[];
  const agora = new Date().toISOString();
  // agendado + remarcado contam como futuros — mesma conjunção de
  // estado-encontro.ts e das outras leituras de agenda do app
  const futuros = todos.filter(
    (e) =>
      (e.status === "agendado" || e.status === "remarcado") &&
      (e.data_hora == null || e.data_hora >= agora)
  );
  const feitos = todos
    .filter((e) => e.status === "realizado")
    .sort((a, b) => String(b.data_hora).localeCompare(String(a.data_hora)))
    .slice(0, 3);
  return { proximos: futuros.slice(0, limite), passados: feitos };
}

export type JovemCombinadoIa = {
  id: string;
  texto: string;
  status: string;
  prazo: string | null;
  created_at: string;
};

/** Combinados do jovem (view jovem_encaminhamentos) — pendente primeiro,
 *  feito recente só pra confirmar o que já foi marcado. */
export async function getJovemCombinadosIa(
  supabase: SupabaseClient
): Promise<{ pendentes: JovemCombinadoIa[]; feitos: JovemCombinadoIa[] }> {
  const { data, error } = await supabase
    .from("jovem_encaminhamentos")
    // a view expõe `descricao` (0070); o alias mantém o contrato `texto` da
    // tool e do card
    .select("id, texto:descricao, status, prazo, created_at")
    .order("status")
    .order("prazo", { ascending: true, nullsFirst: false });
  if (error) throw error;
  const lista = (data ?? []) as JovemCombinadoIa[];
  return {
    pendentes: lista.filter((c) => c.status === "pendente"),
    feitos: lista.filter((c) => c.status !== "pendente").slice(0, 5),
  };
}

/** Progresso da jornada (RPC jovem_jornada, 0096) — instrumentos com
 *  entregas + cronograma; self-scoped por my_mentorado_id(). */
export async function getJovemProgressoIa(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("jovem_jornada");
  if (error) throw error;
  return data as {
    dupla_id: string;
    cronograma: unknown[];
    instrumentos: {
      sistema: string;
      titulo?: string;
      entregas: { status: string; destino?: string }[];
    }[];
    avaliacao_360: unknown[];
  } | null;
}

/** Pedidos de especialista do jovem — a view solicitacoes_mural escopa às
 *  duplas dele. Sem embeds de profiles (o papel não lê profiles): o nome
 *  do especialista é a coluna plana da view (especialista_nome). */
export async function getJovemPedidosIa(supabase: SupabaseClient, limite = 40) {
  const { data, error } = await supabase
    .from("solicitacoes_mural")
    .select("id, status, status_efetivo, demanda, motivo, especialista_nome, especialista_nome_social, especialista_desejado_nome, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as {
    id: string; status: string; status_efetivo: string | null;
    demanda: string | null; motivo: string | null;
    especialista_nome: string | null;
    especialista_nome_social: string | null;
    especialista_desejado_nome: string | null; created_at: string;
  }[];
}
