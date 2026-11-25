import { beforeAll, describe, expect, it, vi } from "vitest";
import { ARTES_REGISTRADAS, arteDoGlifo } from "./badges";
import { ARTE } from "./selos";
import { PALETA_REALIZA } from "./selos/base";
import { draw, FPS } from "./selos/fun";
import type { Icon, Layer } from "./selos/fun";

// O registro glifo -> selo aponta pra desenho que existe, e todo desenho
// tem dono no registro (arte órfã não vai pra estante). Os selos são cenas
// do kit fun-isometric, então o teste confere a estrutura da cena e que ela
// desenha em todos os quadros-chave sem estourar.

const SLOTS = new Set(Object.keys(PALETA_REALIZA));

/** Um contexto 2D que aceita qualquer chamada e conta os preenchimentos —
 *  jsdom/node não têm canvas, e aqui só importa que a cena resolve. */
function ctxFalso() {
  let preenchimentos = 0;
  const alvo: Record<string, unknown> = {};
  const ctx = new Proxy(alvo, {
    get(t, k: string) {
      if (k === "fill") return () => void preenchimentos++;
      if (k in t) return t[k];
      return () => ({ addColorStop() {} });
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, total: () => preenchimentos };
}

// node não tem DOMMatrix nem Path2D: o kit só os repassa pro contexto, que
// aqui é falso — o desenho de verdade é conferido no navegador (`fi check`)
beforeAll(() => {
  vi.stubGlobal(
    "DOMMatrix",
    class {
      e = 0;
      f = 0;
    }
  );
  // o trim (traço que se apaga) mede o caminho num <path> de SVG
  vi.stubGlobal("document", {
    createElementNS: () => ({
      setAttribute() {},
      getTotalLength: () => 64,
      getPointAtLength: (l: number) => ({ x: l, y: 0 }),
    }),
  });
  vi.stubGlobal(
    "Path2D",
    class {
      addPath() {}
    }
  );
});

const slotsDe = (icon: Icon) =>
  icon.layers.flatMap((l) =>
    l.shapes.flatMap((s) => [s.fill, s.side].filter((v): v is NonNullable<typeof v> => !!v))
  );

describe("selos das conquistas", () => {
  it("todo id registrado tem desenho", () => {
    for (const id of ARTES_REGISTRADAS) expect(ARTE[id], id).toBeDefined();
  });

  it("todo desenho tem dono no registro", () => {
    expect([...Object.keys(ARTE)].sort()).toEqual(
      [...ARTES_REGISTRADAS].sort()
    );
  });

  it("a chave do registro é o name do Icon", () => {
    for (const [id, icon] of Object.entries(ARTE)) expect(icon.name).toBe(id);
  });

  it("estrutura: laço de 2 a 3 s, contorno da casa e camadas ligadas", () => {
    for (const [id, icon] of Object.entries(ARTE)) {
      expect(icon.frames, id).toBeGreaterThanOrEqual(2 * FPS);
      expect(icon.frames, id).toBeLessThanOrEqual(3 * FPS);
      expect(icon.line, id).toBe(5);
      expect(icon.still ?? 0, id).toBeLessThan(icon.frames);
      const ids = new Set(
        icon.layers.map((l) => l.id).filter((v): v is string => !!v)
      );
      const orfa = (l: Layer) => !!l.parent && !ids.has(l.parent);
      expect(icon.layers.filter(orfa), id).toEqual([]);
    }
  });

  it("só cores por slot de paleta — nenhum hex fixo (a marca vem da paleta)", () => {
    for (const [id, icon] of Object.entries(ARTE))
      for (const slot of slotsDe(icon)) {
        expect(slot.startsWith("#"), `${id}: ${slot}`).toBe(false);
        expect(SLOTS.has(slot), `${id}: ${slot}`).toBe(true);
      }
  });

  it("a paleta da casa usa as cores principais da identidade", () => {
    expect(PALETA_REALIZA.main).toBe("#FFD531");
    expect(PALETA_REALIZA.ok).toBe("#A0C644");
    expect(PALETA_REALIZA.ink).toBe("#323232");
  });

  it("toda cena desenha no repouso e nos quadros-chave", () => {
    for (const [id, icon] of Object.entries(ARTE)) {
      for (const f of [
        0,
        icon.still ?? 0,
        Math.floor(icon.frames / 4),
        Math.floor(icon.frames / 2),
        icon.frames - 1,
      ]) {
        const { ctx, total } = ctxFalso();
        expect(() => draw(ctx, icon, f, PALETA_REALIZA), `${id}@${f}`).not.toThrow();
        expect(total(), `${id}@${f}`).toBeGreaterThan(0);
      }
    }
  });

  it("os níveis crescem: cada faixa tem mais corpo que a anterior", () => {
    const corpos = ["inicio", "constancia", "veterania", "completa"].map(
      (n) => ARTE[`nivel-${n}`].layers.flatMap((l) => l.shapes).length
    );
    for (let i = 1; i < corpos.length; i++)
      expect(corpos[i]).toBeGreaterThan(corpos[i - 1]);
  });

  it("marco completo e a faixa Jornada completa são a mesma peça", () => {
    expect(arteDoGlifo({ tipo: "phosphor", nome: "trophy" })).toBe(
      arteDoGlifo({ tipo: "nivel", chave: "completa" })
    );
  });

  it("glifo sem desenho devolve null (o emblema squircle assume)", () => {
    expect(
      arteDoGlifo({ tipo: "instrumento", chave: "nao_existe" as never })
    ).toBeNull();
  });
});
