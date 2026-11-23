#!/usr/bin/env node
// Gera as ilustrações isométricas das conquistas (spec 016) como SVG
// estático em public/badges/<slug>.svg.
//
// A gramática é a do kit fun-isometric (Kelvin Adithya, skills.klvn.dev):
// cada peça é um recorte plano numa face inclinada, empurrado ao longo de
// UM vetor de extrusão em espaço de tela, contorno de tinta por fora e
// vinco onde duas faces laterais visíveis se encontram. O kit desenha em
// canvas a cada quadro; aqui o mesmo cálculo sai uma vez, em path pronto
// (geometria já transformada, então o traço fica uniforme na face que
// inclina), e a animação fica no CSS da página (o arquivo é estático: o
// guard global de reduced-motion cobre tudo).
//
// Uso: node scripts/gerar-badges.mjs [--png <dir>]  (o --png precisa do
// rsvg-convert e serve só pra revisar o desenho em tamanho real)

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "public/badges");

// ---------- régua do desenho (canvas 500, como o kit) ----------
// o traço é ~2,2% do lado: a estante mostra a peça a 56–64px e o kit (1%)
// some abaixo de 100px
const W = 11;
// borda de papel do adesivo, por fora da tinta — some no card claro e
// recorta a peça no tema escuro
const CORTE = 9;
// a extrusão da casa (VIEWS.right do kit), engrossada pro tamanho pequeno
const EXT = [-7, 30];

const lean = (spin, by) => {
  const a = (spin * Math.PI) / 180;
  const k = Math.cos((by * Math.PI) / 180);
  return [Math.cos(a), Math.sin(a) * k, -Math.sin(a), Math.cos(a) * k, 0, 0];
};
// faces em pé giram 18° no plano e deitam 36°; peças deitadas, 45° e 55°
const FACE = lean(-18, 36);
const CHAO = lean(-45, 55);

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const em = (x, y, m = [1, 0, 0, 1, 0, 0]) => mul([1, 0, 0, 1, x, y], m);
const gira = (graus) => {
  const a = (graus * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
};
const aplica = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// ---------- formas (espaço da face) ----------
// cada forma é uma lista de subcaminhos; cada subcaminho, segmentos
// cúbicos [p0, c1, c2, p3] — arco vira cúbica aqui, então a transformação
// afim é exata. `cantos` guarda os vincos possíveis (ponto + normais).

const K = 0.5523;

function poly(pts, r = 0) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++)
    area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  const segs = [];
  const cantos = [];
  let prev = null;
  let first = null;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const A = pts[(i + n - 1) % n];
    const B = pts[(i + 1) % n];
    const rad = typeof r === "number" ? r : (r[i] ?? 0);
    const ua = [A[0] - P[0], A[1] - P[1]];
    const ub = [B[0] - P[0], B[1] - P[1]];
    const la = Math.hypot(...ua);
    const lb = Math.hypot(...ub);
    const cos = (ua[0] * ub[0] + ua[1] * ub[1]) / (la * lb);
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    let t = rad && half > 1e-3 ? rad / Math.tan(half) : 0;
    t = Math.min(t, la / 2, lb / 2);
    const T1 = [P[0] + (ua[0] / la) * t, P[1] + (ua[1] / la) * t];
    const T2 = [P[0] + (ub[0] / lb) * t, P[1] + (ub[1] / lb) * t];
    if (prev) segs.push(reta(prev, T1));
    else first = T1;
    if (t > 0) {
      // filete: cúbica pelo ponto P com a mesma tangente — a fração 0,55
      // do kappa aproxima o arco circular em qualquer abertura < 180°
      const k = (4 / 3) * Math.tan((Math.PI - 2 * half) / 4) * (t * Math.tan(half)) / t;
      segs.push([
        T1,
        [T1[0] - (ua[0] / la) * t * k, T1[1] - (ua[1] / la) * t * k],
        [T2[0] - (ub[0] / lb) * t * k, T2[1] - (ub[1] / lb) * t * k],
        T2,
      ]);
    }
    prev = T2;
    const cross = ua[0] * ub[1] - ua[1] * ub[0];
    const redondo = rad > 0 && t >= Math.min(la, lb) / 2 - 1e-6;
    if (Math.sign(cross) === -Math.sign(area) && !redondo) {
      let bx = ua[0] / la + ub[0] / lb;
      let by = ua[1] / la + ub[1] / lb;
      const bl = Math.hypot(bx, by) || 1;
      bx /= bl;
      by /= bl;
      const rr = t * Math.tan(half);
      const kk = half > 1e-3 ? rr / Math.sin(half) - rr : 0;
      const fora = (u, l) => {
        const nx = -u[1] / l;
        const ny = u[0] / l;
        return nx * bx + ny * by > 0 ? [-nx, -ny] : [nx, ny];
      };
      cantos.push({ p: [P[0] + bx * kk, P[1] + by * kk], na: fora(ua, la), nb: fora(ub, lb) });
    }
  }
  segs.push(reta(prev, first));
  return { subs: [segs], cantos };
}

