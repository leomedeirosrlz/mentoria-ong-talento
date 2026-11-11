import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoPessoalMap } from "@/lib/demo/queries";
import { getDemoFormularios } from "@/lib/demo/forms-data";
import {
  camposPerguntas,
  respostaFormatada,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { normaliza } from "@/lib/utils";
import { turmaDaDupla } from "@/lib/turma";
import {
  ATIVIDADES_ENCONTRO,
  AVALIACAO_LABEL,
  celulasDe,
  COR_RACA_LABELS,
  DIAS_SEMANA_CURTOS,
  GENERO_LABELS,
  papelLabel,
  PERIODOS_LABELS,
  PREF_GENERO_LABELS,
  toDateStr,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import type { DadosPessoais } from "@/lib/queries";
import { temPapel } from "@/lib/types";
import type {
  AppRole,
  CicloEvento,
  Cronograma,
  Disponibilidade,
  Dupla,
  EncontroStatus,
  Mentorado,
  MentorProfile,
  PrefGeneroPar,
  Presenca,
  Profile,
} from "@/lib/types";

// GET /api/export — só pra coordenação. Catálogo (REALIZA-68):
//   ciclo (default) — uma linha por encontro, a prestação de contas;
//                     `encontros` é alias puro (mesmo CSV, mesmo nome);
//   atividades      — uma linha por atividade registrada (catálogo + "outro");
//   matching        — o universo do board de pareamento com em_dupla marcado;
//   presencas       — uma linha por chamada marcada em evento de formação;
//   pessoas         — cadastro completo (equipe + mentorados);
//   assinaturas     — backup dos contratos;
//   respostas       — respostas de um formulário (?id=<uuid>).
// ?turma=/?cronograma= recortam ciclo/atividades/presencas; no matching o
// ?turma= filtra por inscrição na fila da turma (turma_inscricoes).
export async function GET(request: NextRequest) {
  let tipo = request.nextUrl.searchParams.get("tipo");
  // alias de nomenclatura: a prestação de contas já sai uma linha por
  // encontro — normaliza antes dos dois ramos pra resposta byte a byte igual
  if (tipo === "encontros") tipo = "ciclo";

  // modo demo: sem sessão nem banco — os mesmos CSVs saem do dataset em
  // memória, com a mesma regra de papel (export é só da coordenação)
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") {
      return NextResponse.json(
        { error: "Só a coordenação pode exportar o relatório do programa." },
        { status: 403 }
      );
    }
    const d = getDemoData();
    if (tipo === "assinaturas") {
      const nomes = new Map(
        [...d.profiles, ...d.mentorados].map((p) => [p.id, p.nome] as const)
      );
      const papeis = new Map(d.profiles.map((p) => [p.id, p.role] as const));
      return csvResponse(
        csvAssinaturas(d.assinaturas, nomes, papeis, request.nextUrl.origin),
        nomeCsvAssinaturas()
      );
    }
    if (tipo === "pessoas") {
      // no dataset demo contato e capacidade já moram nas próprias linhas; os
      // sensíveis passam pelo mesmo funil coord-only da real (demoPessoalMap
      // replica o WHERE das views *_pessoal)
      const contatos = new Map(
        d.profiles.map(
          (p) => [p.id, { email: p.email, whatsapp: p.whatsapp }] as const
        )
      );
      const capacidades = new Map(
        d.mentorProfiles.map((m) => [m.profile_id, m.capacidade] as const)
      );
      const capacidadesEsp = new Map(
        d.mentorProfiles.map(
          // repasse cru, como a real: a coluna é not null default 1 (0073),
          // então quem tem linha sempre carrega valor — e quem não tem
          // linha exporta "" pelo ?? "" de csvPessoas nos dois caminhos
          (m) => [m.profile_id, m.capacidade_especialista ?? null] as const
        )
      );
      // papéis efetivos: o híbrido do dataset chega com as duas linhas —
      // sem isso a coluna de capacidade dele exportava só a pool primária.
      // Normalização idem comPapeis da real (só o que o embed traz; sem
      // linha em profile_papeis sai [] — o temPapel cai no role sozinho)
      const papeisDemo = new Map<string, AppRole[]>();
      for (const pp of d.profilePapeis) {
        papeisDemo.set(pp.profile_id, [...(papeisDemo.get(pp.profile_id) ?? []), pp.papel]);
      }
      return csvResponse(
        csvPessoas(
          d.profiles.map((p) => ({
            ...p,
            papeis: papeisDemo.get(p.id) ?? [],
          })),
          contatos,
          d.mentorados,
          capacidades,
          capacidadesEsp,
          demoPessoalMap(demo, "profiles_pessoal"),
          demoPessoalMap(demo, "mentorados_pessoal")
        ),
        nomeCsvPessoas()
      );
    }
    if (tipo === "respostas") {
      return exportRespostasDemo(
        request.nextUrl.searchParams.get("id"),
        d
      );
    }
    if (tipo === "atividades") {
      return csvResponse(
        csvAtividades(
          filtraCsvCiclo(
            d.duplas,
            request.nextUrl.searchParams,
            d.cronogramas
          ),
          d.cronogramas
        ),
        nomeCsvAtividades()
      );
    }
    if (tipo === "matching") {
      return exportMatchingDemo(d, request.nextUrl.searchParams);
    }
    if (tipo === "presencas") {
      return exportPresencasDemo(d, request.nextUrl.searchParams);
    }
    const cronDemo = new Map(d.cronogramas.map((c) => [c.id, c.nome]));
    return csvResponse(
      csvCiclo(
        filtraCsvCiclo(
          d.duplas,
          request.nextUrl.searchParams,
          d.cronogramas
        ),
        cronDemo
      ),
      nomeCsvCiclo()
    );
  }

  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre de novo." },
      { status: 401 }
    );
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", sub)
    .maybeSingle();
  if (me?.role !== "coordenacao") {
    return NextResponse.json(
      { error: "Só a coordenação pode exportar o relatório do programa." },
      { status: 403 }
    );
  }

  if (tipo === "assinaturas") {
    return exportAssinaturas(
      supabase,
      request.nextUrl.searchParams,
      request.nextUrl.origin
    );
  }

  if (tipo === "pessoas") {
    return exportPessoas(supabase);
  }

  if (tipo === "respostas") {
    return exportRespostas(supabase, request.nextUrl.searchParams.get("id"));
  }

  if (tipo === "atividades") {
    return exportAtividades(supabase, request.nextUrl.searchParams);
  }

  if (tipo === "matching") {
    return exportMatching(supabase, request.nextUrl.searchParams);
  }

  if (tipo === "presencas") {
    return exportPresencas(supabase, request.nextUrl.searchParams);
  }

  const { data, error } = await supabase
    .from("duplas")
    .select(
      `trilha, turma, cronograma_id,
      mentor:profiles!duplas_mentor_id_fkey(nome),
      mentorado:mentorados(nome),
      supervisor:profiles!duplas_supervisor_id_fkey(nome),
      encontros(*, registro:registros(*))`
    );
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }
  const { data: crons } = await supabase
    .from("cronogramas")
    .select("id, nome, turma");
  const cronogramas = new Map(
    (crons ?? []).map((c) => [c.id, c.nome] as const)
  );
  const duplas = filtraCsvCiclo(
    (data as unknown as Dupla[]) ?? [],
    request.nextUrl.searchParams,
    crons ?? []
  );

  return csvResponse(csvCiclo(duplas, cronogramas), nomeCsvCiclo());
}

