// @vitest-environment jsdom

// REALIZA-507 — R17: o "agendado" vencido tinha um badge passivo que
// parecia ação morta — o gesto real morava só na seção "Precisa de você".
// Com a dupla ativa a linha recebe o mesmo trio (Aconteceu / Remarcar /
// Não aconteceu, mesmas RPCs e gates); sem ela sobra só o status.

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  agendarEncontroJovem: vi.fn(async () => ({ ok: true })),
  conflitoEncontro: vi.fn(async () => ({ conflitos: [] })),
  desmarcarEncontro: vi.fn(async () => ({ ok: true })),
  marcarAconteceuJovem: vi.fn(async () => ({ ok: true })),
  marcarNaoAconteceuJovem: vi.fn(async () => ({ ok: true })),
  salvarLinkEncontro: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions-jovem", () => ({
  desfazerRetroativoJovem: vi.fn(async () => ({ ok: true })),
  registrarRetroativoJovem: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions-avaliacao", () => ({
  definirVisibilidadeAvaliacao: vi.fn(async () => ({ ok: true })),
}));

import { EncontroLinha } from "@/components/jovem-encontro-linha";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { montar } from "./dom";

const VENCIDO: JovemEncontro = {
  id: "e1",
  dupla_id: "d1",
  numero: 3,
  data_hora: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  realizado_em: null,
  duracao_min: 60,
  status: "agendado",
  link: null,
  motivo_reagendamento: null,
};

const botoes = (alvo: ParentNode) =>
  [...alvo.querySelectorAll("button")].map((b) => b.textContent?.trim());

describe("agendado vencido (507)", () => {
  it("dupla ativa: a linha oferece o trio da pendência, sem badge morto", () => {
    const { alvo } = montar(
      <EncontroLinha
        e={VENCIDO}
        agora={Date.now()}
        duplaAtiva
        rotulo="3º encontro"
      />
    );
    const rotulos = botoes(alvo);
    expect(rotulos).toContain("Aconteceu");
    expect(rotulos.some((t) => t?.includes("Remarcar"))).toBe(true);
    expect(rotulos).toContain("Não aconteceu");
    // a pergunta passiva some — virou gesto de verdade
    expect(alvo.textContent).not.toContain("Aconteceu?");
  });

  it("dupla parada: sem gesto que a RPC aceitaria, fica o status", () => {
    const { alvo } = montar(
      <EncontroLinha e={VENCIDO} agora={Date.now()} rotulo="3º encontro" />
    );
    expect(alvo.textContent).toContain("Aconteceu?");
    expect(botoes(alvo)).not.toContain("Aconteceu");
    expect(botoes(alvo)).not.toContain("Não aconteceu");
  });

  it("trilha de especialista não promete Remarcar (gesto é do esp)", () => {
    const { alvo } = montar(
      <EncontroLinha
        e={VENCIDO}
        agora={Date.now()}
        duplaAtiva
        trilha="especialista"
        rotulo="Sessão 2 com Sofia"
      />
    );
    const rotulos = botoes(alvo);
    expect(rotulos).toContain("Aconteceu");
    expect(rotulos).toContain("Não aconteceu");
    expect(rotulos.some((t) => t?.includes("Remarcar"))).toBe(false);
  });
});
