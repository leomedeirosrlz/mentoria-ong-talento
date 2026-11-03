"use client";

import { useId, useRef, type ReactNode } from "react";
import { motion, useTransform, type MotionValue, type Transition } from "motion/react";
import type { ReaEstado, ReaProps } from "./tipos";
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

/** Conceito B — "Blob". Um mochi lima sentado no canto da tela: base larga,
 *  topo macio, sombra de contato. Respira devagar (sempre, bem pouco) e
 *  comunica com o corpo inteiro: espicha quando você chega perto, se encolhe
 *  antes de pular, amassa ao aterrissar, murcha e inclina no erro. Olhos
 *  ovais + uma boquinha que muda de forma (sorriso, "o", aberta, reta, onda). */

const LIMA = "var(--brand-lime)";
const TINTA = "var(--brand-ink)";

/** base mais larga e achatada que o topo — lê como "sentado", não como bola */
const CORPO =
  "M50 10C75 10 92 30 93 56C94 80 80 90 50 90C20 90 6 80 7 56C8 30 25 10 50 10Z";

type Boca = "sorriso" | "o" | "aberta" | "reta" | "onda";

type Pose = {
  alvo: Ponto | null;
  sx: number;
  sy: number;
  palpebra: number;
  forma: "oval" | "arco";
  boca: Boca;
  /** escala e deslocamento do "o" (bico pensativo vai pro lado) */
  bocaEscala: number;
  bocaX: number;
  sobrancelha: boolean;
  /** segundo reflexo nos olhos — o brilho de "deu certo" */
  brilhoExtra: boolean;
  corpo: { sx: number; sy: number; rotate: number };
};

const BASE: Pose = {
  alvo: null,
  sx: 1,
  sy: 1,
  palpebra: -0.35,
  forma: "oval",
  boca: "sorriso",
  bocaEscala: 1,
  bocaX: 0,
  sobrancelha: false,
  brilhoExtra: false,
  corpo: { sx: 1, sy: 1, rotate: 0 },
};

function poseDe(estado: ReaEstado, momento: boolean, detalhe: boolean): Pose {
  switch (estado) {
    case "atento":
      // espicha pra cima, olhos arregalam, boca vira um "o" curioso
      return { ...BASE, sx: 1.08, sy: 1.12, palpebra: -0.5, boca: "o", corpo: { sx: 0.97, sy: 1.04, rotate: 0 } };
    case "aberto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.2 }, forma: "arco", boca: "aberta" }
        : { ...BASE, alvo: { x: -0.75, y: 0.6 } };
    case "consultando":
      return { ...BASE, alvo: { x: 0.6, y: -0.8 }, palpebra: 0.05, boca: "o", bocaEscala: 0.72, bocaX: 2.6 };
    case "escrevendo":
      return { ...BASE, alvo: { x: 0, y: 0.3 }, sy: 0.86, boca: "reta" };
    case "pronto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.15 }, sx: 1.14, sy: 1.14, boca: "aberta", brilhoExtra: true }
        : BASE;
    case "erro":
      return {
        ...BASE,
        alvo: { x: -0.1, y: 0.3 },
        sx: 0.84,
        sy: 0.84,
        boca: "onda",
        sobrancelha: detalhe,
        corpo: { sx: 1.015, sy: 0.97, rotate: -5 },
      };
    case "sonolento":
      return detalhe
        ? { ...BASE, alvo: { x: 0, y: 0.4 }, palpebra: 0.52, boca: "o", bocaEscala: 0.6 }
        : { ...BASE, alvo: { x: 0, y: 0.4 }, sy: 0.42 };
    default:
      return BASE;
  }
}

type Alvo = Record<string, number | number[]>;

/** Coreografia do corpo e da sombra por estado. Sob reduced motion fica só a
 *  pose estática (inclinação/encolhida do erro, espichada do hover). */
