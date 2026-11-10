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

/** Conceito A — "Disco". O ponto lima da marca, com dois olhos. Toda a
 *  expressão mora nos olhos: escala da pílula, pálpebra (um recorte lima que
 *  desce e inclina), troca de forma (pílula → arco ^ ^ → estrela) e direção
 *  do olhar. O disco quase não se mexe: só pula no `pronto` e respira no
 *  `sonolento`. Por isso ele é drop-in no FAB atual (mesmo círculo lima). */

const LIMA = "var(--brand-lime)";
const TINTA = "var(--brand-ink)";

/** estrela de 4 pontas, raio 9, com as curvas cheias do Sparkle do Phosphor
 *  — o ícone antigo do assistente reaparece nos olhos na comemoração */
const ESTRELA =
  "M0 -9C1.1 -3.4 3.4 -1.1 9 0C3.4 1.1 1.1 3.4 0 9C-1.1 3.4 -3.4 1.1 -9 0C-3.4 -1.1 -1.1 -3.4 0 -9Z";

type Forma = "pilula" | "arco" | "estrela";

type Pose = {
  alvo: Ponto | null;
  sx: number;
  sy: number;
  /** descida da pálpebra em fração da altura do olho (<0 = recolhida) */
  palpebra: number;
  /** inclinação "preocupada" da pálpebra em graus (canto interno sobe) */
  aflicao: number;
  forma: Forma;
  /** inclinação da cabeça (rosto inteiro) em graus */
  cabeca: number;
};

const BASE: Pose = {
  alvo: null,
  sx: 1,
  sy: 1,
  palpebra: -0.3,
  aflicao: 0,
  forma: "pilula",
  cabeca: 0,
};

function poseDe(estado: LizaEstado, momento: boolean, detalhe: boolean): Pose {
  switch (estado) {
    case "atento":
      // olhos se abrem um pouco: a pálpebra recolhe junto pra não morder a pílula
      return { ...BASE, sx: 1.08, sy: 1.14, palpebra: -0.45 };
    case "aberto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.2 }, forma: "arco" }
        : // acomoda olhando pra baixo-esquerda, onde fica o composer
          { ...BASE, alvo: { x: -0.75, y: 0.6 } };
    case "consultando":
      return { ...BASE, alvo: { x: 0.6, y: -0.8 }, palpebra: 0.06 };
    case "escrevendo":
      // leitura: olhos levemente apertados, concentrados
      return { ...BASE, alvo: { x: 0, y: 0.3 }, sx: 1.04, sy: 0.84, palpebra: detalhe ? 0.08 : -0.3 };
    case "pronto":
      return momento ? { ...BASE, alvo: { x: 0, y: -0.15 }, forma: "estrela" } : BASE;
    case "erro":
      return detalhe
        ? { ...BASE, alvo: { x: -0.1, y: 0.35 }, sx: 0.86, sy: 0.86, palpebra: 0.24, aflicao: 18, cabeca: -7 }
        : // abaixo de 28px a pálpebra some: olhos menores + cabeça inclinada
          { ...BASE, alvo: { x: -0.1, y: 0.35 }, sx: 0.8, sy: 0.8, cabeca: -7 };
    case "sonolento":
      return detalhe
        ? { ...BASE, alvo: { x: 0, y: 0.4 }, palpebra: 0.54 }
        : { ...BASE, alvo: { x: 0, y: 0.4 }, sy: 0.42 };
    default:
      return BASE;
  }
}

const REPOUSO = { y: 0, scaleX: 1, scaleY: 1 };

