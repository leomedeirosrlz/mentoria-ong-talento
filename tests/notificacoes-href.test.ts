import { describe, expect, it } from "vitest";
import { hrefChamadoDoJovem } from "@/components/notificacoes";

describe("hrefChamadoDoJovem", () => {
  it("preserva o pedido ao mover o deep-link do chamado pra home", () => {
    expect(hrefChamadoDoJovem("/chamados?c=abc-123")).toBe(
      "/jovem?c=abc-123#apoio"
    );
  });

  it("sem pedido cai na seção de apoio; fora de chamados não mexe", () => {
    expect(hrefChamadoDoJovem("/chamados")).toBe("/jovem#apoio");
    expect(hrefChamadoDoJovem("/duplas/abc")).toBe("/duplas/abc");
  });
});
