// @vitest-environment jsdom

// REALIZA-507 — R8: o chip que encaixa na grade mas choca com a agenda de
// quem escolhe não pode prometer "encaixa" — o aceite dele já seria
// barrado pelo choque. Fica neutro, avisa "ocupado" e o title explica.

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions-especialista", () => ({
  aceitarProposta: vi.fn(),
  aceitarSolicitacao: vi.fn(),
  cancelarSolicitacao: vi.fn(),
  contraProporSolicitacao: vi.fn(async () => ({ ok: true })),
  recusarSolicitacao: vi.fn(),
}));

import { ContraPropostaForm } from "@/components/solicitacao-negociacao";
import type { Disponibilidade } from "@/lib/types";
import { montar } from "./dom";

const SLOTS = [
  "2026-12-01T19:00:00-03:00", // ter 19h — na grade E com choque
  "2026-12-01T20:00:00-03:00", // ter 20h — na grade e livre
];
// terça à noite cobre os dois slots na grade
const GRADE: Disponibilidade = {
  celulas: [{ dia: "ter", periodo: "noite" }],
};

describe("chip 'encaixa' com choque (507)", () => {
  it("slot na grade + ocupado no instante não recebe o destaque", () => {
    const { alvo } = montar(
      <ContraPropostaForm
        solicitacaoId="s1"
        slots={SLOTS}
        disponibilidade={GRADE}
        ocupados={[
          {
            inicio: SLOTS[0],
            rotulo: "3º encontro",
            rotuloArtigo: "o 3º encontro",
          },
        ]}
        onFechar={() => {}}
      />
    );
    const radios = [...alvo.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]'
    )];
    const [ocupado, livre] = radios;
    // antes do 507 os dois ganhavam o âmbar "encaixa com você"
    expect(ocupado.getAttribute("aria-label")).toContain(
      "você já tem algo nesse horário"
    );
    expect(ocupado.getAttribute("aria-label")).not.toContain("encaixa");
    expect(livre.getAttribute("aria-label")).toContain("encaixa");
    // o rótulo visível explica sem depender de cor nem de tooltip
    expect(alvo.textContent).toContain("ocupado");
    // a legenda do âmbar segue porque ainda existe encaixe de verdade
    expect(alvo.textContent).toContain("Em âmbar");
  });

  it("sem choque o slot da grade segue 'encaixa' (regressão)", () => {
    const { alvo } = montar(
      <ContraPropostaForm
        solicitacaoId="s1"
        slots={SLOTS}
        disponibilidade={GRADE}
        ocupados={[]}
        onFechar={() => {}}
      />
    );
    const radios = [...alvo.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]'
    )];
    for (const r of radios) {
      expect(r.getAttribute("aria-label")).toContain("encaixa");
    }
    expect(alvo.textContent).not.toContain("ocupado");
  });
});