const reta = (a, b) => [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + (2 * (b[0] - a[0])) / 3, a[1] + (2 * (b[1] - a[1])) / 3], b];

const rect = (x, y, w, h, r = 0) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);

/** Elipse em 4 cúbicas; `horario` false inverte o sentido (furo). */
function elipseSub(cx, cy, rx, ry = rx, horario = true) {
  const p = [
    [cx + rx, cy],
    [cx, cy + ry],
    [cx - rx, cy],
    [cx, cy - ry],
  ];
  const c = [
    [[cx + rx, cy + ry * K], [cx + rx * K, cy + ry]],
    [[cx - rx * K, cy + ry], [cx - rx, cy + ry * K]],
    [[cx - rx, cy - ry * K], [cx - rx * K, cy - ry]],
    [[cx + rx * K, cy - ry], [cx + rx, cy - ry * K]],
  ];
  const segs = p.map((a, i) => [a, c[i][0], c[i][1], p[(i + 1) % 4]]);
  return horario ? segs : segs.reverse().map(([a, b, cc, d]) => [d, cc, b, a]);
}
const elipse = (cx, cy, rx, ry = rx) => ({ subs: [elipseSub(cx, cy, rx, ry)], cantos: [] });

function estrela(cx, cy, r, inner = 0.48, n = 5, round = 4) {
  return poly(
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const k = i % 2 ? inner : 1;
      return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
    }),
    round
  );
}

/** Folha: lente entre dois arcos, ponta em `ang` graus a partir da base. */
function folha(x, y, comp, larg, ang) {
  const a = (ang * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const ponta = [x + ux * comp, y + uy * comp];
  const lado = (from, to, ctrl) => [from, [from[0] + (ctrl[0] - from[0]) * 0.9, from[1] + (ctrl[1] - from[1]) * 0.9], [to[0] + (ctrl[0] - to[0]) * 0.9, to[1] + (ctrl[1] - to[1]) * 0.9], to];
  const base = [x, y];
  const c1 = [x + ux * comp * 0.5 + nx * larg * 1.25, y + uy * comp * 0.5 + ny * larg * 1.25];
  const c2 = [x + ux * comp * 0.5 - nx * larg * 1.25, y + uy * comp * 0.5 - ny * larg * 1.25];
  return { subs: [[lado(base, ponta, c1), lado(ponta, base, c2)]], cantos: [] };
}

/** Linha aberta (polilinha) — só tinta, centrada. */
const linha = (...pts) => ({
  subs: [pts.slice(1).map((p, i) => reta(pts[i], p))],
  cantos: [],
  aberta: true,
});

// ---------- saída ----------

const tela = (subs, m, [dx, dy] = [0, 0]) =>
  subs.map((segs) =>
    segs.map((sg) =>
      sg.map((p) => {
        const q = aplica(m, p);
        return [q[0] + dx, q[1] + dy];
      })
    )
  );

const inverte = (segs) => [...segs].reverse().map(([a, b, c, d]) => [d, c, b, a]);

/** Área com sinal de um subcaminho (amostrado) — orienta as peças da
 *  varredura no mesmo sentido, pra regra nonzero virar união. */
function area(segs) {
  let s = 0;
  let prev = segs[0][0];
  for (const [a, b, c, d] of segs)
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      const p = [
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
      ];
      s += prev[0] * p[1] - p[0] * prev[1];
      prev = p;
    }
  return s / 2;
}
const positivo = (segs) => (area(segs) < 0 ? inverte(segs) : segs);

/** Corta a cúbica onde a tangente fica paralela a v — cada pedaço varre
 *  uma fita simples (sem se cruzar). */
