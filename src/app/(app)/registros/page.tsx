import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  getAlertasRegistros,
  getCicloEventos,
  getDuplasOpcoes,
  getMe,
  getRegistros,
  REGISTROS_PAGINA,
  type FiltrosRegistro,
  type RegistroResumo,
} from "@/lib/queries";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
  totalEncontros,
} from "@/lib/ciclo";
import { RegistrosFiltros } from "@/components/registros-filtros";
import { RegistroRow } from "@/components/registro-row";
import type { AvaliacaoJovem, Dificuldade } from "@/lib/types";

export const metadata: Metadata = { title: "Registros" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** PostgREST `or()` quebra com vírgula/parenteses/curinga no valor — limpa. */
function saneiaBusca(q: string): string {
  return q.replace(/[%(),."\\]/g, " ").replace(/\s+/g, " ").trim();
}

function parseFiltros(
  p: Record<string, string | string[] | undefined>,
  maxEncontro: number
): FiltrosRegistro {
  const f: FiltrosRegistro = { pagina: 1 };
  const encontro = Number(primeiro(p.encontro));
  if (Number.isInteger(encontro) && encontro >= 1 && encontro <= maxEncontro)
    f.encontro = encontro;
  const avaliacao = primeiro(p.avaliacao);
  if (avaliacao && avaliacao in AVALIACAO_LABEL)
    f.avaliacao = avaliacao as AvaliacaoJovem;
  if (primeiro(p.apoio) === "1") f.apoio = true;
  const dificuldade = primeiro(p.dificuldade);
  if (dificuldade === "com" || (dificuldade && dificuldade in DIFICULDADE_LABEL))
    f.dificuldade = dificuldade as Dificuldade | "com";
  const dupla = primeiro(p.dupla);
  if (dupla && UUID_RE.test(dupla)) f.dupla = dupla;
  const q = saneiaBusca(primeiro(p.q) ?? "");
  if (q) f.q = q.slice(0, 80);
  const pagina = Number(primeiro(p.pagina));
  if (Number.isInteger(pagina) && pagina > 1) f.pagina = Math.min(pagina, 10);
  return f;
}

/** Apoio → avaliação baixa → regular → dificuldade: quem precisa de olho sobe. */
function scoreAlerta(r: RegistroResumo): number {
  if (r.precisa_apoio) return 4;
  if (r.avaliacao === "baixa") return 3;
  if (r.avaliacao === "regular") return 2;
  if (r.dificuldade && r.dificuldade !== "nenhuma") return 1;
  return 0;
}

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao" && me?.role !== "supervisor") redirect("/");
  const souCoord = me.role === "coordenacao";

  const eventos = await getCicloEventos();
  const maxEncontro = totalEncontros(eventos);
  const filtros = parseFiltros(await searchParams, maxEncontro);

  const [{ itens, total }, duplas, alertas] = await Promise.all([
    getRegistros(filtros),
    getDuplasOpcoes(),
    getAlertasRegistros(),
  ]);

  const eventoPorNumero = new Map(
    eventos.filter((e) => e.tipo === "encontro" && e.numero != null).map((e) => [e.numero!, e])
  );
  const grupos = new Map<number, RegistroResumo[]>();
  for (const r of itens) {
    const n = r.encontro?.numero ?? 0;
    const g = grupos.get(n) ?? [];
    g.push(r);
    grupos.set(n, g);
  }
  const gruposOrd = [...grupos.entries()].sort((a, b) => b[0] - a[0]);
  for (const regs of gruposOrd.map(([, g]) => g))
    regs.sort(
      (a, b) =>
        scoreAlerta(b) - scoreAlerta(a) ||
        b.created_at.localeCompare(a.created_at)
    );

  const temFiltro = !!(
    filtros.encontro ||
    filtros.avaliacao ||
    filtros.apoio ||
    filtros.dificuldade ||
    filtros.dupla ||
    filtros.q
  );
  const hrefPagina = (pagina: number) => {
    const p = new URLSearchParams();
    if (filtros.encontro) p.set("encontro", String(filtros.encontro));
    if (filtros.avaliacao) p.set("avaliacao", filtros.avaliacao);
    if (filtros.apoio) p.set("apoio", "1");
    if (filtros.dificuldade) p.set("dificuldade", filtros.dificuldade);
    if (filtros.dupla) p.set("dupla", filtros.dupla);
    if (filtros.q) p.set("q", filtros.q);
    p.set("pagina", String(pagina));
    return `/registros?${p}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Registros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {souCoord
            ? "O que os mentores reportaram em cada encontro — todas as duplas"
            : "O que os mentores reportaram em cada encontro — suas duplas"}
        </p>
      </header>

      {/* triagem: contagens globais do papel, clicáveis pro filtro */}
      {(alertas.apoio > 0 || alertas.baixa > 0 || alertas.comDificuldade > 0) && (
        <div className="flex flex-wrap gap-2" aria-label="Sinais de atenção">
          {alertas.apoio > 0 && (
            <Link
              href="/registros?apoio=1"
              className="inline-flex items-center rounded-full border border-[var(--danger)]/50 px-3 py-1 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/5"
            >
              {alertas.apoio}{" "}
              {alertas.apoio === 1 ? "pedido de apoio" : "pedidos de apoio"} em
              aberto
            </Link>
          )}
          {alertas.baixa > 0 && (
            <Link
              href="/registros?avaliacao=baixa"
              className="inline-flex items-center rounded-full border border-[var(--warn)]/60 px-3 py-1 text-xs font-medium text-[var(--warn-text)] transition-colors hover:bg-[var(--warn)]/5"
            >
              {alertas.baixa}{" "}
              {alertas.baixa === 1 ? "avaliação baixa" : "avaliações baixas"}
            </Link>
          )}
          {alertas.comDificuldade > 0 && (
            <Link
              href="/registros?dificuldade=com"
              className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {alertas.comDificuldade} com dificuldade sinalizada
            </Link>
          )}
        </div>
      )}

      <RegistrosFiltros filtros={filtros} duplas={duplas} maxEncontro={maxEncontro} />

      {itens.length === 0 ? (
        <div className="rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <p className="font-medium">
            {temFiltro
              ? "Nenhum registro com esses filtros."
              : souCoord
                ? "Nenhum registro entregue ainda."
                : "Nenhum registro nas suas duplas ainda."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {temFiltro ? (
              <Link href="/registros" className="underline underline-offset-2">
                Limpar filtros
              </Link>
            ) : (
              "Os registros semanais dos mentores aparecem aqui conforme forem enviados."
            )}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "registro" : "registros"}
            {itens.length < total ? ` · mostrando ${itens.length}` : ""}
          </p>
          {gruposOrd.map(([numero, regs], i) => (
            <section
              key={numero}
              className="animate-enter space-y-2"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {numero}º encontro
                {eventoPorNumero.get(numero)
                  ? ` · ${eventoPorNumero.get(numero)!.titulo}`
                  : ""}
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
                {regs.map((r) => (
                  <RegistroRow key={r.id} r={r} souCoord={souCoord} />
                ))}
              </div>
            </section>
          ))}
          {itens.length < total && (
            <div className="flex justify-center pt-1">
              <Link
                href={hrefPagina(filtros.pagina + 1)}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Mostrar mais ({Math.min(total - itens.length, REGISTROS_PAGINA)}{" "}
                restantes)
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
