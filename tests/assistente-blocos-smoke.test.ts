// smoke do genUI v3 do assistente — renderToStaticMarkup (node, sem DOM):
// prova que os blocos interativos da convenção 5 renderizam sem explodir,
// com a semântica certa (grupo nomeado, checkbox com label, tom com
// rótulo) e os links de canal montados a partir do texto.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BlocoSkeleton,
  BlocoView,
  Destaque,
  Escolha,
  Passos,
  Rascunho,
  Sugestoes,
} from "../src/components/assistente-blocos";
import type { BlocoKind } from "../src/lib/ia/render";

const nada = () => {};

describe("Sugestoes", () => {
  it("um botão por item dentro de um grupo nomeado", () => {
    const html = renderToStaticMarkup(
      createElement(Sugestoes, {
        itens: ["Quais duplas estão em risco?", "Resumo da semana"],
        onEnviar: nada,
      })
    );
    expect(html).toContain('role="group"');
    expect(html).toContain("Quais duplas estão em risco?");
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain('disabled=""');
  });

  it("desabilitado no stream; lista vazia não renderiza nada", () => {
    const html = renderToStaticMarkup(
      createElement(Sugestoes, { itens: ["Outra"], onEnviar: nada, desabilitado: true })
    );
    expect(html).toContain('disabled=""');
    expect(
      renderToStaticMarkup(createElement(Sugestoes, { itens: [], onEnviar: nada }))
    ).toBe("");
  });
});

describe("Escolha", () => {
  const b = {
    pergunta: "Qual turma?",
    opcoes: [{ rotulo: "Turma 1" }, { rotulo: "Turma 2", valor: "turma-2" }],
  };

  it("aberta: grupo rotulado pela pergunta, opções habilitadas", () => {
    const html = renderToStaticMarkup(
      createElement(Escolha, { b, onEnviar: nada })
    );
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-labelledby");
    expect(html).toContain(">Qual turma?<");
    expect(html).not.toContain('disabled=""');
  });

  it("respondida: tudo desabilitado e a resposta marcada por valor", () => {
    const html = renderToStaticMarkup(
      createElement(Escolha, { b, onEnviar: nada, respondida: true, resposta: "turma-2" })
    );
    expect(html.match(/ disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });
});

describe("Rascunho", () => {
  const texto = "Oi, Ana! Bora marcar o encontro 5?";

  it("whatsapp com número usa o wa.me do contato", () => {
    const html = renderToStaticMarkup(
      createElement(Rascunho, {
        b: { canal: "whatsapp", para: "Ana", texto },
        telefone: "5511987654003",
      })
    );
    expect(html).toContain("Rascunho para Ana");
    expect(html).toContain("https://wa.me/5511987654003?text=");
    expect(html).toContain("Abrir no WhatsApp");
    expect(html).toContain("Copiar");
    expect(html).not.toContain("você escolhe o contato");
  });

  it("numero no bloco (contato da ficha) abre o wa.me direto", () => {
    const html = renderToStaticMarkup(
      createElement(Rascunho, {
        b: {
          canal: "whatsapp",
          para: "Ana",
          numero: "+55 11 98765-4003",
          texto,
        },
      })
    );
    expect(html).toContain("https://wa.me/5511987654003?text=");
    expect(html).not.toContain("você escolhe o contato");
  });

  it("whatsapp sem número cai no compartilhar do wa.me", () => {
    const html = renderToStaticMarkup(
      createElement(Rascunho, { b: { canal: "whatsapp", texto } })
    );
    expect(html).toContain("https://wa.me/?text=Oi%2C%20Ana!");
    expect(html).toContain("você escolhe o contato");
    expect(html).toContain("Rascunho de mensagem");
  });

  it("e-mail monta mailto com assunto e corpo", () => {
    const html = renderToStaticMarkup(
      createElement(Rascunho, {
        b: { canal: "email", para: "Coordenação", assunto: "Encontro 5", texto },
      })
    );
    expect(html).toContain("mailto:?subject=Encontro%205&amp;body=");
    expect(html).toContain("Abrir no e-mail");
  });

  it("texto: só Copiar, sem link de canal", () => {
    const html = renderToStaticMarkup(
      createElement(Rascunho, { b: { canal: "texto", texto } })
    );
    expect(html).not.toContain("<a ");
    expect(html).toContain("Copiar");
  });
});

describe("Passos", () => {
  it("checkbox nativo com label por passo + progresso n de m", () => {
    const html = renderToStaticMarkup(
      createElement(Passos, {
        b: {
          titulo: "Antes do encontro",
          itens: [
            { texto: "Reler o guia", detalhe: "Seção 2" },
            { texto: "Mandar lembrete" },
          ],
        },
      })
    );
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain("<label");
    expect(html).toContain("0 de 2");
    expect(html).toContain("Seção 2");
    expect(html).not.toContain("Tudo feito");
  });
});

describe("Destaque", () => {
  it("tom com ícone + rótulo (sr-only quando há título) e fonte linkada", () => {
    const html = renderToStaticMarkup(
      createElement(Destaque, {
        b: {
          tom: "atencao",
          titulo: "Prazo curto",
          texto: "O registro vence amanhã.",
          fonte: { rotulo: "Guia do mentor", href: "/materiais/documento/guia" },
        },
      })
    );
    expect(html).toContain('role="note"');
    expect(html).toContain("Atenção: ");
    expect(html).toContain("var(--warn-bg)");
    expect(html).toContain('href="/materiais/documento/guia"');
  });

  it("sem título, o rótulo do tom vira o título visível", () => {
    const html = renderToStaticMarkup(
      createElement(Destaque, { b: { tom: "dica", texto: "Comece pelo combinado." } })
    );
    expect(html).toContain(">Dica<");
    expect(html).toContain("var(--destaque-suave)");
  });
});

describe("BlocoSkeleton", () => {
  const kinds: BlocoKind[] = [
    "stats",
    "sugestoes",
    "grafico",
    "escolha",
    "rascunho",
    "passos",
    "destaque",
  ];
  it.each(kinds)("%s: status anunciado + forma aria-hidden", (kind) => {
    const html = renderToStaticMarkup(createElement(BlocoSkeleton, { kind }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Montando conteúdo");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe("BlocoView", () => {
  it("despacha gráfico pro GraficoBloco e escolha desabilitada no stream", () => {
    const graf = renderToStaticMarkup(
      createElement(BlocoView, {
        bloco: { kind: "grafico", g: { tipo: "barras", dados: [{ rotulo: "a", valor: 1 }] } },
        onEnviar: nada,
      })
    );
    expect(graf).toContain('role="img"');

    const esc = renderToStaticMarkup(
      createElement(BlocoView, {
        bloco: {
          kind: "escolha",
          b: { pergunta: "Qual?", opcoes: [{ rotulo: "A" }, { rotulo: "B" }] },
        },
        onEnviar: nada,
        streaming: true,
      })
    );
    expect(esc.match(/ disabled=""/g)).toHaveLength(2);
  });
});
