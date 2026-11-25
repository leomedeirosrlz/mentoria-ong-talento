import { ellipse, line, poly, rect, star } from "./fun";
import type { Icon, Layer, Shape, Vec } from "./fun";
import { hop, jolt, tossLag, tossLag2, twinkle } from "./motions";
import { EXT, FACE, LINHA, brilho } from "./base";

// Quatro famílias de conquista com degraus por contagem. O objeto é sempre o
// mesmo; o degrau sobe com mais itens acesos (checks, areia, anéis, blocos) e
// o último ganha o brilho extra. Todo quadro 0 já é a peça completa em
// repouso, então nenhum ícone precisa de `still`.

type Tier = 1 | 2 | 3 | 4;

function raiz(k: number, y = 262): Layer {
  return { id: "raiz", p: [250, y], s: [k, k], m: hop, shapes: [] };
}

function face(shapes: ReadonlyArray<Shape>): Layer {
  return { id: "face", parent: "raiz", tilt: FACE, shapes };
}

/** Brilhos na batida do salto: cada um sai do repouso e volta já em outro tempo. */
function luz(k: number, pos: ReadonlyArray<Vec>): Layer[] {
  // a raiz carrega a escala do desenho: posições chegam em px de canvas e voltam aqui
  const e = 100 / k;
  return pos.flatMap(([cx, cy], i): Layer[] => {
    const p: Vec = [cx * e, cy * e];
    const r = (24 - i * 2) * e;
    return [
      brilho("raiz", p, r, twinkle(i * 6, true), { op: 30 + i * 6 }),
      brilho("raiz", p, r, twinkle(54 + i * 6), { ip: 54 + i * 6 }),
    ];
  });
}

/** Pino que estoura por escala no quadro `a` e volta: o novo degrau chegando. */
function estoura(parent: string, shapes: ReadonlyArray<Shape>, a: number): Layer[] {
  return [
    { parent, op: a + 30, m: twinkle(a, true), shapes },
    { parent, ip: a + 36, m: twinkle(a + 36), shapes },
  ];
}

// ---------------------------------------------------------------- combinados
// Cartão de acordo com quatro linhas; cada combinado cumprido vira um check.

const LINHA_Y = (i: number) => -72 + i * 46;
const checkDe = (cx: number, cy: number) => line([cx - 11, cy], [cx - 3, cy + 9], [cx + 12, cy - 9]);

function combinados(t: Tier): Icon {
  const casas: Shape[] = [];
  const checks: Shape[] = [];
  for (let i = 0; i < 4; i++) {
    const y = LINHA_Y(i);
    const feito = i < t;
    casas.push(
      { d: rect(-58, y - 17, 34, 34, 7), fill: feito ? "ok" : "white", depth: 0.2 },
      { d: rect(-6, y - 6, 62, 12, 6), fill: "tint" },
    );
    if (feito && i < t - 1) checks.push({ d: checkDe(-41, y), line: 7 });
  }
  const novo: Shape[] = [{ d: checkDe(-41, LINHA_Y(t - 1)), line: 7 }];

  const camadas: Layer[] = [
    raiz(158),
    face([
      { d: rect(-92, -122, 184, 236, 14), fill: "main", depth: 1 },
      { d: rect(-72, -102, 144, 196, 8), fill: "white", depth: 0.3 },
      ...casas,
      ...checks,
    ]),
    ...estoura("face", novo, 54),
  ];
  const estrelas: Vec[] = [];
  if (t === 4) {
    // estrela de ouro presa no canto, a que "chega por último" no balanço
    camadas.push({
      parent: "face",
      a: [88, -118],
      p: [88, -118],
      m: { ...tossLag2, at: 6 },
      shapes: [
        { d: star(88, -118, 50, 0.48, 5, 5), fill: "gold", depth: 0.8 },
        { d: star(88, -118, 19, 0.5, 5, 3), fill: "white" },
      ],
    });
    estrelas.push([-150, 120]);
  }
  return {
    name: `fam-combinados-${t}`,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    layers: [...camadas, ...luz(158, [[-150, -176], ...estrelas, ...(t >= 3 ? ([[150, 150]] as Vec[]) : [])])],
  };
}

// -------------------------------------------------------------------- horas
// Ampulheta: a areia desce com o tier (1 quase toda em cima, 4 toda embaixo).

const larguraEm = (y: number) => 8 + (Math.abs(y) - 6) * 0.53 - 7; // meia largura útil do bulbo

function horas(t: Tier): Icon {
  const gasto = [0.22, 0.5, 0.78, 1][t - 1];
  const cima = 1 - gasto;
  const yCima = -100 + (1 - cima) * 86; // superfície da areia de cima
  const pilha = 6 + gasto * 74; // altura da areia de baixo
  const yPilha = 100 - pilha;
  const ouro = t === 4;
  const corpo: Shape[] = [
    { d: rect(-84, -134, 168, 24, 8), fill: ouro ? "gold" : "ok", depth: 1 },
    { d: poly([[-62, -108], [62, -108], [8, -6], [8, 6], [62, 108], [-62, 108], [-8, 6], [-8, -6]], 4), fill: "tint", depth: 0.6 },
  ];
  const areia: Shape[] = [];
  if (cima > 0.01) {
    const w = larguraEm(yCima);
    areia.push({ d: poly([[-w, yCima], [w, yCima], [4, -8], [-4, -8]]), fill: "main", depth: 0.2 });
  }
  const wp = larguraEm(yPilha + 12);
  areia.push({ d: poly([[-52, 100], [52, 100], [wp, yPilha + 14], [0, yPilha], [-wp, yPilha + 14]], 3), fill: "main", depth: 0.2 });
  if (!ouro) areia.push({ d: rect(-3, -6, 6, yPilha + 4, 3), fill: "main" });
  const baseInf: Shape[] = [
    { d: rect(-84, 110, 168, 24, 8), fill: ouro ? "gold" : "ok", depth: 1 },
    // um pino branco por tier no pé da ampulheta
    ...Array.from({ length: t }, (_, i): Shape => ({ d: ellipse(-33 + i * 22 + (4 - t) * 11, 122, 6), fill: "white" })),
  ];
  const vidro: Layer = {
    parent: "face",
    a: [0, 0],
    p: [0, 0],
    m: { ...tossLag, at: 8, k: 0.5 },
    shapes: [...corpo.slice(1), ...areia],
  };
  return {
    name: `fam-horas-${t}`,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    layers: [
      raiz(150, 262),
      face([corpo[0], ...baseInf]),
      vidro,
      ...luz(150, [[-160, -150], ...(t >= 3 ? ([[160, -100]] as Vec[]) : []), ...(t === 4 ? ([[150, 160]] as Vec[]) : [])]),
    ],
  };
}

