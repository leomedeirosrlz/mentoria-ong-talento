"use client";

import { useId, useRef } from "react";
import { motion, useTransform, type MotionValue, type Transition } from "motion/react";
import type { LizaEstado, LizaProps } from "./tipos";
import {
  EASE,
  FADE,
  MOLA,
  MOLA_RAPIDA,
  REDUZIDA,
  px2u,
  useAlvoMola,
  useMomento,
  useOlhar,
  usePiscar,
  useReduzido,
  type Ponto,
} from "./use-olhar";

/** Conceito C — "Balão". O ponto lima vira um balão de fala: a silhueta já diz
 *  "converse comigo" antes de qualquer ícone. A cauda é o gesto da Liza — balança
 *  de leve pro lado do cursor, aponta pro composer quando o painel abre, abana
 *  na comemoração e murcha no erro/sono. E quando ela escreve, os dois olhos
 *  descem pra linha e viram os três pontinhos de "digitando" (o terceiro nasce
 *  no meio): o indicador de streaming É o rosto. */

const LIMA = "var(--brand-lime)";
const TINTA = "var(--brand-ink)";
/** amarelo da marca = celebração (nunca alerta) — só na faísca do `pronto` */
const DESTAQUE = "var(--destaque)";

const CX = 52;
const CY = 48;
const R = 42;
/** cauda em repouso apontando pra baixo-esquerda; a base fica escondida
 *  dentro do círculo (desenhado por cima), então a junção é limpa */
const CAUDA = "M46 82C42 89 32 94 17 95C25 89 29 82 30 72Z";
const FAISCA =
  "M0 -8C1 -3 3 -1 8 0C3 1 1 3 0 8C-1 3 -3 1 -8 0C-3 -1 -1 -3 0 -8Z";

type Forma = "olho" | "arco" | "digitando";

type Pose = {
  alvo: Ponto | null;
  /** escala dos olhos */
  s: number;
  /** aperto extra do olho direito (o "hmm" de quem está pensando) */
  sDir: number;
  palpebra: number;
  aflicao: number;
  forma: Forma;
  /** ângulo-base da cauda em graus (+ = sobe pra esquerda, − = murcha pra baixo) */
  cauda: number;
  cabeca: number;
  corpo: { sx: number; sy: number; rotate: number };
};

const BASE: Pose = {
  alvo: null,
  s: 1,
  sDir: 1,
  palpebra: -0.35,
  aflicao: 0,
  forma: "olho",
  cauda: 0,
  cabeca: 0,
  corpo: { sx: 1, sy: 1, rotate: 0 },
};

function poseDe(estado: LizaEstado, momento: boolean, detalhe: boolean): Pose {
  switch (estado) {
    case "atento":
      return { ...BASE, s: 1.12, palpebra: -0.5, corpo: { sx: 1.03, sy: 1.03, rotate: 0 } };
    case "aberto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.2 }, forma: "arco" }
        : // olha e aponta pra baixo-esquerda, onde fica o composer
          { ...BASE, alvo: { x: -0.75, y: 0.6 }, cauda: 5 };
    case "consultando":
      return { ...BASE, alvo: { x: 0.6, y: -0.8 }, sDir: detalhe ? 0.72 : 1, palpebra: 0.04, cauda: 6 };
    case "escrevendo":
      return { ...BASE, alvo: { x: 0, y: 0 }, forma: "digitando" };
    case "pronto":
      return momento ? { ...BASE, alvo: { x: 0, y: -0.15 }, forma: "arco" } : BASE;
    case "erro":
      return {
        ...BASE,
        alvo: { x: -0.1, y: 0.35 },
        s: detalhe ? 0.86 : 0.8,
        palpebra: detalhe ? 0.24 : -0.35,
        aflicao: detalhe ? 18 : 0,
        cabeca: -6,
        cauda: -10,
        // murcha um pouco, como um balão perdendo ar
        corpo: { sx: 1.02, sy: 0.95, rotate: -3 },
      };
    case "sonolento":
      return detalhe
        ? { ...BASE, alvo: { x: 0, y: 0.4 }, palpebra: 0.54, cauda: -8 }
        : { ...BASE, alvo: { x: 0, y: 0.4 }, sDir: 0.42, s: 1, cauda: -8 };
    default:
      return BASE;
  }
}

type Alvo = Record<string, number | number[]>;

const PULO_T: Transition = {
  duration: 0.75,
  times: [0, 0.16, 0.46, 0.72, 1],
  ease: [EASE, "easeOut", "easeIn", EASE],
};

