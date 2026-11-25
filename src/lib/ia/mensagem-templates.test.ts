import { describe, expect, it } from "vitest";
import {
  MENSAGEM_TEMPLATE_SLUGS,
  mensagemTemplatePedido,
  mensagemTemplateTexto,
} from "./mensagem-templates";

// A projeção que a tool mensagem_template devolve ao modelo (REALIZA-388):
// assunto + corpo com os [colchetes] intactos, callouts fora do corpo
// (são instrução de quem escreve, não texto da mensagem).

describe("mensagemTemplateTexto", () => {
  it("extrai assunto e corpo do template de preparação", () => {
    const t = mensagemTemplateTexto("mensagem-preparacao");
    expect(t?.slug).toBe("mensagem-preparacao");
    expect(t?.titulo).toContain("preparação");
    expect(t?.assunto).toBe("Vamos começar a nossa mentoria!");
    // os placeholders do guia seguem visíveis — é o que o modelo preenche
    expect(t?.corpo).toContain("[Nome]");
    expect(t?.corpo).toContain("[seu nome]");
    // callout de dica é instrução, não corpo da mensagem
    expect(t?.corpo).not.toContain("adapte a linguagem");
    expect(t?.dicas.join(" ")).toContain("adapte a linguagem");
    expect(t?.nota).toContain("mentorada");
  });

  it("indicadas preserva [link] e as duas perguntas do convite", () => {
    const t = mensagemTemplateTexto("mensagem-indicadas");
    expect(t?.assunto).toBe(
      "Sua contribuição para a mentoria de [nome do(a) jovem]"
    );
    expect(t?.corpo).toContain("[link]");
    expect(t?.corpo).toContain("[data]");
    expect(t?.corpo).toContain("1. O que você considera pontos fortes");
    expect(t?.corpo).toContain("2. Em quais aspectos");
    // o aviso de anonimato é callout — instrução pro remetente
    expect(t?.dicas.join(" ")).toContain("ninguém saberá quem disse o quê");
    expect(t?.corpo).not.toContain("Importante:");
    expect(t?.nota).toContain("link");
  });

  it("encaminhamento extrai os slots de tarefa, prazo e próximo encontro", () => {
    const t = mensagemTemplateTexto("mensagem-encaminhamento");
    expect(t?.assunto).toBe("Sobre o nosso encontro");
    expect(t?.corpo).toContain("[descrever]");
    expect(t?.corpo).toContain("[data e horário]");
    // o template não tem callout — dicas vazias, nunca corpo misturado
    expect(t?.dicas).toEqual([]);
    expect(t?.nota).toContain("combinados_pendentes");
  });

  it("html sai fora do corpo (tags viram texto puro)", () => {
    const t = mensagemTemplateTexto("mensagem-indicadas");
    expect(t?.corpo).not.toMatch(/<[^>]+>/);
    expect(t?.corpo).toContain("duas perguntas rápidas");
  });
});

describe("mensagemTemplatePedido", () => {
  it("a pergunta do CTA carrega o slug e o título pra tool casar direto", () => {
    for (const slug of MENSAGEM_TEMPLATE_SLUGS) {
      const p = mensagemTemplatePedido(slug);
      expect(p).toContain(slug);
      expect(p).toContain(mensagemTemplateTexto(slug)!.titulo);
    }
  });
});