// -------------------------------------------------------------------- metas
// Alvo com três anéis: o tier acende de dentro pra fora e crava uma flecha a mais.

const ACERTOS: ReadonlyArray<Vec> = [[4, 0], [-54, -20], [62, 62]];
const U: Vec = [0.7, -0.7]; // direção da haste, saindo do alvo
const N: Vec = [0.7, 0.7];

function flecha([hx, hy]: Vec): Shape[] {
  const at = (a: number, b = 0): Vec => [hx + U[0] * a + N[0] * b, hy + U[1] * a + N[1] * b];
  return [
    { d: poly([at(0, -5), at(104, -5), at(104, 5), at(0, 5)]), fill: "deep", depth: 0.4 },
    { d: poly([at(80), at(108), at(122, 26), at(94, 26)]), fill: "hot", depth: 0.3 },
    { d: poly([at(80), at(108), at(122, -26), at(94, -26)]), fill: "hot", depth: 0.3 },
  ];
}

function metas(t: 1 | 2 | 3): Icon {
  const aneis: Shape[] = [
    { d: ellipse(0, 0, 112), fill: t >= 3 ? "ok" : "tint", depth: 1 },
    { d: ellipse(0, 0, 76), fill: t >= 2 ? "main" : "tint", depth: 0.2 },
    { d: ellipse(0, 0, 38), fill: "ok", depth: 0.2 },
  ];
  const ordem = [1, 0, 2].slice(0, t); // a mais nova é a última da lista
  const flechas: Layer[] = ordem.map((idx, j): Layer => ({
    parent: "face",
    m: [{ ...jolt([-9, 9]), at: 4 + j * 6, k: 1.1 - j * 0.15 }],
    shapes: flecha(ACERTOS[idx]),
  }));
  return {
    name: `fam-metas-${t}`,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    layers: [
      raiz(136, 272),
      face(aneis),
      ...flechas,
      ...luz(136, [[-160, -150], ...(t === 3 ? ([[-158, 140], [150, 160]] as Vec[]) : [])]),
    ],
  };
}

// ----------------------------------------------------------------- submetas
// Torre de blocos com check: o tier é a altura. Cada bloco se apoia no de baixo,
// então o balanço sobe pela pilha e o de cima chega por último.

const BH = 84;

function submetas(t: 1 | 2 | 3): Icon {
  const base = (t * BH) / 2; // centra a torre no plano
  const blocos: Layer[] = Array.from({ length: t }, (_, i): Layer => {
    const y = base - (i + 1) * BH;
    const dx = [0, 9, -7][i];
    const cy = y + BH / 2;
    return {
      id: `b${i}`,
      parent: i === 0 ? "face" : `b${i - 1}`,
      a: [0, y + BH],
      p: [0, y + BH],
      m: i === 0 ? undefined : { ...tossLag, at: 2 + i * 4, k: 0.55 },
      shapes: [
        { d: rect(-80 + dx, y, 160, BH, 10), fill: i % 2 === 0 ? "ok" : "main", depth: 1 },
        { d: ellipse(-42 + dx, cy, 22), fill: "white", depth: 0.2 },
        { d: line([-53 + dx, cy], [-45 + dx, cy + 9], [-31 + dx, cy - 10]), line: 7 },
        { d: rect(-4 + dx, cy - 7, 66, 14, 7), fill: "white" },
      ],
    };
  });
  const topo = base - t * BH;
  const k = [0, 200, 160, 134][t];
  return {
    name: `fam-submetas-${t}`,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    layers: [
      raiz(k, 266),
      face([]),
      ...blocos,
      ...(t === 3
        ? [{
            parent: "b2",
            a: [0, topo],
            p: [0, topo],
            m: { ...tossLag2, at: 10, k: 0.6 },
            shapes: [{ d: star(0, topo - 44, 40, 0.48, 5, 4), fill: "gold", depth: 0.8 } as Shape],
          } satisfies Layer]
        : []),
      ...luz(k, [[-160, -160 + (3 - t) * 25], ...(t >= 2 ? ([[165, -60]] as Vec[]) : [])]),
    ],
  };
}

const lista = (n: number) => Array.from({ length: n }, (_, i) => (i + 1) as Tier);

export const FAMILIAS_A: Record<string, Icon> = Object.fromEntries([
  ...lista(4).map((t) => [`fam-combinados-${t}`, combinados(t)]),
  ...lista(4).map((t) => [`fam-horas-${t}`, horas(t)]),
  ...lista(3).map((t) => [`fam-metas-${t}`, metas(t as 1 | 2 | 3)]),
  ...lista(3).map((t) => [`fam-submetas-${t}`, submetas(t as 1 | 2 | 3)]),
]);
