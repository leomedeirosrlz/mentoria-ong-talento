"use client";

import { useMemo, useRef, useState } from "react";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  Compass,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { extraiEstruturaRoda } from "@/lib/forms/instrumentos";
import {
  extraiRodaDaVida,
  type FormularioCampo,
} from "@/lib/forms/schema";
import { cn } from "@/lib/utils";
import type { RespostaApi } from "./use-resposta";
import { RodaSvg } from "./roda-svg";
import { CampoGenerico, campoDomId, EntradaTextoLongo, ErroCampo } from "./campos";

// Roda da Vida interativa — a peça de destaque. O gesto principal é
// arrastar na roda: o ângulo escolhe o eixo, a distância ao centro a nota
// (1–10) e o polígono acompanha o dedo. O eixo focado mostra nome e nota
// embaixo dela; soltar avança pra próxima área — a roda se preenche como
// um jogo. A lista por quadrante embaixo é o caminho acessível: cada
// área é um slider (setas/Home/End no teclado, toque/arraste na trilha)
// com o número exato. Sem eixo algum acessível fica de fora.

export function RodaVida({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const estrutura = useMemo(() => extraiEstruturaRoda(campos), [campos]);
  const roda = useMemo(
    () => extraiRodaDaVida(campos, api.valores),
    [campos, api.valores]
  );
  const [ativoManual, setAtivo] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const ultimoRef = useRef<{ i: number; nota: number } | null>(null);

  const areas = useMemo(
    () => roda?.quadrantes.flatMap((q) => q.areas) ?? [],
    [roda]
  );
  const total = areas.length;

  if (!estrutura || !roda || !total) {
    // definição sem nenhuma escala_1_10 — não é uma roda; renderiza o que
    // houver sem perder pergunta
    return (
      <>
        {campos
          .filter((c) => c.tipo !== "secao")
          .map((c) => <CampoGenerico key={c.id} campo={c} api={api} />)}
      </>
    );
  }

  // o foco cai na primeira área sem nota — tocar/arrastar fixa a escolha
  const primeiroVazio = areas.findIndex((a) => a.nota == null);
  const ativo = ativoManual ?? (primeiroVazio >= 0 ? primeiroVazio : 0);
  const areaAtiva = areas[ativo];

  // quadrante do eixo ativo — o kicker do cartão de foco
  let quadAtivo = "";
  {
    let acc = 0;
    for (const q of roda.quadrantes) {
      if (ativo < acc + q.areas.length) {
        quadAtivo = q.nome;
        break;
      }
      acc += q.areas.length;
    }
  }

  function escolher(i: number, nota: number) {
    ultimoRef.current = { i, nota };
    setAtivo(i);
    api.definir(areas[i].id, nota);
  }

  function fimGesto() {
    // o gesto termina anunciando a nota e empurrando o foco pra frente —
    // preencher a roda inteira vira um passe só
    const u = ultimoRef.current;
    if (u) setAnuncio(`${areas[u.i].label}: nota ${u.nota} de 10`);
    setAtivo((a) => ((a ?? ativo) + 1) % total);
  }

  function passo(delta: number) {
    const i = (ativo + delta + total) % total;
    setAtivo(i);
  }

  // a "volta completa" é a roda toda respondida — o contador + o badge
  // celebram o fechamento da volta, não só a posição do eixo
  const respondidas = areas.filter((a) => a.nota != null).length;
  const completa = respondidas === total;

  return (
    <>
      {/* instrução do instrumento (as seções que precedem os quadrantes) */}
      {estrutura.intro.map((s) => (
        <div
          key={s.id}
          className="flex gap-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
        >
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
          >
            <Compass size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {s.label}
            </h2>
            {s.descricao && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {s.descricao}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* a roda + o eixo em foco — uma zona de interação só */}
      <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        {/* o eixo em foco EM CIMA da roda — a faixa verde é o destaque da
            seção: setas pretas trocam de área, o título diz o que você
            está pontuando antes de arrastar */}
        <div className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-lime)] px-1.5 py-1.5 text-[var(--brand-ink)]">
          <button
            type="button"
            onClick={() => passo(-1)}
            aria-label="Área anterior"
            className="grid size-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-[var(--brand-ink)]/10 active:bg-[var(--brand-ink)]/15"
          >
            <CaretLeft size={20} weight="bold" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-semibold tracking-[0.08em] opacity-70">
              {quadAtivo ? `${quadAtivo} · ` : ""}Área {ativo + 1} de {total}
            </p>
            <h3 className="truncate text-[15px] font-bold leading-snug">
              {areaAtiva.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => passo(1)}
            aria-label="Próxima área"
            className="grid size-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-[var(--brand-ink)]/10 active:bg-[var(--brand-ink)]/15"
          >
            <CaretRight size={20} weight="bold" aria-hidden />
          </button>
        </div>

        <RodaSvg
          roda={roda}
          ativo={ativo}
          onMudanca={escolher}
          onFim={fimGesto}
          className="mt-3"
        />
        {/* anúncio do gesto pro leitor de tela — o svg é aria-hidden, a
            nota sai por aqui ao soltar o dedo */}
        <p aria-live="polite" className="sr-only">
          {anuncio}
        </p>

        <div className="mt-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            {/* progresso da volta — conta áreas com nota, não posição */}
            <p className="text-xs font-medium text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {respondidas}
              </span>{" "}
              de {total} áreas
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Diminuir nota de ${areaAtiva.label}`}
                disabled={!areaAtiva.nota || areaAtiva.nota <= 1}
                onClick={() => escolher(ativo, (areaAtiva.nota ?? 2) - 1)}
                className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 sm:size-9"
              >
                <Minus size={16} aria-hidden />
              </button>
              <span
                aria-hidden
                className="w-10 text-center text-xl font-bold tabular-nums"
              >
                {areaAtiva.nota ?? "—"}
              </span>
              <button
                type="button"
                aria-label={`Aumentar nota de ${areaAtiva.label}`}
                disabled={areaAtiva.nota === 10}
                onClick={() => escolher(ativo, (areaAtiva.nota ?? 0) + 1)}
                className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 sm:size-9"
              >
                <Plus size={16} aria-hidden />
              </button>
            </div>
          </div>
          {/* trilha da volta — enche conforme as áreas ganham nota */}
          <div
            role="progressbar"
            aria-label="Progresso da roda"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={respondidas}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-300"
              style={{ width: `${(respondidas / total) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Nada satisfeito</span>
            <span>Muito satisfeito</span>
          </div>
          {completa && (
            <p className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-lime)]/15 px-3 py-2 text-sm font-semibold text-[var(--ok-text)] animate-in fade-in zoom-in-95">
              <CheckCircle size={17} weight="fill" aria-hidden />
              Roda completa
              {roda.media != null && (
                <span className="font-normal">
                  — média {roda.media.toLocaleString("pt-BR")}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* a lista completa por quadrante — cada linha é um slider: setas
          no teclado, toque/arraste na trilha, número exato à direita */}
      <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        {roda.quadrantes.map((q) => (
          <section key={q.nome || "geral"}>
            {/* sem uppercase via CSS: o nome acessível do heading segue o
                texto transformado e quebraria quem espera "Pessoal" */}
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
              {q.nome}
            </h3>
            <ul className="mt-1.5 space-y-0.5">
              {q.areas.map((a) => {
                const i = areas.indexOf(a);
                return (
                  <AreaSlider
                    key={a.id}
                    area={a}
                    indice={i}
                    ativo={i === ativo}
                    erro={api.erros[a.id]}
                    onFoco={() => setAtivo(i)}
                    onNota={(nota) => escolher(i, nota)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* perguntas fora da roda — a reflexão final (e qualquer extra) */}
      {estrutura.extras.map((c) =>
        c.tipo === "texto_longo" ? (
          <div
            key={c.id}
            data-campo={c.id}
            className={cn(
              "space-y-1.5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
              api.erros[c.id] && "ring-2 ring-destructive/60"
            )}
          >
            <label
              htmlFor={campoDomId(c)}
              className="block text-[15px] font-medium leading-snug sm:text-base"
            >
              {c.label}
              {!c.obrigatorio && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </label>
            <EntradaTextoLongo
              campo={c}
              valor={api.valores[c.id]}
              definir={api.definir}
              erro={api.erros[c.id]}
              enterKeyHint="send"
              rows={5}
            />
            <ErroCampo campo={c} msg={api.erros[c.id]} />
          </div>
        ) : (
          <CampoGenerico key={c.id} campo={c} api={api} />
        )
      )}
    </>
  );
}

/** Uma linha da lista de áreas — slider ARIA completo: um tab stop,
 *  setas ±1, Home/End nas pontas; a trilha aceita toque/arraste. */
function AreaSlider({
  area,
  indice,
  ativo,
  erro,
  onFoco,
  onNota,
}: {
  area: { id: string; label: string; nota: number | null };
  indice: number;
  ativo: boolean;
  erro: string | undefined;
  onFoco: () => void;
  onNota: (nota: number) => void;
}) {
  const trilhaRef = useRef<HTMLSpanElement>(null);

  function porPonteiro(e: React.PointerEvent<HTMLSpanElement>) {
    const rect = trilhaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onNota(Math.min(10, Math.max(1, Math.round(frac * 9) + 1)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLLIElement>) {
    const atual = area.nota ?? 0;
    let prox: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp")
      prox = Math.min(10, atual + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      prox = Math.max(1, (atual || 2) - 1);
    else if (e.key === "Home") prox = 1;
    else if (e.key === "End") prox = 10;
    else if (e.key === "PageUp") prox = Math.min(10, atual + 2);
    else if (e.key === "PageDown") prox = Math.max(1, (atual || 3) - 2);
    if (prox != null) {
      e.preventDefault();
      onNota(prox);
    }
  }

  const respondida = area.nota != null;

  return (
    <li
      role="slider"
      tabIndex={0}
      data-campo={area.id}
      aria-label={`${indice + 1}. ${area.label}`}
      aria-valuemin={1}
      aria-valuemax={10}
      aria-valuenow={area.nota ?? 0}
      aria-valuetext={
        respondida ? `Nota ${area.nota} de 10` : "Sem nota ainda"
      }
      aria-invalid={erro ? true : undefined}
      onFocus={onFoco}
      onKeyDown={onKeyDown}
      onClick={onFoco}
      className={cn(
        "group flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors outline-none select-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        ativo
          ? "bg-[var(--brand-lime)]/10"
          : "hover:bg-muted/70 active:bg-muted",
        erro && "ring-2 ring-destructive/60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums",
          respondida
            ? "bg-[var(--brand-lime)]/20 text-[var(--ok-text)]"
            : "bg-muted text-muted-foreground"
        )}
      >
        {indice + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{area.label}</span>
      {/* a trilha é o alvo do arraste — a fração do toque vira a nota */}
      <span
        ref={trilhaRef}
        aria-hidden
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          porPonteiro(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) porPonteiro(e);
        }}
        className="relative h-6 w-20 shrink-0 touch-none sm:w-28"
      >
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-150"
            style={{ width: `${((area.nota ?? 0) / 10) * 100}%` }}
          />
        </span>
        {respondida && (
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ok-text)] transition-[left] duration-150"
            style={{ left: `${((area.nota ?? 0) / 10) * 100}%` }}
          />
        )}
      </span>
      <span
        className={cn(
          "w-7 shrink-0 text-right text-sm font-semibold tabular-nums",
          area.nota == null
            ? "text-muted-foreground"
            : area.nota >= 8
              ? "text-[var(--ok-text)]"
              : area.nota <= 4
                ? "text-[var(--warn-text)]"
                : "text-foreground"
        )}
      >
        {area.nota ?? "—"}
      </span>
    </li>
  );
}