function cortaParalelo(sg, v) {
  const [p0, p1, p2, p3] = sg;
  const x = (u, w) => (w[0] - u[0]) * v[1] - (w[1] - u[1]) * v[0];
  const A = x(p0, p1);
  const B = x(p1, p2);
  const C = x(p2, p3);
  const qa = A - 2 * B + C;
  const qb = 2 * (B - A);
  const ts = [];
  if (Math.abs(qa) < 1e-9) {
    if (Math.abs(qb) > 1e-9) ts.push(-A / qb);
  } else {
    const disc = qb * qb - 4 * qa * A;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      ts.push((-qb - r) / (2 * qa), (-qb + r) / (2 * qa));
    }
  }
  const cortes = ts.filter((t) => t > 1e-3 && t < 1 - 1e-3).sort((a, b) => a - b);
  const out = [];
  let resto = sg;
  let feito = 0;
  for (const t of cortes) {
    const tt = (t - feito) / (1 - feito);
    const [e, d] = casteljau(resto, tt);
    out.push(e);
    resto = d;
    feito = t;
  }
  out.push(resto);
  return out;
}
function casteljau([a, b, c, d], t) {
  const l = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ab = l(a, b);
  const bc = l(b, c);
  const cd = l(c, d);
  const abc = l(ab, bc);
  const bcd = l(bc, cd);
  const m = l(abc, bcd);
  return [
    [a, ab, abc, m],
    [m, bcd, cd, d],
  ];
}

/** A varredura exata da face ao longo de v: a face, a face deslocada e a
 *  fita de cada trecho do contorno voltado pra v. Basta a fita frontal:
 *  andando de um ponto da varredura no sentido -v, a entrada na face é
 *  sempre por uma borda cuja normal olha pra v. Tudo sai no sentido do
 *  contorno externo (furo segue invertido), então nonzero vira união. */
function varre(subs, v) {
  const mov = (segs) => segs.map((sg) => sg.map(([x, y]) => [x + v[0], y + v[1]]));
  const sinal = Math.sign(area(subs[0])) || 1;
  const face = sinal > 0 ? subs : subs.map(inverte);
  const pecas = [...face, ...face.map(mov)];
  for (const segs of face)
    for (const sg of segs)
      for (const pc of cortaParalelo(sg, v)) {
        const tx = pc[3][0] - pc[0][0];
        const ty = pc[3][1] - pc[0][1];
        // normal externa (ty, -tx) no sentido positivo; fita só se olha pra v
        if (ty * v[0] - tx * v[1] <= 1e-9) continue;
        const [m0] = mov([pc]);
        pecas.push(positivo([pc, reta(pc[3], m0[3]), ...inverte([m0]), reta(m0[0], pc[0])]));
      }
  return pecas;
}

/** Um desenho: operações na ordem de pintura (fundo → frente), já em
 *  espaço de tela. `s` = lateral varrida e `p` = face (tinta 2W por baixo
 *  + cor), `l` = traço de tinta. */
