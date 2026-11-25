// LizaDormindo (REALIZA-363) — the provider-sleep state: real sleepy
// mascot (not emoji), the warm "come back later" copy and the two
// densities (page card, compact bubble/model).
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LizaDormindo } from "../src/components/liza/liza-dormindo";

describe("LizaDormindo", () => {
  it("renders the sleepy mascot (svg) + the sleep moon", () => {
    const html = renderToStaticMarkup(createElement(LizaDormindo));
    // LizaBlob renders as svg — real branding, not emoji
    expect(html).toContain("<svg");
    expect(html).toContain("A Liza está dormindo");
    // warm copy: exhausted from helping + invitation to come back
    expect(html).toContain("exausta");
    expect(html).toContain("Volte mais tarde");
    expect(html).not.toContain("—"); // no em dash in visible copy
  });

  it("compacto fits the bubble/model: same face, smaller density", () => {
    const html = renderToStaticMarkup(
      createElement(LizaDormindo, { compacto: true })
    );
    expect(html).toContain("<svg");
    expect(html).toContain("A Liza está dormindo");
    expect(html).toContain("text-xs"); // body at the mobile floor
  });

  it("titulo/detalhe cover the honest contexts (exhausted model)", () => {
    const html = renderToStaticMarkup(
      createElement(LizaDormindo, {
        compacto: true,
        titulo: "Este modelo dormiu",
        detalhe: "Parou de responder até a janela liberar.",
      })
    );
    expect(html).toContain("Este modelo dormiu");
    expect(html).toContain("Parou de responder até a janela liberar.");
    expect(html).not.toContain("A Liza está dormindo");
  });

  it("children = the 'come back later' CTA slot", () => {
    const html = renderToStaticMarkup(
      createElement(
        LizaDormindo,
        {},
        createElement("button", null, "Fechar")
      )
    );
    expect(html).toContain("<button");
    expect(html).toContain("Fechar");
  });
});
