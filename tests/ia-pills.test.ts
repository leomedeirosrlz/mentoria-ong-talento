// Catálogo e baralho das pills do empty state (spec 026, FR-011..013).
// O catálogo é uma promessa — cada sugestão nomeia a tool do IA_TOOLS
// que responde de fato — então o teste cruza os três lados em vez de
// confiar na forma:
//   · toda pill devolvida pro (papeis, página) aponta pra uma tool real
//     E que algum papel da pessoa tem na allowlist (a pill nunca promete
//     o que a Liza não responde pra aquele papel);
//   · PILLS_TOOL_ROLES, o espelho client-side do `roles` do registry
//     (tools.ts não entra no bundle da bolha — é servidor), bate com a
//     fonte de verdade: papel removido duma tool lá quebra aqui;
//   · cada contexto continua com 6–8 itens depois da filtragem;
//   · o texto é pergunta que uma pessoa escreveria: ≤60, sem travessão
//     e sem id cru (a regra anti-id da spec vale a UI inteira).
// O baralho (sortearLote/marcarClicada/deck no storage) é puro — rng e
// storage injetados, rotação por visita sem DOM.

import { describe, expect, it } from "vitest";
import {
  catalogo,
  chaveDeckPills,
  gravarDeckPills,
  lerDeckPills,
  marcarClicada,
  PILLS_TOOL_ROLES,
  sortearLote,
  type DeckPills,
  type Pill,
} from "@/lib/ia/pills";
import { IA_TOOL_NOMES, IA_TOOLS } from "@/lib/ia/tools";
import type { AppRole } from "@/lib/types";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const FICHA = "/duplas/11111111-2222-4333-8444-555555555555";

/** Contextos cobertos — os mesmos do sugestoes() antigo, agora por papel
 *  efetivo: jovem nas páginas dele, staff na ficha/agenda/lista/guia e
 *  os genéricos de coordenação, supervisor e mentor (puro e híbrido). */
const CONTEXTOS: [AppRole[], string][] = [
  [["mentorado"], "/jovem"],
  [["mentorado"], "/jovem/agenda"],
  [["mentorado"], "/jovem/especialistas"],
  [["mentorado"], "/jovem/materiais"],
  [["coordenacao"], FICHA],
  [["supervisor"], FICHA],
  [["mentor_dpp"], FICHA],
  [["mentor_especialista"], FICHA],
  [["coordenacao"], "/agenda"],
  [["supervisor"], "/agenda"],
  [["mentor_dpp"], "/agenda"],
  [["mentor_especialista"], "/agenda"],
  [["coordenacao"], "/duplas"],
  [["supervisor"], "/duplas"],
  [["coordenacao"], "/materiais"],
  [["mentor_dpp"], "/materiais"],
  [["coordenacao"], "/"],
  [["supervisor"], "/"],
  [["mentor_dpp"], "/"],
  [["mentor_especialista"], "/"],
  [["mentor_dpp", "mentor_especialista"], "/"],
  [["mentorado", "coordenacao"], "/duplas"],
];

