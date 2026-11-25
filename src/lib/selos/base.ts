import { VIEWS } from "./fun";
import type { Layer, Motion, Palette, Vec } from "./fun";
import { RISO, spark } from "./fun";

// Base comum da arte dos selos (REALIZA-529). Todo módulo de arte importa
// daqui: a paleta da casa, a vista isométrica e o brilho que pousa na batida.

/** A paleta do Instituto. Os slots são papéis, não nomes de cor:
 *  main = corpo amarelo, ok = verde, gold = âmbar (moeda, estrela, metal),
 *  hot = o acento azul-turquesa (aqui "hot" NÃO é vermelho), deep = azul
 *  petróleo escuro, tint = o amarelo pálido, ink = o grafite do contorno. */
export const PALETA_REALIZA: Palette = {
  ...RISO,
  main: "#FFD531",
  gold: "#F3AD42",
  tint: "#FFF1B8",
  ok: "#A0C644",
  hot: "#4CA9C2",
  deep: "#1A4766",
  white: "#FFFFFF",
  grey: "#D9D9D9",
  paper: "#F7F5EE",
  ink: "#323232",
};

/** Largura do contorno — 5 no canvas de 500, a régua do kit. */
export const LINHA = 5;

/** A vista da casa: faces viradas 18° no plano e inclinadas 36°, laterais
 *  caindo para a esquerda. Todo selo olha pro mesmo lado. */
export const { tilt: FACE, extrude: EXT } = VIEWS.right;

/** Brilho branco que pousa em `parent`, estourado por `m` (twinkle/glint). */
export const brilho = (
  parent: string,
  p: Vec,
  r: number,
  m: Motion | ReadonlyArray<Motion>,
  extra: { ip?: number; op?: number } = {}
): Layer => ({
  parent,
  a: p,
  p,
  m,
  ...extra,
  shapes: [{ d: spark(p[0], p[1], r), fill: "white" }],
});

/** Encolhe/cresce um caminho de pares x y em torno de um ponto (aros). */
export const miolo = (d: string, k: number, [cx, cy]: Vec) =>
  d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x: string, y: string) =>
    `${+(cx + (+x - cx) * k).toFixed(2)} ${+(cy + (+y - cy) * k).toFixed(2)}`
  );