class Desenho {
  constructor() {
    this.ops = [];
  }
  /** Peça com espessura: a face varrida ao longo de EXT·prof. */
  slab(forma, m, cor, { prof = 1, lado, vinco = true } = {}) {
    const v = [EXT[0] * prof, EXT[1] * prof];
    const face = tela(forma.subs, m);
    if (prof > 0) {
      this.ops.push({ k: "s", subs: varre(face, v), cor: lado ?? cor });
      if (vinco && forma.cantos.length) {
        const det = m[0] * m[3] - m[1] * m[2];
        const vl = Math.hypot(...v) || 1;
        const olha = ([nx, ny]) => {
          const wx = (m[3] * nx - m[1] * ny) * Math.sign(det);
          const wy = (m[0] * ny - m[2] * nx) * Math.sign(det);
          return (wx * v[0] + wy * v[1]) / (Math.hypot(wx, wy) * vl) > 0.05;
        };
        const vincos = forma.cantos
          .filter((c) => olha(c.na) && olha(c.nb))
          .map((c) => {
            const p = aplica(m, c.p);
            return [reta(p, [p[0] + v[0], p[1] + v[1]])];
          });
        if (vincos.length) this.ops.push({ k: "l", subs: vincos, aberta: true });
      }
    }
    this.ops.push({ k: "p", subs: face, cor });
    return this;
  }
  /** Peça chapada, sem espessura (rótulo, detalhe sobre a face). */
  chapa(forma, m, cor) {
    return this.slab(forma, m, cor, { prof: 0 });
  }
  /** Traço de tinta aberto. */
  traco(forma, m, { w } = {}) {
    this.ops.push({ k: "l", subs: tela(forma.subs, m), aberta: !!forma.aberta, w });
    return this;
  }
  /** Enquadra no canvas (sobra pra tinta + borda de papel) e vira texto.
   *  Escala a geometria, não o traço — a linha fica igual em toda peça. */
  fim() {
    const xs = [];
    const ys = [];
    for (const o of this.ops)
      for (const segs of o.subs)
        for (const sg of segs)
          for (const [x, y] of sg) {
            xs.push(x);
            ys.push(y);
          }
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const lado = 500 - 2 * (W + CORTE + 4);
    const k = Math.min(lado / (x1 - x0), lado / (y1 - y0), 1.2);
    const ox = 250 - ((x0 + x1) / 2) * k;
    const oy = 250 - ((y0 + y1) / 2) * k;
    const f = (p) => `${Math.round(p[0] * k + ox)} ${Math.round(p[1] * k + oy)}`;
    return this.ops.map((o) => {
      let d = "";
      for (const segs of o.subs) {
        d += `M${f(segs[0][0])}`;
        for (const sg of segs) d += ehReta(sg) ? `L${f(sg[3])}` : `C${f(sg[1])} ${f(sg[2])} ${f(sg[3])}`;
        if (!o.aberta) d += "Z";
      }
      return { k: o.k, d, ...(o.cor ? { cor: o.cor } : {}), ...(o.w ? { w: o.w } : {}) };
    });
  }
}

/** Segmento gerado por reta(): controles nos terços — sai como L. */
const ehReta = ([a, c1, c2, b]) =>
  Math.hypot(a[0] + (b[0] - a[0]) / 3 - c1[0], a[1] + (b[1] - a[1]) / 3 - c1[1]) < 1e-6 &&
  Math.hypot(a[0] + (2 * (b[0] - a[0])) / 3 - c2[0], a[1] + (2 * (b[1] - a[1])) / 3 - c2[1]) < 1e-6;

// ---------- desenhos ----------
// cores são papéis da paleta (badge-arte.tsx mapeia): tinta, papel,
// lima, verde, amarelo, laranja, azul, turquesa, marinho, ameixa

const D = {};

/** Canteiro da família de níveis: placa amarela deitada + terra. */
function canteiro(d, y = 330) {
  const m = em(250, y, CHAO);
  d.slab(rect(-118, -118, 236, 236, 34), m, "amarelo", { prof: 1.3 });
  d.chapa(elipse(0, 0, 70, 70), m, "tinta");
  return y;
}

D["nivel-inicio"] = (() => {
  const d = new Desenho();
  const y = canteiro(d);
  const m = em(250, y - 4, FACE);
  d.slab(rect(-9, -112, 18, 112, 6), m, "verde", { prof: 0.4 });
  d.slab(folha(0, -100, 92, 30, -150), m, "lima", { prof: 0.5 });
  d.slab(folha(0, -112, 88, 28, -30), m, "lima", { prof: 0.5 });
  return d.fim();
})();

D["nivel-constancia"] = (() => {
  const d = new Desenho();
  const y = canteiro(d, 345);
  const m = em(250, y - 4, FACE);
  d.slab(rect(-10, -196, 20, 196, 7), m, "verde", { prof: 0.4 });
  d.slab(folha(0, -70, 100, 32, -165), m, "lima", { prof: 0.5 });
  d.slab(folha(0, -110, 100, 32, -18), m, "lima", { prof: 0.5 });
  d.slab(folha(0, -158, 92, 30, -150), m, "lima", { prof: 0.5 });
  d.slab(folha(0, -192, 88, 28, -42), m, "lima", { prof: 0.5 });
  return d.fim();
})();

function arvore(d, y, { estrela: comEstrela = false } = {}) {
  const m = em(250, y - 4, FACE);
  d.slab(poly([[-22, 0], [-16, -150], [16, -150], [22, 0]], 8), m, "ameixa", { prof: 0.6 });
  d.slab(poly([[0, -96], [-58, -150], [-46, -164], [6, -118]], 6), m, "ameixa", { prof: 0.5 });
  d.slab(elipse(-62, -178, 66), m, "verde", { prof: 0.5 });
  d.slab(elipse(58, -196, 70), m, "verde", { prof: 0.5 });
  d.slab(elipse(-4, -236, 88), m, "lima", { prof: 0.5 });
  if (comEstrela) {
    d.slab(estrela(0, -350, 66, 0.46, 5, 6), m, "amarelo", { prof: 0.7 });
  } else {
    d.chapa(elipse(30, -226, 16), m, "laranja");
    d.chapa(elipse(-34, -262, 14), m, "laranja");
    d.chapa(elipse(66, -186, 13), m, "laranja");
  }
  return d;
}

