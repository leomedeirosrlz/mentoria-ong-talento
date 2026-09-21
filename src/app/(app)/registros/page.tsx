import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr";
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
  formatDiaNum,
  formatMesAbrev,
  registroTardio,
  totalEncontros,
} from "@/lib/ciclo";
import { RegistrosFiltros } from "@/components/registros-filtros";
import { buttonVariants } from "@/components/ui/button";
import { RegistroCard } from "@/components/registro-card";
import { cn } from "@/lib/utils";
import type { AvaliacaoJovem, Dificuldade } from "@/lib/types";

export const metadata: Metadata = { title: "Registros" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** PostgREST `or()` quebra com vírgula/parenteses/curinga/`::` no valor — limpa. */
function saneiaBusca(q: string): string {
  return q.replace(/[%(),."\\:]/g, " ").replace(/\s+/g, " ").trim();
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
  if (avaliacao && Object.hasOwn(AVALIACAO_LABEL, avaliacao))
    f.avaliacao = avaliacao as AvaliacaoJovem;
  if (primeiro(p.apoio) === "1") f.apoio = true;
  if (primeiro(p.tardio) === "1") f.tardio = true;
  const dificuldade = primeiro(p.dificuldade);
  if (dificuldade === "com" || (dificuldade && Object.hasOwn(DIFICULDADE_LABEL, dificuldade)))
    f.dificuldade = dificuldade as Dificuldade | "com";
  const dupla = primeiro(p.dupla);
  if (dupla && UUID_RE.test(dupla)) f.dupla = dupla;
  const q = saneiaBusca(primeiro(p.q) ?? "");
  if (q) f.q = q.slice(0, 80);
  const pagina = Number(primeiro(p.pagina));
  if (Number.isInteger(pagina) && pagina > 1) f.pagina = Math.min(pagina, 50);
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

/** A data que a timeline exibe — quando o encontro aconteceu de fato. */
function aconteceuEmDe(r: RegistroResumo): string {
  return (
    r.encontro?.realizado_em ?? r.encontro?.data_hora ?? r.created_at
  );
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

  const tituloEncontro = new Map(
    eventos
      .filter((e) => e.tipo === "encontro" && e.numero != null)
      .map((e) => [e.numero!, e.titulo])
  );

  // o banco já ordena por realizado_em; o sort estável acerta a fatia
  // carregada e empurra quem pede atenção pra cima dentro do mesmo dia
  const ordenados = [...itens].sort(
    (a, b) =>
      aconteceuEmDe(b).localeCompare(aconteceuEmDe(a)) ||
      scoreAlerta(b) - scoreAlerta(a) ||
      b.created_at.localeCompare(a.created_at)
  );

  const temFiltro = !!(
    filtros.encontro ||
    filtros.avaliacao ||
    filtros.apoio ||
    filtros.tardio ||
    filtros.dificuldade ||
    filtros.dupla ||
    filtros.q
  );
  const hrefPagina = (pagina: number) => {
    const p = new URLSearchParams();
    if (filtros.encontro) p.set("encontro", String(filtros.encontro));
    if (filtros.avaliacao) p.set("avaliacao", filtros.avaliacao);
    if (filtros.apoio) p.set("apoio", "1");
    if (filtros.tardio) p.set("tardio", "1");
    if (filtros.dificuldade) p.set("dificuldade", filtros.dificuldade);
    if (filtros.dupla) p.set("dupla", filtros.dupla);
    if (filtros.q) p.set("q", filtros.q);
    p.set("pagina", String(pagina));
    return `/registros?${p}`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Registros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {souCoord
            ? "O que os mentores reportaram em cada encontro — todas as duplas"
            : "O que os mentores reportaram em cada encontro — suas duplas"}
        </p>
      </header>

      {/* resumo operacional: o que pede ação vem antes da busca; clicar num
          número aplica o filtro correspondente */}
      {(total > 0 || alertas.apoio > 0 || alertas.tardios > 0) && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {temFiltro ? (
            <Link
              href="/registros"
              scroll={false}
              className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              {total} {total === 1 ? "registro" : "registros"}
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              {total} {total === 1 ? "registro" : "registros"}
            </span>
          )}
          {itens.length < total && ` · mostrando ${itens.length}`}
          {alertas.apoio > 0 && (
            <>
              {" · "}
              <Link
                href="/registros?apoio=1"
                scroll={false}
                aria-current={filtros.apoio ? "true" : undefined}
                className="font-medium text-[var(--danger)] underline underline-offset-4 transition-colors hover:text-[var(--danger)]/80"
              >
                {alertas.apoio}{" "}
                {alertas.apoio === 1 ? "apoio em aberto" : "apoios em aberto"}
              </Link>
            </>
          )}
          {alertas.tardios > 0 && (
            <>
              {" · "}
              <Link
                href="/registros?tardio=1"
                scroll={false}
                aria-current={filtros.tardio ? "true" : undefined}
                className="font-medium text-[var(--warn-text)] underline underline-offset-4 transition-colors hover:text-[var(--warn-text)]/80"
              >
                {alertas.tardios}{" "}
                {alertas.tardios === 1 ? "registro tardio" : "registros tardios"}
              </Link>
            </>
          )}
        </p>
      )}

      <RegistrosFiltros filtros={filtros} duplas={duplas} maxEncontro={maxEncontro} />

      {ordenados.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <ClipboardText
            size={32}
            aria-hidden
            className="text-muted-foreground/50"
          />
          <p className="mt-3 font-medium">
            {temFiltro
              ? "Nenhum registro com esses filtros."
              : souCoord
                ? "Nenhum registro entregue ainda."
                : "Nenhum registro nas suas duplas ainda."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {temFiltro
              ? "Tente ajustar ou limpar os filtros."
              : "Os registros semanais dos mentores aparecem aqui conforme forem enviados."}
          </p>
          {temFiltro && (
            <Link
              href="/registros"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4"
              )}
            >
              Limpar filtros
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* timeline: o rail mostra o dia em que o encontro aconteceu e a
              linha conecta os nós — a página conta a sequência, não uma
              coleção genérica de cards */}
          <ol>
            {ordenados.map((r, i) => {
              const aconteceuEm = aconteceuEmDe(r);
              const ultimo = i === ordenados.length - 1;
              const tardio = registroTardio(r, r.encontro);
              return (
                <li
                  key={r.id}
                  className="animate-enter flex gap-3 sm:gap-4"
                  style={{ "--i": Math.min(i, 10) } as CSSProperties}
                >
                  <div
                    aria-hidden
                    className="flex w-10 shrink-0 flex-col items-center sm:w-12"
                  >
                    <p className="pt-4 text-center leading-none">
                      <span className="block text-sm font-semibold tabular-nums">
                        {formatDiaNum(aconteceuEm)}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {formatMesAbrev(aconteceuEm)}
                      </span>
                    </p>
                    {/* precedência do nó: apoio > tardio > ok — a cor é sinal
                        secundário; os badges no card carregam a informação */}
                    <span
                      className={cn(
                        "mt-2 size-2 shrink-0 rounded-full",
                        r.precisa_apoio
                          ? "bg-[var(--danger)]"
                          : tardio
                            ? "bg-[var(--warn)]"
                            : "bg-[var(--ok)]"
                      )}
                    />
                    {!ultimo && (
                      <span className="mt-1.5 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className={cn("min-w-0 flex-1", !ultimo && "pb-5")}>
                    <RegistroCard
                      r={r}
                      tituloEncontro={
                        tituloEncontro.get(r.encontro?.numero ?? 0) ?? null
                      }
                      souCoord={souCoord}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          {itens.length < total && (
            <div className="flex justify-center pt-1">
              <Link
                href={hrefPagina(filtros.pagina + 1)}
                scroll={false}
                className={buttonVariants({ variant: "outline" })}
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
