import { ellipse, line, pill, poly, rect, rosette, star } from "./fun";
import type { Icon, Layer, Shape, Swatch, Vec } from "./fun";
import { erase, flicker, hop, jolt, tossLag, twinkle } from "./motions";
import { EXT, FACE, LINHA, brilho } from "./base";

// Famílias de conquista com degraus: o objeto é o mesmo em todos os tiers e
// só o que conta (estrelas, dias, selo) cresce. O tier mais alto ganha um
// brilho a mais para parecer o mais raro.

/** Peça que "carimba" no meio do loop: some por escala e volta na batida. Quadro 0 é a peça inteira, então o loop fecha. */
function carimbo(
  parent: string,
  a: Vec,
  shapes: ReadonlyArray<Shape>,
  fora: number,
  volta: number
): Layer[] {
  return [
    { parent, a, p: a, m: twinkle(fora, true), op: fora + 30, shapes },
    { parent, a, p: a, m: twinkle(volta), ip: volta, shapes },
  ];
}

// Avaliações: placa com três vãos de estrela; o tier acende 1, 2 ou 3.
const ACENTO_AV: Record<number, Swatch> = { 1: "hot", 2: "ok", 3: "deep" };

function avaliacoes(tier: 1 | 2 | 3): Icon {
  const nome = `fam-avaliacoes-${tier}`;
  const xs = [-82, 0, 82];
  const yE = 6;
  const raiz: Layer = { id: "raiz", p: [252, 282], s: [106, 106], m: hop, shapes: [] };
  const face: Layer = {
    id: "face",
    parent: "raiz",
    tilt: FACE,
    shapes: [
      { d: rect(-136, -84, 272, 178, 22), fill: "main", depth: 1 },
      { d: rect(-114, -34, 228, 104, 12), fill: "white", depth: 0.25 },
      { d: pill(-46, -112, 92, 36), fill: ACENTO_AV[tier], depth: 0.6 },
      { d: pill(-20, -100, 40, 11), fill: "white", line: false },
      // vãos das estrelas apagadas
      ...xs.map((x, i): Shape => ({ d: star(x, yE, 34, 0.48, 5, 4), fill: "grey", ...(i < tier ? { line: false } : {}) })),
    ],
  };
  const acesas = xs.slice(0, tier);
  const estrelas = (x: number): Shape[] => [
    { d: star(x, yE, 36, 0.48, 5, 4), fill: "gold", depth: 0.7 },
    { d: star(x, yE, 14, 0.5, 5, 2), fill: "white", line: false },
  ];
  const fixas: Layer[] = acesas.slice(0, -1).map((x, i) => ({
    parent: "face",
    a: [x, yE] as Vec,
    p: [x, yE] as Vec,
    m: { ...tossLag, at: 4 + i * 5, k: 0.8 },
    shapes: estrelas(x),
  }));
  const ultima = acesas[acesas.length - 1];
  const nova = carimbo("face", [ultima, yE], estrelas(ultima), 6, 54);
  const luz: Layer[] = [
    brilho("raiz", [-176, -106], 22, twinkle(0, true), { op: 30 }),
    brilho("raiz", [-176, -106], 22, twinkle(54), { ip: 54 }),
    ...(tier === 3
      ? [
          brilho("raiz", [154, -132], 18, twinkle(6, true), { op: 36 }),
          brilho("raiz", [154, -132], 18, twinkle(62), { ip: 62 }),
        ]
      : []),
  ];
  return { name: nome, frames: 180, line: LINHA, extrude: EXT, layers: [raiz, face, ...fixas, ...nova, ...luz] };
}

// Presença: calendário com 8 dias, o tier marca 3, 5 ou 7; o último check é o
// que acabou de entrar. No 3 uma chama (sequência pegando fogo).
const DIAS: Record<number, number> = { 1: 3, 2: 5, 3: 7 };
const CX = [-100, -48, 4, 56];
const CY = [-20, 38];

