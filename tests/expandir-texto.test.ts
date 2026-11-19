import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpandirTexto } from "@/components/expandir-texto";

// REALIZA-438 — o "Ler tudo" só existe quando o texto transborda as 3
// linhas renderizadas, medida que depende de layout (client). Contrato do
// SSR (spec 007, D1): sempre clampado, nunca um controle que não funciona —
// o botão nasce na montagem se a medida confirmar o overflow.
describe("ExpandirTexto — contrato SSR", () => {
  it("renderiza o texto clampado e nenhum botão", () => {
    const html = renderToStaticMarkup(
      createElement(ExpandirTexto, {
        className: "text-sm",
        children: "um texto",
      })
    );
    expect(html).toContain("um texto");
    expect(html).toContain("line-clamp-3");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Ler tudo");
  });
});
