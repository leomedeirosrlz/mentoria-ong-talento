import { ellipse, line, pill, poly, rect, ring } from "./fun";
import type { Icon, Layer, Shape, Vec } from "./fun";
import { drift, erase, flick, hop, impact, latch, look, bounce, twinkle, twist } from "./motions";
import { EXT, FACE, LINHA, brilho } from "./base";

// Os seis instrumentos do programa de mentoria. Mesma casa dos níveis: raiz
// sem inclinação carrega o movimento e os brilhos, a camada `face` inclina,
// e as partes presas na face balançam no plano dela.

const r2 = (n: number) => +n.toFixed(2);

function raiz(p: Vec, k: number, m?: Layer["m"]): Layer {
  return { id: "raiz", p, s: [k, k], m, shapes: [] };
}
function face(shapes: Shape[]): Layer {
  return { id: "face", parent: "raiz", tilt: FACE, shapes };
}

/** Brilho que entra na batida `t` e o mesmo brilho saindo no começo, para o laço fechar. */
function luz(p: Vec, r: number, t: number): Layer[] {
  return [brilho("raiz", p, r, twinkle(0, true), { op: 30 }), brilho("raiz", p, r, twinkle(t), { ip: t })];
}

function icone(name: string, layers: Layer[], still?: number): Icon {
  return { name, frames: 180, ...(still === undefined ? {} : { still }), line: LINHA, extrude: EXT, layers };
}

// Rodas da vida

const FATIAS = 6;
const COR_FATIA = ["main", "ok", "main", "ok", "main", "ok"] as const;

/** Fatia de pizza partindo do topo; o arco é um `A` de verdade, sem facetas. */
function fatia(i: number, r: number): string {
  const a0 = ((-90 + (360 / FATIAS) * i) * Math.PI) / 180;
  const a1 = ((-90 + (360 / FATIAS) * (i + 1)) * Math.PI) / 180;
  const [x0, y0, x1, y1] = [r * Math.cos(a0), r * Math.sin(a0), r * Math.cos(a1), r * Math.sin(a1)].map(r2);
  return `M0 0L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z`;
}

function roda(raios: number[]): Shape[] {
  return raios.map((r, i) => ({
    d: fatia(i, r),
    fill: COR_FATIA[i],
    depth: r2(0.45 + (r / 110) * 0.5),
    crease: false,
  }));
}

const PLACA = rect(-134, -118, 268, 236, 34);

const CHECK: Vec[] = [[-26, 2], [-14, -10], [-6, -2], [16, -26], [28, -14], [-6, 24]];

const rodaInicial: Icon = icone("inst-roda-inicial", [
  raiz([250, 264], 114),
  face([
    { d: PLACA, fill: "white", depth: 1 },
    // o disco-guia mostra a roda inteira; as fatias dizem quanto da vida está preenchido
    { d: ellipse(0, 0, 112), fill: "paper", depth: 0.15 },
  ]),
  // a roda gira solta sobre a placa; só a rotação do `twist`, sem o deslize dele
  { id: "roda", parent: "face", m: { r: twist.r, k: 2.2 }, shapes: roda([54, 76, 108, 96, 68, 90]) },
  { parent: "face", shapes: [{ d: ellipse(0, 0, 16), fill: "white", depth: 0.2 }] },
  ...luz([-136, -128], 22, 80),
]);

const ESTAMPA: Vec = [92, 72];

const rodaFormal: Icon = icone(
  "inst-roda-formal",
  [
    raiz([250, 264], 114, impact([4, 12])),
    face([
      { d: PLACA, fill: "white", depth: 1 },
      // o aro-guia só existe na roda oficial: todas as fatias chegam nele
      { d: ellipse(0, 0, 118), fill: "paper", depth: 0.15 },
    ]),
    { parent: "face", shapes: roda([100, 108, 96, 108, 102, 98]) },
    { parent: "face", shapes: [{ d: ellipse(0, 0, 18), fill: "white", depth: 0.2 }] },
    // carimbo: desce no canto com o `latch` e a roda sente o golpe no `impact`
    {
      id: "carimbo",
      parent: "face",
      a: ESTAMPA,
      p: ESTAMPA,
      m: latch([-4, 18]),
      shapes: [
        { d: ellipse(ESTAMPA[0], ESTAMPA[1], 52), fill: "gold", depth: 0.9 },
        { d: poly(CHECK.map(([x, y]): Vec => [ESTAMPA[0] + x * 0.95, ESTAMPA[1] + y * 0.95]), 3), fill: "white", depth: 0.3 },
      ],
    },
    ...luz([-138, -134], 22, 60),
  ],
  119
);

