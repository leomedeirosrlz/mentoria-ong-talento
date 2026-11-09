// Ponta de citação do guia nativo (0165): o chunk ganha âncora estável da
// seção e o slug do documento nativo; a fonte linka
// /materiais/documento/<slug>#<ancora>. A slugify vive em
// src/lib/materiais/corpus-anchor.ts (app) e duplicada em
// scripts/lib/rag-chunks.mjs (ingest é .mjs) — o teste de paridade trava
// as duas no mesmo output.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { secaoAnchor } from "@/lib/materiais/corpus-anchor";
import { metaFonte } from "@/lib/ia/fontes";
import { uiDaTool } from "@/lib/ia/ui";
import { buscarNosGuias, limparCacheGuias } from "@/lib/ia/guias";
import {
  parseDoc,
  secaoAnchor as secaoAnchorIngest,
} from "../scripts/lib/rag-chunks.mjs";

const CASOS: [string, string][] = [
  ["PDM › Onde fica na plataforma", "pdm-onde-fica-na-plataforma"],
  // º/ª não são [a-z0-9]: viram parte do separador ("1º" → "1-"), não "1o"
  ["12º encontro · Leitura da Roda da Vida", "12-encontro-leitura-da-roda-da-vida"],
  ["1º encontro · Ficha do encontro", "1-encontro-ficha-do-encontro"],
  ["Declaração de Visão e metas SMART", "declaracao-de-visao-e-metas-smart"],
  ["Código de ética e conduta", "codigo-de-etica-e-conduta"],
  ["Construindo a sua Visão!", "construindo-a-sua-visao"],
  ["O que é?", "o-que-e"],
  ["— Recesso —", "recesso"],
  ["Fase 5: aplicação (3 momentos)", "fase-5-aplicacao-3-momentos"],
];

describe("secaoAnchor", () => {
  it.each(CASOS)("%s → %s", (secao, esperado) => {
    expect(secaoAnchor(secao)).toBe(esperado);
  });

  it("cópia do ingest (rag-chunks.mjs) produz exatamente o mesmo slug", () => {
    for (const [secao] of CASOS) {
      expect(secaoAnchorIngest(secao)).toBe(secaoAnchor(secao));
    }
  });
});

describe("parseDoc", () => {
  const FM = `---
fonte: roteiro-encontro-01
titulo: Roteiro do 1º encontro
material: roteiro-encontro-01
natureza: consolidado
---

`;

  it("seção carrega secao_anchor (a mesma âncora da página do documento)", () => {
    const doc = parseDoc(
      "r.md",
      `${FM}# Roteiro\n\n## PDM › Introdução\n\nCorpo da intro.\n\n### O que é\n\nCorpo.`
    );
    const ancoraDe = (secao: string) => secaoAnchor(secao);
    for (const s of doc.secoes) {
      expect(s.secao_anchor).toBe(ancoraDe(s.secao));
    }
    expect(doc.secoes.map((s) => s.secao_anchor)).toContain(
      "pdm-introducao-o-que-e"
    );
    expect(doc.material).toBe("roteiro-encontro-01");
  });
});

describe("metaFonte com metadados do chunk", () => {
  it("guia com doc nativo + âncora → /materiais/documento/<slug>#<ancora>", () => {
    expect(
      metaFonte("roteiro-encontro-03", false, {
        material: "roteiro-encontro-03",
        ancora: "3o-encontro-ficha-do-encontro",
      })
    ).toEqual({
      rotulo: "Roteiro do 3º encontro",
      href: "/materiais/documento/roteiro-encontro-03#3o-encontro-ficha-do-encontro",
    });
  });

  it("sem âncora cai no href base do documento", () => {
    expect(
      metaFonte("roteiro-encontro-03", false, {
        material: "roteiro-encontro-03",
      })
    ).toEqual({
      rotulo: "Roteiro do 3º encontro",
      href: "/materiais/documento/roteiro-encontro-03",
    });
    // e sem nenhum metadado do chunk o mapa guia→doc segura o slug
    expect(metaFonte("roteiro-encontro-03")).toEqual({
      rotulo: "Roteiro do 3º encontro",
      href: "/materiais/documento/roteiro-encontro-03",
    });
  });

  it("jovem espelha o documento quando a audiência cobre o mentorado", () => {
    // audiencia [todos] no frontmatter → a rota do jovem serve o doc
    expect(
      metaFonte("codigo-etica-conduta", true, { ancora: "compromissos" })
    ).toEqual({
      rotulo: "Código de ética e conduta",
      href: "/jovem/materiais/documento/codigo-etica-conduta#compromissos",
    });
  });

  it("doc de mentor/staff não vira link de jovem — cai no hub dele", () => {
    // roteiros e instrumentos são audiencia dpp: a rota do jovem daria 404
    // (corpusServeJovem); mesma queda que o remap já fazia pra biblioteca
    expect(
      metaFonte("instrumento-pdm", true, { ancora: "o-que-e" })
    ).toEqual({
      rotulo: "PDM (Plano de Desenvolvimento do Mentorado)",
      href: "/jovem/materiais",
    });
    expect(metaFonte("roteiro-encontro-03", true, { ancora: "x" }).href).toBe(
      "/jovem/materiais"
    );
  });

  it("material do chunk tem prioridade sobre o slug do mapa", () => {
    expect(
      metaFonte("plataforma-e-operacao", false, { material: "plataforma-e-operacao" })
    ).toEqual({
      rotulo: "Plataforma e operação",
      href: "/materiais/documento/plataforma-e-operacao",
    });
  });

  it("todo guia de corpus linka o documento nativo, com âncora", () => {
    // o guia DPP deixou de ser "procura na lista da biblioteca": o doc
    // nativo renderiza o texto inteiro com âncora por seção
    expect(
      metaFonte("guia-mentor-dpp", false, {
        material: "guia-mentor-dpp",
        ancora: "cap-10-os-16-encontros",
      }).href
    ).toBe("/materiais/documento/guia-mentor-dpp#cap-10-os-16-encontros");
  });

  it("destino sem página de documento ignora a âncora", () => {
    // cronograma é a agenda, não um documento
    expect(metaFonte("ciclo-cronograma", false, { ancora: "x" }).href).toBe(
      "/agenda"
    );
  });

  it("guia fora do catálogo segue texto sem link mesmo com material", () => {
    expect(
      metaFonte("slug-inexistente", false, {
        material: "slug-inexistente",
        ancora: "x",
      })
    ).toEqual({ rotulo: "slug-inexistente" });
  });
});