function movimento({
  efetivo,
  momento,
  festa,
  reduzido,
  pose,
  transicao,
  tamanho,
}: {
  efetivo: LizaEstado;
  momento: boolean;
  festa: boolean;
  reduzido: boolean;
  pose: Pose;
  transicao: Transition;
  tamanho: number;
}): { corpo: Alvo; corpoT: Transition; abano: Alvo; abanoT: Transition } {
  const c = pose.corpo;
  const estatico = {
    corpo: { y: 0, scaleX: c.sx, scaleY: c.sy, rotate: c.rotate },
    corpoT: transicao,
    abano: { rotate: 0 },
    abanoT: transicao,
  };
  if (reduzido) return estatico;

  if (festa) {
    const pulo = px2u(5, tamanho);
    return {
      corpo: {
        y: [0, 0, -pulo, 0, 0],
        scaleX: [1, 1.05, 0.97, 1.04, 1],
        scaleY: [1, 0.93, 1.04, 0.94, 1],
        rotate: 0,
      },
      corpoT: PULO_T,
      // a cauda abana no ritmo do pulo (atrasa um pouco: follow-through)
      abano: { rotate: [0, 0, 12, -8, 3, 0] },
      abanoT: { duration: 0.9, times: [0, 0.12, 0.4, 0.65, 0.85, 1], ease: "easeInOut" },
    };
  }
  if (efetivo === "aberto" && momento) {
    return {
      corpo: { y: 0, scaleX: [1, 1.06, 0.99, 1], scaleY: [1, 1.06, 0.99, 1], rotate: 0 },
      corpoT: { duration: 0.5, times: [0, 0.4, 0.75, 1], ease: EASE },
      abano: { rotate: [0, 10, -5, 0] },
      abanoT: { duration: 0.6, ease: "easeInOut" },
    };
  }
  if (efetivo === "erro" && momento) {
    // o "não deu": um balanço curto da cabeça antes de assentar murcho
    // (a pose já traz a careta; aqui é só o gesto de entrada)
    const r = c.rotate;
    return {
      corpo: { y: 0, scaleX: c.sx, scaleY: c.sy, rotate: [r, r - 3.5, r + 3, r - 1.5, r] },
      corpoT: { duration: 0.55, times: [0, 0.22, 0.5, 0.78, 1], ease: "easeInOut" },
      abano: { rotate: 0 },
      abanoT: transicao,
    };
  }
  if (efetivo === "consultando") {
    const flutua = Math.min(px2u(2, tamanho), 2.5);
    const loop = { duration: 2.6, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      corpo: { y: [0, -flutua, 0], scaleX: 1, scaleY: 1, rotate: 0 },
      corpoT: { default: transicao, y: loop },
      // a cauda enrola devagar, como quem tamborila os dedos
      abano: { rotate: [0, 5, 0] },
      abanoT: loop,
    };
  }
  if (efetivo === "sonolento") {
    const loop = { duration: 5.2, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 1.012, 1], scaleY: [1, 1.018, 1], rotate: 0 },
      corpoT: { default: transicao, scaleX: loop, scaleY: loop },
    };
  }
  if (efetivo === "parado") {
    // respiração quase subliminar — presença viva no canto; bem mais leve
    // que o respiro fundo do "sonolento" (ela só acorda, não dorme)
    const loop = { duration: 4.6, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 1.008, 1], scaleY: [1, 1.014, 1], rotate: 0 },
      corpoT: { default: transicao, scaleX: loop, scaleY: loop },
    };
  }
  return estatico;
}