/** ?turma= e ?cronograma= recortam a prestação de contas — com turmas em
 *  paralelo, o relatório misto pode servir de recibo por turma. O label
 *  casa pelo rótulo vivo (`turmaDaDupla`), não pelo selo da dupla. */
function filtraCsvCiclo(
  duplas: Dupla[],
  p: URLSearchParams,
  crons: { id: string; nome: string; turma: string }[]
): Dupla[] {
  const turma = p.get("turma")?.trim();
  const cronograma = p.get("cronograma")?.trim();
  return duplas.filter(
    (d) =>
      (!turma || turmaDaDupla(d, crons) === turma) &&
      (!cronograma || d.cronograma_id === cronograma)
  );
}

// tipo=pessoas — cadastro único: equipe (papel, status) + mentorados (ONG de
// origem), com os 4 sensíveis da 0034. Ordenado por nome; mesmo formato
// `;`+BOM do relatório do ciclo.
async function exportPessoas(supabase: Awaited<ReturnType<typeof createClient>>) {
  // email/whatsapp saíram do grant de coluna de profiles (0026) — a view
  // profiles_contato devolve todas as linhas pra coordenação (única que
  // passa na checagem acima) e o merge é por id. data_nascimento/genero/
  // pref_genero_par/motivacao são revogados do grant de coluna das tabelas
  // base — só entram pelas views *_pessoal, que têm `my_role()='coordenacao'`
  // no WHERE (pra qualquer outro papel devolvem zero linhas)
  const [
    { data: pessoas, error: eP },
    { data: contatos, error: eC },
    { data: mentorados, error: eM },
    { data: mps, error: eMP },
    { data: pessoalP, error: ePP },
    { data: pessoalM, error: ePM },
  ] = await Promise.all([
    supabase.from("profiles").select("id,nome,role,ativo,profile_papeis(papel)"),
    supabase.from("profiles_contato").select("id,email,whatsapp"),
    supabase
      .from("mentorados")
      .select("id,nome,email,whatsapp,ong_origem,situacao,saiu_em,motivo_saida,profile_id"),
    supabase
      .from("mentor_profiles")
      .select("profile_id,capacidade,capacidade_especialista"),
    supabase
      .from("profiles_pessoal")
      .select("id,data_nascimento,genero,cor_raca,pref_genero_par,motivacao"),
    supabase
      .from("mentorados_pessoal")
      .select("id,data_nascimento,genero,cor_raca,pref_genero_par,motivacao"),
  ]);
  if (eP || eC || eM || eMP || ePP || ePM) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }
  const capacidades = new Map((mps ?? []).map((m) => [m.profile_id, m.capacidade]));
  const capacidadesEsp = new Map(
    (mps ?? []).map((m) => [m.profile_id, m.capacidade_especialista])
  );
  const contatoPorId = new Map((contatos ?? []).map((c) => [c.id, c]));
  const pessoalPorId = new Map(
    (pessoalP ?? []).map((p) => [p.id, { responsavel: null, ...p }])
  );
  const pessoalMentoradoPorId = new Map((pessoalM ?? []).map((m) => [m.id, m]));
  // conta de jovem já sai pela ficha — exportar o profile duplicaria a linha
  const vinculados = new Set(
    (mentorados ?? []).map((m) => m.profile_id).filter(Boolean)
  );

  return csvResponse(
    csvPessoas(
      ((pessoas ?? []) as (Pick<Profile, "id" | "nome" | "role" | "ativo"> & {
        profile_papeis?: { papel: AppRole }[];
      })[])
        .filter((p) => !(p.role === "mentorado" && vinculados.has(p.id)))
        .map((p) => {
        const { profile_papeis, ...rest } = p;
        return {
          ...rest,
          papeis: (profile_papeis ?? []).map((r) => r.papel),
        };
      }),
      contatoPorId,
      mentorados ?? [],
      capacidades,
      capacidadesEsp,
      pessoalPorId,
      pessoalMentoradoPorId
    ),
    nomeCsvPessoas()
  );
}

// tipo=atividades — uma linha por atividade registrada. O "outro" livre já
// mora dentro de registros.atividades[] (o form o empurra, actions.ts) —
// não existe coluna atividade_outro; a origem se deduz pelo catálogo
// (ATIVIDADES_ENCONTRO). ?turma=/?cronograma= filtram a dupla antes de
// explodir, mesma régua do ciclo.
async function exportAtividades(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams
) {
  const [{ data, error }, { data: crons }] = await Promise.all([
    supabase
      .from("duplas")
      .select(
        `trilha, turma, cronograma_id,
        mentor:profiles!duplas_mentor_id_fkey(nome),
        mentorado:mentorados(nome),
        encontros(numero, realizado_em, status,
          registro:registros(atividades, avaliacao, created_at))`
      ),
    supabase.from("cronogramas").select("id, nome, turma"),
  ]);
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }
  const duplas = filtraCsvCiclo(
    (data as unknown as Dupla[]) ?? [],
    params,
    crons ?? []
  );
  return csvResponse(csvAtividades(duplas, crons ?? []), nomeCsvAtividades());
}

