import { ellipse, line, pill, poly, rect, star } from "./fun";
import type { Icon, Layer, Shape } from "./fun";
import { POP, flick, hop, impact, spring, springTurn, tossLag, tossLag2, twinkle, wiggle, wobble, sparkle } from "./motions";
import { EXT, FACE, LINHA, brilho } from "./base";

// Seis selos de marco da jornada (primeiro encontro, metade, reta final) e de
// contagem (combinados, especialista, avaliações). Todos seguem a casa de
// niveis.ts: raiz que carrega o movimento, camada `face` inclinada com as
// peças, marcadores que seguem com atraso e brilho na batida.

type Raiz = { p: [number, number]; k: number };

function icone(nome: string, { p, k }: Raiz, m: Layer["m"], camadas: Layer[], still?: number): Icon {
  return {
    name: nome,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    ...(still === undefined ? {} : { still }),
    layers: [{ id: "raiz", p, s: [k, k], m, shapes: [] }, ...camadas],
  };
}

/** Brilho que sai no começo do laço e volta na batida, sem sumir no emendo. */
const luz = (p: [number, number], r: number, batida: number): Layer[] => [
  brilho("raiz", p, r, twinkle(0, true), { op: 30 }),
  brilho("raiz", p, r, twinkle(batida), { ip: batida }),
];

const face = (shapes: Shape[], m?: Layer["m"]): Layer => ({ id: "face", parent: "raiz", tilt: FACE, m, shapes });

// 1. Primeiro encontro: a bandeira é fincada no pedestal e abre o pano.
const MASTRO_RENTE: [number, number] = [0, 34];
const PLANTA = [
  ...spring([0, 0], 6, 1, MASTRO_RENTE),
  [120, [0, 0], POP],
  [160, MASTRO_RENTE],
] as const;

const primeiro: Icon = icone(
  "marco-primeiro",
  { p: [240, 252], k: 108 },
  // o pedestal toma o golpe quando o mastro assenta (quadro ~19)
  impact([2, 8]),
  [
    // mastro e pano ficam atrás do pedestal, assim ele "sai" do bloco
    {
      id: "mastro",
      parent: "raiz",
      tilt: FACE,
      m: { p: PLANTA },
      shapes: [
        { d: rect(-7, -196, 14, 226, 3), fill: "deep", depth: 0.6 },
        { d: ellipse(0, -202, 15), fill: "gold", depth: 0.6 },
      ],
    },
    {
      parent: "mastro",
      a: [7, -184],
      p: [7, -184],
      m: { r: [...springTurn(0, 14, 1, -35), [120, 0, POP], [150, -35]] },
      shapes: [
        { d: poly([[7, -190], [128, -172], [100, -144], [128, -114], [7, -98]], 4), fill: "hot", depth: 0.5 },
      ],
    },
    face([
      { d: rect(-132, 28, 264, 68, 8), fill: "main", depth: 1 },
      { d: pill(-108, 44, 48, 9), fill: "white" },
      { d: rect(-92, -34, 184, 62, 8), fill: "ok", depth: 1 },
      { d: pill(-68, -18, 42, 9), fill: "white" },
    ]),
    ...luz([150, -170], 22, 36),
  ],
  110,
);

// 2. Metade do caminho: a medalha balança na fita; o meio-círculo verde é a metade feita.
const MEDALHA: [number, number] = [0, 30];
const metade: Icon = icone(
  "marco-metade",
  { p: [250, 262], k: 100 },
  undefined,
  [
    face([
      { d: poly([[-72, -176], [-34, -176], [38, -30], [0, -30]]), fill: "ok", depth: 0.5 },
      { d: poly([[72, -176], [34, -176], [-38, -30], [0, -30]]), fill: "ok", depth: 0.5 },
    ]),
    {
      id: "medalha",
      parent: "face",
      a: [0, -40],
      p: [0, -40],
      m: { ...wiggle, k: 0.5 },
      shapes: [
        { d: ellipse(...MEDALHA, 84), fill: "gold", depth: 1 },
        { d: ellipse(...MEDALHA, 60), fill: "main", depth: 0.3 },
        { d: ellipse(...MEDALHA, 34), fill: "tint" },
      ],
    },
    {
      parent: "medalha",
      a: MEDALHA,
      p: MEDALHA,
      m: { ...wiggle, at: 5, k: 0.2 },
      shapes: [{ d: "M0 -4A34 34 0 0 0 0 64Z", fill: "ok" }],
    },
    ...luz([-130, -120], 22, 56),
    ...luz([128, 120], 16, 62),
  ],
);

