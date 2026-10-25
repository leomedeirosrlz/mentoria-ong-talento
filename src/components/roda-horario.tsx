"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

// Roda de horário no gesto do despertador do iOS (REALIZA-212): cada coluna
// é uma lista com scroll-snap; o item que para no centro é o valor. Toque
// arrasta com a inércia nativa, mouse rola com a roda ou clica no número,
// teclado usa as setas (a coluna é um spinbutton). Sem input nativo de
// time: o seletor do sistema muda por navegador e não combina com o app.

const ITEM = 36; // px por linha — 5 linhas visíveis
const VISIVEIS = 5;
const PAD = ((VISIVEIS - 1) / 2) * ITEM;

const SEM_BARRA: CSSProperties = { scrollbarWidth: "none" };
const FADE: CSSProperties = {
  WebkitMaskImage:
    "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
  maskImage:
    "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
};

function Coluna({
  opcoes,
  indice,
  onIndice,
  rotulo,
  texto,
  disabled,
}: {
  opcoes: string[];
  indice: number;
  onIndice: (i: number) => void;
  /** nome acessível da coluna ("Hora de início"). */
  rotulo: string;
  /** valor lido pelo leitor de tela ("18 horas"). */
  texto: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const parada = useRef<ReturnType<typeof setTimeout> | null>(null);
  // a rolagem que NÓS mandamos não deve voltar como mudança de valor
  const programada = useRef(false);

  // valor mudou por fora (teclado, reset do form): centraliza sem animar
  // se a roda ainda não está nele
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atual = Math.round(el.scrollTop / ITEM);
    if (atual !== indice) {
      programada.current = true;
      el.scrollTo({ top: indice * ITEM });
      requestAnimationFrame(() => {
        programada.current = false;
      });
    }
  }, [indice]);

  useEffect(
    () => () => {
      if (parada.current) clearTimeout(parada.current);
    },
    []
  );

  function aoRolar() {
    if (programada.current) return;
    if (parada.current) clearTimeout(parada.current);
    // espera a inércia assentar no snap antes de ler o valor
    parada.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(
        opcoes.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM))
      );
      if (i !== indice) onIndice(i);
    }, 90);
  }

  function irPara(i: number) {
    const alvo = Math.min(opcoes.length - 1, Math.max(0, i));
    onIndice(alvo);
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    programada.current = true;
    ref.current?.scrollTo({ top: alvo * ITEM, behavior: reduz ? "auto" : "smooth" });
    setTimeout(() => {
      programada.current = false;
    }, 350);
  }

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const mapa: Record<string, number> = {
      ArrowUp: indice - 1,
      ArrowDown: indice + 1,
      PageUp: indice - 4,
      PageDown: indice + 4,
      Home: 0,
      End: opcoes.length - 1,
    };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    irPara(mapa[e.key]!);
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={opcoes.length - 1}
      aria-valuenow={indice}
      aria-valuetext={texto}
      aria-disabled={disabled || undefined}
      onScroll={aoRolar}
      onKeyDown={aoTeclar}
      className={cn(
        "relative w-12 snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden",
        disabled && "pointer-events-none opacity-50"
      )}
      style={{ ...SEM_BARRA, height: ITEM * VISIVEIS }}
    >
      <div aria-hidden style={{ paddingBlock: PAD }}>
        {opcoes.map((o, i) => (
          <button
            key={o}
            type="button"
            tabIndex={-1}
            onClick={() => irPara(i)}
            className={cn(
              "block w-full snap-center text-center text-lg tabular-nums transition-colors",
              i === indice
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            )}
            style={{ height: ITEM, lineHeight: `${ITEM}px` }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

/** Um horário "HH:MM" em duas rodas (hora · minuto). `passo` em minutos. */
export function RodaHorario({
  valor,
  onChange,
  rotulo,
  passo = 30,
  disabled,
}: {
  valor: string;
  onChange: (v: string) => void;
  /** "Início" / "Fim" — compõe o nome das colunas. */
  rotulo: string;
  passo?: number;
  disabled?: boolean;
}) {
  const minutos = Array.from({ length: 60 / passo }, (_, i) =>
    String(i * passo).padStart(2, "0")
  );
  const [h, m] = valor.split(":");
  const iH = Math.max(0, HORAS.indexOf(h ?? "00"));
  const iM = Math.max(0, minutos.indexOf(m ?? "00"));
  return (
    <div className="flex items-center">
      <Coluna
        opcoes={HORAS}
        indice={iH}
        onIndice={(i) => onChange(`${HORAS[i]}:${minutos[iM]}`)}
        rotulo={`${rotulo}: hora`}
        texto={`${Number(HORAS[iH])} horas`}
        disabled={disabled}
      />
      <span aria-hidden className="text-lg font-semibold text-muted-foreground">
        :
      </span>
      <Coluna
        opcoes={minutos}
        indice={iM}
        onIndice={(i) => onChange(`${HORAS[iH]}:${minutos[i]}`)}
        rotulo={`${rotulo}: minutos`}
        texto={`${Number(minutos[iM])} minutos`}
        disabled={disabled}
      />
    </div>
  );
}

/** Faixa "De … até …": duas rodas lado a lado sobre a mesma faixa central
 *  (a "lente" do iOS), com o "até" entre elas. */
export function FaixaHorario({
  de,
  ate,
  onDe,
  onAte,
  disabled,
}: {
  de: string;
  ate: string;
  onDe: (v: string) => void;
  onAte: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Horário"
      className="relative flex w-full items-center justify-center gap-3 rounded-xl bg-muted/50 px-3 sm:w-auto sm:justify-start"
    >
      {/* lente central: marca a linha escolhida nas quatro colunas */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-lg bg-card shadow-[var(--shadow-border)]"
        style={{ height: ITEM }}
      />
      <div className="relative flex items-center gap-3" style={FADE}>
        <RodaHorario valor={de} onChange={onDe} rotulo="Início" disabled={disabled} />
        <span aria-hidden className="text-sm text-muted-foreground">
          até
        </span>
        <RodaHorario valor={ate} onChange={onAte} rotulo="Fim" disabled={disabled} />
      </div>
    </div>
  );
}