const chama = (lean: number, tip: number, k = 1, dy = 0) => {
  const y = (v: number) => +(v * k + dy).toFixed(2);
  const x = (v: number) => +(v * k).toFixed(2);
  return (
    `M0 ${y(110)}C${x(-70)} ${y(110)} ${x(-104)} ${y(60)} ${x(-100)} ${y(6)}C${x(-96)} ${y(-38)} ${x(-62 + lean * 0.4)} ${y(-62)} ${x(-56 + lean)} ${y(-108)}` +
    `C${x(-22 + lean * 0.6)} ${y(-86)} ${x(-6)} ${y(-62)} 0 ${y(-30)}C${x(16)} ${y(-62)} ${x(34 + lean)} ${y(-94 - tip * 0.3)} ${x(26 + lean * 1.4)} ${y(-140 - tip)}` +
    `C${x(86 + lean)} ${y(-100)} ${x(106)} ${y(-40)} ${x(100)} ${y(10)}C${x(98)} ${y(64)} ${x(66)} ${y(110)} 0 ${y(110)}Z`
  );
};

function presenca(tier: 1 | 2 | 3): Icon {
  const nome = `fam-presenca-${tier}`;
  const n = DIAS[tier];
  const celulas = CY.flatMap((y) => CX.map((x): Vec => [x, y]));
  const centro = ([x, y]: Vec): Vec => [x + 22, y + 22];
  const marcados = celulas.slice(0, n);
  const marca = ([cx, cy]: Vec): Shape[] => [
    { d: rect(cx - 22, cy - 22, 44, 44, 9), fill: "ok", depth: 0.4 },
    { d: line([cx - 11, cy], [cx - 3, cy + 9], [cx + 12, cy - 8]), line: 7 },
  ];
  const raiz: Layer = { id: "raiz", p: [250, 280], s: [112, 112], m: jolt(), shapes: [] };
  const face: Layer = {
    id: "face",
    parent: "raiz",
    tilt: FACE,
    shapes: [
      { d: rect(-122, -96, 244, 200, 24), fill: "white", depth: 1 },
      { d: poly([[-122, -96], [122, -96], [122, -44], [-122, -44]], [24, 24, 0, 0]), fill: "main" },
      ...[-1, 1].map((s): Shape => ({ d: pill(s * 62 - 12, -120, 24, 46), fill: "grey", depth: 0.5 })),
      ...celulas.slice(n).map(([x, y]): Shape => ({ d: rect(x, y, 44, 44, 9) })),
    ],
  };
  const fixos: Layer[] = marcados.slice(0, -1).map((c, i) => {
    const m = centro(c);
    return {
      parent: "face",
      a: m,
      p: m,
      m: { ...jolt(), at: 5 + (i % 4) * 2, k: 0.7 },
      shapes: marca(m),
    };
  });
  const ult = centro(marcados[n - 1]);
  const nova = carimbo("face", ult, marca(ult), 10, 46);
  const fogo: Layer[] =
    tier === 3
      ? [
          {
            parent: "face",
            a: [124, -78],
            p: [124, -78],
            m: { ...jolt(), at: 6, k: 0.8 },
            shapes: [
              { d: flicker([chama(0, 0, 0.4, -86), chama(-14, 10, 0.4, -86), chama(10, -6, 0.4, -86), chama(-14, 10, 0.4, -86)], 45), fill: "gold", depth: 0.8 },
              { d: flicker([chama(0, 0, 0.18, -62), chama(-8, 8, 0.18, -62), chama(8, -2, 0.18, -62), chama(-8, 8, 0.18, -62)], 45), fill: "white", line: false },
            ],
          },
        ]
      : [];
  const luz: Layer[] = [
    brilho("raiz", [-170, -110], 22, twinkle(2, true), { op: 32 }),
    brilho("raiz", [-170, -110], 22, twinkle(46), { ip: 46 }),
    ...(tier >= 2
      ? [
          brilho("raiz", [176, 96], 16, twinkle(8, true), { op: 38 }),
          brilho("raiz", [176, 96], 16, twinkle(52), { ip: 52 }),
        ]
      : []),
  ];
  return { name: nome, frames: 180, line: LINHA, extrude: EXT, layers: [raiz, face, ...fixos, ...nova, ...fogo, ...luz] };
}

