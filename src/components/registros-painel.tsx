"use client";

// "Panorama do ciclo" (REALIZA-198, mock registros/v2): cobertura por
// encontro + ★ do jovem + semáforo das duplas — tudo derivado do mesmo
// payload agregado no servidor (getRegistrosPanorama), nunca da fatia
// paginada da lista. Os toggles de métrica/modo são ESTADO LOCAL: o payload
// já carrega todos os contadores por célula, então trocar de métrica é
// instantâneo e os valores interpolam (transições CSS + MotionValues —
// reduced-motion zera as duas vias pelo guard global e pelo MotionConfig
// do layout).

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Info } from "@phosphor-icons/react";
import { Sparkline, type SerieSpark } from "@/components/viz/sparkline";
import { SaudePrograma } from "@/components/saude-programa";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DIAS_SEMANA_CURTOS,
  diaSemanaDe,
  formatDiaMes,
  toDateStr,
} from "@/lib/ciclo";
import type { SaudeRecorte } from "@/lib/agenda-coordenacao";
import { cn } from "@/lib/utils";
import type {
  PanoramaCelula,
  RegistrosPanorama,
} from "@/lib/registros";

// ---------- métricas / modos parametrizáveis ----------

const METRICAS_BARRA = [
  {
    // um gráfico só pra "aconteceu" e "registrou" (REALIZA-211): cor cheia
    // = realizado com registro, cor clara = aconteceu e falta o registro
    id: "entregues",
    rotulo: "Encontros",
    titulo: "Encontros realizados e registrados",
    legendaFeito: "registrados",
    ariaFeito: "registros entregues",
  },
  {
    id: "avaliados",
    rotulo: "Avaliações ★",
    titulo: "Avaliações do jovem por encontro",
    legendaFeito: "avaliações do jovem",
    ariaFeito: "avaliações do jovem",
  },
] as const;
type MetricaBarra = (typeof METRICAS_BARRA)[number]["id"];

const MODOS_LINHA = [
  { id: "media", rotulo: "Média do jovem" },
  { id: "individual", rotulo: "Cada avaliação" },
  { id: "mentor", rotulo: "Visão do mentor" },
] as const;
type ModoLinha = (typeof MODOS_LINHA)[number]["id"];

/** Cor da turma pelo índice no eixo — chart-1×chart-2 é a gramática T1×T2
 *  dos mocks aprovados; o ciclo cobre até 5 cronogramas simultâneos. */
const corTurma = (i: number) => `var(--chart-${(i % 5) + 1})`;

const feitoDe = (c: PanoramaCelula, m: MetricaBarra): number =>
  m === "avaliados" ? c.avaliados : c.entregues;
/** aconteceu mas o mentor ainda não registrou — a faixa clara da barra. */
const semRegistroDe = (c: PanoramaCelula): number =>
  Math.max(c.realizados - c.entregues, 0);

const mediaDe = (vs: number[]): number | null =>
  vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;

const fmt1 = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "hoje" / "amanhã" / dia da semana curto — a anotação sob o encontro que
 *  cai nesta semana (a hachura "a acontecer" do mock). */
function rotuloQuando(dataOficial: string, hoje: string): string {
  if (dataOficial === hoje) return "hoje";
  const amanha = toDateStr(
    new Date(new Date(`${hoje}T12:00:00Z`).getTime() + 86400000)
  );
  if (dataOficial === amanha) return "amanhã";
  return `${DIAS_SEMANA_CURTOS[diaSemanaDe(dataOficial)]} ${formatDiaMes(dataOficial)}`;
}

/** Número que interpola ao trocar de métrica/recorte — useSpring suaviza a
 *  leitura; reduced-motion cai no valor direto. */
