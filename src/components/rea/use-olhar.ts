"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import type { ReaEstado } from "./tipos";

/** Vocabulário de motion compartilhado pelos três conceitos da Rea.
 *  Regras da casa: só transform/opacity, molas com bounce ≤ 0,3, reações
 *  entre 150 e 400ms, ease = --ease-snappy. */

export const EASE = [0.2, 0, 0, 1] as const; // = --ease-snappy

/** Troca de expressão (pose → pose): mola curta, overshoot discreto. */
export const MOLA = { type: "spring", duration: 0.34, bounce: 0.22 } as const;
/** Reação ao hover/foco: mais rápida, quase sem overshoot. */
export const MOLA_RAPIDA = { type: "spring", duration: 0.22, bounce: 0.12 } as const;
/** Crossfade entre formas (pílula ↔ arco ↔ estrela). */
export const FADE = { duration: 0.15, ease: EASE } as const;
/** Reduced motion: a pose ainda muda (é informação), mas sem deslocamento
 *  nem overshoot — troca curta, praticamente um corte suave. */
export const REDUZIDA = { duration: 0.12, ease: EASE } as const;

/** Mola do olhar (ζ ≈ 0,89 → overshoot ~10%): acompanha o cursor com um
 *  atraso orgânico, sem tremer. */
const MOLA_OLHAR = { stiffness: 260, damping: 24, mass: 0.7 };

export type Ponto = { x: number; y: number };

const CENTRO: Ponto = { x: 0, y: 0 };

/** px de tela → unidades do viewBox 0 0 100 100 do mascote. Deslocamentos
 *  com teto em px (pulo de 5px, flutuação de 2px) precisam disso pra não
 *  crescerem junto com o tamanho. */
export const px2u = (px: number, tamanho: number) => (px * 100) / tamanho;

export function useReduzido(): boolean {
  return useReducedMotion() ?? false;
}

/** Direção normalizada (disco unitário) do centro do elemento até o ponteiro.
 *  Saturação exponencial: perto do rosto o olhar acompanha fino, longe ele
 *  chega no limite sem "grudar" na borda de repente. */
function direcaoDoPonteiro(el: Element, px: number, py: number): Ponto {
  const r = el.getBoundingClientRect();
  const dx = px - (r.left + r.width / 2);
  const dy = py - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d < 1) return CENTRO;
  const alcance = Math.max(140, r.width * 3);
  const m = 1 - Math.exp(-d / alcance);
  return { x: (dx / d) * m, y: (dy / d) * m };
}

type OpcoesOlhar = {
  /** segue o ponteiro (mouse/caneta; toque nunca move o olhar) */
  seguir: boolean;
  /** pose fixa do estado; null = olhar livre (cursor + olhadas ociosas) */
  alvo: Ponto | null;
  /** varredura de leitura esquerda→direita em torno do alvo (~1,2s) */
  varrer?: boolean;
  /** olhar de quem pensa: para no alvo, cruza devagar pro lado oposto,
      segura e volta (~5s) — ninguém pensa olhando pro mesmo ponto */
  pensar?: boolean;
  reduzido: boolean;
};

/** Olhar da Rea: devolve x/y normalizados em [-1, 1] já suavizados por mola.
 *  Cada conceito multiplica pelo próprio raio (em unidades do viewBox — como o
 *  SVG escala com `tamanho`, o raio fica proporcional ao tamanho de graça).
 *
 *  - Ponteiro: um listener passivo em window, coalescido por rAF (no máximo
 *    um getBoundingClientRect + um set por frame). Nada de setState: o valor
 *    vai direto pra MotionValue → transform, sem re-render do React.
 *  - Olhadas ociosas: a cada 4–9s, se o ponteiro está parado há >3s (ou o
 *    aparelho é só toque), olha pra um ponto aleatório e volta.
 *  - document.hidden pausa o agendador (e o rAF já não roda em aba oculta).
 *  - Reduced motion: sem seguir e sem olhadas. A pose de cada estado ainda
 *    aparece (o olhar vai pro alvo na hora, sem viagem): é expressão, não
 *    deslocamento pela tela. */
