// Fetchers dos 6 tipos novos de export (REALIZA-178) — server-side, client
// da sessão (a RLS escopa; coordenacao lê tudo, que é o único papel que
// chega aqui pelos gates da rota). Serialização mora em csv.ts; o que sai
// daqui é a Linha* resolvida que os previews do hub também exibem.
//
// Os montadores linhasX são puros e servem aos dois caminhos (query real e
// dataset demo) — mesma regra, mesma saída, paridade honesta.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DUPLA_SELECT } from "@/lib/queries";
import {
  diasAtrasoRegistro,
  diffDias,
  encontroEsperado,
  eventosDoCronograma,
  papelLabel,
  saudadeDaDupla,
  TRILHA_LABEL,
  type Semaforo,
} from "@/lib/ciclo";
import { PESO_AVALIACAO } from "@/lib/encerramento";
import { contagemRemarcacoes } from "@/lib/remarcacoes";
import { turmaDaDupla } from "@/lib/turma";
import type { InteracaoTipo, InteracaoCanal } from "@/lib/interacoes";
import type { DemoData } from "@/lib/demo/data";
import { getDemoFormularios } from "@/lib/demo/forms-data";
import { comEfetivo } from "@/lib/demo/queries";
import {
  duplaNoRecorte,
  filtraPorRecorte,
  type RecorteCsv,
} from "./csv-core";
import type {
  LinhaAderencia,
  LinhaAssinaturaPendente,
  LinhaEncerramento,
  LinhaFormsTaxa,
  LinhaInteracao,
  LinhaSolicitacao,
} from "./csv";
import type {
  AssinaturaStatus,
  AvaliacaoJovem,
  CicloEvento,
  Cronograma,
  Dupla,
  Encerramento,
  EncerramentoChecklist,
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
} from "@/lib/types";

type Supa = SupabaseClient;

const norm = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const SEMAFORO_LABEL: Record<Semaforo, string> = {
  risco: "em risco",
  atencao: "em atenção",
  ok: "em dia",
};

/** Duplas mínimas pra resolver turma/cronograma e nomes — o mapa por trás
 *  dos recortes não-dupla (interacao, solicitação, form, assinatura). */
type DuplaMapa = {
  id: string;
  turma: string | null;
  cronograma_id: string | null;
  mentor_id: string | null;
  mentorado_id: string | null;
  mentor?: { nome: string } | null;
  mentorado?: { nome: string } | null;
};

const DUPLA_MAPA_SELECT = `
  id, turma, cronograma_id, mentor_id, mentorado_id,
  mentor:profiles!duplas_mentor_id_fkey(nome),
  mentorado:mentorados(nome)
`;

const duplaLabel = (d: DuplaMapa | undefined) =>
  d ? `${d.mentor?.nome ?? ""} ↔ ${d.mentorado?.nome ?? ""}` : "";

/** person_id (profile ou mentorado) → duplas onde a pessoa figura — base
 *  do recorte ?turma= pra linhas que não carregam dupla direta. */
function duplasPorPessoa(duplas: DuplaMapa[]): Map<string, DuplaMapa[]> {
  const m = new Map<string, DuplaMapa[]>();
  for (const d of duplas) {
    for (const id of [d.mentor_id, d.mentorado_id]) {
      if (!id) continue;
      const cur = m.get(id) ?? [];
      cur.push(d);
      m.set(id, cur);
    }
  }
  return m;
}

function pessoaNoRecorte(
  personId: string | null,
  mapa: Map<string, DuplaMapa[]>,
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): boolean {
  if (!recorte.turma && !recorte.cronogramaId) return true;
  if (!personId) return false;
  return (mapa.get(personId) ?? []).some((d) =>
    duplaNoRecorte(d, recorte, crons)
  );
}

