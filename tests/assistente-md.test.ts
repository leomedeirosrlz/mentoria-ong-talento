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
