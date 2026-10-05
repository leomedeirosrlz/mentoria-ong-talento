import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoPessoalMap } from "@/lib/demo/queries";
import { getDemoFormularios } from "@/lib/demo/forms-data";
import {
  respostaFormatada,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { normaliza } from "@/lib/utils";
import {
  AVALIACAO_LABEL,
  COR_RACA_LABELS,
  GENERO_LABELS,
  papelLabel,
  PREF_GENERO_LABELS,
  toDateStr,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import type { DadosPessoais } from "@/lib/queries";
import type { Dupla, EncontroStatus, Mentorado, Profile } from "@/lib/types";

// GET /api/export — só pra coordenação. ?tipo=ciclo (default): relatório do
// ciclo em CSV, uma linha por encontro — a prestação de contas. ?tipo=pessoas:
// cadastro completo (equipe + mentorados) pra mala direta/backup.
export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo");

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
      return csvResponse(
        csvPessoas(
          d.profiles,
          contatos,
          d.mentorados,
          capacidades,
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
    const cronDemo = new Map(d.cronogramas.map((c) => [c.id, c.nome]));
    return csvResponse(
      csvCiclo(filtraCsvCiclo(d.duplas, request.nextUrl.searchParams), cronDemo),
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
    .select("id, nome");
  const cronogramas = new Map(
    (crons ?? []).map((c) => [c.id, c.nome] as const)
  );
  const duplas = filtraCsvCiclo(
    (data as unknown as Dupla[]) ?? [],
    request.nextUrl.searchParams
  );

  return csvResponse(csvCiclo(duplas, cronogramas), nomeCsvCiclo());
}

/** ?turma= e ?cronograma= recortam a prestação de contas — com turmas em
 *  paralelo, o relatório misto pode servir de recibo por turma. */
function filtraCsvCiclo(duplas: Dupla[], p: URLSearchParams): Dupla[] {
  const turma = p.get("turma")?.trim();
  const cronograma = p.get("cronograma")?.trim();
  return duplas.filter(
    (d) =>
      (!turma || d.turma === turma) &&
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
    supabase.from("profiles").select("id,nome,role,ativo"),
    supabase.from("profiles_contato").select("id,email,whatsapp"),
    supabase.from("mentorados").select("id,nome,email,whatsapp,ong_origem"),
    supabase.from("mentor_profiles").select("profile_id,capacidade"),
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
  const contatoPorId = new Map((contatos ?? []).map((c) => [c.id, c]));
  const pessoalPorId = new Map(
    (pessoalP ?? []).map((p) => [p.id, { responsavel: null, ...p }])
  );
  const pessoalMentoradoPorId = new Map((pessoalM ?? []).map((m) => [m.id, m]));

  return csvResponse(
    csvPessoas(
      pessoas ?? [],
      contatoPorId,
      mentorados ?? [],
      capacidades,
      pessoalPorId,
      pessoalMentoradoPorId
    ),
    nomeCsvPessoas()
  );
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

  const linhas = ((links ?? []) as unknown as LinkRaw[])
    .map((l): LinhaRespostaCsv | null => {
      const r = norm(l.resposta);
      if (!r) return null; // link sem resposta não vira linha
      const p = norm(l.dest_profile);
      const m = norm(l.dest_mentorado);
      const dupla = norm(l.dupla);
      return {
        destinatario: p?.nome ?? m?.nome ?? "Link genérico",
        tipo: p ? papelLabel(p.role) : m ? "Mentorado" : "Link genérico",
        dupla: dupla
          ? `${norm(dupla.mentor)?.nome ?? ""} ↔ ${norm(dupla.mentorado)?.nome ?? ""}`
          : "",
        respondido_em: r.respondido_em,
        respostas: r.respostas ?? {},
      };
    })
    .filter((l): l is LinhaRespostaCsv => l !== null);

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
    const r = respostas.find((x) => x.link_id === l.id);
    if (!r) continue;
    const p = l.dest_profile_id
      ? d.profiles.find((x) => x.id === l.dest_profile_id)
      : null;
    const m = l.dest_mentorado_id
      ? d.mentorados.find((x) => x.id === l.dest_mentorado_id)
      : null;
    const dupla = l.dupla_id
      ? d.duplas.find((x) => x.id === l.dupla_id)
      : null;
    linhas.push({
      destinatario: p?.nome ?? m?.nome ?? "Link genérico",
      tipo: p ? papelLabel(p.role) : m ? "Mentorado" : "Link genérico",
      dupla: dupla
        ? `${dupla.mentor?.nome ?? ""} ↔ ${dupla.mentorado?.nome ?? ""}`
        : "",
      respondido_em: r.respondido_em,
      respostas: r.respostas,
    });
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
      "dupla_mentor;dupla_mentorado;supervisor;trilha;turma;cronograma;encontro_num;data_agendada;realizado_em;status;motivo_reagendamento;registro_em;registro_avaliacao;registro_atividades;precisa_apoio",
      ...linhas,
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

function csvPessoas(
  pessoas: Pick<Profile, "id" | "nome" | "role" | "ativo">[],
  contatos: Map<string, { email: string | null; whatsapp: string | null }>,
  mentorados: Pick<Mentorado, "id" | "nome" | "email" | "whatsapp" | "ong_origem">[],
  capacidades: Map<string, number | null>,
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
        p.role ? papelLabel(p.role) : "Sem papel",
        contatos.get(p.id)?.email ?? "",
        contatos.get(p.id)?.whatsapp ?? "",
        p.role?.startsWith("mentor") ? String(capacidades.get(p.id) ?? "") : "",
        "",
        p.ativo ? "ativo" : "inativo",
        ...sens(pessoalP.get(p.id)),
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
        "",
        ...sens(pessoalM.get(m.id)),
      ],
    })),
  ];

  return (
    "\uFEFF" +
    [
      "nome;tipo;email;whatsapp;capacidade;ong_origem;status;data_nascimento;genero;cor_raca;pref_genero_par;motivacao",
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
  const declarados = new Set(campos.map((c) => c.id));
  const orfas: string[] = [];
  for (const l of linhas)
    for (const k of Object.keys(l.respostas))
      if (!declarados.has(k) && !orfas.includes(k)) orfas.push(k);

  const header = [
    "destinatario",
    "tipo",
    "dupla",
    "respondido_em",
    ...campos.map((c) => c.label),
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
            ...campos.map((c) => celulaResposta(c, l.respostas[c.id])),
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
  if (campo?.tipo === "data") return respostaFormatada(campo, valor);
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
