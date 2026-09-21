import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AVALIACAO_LABEL, papelLabel, toDateStr } from "@/lib/ciclo";
import type { Dupla, EncontroStatus } from "@/lib/types";

// GET /api/export — só pra coordenação. ?tipo=ciclo (default): relatório do
// ciclo em CSV, uma linha por encontro — a prestação de contas. ?tipo=pessoas:
// cadastro completo (equipe + mentorados) pra mala direta/backup.
export async function GET(request: NextRequest) {
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
      { error: "Só a coordenação pode exportar o relatório do ciclo." },
      { status: 403 }
    );
  }

  if (request.nextUrl.searchParams.get("tipo") === "pessoas") {
    return exportPessoas(supabase);
  }

  const { data, error } = await supabase
    .from("duplas")
    .select(
      `mentor:profiles!duplas_mentor_id_fkey(nome),
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

  // BOM pro Excel abrir os acentos como UTF-8 (File.text() do import descarta BOM)
  const csv =
    "\uFEFF" +
    [
      "dupla_mentor;dupla_mentorado;supervisor;encontro_num;data_agendada;realizado_em;status;motivo_reagendamento;registro_em;registro_avaliacao;registro_atividades;precisa_apoio",
      ...linhas,
    ].join("\r\n") +
    "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // mês no nome: exports de meses diferentes não se sobrepõem na pasta de downloads
      "Content-Disposition": `attachment; filename="encontros-${toDateStr(new Date()).slice(0, 7)}.csv"`,
    },
  });
}

// tipo=pessoas — cadastro único: equipe (papel, status) + mentorados (ONG de
// origem). Ordenado por nome; mesmo formato `;`+BOM do relatório do ciclo.
async function exportPessoas(supabase: Awaited<ReturnType<typeof createClient>>) {
  // email/whatsapp saíram do grant de coluna de profiles (0026) — a view
  // profiles_contato devolve todas as linhas pra coordenação (única que
  // passa na checagem acima) e o merge é por id
  const [
    { data: pessoas, error: eP },
    { data: contatos, error: eC },
    { data: mentorados, error: eM },
    { data: mps },
  ] = await Promise.all([
    supabase.from("profiles").select("id,nome,role,ativo"),
    supabase.from("profiles_contato").select("id,email,whatsapp"),
    supabase.from("mentorados").select("nome,email,whatsapp,ong_origem"),
    supabase.from("mentor_profiles").select("profile_id,capacidade"),
  ]);
  if (eP || eC || eM) {
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório — tente de novo." },
      { status: 500 }
    );
  }
  const capacidade = new Map((mps ?? []).map((m) => [m.profile_id, m.capacidade]));
  const contatoPorId = new Map((contatos ?? []).map((c) => [c.id, c]));

  type Linha = { nome: string; resto: string[] };
  const linhas: Linha[] = [
    ...(pessoas ?? []).map((p) => ({
      nome: p.nome,
      resto: [
        p.role ? papelLabel(p.role) : "Sem papel",
        contatoPorId.get(p.id)?.email ?? "",
        contatoPorId.get(p.id)?.whatsapp ?? "",
        p.role?.startsWith("mentor") ? String(capacidade.get(p.id) ?? "") : "",
        "",
        p.ativo ? "ativo" : "inativo",
      ],
    })),
    ...(mentorados ?? []).map((m) => ({
      nome: m.nome,
      resto: ["Mentorado", m.email ?? "", m.whatsapp ?? "", "", m.ong_origem ?? "", ""],
    })),
  ];

  const csv =
    "\uFEFF" +
    [
      "nome;tipo;email;whatsapp;capacidade;ong_origem;status",
      ...linhas
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l) => [l.nome, ...l.resto].map(celula).join(";")),
    ].join("\r\n") +
    "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pessoas-${toDateStr(new Date())}.csv"`,
    },
  });
}

// ===== CSV / datas =====
// delimitador `;` + tudo entre aspas = convenção Excel pt-BR (o parseCsv do
// import usa o mesmo); `""` escapa aspas internas.

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
