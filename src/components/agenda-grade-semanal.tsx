import {
  diaSemanaDe,
  formatDiaNum,
  formatDiaSemana,
  formatMesAbrev,
} from "@/lib/ciclo";
import {
  EIXO_FIM_MIN,
  EIXO_INI_MIN,
  type BlocoPosicionado,
  type DiaGrade,
} from "@/lib/agenda-especialista";
import { cn } from "@/lib/utils";

/** Escala do eixo: 1h = 48px — a régua da grade e dos blocos absolutos.
 *  Exportadas junto com `posicao`/`intervalo`/`fmtHora` pro editor da grade
 *  (agenda-grade-edicao) desenhar com a mesma régua — o componente segue
 *  server-safe (só constantes e funções puras saem daqui). */
export const HORA_PX = 48;
export const ALTURA_PX = ((EIXO_FIM_MIN - EIXO_INI_MIN) / 60) * HORA_PX; // 12h × 48 = 576
export const PX_POR_MIN = HORA_PX / 60;
/** Rótulos do gutter: um por hora, 8h–19h (a linha das 20h é a borda). */
export const HORAS = Array.from(
  { length: (EIXO_FIM_MIN - EIXO_INI_MIN) / 60 },
  (_, i) => EIXO_INI_MIN / 60 + i
);

/** "18h" / "18h30" — formato compacto de hora nos blocos e nas pills. */
export function fmtHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export const intervalo = (b: BlocoPosicionado) =>
  `${fmtHora(b.iniMin)}–${fmtHora(b.fimMin)}`;

/** "06/out" — cabeçalho do dia sem o ano (a semana já data o conjunto; o
 *  mês abreviado desambigua a virada de mês dentro dela). */
const diaMes = (iso: string) => `${formatDiaNum(iso)}/${formatMesAbrev(iso)}`;

