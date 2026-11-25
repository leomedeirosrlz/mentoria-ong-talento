// Thumbs 👍/👎 gate (lib/ia/feedback.ts): thumbs only on complex answers
// (tool / >500 chars / markdown link) and on a deterministic ~1/3 of them
// (FNV-1a of request_id % 3). Pins the eligibility rules, the exact 500
// boundary and the ~1/3 rate over a fixed id set — same id must always
// land in the same bucket, whichever criterion made it eligible.

import { describe, expect, it } from "vitest";
import {
  deveMostrarFeedback,
  FEEDBACK_MIN_CHARS,
  hashRequestId,
  temLinkMarkdown,
} from "@/lib/ia/feedback";

const ELEGIVEL = { tools: 1, contentLen: 10, hasLink: false };
const SIMPLES = { tools: 0, contentLen: 120, hasLink: false };

// fixed id set — the bucket of each id never changes between runs
const ids = Array.from({ length: 3000 }, (_, i) => `req-${i}`);
const passa = ids.filter((id) => hashRequestId(id) % 3 === 0);
const naoPassa = ids.filter((id) => hashRequestId(id) % 3 !== 0);

describe("elegibilidade", () => {
  it("resposta simples nunca mostra, em nenhum balde", () => {
    for (const id of ids.slice(0, 300)) {
      expect(deveMostrarFeedback(id, SIMPLES)).toBe(false);
    }
  });

  it("tool usada torna elegível mesmo resposta curta", () => {
    expect(
      deveMostrarFeedback(passa[0], { tools: 1, contentLen: 10, hasLink: false })
    ).toBe(true);
    expect(
      deveMostrarFeedback(naoPassa[0], { tools: 4, contentLen: 10, hasLink: false })
    ).toBe(false);
  });

  it("texto longo torna elegível — fronteira exata em 500", () => {
    expect(
      deveMostrarFeedback(passa[0], {
        tools: 0,
        contentLen: FEEDBACK_MIN_CHARS,
        hasLink: false,
      })
    ).toBe(false);
    expect(
      deveMostrarFeedback(passa[0], {
        tools: 0,
        contentLen: FEEDBACK_MIN_CHARS + 1,
        hasLink: false,
      })
    ).toBe(true);
  });

  it("link markdown torna elegível", () => {
    expect(
      deveMostrarFeedback(passa[0], { tools: 0, contentLen: 10, hasLink: true })
    ).toBe(true);
  });

  it("sem request_id não mostra — demo, erro, interrompida e msgs antigas", () => {
    for (const id of [undefined, null, ""]) {
      expect(deveMostrarFeedback(id, ELEGIVEL)).toBe(false);
      expect(deveMostrarFeedback(id, { tools: 9, contentLen: 5000, hasLink: true })).toBe(false);
    }
  });
});

describe("amostragem ~1/3", () => {
  it("depende só do request_id — o motivo da elegibilidade não muda o balde", () => {
    for (const id of ids.slice(0, 200)) {
      const a = deveMostrarFeedback(id, { tools: 1, contentLen: 10, hasLink: false });
      const b = deveMostrarFeedback(id, { tools: 0, contentLen: 900, hasLink: false });
      const c = deveMostrarFeedback(id, { tools: 0, contentLen: 10, hasLink: true });
      expect(b).toBe(a);
      expect(c).toBe(a);
    }
  });

  it("~1/3 dos elegíveis no conjunto fixo", () => {
    const n = ids.filter((id) => deveMostrarFeedback(id, ELEGIVEL)).length;
    // deterministic inputs → fixed count well inside 30–37% of 3000
    expect(n).toBeGreaterThan(900);
    expect(n).toBeLessThan(1100);
  });
});

describe("temLinkMarkdown", () => {
  it("detecta link interno e externo", () => {
    expect(temLinkMarkdown("Veja em [a ficha](/duplas/abc-123).")).toBe(true);
    expect(temLinkMarkdown("fonte: [manual](https://exemplo.com/x)")).toBe(true);
  });
  it("texto plano não conta", () => {
    expect(temLinkMarkdown("Resposta sem nenhum link.")).toBe(false);
    expect(temLinkMarkdown("[rotulo sem destino]")).toBe(false);
  });
});