// tipo=matching — o universo inteiro de pareamento (spec REALIZA-68):
// mentores por papel EFETIVO (união role ∪ profile_papeis — a régua do
// tipoPessoa/temPapel, não dá pra pedir no PostgREST) + mentorados ativos.
// em_dupla marca quem já pareia; o recorte "livre" é do leitor da planilha.
// Sensíveis (pref_genero_par/motivacao) e contato seguem o mesmo funil
// coord-only do exportPessoas; form_bruto/dados_civis nunca entram.
async function exportMatching(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams
) {
  const [
    { data: pessoas, error: eP },
    { data: contatos, error: eC },
    { data: mentorados, error: eM },
    { data: mps, error: eMP },
    { data: pessoalP, error: ePP },
    { data: pessoalM, error: ePM },
    { data: fila, error: eF },
    { data: duplas, error: eD },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,nome,role,ativo,cidade,uf,profile_papeis(papel)")
      .eq("ativo", true),
    supabase.from("profiles_contato").select("id,email,whatsapp"),
    supabase
      .from("mentorados")
      .select("id,nome,email,whatsapp,cidade,uf,disponibilidade,situacao")
      .eq("situacao", "ativo"),
    supabase
      .from("mentor_profiles")
      .select("profile_id,capacidade,capacidade_especialista,experiencia_previa,formacao_externa,disponibilidade"),
    supabase.from("profiles_pessoal").select("id,pref_genero_par,motivacao"),
    supabase.from("mentorados_pessoal").select("id,pref_genero_par,motivacao"),
    supabase
      .from("turma_inscricoes")
      .select("profile_id,mentorado_id,turma")
      .eq("status", "aguardando"),
    supabase.from("duplas").select("mentor_id,mentorado_id").eq("status", "ativa"),
  ]);
  if (eP || eC || eM || eMP || ePP || ePM || eF || eD) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }

  return csvResponse(
    csvMatching(
      linhasMatching({
        pessoas: (
          (pessoas ?? []) as unknown as (PessoaMatching & {
            profile_papeis?: { papel: AppRole }[];
          })[]
        ).map((p) => {
          const { profile_papeis, ...rest } = p;
          return {
            ...rest,
            papeis: (profile_papeis ?? []).map((r) => r.papel),
          };
        }),
        contatos: new Map((contatos ?? []).map((c) => [c.id, c] as const)),
        mentorados: (mentorados ?? []) as MentoradoMatching[],
        mps: new Map((mps ?? []).map((m) => [m.profile_id, m] as const)),
        pessoalP: new Map((pessoalP ?? []).map((p) => [p.id, p] as const)),
        pessoalM: new Map((pessoalM ?? []).map((m) => [m.id, m] as const)),
        filaPorPessoa: filaMatchingPorPessoa(
          (fila ?? []) as TurmaInscricaoFila[]
        ),
        emDuplaP: new Set((duplas ?? []).map((d) => d.mentor_id)),
        emDuplaM: new Set((duplas ?? []).map((d) => d.mentorado_id)),
        turma: params.get("turma")?.trim() || undefined,
      })
    ),
    nomeCsvMatching()
  );
}

// tipo=presencas — a chamada dos eventos de formação (0040): uma linha por
// (evento, profile marcado). Sem row em presencas = "não marcado", nunca
// "faltou" — não se sintetiza ausência. ciclo_eventos não carrega turma:
// ?turma= resolve pelo cronograma dono do evento (mesmo mapa do ciclo).
async function exportPresencas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams
) {
  const [
    { data: eventos, error: eE },
    { data: crons, error: eC },
    { data: pessoas, error: eP },
    { data: mps, error: eMP },
  ] = await Promise.all([
    supabase
      .from("ciclo_eventos")
      .select(
        "id,titulo,data,cronograma_id,presencas(profile_id,presente,marcado_em)"
      )
      .eq("tipo", "formacao")
      .order("data"),
    supabase.from("cronogramas").select("id,nome,turma"),
    supabase.from("profiles").select("id,nome,role"),
    supabase.from("mentor_profiles").select("profile_id,formacao_ok"),
  ]);
  if (eE || eC || eP || eMP) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }
  const pessoasPorId = new Map(
    (pessoas ?? []).map((p) => [p.id, p] as const)
  );
  const formacaoOk = new Map(
    (mps ?? []).map((m) => [m.profile_id, m.formacao_ok] as const)
  );
  const linhas = linhasPresencas(
    filtraEventosFormacao(
      (eventos ?? []) as EventoChamada[],
      params,
      crons ?? []
    ),
    pessoasPorId,
    formacaoOk,
    crons ?? []
  );
  return csvResponse(csvPresencas(linhas), nomeCsvPresencas());
}

/** Versão demo do matching — mesmos merges da query real sobre o dataset:
 *  contato já mora na linha do profile, os sensíveis passam pelo funil
 *  coord-only de demoPessoalMap e a fila vem de turmaInscricoes. */
function exportMatchingDemo(
  d: ReturnType<typeof getDemoData>,
  params: URLSearchParams
) {
  const papeisDemo = new Map<string, AppRole[]>();
  for (const pp of d.profilePapeis) {
    papeisDemo.set(pp.profile_id, [
      ...(papeisDemo.get(pp.profile_id) ?? []),
      pp.papel,
    ]);
  }
  const ativas = d.duplas.filter((x) => x.status === "ativa");
  return csvResponse(
    csvMatching(
      linhasMatching({
        pessoas: d.profiles.map((p) => ({
          ...p,
          papeis: papeisDemo.get(p.id) ?? [],
        })),
        contatos: new Map(
          d.profiles.map(
            (p) => [p.id, { email: p.email, whatsapp: p.whatsapp }] as const
          )
        ),
        mentorados: d.mentorados,
        mps: new Map(d.mentorProfiles.map((m) => [m.profile_id, m] as const)),
        pessoalP: demoPessoalMap("coordenacao", "profiles_pessoal"),
        pessoalM: demoPessoalMap("coordenacao", "mentorados_pessoal"),
        filaPorPessoa: filaMatchingPorPessoa(d.turmaInscricoes),
        emDuplaP: new Set(ativas.map((x) => x.mentor.id)),
        emDuplaM: new Set(ativas.map((x) => x.mentorado.id)),
        turma: params.get("turma")?.trim() || undefined,
      })
    ),
    nomeCsvMatching()
  );
}

/** Versão demo da chamada — as presencas do dataset agrupam por evento e
 *  o resto do merge (nomes, formacao_ok, turma via cronograma) é o mesmo. */
function exportPresencasDemo(
  d: ReturnType<typeof getDemoData>,
  params: URLSearchParams
) {
  const porEvento = new Map<string, Presenca[]>();
  for (const p of d.presencas) {
    const l = porEvento.get(p.ciclo_evento_id) ?? [];
    l.push(p);
    porEvento.set(p.ciclo_evento_id, l);
  }
  const eventos: EventoChamada[] = d.cicloEventos
    .filter((e) => e.tipo === "formacao")
    .map((e) => ({ ...e, presencas: porEvento.get(e.id) ?? [] }));
  const linhas = linhasPresencas(
    filtraEventosFormacao(eventos, params, d.cronogramas),
    new Map(
      d.profiles.map((p) => [p.id, { nome: p.nome, role: p.role }] as const)
    ),
    new Map(d.mentorProfiles.map((m) => [m.profile_id, m.formacao_ok] as const)),
    d.cronogramas
  );
  return csvResponse(csvPresencas(linhas), nomeCsvPresencas());
}