describe("catálogo × allowlist (FR-011)", () => {
  it("cada contexto rende 6–8 pills depois da filtragem por papel", () => {
    for (const [papeis, pagina] of CONTEXTOS) {
      const pills = catalogo(papeis, pagina);
      expect(
        pills.length,
        `${pagina} com [${papeis}] devolveu ${pills.length}`
      ).toBeGreaterThanOrEqual(6);
      expect(pills.length).toBeLessThanOrEqual(8);
    }
  });

  it("toda pill aponta pra tool real e dentro da allowlist do papel", () => {
    for (const [papeis, pagina] of CONTEXTOS) {
      for (const pill of catalogo(papeis, pagina)) {
        expect(
          IA_TOOL_NOMES as string[],
          `tool ${pill.tool} ("${pill.texto}") não existe no registry`
        ).toContain(pill.tool);
        const roles = IA_TOOLS[pill.tool as keyof typeof IA_TOOLS]
          .roles as readonly AppRole[];
        expect(
          papeis.some((p) => roles.includes(p)),
          `"${pill.texto}" (${pagina}) aponta pra ${pill.tool}, que nenhum papel de [${papeis}] tem`
        ).toBe(true);
      }
    }
  });

  it("textos são pergunta curta em pt-BR: ≤60, sem travessão nem uuid", () => {
    const textos = new Set<string>();
    for (const [papeis, pagina] of CONTEXTOS)
      for (const p of catalogo(papeis, pagina)) textos.add(p.texto);
    for (const t of textos) {
      expect(t.trim().length, `"${t}" vazio`).toBeGreaterThan(3);
      expect(t.length, `"${t}" passou de 60`).toBeLessThanOrEqual(60);
      expect(t, `"${t}" com travessão`).not.toMatch(/[—–]/);
      expect(t, `"${t}" com id cru`).not.toMatch(UUID_RE);
    }
  });

  it("PILLS_TOOL_ROLES espelha o registry: chave real, roles idênticos", () => {
    for (const [tool, roles] of Object.entries(PILLS_TOOL_ROLES)) {
      expect(IA_TOOL_NOMES as string[]).toContain(tool);
      // roles comparados como conjunto — a ordem no registry não é contrato
      expect(
        [...roles].sort(),
        `roles de ${tool} divergem do IA_TOOLS`
      ).toEqual(
        [...IA_TOOLS[tool as keyof typeof IA_TOOLS].roles].sort()
      );
    }
  });

  it("papel sem grant nenhum no contexto recebe só o que ele responde", () => {
    // mentor_especialista na ficha: plano_em_dia não entra (é DPP/staff),
    // mas o resto do contexto segue cheio
    const pills = catalogo(["mentor_especialista"], FICHA);
    expect(pills.some((p) => p.tool === "plano_em_dia")).toBe(false);
    expect(pills.length).toBeGreaterThanOrEqual(6);
    // supervisor na lista de duplas: a fila de pareamento é coord-only
    expect(
      catalogo(["supervisor"], "/duplas").some(
        (p) => p.tool === "aguardando_par"
      )
    ).toBe(false);
  });

  it("`papeis` da pill corta o recorte da pergunta, não o grant (527)", () => {
    // "Quantos chamados abertos?" promete a fila da operação, mas a tool
    // do mentor devolve só os pedidos dele — a pill fica pra equipe
    // mesmo com grant em chamados_resumo
    const texto = "Quantos chamados abertos?";
    expect(
      catalogo(["coordenacao"], "/agenda").some((p) => p.texto === texto)
    ).toBe(true);
    expect(
      catalogo(["supervisor"], "/agenda").some((p) => p.texto === texto)
    ).toBe(true);
    for (const pagina of ["/agenda", "/", "/duplas", FICHA]) {
      for (const papel of ["mentor_dpp", "mentor_especialista"] as const) {
        expect(
          catalogo([papel], pagina).some((p) => p.texto === texto),
          `${papel} em ${pagina} não devia ver "${texto}"`
        ).toBe(false);
      }
    }
    // o recorte soma com o grant: híbrido mentor+equipe vê a pill
    expect(
      catalogo(["mentor_dpp", "coordenacao"], "/agenda").some(
        (p) => p.texto === texto
      )
    ).toBe(true);
  });
});

// ---------- rotação (FR-012/013) ----------