describe("uiDaTool guia_consulta", () => {
  it("repassa material/ancora pro card de fontes", () => {
    const b = uiDaTool("guia_consulta", {
      fontes: [
        {
          guia: "roteiro-encontro-12",
          secao: "12º encontro · Ficha",
          trecho: "Texto do chunk.",
          material: "roteiro-encontro-12",
          ancora: "12o-encontro-ficha",
        },
      ],
    });
    if (b?.kind !== "fontes") throw new Error("sem card");
    expect(b.fontes[0]).toMatchObject({
      guia: "roteiro-encontro-12",
      material: "roteiro-encontro-12",
      ancora: "12o-encontro-ficha",
    });
  });
});

// supabase falso mínimo: rpc(match_ia_chunks) + from(ia_chunks)
function clienteFalso(rows: Record<string, unknown>[]) {
  const rpc = vi.fn(async () => ({
    data: [
      {
        guia: "instrumento-roda-da-vida",
        secao: "Roda da Vida › O que é",
        pagina: 1,
        trecho: "headline",
      },
    ],
    error: null,
  }));
  const from = vi.fn(() => ({
    select: () => ({
      in: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  }));
  return { rpc, from } as unknown as Parameters<typeof buscarNosGuias>[0];
}

describe("buscarNosGuias com âncora", () => {
  beforeEach(() => limparCacheGuias());

  it("âncora sai da coluna secao_anchor quando o chunk é pós-0165", async () => {
    const sb = clienteFalso([
      {
        guia: "instrumento-roda-da-vida",
        pagina: 1,
        texto: "Texto inteiro.",
        material: "instrumento-roda-da-vida",
        secao_anchor: "ancora-do-banco",
      },
    ]);
    const [f] = await buscarNosGuias(sb, "roda da vida", "fts");
    expect(f.ancora).toBe("ancora-do-banco");
    expect(f.material).toBe("instrumento-roda-da-vida");
  });

  it("chunk sem a coluna cai na slugify da seção na hora", async () => {
    const sb = clienteFalso([
      { guia: "instrumento-roda-da-vida", pagina: 1, texto: "Texto inteiro." },
    ]);
    const [f] = await buscarNosGuias(sb, "roda da vida", "fts");
    expect(f.ancora).toBe("roda-da-vida-o-que-e");
    expect(f.material).toBeNull();
  });

  it("leitura degradada (sem coluna no banco) ainda resolve a âncora", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          guia: "plataforma-e-operacao",
          secao: "Plataforma › Materiais",
          pagina: 1,
          trecho: "headline",
        },
      ],
      error: null,
    }));
    const from = vi.fn(() => ({
      select: () => ({
        in: () => ({
          in: async () => ({ data: null, error: { message: "coluna não existe" } }),
        }),
      }),
    }));
    const sb = { rpc, from } as unknown as Parameters<typeof buscarNosGuias>[0];
    const [f] = await buscarNosGuias(sb, "materiais", "fts");
    expect(f.ancora).toBe("plataforma-materiais");
    expect(f.material).toBeNull();
    expect(f.trecho).toBe("headline");
  });
});