export function useOlhar(
  ref: RefObject<Element | null>,
  { seguir, alvo, varrer = false, pensar = false, reduzido }: OpcoesOlhar,
): { x: MotionValue<number>; y: MotionValue<number> } {
  const brutoX = useMotionValue(0);
  const brutoY = useMotionValue(0);
  const x = useSpring(brutoX, MOLA_OLHAR);
  const y = useSpring(brutoY, MOLA_OLHAR);
  // última direção do ponteiro — pra onde o olhar volta depois de uma pose
  // fixa ou de uma olhada ociosa
  const ponteiro = useRef<Ponto | null>(null);

  const temAlvo = alvo !== null;
  const ax = alvo?.x ?? 0;
  const ay = alvo?.y ?? 0;

  // pose do estado
  useEffect(() => {
    if (reduzido) {
      const p = temAlvo ? { x: ax, y: ay } : CENTRO;
      brutoX.set(p.x);
      brutoY.set(p.y);
      x.jump(p.x);
      y.jump(p.y);
      return;
    }
    if (!temAlvo) {
      const p = ponteiro.current ?? CENTRO;
      brutoX.set(p.x);
      brutoY.set(p.y);
      return;
    }
    brutoY.set(ay);
    if (varrer) {
      // ritmo de leitura: varre devagar pra direita, segura um instante e
      // volta rápido pro começo da próxima linha (a mola arredonda o retorno)
      const ctrl = animate(brutoX, [ax - 0.55, ax + 0.55, ax + 0.55, ax - 0.55], {
        duration: 1.2,
        times: [0, 0.7, 0.8, 1],
        ease: ["easeInOut", "linear", EASE],
        repeat: Infinity,
      });
      return () => ctrl.stop();
    }
    if (pensar) {
      const ctrl = animate(brutoX, [ax, ax, -ax * 0.6, -ax * 0.6, ax], {
        duration: 5,
        times: [0, 0.38, 0.5, 0.88, 1],
        ease: "easeInOut",
        repeat: Infinity,
      });
      return () => ctrl.stop();
    }
    brutoX.set(ax);
  }, [temAlvo, ax, ay, varrer, pensar, reduzido, brutoX, brutoY, x, y]);

  // vida própria: seguir o ponteiro + olhadas ociosas
  useEffect(() => {
    if (temAlvo || reduzido) return;
    const el = ref.current;
    if (!el) return;

    if (!seguir) {
      ponteiro.current = null;
      brutoX.set(0);
      brutoY.set(0);
    }

    let raf = 0;
    let px = 0;
    let py = 0;
    let ultimoMovimento = Number.NEGATIVE_INFINITY;
    let espiando = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let volta: ReturnType<typeof setTimeout> | undefined;

    const mirar = (p: Ponto) => {
      brutoX.set(p.x);
      brutoY.set(p.y);
    };

    const aplicar = () => {
      raf = 0;
      const p = direcaoDoPonteiro(el, px, py);
      ponteiro.current = p;
      if (!espiando) mirar(p);
    };

    const aoMover = (e: PointerEvent) => {
      // toque não é "olhar pra cá": o dedo some depois do tap
      if (e.pointerType === "touch") return;
      px = e.clientX;
      py = e.clientY;
      ultimoMovimento = performance.now();
      if (espiando) {
        // o usuário voltou: o ponteiro manda, a olhada é cancelada
        espiando = false;
        clearTimeout(volta);
        agendar();
      }
      if (!raf) raf = requestAnimationFrame(aplicar);
    };

    const aoSairDaJanela = () => {
      ponteiro.current = null;
      if (!espiando) mirar(CENTRO);
    };

    const espiar = () => {
      const ocioso = performance.now() - ultimoMovimento > 1600;
      if (document.hidden || !ocioso) {
        agendar();
        return;
      }
      const ang = Math.random() * Math.PI * 2;
      const mag = 0.45 + Math.random() * 0.4;
      espiando = true;
      // achata o eixo vertical: olhadas laterais leem como curiosidade,
      // verticais grandes leem como revirar os olhos
      mirar({ x: Math.cos(ang) * mag, y: Math.sin(ang) * mag * 0.6 });
      volta = setTimeout(
        () => {
          espiando = false;
          mirar(ponteiro.current ?? CENTRO);
          agendar();
        },
        700 + Math.random() * 700,
      );
    };

    function agendar() {
      clearTimeout(timer);
      timer = setTimeout(espiar, 2800 + Math.random() * 3600);
    }

    const aoMudarVisibilidade = () => {
      if (document.hidden) {
        clearTimeout(timer);
        clearTimeout(volta);
        if (espiando) {
          espiando = false;
          mirar(ponteiro.current ?? CENTRO);
        }
      } else {
        agendar();
      }
    };

    if (seguir) {
      window.addEventListener("pointermove", aoMover, { passive: true });
      document.documentElement.addEventListener("pointerleave", aoSairDaJanela);
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    if (!document.hidden) agendar();

    return () => {
      window.removeEventListener("pointermove", aoMover);
      document.documentElement.removeEventListener("pointerleave", aoSairDaJanela);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(timer);
      clearTimeout(volta);
    };
  }, [temAlvo, seguir, reduzido, ref, brutoX, brutoY]);

  return { x, y };
}

/** Piscar: devolve a abertura do olho (1 aberto → ~0 fechado) pra virar
 *  scaleY. Intervalo aleatório de 3–6s, ~18% de piscada dupla; `lento`
 *  (consultando) troca por piscadas pesadas e mais espaçadas.
 *
 *  Reduced motion: piscar DESLIGADO. É um loop autônomo e decorativo — não
 *  responde a nada que o usuário fez. Trocar por um corte instantâneo seria
 *  pior (um flicker a cada poucos segundos no canto da tela chama mais
 *  atenção que a animação). Os estados continuam legíveis porque a
 *  expressão de cada um é uma pose estática. */
export function usePiscar({
  ativo,
  reduzido,
  lento = false,
  gatilho,
}: {
  ativo: boolean;
  reduzido: boolean;
  lento?: boolean;
  /** muda → uma piscada curta. Gente pisca ao trocar de foco/expressão;
      é o que faz a troca de pose parecer pensamento, não troca de quadro */
  gatilho?: string;
}): MotionValue<number> {
  const abertura = useMotionValue(1);
  const gatilhoAntes = useRef(gatilho);

  useEffect(() => {
    if (gatilhoAntes.current === gatilho) return;
    gatilhoAntes.current = gatilho;
    if (!ativo || reduzido || document.hidden) return;
    const ctrl = animate(abertura, [abertura.get(), 0.06, 1], {
      duration: 0.18,
      times: [0, 0.4, 1],
      ease: "easeInOut",
    });
    return () => ctrl.stop();
  }, [gatilho, ativo, reduzido, abertura]);

  useEffect(() => {
    if (!ativo || reduzido) {
      abertura.set(1);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AnimationPlaybackControls | undefined;

    const piscar = () => {
      if (!document.hidden) {
        const duplo = !lento && Math.random() < 0.18;
        ctrl = duplo
          ? animate(abertura, [1, 0.06, 1, 0.06, 1], {
              duration: 0.4,
              times: [0, 0.2, 0.45, 0.7, 1],
              ease: "easeInOut",
            })
          : animate(abertura, [1, 0.06, 1], {
              duration: lento ? 0.5 : 0.16,
              // pálpebra desce mais rápido do que sobe
              times: lento ? [0, 0.55, 1] : [0, 0.4, 1],
              ease: "easeInOut",
            });
      }
      agendar();
    };

    function agendar() {
      clearTimeout(timer);
      const [min, max] = lento ? [5000, 9000] : [3000, 6000];
      timer = setTimeout(piscar, min + Math.random() * (max - min));
    }

    const aoMudarVisibilidade = () => {
      if (document.hidden) clearTimeout(timer);
      else agendar();
    };

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    if (!document.hidden) agendar();

    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      clearTimeout(timer);
      ctrl?.stop();
      abertura.set(1);
    };
  }, [ativo, reduzido, lento, abertura]);

  return abertura;
}

/** Boca falando: abre e fecha em sílabas de duração e amplitude
 *  irregulares, com pausas de respiro de vez em quando — um loop fixo lê
 *  como metrônomo (ou robô). Devolve o scaleY da boca. Reduced motion:
 *  boca entreaberta parada (a pose ainda diz "falando"). */
export function useTagarelar(ativo: boolean, reduzido: boolean): MotionValue<number> {
  const abertura = useMotionValue(0.7);

  useEffect(() => {
    if (!ativo || reduzido) {
      abertura.set(0.7);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AnimationPlaybackControls | undefined;
    let aberta = false;

    const passo = () => {
      if (document.hidden) {
        timer = setTimeout(passo, 500);
        return;
      }
      // fechando a sílaba, às vezes respira: boca quase fechada um tempo
      const pausa = aberta && Math.random() < 0.12;
      aberta = !aberta;
      const alvo = aberta ? 0.75 + Math.random() * 0.45 : 0.35 + Math.random() * 0.15;
      const ms = pausa ? 260 + Math.random() * 280 : 80 + Math.random() * 90;
      ctrl = animate(abertura, alvo, { duration: Math.min(ms, 120) / 1000, ease: "easeOut" });
      timer = setTimeout(passo, ms);
    };
    passo();

    return () => {
      clearTimeout(timer);
      ctrl?.stop();
    };
  }, [ativo, reduzido, abertura]);

  return abertura;
}

/** Duração do "momento" de entrada dos estados que têm começo, meio e fim:
 *  `aberto` sorri (^ ^) e depois se acomoda olhando pro composer; `pronto`
 *  comemora uma vez e depois se comporta como `parado`; `erro` balança a
 *  cabeça uma vez e assenta murcho. */
const DURACAO_MOMENTO: Partial<Record<ReaEstado, number>> = {
  aberto: 1200,
  pronto: 1500,
  erro: 620,
};

/** true enquanto o estado atual está no seu momento de entrada. Reinicia a
 *  cada nova entrada no estado (padrão "estado derivado da render anterior"
 *  do React — sem setState síncrono em effect). */
export function useMomento(estado: ReaEstado): boolean {
  const [anterior, setAnterior] = useState(estado);
  const [ativo, setAtivo] = useState(estado in DURACAO_MOMENTO);
  if (anterior !== estado) {
    setAnterior(estado);
    setAtivo(estado in DURACAO_MOMENTO);
  }
  useEffect(() => {
    const ms = DURACAO_MOMENTO[estado];
    if (!ativo || !ms) return;
    const t = setTimeout(() => setAtivo(false), ms);
    return () => clearTimeout(t);
  }, [ativo, estado]);
  return ativo;
}

/** Número-alvo → MotionValue com mola (inclinação no hover, ângulo-base da
 *  cauda…). Sob reduced motion pula direto pro valor. */
export function useAlvoMola(valor: number, reduzido: boolean): MotionValue<number> {
  const v = useSpring(valor, { stiffness: 320, damping: 28, mass: 0.8 });
  useEffect(() => {
    if (reduzido) v.jump(valor);
    else v.set(valor);
  }, [valor, reduzido, v]);
  return v;
}