// tipo=assinaturas — backup dos contratos: quem assinou o quê, quando, com
// as evidências (IP/UA/hash) e o snapshot dos dados civis que constam no
// documento. O PDF em si é renderizado sob demanda do snapshot, então este
// CSV + a tabela são o backup completo.
async function exportAssinaturas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams,
  origin: string
) {
  const status = params.get("status");
  const documento = params.get("documento");
  // !inner quando filtra por slug — sem ele o embed viria mas não filtraria
  const embed = documento
    ? "template:documento_templates!inner(titulo, slug, versao)"
    : "template:documento_templates(titulo, slug, versao)";
  let q = supabase
    .from("assinaturas")
    .select(
      `id, profile_id, mentorado_id, status, dados_snapshot,
      assinatura_texto, assinado_em, ip, user_agent, hash_documento,
      token_expira_em, created_at, created_by, ${embed}`
    )
    .order("created_at");
  if (status) q = q.eq("status", status);
  if (documento) q = q.eq("template.slug", documento);
  const [
    { data: rows, error: eA },
    { data: pessoas, error: eP },
    { data: jovens, error: eM },
  ] = await Promise.all([
    q,
    supabase.from("profiles").select("id, nome, role"),
    supabase.from("mentorados").select("id, nome"),
  ]);
  if (eA || eP || eM) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório. Tente de novo." },
      { status: 500 }
    );
  }
  const nomes = new Map(
    [...(pessoas ?? []), ...(jovens ?? [])].map((p) => [p.id, p.nome] as const)
  );
  const papeis = new Map(
    (pessoas ?? []).map((p) => [p.id, p.role] as const)
  );
  return csvResponse(
    csvAssinaturas(rows ?? [], nomes, papeis, origin),
    nomeCsvAssinaturas()
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// embed to-one pode vir array no client não-tipado — mesma norm() de
// forms/queries.ts
const norm = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

/** Linha pronta pro CSV de respostas — destino/papel/dupla já resolvidos
 *  (real e demo convergem pra este shape antes de csvRespostas). */
type LinhaRespostaCsv = {
  destinatario: string;
  tipo: string;
  dupla: string;
  /** ISO — sai dd/mm/aaaa hh:mm via dataHora() na montagem */
  respondido_em: string;
  respostas: Record<string, RespostaValor>;
};

const respJson = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

// tipo=respostas — backup das respostas de um formulário: uma linha por
// link respondido, uma coluna por pergunta (o label vira header). O embed
// é o mesmo da ficha (forms/queries.ts), repetido porque a leitura dela é
// cache() de RSC — route handler fica autocontido como os outros exports.
async function exportRespostas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null
) {
  if (!id || !UUID_RE.test(id))
    return respJson(400, "Informe o formulário a exportar (?id=<uuid>).");

  const { data: f, error: eF } = await supabase
    .from("formularios")
    .select("id, titulo, campos")
    .eq("id", id)
    .maybeSingle();
  if (eF) return respJson(500, "Não foi possível gerar o relatório. Tente de novo.");
  if (!f) return respJson(404, "Formulário não encontrado.");

  const { data: links, error: eL } = await supabase
    .from("formulario_links")
    .select(
      `id,
      resposta:formulario_respostas(respostas, respondido_em),
      dest_profile:profiles!formulario_links_dest_profile_id_fkey(nome, role),
      dest_mentorado:mentorados!formulario_links_dest_mentorado_id_fkey(nome),
      dupla:duplas!formulario_links_dupla_id_fkey(
        mentor:profiles!duplas_mentor_id_fkey(nome),
        mentorado:mentorados!duplas_mentorado_id_fkey(nome)
      )`
    )
    .eq("formulario_id", id);
  if (eL) return respJson(500, "Não foi possível gerar o relatório. Tente de novo.");

  type LinkRaw = {
    resposta:
      | { respostas: Record<string, RespostaValor>; respondido_em: string }
      | { respostas: Record<string, RespostaValor>; respondido_em: string }[]
      | null;
    dest_profile:
      | { nome: string; role: string | null }
      | { nome: string; role: string | null }[]
      | null;
    dest_mentorado: { nome: string } | { nome: string }[] | null;
    dupla:
      | {
          mentor: { nome: string } | { nome: string }[] | null;
          mentorado: { nome: string } | { nome: string }[] | null;
        }
      | {
          mentor: { nome: string } | { nome: string }[] | null;
          mentorado: { nome: string } | { nome: string }[] | null;
        }[]
      | null;
  };

  const linhas = ((links ?? []) as unknown as LinkRaw[]).flatMap(
    (l): LinhaRespostaCsv[] => {
      // link de intake (multi_uso) carrega TODAS as respostas — uma linha
      // por inscrição, não por link
      const todas = Array.isArray(l.resposta)
        ? l.resposta
        : l.resposta
          ? [l.resposta]
          : [];
      if (!todas.length) return [];
      const p = norm(l.dest_profile);
      const m = norm(l.dest_mentorado);
      const dupla = norm(l.dupla);
      return todas.map((r) => ({
        // no link anônimo a identidade vem do conteúdo da resposta
        destinatario:
          p?.nome ??
          m?.nome ??
          (typeof r.respostas?.nome_civil === "string"
            ? (r.respostas.nome_civil as string)
            : "Link genérico"),
        tipo: p ? papelLabel(p.role) : m ? "Mentorado" : "Link genérico",
        dupla: dupla
          ? `${norm(dupla.mentor)?.nome ?? ""} ↔ ${norm(dupla.mentorado)?.nome ?? ""}`
          : "",
        respondido_em: r.respondido_em,
        respostas: r.respostas ?? {},
      }));
    }
  );

  const campos = (f.campos as unknown as FormularioCampo[]) ?? [];
  return csvResponse(csvRespostas(campos, linhas), nomeCsvRespostas(f.titulo));
}

/** Versão demo do export de respostas — resolve nomes/dupla no dataset em
 *  memória (as policies das tabelas são coord-only, idem a real). */
function exportRespostasDemo(
  id: string | null,
  d: ReturnType<typeof getDemoData>
) {
  if (!id || !UUID_RE.test(id))
    return respJson(400, "Informe o formulário a exportar (?id=<uuid>).");
  const { formularios, links, respostas } = getDemoFormularios();
  const f = formularios.find((x) => x.id === id);
  if (!f) return respJson(404, "Formulário não encontrado.");

  const linhas: LinhaRespostaCsv[] = [];
  for (const l of links) {
    if (l.formulario_id !== f.id) continue;
    // multi_uso (intake): TODAS as respostas do link viram linha — a
    // identidade sai do conteúdo (nome_civil), igual à query real
    const doLink = respostas.filter((x) => x.link_id === l.id);
    if (!doLink.length) continue;
    const p = l.dest_profile_id
      ? d.profiles.find((x) => x.id === l.dest_profile_id)
      : null;
    const m = l.dest_mentorado_id
      ? d.mentorados.find((x) => x.id === l.dest_mentorado_id)
      : null;
    const dupla = l.dupla_id
      ? d.duplas.find((x) => x.id === l.dupla_id)
      : null;
    for (const r of doLink) {
      linhas.push({
        destinatario:
          p?.nome ??
          m?.nome ??
          (typeof r.respostas.nome_civil === "string"
            ? r.respostas.nome_civil
            : "Link genérico"),
        tipo: p ? papelLabel(p.role) : m ? "Mentorado" : "Link genérico",
        dupla: dupla
          ? `${dupla.mentor?.nome ?? ""} ↔ ${dupla.mentorado?.nome ?? ""}`
          : "",
        respondido_em: r.respondido_em,
        respostas: r.respostas,
      });
    }
  }
  return csvResponse(csvRespostas(f.campos, linhas), nomeCsvRespostas(f.titulo));
}