// Visão de futuro

const OLHO = "M-120 0Q0 -116 120 0Q0 116 -120 0Z";

const visao: Icon = icone("inst-visao", [
  raiz([250, 264], 112, hop),
  face([
    { d: rect(-140, -104, 280, 208, 34), fill: "main", depth: 1 },
    { d: OLHO, fill: "white", depth: 0.3, crease: false },
  ]),
  // o olho é só máscara: íris e pupila deslizam por dentro dele
  { id: "olho", parent: "face", shapes: [{ d: OLHO, fill: "white", line: false }] },
  { parent: "face", clip: "olho", m: { ...look, at: 14, k: 1.1 }, shapes: [{ d: ellipse(0, 0, 50), fill: "ok" }] },
  {
    parent: "face",
    clip: "olho",
    m: { ...look, at: 19, k: 1.5 },
    shapes: [
      { d: ellipse(0, 0, 25), fill: "ink", line: false },
      { d: ellipse(-8, -9, 8), fill: "white", line: false },
    ],
  },
  ...luz([140, -130], 20, 58),
]);

// Metas

const ALVO_R = 112;
// direção de onde a flecha vem (da direita acima) e quanto ela corre até cravar
const DIR: Vec = [0.8, -0.6];
const CURSO = 44;

function ponto(t: number, lado = 0): Vec {
  return [r2(DIR[0] * t + -DIR[1] * lado), r2(DIR[1] * t + DIR[0] * lado)];
}

/** Quadrilátero ao longo da flecha: de `t0` a `t1` com meia-largura `w0`/`w1`. */
function trecho(t0: number, t1: number, w0: number, w1 = w0): Vec[] {
  return [ponto(t0, -w0), ponto(t1, -w1), ponto(t1, w1), ponto(t0, w0)];
}
const deslocar = (pts: Vec[], [dx, dy]: Vec): Vec[] => pts.map(([x, y]): Vec => [r2(x + dx), r2(y + dy)]);

// a flecha é desenhada recuada; o `latch` a empurra CURSO adiante, até a ponta no centro
const RECUO: Vec = [DIR[0] * CURSO, DIR[1] * CURSO];

const metas: Icon = icone(
  "inst-metas",
  [
    raiz([250, 268], 114, impact([-6, 8])),
    face([
      { d: ellipse(0, 0, ALVO_R), fill: "ok", depth: 1 },
      { d: ellipse(0, 0, 78), fill: "white", depth: 0.3 },
      { d: ellipse(0, 0, 42), fill: "main", depth: 0.3 },
    ]),
    {
      id: "flecha",
      parent: "face",
      m: latch([-DIR[0] * CURSO, -DIR[1] * CURSO]),
      shapes: [
        { d: poly(deslocar(trecho(0, 130, 8), RECUO)), fill: "grey", depth: 0.6 },
        { d: poly(deslocar(trecho(-6, 40, 0, 18).reverse(), RECUO), 2), fill: "ink", depth: 0.6 },
      ],
    },
    // as penas vibram depois da cravada, com o `flick` do kit
    {
      parent: "flecha",
      a: [RECUO[0] + ponto(130)[0], RECUO[1] + ponto(130)[1]],
      p: [RECUO[0] + ponto(130)[0], RECUO[1] + ponto(130)[1]],
      m: { ...flick, at: 4, k: 1.4 },
      shapes: [
        { d: poly(deslocar([ponto(96, -4), ponto(150, -4), ponto(162, -30), ponto(110, -30)], RECUO), 2), fill: "white", depth: 0.4 },
        { d: poly(deslocar([ponto(96, 4), ponto(150, 4), ponto(162, 30), ponto(110, 30)], RECUO), 2), fill: "white", depth: 0.4 },
      ],
    },
    ...luz([-140, -128], 20, 52),
  ],
  100
);

