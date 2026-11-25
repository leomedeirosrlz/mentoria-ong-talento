// @vitest-environment jsdom

// 526 — os combinados do jovem: o checkbox chama a RPC com o NOVO estado
// (marcar → p_feito=true) e o toast de sucesso sai só quando ele está
// marcando. A inversão (`!feito` no argumento e no toast) passava no teste
// de render e só o e2e pegou — o estado mudava pro lado errado e nada
// avisava.

import { describe, expect, it, vi } from "vitest";
import { act } from "react";

const marcarCombinadoFeito = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
const toastSuccess = vi.fn();
vi.mock("@/lib/actions", () => ({
  marcarCombinadoFeito: (...a: unknown[]) => marcarCombinadoFeito(...a),
  criarCombinadoJovem: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { JovemCombinados } from "@/components/jovem-combinados";
import type { JovemEncaminhamento } from "@/lib/types";
import { assentar, montar } from "./dom";

const ITEM = {
  id: "e2e00000-0000-4000-8000-0000000000c1",
  descricao: "Ler o capítulo 3 do guia até o próximo encontro",
  status: "pendente",
  prazo: "2026-12-05",
  responsavel: "mentorado",
  dupla_id: null,
  created_at: null,
} as JovemEncaminhamento & { id: string };

function marcar(alvo: ParentNode) {
  const caixa = alvo.querySelector<HTMLElement>('[role="checkbox"]');
  if (!caixa) throw new Error("checkbox não achado");
  act(() => {
    caixa.click();
  });
}

describe("JovemCombinados — marcar feito", () => {
  it("manda p_feito=true ao marcar e avisa com o toast de sucesso", async () => {
    const { alvo, desmontar } = montar(
      <JovemCombinados itens={[ITEM]} hoje="2026-11-25" duplaId={null} />
    );
    marcar(alvo);
    await assentar();

    expect(marcarCombinadoFeito).toHaveBeenCalledWith(ITEM.id, true);
    expect(toastSuccess).toHaveBeenCalledWith("Combinado marcado como feito.");
    desmontar();
  });

  it("clique no texto da linha também marca (label não engole o gesto)", async () => {
    marcarCombinadoFeito.mockClear();
    const { alvo, desmontar } = montar(
      <JovemCombinados itens={[ITEM]} hoje="2026-11-25" duplaId={null} />
    );
    const texto = alvo.querySelector("label span:last-child") as HTMLElement;
    act(() => {
      texto.click();
    });
    await assentar();

    expect(marcarCombinadoFeito).toHaveBeenCalledWith(ITEM.id, true);
    desmontar();
  });
});