// ===== CSV =====
// delimitador `;` + tudo entre aspas = convenção Excel pt-BR (o parseCsv do
// import usa o mesmo); `""` escapa aspas internas. BOM no início pro Excel
// abrir os acentos como UTF-8 (File.text() do import descarta BOM).

/** ?tipo=ciclo — uma linha por encontro, a prestação de contas.
 *  `cronogramas` resolve id → nome pra coluna que desambigua o nº (0061). */
function csvCiclo(duplas: Dupla[], cronogramas: Map<string, string>): string {
  const linhas = duplas
    .sort((a, b) => a.mentor.nome.localeCompare(b.mentor.nome, "pt-BR"))
    .flatMap((d) =>
      [...d.encontros]
        .sort((a, b) => a.numero - b.numero)
        .map((e) => {
          const r = e.registro;
          return [
            d.mentor.nome,
            d.mentorado.nome,
            d.supervisor?.nome ?? "",
            // sem a trilha, encontro de dupla de especialista (5 passos)
            // lê como DPP — "Especialista" desambigua na planilha
            TRILHA_LABEL[d.trilha] ?? d.trilha,
            // nº do encontro só identifica dentro do cronograma (0061) —
            // sem turma+cronograma, "encontro 5" de duas turmas lê como o mesmo
            d.turma ?? "",
            d.cronograma_id ? (cronogramas.get(d.cronograma_id) ?? "") : "",
            String(e.numero),
            dataHora(e.data_hora),
            dia(e.realizado_em),
            STATUS_ENCONTRO[e.status],
            e.motivo_reagendamento ?? "",
            r ? dataHora(r.created_at) : "",
            r?.avaliacao ? (AVALIACAO_LABEL[r.avaliacao] ?? r.avaliacao) : "",
            r?.atividades?.join(" | ") ?? "",
            r ? (r.precisa_apoio ? "sim" : "não") : "",
          ]
            .map(celula)
            .join(";");
        })
    );

  return (
    "\uFEFF" +
    [
      "dupla_mentor;dupla_mentorado;auxiliar_executivo;trilha;turma;cronograma;encontro_num;data_agendada;realizado_em;status;motivo_reagendamento;registro_em;registro_avaliacao;registro_atividades;precisa_apoio",
      ...linhas,
    ].join("\r\n") +
    "\r\n"
  );
}

/** ?tipo=atividades — explode registros.atividades[]: uma linha por
 *  atividade. `crons` resolve a turma viva (turmaDaDupla) e o nome do
 *  cronograma nas duas primeiras colunas. */