// PDM

const LINHAS: Array<[number, number]> = [
  [-70, 70],
  [-70, 70],
  [-70, 18],
];

const pdm: Icon = icone("inst-pdm", [
  raiz([250, 270], 110),
  face([
    { d: rect(-112, -126, 224, 252, 26), fill: "main", depth: 1 },
    { d: rect(-90, -92, 180, 198, 10), fill: "white", depth: 0.25 },
    { d: pill(-46, -144, 92, 40), fill: "grey", depth: 0.6 },
    { d: pill(-18, -132, 36, 12), fill: "ink", line: false },
    ...LINHAS.map(([x0, x1], i): Shape => ({
      d: line([x0, -48 + i * 34], [x1, -48 + i * 34]),
      trim: erase(24 + i * 5, 84 + i * 5),
    })),
  ]),
  // o check some quando o texto é apagado e volta, em pop, quando termina de reescrever
  {
    parent: "face",
    a: [58, 70],
    p: [58, 70],
    op: 44,
    m: twinkle(16, true),
    shapes: [
      { d: ellipse(58, 70, 34), fill: "ok", depth: 0.6 },
      { d: poly(CHECK.map(([x, y]): Vec => [58 + x * 0.6, 70 + y * 0.6]), 2), fill: "white", depth: 0.2 },
    ],
  },
  {
    parent: "face",
    a: [58, 70],
    p: [58, 70],
    ip: 108,
    m: twinkle(108),
    shapes: [
      { d: ellipse(58, 70, 34), fill: "ok", depth: 0.6 },
      { d: poly(CHECK.map(([x, y]): Vec => [58 + x * 0.6, 70 + y * 0.6]), 2), fill: "white", depth: 0.2 },
    ],
  },
  ...luz([128, -140], 20, 112),
]);

// Avaliação 360

const R_ORBITA = 108;
/** Pessoa dentro de um disco: a 40px vira uma bolinha, a 160px ainda se lê gente. */
const PESSOA = (cx: number, cy: number): Shape[] => [
  { d: ellipse(cx, cy, 32), fill: "main", depth: 0.7 },
  { d: ellipse(cx, cy - 8, 9), fill: "white", depth: 0.1, line: false },
  { d: pill(cx - 15, cy + 4, 30, 14), fill: "white", depth: 0.1, line: false },
];

/** Cada pessoa gira no seu próprio `drift`, um pouco depois e com amplitude diferente: o anel respira. */
const orbitante = (graus: number, k: number, at: number): Layer => {
  const a = ((-90 + graus) * Math.PI) / 180;
  return {
    parent: "face",
    m: { ...drift[0], at, k },
    shapes: PESSOA(r2(R_ORBITA * Math.cos(a)), r2(R_ORBITA * Math.sin(a))),
  };
};

const avaliacao360: Icon = icone("inst-360", [
  raiz([250, 268], 114),
  face([{ d: ring(0, 0, R_ORBITA + 12, R_ORBITA - 12), fill: "white", depth: 0.4 }]),
  { parent: "face", m: { ...bounce, k: 0.6 }, shapes: [{ d: ellipse(0, 0, 58), fill: "ok", depth: 1 }, { d: ellipse(0, -10, 16), fill: "white", depth: 0.2 }, { d: pill(-24, 8, 48, 22), fill: "white", depth: 0.2 }] },
  orbitante(0, 4, 0),
  orbitante(120, 5, 6),
  orbitante(240, 6, 12),
  ...luz([140, -130], 20, 50),
]);

export const INSTRUMENTOS: Record<string, Icon> = {
  "inst-roda-inicial": rodaInicial,
  "inst-roda-formal": rodaFormal,
  "inst-visao": visao,
  "inst-metas": metas,
  "inst-pdm": pdm,
  "inst-360": avaliacao360,
};