/** rng determinístico — mulberry32: sorteios reproduzíveis entre runs. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const textos = (lote: Pill[]) => lote.map((p) => p.texto);

describe("sortearLote — rotação por visita", () => {
  it("lotes consecutivos são disjuntos até o catálogo esgotar", () => {
    const cat = catalogo(["coordenacao"], "/duplas"); // 7 itens
    const deck: DeckPills = { vistos: [], clicados: [] };
    const r1 = sortearLote(cat, deck, 3, mulberry32(7));
    expect(r1.lote).toHaveLength(3);
    // o sorteio já marca o lote como visto — é o que a visita persiste
    expect(r1.deck.vistos).toEqual(expect.arrayContaining(textos(r1.lote)));

    const r2 = sortearLote(cat, r1.deck, 3, mulberry32(13));
    expect(r2.lote).toHaveLength(3);
    expect(textos(r2.lote).filter((t) => textos(r1.lote).includes(t))).toEqual(
      []
    );

    // sobra 1: lotes nunca repetem dentro do mesmo baralho
    const r3 = sortearLote(cat, r2.deck, 3, mulberry32(29));
    expect(r3.lote).toHaveLength(1);
  });

  it("esgotado o baralho reseta junto: clicados zeram e o lote sai inteiro", () => {
    const cat = catalogo(["mentorado"], "/jovem"); // 7 itens
    // cobertura quase total com um clicado no meio — o reset tem que
    // zerar o set de clicados junto (FR-013)
    const cobertos = cat.slice(0, -1).map((p) => p.texto);
    const deck: DeckPills = {
      vistos: cobertos.slice(1),
      clicados: [cobertos[0]],
    };
    const r1 = sortearLote(cat, deck, 3, mulberry32(3));
    expect(r1.lote).toHaveLength(1); // só o último não visto
    // próximo sorteio: tudo coberto → reset — o clicado volta a poder sair
    const r2 = sortearLote(cat, r1.deck, 3, mulberry32(31));
    expect(r2.lote).toHaveLength(3);
    expect(r2.deck.clicados).toEqual([]);
    expect(r2.deck.vistos).toEqual(textos(r2.lote));
    // e o texto clicado antes está elegível de novo (pode ou não sair —
    // o que não pode é estar bloqueado)
    expect(r2.deck.clicados).not.toContain(cobertos[0]);
  });

  it("clicadas contam como vistos e saem do sorteio", () => {
    const cat = catalogo(["mentor_dpp"], "/");
    const clicada = cat[0].texto;
    const r = sortearLote(
      cat,
      { vistos: [], clicados: [clicada] },
      cat.length, // lote maior que o baralho prova a exclusão direto
      mulberry32(5)
    );
    expect(r.lote).toHaveLength(cat.length - 1);
    expect(textos(r.lote)).not.toContain(clicada);
  });

  it("catálogo menor que o lote devolve tudo", () => {
    const cat = catalogo(["coordenacao"], "/duplas").slice(0, 2);
    const r = sortearLote(cat, { vistos: [], clicados: [] }, 3, mulberry32(1));
    expect(r.lote).toHaveLength(2);
    expect(r.deck.vistos).toHaveLength(2);
  });

  it("catálogo vazio devolve lote vazio sem reset fantasma", () => {
    const r = sortearLote([], { vistos: ["x"], clicados: [] }, 3, mulberry32(1));
    expect(r.lote).toEqual([]);
    expect(r.deck.vistos).toEqual(["x"]);
  });
});

describe("marcarClicada + deck no storage (FR-013)", () => {
  const storageFake = () => {
    const mapa = new Map<string, string>();
    return {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
    };
  };

  it("clique marca o texto, com dedup, e tira ele do próximo sorteio", () => {
    let deck: DeckPills = { vistos: [], clicados: [] };
    deck = marcarClicada(deck, "Resumo da semana");
    deck = marcarClicada(deck, "Resumo da semana");
    expect(deck.clicados).toEqual(["Resumo da semana"]);
  });

  it("roundtrip pelo storage na chave por papel", () => {
    const s = storageFake();
    const deck: DeckPills = {
      vistos: ["a", "b"],
      clicados: ["a"],
    };
    gravarDeckPills(s, "coordenacao", deck);
    expect(lerDeckPills(s, "coordenacao")).toEqual(deck);
    // papel diferente, deck diferente — a memória é por papel
    expect(lerDeckPills(s, "mentorado")).toEqual({ vistos: [], clicados: [] });
    expect(chaveDeckPills("coordenacao")).toBe("liza:pills:coordenacao");
  });

  it("JSON quebrado e formato estranho degradam pro deck vazio", () => {
    const s = storageFake();
    s.setItem(chaveDeckPills("mentorado"), "{quebrado");
    expect(lerDeckPills(s, "mentorado")).toEqual({ vistos: [], clicados: [] });
    s.setItem(
      chaveDeckPills("mentorado"),
      JSON.stringify({ vistos: "não-é-lista", clicados: [1, "ok"] })
    );
    expect(lerDeckPills(s, "mentorado")).toEqual({
      vistos: [],
      clicados: ["ok"],
    });
  });

  it("storage que lança não derruba: leitura vazia, escrita engolida", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(lerDeckPills(quebrado, "mentorado")).toEqual({
      vistos: [],
      clicados: [],
    });
    expect(() =>
      gravarDeckPills(quebrado, "mentorado", { vistos: ["a"], clicados: [] })
    ).not.toThrow();
    // e sem storage nenhum (SSR) também não quebra
    expect(lerDeckPills(null, "mentorado")).toEqual({
      vistos: [],
      clicados: [],
    });
    expect(() =>
      gravarDeckPills(null, "mentorado", { vistos: [], clicados: [] })
    ).not.toThrow();
  });
});
