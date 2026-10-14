import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteFooter } from "@/components/site-footer";
import { RelatorioCanvas } from "@/components/relatorio-canvas";
import {
  RESUMO_SLUG_T2,
  catalogoDe,
  montarLinhas,
  parseConfig,
} from "@/lib/relatorio";
import { formatDateTime } from "@/lib/ciclo";

// link "livre" por obscuridade: só abre com o slug exato, que não aparece
// em link nenhum do app. Rotacionar = trocar RESUMO_SLUG_T2 e redeployar.
// Turma/granularidade/colunas chegam por query (?turma=&gran=&col=) —
// quem tem o link já vê tudo, então o recorte é conveniência, não controle.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resumo da turma",
  robots: { index: false, follow: false },
};

export default async function ResumoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (slug !== RESUMO_SLUG_T2) notFound();

  const cfg = parseConfig({
    turma: sp.turma,
    gran: sp.gran,
    col: sp.col,
  });

  const supabase = createAdminClient();
  const [dRes, pRes, mRes] = await Promise.all([
    supabase
      .from("duplas")
      .select("id, turma, mentor_id, mentorado_id, supervisor_id, status, iniciada_em, demanda")
      .order("iniciada_em"),
    supabase.from("profiles").select("id, nome, email, whatsapp, cidade, uf"),
    supabase.from("mentorados").select("id, nome, email, whatsapp, cidade, uf"),
  ]);
  if (dRes.error || pRes.error || mRes.error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-4">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar agora. Tente de novo em instantes.
        </p>
      </div>
    );
  }

  const linhas = montarLinhas(
    cfg,
    dRes.data ?? [],
    new Map((pRes.data ?? []).map((p) => [p.id, p])),
    new Map((mRes.data ?? []).map((m) => [m.id, m]))
  );
  const colunas = catalogoDe(cfg.granularidade).filter((c) =>
    cfg.colunas.includes(c.id)
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col px-4 py-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="w-full">
          <header className="mx-auto max-w-6xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" width={1920} height={262} className="h-7 w-auto" />
            <p className="mt-1.5 text-xs text-muted-foreground">Programa de Mentoria Social</p>
          </header>

          <div className="mx-auto mt-6 max-w-6xl">
            <h1 className="text-xl font-semibold">
              {cfg.turma ?? "Todas as turmas"} · resumo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados vivos, atualizados em {formatDateTime(new Date().toISOString())}.
              Link não listado — trate como documento interno.
            </p>
          </div>

          <div className="mt-5 border-y border-border bg-card/40 py-3 sm:-mx-4 sm:px-4">
            <div className="mx-auto max-w-6xl">
              <RelatorioCanvas
                key={`resumo-${cfg.turma ?? "todas"}-${cfg.granularidade}`}
                colunas={colunas}
                linhas={linhas}
                storageKey={`resumo-${cfg.turma ?? "todas"}-${cfg.granularidade}`}
              />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
