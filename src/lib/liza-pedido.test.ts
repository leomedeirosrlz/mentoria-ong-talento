import { afterEach, describe, expect, it, vi } from "vitest";
import { LIZA_PEDIDO_EVENTO, pedirALiza } from "./liza-pedido";

// A ponte do CTA "Pedir pra Liza" (REALIZA-388): a página dispara o
// CustomEvent que a AssistenteBolha escuta — window/CustomEvent não
// existem no ambiente node do vitest, então o teste os simula.

class FakeCustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

describe("pedirALiza", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispara o CustomEvent nomeado com a pergunta no detail", () => {
    const disparos: FakeCustomEvent[] = [];
    vi.stubGlobal("CustomEvent", FakeCustomEvent);
    vi.stubGlobal("window", {
      dispatchEvent: (e: FakeCustomEvent) => {
        disparos.push(e);
        return true;
      },
    });
    pedirALiza("Quero personalizar o template mensagem-preparacao");
    expect(disparos).toHaveLength(1);
    expect(disparos[0].type).toBe(LIZA_PEDIDO_EVENTO);
    expect(disparos[0].detail).toEqual({
      pergunta: "Quero personalizar o template mensagem-preparacao",
    });
  });
});