async function duplasMapaReal(
  supabase: Supa
): Promise<{ porId: Map<string, DuplaMapa>; porPessoa: Map<string, DuplaMapa[]>; crons: Pick<Cronograma, "id" | "turma">[] }> {
  const [dRes, cRes] = await Promise.all([
    supabase.from("duplas").select(DUPLA_MAPA_SELECT),
    supabase.from("cronogramas").select("id, turma"),
  ]);
  if (dRes.error) throw dRes.error;
  if (cRes.error) throw cRes.error;
  const lista = ((dRes.data ?? []) as unknown as DuplaMapa[]).map((d) => ({
    ...d,
    mentor: norm(d.mentor as DuplaMapa["mentor"]),
    mentorado: norm(d.mentorado as DuplaMapa["mentorado"]),
  }));
  return {
    porId: new Map(lista.map((d) => [d.id, d])),
    porPessoa: duplasPorPessoa(lista),
    crons: (cRes.data ?? []) as Pick<Cronograma, "id" | "turma">[],
  };
}

// =====================================================================
// tipo=aderencia — 1 linha/dupla. esperados via encontroEsperado no
// cronograma da dupla; semáforo+motivos via saudadeDaDupla (zero lógica
// nova de semáforo — reusa, não reimplementa).
// =====================================================================

export function linhasAderencia(
  duplas: Dupla[],
  eventos: CicloEvento[],
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[],
  hoje = new Date()
): LinhaAderencia[] {
  const cronNome = new Map(crons.map((c) => [c.id, c.nome]));
  return duplas.map((d) => {
    const saude = saudadeDaDupla(d, eventos, hoje);
    const esperados = encontroEsperado(
      eventosDoCronograma(eventos, d.cronograma_id),
      hoje,
      d.iniciada_em
    );
    const realizados = d.encontros.filter(
      (e) => e.status === "realizado"
    ).length;
    const atrasos = d.encontros
      .filter((e) => e.registro)
      .map((e) => diasAtrasoRegistro(e.registro!, e));
    const avaliacoes = d.encontros
      .map((e) => e.registro?.avaliacao)
      .filter((a): a is AvaliacaoJovem => !!a);
    let remarcacoes = 0;
    for (const n of contagemRemarcacoes(d).values()) remarcacoes += n;
    return {
      turma: turmaDaDupla(d, crons) ?? "",
      cronograma: d.cronograma_id ? (cronNome.get(d.cronograma_id) ?? "") : "",
      trilha: TRILHA_LABEL[d.trilha] ?? d.trilha,
      mentor: d.mentor?.nome ?? "",
      mentorado: d.mentorado?.nome ?? "",
      esperados,
      realizados,
      // % inteira da aderência — aderência >100 (reposição) aparece honesto
      aderencia:
        esperados > 0 ? Math.round((realizados / esperados) * 100) : null,
      atrasoMedioRegistro: atrasos.length
        ? atrasos.reduce((s, n) => s + n, 0) / atrasos.length
        : null,
      avaliacaoMedia: avaliacoes.length
        ? avaliacoes.reduce((s, a) => s + PESO_AVALIACAO[a], 0) /
          avaliacoes.length
        : null,
      remarcacoes,
      semaforo: SEMAFORO_LABEL[saude.semaforo],
      motivos: saude.motivos.join(" | "),
    };
  });
}