function movimentoDoCorpo({
  efetivo,
  momento,
  festa,
  reduzido,
  pose,
  transicao,
  tamanho,
}: {
  efetivo: ReaEstado;
  momento: boolean;
  festa: boolean;
  reduzido: boolean;
  pose: Pose;
  transicao: Transition;
  tamanho: number;
}): { corpo: Alvo; corpoT: Transition; sombra: Alvo; sombraT: Transition } {
  const c = pose.corpo;
  const estatico = {
    corpo: { y: 0, scaleX: c.sx, scaleY: c.sy, rotate: c.rotate },
    corpoT: transicao,
    sombra: { scaleX: 1, opacity: 1 },
    sombraT: transicao,
  };
  if (reduzido) return estatico;

  const respira = (amp: number, dur: number) => {
    const loop = { duration: dur, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      ...estatico,
      // volume quase constante: estica em Y, afina um pouco em X
      corpo: { y: 0, scaleX: [1, 1 - amp * 0.55, 1], scaleY: [1, 1 + amp, 1], rotate: 0 },
      corpoT: { default: transicao, scaleX: loop, scaleY: loop },
    };
  };

  if (festa) {
    const pulo = px2u(5, tamanho);
    // antecipação (agacha) → sobe esticado → cai → amassa → assenta
    const t: Transition = {
      duration: 0.75,
      times: [0, 0.16, 0.46, 0.72, 1],
      ease: [EASE, "easeOut", "easeIn", EASE],
    };
    return {
      corpo: {
        y: [0, 0, -pulo, 0, 0],
        scaleX: [1, 1.07, 0.95, 1.06, 1],
        scaleY: [1, 0.9, 1.06, 0.92, 1],
        rotate: 0,
      },
      corpoT: t,
      // a sombra encolhe e clareia enquanto ele está no ar
      sombra: { scaleX: [1, 1.06, 0.7, 1.08, 1], opacity: [1, 1, 0.45, 1, 1] },
      sombraT: t,
    };
  }
  if (efetivo === "aberto" && momento) {
    // "boing" de alegria, sem sair do chão
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 0.95, 1.03, 1], scaleY: [1, 1.06, 0.98, 1], rotate: 0 },
      corpoT: { duration: 0.55, times: [0, 0.35, 0.7, 1], ease: EASE },
    };
  }
  if (efetivo === "consultando") {
    const flutua = Math.min(px2u(2, tamanho), 2.5);
    const loop = { duration: 2.6, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      corpo: { y: [0, -flutua, 0], scaleX: 1, scaleY: 1, rotate: 0 },
      corpoT: { default: transicao, y: loop },
      // flutua: a sombra acompanha, encolhendo no alto
      sombra: { scaleX: [1, 0.92, 1], opacity: [1, 0.75, 1] },
      sombraT: loop,
    };
  }
  if (efetivo === "sonolento") return respira(0.024, 5.6);
  if (efetivo === "parado" || efetivo === "aberto" || efetivo === "escrevendo") {
    // respiração de repouso: 1,4% de escala, abaixo do limiar de "mexendo"
    return respira(0.014, 4.2);
  }
  return estatico;
}

export function ReaBlob({ estado, tamanho, seguirCursor = true, className }: ReaProps) {
  const ref = useRef<SVGSVGElement>(null);
  const clipId = `rea-blob-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduzido = useReduzido();
  const momento = useMomento(estado);
  const detalhe = tamanho >= 28; // boca, pálpebra, sobrancelha, sombra
  const brilho = tamanho >= 40;

  const efetivo: ReaEstado = estado === "pronto" && !momento ? "parado" : estado;
  const festa = estado === "pronto" && momento;
  const pose = poseDe(efetivo, momento, detalhe);

  const olhar = useOlhar(ref, {
    seguir: seguirCursor,
    alvo: pose.alvo,
    varrer: efetivo === "escrevendo",
    reduzido,
  });
  const abertura = usePiscar({
    ativo: pose.forma === "oval",
    reduzido,
    lento: efetivo === "sonolento" || efetivo === "consultando",
  });
  const inclina = useAlvoMola(efetivo === "atento" ? 1 : 0, reduzido);

  const raio = detalhe ? { x: 8, y: 6 } : { x: 5.5, y: 4.5 };
  const ox = useTransform(olhar.x, (v) => v * raio.x);
  const oy = useTransform(olhar.y, (v) => v * raio.y);
  // a boca anda ~metade do que os olhos andam: o rosto "vira" em 3D
  const bx = useTransform(olhar.x, (v) => v * raio.x * 0.55);
  const by = useTransform(olhar.y, (v) => v * raio.y * 0.45);
  // no hover o corpo inteiro tomba pro lado do cursor, pivotando na base
  const tomba = useTransform([olhar.x, inclina], ([g, k]: number[]) => g * k * 6);
  const hx = useTransform(olhar.x, (v) => v * -1.2);

  const transicao: Transition = reduzido ? REDUZIDA : efetivo === "atento" ? MOLA_RAPIDA : MOLA;

  const { corpo, corpoT, sombra, sombraT } = movimentoDoCorpo({
    efetivo,
    momento,
    festa,
    reduzido,
    pose,
    transicao,
    tamanho,
  });

  const olhoDims = detalhe ? { rx: 5.4, ry: 6.6, cy: 47, dx: 16 } : { rx: 7, ry: 8.6, cy: 49, dx: 17 };

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
          <path d={CORPO} />
        </clipPath>
      </defs>

      {detalhe && (
        <motion.g
          initial={false}
          animate={sombra}
          transition={sombraT}
          style={{ transformBox: "view-box", transformOrigin: "50px 93px" }}
        >
          <ellipse cx={50} cy={93.5} rx={28} ry={3} fill="hsl(0 0% 0% / 0.14)" />
        </motion.g>
      )}

      <motion.g style={{ rotate: tomba, transformBox: "view-box", transformOrigin: "50px 90px" }}>
        <motion.g
          initial={false}
          animate={corpo}
          transition={corpoT}
          style={{ transformBox: "view-box", transformOrigin: "50px 90px" }}
        >
          <path d={CORPO} fill={LIMA} />
          <g clipPath={`url(#${clipId})`}>
            {([-1, 1] as const).map((lado) => (
              <Olho
                key={lado}
                lado={lado}
                cx={50 + lado * olhoDims.dx}
                cy={olhoDims.cy}
                rx={olhoDims.rx}
                ry={olhoDims.ry}
                pose={pose}
                ox={ox}
                oy={oy}
                hx={hx}
                abertura={abertura}
                transicao={transicao}
                detalhe={detalhe}
                brilho={brilho}
              />
            ))}
            {detalhe && (
              <motion.g style={{ x: bx, y: by }}>
                <g transform="translate(50 61)">
                  <BocaForma ativa={pose.boca === "sorriso"} transicao={transicao}>
                    <path d="M-4.2 -1.2Q0 2.8 4.2 -1.2" fill="none" stroke={TINTA} strokeWidth={2.6} strokeLinecap="round" />
                  </BocaForma>
                  <BocaForma
                    ativa={pose.boca === "o"}
                    transicao={transicao}
                    escala={pose.bocaEscala}
                    x={pose.bocaX}
                  >
                    <ellipse cx={0} cy={0.4} rx={2.5} ry={2.3} fill={TINTA} />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "aberta"} transicao={transicao}>
                    <path d="M-5.6 -1.6Q0 -2.4 5.6 -1.6Q5.2 5.6 0 5.8Q-5.2 5.6 -5.6 -1.6Z" fill={TINTA} />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "reta"} transicao={transicao}>
                    <path d="M-3 0.4H3" fill="none" stroke={TINTA} strokeWidth={2.6} strokeLinecap="round" />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "onda"} transicao={transicao}>
                    <path
                      d="M-4.6 0.8Q-2.3 -1.4 0 0.8T4.6 0.8"
                      fill="none"
                      stroke={TINTA}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </BocaForma>
                </g>
              </motion.g>
            )}
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}