export function LizaBalao({ estado, tamanho, seguirCursor = true, className }: LizaProps) {
  const ref = useRef<SVGSVGElement>(null);
  const clipId = `liza-balao-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduzido = useReduzido();
  const momento = useMomento(estado);
  const detalhe = tamanho >= 28;
  const brilho = tamanho >= 40;

  const efetivo: LizaEstado = estado === "pronto" && !momento ? "parado" : estado;
  const festa = estado === "pronto" && momento;
  const pose = poseDe(efetivo, momento, detalhe);
  const digitando = pose.forma === "digitando";

  const olhar = useOlhar(ref, {
    seguir: seguirCursor,
    alvo: pose.alvo,
    // consultando varre o olhar esquerda→direita no ritmo de leitura —
    // ela está "lendo" os dados que a tool trouxe
    varrer: efetivo === "consultando",
    reduzido,
  });
  const abertura = usePiscar({
    ativo: pose.forma === "olho",
    reduzido,
    lento: efetivo === "sonolento" || efetivo === "consultando",
  });
  const inclina = useAlvoMola(efetivo === "atento" ? 1 : 0, reduzido);
  const caudaBase = useAlvoMola(pose.cauda, reduzido);

  const raio = detalhe ? { x: 7, y: 6 } : { x: 5, y: 4.5 };
  const ox = useTransform(olhar.x, (v) => v * raio.x);
  const oy = useTransform(olhar.y, (v) => v * raio.y);
  const rx = useTransform([olhar.x, inclina], ([g, k]: number[]) => g * k * 3);
  const ry = useTransform([olhar.y, inclina], ([g, k]: number[]) => g * k * 2.2);
  const hx = useTransform(olhar.x, (v) => v * -1.2);
  // cauda: ângulo do estado + balanço pro lado do cursor (mais forte no hover).
  // Cursor à direita → a cauda desce (gira anti-horário), à esquerda → sobe
  const caudaRot = useTransform(
    [olhar.x, inclina, caudaBase],
    ([g, k, b]: number[]) => b - g * (6 + 8 * k),
  );

  const transicao: Transition = reduzido ? REDUZIDA : efetivo === "atento" ? MOLA_RAPIDA : MOLA;
  const { corpo, corpoT, abano, abanoT } = movimento({
    efetivo,
    momento,
    festa,
    reduzido,
    pose,
    transicao,
    tamanho,
  });

  // +17% eyes like the blob (8363514 enlarged the blob's eyes but the
  // concept variants were left on the old dims)
  const olho = detalhe ? { r: 8.2, dx: 15, cy: 44 } : { r: 10.3, dx: 16, cy: 45 };
  const ponto = detalhe ? { r: 5, dx: 18, cy: 49 } : { r: 6.2, dx: 19, cy: 49 };
  const flutuaRosto = !reduzido && efetivo === "consultando";

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      overflow="visible"
      aria-hidden
      focusable="false"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>

      <motion.g
        initial={false}
        animate={corpo}
        transition={corpoT}
        style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY + R}px` }}
      >
        <motion.g style={{ rotate: caudaRot, transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}>
          <motion.g
            initial={false}
            animate={abano}
            transition={abanoT}
            style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}
          >
            {/* traço lima arredonda a ponta da cauda sem mudar a silhueta */}
            <path d={CAUDA} fill={LIMA} stroke={LIMA} strokeWidth={3} strokeLinejoin="round" />
          </motion.g>
        </motion.g>
        <circle cx={CX} cy={CY} r={R} fill={LIMA} />

        <g clipPath={`url(#${clipId})`}>
          <motion.g style={{ x: rx, y: ry }}>
            <motion.g
              initial={false}
              animate={{ rotate: pose.cabeca }}
              transition={transicao}
              style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}
            >
              {([-1, 1] as const).map((lado, i) => (
                <Olho
                  key={lado}
                  lado={lado}
                  indice={i === 0 ? 0 : 2}
                  cx={CX + lado * olho.dx}
                  cy={olho.cy}
                  r={olho.r}
                  ponto={{ x: CX + lado * ponto.dx, y: ponto.cy, r: ponto.r }}
                  pose={pose}
                  ox={ox}
                  oy={oy}
                  hx={hx}
                  abertura={abertura}
                  transicao={transicao}
                  detalhe={detalhe}
                  brilho={brilho && !digitando}
                  reduzido={reduzido}
                  flutua={flutuaRosto}
                />
              ))}
              {/* o terceiro pontinho nasce no meio quando ela começa a escrever */}
              <motion.g
                initial={false}
                animate={{ opacity: digitando ? 1 : 0, scale: digitando ? 1 : 0.2 }}
                transition={{ default: transicao, opacity: FADE }}
              >
                <g transform={`translate(${CX} ${ponto.cy})`}>
                  <Pulo indice={1} ativo={digitando} reduzido={reduzido}>
                    <circle r={ponto.r} fill={TINTA} />
                  </Pulo>
                </g>
              </motion.g>
            </motion.g>
          </motion.g>
        </g>
      </motion.g>

      {/* faísca amarela: aparece uma vez, no `pronto` */}
      {detalhe && (
        <g transform="translate(89 11)">
          <motion.g
            initial={false}
            animate={{
              opacity: festa ? 1 : 0,
              scale: festa ? 1 : 0.3,
              rotate: festa ? 0 : -60,
            }}
            transition={
              festa
                ? { default: reduzido ? REDUZIDA : { ...MOLA, delay: 0.3 }, opacity: { ...FADE, delay: reduzido ? 0 : 0.3 } }
                : { default: transicao, opacity: FADE }
            }
          >
            <path d={FAISCA} fill={DESTAQUE} />
          </motion.g>
        </g>
      )}
    </svg>
  );
}

