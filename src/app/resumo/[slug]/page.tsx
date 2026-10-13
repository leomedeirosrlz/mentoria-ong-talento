import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteFooter } from "@/components/site-footer";
import { formatDate, formatDateTime } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

// link "livre" por obscuridade: só abre com o slug exato, que não aparece
// em link nenhum do app. Rotacionar = trocar a constante e redeployar.
const SLUG_T2 = "t2-x7k4m9qf2w8j";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turma 2 · Resumo",
  // link compartilhável — não é página de indexação (mesmo desenho do /f/[token])
  robots: { index: false, follow: false },
};

type Linha = {
  papel: "mentor" | "mentorado";
  nome: string;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
  par: string | null;
  statusDupla: string;
  iniciadaEm: string | null;
  demanda: string | null;
  auxiliar: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  pausada: "Pausada",
  concluida: "Concluída",
  "sem dupla": "Sem dupla",
};

function StatusChip({ status }: { status: string }) {
  const tom =
    status === "ativa"
      ? "bg-[var(--ok)]/12 text-[var(--ok)]"
      : status === "sem dupla"
        ? "bg-[var(--warn)]/15 text-[var(--warn)]"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tom
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function CelulaContato({ email, whatsapp }: { email: string | null; whatsapp: string | null }) {
  if (!email && !whatsapp) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5 text-xs">
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
          className="block text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
        >
          {whatsapp}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="block break-all text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
        >
          {email}
        </a>
      )}
    </div>
  );
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo} <span className="font-normal">({linhas.length})</span>
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Cidade/UF</th>
              <th className="px-4 py-3 font-medium">Par</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium">Demanda</th>
              <th className="px-4 py-3 font-medium">Auxiliar executivo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{l.nome}</td>
                <td className="px-4 py-3">
                  <CelulaContato email={l.email} whatsapp={l.whatsapp} />
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {l.cidade ? `${l.cidade}${l.uf ? ` · ${l.uf}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{l.par ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3"><StatusChip status={l.statusDupla} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(l.iniciadaEm)}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.demanda ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.auxiliar ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ResumoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== SLUG_T2) notFound();

  const supabase = createAdminClient();
  const [duplasRes, profsRes, mentsRes] = await Promise.all([
    supabase
      .from("duplas")
      .select("mentor_id, mentorado_id, supervisor_id, status, iniciada_em, demanda")
      .eq("turma", "T2 · 2026/2027")
      .order("iniciada_em"),
    supabase.from("profiles").select("id, nome, email, whatsapp, cidade, uf"),
    supabase.from("mentorados").select("id, nome, email, whatsapp, cidade, uf"),
  ]);
  if (duplasRes.error || profsRes.error || mentsRes.error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-4">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar agora. Tente de novo em instantes.
        </p>
      </div>
    );
  }

  const profs = new Map((profsRes.data ?? []).map((p) => [p.id, p]));
  const ments = new Map((mentsRes.data ?? []).map((m) => [m.id, m]));
  const ativosMentor = new Set(
    (duplasRes.data ?? []).filter((d) => d.status === "ativa").map((d) => d.mentor_id)
  );
  const ativosMentorado = new Set(
    (duplasRes.data ?? []).filter((d) => d.status === "ativa").map((d) => d.mentorado_id)
  );

  const linhas: Linha[] = [];
  for (const d of duplasRes.data ?? []) {
    const mentor = profs.get(d.mentor_id);
    const mentorado = ments.get(d.mentorado_id);
    const sup = profs.get(d.supervisor_id);
    if (mentor) {
      linhas.push({
        papel: "mentor",
        nome: mentor.nome,
        email: mentor.email,
        whatsapp: mentor.whatsapp,
        cidade: mentor.cidade,
        uf: mentor.uf,
        par: mentorado?.nome ?? null,
        statusDupla: d.status,
        iniciadaEm: d.iniciada_em,
        demanda: d.demanda,
        auxiliar: sup?.nome ?? null,
      });
    }
    if (mentorado) {
      linhas.push({
        papel: "mentorado",
        nome: mentorado.nome,
        email: mentorado.email,
        whatsapp: mentorado.whatsapp,
        cidade: mentorado.cidade,
        uf: mentorado.uf,
        par: mentor?.nome ?? null,
        statusDupla: d.status,
        iniciadaEm: d.iniciada_em,
        demanda: d.demanda,
        auxiliar: sup?.nome ?? null,
      });
    }
  }
  // quem chegou pra T2 e segue sem dupla ativa: fila de espera de fato —
  // não há marcador de turma fora de `duplas`, então a fila é a allowlist
  // explícita de quem foi importado pro pareamento T2
  const T2_FILA_MENTOR = ["a6df198b-b46f-45f7-a5a1-a2dbed3325b9"]; // Fernanda Arrelaro
  const T2_FILA_JOVEM = [
    "710fcd28-7b68-4456-bbfe-f2915553fb7c", // Luana
    "f78d2469-a6e6-4cfb-85bd-2b90bc5c68c4", // Wemilly
  ];
  for (const pid of T2_FILA_MENTOR) {
    const p = profs.get(pid);
    if (p && !ativosMentor.has(pid)) {
      linhas.push({ papel: "mentor", nome: p.nome, email: p.email, whatsapp: p.whatsapp,
        cidade: p.cidade, uf: p.uf, par: null, statusDupla: "sem dupla",
        iniciadaEm: null, demanda: null, auxiliar: null });
    }
  }
  for (const mid of T2_FILA_JOVEM) {
    const m = ments.get(mid);
    if (m && !ativosMentorado.has(mid)) {
      linhas.push({ papel: "mentorado", nome: m.nome, email: m.email, whatsapp: m.whatsapp,
        cidade: m.cidade, uf: m.uf, par: null, statusDupla: "sem dupla",
        iniciadaEm: null, demanda: null, auxiliar: null });
    }
  }

  const mentores = linhas.filter((l) => l.papel === "mentor").sort((a, b) => a.nome.localeCompare(b.nome));
  const mentorados = linhas.filter((l) => l.papel === "mentorado").sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto w-full max-w-6xl">
          <header>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" width={1920} height={262} className="h-7 w-auto" />
            <p className="mt-1.5 text-xs text-muted-foreground">Programa de Mentoria Social</p>
          </header>

          <div className="mt-8">
            <h1 className="text-xl font-semibold">Turma 2 · 2026/2027</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mentores e mentorados da turma — dados vivos, atualizados em{" "}
              {formatDateTime(new Date().toISOString())}. Link não listado: quem o recebeu pode ver;
              contatos visíveis — trate como documento interno.
            </p>
          </div>

          <Tabela titulo="Mentores" linhas={mentores} />
          <Tabela titulo="Mentorados" linhas={mentorados} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