function BocaForma({
  ativa,
  transicao,
  escala = 1,
  x = 0,
  children,
}: {
  ativa: boolean;
  transicao: Transition;
  escala?: number;
  x?: number;
  children: ReactNode;
}) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: ativa ? 1 : 0, scale: ativa ? escala : escala * 0.6, x }}
      transition={{ default: transicao, opacity: FADE }}
    >
      {children}
    </motion.g>
  );
}

function Olho({
  lado,
  cx,
  cy,
  rx,
  ry,
  pose,
  ox,
  oy,
  hx,
  abertura,
  transicao,
  detalhe,
  brilho,
}: {
  lado: -1 | 1;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pose: Pose;
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  hx: MotionValue<number>;
  abertura: MotionValue<number>;
  transicao: Transition;
  detalhe: boolean;
  brilho: boolean;
}) {
  const oval = pose.forma === "oval";
  const arco = pose.forma === "arco";
  const h = ry * 2;

  return (
    <motion.g style={{ x: ox, y: oy }}>
      <g transform={`translate(${cx} ${cy})`}>
        <motion.g
          initial={false}
          animate={{ scaleX: oval ? pose.sx : 0.8, scaleY: oval ? pose.sy : 0.25, opacity: oval ? 1 : 0 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <motion.g style={{ scaleY: abertura, transformOrigin: "50% 60%" }}>
            <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={TINTA} />
            {brilho && (
              <motion.g style={{ x: hx }}>
                <circle cx={rx * 0.34} cy={-ry * 0.4} r={rx * 0.36} fill="#fff" />
                <motion.circle
                  cx={-rx * 0.3}
                  cy={ry * 0.32}
                  r={rx * 0.2}
                  fill="#fff"
                  initial={false}
                  animate={{ opacity: pose.brilhoExtra ? 0.9 : 0 }}
                  transition={FADE}
                />
              </motion.g>
            )}
          </motion.g>
        </motion.g>

        {detalhe && (
          <motion.g
            initial={false}
            animate={{ y: pose.palpebra * h }}
            transition={transicao}
            style={{ transformOrigin: "50% 100%" }}
          >
            <rect x={-rx * 2} y={-ry - 16} width={rx * 4} height={16} fill={LIMA} />
          </motion.g>
        )}

        {/* sobrancelha aflita: canto interno pra cima (só no erro) */}
        {detalhe && (
          <motion.g
            initial={false}
            animate={{ opacity: pose.sobrancelha ? 1 : 0, y: pose.sobrancelha ? 0 : 2 }}
            transition={{ default: transicao, opacity: FADE }}
          >
            <path
              d={`M${lado * 5} ${-ry - 3}L${-lado * 4.2} ${-ry - 6.4}`}
              fill="none"
              stroke={TINTA}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </motion.g>
        )}

        <motion.g
          initial={false}
          animate={{ opacity: arco ? 1 : 0, y: arco ? 0 : 3, scale: arco ? 1 : 0.8 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <path
            d={`M${-rx * 1.2} ${ry * 0.15}Q0 ${-ry * 0.95} ${rx * 1.2} ${ry * 0.15}`}
            fill="none"
            stroke={TINTA}
            strokeWidth={detalhe ? 4.4 : 6}
            strokeLinecap="round"
          />
        </motion.g>
      </g>
    </motion.g>
  );
}