/** Pontinho de "digitando": onda de 1,2s com defasagem por índice. Sob
 *  reduced motion vira pulso de opacidade (indicador de carregamento é
 *  feedback essencial — muda a forma, não some). */
function Pulo({
  indice,
  ativo,
  reduzido,
  children,
}: {
  indice: number;
  ativo: boolean;
  reduzido: boolean;
  children: React.ReactNode;
}) {
  const loop = { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: indice * 0.15 } as const;
  const anim = !ativo
    ? { y: 0, opacity: 1 }
    : reduzido
      ? { y: 0, opacity: [1, 0.4, 1] }
      : { y: [0, -3.5, 0, 0], opacity: [1, 1, 0.7, 1] };
  const t: Transition = !ativo
    ? FADE
    : reduzido
      ? loop
      : { ...loop, times: [0, 0.25, 0.5, 1] };
  return (
    <motion.g initial={false} animate={anim} transition={t}>
      {children}
    </motion.g>
  );
}

function Olho({
  lado,
  indice,
  cx,
  cy,
  r,
  ponto,
  pose,
  ox,
  oy,
  hx,
  abertura,
  transicao,
  detalhe,
  brilho,
  reduzido,
  flutua,
}: {
  lado: -1 | 1;
  indice: number;
  cx: number;
  cy: number;
  r: number;
  ponto: { x: number; y: number; r: number };
  pose: Pose;
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  hx: MotionValue<number>;
  abertura: MotionValue<number>;
  transicao: Transition;
  detalhe: boolean;
  brilho: boolean;
  reduzido: boolean;
  flutua: boolean;
}) {
  const digitando = pose.forma === "digitando";
  const arco = pose.forma === "arco";
  const visivel = !arco; // olho e pontinho são o mesmo círculo
  const h = r * 2;
  const sy = lado === 1 ? pose.s * pose.sDir : pose.s;

  return (
    <motion.g style={{ x: ox, y: oy }}>
      {/* desce pra linha dos pontinhos quando escreve */}
      <motion.g
        initial={false}
        animate={{
          x: digitando ? ponto.x - cx : 0,
          y: digitando ? ponto.y - cy : flutua ? [0, -1.2, 0] : 0,
        }}
        transition={
          flutua && !digitando
            ? { default: transicao, y: { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: lado === 1 ? 0.12 : 0 } }
            : transicao
        }
      >
        <g transform={`translate(${cx} ${cy})`}>
          <motion.g
            initial={false}
            animate={{
              scaleX: digitando ? ponto.r / r : visivel ? pose.s : 0.8,
              scaleY: digitando ? ponto.r / r : visivel ? sy : 0.25,
              opacity: visivel ? 1 : 0,
            }}
            transition={{ default: transicao, opacity: FADE }}
          >
            <Pulo indice={indice} ativo={digitando} reduzido={reduzido}>
              <motion.g style={{ scaleY: abertura, transformOrigin: "50% 60%" }}>
                <circle r={r} fill={TINTA} />
                {brilho && (
                  <motion.g style={{ x: hx }}>
                    <circle cx={r * 0.36} cy={-r * 0.38} r={r * 0.34} fill="#fff" />
                  </motion.g>
                )}
              </motion.g>
            </Pulo>
          </motion.g>

          {detalhe && (
            <motion.g
              initial={false}
              animate={{ y: digitando ? -h : pose.palpebra * h, rotate: -lado * pose.aflicao }}
              transition={transicao}
              style={{ transformOrigin: "50% 100%" }}
            >
              <rect x={-r * 2.6} y={-r - 22} width={r * 5.2} height={22} fill={LIMA} />
            </motion.g>
          )}

          <motion.g
            initial={false}
            animate={{ opacity: arco ? 1 : 0, y: arco ? 0 : 3, scale: arco ? 1 : 0.8 }}
            transition={{ default: transicao, opacity: FADE }}
          >
            <path
              d={`M${-r * 1.15} ${r * 0.2}Q0 ${-r * 1.05} ${r * 1.15} ${r * 0.2}`}
              fill="none"
              stroke={TINTA}
              strokeWidth={detalhe ? 4.4 : 6}
              strokeLinecap="round"
            />
          </motion.g>
        </g>
      </motion.g>
    </motion.g>
  );
}