export function LizaDisco({ estado, tamanho, seguirCursor = true, className }: LizaProps) {
  const ref = useRef<SVGSVGElement>(null);
  const clipId = `liza-disco-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduzido = useReduzido();
  const momento = useMomento(estado);
  const detalhe = tamanho >= 28; // pálpebras
  const brilho = tamanho >= 40; // ponto de luz no olho

  // depois do pulo o `pronto` se comporta como `parado`
  const efetivo: LizaEstado = estado === "pronto" && !momento ? "parado" : estado;
  const festa = estado === "pronto" && momento;
  const pose = poseDe(efetivo, momento, detalhe);

  const olhar = useOlhar(ref, {
    seguir: seguirCursor,
    alvo: pose.alvo,
    varrer: efetivo === "escrevendo",
    pensar: efetivo === "consultando",
    reduzido,
  });
  const abertura = usePiscar({
    // sono suspende a piscada: a pálpebra já desceu, não tem o que fechar
    ativo: pose.forma === "pilula" && efetivo !== "sonolento",
    reduzido,
    lento: efetivo === "consultando",
    gatilho: efetivo,
  });
  const inclina = useAlvoMola(efetivo === "atento" ? 1 : 0, reduzido);

  // raio do olhar em unidades do viewBox (olhos maiores no tamanho mínimo
  // → raio menor, pra não encostarem na borda)
  const raio = detalhe ? { x: 9, y: 7 } : { x: 6, y: 5 };
  const ox = useTransform(olhar.x, (v) => v * raio.x);
  const oy = useTransform(olhar.y, (v) => v * raio.y);
  // o rosto inteiro "se inclina" pro cursor no hover
  const rx = useTransform([olhar.x, inclina], ([g, k]: number[]) => g * k * 3);
  const ry = useTransform([olhar.y, inclina], ([g, k]: number[]) => g * k * 2.2);
  // o reflexo anda menos que o olho (paralaxe): o olho gira, a luz fica
  const hx = useTransform(olhar.x, (v) => v * -1.4);

  const transicao: Transition = reduzido ? REDUZIDA : efetivo === "atento" ? MOLA_RAPIDA : MOLA;

  // corpo: pulo único no `pronto`, respiração lenta no `sonolento`
  const pulo = px2u(5, tamanho);
  let corpo: Record<string, number | number[]> = REPOUSO;
  let corpoT: Transition = transicao;
  if (!reduzido && festa) {
    corpo = {
      y: [0, 0, -pulo, 0, 0],
      scaleX: [1, 1.05, 0.97, 1.04, 1],
      scaleY: [1, 0.93, 1.04, 0.94, 1],
    };
    // agacha → sobe desacelerando → cai acelerando → assenta
    corpoT = { duration: 0.75, times: [0, 0.16, 0.46, 0.72, 1], ease: [EASE, "easeOut", "easeIn", EASE] };
  } else if (!reduzido && efetivo === "sonolento") {
    corpo = { y: 0, scaleX: [1, 1.01, 1], scaleY: [1, 1.02, 1] };
    corpoT = { duration: 4.8, repeat: Infinity, ease: "easeInOut" };
  }

  // rosto: flutuação lenta (≤2px) enquanto consulta; inclinação no erro
  const flutua = Math.min(px2u(2, tamanho), 2.5);
  const boia = !reduzido && efetivo === "consultando";
  const rosto = { y: boia ? [0, -flutua, 0] : 0, rotate: pose.cabeca };
  const rostoT: Transition = boia
    ? { y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }, rotate: transicao }
    : transicao;

  // +17% eyes like the blob (8363514 enlarged the blob's eyes but the
  // concept variants were left on the old dims)
  const dims = detalhe ? { w: 16.4, h: 24.6, cy: 45 } : { w: 19.9, h: 29.3, cy: 46 };

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
          <circle cx={50} cy={50} r={50} />
        </clipPath>
      </defs>
      <motion.g
        initial={false}
        animate={corpo}
        transition={corpoT}
        style={{ transformBox: "view-box", transformOrigin: "50px 100px" }}
      >
        <circle cx={50} cy={50} r={50} fill={LIMA} />
        {/* recorte no disco: a pálpebra lima nunca vaza pra fora do círculo */}
        <g clipPath={`url(#${clipId})`}>
          <motion.g style={{ x: rx, y: ry }}>
            <motion.g
              initial={false}
              animate={rosto}
              transition={rostoT}
              style={{ transformBox: "view-box", transformOrigin: "50px 50px" }}
            >
              {([-1, 1] as const).map((lado) => (
                <Olho
                  key={lado}
                  lado={lado}
                  cx={50 + lado * 18}
                  cy={dims.cy}
                  w={dims.w}
                  h={dims.h}
                  pose={pose}
                  festa={festa}
                  ox={ox}
                  oy={oy}
                  hx={hx}
                  abertura={abertura}
                  transicao={transicao}
                  detalhe={detalhe}
                  brilho={brilho}
                />
              ))}
            </motion.g>
          </motion.g>
        </g>
      </motion.g>
    </svg>
  );
}