// Perfil: cartão de identificação, avatar e linhas; o check cai na batida.
function perfil(): Icon {
  const nome = "fam-perfil-1";
  const raiz: Layer = { id: "raiz", p: [250, 284], s: [104, 104], m: jolt([-7.86, 13.25]), shapes: [] };
  const face: Layer = {
    id: "face",
    parent: "raiz",
    tilt: FACE,
    shapes: [
      { d: rect(-140, -90, 280, 190, 24), fill: "main", depth: 1 },
      { d: pill(-34, -112, 68, 34), fill: "deep", depth: 0.6 },
      { d: pill(-14, -101, 28, 11), fill: "white", line: false },
      { d: ellipse(-70, 6, 54), fill: "white", depth: 0.35 },
      { d: ellipse(-70, -8, 17), fill: "ok", depth: 0.2 },
      { d: poly([[-106, 44], [-34, 44], [-40, 26], [-70, 18], [-100, 26]], [6, 6, 12, 12, 12]), fill: "ok", depth: 0.2 },
      { d: pill(4, -44, 110, 18), fill: "white", depth: 0.25 },
      { d: pill(4, -10, 86, 14), fill: "white", depth: 0.25 },
      { d: pill(4, 20, 98, 14), fill: "white", depth: 0.25 },
    ],
  };
  const sel: Vec = [112, 76];
  const check = carimbo(
    "face",
    sel,
    [
      { d: ellipse(sel[0], sel[1], 40), fill: "ok", depth: 0.7 },
      { d: line([sel[0] - 17, sel[1]], [sel[0] - 5, sel[1] + 13], [sel[0] + 19, sel[1] - 14]), line: 8 },
    ],
    14,
    58
  );
  const luz: Layer[] = [
    brilho("raiz", [-176, -100], 20, twinkle(2, true), { op: 32 }),
    brilho("raiz", [-176, -100], 20, twinkle(46), { ip: 46 }),
  ];
  return { name: nome, frames: 180, line: LINHA, extrude: EXT, layers: [raiz, face, ...check, ...luz] };
}

// Termo: folha com linhas que se apagam e voltam, assinatura que se
// desenha de novo e o selo "ok" que carimba no fim.
const ASSINATURA = "M-84 80C-70 40 -56 40 -60 66C-64 92 -44 52 -34 56C-26 60 -40 84 -22 70C-8 60 4 60 14 66";

function termo(): Icon {
  const nome = "fam-termo-1";
  const raiz: Layer = { id: "raiz", p: [244, 282], s: [100, 100], m: jolt([-6, 11]), shapes: [] };
  const face: Layer = {
    id: "face",
    parent: "raiz",
    tilt: FACE,
    shapes: [
      { d: rect(-108, -132, 216, 264, 14), fill: "white", depth: 1 },
      { d: poly([[-108, -132], [108, -132], [108, -80], [-108, -80]], [14, 14, 0, 0]), fill: "main" },
      ...[0, 1, 2].map((i): Shape => ({ d: line([-70, -52 + i * 34], [i === 2 ? 0 : 70, -52 + i * 34]), trim: erase(18 - i * 5, 74 + i * 5) })),
      { d: line([-84, 100], [20, 100]), line: 4 },
      { d: ASSINATURA, fill: undefined, line: 7, trim: erase(26, 96) },
    ],
  };
  const sc: Vec = [78, 82];
  const selo = carimbo(
    "face",
    sc,
    [
      { d: rosette(sc[0], sc[1], 46, 10, 0.78), fill: "ok", depth: 0.6 },
      { d: line([sc[0] - 18, sc[1]], [sc[0] - 5, sc[1] + 13], [sc[0] + 19, sc[1] - 14]), line: 8 },
    ],
    30,
    118
  );
  const luz: Layer[] = [
    brilho("raiz", [-160, -120], 20, twinkle(2, true), { op: 32 }),
    brilho("raiz", [-160, -120], 20, twinkle(118), { ip: 118 }),
  ];
  return { name: nome, frames: 180, line: LINHA, extrude: EXT, layers: [raiz, face, ...selo, ...luz] };
}

export const FAMILIAS_B: Record<string, Icon> = {
  "fam-avaliacoes-1": avaliacoes(1),
  "fam-avaliacoes-2": avaliacoes(2),
  "fam-avaliacoes-3": avaliacoes(3),
  "fam-presenca-1": presenca(1),
  "fam-presenca-2": presenca(2),
  "fam-presenca-3": presenca(3),
  "fam-perfil-1": perfil(),
  "fam-termo-1": termo(),
};