function csvAtividades(
  duplas: Dupla[],
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[]
): string {
  const cronogramas = new Map(crons.map((c) => [c.id, c.nome] as const));
  const catalogo = new Set<string>(ATIVIDADES_ENCONTRO);
  const linhas = duplas
    .sort((a, b) => a.mentor.nome.localeCompare(b.mentor.nome, "pt-BR"))
    .flatMap((d) =>
      [...(d.encontros ?? [])]
        .sort((a, b) => a.numero - b.numero)
        .flatMap((e) => {
          const r = e.registro;
          // encontro sem registro não gera linha — a planilha conta
          // atividade feita, não encontro realizado
          if (!r) return [];
          const base = [
            turmaDaDupla(d, crons) ?? "",
            d.cronograma_id ? (cronogramas.get(d.cronograma_id) ?? "") : "",
            TRILHA_LABEL[d.trilha] ?? d.trilha,
            d.mentor.nome,
            d.mentorado.nome,
            String(e.numero),
            dia(e.realizado_em),
          ];
          return (r.atividades ?? []).map((a) => [
            ...base,
            a,
            catalogo.has(a) ? "catalogo" : "outro",
            r.avaliacao ? (AVALIACAO_LABEL[r.avaliacao] ?? r.avaliacao) : "",
          ]);
        })
    );

  return (
    "\uFEFF" +
    [
      "turma;cronograma;trilha;dupla_mentor;dupla_mentorado;encontro_num;realizado_em;atividade;origem;registro_avaliacao",
      ...linhas.map((l) => l.map(celula).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}

// ---------- matching ----------

/** Subconjunto de turma_inscricoes que a fila do matching usa — o id da
 *  pessoa é profile_id OU mentorado_id conforme o papel esperado. */
type TurmaInscricaoFila = {
  profile_id: string | null;
  mentorado_id: string | null;
  turma: string;
};

/** pessoa (profile_id ou mentorado_id) → turmas onde aguarda par. */
function filaMatchingPorPessoa(
  fila: TurmaInscricaoFila[]
): Map<string, string[]> {
  const porPessoa = new Map<string, string[]>();
  for (const f of fila) {
    const id = f.profile_id ?? f.mentorado_id;
    if (!id) continue;
    porPessoa.set(id, [...(porPessoa.get(id) ?? []), f.turma]);
  }
  return porPessoa;
}

type PessoaMatching = Pick<
  Profile,
  "id" | "nome" | "role" | "ativo" | "cidade" | "uf"
> & { papeis: AppRole[] };

type MentoradoMatching = Pick<
  Mentorado,
  "id" | "nome" | "email" | "whatsapp" | "cidade" | "uf" | "disponibilidade" | "situacao"
>;

type MpMatching = Pick<
  MentorProfile,
  "capacidade" | "capacidade_especialista" | "experiencia_previa" | "formacao_externa" | "disponibilidade"
>;

type SensMatching = {
  pref_genero_par?: PrefGeneroPar | null;
  motivacao?: string | null;
};

/** Linha pronta pro CSV de matching — real e demo convergem pra este shape. */
type LinhaMatching = {
  nome: string;
  tipo_pessoa: string;
  trilhas: string;
  email: string;
  whatsapp: string;
  cidade_uf: string;
  capacidade_dpp: string;
  capacidade_esp: string;
  experiencia_previa: string;
  formacao_externa: string;
  disponibilidade: string;
  pref_genero_par: string;
  motivacao: string;
  em_dupla: string;
  fila_turmas: string;
};

const cidadeUf = (cidade?: string | null, uf?: string | null): string =>
  [cidade, uf].filter(Boolean).join("/");

/** "seg noite | ter manhã" — uma célula por (dia, período) da grade
 *  canônica; vazio/ausente → "". */
const disponibilidadeCsv = (d: Disponibilidade | null | undefined): string =>
  celulasDe(d)
    .map(
      (c) =>
        `${(DIAS_SEMANA_CURTOS[c.dia] ?? c.dia).toLocaleLowerCase("pt-BR")} ${(PERIODOS_LABELS[c.periodo] ?? c.periodo).toLocaleLowerCase("pt-BR")}`
    )
    .join(" | ");

const prefLabel = (p?: PrefGeneroPar | null): string =>
  p ? (PREF_GENERO_LABELS[p] ?? p) : "";

/** União das trilhas de mentoria que a pessoa atende (DPP e/ou
 *  Especialista) — label de trilha, não de papel, pro híbrido ler
 *  "DPP + Especialista" sem repetir o tipo_pessoa. */
const trilhasMentoria = (p: PessoaMatching): string =>
  [
    temPapel(p, "mentor_dpp") ? TRILHA_LABEL.dpp : null,
    temPapel(p, "mentor_especialista") ? TRILHA_LABEL.especialista : null,
  ]
    .filter(Boolean)
    .join(" + ");

/** Monta as linhas do matching a partir dos merges já resolvidos — o mesmo
 *  coração pros dois ramos (query real × dataset demo). `turma` é o recorte
 *  ?turma=: casa pela inscrição aguardando da pessoa naquela turma. */
function linhasMatching(o: {
  pessoas: PessoaMatching[];
  contatos: Map<string, { email: string | null; whatsapp: string | null }>;
  mentorados: MentoradoMatching[];
  mps: Map<string, MpMatching>;
  pessoalP: Map<string, SensMatching>;
  pessoalM: Map<string, SensMatching>;
  filaPorPessoa: Map<string, string[]>;
  emDuplaP: Set<string>;
  emDuplaM: Set<string>;
  turma?: string;
}): LinhaMatching[] {
  const naFila = (id: string) =>
    !o.turma || (o.filaPorPessoa.get(id) ?? []).includes(o.turma);
  return [
    ...o.pessoas
      .filter(
        (p) =>
          p.ativo &&
          (temPapel(p, "mentor_dpp") || temPapel(p, "mentor_especialista")) &&
          naFila(p.id)
      )
      .map((p): LinhaMatching => {
        const mp = o.mps.get(p.id);
        const s = o.pessoalP.get(p.id);
        return {
          nome: p.nome,
          tipo_pessoa: tipoPessoa(p),
          trilhas: trilhasMentoria(p),
          email: o.contatos.get(p.id)?.email ?? "",
          whatsapp: o.contatos.get(p.id)?.whatsapp ?? "",
          cidade_uf: cidadeUf(p.cidade, p.uf),
          // as capacidades só existem quando há linha em mentor_profiles —
          // quem nunca foi ficha de mentor exporta "" nos dois campos
          capacidade_dpp: mp ? String(mp.capacidade ?? "") : "",
          capacidade_esp: mp ? String(mp.capacidade_especialista ?? "") : "",
          experiencia_previa: mp?.experiencia_previa ?? "",
          formacao_externa: mp?.formacao_externa ?? "",
          disponibilidade: disponibilidadeCsv(mp?.disponibilidade),
          pref_genero_par: prefLabel(s?.pref_genero_par),
          motivacao: s?.motivacao ?? "",
          em_dupla: o.emDuplaP.has(p.id) ? "sim" : "não",
          fila_turmas: (o.filaPorPessoa.get(p.id) ?? []).join(" | "),
        };
      }),
    ...o.mentorados
      .filter((m) => m.situacao === "ativo" && naFila(m.id))
      .map((m): LinhaMatching => {
        const s = o.pessoalM.get(m.id);
        return {
          nome: m.nome,
          tipo_pessoa: "Mentorado",
          trilhas: "",
          email: m.email ?? "",
          whatsapp: m.whatsapp ?? "",
          cidade_uf: cidadeUf(m.cidade, m.uf),
          capacidade_dpp: "",
          capacidade_esp: "",
          experiencia_previa: "",
          formacao_externa: "",
          disponibilidade: disponibilidadeCsv(m.disponibilidade),
          pref_genero_par: prefLabel(s?.pref_genero_par),
          motivacao: s?.motivacao ?? "",
          em_dupla: o.emDuplaM.has(m.id) ? "sim" : "não",
          fila_turmas: (o.filaPorPessoa.get(m.id) ?? []).join(" | "),
        };
      }),
  ];
}

/** ?tipo=matching — uma linha por pessoa do universo de pareamento. */
function csvMatching(linhas: LinhaMatching[]): string {
  return (
    "\uFEFF" +
    [
      "nome;tipo_pessoa;trilhas;email;whatsapp;cidade_uf;capacidade_dpp;capacidade_esp;experiencia_previa;formacao_externa;disponibilidade;pref_genero_par;motivacao;em_dupla;fila_turmas",
      ...linhas
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l) =>
          [
            l.nome,
            l.tipo_pessoa,
            l.trilhas,
            l.email,
            l.whatsapp,
            l.cidade_uf,
            l.capacidade_dpp,
            l.capacidade_esp,
            l.experiencia_previa,
            l.formacao_externa,
            l.disponibilidade,
            l.pref_genero_par,
            l.motivacao,
            l.em_dupla,
            l.fila_turmas,
          ]
            .map(celula)
            .join(";")
        ),
    ].join("\r\n") +
    "\r\n"
  );
}

// ---------- presencas ----------

/** Marca de chamada (subselect de presencas no evento — ou o dataset demo
 *  agrupado por ciclo_evento_id). */
type MarcaPresenca = Pick<Presenca, "profile_id" | "presente" | "marcado_em">;

/** Evento de formação com as marcas embutidas — real e demo convergem. */
type EventoChamada = Pick<
  CicloEvento,
  "id" | "titulo" | "data" | "cronograma_id"
> & { presencas?: MarcaPresenca[] };

/** Linha pronta pro CSV de presenças — grão (evento formacao × marcado). */
type LinhaPresenca = {
  evento: string;
  /** "YYYY-MM-DD" — sai dd/mm/aaaa via dia() na montagem. */
  data: string | null;
  turma: string;
  cronograma: string;
  nome: string;
  papel: string;
  presente: boolean;
  marcado_em: string | null;
  /** null = não-mentor (sem linha em mentor_profiles) → célula vazia. */
  formacao_ok: boolean | null;
};

/** ?turma=/?cronograma= da chamada — ciclo_eventos não tem coluna turma;
 *  o recorte por turma resolve pelo cronograma dono do evento. */
function filtraEventosFormacao<T extends { cronograma_id: string }>(
  eventos: T[],
  p: URLSearchParams,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): T[] {
  const turma = p.get("turma")?.trim();
  const cronograma = p.get("cronograma")?.trim();
  if (!turma && !cronograma) return eventos;
  return eventos.filter(
    (e) =>
      (!cronograma || e.cronograma_id === cronograma) &&
      (!turma ||
        crons.find((c) => c.id === e.cronograma_id)?.turma === turma)
  );
}

/** Explode (evento × marca) nas linhas do CSV — sem marca, sem linha. */
function linhasPresencas(
  eventos: EventoChamada[],
  pessoas: Map<string, { nome: string; role: string | null }>,
  formacaoOk: Map<string, boolean>,
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[]
): LinhaPresenca[] {
  const cronPorId = new Map(crons.map((c) => [c.id, c] as const));
  return eventos.flatMap((ev) => {
    const cron = cronPorId.get(ev.cronograma_id);
    return (ev.presencas ?? []).map(
      (p): LinhaPresenca => ({
        evento: ev.titulo,
        data: ev.data,
        turma: cron?.turma ?? "",
        cronograma: cron?.nome ?? "",
        nome: pessoas.get(p.profile_id)?.nome ?? "",
        papel: papelLabel(pessoas.get(p.profile_id)?.role),
        presente: p.presente,
        marcado_em: p.marcado_em,
        formacao_ok: formacaoOk.has(p.profile_id)
          ? (formacaoOk.get(p.profile_id) ?? null)
          : null,
      })
    );
  });
}

/** ?tipo=presencas — uma linha por chamada marcada, ordenada por data. */
function csvPresencas(linhas: LinhaPresenca[]): string {
  return (
    "\uFEFF" +
    [
      "evento;data;turma;cronograma;nome;papel;presente;marcado_em;formacao_ok",
      ...linhas
        .sort(
          (a, b) =>
            (a.data ?? "").localeCompare(b.data ?? "") ||
            a.evento.localeCompare(b.evento, "pt-BR") ||
            a.nome.localeCompare(b.nome, "pt-BR")
        )
        .map((l) =>
          [
            l.evento,
            diaColuna(l.data),
            l.turma,
            l.cronograma,
            l.nome,
            l.papel,
            l.presente ? "sim" : "não",
            dataHora(l.marcado_em),
            l.formacao_ok == null ? "" : l.formacao_ok ? "sim" : "não",
          ]
            .map(celula)
            .join(";")
        ),
    ].join("\r\n") +
    "\r\n"
  );
}

/** Recorte dos sensíveis que o CSV de pessoas exporta — form_bruto fica de
 *  fora de propósito (arquivo morto, não campo de relatório). */
type SensPessoa = Pick<
  DadosPessoais,
  "data_nascimento" | "genero" | "cor_raca" | "pref_genero_par" | "motivacao"
>;

/** Coluna `tipo` — os papéis efetivos (união role ∪ papeis, mesma regra do
 *  temPapel), não só o primário: o híbrido exporta "Mentor DPP + Mentor
 *  especialista" em vez de esconder a segunda trilha. */
const tipoPessoa = (p: Pick<Profile, "role" | "papeis">): string => {
  // primário primeiro — a ordem do embed profile_papeis não é garantida
  const efetivos = [
    ...new Set([...(p.role ? [p.role] : []), ...(p.papeis ?? [])]),
  ];
  return efetivos.length ? efetivos.map(papelLabel).join(" + ") : "Sem papel";
};

function csvPessoas(
  pessoas: Pick<Profile, "id" | "nome" | "role" | "papeis" | "ativo">[],
  contatos: Map<string, { email: string | null; whatsapp: string | null }>,
  mentorados: Pick<
    Mentorado,
    | "id"
    | "nome"
    | "email"
    | "whatsapp"
    | "ong_origem"
    | "situacao"
    | "saiu_em"
    | "motivo_saida"
  >[],
  capacidades: Map<string, number | null>,
  capacidadesEsp: Map<string, number | null>,
  pessoalP: Map<string, SensPessoa>,
  pessoalM: Map<string, SensPessoa>
): string {
  // sensíveis no fim, agrupados — quem abre a planilha vê de cara o bloco
  // que exige o cuidado LGPD
  const sens = (s: SensPessoa | undefined): string[] => [
    s?.data_nascimento ? dia(s.data_nascimento) : "",
    s?.genero ? (GENERO_LABELS[s.genero] ?? s.genero) : "",
    s?.cor_raca ? (COR_RACA_LABELS[s.cor_raca] ?? s.cor_raca) : "",
    s?.pref_genero_par
      ? (PREF_GENERO_LABELS[s.pref_genero_par] ?? s.pref_genero_par)
      : "",
    s?.motivacao ?? "",
  ];
  type Linha = { nome: string; resto: string[] };
  const linhas: Linha[] = [
    ...pessoas.map((p) => ({
      nome: p.nome,
      resto: [
        tipoPessoa(p),
        contatos.get(p.id)?.email ?? "",
        contatos.get(p.id)?.whatsapp ?? "",
        // a coluna capacidade mostra a pool da trilha do papel (0073) —
        // gate por papel efetivo (temPapel), não pelo primário: mentor
        // só-secundário também exporta a pool dele; o híbrido (WP6b)
        // exporta as duas rotuladas — "2 DPP / 3 ESP"
        temPapel(p, "mentor_dpp") || temPapel(p, "mentor_especialista")
          ? temPapel(p, "mentor_dpp") && temPapel(p, "mentor_especialista")
            ? `${capacidades.get(p.id) ?? ""} DPP / ${capacidadesEsp.get(p.id) ?? ""} ESP`
            : String(
                (temPapel(p, "mentor_especialista")
                  ? capacidadesEsp.get(p.id)
                  : capacidades.get(p.id)) ?? ""
              )
          : "",
        "",
        p.ativo ? "ativo" : "inativo",
        ...sens(pessoalP.get(p.id)),
        "",
        "",
      ],
    })),
    ...mentorados.map((m) => ({
      nome: m.nome,
      resto: [
        "Mentorado",
        m.email ?? "",
        m.whatsapp ?? "",
        "",
        m.ong_origem ?? "",
        // estado do cadastro (0077) — a prestação de contas distingue
        // desistência de conclusão, não só "saiu"
        m.situacao === "desistente"
          ? "desistente"
          : m.situacao === "concluido"
            ? "concluído"
            : "ativo",
        ...sens(pessoalM.get(m.id)),
        m.saiu_em ? dia(m.saiu_em) : "",
        m.motivo_saida ?? "",
      ],
    })),
  ];

  return (
    "\uFEFF" +
    [
      "nome;tipo;email;whatsapp;capacidade;ong_origem;status;data_nascimento;genero;cor_raca;pref_genero_par;motivacao;saiu_em;motivo_saida",
      ...linhas
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l) => [l.nome, ...l.resto].map(celula).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}

/** ?tipo=assinaturas — uma linha por documento emitido/assinado. A coluna
 *  snapshot_json é o conteúdo civil assinado (CPF/RG/endereço) — sensível,
 *  mas o export inteiro já é coord-only e é isso que prova o contrato. */
type LinhaAssinatura = {
  id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  status: string;
  dados_snapshot: unknown;
  assinatura_texto: string | null;
  assinado_em: string | null;
  ip: string | null;
  user_agent: string | null;
  hash_documento: string | null;
  token_expira_em: string | null;
  created_by: string | null;
  created_at: string;
  template?:
    | { slug: string; titulo: string; versao: number }
    | { slug: string; titulo: string; versao: number }[]
    | null;
};

function csvAssinaturas(
  rows: LinhaAssinatura[],
  nomes: Map<string, string>,
  papeis: Map<string, Profile["role"]>,
  origin: string
): string {
  const linhas = rows.map((a) => {
    const tpl = Array.isArray(a.template) ? a.template[0] : a.template;
    const alvo = a.profile_id ?? a.mentorado_id ?? "";
    // snapshot civil achatado: na autorização os dados são do responsável
    // (objeto aninhado), nos termos são da própria pessoa (topo)
    const snap = a.dados_snapshot as Record<string, unknown> | null;
    const civ =
      (snap?.responsavel as Record<string, unknown> | undefined) ??
      snap ??
      {};
    const txt = (k: string) =>
      typeof civ[k] === "string" ? (civ[k] as string) : "";
    return {
      nome: nomes.get(alvo) ?? "",
      resto: [
        a.id,
        a.profile_id ? papelLabel(papeis.get(alvo) ?? null) : "Mentorado",
        tpl?.titulo ?? "",
        tpl ? `v${tpl.versao}` : "",
        a.status,
        dataHora(a.created_at),
        a.created_by ? (nomes.get(a.created_by) ?? "") : "",
        dia(a.token_expira_em),
        dataHora(a.assinado_em),
        a.assinatura_texto ?? "",
        txt("nome_civil"),
        txt("cpf"),
        txt("rg"),
        txt("parentesco"),
        a.ip ?? "",
        a.user_agent ?? "",
        a.hash_documento ?? "",
        `${origin}/api/assinatura/${a.id}`,
        a.dados_snapshot ? JSON.stringify(a.dados_snapshot) : "",
      ],
    };
  });

  return (
    "\uFEFF" +
    [
      "nome;id;tipo;documento;versao;status;emitido_em;emitido_por;expira_em;assinado_em;nome_assinado;signatario_civil;cpf;rg;parentesco;ip;user_agent;sha256;url_pdf;snapshot_json",
      ...linhas
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l) => [l.nome, ...l.resto].map(celula).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}

/** ?tipo=respostas — uma linha por link respondido; as perguntas viram
 *  colunas com o label como header (por isso o header passa por celula() —
 *  label livre pode conter `;` ou `"`). Resposta de pergunta removida do
 *  form (resposta a versão antiga) entra no fim com o id cru — um backup
 *  não pode perder dado. */
function csvRespostas(
  campos: FormularioCampo[],
  linhas: LinhaRespostaCsv[]
): string {
  // 'secao' é rótulo de estrutura (0080) — nunca tem resposta; coluna vazia
  // no backup só atrapalha a leitura
  const perguntas = camposPerguntas(campos);
  const declarados = new Set(perguntas.map((c) => c.id));
  const orfas: string[] = [];
  for (const l of linhas)
    for (const k of Object.keys(l.respostas))
      if (!declarados.has(k) && !orfas.includes(k)) orfas.push(k);

  const header = [
    "destinatario",
    "tipo",
    "dupla",
    "respondido_em",
    ...perguntas.map((c) => c.label),
    ...orfas,
  ];

  return (
    "\uFEFF" +
    [
      header.map(celula).join(";"),
      // mais recente primeiro — mesma leitura da aba Respostas
      ...linhas
        .sort((a, b) => b.respondido_em.localeCompare(a.respondido_em))
        .map((l) =>
          [
            l.destinatario,
            l.tipo,
            l.dupla,
            dataHora(l.respondido_em),
            ...perguntas.map((c) => celulaResposta(c, l.respostas[c.id])),
            ...orfas.map((k) => celulaResposta(undefined, l.respostas[k])),
          ]
            .map(celula)
            .join(";")
        ),
    ].join("\r\n") +
    "\r\n"
  );
}

/** Resposta -> texto de célula: multi_select junta com " | ", booleano
 *  vira Sim/Não, data dd/mm/aaaa, escala sai como número cru. */
function celulaResposta(
  campo: FormularioCampo | undefined,
  valor: RespostaValor | undefined
): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) return valor.join(" | ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (campo?.tipo === "sim_nao")
    return valor === "sim" ? "Sim" : valor === "nao" ? "Não" : String(valor);
  // objeto (arquivo {path,nome,tamanho}, grade {celulas,horas}) e data —
  // respostaFormatada devolve o texto legível em vez de "[object Object]"
  if (
    campo?.tipo === "data" ||
    campo?.tipo === "arquivo" ||
    campo?.tipo === "grid_disponibilidade"
  )
    return respostaFormatada(campo, valor);
  return String(valor);
}

/** CSV como attachment — os dois relatórios saem no mesmo formato. */
function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// mês no nome do relatório do ciclo: exports de meses diferentes não se
// sobrepõem na pasta de downloads
const nomeCsvCiclo = () => `encontros-${toDateStr(new Date()).slice(0, 7)}.csv`;
const nomeCsvAtividades = () => `atividades-${toDateStr(new Date())}.csv`;
const nomeCsvMatching = () => `matching-${toDateStr(new Date())}.csv`;
const nomeCsvPresencas = () => `presencas-${toDateStr(new Date())}.csv`;
const nomeCsvPessoas = () => `pessoas-${toDateStr(new Date())}.csv`;
const nomeCsvAssinaturas = () => `assinaturas-${toDateStr(new Date())}.csv`;

// título do form entra no nome do arquivo (ascii kebab) — exports de forms
// diferentes não se sobrepõem na pasta de downloads
const slugCsv = (s: string) =>
  normaliza(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "formulario";
const nomeCsvRespostas = (titulo: string) =>
  `respostas-${slugCsv(titulo)}-${toDateStr(new Date())}.csv`;

function celula(v: string | null | undefined): string {
  let s = v ?? "";
  // formula injection: Excel/Sheets executam célula abrindo com = + - @ (ou
  // após tab/CR) — campos de texto livre do mentor passam por aqui
  if (/^[\t\r ]*[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// mesmo mapa do STATUS_ENCONTRO_LABEL da agenda — copiado porque lá é local
const STATUS_ENCONTRO: Record<EncontroStatus, string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

const TZ = "America/Sao_Paulo";
// os formatters de ciclo.ts abreviam o mês ("06 de out."); aqui é dd/mm/aaaa
// numérico, mais fácil de ordenar/filtrar na planilha
const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** timestamptz ISO -> "dd/mm/aaaa hh:mm" no fuso do programa ("" se vazio). */
function dataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${fmtData.format(d)} ${fmtHora.format(d)}`;
}

/** timestamptz ISO -> "dd/mm/aaaa" no fuso do programa ("" se vazio). */
function dia(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : fmtData.format(d);
}

/** coluna `date` ("YYYY-MM-DD") -> "dd/mm/aaaa" — manipulação de string,
 *  sem Date: `new Date("2025-09-03")` é midnight UTC e caía na véspera
 *  no fuso de SP (ciclo_eventos.data é `date`, não timestamptz). */
function diaColuna(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
