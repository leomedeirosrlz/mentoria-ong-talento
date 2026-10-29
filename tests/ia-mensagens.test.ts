import { describe, expect, it } from "vitest";
import {
  extrairAcoes,
  montarEnvioChat,
  msgAmigavel,
} from "@/lib/ia/mensagens";

// REALIZA-283: o body do /api/ia/chat é `.strict()` — campos de UI nas
// mensagens do estado ("tools" de respostas com tool call, "estado" de
// erro/stream) derrubavam o parse com "Pedido inválido" na mensagem
// seguinte. O payload tem que sair só com role/content.
describe("montarEnvioChat", () => {
  it("tira campos de UI (tools, estado) e mantém role/content", () => {
    const base = [
      { role: "assistant", content: "oi!", tools: ["guia_consulta"] },
      { role: "user", content: "abre o pedido" },
    ];
    expect(montarEnvioChat(base)).toEqual([
      { role: "assistant", content: "oi!" },
      { role: "user", content: "abre o pedido" },
    ]);
  });

  it("descarta bolha vazia (stream intermediária) e papel fora do contrato", () => {
    const base = [
      { role: "assistant", content: "", estado: "stream" as const },
      { role: "tool" as unknown as "assistant", content: "resultado interno" },
      { role: "user", content: "pergunta" },
    ];
    expect(montarEnvioChat(base)).toEqual([
      { role: "user", content: "pergunta" },
    ]);
  });

  it("corta em 20 mantendo as mais recentes", () => {
    const base = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      content: `msg ${i}`,
    }));
    const envio = montarEnvioChat(base);
    expect(envio).toHaveLength(20);
    expect(envio[0].content).toBe("msg 5");
    expect(envio.at(-1)?.content).toBe("msg 24");
  });
});

// REALIZA-286: links internos do markdown viram chips de ação sob a
// resposta — só rota interna, sem repetição, no máximo 3.
describe("extrairAcoes", () => {
  it("extrai links internos como ações", () => {
    const acoes = extrairAcoes(
      "Vale abrir [a ficha da dupla](/duplas/abc) e conferir a [agenda](/agenda)."
    );
    expect(acoes).toEqual([
      { rotulo: "a ficha da dupla", href: "/duplas/abc" },
      { rotulo: "agenda", href: "/agenda" },
    ]);
  });

  it("ignora link externo e dedupe destinos repetidos", () => {
    const acoes = extrairAcoes(
      "[site](https://x.com) [ficha](/duplas/1) [ficha de novo](/duplas/1)"
    );
    expect(acoes).toEqual([{ rotulo: "ficha", href: "/duplas/1" }]);
  });

  it("limita em 3 ações", () => {
    const acoes = extrairAcoes(
      "[a](/1) [b](/2) [c](/3) [d](/4) [e](/5)"
    );
    expect(acoes).toHaveLength(3);
  });

  it("/materiais/ não vira ação — é citação de guia (fileira Fontes)", () => {
    const acoes = extrairAcoes(
      "Veja o [Guia do mentor](/materiais/documento/guia-mentor-dpp) " +
        "e abra [a ficha](/duplas/1)."
    );
    expect(acoes).toEqual([{ rotulo: "a ficha", href: "/duplas/1" }]);
  });
});

// REALIZA-284: erro tipado vira frase amigável; mensagem do servidor
// (data.error) passa direto quando não é rede/gate conhecido.
describe("msgAmigavel", () => {
  const FALHA = "Não consegui responder agora.";

  it("rede quebrada → mensagem de conexão", () => {
    expect(msgAmigavel(new TypeError("fetch failed"), 0, FALHA)).toMatch(
      /Sem conexão/
    );
  });

  it("429 → rate limit; 503 → indisponível", () => {
    expect(msgAmigavel(new Error("x"), 429, FALHA)).toMatch(/sequência/);
    expect(msgAmigavel(new Error("x"), 503, FALHA)).toMatch(/indisponível/);
  });

  it("erro do servidor sem gate conhecido passa o texto original", () => {
    expect(msgAmigavel(new Error("limite do plano"), 500, FALHA)).toBe(
      "limite do plano"
    );
    expect(msgAmigavel("???", 500, FALHA)).toBe(FALHA);
  });
});