/** "Terça-feira" — o dia por extenso capitalizado pros aria-labels. */
function diaLongo(iso: string): string {
  const s = formatDiaSemana(iso);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Posição absoluta do bloco dentro da coluna, clampada ao eixo — o que a
 *  lib manda pode transbordar (sessão 20h30) e o que sai da grade some. */
export function posicao(b: BlocoPosicionado): { top: number; height: number } | null {
  const top = Math.max(0, (b.iniMin - EIXO_INI_MIN) * PX_POR_MIN);
  const bottom = Math.min(ALTURA_PX, (b.fimMin - EIXO_INI_MIN) * PX_POR_MIN);
  const height = bottom - top;
  return height > 0 ? { top, height } : null;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Grade visual da semana do especialista (0073): a disponibilidade oferecida
 *  (janelas + extras), os bloqueios datados, as sessões já marcadas (dele e
 *  as DPP do híbrido) e os intervalos livres que os jovens veem como slot.
 *  Leitura pura — sem estado, sem handlers: server-safe. */
export function AgendaGradeSemanal({ dias }: { dias: DiaGrade[] }) {
  if (dias.length === 0) return null;

  const nJanelas = dias.reduce((s, d) => s + d.janelas.length, 0);
  const nSessoes = dias.reduce((s, d) => s + d.sessoes.length, 0);
  const nLivres = dias.reduce((s, d) => s + d.livres.length, 0);
  const nBloqueios = dias.reduce((s, d) => s + d.bloqueios.length, 0);
  const resumo =
    `Semana de ${diaMes(dias[0].iso)} a ${diaMes(dias[dias.length - 1].iso)}: ` +
    `${plural(nJanelas, "janela de disponibilidade", "janelas de disponibilidade")}, ` +
    `${plural(nSessoes, "sessão marcada", "sessões marcadas")}, ` +
    `${plural(nLivres, "intervalo livre", "intervalos livres")}` +
    (nBloqueios > 0 ? `, ${plural(nBloqueios, "bloqueio", "bloqueios")}` : "") +
    ".";

  return (
    <section aria-label="Grade da semana">
      <p className="sr-only">{resumo}</p>

      {/* ---------- desktop: régua + 7 colunas ---------- */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))]">
          {/* canto do gutter — vazio, segura a 1ª coluna na linha do header */}
          <span aria-hidden />
          {dias.map((d) => (
            <div
              key={d.iso}
              className={cn(
                "px-1 py-1.5 text-center",
                d.ehHoje && "bg-[var(--brand-ink)] text-white"
              )}
            >
              <i
                className={cn(
                  "block text-[10px] font-medium uppercase tracking-wider not-italic",
                  d.ehHoje ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {diaSemanaDe(d.iso)}
              </i>
              <b className="block text-xs font-semibold tabular-nums">
                {diaMes(d.iso)}
              </b>
            </div>
          ))}

          {/* gutter de horas — cada rótulo centrado na sua linha-guia */}
          <div className="relative" style={{ height: ALTURA_PX }} aria-hidden>
            {HORAS.map((h, i) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] leading-none text-muted-foreground"
                style={{ top: i * HORA_PX }}
              >
                {h}h
              </span>
            ))}
          </div>

          {dias.map((d) => {
            const dia = diaLongo(d.iso);
            return (
              <div
                key={d.iso}
                role="group"
                aria-label={dia}
                className="relative border-l border-border/60"
                style={{
                  height: ALTURA_PX,
                  backgroundImage:
                    "linear-gradient(var(--border) 1px, transparent 1px)",
                  backgroundSize: `100% ${HORA_PX}px`,
                }}
              >
                {d.janelas.map((j, i) => {
                  const pos = posicao(j);
                  if (!pos) return null;
                  return (
                    <div
                      key={`j${i}`}
                      role="img"
                      aria-label={`${dia} ${intervalo(j)} ${j.tipo === "extra" ? "extra" : "disponível"}`}
                      className={cn(
                        "absolute inset-x-0.5 overflow-hidden rounded-lg border border-[var(--ok)]/50 bg-[var(--ok)]/12",
                        j.tipo === "extra" && "border-dashed"
                      )}
                      style={pos}
                    >
                      {j.rotulo && pos.height >= 20 && (
                        <span className="absolute inset-x-1 bottom-0.5 truncate text-[11px] leading-none text-[var(--ok-text)]">
                          {j.rotulo}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* o bloqueio hachura por cima da janela que ele rasga —
                    sutil, sem texto (a label é sr-only) */}
                {d.bloqueios.map((b, i) => {
                  const pos = posicao(b);
                  if (!pos) return null;
                  return (
                    <div
                      key={`b${i}`}
                      role="img"
                      aria-label={`${dia} bloqueado ${intervalo(b)}`}
                      className="hatch-recesso absolute inset-x-0.5 rounded-lg"
                      style={pos}
                    />
                  );
                })}

                {d.livres.map((l, i) => {
                  const pos = posicao(l);
                  if (!pos) return null;
                  return (
                    <div
                      key={`l${i}`}
                      role="img"
                      aria-label={`${dia} · Horários livres ${intervalo(l)}`}
                      className="absolute inset-x-0.5 rounded-lg border-[1.5px] border-dashed border-[var(--ok)]/60"
                      style={pos}
                    >
                      {pos.height >= 24 && (
                        <span className="absolute inset-x-0 top-0.5 truncate text-center text-[10px] leading-none text-[var(--ok-text)]">
                          {intervalo(l)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* sessões por último — ficam acima das janelas que ocupam */}
                {d.sessoes.map((s, i) => {
                  const pos = posicao(s);
                  if (!pos) return null;
                  const esp = s.trilha === "especialista";
                  const feita = s.status === "realizado";
                  return (
                    <div
                      key={`s${i}`}
                      role="img"
                      aria-label={
                        esp
                          ? `Sessão ${s.rotulo} ${fmtHora(s.iniMin)}${feita ? " · realizada" : ""}`
                          : `Compromisso DPP · ${s.rotulo} ${fmtHora(s.iniMin)}${feita ? " · realizado" : ""}`
                      }
                      className={cn(
                        "absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-0.5",
                        feita && "opacity-70",
                        esp
                          ? "bg-[var(--brand-ink)] text-white"
                          : "border border-border bg-muted text-muted-foreground"
                      )}
                      style={pos}
                    >
                      <b className="block truncate text-[11px] font-semibold leading-tight">
                        {esp ? "" : "DPP · "}
                        {s.rotulo}
                      </b>
                      {pos.height >= 34 && (
                        <span
                          className={cn(
                            "block truncate text-[10px] leading-tight tabular-nums",
                            esp ? "text-white/75" : "text-muted-foreground"
                          )}
                        >
                          {intervalo(s)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- mobile: card por dia, pills em vez de blocos ---------- */}
      <ul className="space-y-2 md:hidden">
        {dias.map((d) => {
          const vazio =
            d.janelas.length === 0 &&
            d.sessoes.length === 0 &&
            d.bloqueios.length === 0 &&
            d.livres.length === 0;
          return (
            <li
              key={d.iso}
              className={cn(
                "rounded-xl border border-border bg-card px-3 py-2.5",
                d.ehHoje && "border-2 border-[var(--brand-ink)]"
              )}
            >
              <p className="flex items-baseline gap-1.5">
                <i className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground not-italic">
                  {diaLongo(d.iso)}
                </i>
                <b className="text-sm font-semibold tabular-nums">
                  {diaMes(d.iso)}
                </b>
                {d.ehHoje && (
                  <span className="text-[11px] font-medium text-[var(--ok-text)]">
                    · hoje
                  </span>
                )}
              </p>
              {vazio ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Sem janela
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {d.janelas.map((j, i) => (
                    <li
                      key={`j${i}`}
                      aria-label={`${diaLongo(d.iso)} ${intervalo(j)} ${j.tipo === "extra" ? "extra" : "disponível"}`}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--ok)]/10 px-2.5 py-1 text-xs font-medium text-[var(--ok-text)] sm:min-h-8",
                        j.tipo === "extra" &&
                          "border border-dashed border-[var(--ok)]/50"
                      )}
                    >
                      <b className="font-semibold tabular-nums">
                        {intervalo(j)}
                      </b>
                      <span>{j.tipo === "extra" ? "Extra" : "Disponível"}</span>
                    </li>
                  ))}
                  {d.sessoes.map((s, i) => {
                    const esp = s.trilha === "especialista";
                    return (
                      <li
                        key={`s${i}`}
                        aria-label={
                          esp
                            ? `Sessão ${s.rotulo} ${fmtHora(s.iniMin)}`
                            : `Compromisso DPP · ${s.rotulo} ${fmtHora(s.iniMin)}`
                        }
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:min-h-8",
                          esp
                            ? "bg-[var(--brand-ink)] text-white"
                            : "border border-border bg-muted text-muted-foreground"
                        )}
                      >
                        <b className="font-semibold tabular-nums">
                          {fmtHora(s.iniMin)}
                        </b>
                        <span>
                          {esp ? "" : "DPP · "}
                          {s.rotulo}
                        </span>
                      </li>
                    );
                  })}
                  {d.bloqueios.map((b, i) => (
                    <li
                      key={`b${i}`}
                      className="inline-flex min-h-11 items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:min-h-8"
                    >
                      Bloqueio {intervalo(b)}
                    </li>
                  ))}
                  {d.livres.length > 0 && (
                    <li className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-dashed border-[var(--ok)]/60 px-2.5 py-1 text-xs font-medium text-[var(--ok-text)] sm:min-h-8">
                      {d.livres.length === 1
                        ? "1 intervalo livre"
                        : `${d.livres.length} intervalos livres`}
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* legenda — os swatches repetem a tinta de cada bloco */}
      <ul
        aria-hidden
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground"
      >
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] border border-[var(--ok)]/50 bg-[var(--ok)]/12" />
          Disponível
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] border border-dashed border-[var(--ok)]/50 bg-[var(--ok)]/12" />
          Extra (dia específico)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="hatch-recesso size-3 rounded-[4px] border border-border" />
          Bloqueio
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-[var(--brand-ink)]" />
          Sessão
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] border-[1.5px] border-dashed border-[var(--ok)]/60" />
          Livre p/ agendar
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] border border-border bg-muted" />
          Compromisso DPP
        </li>
      </ul>
    </section>
  );
}
