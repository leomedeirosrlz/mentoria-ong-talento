// @vitest-environment jsdom

// REALIZA-524 — o cabeçalho do modal de avaliação abre com a data e o dia
// da semana ("terça-feira, 14/10 às 19:00 · 5º encontro com Ricardo"):
// com pendências em fila, o nº sozinho não diz QUAL encontro é. Sem
// `realizado_em` legível o cabeçalho é honesto — "data a confirmar",
// nunca inventa dia.

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions-avaliacao", () => ({
  submeterAvaliacao: vi.fn(async () => ({ ok: true })),
  definirVisibilidadeAvaliacao: vi.fn(async () => ({ ok: true })),
}));

import { AvaliarPendenteButton } from "@/components/jovem-avaliacoes";
import { assentar, botao, clicar, montar } from "./dom";

const PENDENTE = {
  encontroId: "e1",
  numero: 5,
  trilha: "dpp",
  rotulo: "5º encontro com Ricardo",
};

async function abrirModal(realizado_em: string | null) {
  const { alvo, desmontar } = montar(
    <AvaliarPendenteButton
      pendente={{ ...PENDENTE, realizado_em }}
      primeiroNome="Maria"
    />
  );
  act(() => clicar(botao(alvo, "Avaliar")));
  await assentar();
  return { desmontar };
}

const titulo = () =>
  document.querySelector('[data-slot="dialog-title"]')?.textContent ?? "";

describe("cabeçalho do modal de avaliação (524)", () => {
  it("data válida: dia da semana + dd/mm às hh:mm antes do rótulo", async () => {
    const { desmontar } = await abrirModal("2025-10-14T19:00:00-03:00");
    expect(titulo()).toContain("terça-feira, 14/10 às 19:00");
    expect(titulo()).toContain("5º encontro com Ricardo");
    desmontar();
  });

  it("sem realizado_em cai em 'data a confirmar', sem inventar dia", async () => {
    const { desmontar } = await abrirModal(null);
    expect(titulo()).toContain("data a confirmar");
    expect(titulo()).toContain("5º encontro com Ricardo");
    desmontar();
  });

  it("data inválida recebe o mesmo fallback honesto", async () => {
    const { desmontar } = await abrirModal("lixo");
    expect(titulo()).toContain("data a confirmar");
    desmontar();
  });
});
