// @vitest-environment jsdom

// REALIZA-507 — R17: o "agendado" vencido tinha um badge passivo que
// parecia ação morta — o gesto real morava só na seção "Precisa de você".
// Com a dupla ativa a linha recebe o mesmo trio (Aconteceu / Remarcar /
// Não aconteceu, mesmas RPCs e gates); sem ela sobra só o status. No 530
// a fileira de botões virou "1 primária + ⋯" (AcoesMenu): a decisiva fica
// à vista e o resto desce pro menu "Ações do encontro".

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
import { act } from "react";
import { assentar, clicar, montar } from "./dom";

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

/** O ⋯ da linha — "Ações do encontro" nomeia o trigger mesmo icon-only. */
const gatilhoMenu = (alvo: ParentNode) =>
  alvo.querySelector<HTMLElement>('button[aria-label="Ações do encontro"]');

/** Itens do ⋯ aberto — o popup mora em portal no document. */
async function itensDoMenu(alvo: ParentNode) {
  act(() => clicar(gatilhoMenu(alvo)!));
  await assentar();
  const popup = document.querySelector('[data-slot="dropdown-menu-content"]');
  if (!popup) throw new Error("popup do ⋯ não abriu");
  return [...popup.querySelectorAll('[role="menuitem"]')].map(
    (i) => i.textContent
  );
}

describe("agendado vencido (507)", () => {
  it("dupla ativa: Aconteceu à vista, Remarcar e Não aconteceu no ⋯", async () => {
    const { alvo, desmontar } = montar(
      <EncontroLinha
        e={VENCIDO}
        agora={Date.now()}
        duplaAtiva
        rotulo="3º encontro"
      />
    );
    const rotulos = botoes(alvo);
    // a decisiva da linha é o registro — direto, sem menu no caminho
    expect(rotulos).toContain("Já aconteceu");
    // o resto do trio mora no ⋯, não solto na fileira
    expect(rotulos.some((t) => t?.includes("Remarcar"))).toBe(false);
    expect(gatilhoMenu(alvo)).not.toBeNull();
    const itens = await itensDoMenu(alvo);
    expect(itens).toContain("Remarcar");
    expect(itens).toContain("Não aconteceu");
    // a pergunta passiva some — virou gesto de verdade
    expect(alvo.textContent).not.toContain("Aconteceu?");
    desmontar();
  });

  it("dupla parada: sem gesto que a RPC aceitaria, fica o status", () => {
    const { alvo, desmontar } = montar(
      <EncontroLinha e={VENCIDO} agora={Date.now()} rotulo="3º encontro" />
    );
    expect(alvo.textContent).toContain("Aconteceu?");
    expect(gatilhoMenu(alvo)).toBeNull();
    expect(botoes(alvo)).not.toContain("Aconteceu");
    desmontar();
  });

  it("trilha de especialista não promete Remarcar (gesto é do esp)", async () => {
    const { alvo, desmontar } = montar(
      <EncontroLinha
        e={VENCIDO}
        agora={Date.now()}
        duplaAtiva
        trilha="especialista"
        rotulo="Sessão 2 com Sofia"
      />
    );
    expect(botoes(alvo)).toContain("Já aconteceu");
    const itens = await itensDoMenu(alvo);
    expect(itens).toContain("Não aconteceu");
    expect(itens).not.toContain("Remarcar");
    expect(alvo.textContent).not.toContain("Remarcar");
    desmontar();
  });
});

describe("retroativo criado pelo jovem (0207/530)", () => {
  it("Corrigir à vista, Desfazer no ⋯ — affordance por autoria", async () => {
    const retro: JovemEncontro = {
      ...VENCIDO,
      status: "realizado",
      realizado_em: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      created_by: "p-jovem",
    };
    const { alvo, desmontar } = montar(
      <EncontroLinha
        e={retro}
        agora={Date.now()}
        duplaAtiva
        meId="p-jovem"
        rotulo="3º encontro"
      />
    );
    expect(botoes(alvo)).toContain("Corrigir");
    const itens = await itensDoMenu(alvo);
    expect(itens).toContain("Desfazer");
    desmontar();
  });
});
