"use client";

import { useState, type PointerEvent } from "react";
import { X } from "@phosphor-icons/react";
import {
  EIXO_FIM_MIN,
  EIXO_INI_MIN,
  type BlocoPosicionado,
  type DiaGrade,
} from "@/lib/agenda-especialista";
import {
  ALTURA_PX,
  fmtHora,
  HORA_PX,
  HORAS,
  intervalo,
  posicao,
  PX_POR_MIN,
} from "@/components/agenda-grade-semanal";
import { DIAS_SEMANA, DIAS_SEMANA_CURTOS, DIAS_SEMANA_LABELS } from "@/lib/ciclo";
import type { GradeJanela } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "HH:mm[:ss]" → minutos do dia (o PostgREST devolve `time` com segundos —
 *  o terceiro pedaço é ignorado, mesmo helper da lib e do demo). */
function paraMinutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/** A régua do gesto e a duração mínima da janela: meia hora — a mesma do
 *  snap do clique na grade de horários do mentor. */
const PASSO_MIN = 30;

/** Editor da grade semanal recorrente do especialista (REALIZA-163): a
 *  variante "pinta e clica" da grade visual. As colunas são os dias da
 *  semana (seg→dom) — a janela se repete toda semana, não numa data.
 *  Área vazia da coluna: arrastar cria a janela (snap 30min, mínimo 30min;
 *  arrasto pra cima também vale — a janela é o intervalo entre as pontas).
 *  Clique numa janela remove. Sessões/extras/bloqueios da semana corrente
 *  entram como contexto somente-leitura (pointer-events desligado — pintar
 *  por cima deles funciona; a edição deles mora nas seções ao lado). As
 *  faixas "livres" ficam fora: são projeção derivada, não entrada — e a
 *  borda tracejada delas brigaria com a do rascunho.
 *  Desktop-only como a grade de leitura: no <md o editor é a lista por dia
 *  logo abaixo (pintar em coluna de ~40px no toque não dá precisão). */
