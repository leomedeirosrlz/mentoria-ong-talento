import { describe, expect, it } from "vitest";
import { montarEnvioChat } from "@/lib/ia/mensagens";

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