function NumeroVivo({
  valor,
  formato = (v) => String(Math.round(v)),
  className,
}: {
  valor: number;
  formato?: (v: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(valor);
  const spring = useSpring(mv, { stiffness: 240, damping: 30 });
  const txt = useTransform(spring, (v) => formato(v));
  useEffect(() => {
    mv.set(valor);
  }, [valor, mv]);
  if (reduced)
    return <span className={cn("tabular-nums", className)}>{formato(valor)}</span>;
  return <motion.span className={cn("tabular-nums", className)}>{txt}</motion.span>;
}

/** Segmented control pequeno do card — mesma gramática das pills da página
 *  mas como botão de estado local (não navega). */
function SegLocal<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: readonly { id: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="scroll-fina inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-background p-0.5"
    >
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-11 rounded-full px-3 text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:px-2.5",
            valor === o.id
              ? "bg-muted text-foreground"
              : "hover:text-foreground"
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** "Como calculamos": as regras da leitura ficam atrás de um popover, não no
 *  corpo do card. */
function ComoCalculamos({
  itens,
}: {
  itens: { termo: string; texto: string }[];
}) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8">
        <Info size={14} aria-hidden />
        Como calculamos
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <p className="text-sm font-semibold">Como calculamos</p>
        <dl className="mt-3 grid gap-3 text-sm">
          {itens.map((r) => (
            <div key={r.termo}>
              <dt className="font-semibold">{r.termo}</dt>
              <dd className="mt-0.5 text-muted-foreground">{r.texto}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function RegistrosPainel({
  panorama,
  hoje,
  saude,
}: {
  panorama: RegistrosPanorama;
  /** "YYYY-MM-DD" do servidor — a régua de hoje/semana não depende do fuso
   *  da máquina cliente nem difere entre SSR e hidratação. */
  hoje: string;
  /** situação das duplas no recorte: `saudeDoRecorte` no servidor, o mesmo
   *  resumo de /duplas, /agenda e da home */
  saude: SaudeRecorte;
}) {
  const [metrica, setMetrica] = useState<MetricaBarra>("entregues");
  const [modoLinha, setModoLinha] = useState<ModoLinha>("media");
  const { slots, turmas, espNoRecorte } = panorama;
  const met = METRICAS_BARRA.find((m) => m.id === metrica)!;

  const corDe = useMemo(
    () =>
      new Map(
        turmas.map((t, i) => [t.cronogramaId, corTurma(i)])
      ),
    [turmas]
  );

  // ---------- cobertura: colunas por encontro ----------
  const PLOT_H = 150;
  // escala por denominador: a coluna mais alta (soma das esperadas do slot)
  // encosta no topo do plot — o trilho ENCOLHE com o esperado (pausas,
  // turma ainda não chegou) em vez de normalizar pro mesmo tamanho
  const maxTrilho = Math.max(
    1,
    ...slots.map((s) => {
      const vivos = s.celulas.filter((c) => c.estado !== "futuro");
      return vivos.length
        ? vivos.reduce((x, c) => x + c.esperadas, 0)
        : s.celulas.reduce((x, c) => x + c.esperadas, 0); // coluna toda futura
    })
  );
  const escala = PLOT_H / maxTrilho;
  const passo =
    maxTrilho <= 5 ? 1 : maxTrilho <= 12 ? 2 : maxTrilho <= 25 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = passo; v <= maxTrilho; v += passo) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxTrilho && maxTrilho > passo)
    ticks.push(maxTrilho);

  // "N de M" honesto: o denominador é só o VENCIDO — a semana corrente
  // ainda não é dívida (o mock lê "138 de 143", não "de 168"). Ela entra
  // como contagem à parte ("K a acontecer"), explícita em vez de inflar M.
  const totEsp = slots.reduce(
    (s, sl) =>
      s +
      sl.celulas
        .filter((c) => c.estado === "vencido")
        .reduce((x, c) => x + c.esperadas, 0),
    0
  );
  const totFeito = slots.reduce(
    (s, sl) =>
      s +
      sl.celulas
        .filter((c) => c.estado === "vencido")
        .reduce((x, c) => x + feitoDe(c, metrica), 0),
    0
  );
  // encontros esperados na semana corrente (independe da métrica — é o
  // tamanho da faixa hachurada, não o que falta entregar dela)
  const totSemana = slots.reduce(
    (s, sl) =>
      s +
      sl.celulas
        .filter((c) => c.estado === "semana")
        .reduce((x, c) => x + c.esperadas, 0),
    0
  );
  const pct = totEsp ? Math.round((totFeito / totEsp) * 100) : null;

  // texto completo da coluna pro tooltip/aria (o "N de M" com o detalhe por
  // turma — a falta nomeada, nunca só a cor)
  const tituloColuna = (s: (typeof slots)[number]): string => {
    const partes = s.celulas.map((c) => {
      const t = turmas.find((x) => x.cronogramaId === c.cronogramaId);
      const nome = t?.rotulo ?? "—";
      if (c.estado === "futuro")
        return `${nome} ainda não chegou (${formatDiaMes(c.dataOficial)})`;
      const base = `${nome} ${feitoDe(c, metrica)} de ${c.esperadas} ${met.ariaFeito}`;
      if (c.estado === "semana")
        return `${base}, ${rotuloQuando(c.dataOficial, hoje)}`;
      if (c.totalPendentes > 0)
        // a lista é sempre "quem não entregou o registro" — fora do modo
        // entregues o prefixo nomeia a métrica certa em vez de insinuar
        // que a falta é do indicador ligado (realizado/avaliação)
        return (
          `${base}, ${metrica === "entregues" ? "falta" : "registro pendente"}: ${c.pendentes.join(", ")}` +
          (c.totalPendentes > c.pendentes.length
            ? ` +${c.totalPendentes - c.pendentes.length}`
            : "")
        );
      return base;
    });
    return `${s.numero}º encontro: ${partes.join(" · ")}`;
  };

  const ariaBarras = `Barras por encontro (${met.ariaFeito}): ${slots
    .map((s) => {
      const vivos = s.celulas.filter((c) => c.estado !== "futuro");
      if (!vivos.length) return `${s.numero}º ainda não chegou`;
      const feito = vivos.reduce((x, c) => x + feitoDe(c, metrica), 0);
      const esp = vivos.reduce((x, c) => x + c.esperadas, 0);
      const semana = vivos.some((c) => c.estado === "semana");
      // coluna mista: a célula futura que o tooltip nomeia também entra na
      // narração — "8º 12 de 13 — T2 ainda não chegou"
      const futuras = s.celulas
        .filter((c) => c.estado === "futuro")
        .map(
          (c) =>
            `${
              turmas.find((t) => t.cronogramaId === c.cronogramaId)?.rotulo ??
              "—"
            } ainda não chegou`
        );
      return `${s.numero}º ${feito} de ${esp}${semana ? " (a acontecer)" : ""}${
        futuras.length ? `, ${futuras.join(", ")}` : ""
      }`;
    })
    .join("; ")}`;

  // ---------- linha: ★ do jovem (ou visão do mentor) ----------
  const labelsX = slots.map((s) => `${s.numero}º`);
  const seriesJovem: SerieSpark[] = turmas.map((t, i) => ({
    rotulo: t.rotulo,
    cor: corTurma(i),
    valores: slots.map((s) => {
      const c = s.celulas.find((x) => x.cronogramaId === t.cronogramaId);
      return c ? mediaDe(c.estrelas) : null;
    }),
  }));
  const seriesMentor: SerieSpark[] = turmas.map((t, i) => ({
    // a narração do Sparkline nomeia a fonte ("visão do mentor") — o
    // modo muda os dados mas o aria continuava dizendo só a turma
    rotulo: `${t.rotulo} · visão do mentor`,
    cor: corTurma(i),
    valores: slots.map((s) => {
      const c = s.celulas.find((x) => x.cronogramaId === t.cronogramaId);
      return c ? mediaDe(c.notasMentor) : null;
    }),
  }));
  const todasEstrelas = slots.flatMap((s) =>
    s.celulas.flatMap((c) => c.estrelas)
  );
  const todasNotasMentor = slots.flatMap((s) =>
    s.celulas.flatMap((c) => c.notasMentor)
  );
  const mediaJovem = mediaDe(todasEstrelas);
  const mediaMentor = mediaDe(todasNotasMentor);
  // o ponto de atenção nomeado na headline — o mínimo abaixo da régua,
  // com turma e encontro (mock: "atenção: 3,6 no 4º da T2")
  let atencaoLinha: { slot: number; turma: string; v: number } | null = null;
  if (modoLinha === "media") {
    for (const [i, s] of slots.entries()) {
      for (const [ti, t] of turmas.entries()) {
        const v = seriesJovem[ti].valores[i];
        if (
          v != null &&
          v < 3.8 &&
          (atencaoLinha == null || v < atencaoLinha.v)
        )
          atencaoLinha = { slot: s.numero, turma: t.rotulo, v };
      }
    }
  }
  const temDados = slots.length > 0;
  // trilhas de especialista não têm calendário oficial — a nota explica por
  // que elas nunca viram coluna (vale inclusive quando o recorte não tem
  // encontro nenhum: é justamente o caso que mais confunde)
  const notaEsp =
    espNoRecorte > 0
      ? `${espNoRecorte} ${espNoRecorte === 1 ? "trilha" : "trilhas"} de especialista segue${espNoRecorte === 1 ? "" : "m"} calendário próprio, fora das colunas.`
      : null;
  // o gráfico da linha tem dado pra mostrar? — espelho das condições de
  // empty state abaixo: a legenda do card só faz sentido junto do plot
  const linhaTemDados =
    modoLinha === "individual"
      ? todasEstrelas.length > 0
      : temDados &&
        (modoLinha === "media" ? todasEstrelas : todasNotasMentor).length >
          0;

  const vazio = (msg: string) => (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
      <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">
        {msg}
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* ==================== cobertura por encontro ==================== */}
      <section
        aria-labelledby="pan-bar-t"
        className="animate-enter flex min-w-0 flex-col rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-7 lg:row-start-1"
        style={{ "--i": 0 } as CSSProperties}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
              Cobertura
            </p>
            <h3 id="pan-bar-t" className="mt-0.5 text-base font-semibold">
              {met.titulo}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <SegLocal
                rotulo="Métrica das barras"
                opcoes={METRICAS_BARRA}
                valor={metrica}
                onChange={setMetrica}
              />
              <ComoCalculamos
                itens={[
                  {
                    termo: "Esperado",
                    texto:
                      "Duplas ativas que deviam estar no encontro. Pausada ou encerrada encolhe o trilho, não vira falta.",
                  },
                  {
                    termo: "Parte vazia do trilho",
                    texto:
                      metrica === "avaliados"
                        ? "Encontro sem a avaliação do jovem."
                        : "Encontro que não aconteceu (ou ainda vai acontecer).",
                  },
                  ...(metrica === "entregues"
                    ? [
                        {
                          termo: "Cor cheia × cor clara",
                          texto:
                            "Cheia: o encontro aconteceu e o mentor registrou. Clara: aconteceu, mas o registro ainda não chegou.",
                        },
                      ]
                    : []),
                  ...(notaEsp ? [{ termo: "Trilhas de especialista", texto: notaEsp }] : []),
                ]}
              />
            </div>
          </div>
          {(pct != null || totSemana > 0) && (
            <div className="text-right">
              <b className="block text-3xl font-extrabold leading-none tracking-tight tabular-nums">
                {pct != null ? (
                  <NumeroVivo valor={pct} formato={(v) => `${Math.round(v)}%`} />
                ) : (
                  "—"
                )}
              </b>
              <span className="mt-1 block text-xs font-semibold text-muted-foreground sm:text-[11px]">
                {met.legendaFeito}
                {totEsp > 0 && ` · ${totFeito} de ${totEsp}`}
                {totSemana > 0 && ` · ${totSemana} a acontecer`}
              </span>
            </div>
          )}
        </div>

        {!temDados ? (
          vazio("Nenhum encontro oficial no recorte. Ajuste turma ou período.")
        ) : (
          <>
            <div
              role="img"
              aria-label={ariaBarras}
              className="relative mt-4"
              style={{ height: PLOT_H }}
            >
              {/* gutter do eixo esquerdo + gridlines — mesma régua dos
                  trilhos (posição = valor × escala) */}
              <div className="absolute inset-y-0 right-0 left-6">
                {ticks.map((t) => (
                  <span
                    key={t}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-dashed border-border"
                    style={{ bottom: t * escala }}
                  />
                ))}
                {/* as colunas ficam neste fluxo: flex end ancora tudo na
                    base — o trilho cresce pra cima */}
                <div className="absolute inset-0 flex items-end gap-[3px]">
                  {slots.map((s) => {
                    const vivos = s.celulas.filter(
                      (c) => c.estado !== "futuro"
                    );
                    const esp = vivos.reduce((x, c) => x + c.esperadas, 0);
                    const feito = vivos.reduce(
                      (x, c) => x + feitoDe(c, metrica),
                      0
                    );
                    const semana = vivos.some((c) => c.estado === "semana");
                    const ghost = vivos.length === 0;
                    const trilho = ghost
                      ? s.celulas.reduce((x, c) => x + c.esperadas, 0) * escala
                      : esp * escala;
                    return (
                      <div
                        key={s.numero}
                        title={tituloColuna(s)}
                        className="flex min-w-0 flex-1 flex-col items-center"
                      >
                        {/* "N" só no encontro que cai nesta semana — o
                            número do mock fica no col.now, não em tudo */}
                        <span className="block h-4 text-[10px] font-bold tabular-nums text-foreground">
                          {semana ? feito || esp : ""}
                        </span>
                        <div
                          aria-hidden
                          // o trilho encolhe/cresce com o esperado — altura
                          // transitiona (reduced-motion zera pelo guard global)
                          className={cn(
                            "relative w-full max-w-[34px] overflow-hidden rounded-t-md border border-b-0 transition-[height] duration-500 ease-snappy",
                            ghost
                              ? "border-dashed border-border bg-transparent"
                              : "border-border bg-muted"
                          )}
                          style={{ height: Math.max(trilho, 6) }}
                        >
                          {/* segmentos empilhados por turma: sólido = feito;
                              na semana corrente o que falta vira hachura
                              (a acontecer) em vez de buraco */}
                          {(() => {
                            let base = 0;
                            return vivos.map((c) => {
                              const feitoC = feitoDe(c, metrica);
                              const claro =
                                metrica === "entregues" ? semRegistroDe(c) : 0;
                              const falta = Math.max(c.esperadas - feitoC - claro, 0);
                              const cor = corDe.get(c.cronogramaId)!;
                              const seg = (
                                <span key={c.cronogramaId}>
                                  <span
                                    className="absolute inset-x-0 transition-[height,bottom] duration-500 ease-snappy"
                                    style={{
                                      bottom: base,
                                      height: feitoC * escala,
                                      backgroundColor: cor,
                                    }}
                                  />
                                  {claro > 0 && (
                                    <span
                                      className="absolute inset-x-0 transition-[height,bottom] duration-500 ease-snappy"
                                      style={{
                                        bottom: base + feitoC * escala,
                                        height: claro * escala,
                                        backgroundColor: `color-mix(in srgb, ${cor} 35%, transparent)`,
                                      }}
                                    />
                                  )}
                                  {c.estado === "semana" && falta > 0 && (
                                    <span
                                      className="absolute inset-x-0 transition-[height,bottom] duration-500 ease-snappy"
                                      style={{
                                        bottom: base + (feitoC + claro) * escala,
                                        height: falta * escala,
                                        backgroundImage: `repeating-linear-gradient(135deg, color-mix(in srgb, ${cor} 22%, transparent) 0 5px, transparent 5px 11px)`,
                                      }}
                                    />
                                  )}
                                </span>
                              );
                              base += c.esperadas * escala;
                              return seg;
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* rótulos da escala na gutter */}
              {ticks.map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className="absolute left-0 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground"
                  style={{ bottom: t * escala }}
                >
                  {t}
                </span>
              ))}
            </div>
            {/* rótulos "Nº" + anotação do encontro da semana */}
            <div aria-hidden className="mt-1 flex pl-6">
              {slots.map((s) => {
                const semanas = s.celulas.filter((c) => c.estado === "semana");
                return (
                  <span
                    key={s.numero}
                    className="min-w-0 flex-1 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {s.numero}º
                    {semanas.map((c) => {
                      const t = turmas.find(
                        (x) => x.cronogramaId === c.cronogramaId
                      );
                      return (
                        // a cor da turma vai num dot — var(--chart-N) crua
                        // como texto de 9px não tem contraste (T3 < 2:1)
                        <em
                          key={c.cronogramaId}
                          className="block text-[10px] font-semibold not-italic leading-tight"
                        >
                          <i
                            aria-hidden
                            className="mr-0.5 inline-block size-1.5 rounded-[2px] align-middle"
                            style={{
                              backgroundColor: corDe.get(c.cronogramaId),
                            }}
                          />
                          {rotuloQuando(c.dataOficial, hoje)}
                          {turmas.length > 1 ? ` · ${t?.rotulo}` : ""}
                        </em>
                      );
                    })}
                  </span>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-[11px]">
              {turmas.map((t, i) => (
                <span key={t.cronogramaId} className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden
                    className="inline-block size-2.5 rounded-[3px]"
                    style={{ backgroundColor: corTurma(i) }}
                  />
                  {t.rotulo}
                </span>
              ))}
              {metrica === "entregues" && (
                <span className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden
                    className="inline-block size-2.5 rounded-[3px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${corTurma(0)} 35%, transparent)`,
                    }}
                  />
                  aconteceu, falta o registro
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-[3px] border border-border bg-muted"
                />
                esperado = duplas ativas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-[3px]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, var(--muted-foreground) 0 3px, transparent 3px 7px)",
                    opacity: 0.55,
                  }}
                />
                a acontecer
              </span>
              {slots.some((s) =>
                s.celulas.every((c) => c.estado === "futuro")
              ) && (
                <span className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden
                    className="inline-block size-2.5 rounded-[3px] border border-dashed border-muted-foreground/50"
                  />
                  ainda não chegou
                </span>
              )}
            </div>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-foreground underline-offset-4 hover:underline sm:min-h-8">
                ver dados em tabela
              </summary>
              <div className="scroll-fina mt-2 overflow-x-auto">
                <table className="w-full text-left tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Enc.
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        {metrica === "entregues" ? "Registrados" : met.rotulo}
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Esperados
                      </th>
                      {turmas.map((t) => (
                        <th
                          scope="col"
                          key={t.cronogramaId}
                          className="py-1 pr-3 font-medium"
                        >
                          {t.rotulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => (
                      <tr key={s.numero} className="border-t border-border/50">
                        <td className="py-1 pr-3 font-medium">{s.numero}º</td>
                        {(() => {
                          const vivos = s.celulas.filter(
                            (c) => c.estado !== "futuro"
                          );
                          const feito = vivos.reduce(
                            (x, c) => x + feitoDe(c, metrica),
                            0
                          );
                          const esp = vivos.reduce(
                            (x, c) => x + c.esperadas,
                            0
                          );
                          return (
                            <>
                              <td className="py-1 pr-3">
                                {vivos.length ? feito : "—"}
                              </td>
                              <td className="py-1 pr-3">
                                {vivos.length ? esp : "—"}
                              </td>
                            </>
                          );
                        })()}
                        {turmas.map((t) => {
                          const c = s.celulas.find(
                            (x) => x.cronogramaId === t.cronogramaId
                          );
                          return (
                            <td key={t.cronogramaId} className="py-1 pr-3">
                              {!c
                                ? "—"
                                : c.estado === "futuro"
                                  ? "não chegou"
                                  : c.estado === "semana"
                                    ? `${feitoDe(c, metrica)} de ${c.esperadas} · ${rotuloQuando(c.dataOficial, hoje)}`
                                    : `${feitoDe(c, metrica)}/${c.esperadas}`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      {/* ==================== linha ★ ==================== */}
      <section
        aria-labelledby="pan-lin-t"
        className="animate-enter flex min-w-0 flex-col rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-12 lg:row-start-2"
        style={{ "--i": 1 } as CSSProperties}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
              Avaliação por encontro
            </p>
            <h3 id="pan-lin-t" className="mt-0.5 text-base font-semibold">
              {modoLinha === "mentor"
                ? "Nota média do mentor"
                : "Avaliação média do jovem"}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <SegLocal
                rotulo="Modo da linha"
                opcoes={MODOS_LINHA}
                valor={modoLinha}
                onChange={setModoLinha}
              />
              <ComoCalculamos
                itens={
                  modoLinha === "mentor"
                    ? [
                        {
                          termo: "Nota do mentor",
                          texto:
                            "A nota qualitativa (excelente, boa, regular, baixa) convertida para escala de 4 a 1. É a régua dele, não a do jovem.",
                        },
                      ]
                    : [
                        {
                          termo: "Fonte",
                          texto:
                            "Avaliações do jovem por encontro, na escala de 1 a 5.",
                        },
                        {
                          termo: "Encontro sem média",
                          texto:
                            "Encontro que ainda não aconteceu não entra na média, então a linha fica interrompida.",
                        },
                      ]
                }
              />
            </div>
          </div>
          <div className="text-right">
            <b className="block text-3xl font-extrabold leading-none tracking-tight tabular-nums">
              {modoLinha === "individual" ? (
                <NumeroVivo valor={todasEstrelas.length} />
              ) : modoLinha === "mentor" ? (
                mediaMentor != null ? (
                  <NumeroVivo valor={mediaMentor} formato={fmt1} />
                ) : (
                  "—"
                )
              ) : mediaJovem != null ? (
                <NumeroVivo valor={mediaJovem} formato={(v) => `${fmt1(v)} ★`} />
              ) : (
                "—"
              )}
            </b>
            <span className="mt-1 block text-xs font-semibold text-muted-foreground sm:text-[11px]">
              {modoLinha === "individual"
                ? `${todasEstrelas.length === 1 ? "avaliação" : "avaliações"} no recorte`
                : modoLinha === "mentor"
                  ? "média 1–4 · baixa→excelente"
                  : `média 1–5`}
              {modoLinha === "media" && atencaoLinha && (
                <em className="not-italic font-semibold" style={{ color: "var(--warn-text)" }}>
                  {" "}
                  · atenção: {fmt1(atencaoLinha.v)} no {atencaoLinha.slot}º{" "}
                  {atencaoLinha.turma}
                </em>
              )}
            </span>
          </div>
        </div>

        {modoLinha === "individual" ? (
          todasEstrelas.length === 0 ? (
            vazio("Nenhuma avaliação do jovem no recorte ainda.")
          ) : (
            <ScatterEstrelas
              slots={slots}
              corDe={corDe}
              labelsX={labelsX}
              turmas={turmas}
            />
          )
        ) : !temDados || (modoLinha === "media" ? todasEstrelas : todasNotasMentor).length === 0 ? (
          vazio(
            modoLinha === "mentor"
              ? "Nenhum registro com avaliação do mentor no recorte ainda."
              : "Nenhuma avaliação do jovem no recorte ainda."
          )
        ) : (
          <div className="mt-3">
            {/* sem ariaLabel próprio: o default do Sparkline narra a série
                ponto a ponto (inclusive os buracos "sem dado" e os pontos
                de atenção nomeados) — o card não tem tabela de dados como
                o das barras, então a narração completa é a única fonte */}
            <Sparkline
              series={modoLinha === "media" ? seriesJovem : seriesMentor}
              min={1}
              max={modoLinha === "media" ? 5 : 4}
              labelsX={labelsX}
              atencaoAbaixoDe={modoLinha === "media" ? 3.8 : 2.5}
              area={turmas.length === 1}
              altura={140}
              animate
            />
          </div>
        )}

        {linhaTemDados && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-[11px]">
            {turmas.map((t, i) => (
              <span key={t.cronogramaId} className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: corTurma(i) }}
                />
                {t.rotulo}
              </span>
            ))}
            {modoLinha !== "individual" && (
              <span className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: "var(--warn)" }}
                />
                ponto de atenção
              </span>
            )}
            {modoLinha === "individual" && (
              <span>cada ponto = uma avaliação do jovem</span>
            )}
          </div>
        )}
      </section>

      {/* ==================== situação das duplas ==================== */}
      {/* o mesmo resumo de /duplas, /agenda e da home (saudeDoRecorte) —
          cada fatia com chip lá é atalho pra lista já filtrada (?recorte=) */}
      <div
        className="animate-enter flex min-w-0 flex-col rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-5 lg:col-start-8 lg:row-start-1"
        style={{ "--i": 2 } as CSSProperties}
      >
        <SaudePrograma saude={saude} nivel="h3" className="flex-1" linkBase="/duplas" />
      </div>
    </div>
  );
}

/** Nuvem de avaliações ("Cada avaliação"): cada nota do jovem é um ponto na
 *  coluna do encontro — a distribuição aparece sem esconder nada na média.
 *  Pontos do mesmo slot se espalham na horizontal da faixa: primeiro por
 *  turma (cada célula desloca do centro) e dentro dela por índice — notas
 *  iguais de turmas diferentes não colidem. */
function ScatterEstrelas({
  slots,
  corDe,
  labelsX,
  turmas,
}: {
  slots: RegistrosPanorama["slots"];
  corDe: Map<string, string>;
  labelsX: string[];
  turmas: RegistrosPanorama["turmas"];
}) {
  const H = 140;
  const PAD = 8; // % — mesma régua da Sparkline
  const n = Math.max(slots.length, 1);
  const y = (v: number) =>
    PAD + (1 - (Math.min(Math.max(v, 1), 5) - 1) / 4) * (100 - 2 * PAD);
  const xBase = (i: number) => ((i + 0.5) / n) * 100;
  const GUTTER = 26;
  const rotuloDe = new Map(turmas.map((t) => [t.cronogramaId, t.rotulo]));

  const aria = `Nuvem de avaliações do jovem por encontro (escala 1–5): ${slots
    .map((s, i) => {
      const todas = s.celulas.flatMap((c) => c.estrelas);
      const m = mediaDe(todas);
      return `${labelsX[i]}: ${todas.length} ${todas.length === 1 ? "avaliação" : "avaliações"}${m != null ? `, média ${fmt1(m)}` : ""}`;
    })
    .join("; ")}`;

  return (
    <div className="mt-3">
      <div
        role="img"
        aria-label={aria}
        className="relative"
        style={{ height: H }}
      >
        <div
          className="absolute inset-y-0 right-0"
          style={{ left: GUTTER }}
        >
          {[5, 4, 3, 2, 1].map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ top: `${y(t)}%` }}
            />
          ))}
          {slots.map((s, si) =>
            s.celulas.map((c, ci) => {
              const cor = corDe.get(c.cronogramaId)!;
              const k = c.estrelas.length;
              // offset por turma dentro do slot: duas células no mesmo
              // encontro não dividem o mesmo eixo — cada uma ganha sua
              // sub-faixa (± simétrico em torno do centro da coluna)
              const passoTurma =
                s.celulas.length > 1
                  ? Math.min(2.8, 44 / n / (s.celulas.length - 1))
                  : 0;
              const offTurma =
                (ci - (s.celulas.length - 1) / 2) * passoTurma;
              return c.estrelas.map((v, di) => (
                <span
                  key={`${c.cronogramaId}-${di}`}
                  aria-hidden
                  title={`${labelsX[si]} encontro · ${rotuloDe.get(c.cronogramaId) ?? "—"} · jovem: ${v}★`}
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 transition-[left,top] duration-300 ease-snappy"
                  style={{
                    // pontos do mesmo slot+trilho se espalham na faixa da
                    // coluna — a densidade lê sem sobrepor
                    left: `${
                      xBase(si) +
                      offTurma +
                      (k > 1 ? (di - (k - 1) / 2) * Math.min(2.2, 34 / n / Math.max(k - 1, 1)) : 0)
                    }%`,
                    top: `${y(v)}%`,
                    backgroundColor: cor,
                  }}
                />
              ));
            })
          )}
        </div>
        {[5, 4, 3, 2, 1].map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute left-0 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground"
            style={{ top: `${y(t)}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="mt-2 flex"
        style={{ paddingLeft: GUTTER }}
      >
        {labelsX.map((l, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-muted-foreground"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