function Olho({
  lado,
  cx,
  cy,
  w,
  h,
  pose,
  festa,
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
  w: number;
  h: number;
  pose: Pose;
  festa: boolean;
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  hx: MotionValue<number>;
  abertura: MotionValue<number>;
  transicao: Transition;
  detalhe: boolean;
  brilho: boolean;
}) {
  const pilula = pose.forma === "pilula";
  const arco = pose.forma === "arco";
  const estrela = pose.forma === "estrela";
  const traco = detalhe ? 5 : 6.5;

  return (
    <motion.g style={{ x: ox, y: oy }}>
      <g transform={`translate(${cx} ${cy})`}>
        {/* pílula: escala da expressão (fora) × piscada (dentro) */}
        <motion.g
          initial={false}
          animate={{
            scaleX: pilula ? pose.sx : 0.8,
            scaleY: pilula ? pose.sy : 0.25,
            opacity: pilula ? 1 : 0,
          }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <motion.g style={{ scaleY: abertura, transformOrigin: "50% 60%" }}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w / 2} fill={TINTA} />
            {brilho && (
              <motion.g style={{ x: hx }}>
                <circle cx={w * 0.2} cy={-h * 0.26} r={w * 0.19} fill="#fff" />
              </motion.g>
            )}
          </motion.g>
        </motion.g>

        {/* pálpebra: recorte lima acima do olho; desce (sono, foco) e inclina
            com o canto interno pra cima (aflição). O esquerdo gira anti-horário */}
        {detalhe && (
          <motion.g
            initial={false}
            animate={{ y: pose.palpebra * h, rotate: -lado * pose.aflicao }}
            transition={transicao}
            style={{ transformOrigin: "50% 100%" }}
          >
            <rect x={-w * 1.4} y={-h / 2 - 26} width={w * 2.8} height={26} fill={LIMA} />
          </motion.g>
        )}

        {/* ^ ^ — painel abriu */}
        <motion.g
          initial={false}
          animate={{ opacity: arco ? 1 : 0, y: arco ? 0 : 3, scale: arco ? 1 : 0.8 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <path
            d={`M${-w * 0.62} ${h * 0.12}Q0 ${-h * 0.36} ${w * 0.62} ${h * 0.12}`}
            fill="none"
            stroke={TINTA}
            strokeWidth={traco}
            strokeLinecap="round"
          />
        </motion.g>

        {/* estrela — resposta pronta. Entra girando um oitavo de volta e
            assenta; sai com fade curto */}
        <motion.g
          initial={false}
          animate={{
            opacity: estrela ? 1 : 0,
            scale: estrela ? 1 : 0.4,
            rotate: estrela ? 0 : -45,
          }}
          transition={{ default: festa ? MOLA : transicao, opacity: FADE }}
        >
          <path d={ESTRELA} fill={TINTA} transform={`scale(${(h / 17) * (detalhe ? 1 : 1.05)})`} />
        </motion.g>
      </g>
    </motion.g>
  );
}