D["nivel-veterania"] = (() => {
  const d = new Desenho();
  const y = canteiro(d, 372);
  arvore(d, y);
  return d.fim();
})();

D["nivel-completa"] = (() => {
  const d = new Desenho();
  const y = canteiro(d, 392);
  arvore(d, y, { estrela: true });
  return d.fim();
})();

/** Base pequena das bandeiras: disco deitado. */
function base(d, cor, y = 372) {
  const m = em(250, y, CHAO);
  d.slab(elipse(0, 0, 92), m, cor, { prof: 1 });
  return y;
}

function bandeira(d, pano, y) {
  const m = em(250, y - 4, FACE);
  d.slab(rect(-62, -300, 20, 300, 8), m, "papel", { prof: 0.4 });
  d.chapa(elipse(-52, -306, 18), m, "amarelo");
  pano(m);
}

D["marco-primeiro"] = (() => {
  const d = new Desenho();
  const y = base(d, "amarelo", 380);
  bandeira(d, (m) => {
    d.slab(
      poly([[-44, -292], [140, -270], [96, -214], [140, -158], [-44, -168]], 10),
      m,
      "lima",
      { prof: 0.6 }
    );
  }, y);
  return d.fim();
})();

D["marco-reta-final"] = (() => {
  const d = new Desenho();
  const y = base(d, "lima", 380);
  bandeira(d, (m) => {
    const pano = rect(-44, -292, 184, 124, 10);
    d.slab(pano, m, "papel", { prof: 0.6 });
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 3; r++)
        if ((c + r) % 2 === 0)
          d.chapa(rect(-44 + c * 46, -292 + r * 41.3, 46, 41.3, c === 0 && r === 0 ? 8 : 0), m, "tinta");
  }, y);
  return d.fim();
})();

D["marco-metade"] = (() => {
  const d = new Desenho();
  const m = em(250, 250, FACE);
  // fita em V atrás do disco
  d.slab(poly([[-96, -220], [-36, -220], [40, -40], [-20, -40]], 6), m, "azul", { prof: 0.4 });
  d.slab(poly([[36, -220], [96, -220], [20, -40], [-40, -40]], 6), m, "marinho", { prof: 0.4 });
  d.slab(elipse(0, 40, 118), m, "amarelo", { prof: 1 });
  d.traco({ subs: [elipseSub(0, 40, 82)], cantos: [] }, m);
  d.chapa(estrela(0, 40, 50, 0.46, 5, 4), m, "papel");
  return d.fim();
})();

D["conta-avaliacoes"] = (() => {
  const d = new Desenho();
  const m = em(250, 262, FACE);
  d.slab(estrela(0, 0, 168, 0.5, 5, 18), m, "amarelo", { prof: 1.2 });
  d.chapa(estrela(0, 6, 82, 0.5, 5, 8), m, "papel");
  return d.fim();
})();

D["conta-combinados"] = (() => {
  const d = new Desenho();
  const m = em(250, 262, FACE);
  d.slab(rect(-130, -168, 260, 330, 26), m, "ameixa", { prof: 1 });
  d.chapa(rect(-100, -122, 200, 258, 12), m, "papel");
  d.slab(rect(-56, -196, 112, 52, 16), m, "tinta", { prof: 0.5 });
  for (const [i, feito] of [[0, true], [1, true], [2, false]]) {
    const yy = -74 + i * 74;
    d.chapa(rect(-76, yy - 20, 40, 40, 8), m, feito ? "lima" : "papel");
    if (feito) d.traco(linha([-66, yy], [-58, yy + 10], [-44, yy - 10]), m);
    d.traco(linha([-14, yy], [74, yy]), m);
  }
  return d.fim();
})();

