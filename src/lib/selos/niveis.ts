import { pill, poly, rect, star } from "./fun";
import type { Icon, Layer, Shape, Vec } from "./fun";
import { hop, tossLag, tossLag2, twinkle, wiggle, flick } from "./motions";
import { EXT, FACE, LINHA, brilho } from "./base";

// Os quatro níveis são a mesma escada vista de lado: o degrau mais alto é
// o seu, e o marcador em cima diz em que faixa você está (broto, bandeira,
// estrela, troféu). A escada cresce com o nível, então a altura da peça já
// conta a história mesmo a 36px.

const BASE_Y = 96; // chão da escada, no plano da face
const PASSO = 36; // quanto cada degrau sobe sobre o anterior

function escada(n: number): Shape[] {
  const largura = 140 + 40 * n; // peça total: 180, 220, 260, 300
  const w = largura / n;
  const topo = 110 + 22 * n;
  const x0 = -largura / 2;
  return Array.from({ length: n }, (_, i): Shape[] => {
    const h = topo - (n - 1 - i) * PASSO;
    const x = x0 + i * w;
    const eTopo = i === n - 1;
    return [
      {
        d: rect(x, BASE_Y - h, w, h, 8),
        fill: eTopo ? "ok" : "main",
        depth: 1,
      },
      // risco de luz no degrau: detalhe mínimo, só tinta
      { d: pill(x + 12, BASE_Y - h + 14, Math.min(34, w - 24), 9), fill: "white" },
    ];
  }).flat();
}

/** O centro do degrau mais alto e a altura dele — onde o marcador pousa. */
function topoDaEscada(n: number): Vec {
  const largura = 140 + 40 * n;
  const w = largura / n;
  const topo = 110 + 22 * n;
  return [-largura / 2 + (n - 1) * w + w / 2, BASE_Y - topo];
}

function marcador(n: number, [cx, cy]: Vec): Layer[] {
  if (n === 1) {
    // broto: duas folhas que abrem com o `flick` do kit
    return [
      {
        parent: "face",
        a: [cx, cy],
        p: [cx, cy],
        m: { ...flick, at: 8 },
        shapes: [
          { d: poly([[cx - 6, cy], [cx + 6, cy], [cx + 4, cy - 40], [cx - 4, cy - 40]]), fill: "deep", depth: 0.4 },
          { d: poly([[cx, cy - 34], [cx - 46, cy - 40], [cx - 34, cy - 74], [cx - 4, cy - 66]], 6), fill: "ok", depth: 0.5 },
          { d: poly([[cx, cy - 48], [cx + 46, cy - 56], [cx + 36, cy - 92], [cx + 2, cy - 78]], 6), fill: "ok", depth: 0.5 },
        ],
      },
    ];
  }
  if (n === 2) {
    // bandeira: o mastro fica e o pano balança no `wiggle`
    return [
      {
        parent: "face",
        a: [cx - 8, cy - 60],
        p: [cx - 8, cy - 60],
        m: { ...wiggle, at: 10, k: 0.35 },
        shapes: [
          { d: poly([[cx - 8, cy - 112], [cx + 44, cy - 96], [cx - 8, cy - 78]]), fill: "hot", depth: 0.5 },
        ],
      },
      {
        parent: "face",
        shapes: [{ d: rect(cx - 14, cy - 118, 12, 118, 3), fill: "deep", depth: 0.6 }],
      },
    ];
  }
  if (n === 3) {
    // estrela de ouro: pousa com atraso sobre o degrau
    return [
      {
        parent: "face",
        a: [cx, cy - 46],
        p: [cx, cy - 46],
        m: { ...tossLag, at: 6 },
        shapes: [{ d: star(cx, cy - 46, 52, 0.48, 5, 5), fill: "gold", depth: 0.8 }, { d: star(cx, cy - 46, 22, 0.5, 5, 3), fill: "white" }],
      },
    ];
  }
  // troféu da jornada completa
  return [
    {
      parent: "face",
      a: [cx, cy - 30],
      p: [cx, cy - 30],
      m: { ...tossLag2, at: 6 },
      shapes: [
        { d: poly([[cx - 54, cy - 124], [cx + 54, cy - 124], [cx + 42, cy - 52], [cx + 14, cy - 30], [cx - 14, cy - 30], [cx - 42, cy - 52]], [4, 4, 14, 8, 8, 14]), fill: "gold", depth: 0.9 },
        { d: rect(cx - 18, cy - 32, 36, 30, 4), fill: "gold", depth: 0.7 },
        { d: star(cx, cy - 88, 24, 0.5, 5, 3), fill: "white" },
      ],
    },
  ];
}

function nivel(n: 1 | 2 | 3 | 4, nome: string): Icon {
  const topo = topoDaEscada(n);
  const k = [0, 132, 130, 124, 112][n];
  const raiz: Layer = { id: "raiz", p: [252, 304], s: [k, k], m: hop, shapes: [] };
  const face: Layer = {
    id: "face",
    parent: "raiz",
    tilt: FACE,
    shapes: escada(n),
  };
  // brilhos na batida do salto (quadro 54), um dentro e um fora do desenho
  const luz: Layer[] = [
    brilho("raiz", [-(60 + 14 * n), -110 - 10 * n], 22, twinkle(0, true), { op: 30 }),
    brilho("raiz", [-(60 + 14 * n), -110 - 10 * n], 22, twinkle(54), { ip: 54 }),
    ...(n >= 3
      ? [
          brilho("raiz", [128, -176], 16, twinkle(6, true), { op: 36 }),
          brilho("raiz", [128, -176], 16, twinkle(62), { ip: 62 }),
        ]
      : []),
  ];
  return {
    name: nome,
    frames: 180,
    line: LINHA,
    extrude: EXT,
    layers: [raiz, face, ...marcador(n, topo), ...luz],
  };
}

export const NIVEIS: Record<string, Icon> = {
  "nivel-inicio": nivel(1, "nivel-inicio"),
  "nivel-constancia": nivel(2, "nivel-constancia"),
  "nivel-veterania": nivel(3, "nivel-veterania"),
  "nivel-completa": nivel(4, "nivel-completa"),
};