// 3. Reta final: bandeira quadriculada, o pano balança e a ponta atrasa.
const X0 = -52;
const Y0 = -168;
const W = 37.5;
const H = 33.4;
const casas = (de: number, ate: number): Shape[] =>
  Array.from({ length: (ate - de) * 3 }, (_, n): Shape[] => {
    const i = de + (n % (ate - de));
    const j = Math.floor(n / (ate - de));
    return (i + j) % 2 === 0
      ? [{ d: rect(X0 + i * W, Y0 + j * H, W, H), fill: "ink", depth: 0.5, line: false }]
      : [];
  }).flat();

const retaFinal: Icon = icone(
  "marco-reta-final",
  { p: [250, 262], k: 100 },
  undefined,
  [
    face([
      { d: rect(-66, -170, 14, 230, 3), fill: "deep", depth: 0.7 },
      { d: ellipse(-59, -176, 15), fill: "ok", depth: 0.6 },
      { d: rect(-120, 22, 176, 74, 8), fill: "main", depth: 1 },
      { d: pill(-98, 38, 42, 9), fill: "white" },
    ]),
    {
      id: "pano",
      parent: "face",
      a: [X0, -124],
      p: [X0, -124],
      m: { ...wiggle, k: 0.4 },
      shapes: [{ d: rect(X0, Y0, 2 * W, 3 * H), fill: "white", depth: 0.5 }, ...casas(0, 2)],
    },
    {
      parent: "pano",
      a: [X0 + 2 * W, -124],
      p: [X0 + 2 * W, -124],
      m: { ...wiggle, at: 5, k: 0.3 },
      shapes: [{ d: rect(X0 + 2 * W, Y0, 2 * W, 3 * H), fill: "white", depth: 0.5 }, ...casas(2, 4)],
    },
    ...luz([128, -190], 22, 54),
    ...luz([-150, -20], 16, 60),
  ],
);

// 4. Combinados: o terceiro check é carimbado e a prancheta toma o golpe.
const LINHAS = [-44, 6, 56];
const caixa = (y: number): Shape[] => [
  { d: rect(-62, y - 18, 36, 36, 8), fill: "ok" },
  { d: pill(-8, y - 7, 72, 14), fill: "grey" },
];
const marca = (y: number): Shape => ({ d: line([-54, y + 1], [-46, y + 9], [-33, y - 8]) });

const combinados: Icon = icone(
  "conta-combinados",
  { p: [250, 262], k: 100 },
  undefined,
  [
    face(
      [
        { d: rect(-104, -118, 208, 232, 16), fill: "main", depth: 1 },
        { d: rect(-80, -86, 160, 176, 8), fill: "white", depth: 0.3 },
        ...caixa(LINHAS[0]),
        marca(LINHAS[0]),
        ...caixa(LINHAS[1]),
        marca(LINHAS[1]),
        ...caixa(LINHAS[2]),
      ],
      { ...impact([6, 10]), at: 30 },
    ),
    // a presilha chacoalha depois da batida
    {
      parent: "face",
      a: [0, -118],
      p: [0, -118],
      m: { ...flick, at: 50, k: 0.8 },
      shapes: [{ d: rect(-42, -142, 84, 40, 10), fill: "gold", depth: 0.7 }],
    },
    // check do carimbo: some no começo e entra com pop na batida (quadro 54)
    { parent: "face", a: [-46, LINHAS[2]], p: [-46, LINHAS[2]], m: twinkle(0, true), op: 30, shapes: [marca(LINHAS[2])] },
    { parent: "face", a: [-46, LINHAS[2]], p: [-46, LINHAS[2]], m: twinkle(54), ip: 54, shapes: [marca(LINHAS[2])] },
    ...luz([128, -120], 22, 60),
  ],
);