D["conta-especialista"] = (() => {
  const d = new Desenho();
  const m = em(250, 262, FACE);
  d.slab(poly([[-150, -170], [70, -170], [70, -20], [-40, -20], [-100, 30], [-96, -20], [-150, -20]], 28), m, "turquesa", { prof: 0.9 });
  d.slab(poly([[-40, -60], [160, -60], [160, 100], [110, 100], [116, 150], [56, 100], [-40, 100]], 28), m, "amarelo", { prof: 0.9 });
  for (const x of [20, 60, 100]) d.chapa(elipse(x, 20, 15), m, "tinta");
  return d.fim();
})();

function roda(d, m, cores) {
  d.slab(elipse(0, 0, 160), m, "papel", { prof: 1, lado: cores[0] });
  for (let i = 0; i < 8; i++) {
    if (i % 2) continue;
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const r = 132;
    const p0 = [Math.cos(a0) * r, Math.sin(a0) * r];
    const p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
    const h = (4 / 3) * Math.tan((a1 - a0) / 4) * r;
    const arco = [p0, [p0[0] - Math.sin(a0) * h, p0[1] + Math.cos(a0) * h], [p1[0] + Math.sin(a1) * h, p1[1] - Math.cos(a1) * h], p1];
    d.chapa({ subs: [[reta([0, 0], p0), arco, reta(p1, [0, 0])]], cantos: [] }, m, cores[(i / 2) % cores.length]);
  }
  d.traco({ subs: [elipseSub(0, 0, 132)], cantos: [] }, m);
  d.slab(elipse(0, 0, 26), m, "tinta", { prof: 0.4 });
}

D["inst-roda-inicial"] = (() => {
  const d = new Desenho();
  roda(d, em(250, 236, CHAO), ["turquesa", "lima", "amarelo", "azul"]);
  return d.fim();
})();

D["inst-roda-formal"] = (() => {
  const d = new Desenho();
  d.slab(elipse(0, 0, 150), em(250, 300, CHAO), "marinho", { prof: 1 });
  roda(d, em(250, 214, CHAO), ["turquesa", "verde", "amarelo", "laranja"]);
  return d.fim();
})();

D["inst-visao"] = (() => {
  const d = new Desenho();
  const m = em(250, 236, CHAO);
  d.slab(elipse(0, 0, 160), m, "marinho", { prof: 1.1 });
  d.chapa(elipse(0, 0, 124), m, "papel");
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    d.traco(linha([Math.cos(a) * 100, Math.sin(a) * 100], [Math.cos(a) * 118, Math.sin(a) * 118]), m);
  }
  const agulha = (s, cor) =>
    d.slab(poly([[0, -22 * s], [104 * s, 0], [0, 22 * s]].map(([x, y]) => aplica(gira(-45), [x, y])), 4), m, cor, { prof: 0.35 });
  agulha(1, "laranja");
  agulha(-1, "azul");
  d.slab(elipse(0, 0, 16), m, "amarelo", { prof: 0.4 });
  return d.fim();
})();

D["inst-metas"] = (() => {
  const d = new Desenho();
  const m = em(240, 270, FACE);
  d.slab(elipse(0, 0, 160), m, "laranja", { prof: 1 });
  d.chapa(elipse(0, 0, 118), m, "papel");
  d.chapa(elipse(0, 0, 78), m, "laranja");
  d.chapa(elipse(0, 0, 38), m, "papel");
  const f = mul(m, gira(-40));
  d.slab(rect(0, -9, 196, 18, 5), f, "marinho", { prof: 0.3 });
  d.slab(poly([[150, -9], [206, -46], [226, -46], [186, -9], [186, 9], [226, 46], [206, 46], [150, 9]], 4), f, "lima", { prof: 0.4 });
  return d.fim();
})();

D["inst-pdm"] = (() => {
  const d = new Desenho();
  const m = em(250, 262, CHAO);
  d.slab(rect(-150, -150, 300, 300, 30), m, "papel", { prof: 1, lado: "azul" });
  d.traco(linha([-96, 92], [-40, 70], [-60, 10], [0, -20], [40, 30], [84, -10]), m, { w: W * 0.8 });
  d.slab(elipse(-96, 92, 24), m, "lima", { prof: 0.4 });
  const pino = em(...aplica(m, [84, -16]), FACE);
  d.slab(poly([[0, 0], [-46, -70], [-46, -110], [46, -110], [46, -70]], [4, 22, 30, 30, 22]), pino, "laranja", { prof: 0.6 });
  d.chapa(elipse(0, -94, 16), pino, "papel");
  return d.fim();
})();

