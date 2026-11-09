// Renderer markdown-lite da Liza (assistente-md.tsx): o fence ```nota
// aberto no stream ou no fim já renderiza como rodapé apagado (não
// CodeBlock) e o itálico não casa asterisco solto de conta — regras do
// pacote nov/2026
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  analisarResposta,
  Inline,
  RespostaMd,
} from "../src/components/assistente-md";

const CTX = {
  onEnviar: () => {},
  respondida: false,
  streaming: false,
};

const resposta = (texto: string, streaming = false) =>
  renderToStaticMarkup(
    createElement(RespostaMd, {
      analise: analisarResposta(texto, streaming),
      ctx: { ...CTX, streaming },
    })
  );

const inline = (t: string) =>
  renderToStaticMarkup(createElement(Inline, { texto: t }));

describe("fence ```nota", () => {
  it("fechado renderiza como rodapé apagado, não CodeBlock", () => {
    const html = resposta("Resposta.\n\n```nota\nDetalhe fino.\n```");
    expect(html).toContain("Detalhe fino.");
    expect(html).toContain("opacity-80");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("Copiar");
  });

  it.each([true, false])(
    "aberto (streaming=%s) já renderiza como rodapé",
    (streaming) => {
      const html = resposta(
        "Resposta.\n\n```nota\nDetalhe fino.\n",
        streaming
      );
      // no stream o texto sai picado em <span class="ia-tok">: compara o texto
      expect(html.replace(/<[^>]+>/g, "")).toContain("Detalhe fino.");
      expect(html).toContain("opacity-80");
      expect(html).not.toContain("<pre");
      expect(html).not.toContain("Copiar");
    }
  );

  it("fence comum aberto segue como CodeBlock com copiar desabilitado", () => {
    const html = resposta("Resposta.\n\n```sql\nselect 1\n", true);
    expect(html).toContain("<pre");
    expect(html).toContain("select 1");
  });
});

describe("itálico", () => {
  it("marca *trecho* bem formado", () => {
    expect(inline("a *chave* aqui")).toContain("<em>chave</em>");
    expect(inline("*curto*")).toContain("<em>curto</em>");
    expect(inline("*a*")).toContain("<em>a</em>");
    expect(inline("não *desiste* agora")).toContain("<em>desiste</em>");
  });

  it("asterisco solto de conta não vira itálico", () => {
    const html = inline("2 * 3 = 6 e 4 * 5");
    expect(html).not.toContain("<em>");
    expect(html).toContain("2 * 3 = 6 e 4 * 5");
  });

  it("espaço na borda do conteúdo desqualifica", () => {
    expect(inline("* fora *")).not.toContain("<em>");
    expect(inline("*fora *")).not.toContain("<em>");
  });

  it("* colado em palavra não abre; depois de pontuação abre", () => {
    expect(inline("a*b*c")).not.toContain("<em>");
    expect(inline("a, *b*, c")).toContain("<em>b</em>");
  });
});

// ---------- redesign de legibilidade (hierarquia e blocos) ----------

describe("hierarquia de títulos", () => {
  it("## = h2 de seção, ### = h3 de subseção, #### = h4 miúdo", () => {
    const h2 = resposta("Texto.\n\n## Situação");
    expect(h2).toContain("<h2");
    expect(h2).toContain(
      "text-lg font-semibold tracking-tight pt-4 first:pt-0"
    );
    const h3 = resposta("Texto.\n\n### Detalhe");
    expect(h3).toContain("<h3");
    expect(h3).toContain(
      "text-base font-semibold tracking-tight pt-3 first:pt-0"
    );
    const h4 = resposta("Texto.\n\n#### Nota");
    expect(h4).toContain("<h4");
    expect(h4).toContain("text-sm font-semibold pt-2 first:pt-0");
  });
});

describe("separador ---", () => {
  it.each(["---", "***", "___"])(
    "linha %s vira <hr> entre blocos, não <p>",
    (sep) => {
      const html = resposta(`Bloco um.\n\n${sep}\n\nBloco dois.`);
      expect(html).toContain("<hr");
      expect(html).not.toContain(`<p>${sep}</p>`);
      expect(html).toContain("Bloco um.");
      expect(html).toContain("Bloco dois.");
    }
  );

  it("'- - -' com espaços NÃO vira hr — segue como item de lista", () => {
    const html = resposta("- - -");
    expect(html).not.toContain("<hr");
    expect(html).toContain("<ul");
    expect(html.replace(/<[^>]+>/g, "")).toContain("- -");
  });
});

describe("blockquote agrupado", () => {
  it("linhas > seguidas viram UM blockquote com um <p> por linha", () => {
    const html = resposta("> linha um\n> linha dois\n> linha três");
    expect(html.match(/<blockquote/g)).toHaveLength(1);
    expect(html.match(/<p>/g)).toHaveLength(3);
    expect(html).toContain("linha um");
    expect(html).toContain("linha três");
    expect(html).toContain("border-l-[3px]");
  });

  it("linha em branco fecha a citação — uma barra por trecho", () => {
    const html = resposta("> uma\n\n> duas");
    expect(html.match(/<blockquote/g)).toHaveLength(2);
  });
});

describe("lista aninhada", () => {
  it("item indentado ≥2 espaços vira <ul> dentro do <li> anterior", () => {
    const html = resposta(
      "- passo um\n  - detalhe a\n  - detalhe b\n- passo dois"
    );
    expect(html.match(/<ul/g)).toHaveLength(2);
    // a sublista entra dentro do <li> pai, depois do texto do item
    expect(html).toContain("passo um<ul");
    expect(html).toContain("<li>detalhe a</li>");
    expect(html).toContain("<li>detalhe b</li>");
    expect(html).toContain("<li>passo dois</li>");
  });

  it("indentado sem lista aberta cai como item de topo (nada some)", () => {
    const html = resposta("texto\n\n  - solto");
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html).toContain("<li>solto</li>");
  });
});
