import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoPessoalMap } from "@/lib/demo/queries";
import {
  AVALIACAO_LABEL,
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
    return csvResponse(csvCiclo(d.duplas), nomeCsvCiclo());
  }

  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) {
    return NextResponse.json(
      { error: "Sessão expirada — entre de novo." },
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

  if (tipo === "pessoas") {
    return exportPessoas(supabase);
  }

  const { data, error } = await supabase
    .from("duplas")
    .select(
      `trilha,
      mentor:profiles!duplas_mentor_id_fkey(nome),
      mentorado:mentorados(nome),
      supervisor:profiles!duplas_supervisor_id_fkey(nome),
      encontros(*, registro:registros(*))`
    );
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório — tente de novo." },
      { status: 500 }
    );
  }
  const duplas = (data as unknown as Dupla[]) ?? [];

  return csvResponse(csvCiclo(duplas), nomeCsvCiclo());
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
      .select("id,data_nascimento,genero,pref_genero_par,motivacao,dados_civis"),
    supabase
      .from("mentorados_pessoal")
      .select("id,data_nascimento,genero,pref_genero_par,motivacao,dados_civis,responsavel"),
  ]);
  if (eP || eC || eM || eMP || ePP || ePM) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório — tente de novo." },
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

// ===== CSV =====
// delimitador `;` + tudo entre aspas = convenção Excel pt-BR (o parseCsv do
// import usa o mesmo); `""` escapa aspas internas. BOM no início pro Excel
// abrir os acentos como UTF-8 (File.text() do import descarta BOM).

/** ?tipo=ciclo — uma linha por encontro, a prestação de contas. */
function csvCiclo(duplas: Dupla[]): string {
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
      "dupla_mentor;dupla_mentorado;supervisor;trilha;encontro_num;data_agendada;realizado_em;status;motivo_reagendamento;registro_em;registro_avaliacao;registro_atividades;precisa_apoio",
      ...linhas,
    ].join("\r\n") +
    "\r\n"
  );
}

function csvPessoas(
  pessoas: Pick<Profile, "id" | "nome" | "role" | "ativo">[],
  contatos: Map<string, { email: string | null; whatsapp: string | null }>,
  mentorados: Pick<Mentorado, "id" | "nome" | "email" | "whatsapp" | "ong_origem">[],
  capacidades: Map<string, number | null>,
  pessoalP: Map<string, DadosPessoais>,
  pessoalM: Map<string, DadosPessoais>
): string {
  // sensíveis no fim, agrupados — quem abre a planilha vê de cara o bloco
  // que exige o cuidado LGPD
  const sens = (s: DadosPessoais | undefined): string[] => [
    s?.data_nascimento ? dia(s.data_nascimento) : "",
    s?.genero ? (GENERO_LABELS[s.genero] ?? s.genero) : "",
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
      "nome;tipo;email;whatsapp;capacidade;ong_origem;status;data_nascimento;genero;pref_genero_par;motivacao",
      ...linhas
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l) => [l.nome, ...l.resto].map(celula).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
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