/** Faixa de arco (anel aberto) em polígono — a órbita do 360. */
function arco(r1, r2, a0, a1, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([Math.cos(a) * r2, Math.sin(a) * r2]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([Math.cos(a) * r1, Math.sin(a) * r1]);
  }
  return { ...poly(pts), cantos: [] };
}

D["inst-360"] = (() => {
  const d = new Desenho();
  const m = em(250, 250, CHAO);
  // a frente da peça deitada é o ângulo 135°: a seta fecha a volta ali
  const a1 = Math.PI * 2.55;
  d.slab(arco(112, 160, Math.PI * 0.98, a1), m, "ameixa", { prof: 0.8 });
  // ponta da seta na saída do arco, apontando no sentido da volta
  const c = [Math.cos(a1), Math.sin(a1)];
  const t = [-Math.sin(a1), Math.cos(a1)];
  const P = (r, s) => [c[0] * r + t[0] * s, c[1] * r + t[1] * s];
  d.slab(poly([P(80, -4), P(192, -4), P(136, 76)], 6), m, "ameixa", { prof: 0.8 });
  const centro = em(250, 246, FACE);
  d.slab(elipse(0, -36, 66), centro, "amarelo", { prof: 0.9 });
  d.chapa(elipse(-20, -56, 15), centro, "papel");
  return d.fim();
})();

// ---------- escrita ----------
// a paleta é de constantes da marca (não muda no tema escuro): tinta e
// lima/amarelo da casa + as complementares institucionais
const CORES = {
  tinta: "#323232",
  papel: "#ffffff",
  lima: "#a0c644",
  verde: "#91c868",
  amarelo: "#ffd531",
  laranja: "#f3ad42",
  azul: "#4ca9c2",
  turquesa: "#6dc6c6",
  marinho: "#1a4766",
  ameixa: "#592a56",
};

/** O arquivo: cada peça definida uma vez e usada duas — a borda de papel
 *  (traço largo, por trás de tudo) e a pintura na ordem. width/height
 *  fixos dão tamanho intrínseco ao <img> (naturalWidth > 0 quando carrega
 *  — é o que o fallback do componente confere). */
function svgDe(ops) {
  const pecas = ops.filter((o) => o.k !== "l");
  const id = new Map(pecas.map((o, i) => [o, `p${i}`]));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">`;
  s += `<!-- gerado por scripts/gerar-badges.mjs -->`;
  s += `<defs>${pecas.map((o) => `<path id="${id.get(o)}" d="${o.d}"/>`).join("")}</defs>`;
  s += `<g fill="${CORES.papel}" stroke="${CORES.papel}" stroke-width="${2 * W + 2 * CORTE}" stroke-linejoin="round">`;
  s += pecas.map((o) => `<use href="#${id.get(o)}"/>`).join("");
  s += `</g><g stroke="${CORES.tinta}" stroke-width="${2 * W}" stroke-miterlimit="4" paint-order="stroke">`;
  for (const o of ops) {
    if (o.k === "l")
      s += `<path d="${o.d}" fill="none" stroke-width="${o.w ?? W}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else
      s += `<use href="#${id.get(o)}" fill="${CORES[o.cor]}" stroke-linejoin="${o.k === "s" ? "round" : "miter"}"/>`;
  }
  return s + "</g></svg>\n";
}

mkdirSync(SAIDA, { recursive: true });
// slug que saiu do desenho sai do disco junto
for (const f of readdirSync(SAIDA)) if (f.endsWith(".svg")) rmSync(join(SAIDA, f));
let total = 0;
for (const [slug, ops] of Object.entries(D)) {
  const svg = svgDe(ops);
  total += svg.length;
  writeFileSync(join(SAIDA, `${slug}.svg`), svg);
}
console.log(`${Object.keys(D).length} desenhos → public/badges (${(total / 1024).toFixed(1)} KB)`);

const iPng = process.argv.indexOf("--png");
if (iPng > 0) {
  const dir = process.argv[iPng + 1];
  mkdirSync(dir, { recursive: true });
  for (const slug of Object.keys(D))
    for (const px of [56, 160])
      execFileSync("rsvg-convert", ["-w", String(px), "-h", String(px), join(SAIDA, `${slug}.svg`), "-o", join(dir, `${slug}-${px}.png`)]);
  console.log(`prévias em ${dir}`);
}