export function AgendaGradeEdicao({
  grade,
  dias,
  pending,
  onAdicionar,
  onRemover,
}: {
  /** Janelas recorrentes — a fonte da edição (o id é o que remove). */
  grade: GradeJanela[];
  /** Semana corrente projetada (gradeVisualSemana) — só o contexto
   *  read-only: sessões, bloqueios e extras. As janelas dela não servem
   *  pra edição (o bloco projetado não carrega o id do banco). */
  dias: DiaGrade[];
  /** Ação de grade em voo — trava o gesto e os botões de remover. */
  pending: boolean;
  /** (dow Postgres 0–6, iniMin, fimMin) já snapados — o pai roda a action. */
  onAdicionar: (diaSemana: number, iniMin: number, fimMin: number) => void;
  onRemover: (id: string) => void;
}) {
  const [draft, setDraft] = useState<{
    dow: number;
    ini: number;
    fim: number;
    pointerId: number;
  } | null>(null);

  // janelas por dow, clipadas no eixo 8h–20h — o que fica fora dele não
  // pinta (a lista por dia embaixo segue sendo o caminho de remoção)
  const janelasPorDow = new Map<
    number,
    { j: GradeJanela; b: BlocoPosicionado }[]
  >();
  for (const j of grade) {
    const iniMin = Math.max(paraMinutos(j.hora_inicio), EIXO_INI_MIN);
    const fimMin = Math.min(paraMinutos(j.hora_fim), EIXO_FIM_MIN);
    if (fimMin <= iniMin) continue;
    const lista = janelasPorDow.get(j.dia_semana) ?? [];
    lista.push({ j, b: { iniMin, fimMin } });
    janelasPorDow.set(j.dia_semana, lista);
  }
  for (const lista of janelasPorDow.values())
    lista.sort((a, b) => a.b.iniMin - b.b.iniMin || a.b.fimMin - b.b.fimMin);

  const draftIni = draft ? Math.min(draft.ini, draft.fim) : 0;
  const draftFim = draft ? Math.max(draft.ini, draft.fim) : 0;
  const draftPos =
    draft && draftFim > draftIni
      ? posicao({ iniMin: draftIni, fimMin: draftFim })
      : null;
  const draftDia = draft
    ? DIAS_SEMANA_LABELS[DIAS_SEMANA[(draft.dow + 6) % 7]]
    : null;

  /** y do ponteiro → minuto do eixo, snapado em 30min e preso em 8h–20h. */
  function minutoDoPonto(e: PointerEvent<HTMLElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const bruto = EIXO_INI_MIN + (e.clientY - rect.top) / PX_POR_MIN;
    const snap = Math.round(bruto / PASSO_MIN) * PASSO_MIN;
    return Math.min(EIXO_FIM_MIN, Math.max(EIXO_INI_MIN, snap));
  }

  function aoApertar(dow: number, e: PointerEvent<HTMLDivElement>) {
    // o gesto nasce só na área vazia da coluna — o único filho interativo é
    // o botão da janela (o clique dele remove; os demais blocos são
    // pointer-events-none). Só o botão principal do mouse/1º toque pinta.
    if (pending || draft || e.button !== 0 || e.target !== e.currentTarget)
      return;
    // a captura na coluna segura o gesto: o move continua chegando mesmo
    // com o ponteiro fora da área dela (clamp do minutoDoPonto resolve o fim)
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = minutoDoPonto(e);
    setDraft({ dow, ini: m, fim: m, pointerId: e.pointerId });
  }

  function aoMover(dow: number, e: PointerEvent<HTMLDivElement>) {
    if (!draft || draft.dow !== dow || draft.pointerId !== e.pointerId) return;
    const m = minutoDoPonto(e);
    if (m !== draft.fim) setDraft({ ...draft, fim: m });
  }

  function aoSoltar(dow: number, e: PointerEvent<HTMLDivElement>) {
    // só o ponteiro que começou o gesto termina ele — o pointerup de um
    // segundo dedo na mesma coluna não pode soltar o rascunho alheio
    if (!draft || draft.dow !== dow || draft.pointerId !== e.pointerId) return;
    setDraft(null);
    // menos que um snap (<30min) lê como clique sem intenção — descarta
    if (draftFim - draftIni >= PASSO_MIN) onAdicionar(dow, draftIni, draftFim);
  }

  /** Cancela o rascunho só se o evento é do ponteiro que o criou. */
  function aoCancelar(e: PointerEvent<HTMLDivElement>) {
    if (draft?.pointerId === e.pointerId) setDraft(null);
  }

  return (
    <div className="hidden md:block">
      <p className="mb-2 text-xs text-muted-foreground">
        Arraste na grade pra criar uma janela; clique numa janela pra remover.
      </p>
      {/* canal falado do gesto — o rascunho é decorativo; quem não vê o
          arraste ouve o intervalo se formando aqui (o caminho de teclado
          completo é a lista por dia logo abaixo) */}
      <p aria-live="polite" className="sr-only">
        {draft && draftPos
          ? `Nova janela: ${draftDia} ${fmtHora(draftIni)}–${fmtHora(draftFim)}`
          : ""}
      </p>
      <div
        role="group"
        aria-label="Grade semanal editável"
        className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))]"
      >
        {/* canto do gutter — segura a 1ª coluna na linha do header */}
        <span aria-hidden />
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="px-1 py-1.5 text-center">
            <b className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {DIAS_SEMANA_CURTOS[dia]}
            </b>
          </div>
        ))}

        {/* gutter de horas — a mesma régua da grade de leitura */}
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

        {DIAS_SEMANA.map((dia, i) => {
          const dow = (i + 1) % 7; // dow do Postgres: seg=1 … sáb=6, dom=0
          const nome = DIAS_SEMANA_LABELS[dia];
          const diaCtx = dias.find((d) => d.dow === dow);
          return (
            <div
              key={dia}
              role="group"
              aria-label={nome}
              onPointerDown={(e) => aoApertar(dow, e)}
              onPointerMove={(e) => aoMover(dow, e)}
              onPointerUp={(e) => aoSoltar(dow, e)}
              onPointerCancel={aoCancelar}
              onLostPointerCapture={aoCancelar}
              className={cn(
                // touch-none: sem ele o arrasto vertical vira scroll da
                // página e o pointercancel aborta a pintura no toque; a
                // grade é uma área fechada dentro do card — a rolagem da
                // página segue disponível fora dela
                "relative cursor-cell touch-none select-none border-l border-border/60",
                pending && "opacity-60"
              )}
              style={{
                height: ALTURA_PX,
                backgroundImage:
                  "linear-gradient(var(--border) 1px, transparent 1px)",
                backgroundSize: `100% ${HORA_PX}px`,
              }}
            >
              {/* janelas recorrentes — o bloco vira botão de remoção com o
                  hover de perigo + X */}
              {(janelasPorDow.get(dow) ?? []).map(({ j, b }) => {
                const pos = posicao(b);
                if (!pos) return null;
                return (
                  <button
                    key={j.id}
                    type="button"
                    disabled={pending}
                    onClick={() => onRemover(j.id)}
                    aria-label={`Remover janela de ${nome} das ${intervalo(b)}`}
                    title="Clique pra remover"
                    className={cn(
                      "group/jan absolute inset-x-0.5 overflow-hidden rounded-lg border border-[var(--ok)]/50 bg-[var(--ok)]/12 text-left transition-colors",
                      "hover:border-[var(--danger)]/60 hover:bg-[var(--danger)]/12",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                    style={pos}
                  >
                    {pos.height >= 20 && (
                      <span className="absolute inset-x-1 bottom-0.5 truncate text-[11px] leading-none text-[var(--ok-text)] transition-colors group-hover/jan:text-[var(--danger)]">
                        {intervalo(b)}
                      </span>
                    )}
                    <X
                      aria-hidden
                      size={14}
                      weight="bold"
                      className="absolute right-0.5 top-0.5 rounded-full bg-[var(--danger)] p-0.5 text-white opacity-0 transition-opacity group-hover/jan:opacity-100 group-focus-visible/jan:opacity-100"
                    />
                  </button>
                );
              })}

              {/* contexto read-only da semana corrente — extras, bloqueios
                  e sessões na mesma tinta da grade de leitura; nenhum é
                  interativo (pointer-events-none deixa a pintura passar) */}
              {diaCtx?.janelas
                .filter((jb) => jb.tipo === "extra")
                .map((jb, k) => {
                  const pos = posicao(jb);
                  if (!pos) return null;
                  return (
                    <div
                      key={`x${k}`}
                      role="img"
                      aria-label={`${nome} ${intervalo(jb)} extra`}
                      className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-lg border border-dashed border-[var(--ok)]/50 bg-[var(--ok)]/12"
                      style={pos}
                    >
                      {pos.height >= 20 && (
                        <span className="absolute inset-x-1 bottom-0.5 truncate text-[11px] leading-none text-[var(--ok-text)]">
                          {jb.rotulo}
                        </span>
                      )}
                    </div>
                  );
                })}
              {diaCtx?.bloqueios.map((b, k) => {
                const pos = posicao(b);
                if (!pos) return null;
                return (
                  <div
                    key={`b${k}`}
                    role="img"
                    aria-label={`${nome} bloqueado ${intervalo(b)}`}
                    className="hatch-recesso pointer-events-none absolute inset-x-0.5 rounded-lg"
                    style={pos}
                  />
                );
              })}
              {diaCtx?.sessoes.map((s, k) => {
                const pos = posicao(s);
                if (!pos) return null;
                const esp = s.trilha === "especialista";
                const feita = s.status === "realizado";
                return (
                  <div
                    key={`s${k}`}
                    role="img"
                    aria-label={
                      esp
                        ? `Sessão ${s.rotulo} ${fmtHora(s.iniMin)}${feita ? " · realizada" : ""}`
                        : `Compromisso DPP · ${s.rotulo} ${fmtHora(s.iniMin)}${feita ? " · realizado" : ""}`
                    }
                    className={cn(
                      "pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-0.5",
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

              {/* o rascunho do gesto — tracejado primário por cima de tudo,
                  nunca recebe ponteiro */}
              {draft && draft.dow === dow && draftPos && (
                <div
                  data-draft-janela
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0.5 z-10 rounded-lg border-2 border-dashed border-primary bg-primary/20"
                  style={draftPos}
                >
                  {draftPos.height >= 24 && (
                    <span className="absolute inset-x-1 top-1 truncate text-[10px] font-medium leading-none">
                      {fmtHora(draftIni)}–{fmtHora(draftFim)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