export async function dadosAderencia(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaAderencia[]> {
  const [dRes, eRes, cRes] = await Promise.all([
    supabase.from("duplas").select(DUPLA_SELECT).order("created_at"),
    supabase.from("ciclo_eventos").select("*").order("ordem"),
    supabase.from("cronogramas").select("id, nome, turma"),
  ]);
  if (dRes.error) throw dRes.error;
  if (eRes.error) throw eRes.error;
  if (cRes.error) throw cRes.error;
  const eventos = (eRes.data ?? []) as CicloEvento[];
  const crons = (cRes.data ?? []) as Pick<Cronograma, "id" | "nome" | "turma">[];
  const duplas = filtraPorRecorte(
    (dRes.data ?? []) as unknown as Dupla[],
    recorte,
    crons
  );
  return linhasAderencia(duplas, eventos, crons);
}

export function dadosAderenciaDemo(
  d: DemoData,
  recorte: RecorteCsv
): LinhaAderencia[] {
  return linhasAderencia(
    filtraPorRecorte(d.duplas, recorte, d.cronogramas),
    d.cicloEventos,
    d.cronogramas
  );
}

// =====================================================================
// tipo=assinaturas-pendentes — anti-join documento × pessoa sem
// assinado_em (status pendente ou expirado; revogado não é pendência).
// =====================================================================

type RowAssinatura = {
  profile_id: string | null;
  mentorado_id: string | null;
  status: AssinaturaStatus;
  token_expira_em: string | null;
  created_at: string;
  documento: string;
};

export function linhasAssinaturasPendentes({
  rows,
  nomes,
  papeis,
  porPessoa,
  recorte,
  crons,
  agora = new Date(),
}: {
  rows: RowAssinatura[];
  nomes: Map<string, string>;
  papeis: Map<string, string | null>;
  porPessoa: Map<string, DuplaMapa[]>;
  recorte: RecorteCsv;
  crons: readonly Pick<Cronograma, "id" | "turma">[];
  agora?: Date;
}): LinhaAssinaturaPendente[] {
  const alvo = agora.toISOString();
  const out: LinhaAssinaturaPendente[] = [];
  for (const a of rows) {
    if (a.status === "revogado") continue;
    // a pendência é pessoa × documento: assinado_em nulo define a anti-chave;
    // um doc novo pendente e um expirado sem assinatura contam igual
    if (a.status !== "pendente" && a.status !== "expirado") continue;
    const pessoaId = a.profile_id ?? a.mentorado_id;
    if (!pessoaNoRecorte(pessoaId, porPessoa, recorte, crons)) continue;
    out.push({
      nome: pessoaId ? (nomes.get(pessoaId) ?? "") : "",
      papel: a.profile_id
        ? papelLabel(papeis.get(a.profile_id) ?? null)
        : "Mentorado",
      documento: a.documento,
      status:
        a.status === "expirado" ||
        (a.token_expira_em != null && a.token_expira_em < alvo)
          ? "expirado"
          : "pendente",
      emitido_em: a.created_at,
      expira_em: a.token_expira_em ?? "",
    });
  }
  return out;
}

export async function dadosAssinaturasPendentes(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaAssinaturaPendente[]> {
  const [{ porPessoa, crons }, aRes, pRes, mRes] = await Promise.all([
    duplasMapaReal(supabase),
    supabase
      .from("assinaturas")
      .select(
        `profile_id, mentorado_id, status, token_expira_em, created_at,
         template:documento_templates(titulo)`
      ),
    supabase.from("profiles").select("id, nome, role"),
    supabase.from("mentorados").select("id, nome"),
  ]);
  if (aRes.error) throw aRes.error;
  if (pRes.error) throw pRes.error;
  if (mRes.error) throw mRes.error;
  const nomes = new Map(
    [...(pRes.data ?? []), ...(mRes.data ?? [])].map(
      (p) => [p.id, p.nome] as const
    )
  );
  const papeis = new Map(
    (pRes.data ?? []).map((p) => [p.id, p.role] as const)
  );
  const rows = (aRes.data ?? []).map((r) => {
    const tpl = norm(
      r.template as unknown as { titulo: string } | { titulo: string }[] | null
    );
    return {
      profile_id: r.profile_id,
      mentorado_id: r.mentorado_id,
      status: r.status as AssinaturaStatus,
      token_expira_em: r.token_expira_em,
      created_at: r.created_at,
      documento: tpl?.titulo ?? "",
    };
  });
  return linhasAssinaturasPendentes({
    rows,
    nomes,
    papeis,
    porPessoa,
    recorte,
    crons,
  });
}

export function dadosAssinaturasPendentesDemo(
  d: DemoData,
  recorte: RecorteCsv
): LinhaAssinaturaPendente[] {
  const mapas = demoMapas(d);
  const rows: RowAssinatura[] = d.assinaturas.map((a) => ({
    profile_id: a.profile_id,
    mentorado_id: a.mentorado_id,
    status: a.status,
    token_expira_em: a.token_expira_em,
    created_at: a.created_at,
    documento: a.template?.titulo ?? "",
  }));
  return linhasAssinaturasPendentes({
    rows,
    nomes: mapas.nomes,
    papeis: mapas.papeis,
    porPessoa: mapas.porPessoa,
    recorte,
    crons: mapas.crons,
  });
}

// =====================================================================
// tipo=interacoes — 1 linha/interação. A `nota` é texto livre da
// coordenação — a proteção anti-fórmula do celula() cobre =, +, -, @.
// =====================================================================

const INTERACAO_TIPO_LABEL: Record<InteracaoTipo, string> = {
  nudge: "lembrete",
  contato: "contato",
  apoio: "apoio",
  vinculo_resposta: "vínculo de resposta",
};
const INTERACAO_CANAL_LABEL: Record<InteracaoCanal, string> = {
  whatsapp: "WhatsApp",
  email: "e-mail",
  outro: "outro",
  in_app: "na plataforma",
};

type RowInteracao = {
  dupla_id: string;
  tipo: InteracaoTipo;
  canal: InteracaoCanal;
  nota: string | null;
  created_at: string;
  autor: string;
};

export function linhasInteracoes(
  rows: RowInteracao[],
  porId: Map<string, DuplaMapa>,
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): LinhaInteracao[] {
  const out: LinhaInteracao[] = [];
  for (const i of rows) {
    const d = porId.get(i.dupla_id);
    if (d && !duplaNoRecorte(d, recorte, crons)) continue;
    // interação órfã de dupla removida: sem recorte, a linha sai com dupla
    // vazia (fato histórico); com recorte ela não pertence a turma nenhuma
    if (!d && (recorte.turma || recorte.cronogramaId)) continue;
    out.push({
      dupla: duplaLabel(d),
      tipo: INTERACAO_TIPO_LABEL[i.tipo] ?? i.tipo,
      canal: INTERACAO_CANAL_LABEL[i.canal] ?? i.canal,
      autor: i.autor,
      data: i.created_at,
      nota: i.nota ?? "",
    });
  }
  return out;
}

export async function dadosInteracoes(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaInteracao[]> {
  const [{ porId, crons }, iRes] = await Promise.all([
    duplasMapaReal(supabase),
    supabase
      .from("interacoes")
      .select(
        `id, dupla_id, tipo, canal, nota, created_at,
         autor:profiles!interacoes_autor_id_fkey(nome)`
      )
      .order("created_at", { ascending: false }),
  ]);
  if (iRes.error) throw iRes.error;
  const rows = (iRes.data ?? []).map((r) => ({
    dupla_id: r.dupla_id,
    tipo: r.tipo as InteracaoTipo,
    canal: r.canal as InteracaoCanal,
    nota: r.nota,
    created_at: r.created_at,
    autor:
      norm(r.autor as unknown as { nome: string } | { nome: string }[] | null)
        ?.nome ?? "",
  }));
  return linhasInteracoes(rows, porId, recorte, crons);
}

export function dadosInteracoesDemo(
  d: DemoData,
  recorte: RecorteCsv
): LinhaInteracao[] {
  const mapas = demoMapas(d);
  const rows: RowInteracao[] = d.interacoes.map((i) => ({
    dupla_id: i.dupla_id,
    tipo: i.tipo,
    canal: i.canal,
    nota: null, // o dataset demo não carrega nota — a coluna sai vazia
    created_at: i.created_at,
    autor: i.autor?.nome ?? "",
  }));
  return linhasInteracoes(rows, mapas.porId, recorte, mapas.crons);
}

// =====================================================================
// tipo=solicitacoes — 1 linha/pedido de especialista, da view
// solicitacoes_mural (status_efetivo com a expiração lazy aplicada).
// =====================================================================

const SOLICITACAO_STATUS_LABEL: Record<SolicitacaoEspecialistaStatus, string> = {
  sugerida: "sugerida",
  aberta: "aberta",
  aguardando_coord: "aguardando coordenação",
  contra_proposta: "em negociação",
  aceita: "aceita",
  recusada: "recusada",
  cancelada: "cancelada",
  expirada: "expirada",
};
const SOLICITACAO_ORIGEM_LABEL: Record<string, string> = {
  staff: "equipe",
  jovem: "jovem",
  mentor: "mentor",
};

export function linhasSolicitacoes(
  rows: SolicitacaoEspecialista[],
  porId: Map<string, DuplaMapa>,
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): LinhaSolicitacao[] {
  const out: LinhaSolicitacao[] = [];
  for (const s of rows) {
    const d = s.dupla_dpp_id ? porId.get(s.dupla_dpp_id) : undefined;
    if (d) {
      if (!duplaNoRecorte(d, recorte, crons)) continue;
    } else if (recorte.turma || recorte.cronogramaId) {
      // pedido do jovem sem dupla DPP: a turma que a triagem carimbou no
      // pedido é a única régua disponível — cronograma não casa
      if (recorte.cronogramaId) continue;
      if (recorte.turma && s.turma !== recorte.turma) continue;
    }
    const efetivo = s.status_efetivo ?? s.status;
    out.push({
      mentorado: s.mentorado?.nome ?? "",
      demanda: s.demanda ?? s.motivo ?? "",
      origem: SOLICITACAO_ORIGEM_LABEL[s.origem] ?? s.origem,
      status: SOLICITACAO_STATUS_LABEL[efetivo] ?? efetivo,
      criada_em: s.created_at,
      respondida_em: s.respondida_em,
      latencia: s.respondida_em
        ? diffDias(
            s.respondida_em.slice(0, 10),
            s.created_at.slice(0, 10)
          )
        : null,
      especialista:
        s.especialista?.nome ?? s.desejado?.nome ?? "",
    });
  }
  return out;
}

export async function dadosSolicitacoes(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaSolicitacao[]> {
  const [{ porId, crons }, sRes] = await Promise.all([
    duplasMapaReal(supabase),
    supabase
      .from("solicitacoes_mural")
      .select(
        `id, mentorado_id, dupla_dpp_id, demanda, motivo, origem, turma,
         status, status_efetivo, created_at, respondida_em,
         mentorado_nome, especialista_nome`
      )
      .order("created_at", { ascending: false }),
  ]);
  if (sRes.error) throw sRes.error;
  const rows = (sRes.data ?? []).map((r) => ({
    ...(r as unknown as SolicitacaoEspecialista),
    mentorado: r.mentorado_nome ? { nome: r.mentorado_nome } : null,
    especialista: r.especialista_nome ? { nome: r.especialista_nome } : null,
  }));
  return linhasSolicitacoes(rows, porId, recorte, crons);
}

export function dadosSolicitacoesDemo(
  d: DemoData,
  recorte: RecorteCsv
): LinhaSolicitacao[] {
  const mapas = demoMapas(d);
  // comEfetivo: mesma expiração lazy do mural (status_efetivo só existe na
  // view — no dataset a coluna não vem preenchida)
  const rows = d.solicitacoes.map(comEfetivo);
  return linhasSolicitacoes(rows, mapas.porId, recorte, mapas.crons);
}

// =====================================================================
// tipo=encerramento — 1 linha/dupla com row de encerramentos.
// =====================================================================

const ENCERRAMENTO_TIPO_LABEL: Record<string, string> = {
  concluida: "concluída",
  encerrada: "encerrada",
  pendente: "pendente",
};

const CHECKLIST_CHAVES: (keyof EncerramentoChecklist)[] = [
  "feedback_final",
  "feedback_mutuo",
  "revisao_pdm",
  "avaliacao_360_enviada",
];

type RowEncerramento = {
  dupla_id: string;
  tipo: string;
  checklist: EncerramentoChecklist;
  resumo_jornada: string | null;
  created_at: string;
  decidido: string;
};

export function linhasEncerramento(
  rows: RowEncerramento[],
  porId: Map<string, DuplaMapa>,
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): LinhaEncerramento[] {
  const out: LinhaEncerramento[] = [];
  for (const e of rows) {
    const d = porId.get(e.dupla_id);
    if (d && !duplaNoRecorte(d, recorte, crons)) continue;
    if (!d && (recorte.turma || recorte.cronogramaId)) continue;
    const feitos = CHECKLIST_CHAVES.filter(
      (k) => e.checklist?.[k] === true
    ).length;
    out.push({
      mentor: d?.mentor?.nome ?? "",
      mentorado: d?.mentorado?.nome ?? "",
      tipo: ENCERRAMENTO_TIPO_LABEL[e.tipo] ?? e.tipo,
      checklist: `${feitos} de ${CHECKLIST_CHAVES.length}`,
      decidido_por: e.decidido,
      resumo_jornada: e.resumo_jornada ? "sim" : "não",
      created_at: e.created_at,
    });
  }
  return out;
}

export async function dadosEncerramento(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaEncerramento[]> {
  const [{ porId, crons }, eRes] = await Promise.all([
    duplasMapaReal(supabase),
    supabase
      .from("encerramentos")
      .select(
        `id, dupla_id, tipo, checklist, resumo_jornada, created_at,
         decidido:profiles!encerramentos_decidido_por_fkey(nome)`
      ),
  ]);
  if (eRes.error) throw eRes.error;
  const rows = (eRes.data ?? []).map((r) => ({
    dupla_id: r.dupla_id,
    tipo: r.tipo,
    checklist: (r.checklist ?? {}) as EncerramentoChecklist,
    resumo_jornada: r.resumo_jornada,
    created_at: r.created_at,
    decidido:
      norm(
        r.decidido as unknown as { nome: string } | { nome: string }[] | null
      )?.nome ?? "",
  }));
  return linhasEncerramento(rows, porId, recorte, crons);
}

export function dadosEncerramentoDemo(
  d: DemoData,
  recorte: RecorteCsv,
  encerramentos: Encerramento[]
): LinhaEncerramento[] {
  const mapas = demoMapas(d);
  const rows: RowEncerramento[] = encerramentos.map((e) => ({
    dupla_id: e.dupla_id,
    tipo: e.tipo,
    checklist: e.checklist,
    resumo_jornada: e.resumo_jornada,
    created_at: e.created_at,
    decidido: e.decidido?.nome ?? "",
  }));
  return linhasEncerramento(rows, mapas.porId, recorte, mapas.crons);
}

// =====================================================================
// tipo=forms-taxa — 1 linha/link de formulário. multi_uso conta N
// respostas; link não respondido sai com respondido=não — a taxa é
// derivável do par (respondido, respostas).
// =====================================================================

const FORMS_ORIGEM_LABEL: Record<string, string> = {
  manual: "manual",
  intake: "divulgação",
};

type RowFormsTaxa = {
  formulario_id: string;
  dest_profile_id: string | null;
  dest_mentorado_id: string | null;
  dupla_id: string | null;
  usado_em: string | null;
  multi_uso: boolean;
  origem: string;
  created_at: string;
  respondido_em: string[]; // datas das respostas do link
};

export function linhasFormsTaxa({
  rows,
  titulos,
  nomes,
  papeis,
  porId,
  porPessoa,
  recorte,
  crons,
}: {
  rows: RowFormsTaxa[];
  titulos: Map<string, string>;
  nomes: Map<string, string>;
  papeis: Map<string, string | null>;
  porId: Map<string, DuplaMapa>;
  porPessoa: Map<string, DuplaMapa[]>;
  recorte: RecorteCsv;
  crons: readonly Pick<Cronograma, "id" | "turma">[];
}): LinhaFormsTaxa[] {
  const out: LinhaFormsTaxa[] = [];
  for (const l of rows) {
    const d = l.dupla_id ? porId.get(l.dupla_id) : undefined;
    if (d) {
      if (!duplaNoRecorte(d, recorte, crons)) continue;
    } else if (recorte.turma || recorte.cronogramaId) {
      // link sem dupla: o recorte tenta o destinatário; link genérico de
      // intake não pertence a turma nenhuma
      const dest = l.dest_profile_id ?? l.dest_mentorado_id;
      if (!pessoaNoRecorte(dest, porPessoa, recorte, crons)) continue;
    }
    const n = l.respondido_em.length;
    const respondido = l.multi_uso ? n > 0 : l.usado_em != null;
    const p = l.dest_profile_id;
    out.push({
      formulario: titulos.get(l.formulario_id) ?? "",
      destinatario: p
        ? (nomes.get(p) ?? "")
        : l.dest_mentorado_id
          ? (nomes.get(l.dest_mentorado_id) ?? "")
          : "Link genérico",
      papel: p
        ? papelLabel(papeis.get(p) ?? null)
        : l.dest_mentorado_id
          ? "Mentorado"
          : "",
      dupla: duplaLabel(d),
      origem: FORMS_ORIGEM_LABEL[l.origem] ?? l.origem,
      emitido_em: l.created_at,
      respondido: respondido ? "sim" : "não",
      respostas: n,
      // multi_uso: a data exibida é a resposta mais recente
      respondido_em: l.multi_uso
        ? (l.respondido_em.sort().at(-1) ?? null)
        : l.usado_em,
    });
  }
  return out;
}

export async function dadosFormsTaxa(
  supabase: Supa,
  recorte: RecorteCsv
): Promise<LinhaFormsTaxa[]> {
  const [{ porId, porPessoa, crons }, lRes, fRes, pRes, mRes] =
    await Promise.all([
      duplasMapaReal(supabase),
      supabase
        .from("formulario_links")
        .select(
          `id, formulario_id, dest_profile_id, dest_mentorado_id, dupla_id,
           usado_em, multi_uso, origem, created_at,
           resposta:formulario_respostas(respondido_em)`
        )
        .order("created_at", { ascending: false }),
      supabase.from("formularios").select("id, titulo"),
      supabase.from("profiles").select("id, nome, role"),
      supabase.from("mentorados").select("id, nome"),
    ]);
  if (lRes.error) throw lRes.error;
  if (fRes.error) throw fRes.error;
  if (pRes.error) throw pRes.error;
  if (mRes.error) throw mRes.error;
  const nomes = new Map(
    [...(pRes.data ?? []), ...(mRes.data ?? [])].map(
      (p) => [p.id, p.nome] as const
    )
  );
  const papeis = new Map(
    (pRes.data ?? []).map((p) => [p.id, p.role] as const)
  );
  const titulos = new Map(
    (fRes.data ?? []).map((f) => [f.id, f.titulo] as const)
  );
  const rows: RowFormsTaxa[] = (lRes.data ?? []).map((l) => {
    const resps = (l.resposta ?? []) as { respondido_em: string }[];
    return {
      formulario_id: l.formulario_id,
      dest_profile_id: l.dest_profile_id,
      dest_mentorado_id: l.dest_mentorado_id,
      dupla_id: l.dupla_id,
      usado_em: l.usado_em,
      multi_uso: l.multi_uso === true,
      origem: l.origem ?? "manual",
      created_at: l.created_at,
      respondido_em: resps.map((r) => r.respondido_em),
    };
  });
  return linhasFormsTaxa({
    rows,
    titulos,
    nomes,
    papeis,
    porId,
    porPessoa,
    recorte,
    crons,
  });
}

export function dadosFormsTaxaDemo(
  d: DemoData,
  recorte: RecorteCsv
): LinhaFormsTaxa[] {
  const mapas = demoMapas(d);
  const { formularios, links, respostas } = getDemoFormularios();
  const titulos = new Map(formularios.map((f) => [f.id, f.titulo] as const));
  const rows: RowFormsTaxa[] = links.map((l) => ({
    formulario_id: l.formulario_id,
    dest_profile_id: l.dest_profile_id,
    dest_mentorado_id: l.dest_mentorado_id,
    dupla_id: l.dupla_id,
    usado_em: l.usado_em,
    multi_uso: l.multi_uso === true,
    origem: l.origem ?? "manual",
    created_at: l.created_at,
    respondido_em: respostas
      .filter((r) => r.link_id === l.id)
      .map((r) => r.respondido_em),
  }));
  return linhasFormsTaxa({
    rows,
    titulos,
    nomes: mapas.nomes,
    papeis: mapas.papeis,
    porId: mapas.porId,
    porPessoa: mapas.porPessoa,
    recorte,
    crons: mapas.crons,
  });
}

// =====================================================================
// Tendência do semáforo — agregação diária dos snapshots (REALIZA-182)
// pra a aba Saúde do hub. Não é um tipo de export: é a leitura do
// histórico gravado pelo job, sem recálculo.
// =====================================================================

export type DiaSaude = {
  dia: string;
  risco: number;
  atencao: number;
  ok: number;
};

export async function dadosTendenciaSaude(
  supabase: Supa,
  recorte: RecorteCsv,
  dias = 30,
  hoje = new Date()
): Promise<DiaSaude[]> {
  const desde = new Date(hoje.getTime() - dias * 86400000)
    .toISOString()
    .slice(0, 10);
  const [sRes, { porId, crons }] = await Promise.all([
    supabase
      .from("dupla_saude_snapshots")
      .select("dia, dupla_id, semaforo")
      .gte("dia", desde)
      .order("dia"),
    duplasMapaReal(supabase),
  ]);
  if (sRes.error) throw sRes.error;
  const porDia = new Map<string, DiaSaude>();
  for (const s of sRes.data ?? []) {
    const d = porId.get(s.dupla_id);
    // snapshot de dupla fora do recorte não entra; dupla removida some —
    // histórico de quem saiu não distorce a leitura da turma atual
    if (!d || !duplaNoRecorte(d, recorte, crons)) continue;
    const cur = porDia.get(s.dia) ?? {
      dia: s.dia,
      risco: 0,
      atencao: 0,
      ok: 0,
    };
    if (s.semaforo === "risco") cur.risco++;
    else if (s.semaforo === "atencao") cur.atencao++;
    else cur.ok++;
    porDia.set(s.dia, cur);
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

// ---------- mapas demo compartilhados ----------

/** Espelho do duplasMapaReal sobre o dataset demo — os mesmos mapas (por
 *  id, por pessoa, turma, nomes, papéis) pros fetchers demo. */
function demoMapas(d: DemoData) {
  const lista: DuplaMapa[] = d.duplas.map((x) => ({
    id: x.id,
    turma: x.turma,
    cronograma_id: x.cronograma_id,
    mentor_id: x.mentor?.id ?? null,
    mentorado_id: x.mentorado?.id ?? null,
    mentor: x.mentor ? { nome: x.mentor.nome } : null,
    mentorado: x.mentorado ? { nome: x.mentorado.nome } : null,
  }));
  const nomes = new Map(
    [...d.profiles, ...d.mentorados].map((p) => [p.id, p.nome] as const)
  );
  const papeis = new Map(d.profiles.map((p) => [p.id, p.role] as const));
  return {
    porId: new Map(lista.map((x) => [x.id, x])),
    porPessoa: duplasPorPessoa(lista),
    crons: d.cronogramas.map((c) => ({ id: c.id, turma: c.turma })),
    nomes,
    papeis,
  };
}