// 5. Especialista: balão de conversa com a estrela da boa ideia.
const BALAO = poly([[-124, -112], [124, -112], [124, 62], [-16, 62], [-72, 118], [-62, 62], [-124, 62]], [32, 32, 32, 4, 6, 4, 32]);
const RESPOSTA = poly([[50, -190], [152, -190], [152, -124], [138, -124], [148, -96], [112, -124], [50, -124]], [20, 20, 20, 3, 4, 3, 20]);
const especialista: Icon = icone(
  "conta-especialista",
  { p: [236, 262], k: 100 },
  { ...wobble, k: 0.8 },
  [
    {
      id: "face",
      parent: "raiz",
      tilt: FACE,
      shapes: [
        { d: RESPOSTA, fill: "ok", depth: 0.7 },
        { d: BALAO, fill: "main", depth: 1 },
        { d: rect(-96, -84, 192, 120, 24), fill: "tint" },
      ],
    },
    {
      parent: "face",
      a: [0, -24],
      p: [0, -24],
      m: { ...tossLag, at: 10 },
      shapes: [
        { d: star(0, -24, 66, 0.5, 5, 5), fill: "gold", depth: 0.5 },
        { d: star(0, -24, 24, 0.5, 5, 3), fill: "white" },
      ],
    },
    {
      parent: "face",
      a: [101, -157],
      p: [101, -157],
      m: { ...flick, at: 8, k: 1.2 },
      shapes: [-24, 0, 24].map((dx): Shape => ({ d: ellipse(101 + dx, -157, 8), fill: "white", line: false })),
    },
    brilho("raiz", [-170, -120], 22, sparkle(16)),
    brilho("raiz", [170, 40], 16, sparkle(92)),
  ],
);

// 6. Avaliações: a estrela grande e as duas menores sobem na placa.
const avaliacoes: Icon = icone(
  "conta-avaliacoes",
  { p: [250, 262], k: 100 },
  hop,
  [
    face([
      { d: rect(-126, -64, 252, 176, 22), fill: "ok", depth: 0.8 },
      { d: rect(-134, -116, 268, 190, 22), fill: "main", depth: 1 },
    ]),
    {
      parent: "face",
      a: [0, -30],
      p: [0, -30],
      m: { ...tossLag2, at: 6, k: 0.6 },
      shapes: [
        { d: star(0, -30, 88, 0.5, 5, 5), fill: "gold", depth: 0.8 },
        { d: star(0, -30, 32, 0.5, 5, 3), fill: "white" },
      ],
    },
    {
      parent: "face",
      a: [-86, 38],
      p: [-86, 38],
      m: { ...tossLag, at: 10 },
      shapes: [{ d: star(-86, 38, 36, 0.5, 5, 4), fill: "gold", depth: 0.6 }],
    },
    {
      parent: "face",
      a: [86, 38],
      p: [86, 38],
      m: { ...tossLag, at: 12, k: -1 },
      shapes: [{ d: star(86, 38, 36, 0.5, 5, 4), fill: "gold", depth: 0.6 }],
    },
    ...luz([-150, -150], 22, 54),
    ...luz([156, -100], 16, 62),
  ],
);

export const MARCOS: Record<string, Icon> = {
  "marco-primeiro": primeiro,
  "marco-metade": metade,
  "marco-reta-final": retaFinal,
  "conta-combinados": combinados,
  "conta-especialista": especialista,
  "conta-avaliacoes": avaliacoes,
};
