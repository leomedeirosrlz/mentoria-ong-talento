// @vitest-environment jsdom

// 024 (SC-006) — o toast de level-up: um por visita quando a faixa sobe,
// baseline em localStorage ("realiza:nivel:<mentoradoId>" guarda o MAIOR
// visto — faixa perdida não des-avisa), nunca na demo e silêncio com
// storage indisponível. DOM mínimo: createRoot + act (ver tests/dom.ts).

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/demo/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/demo/shared")>()),
  demoAtivoClient: vi.fn(() => false),
}));

import { toast } from "@/lib/toast";
import { demoAtivoClient } from "@/lib/demo/shared";
import { NivelNotifier } from "@/components/nivel-notifier";
import { montar } from "./dom";

const K = "realiza:nivel:m1";

const monta = (props: Partial<Parameters<typeof NivelNotifier>[0]> = {}) =>
  montar(
    <NivelNotifier
      mentoradoId="m1"
      atual="constancia"
      titulo="Constância"
      criterio="1 mês de programa e 4 encontros com seu mentor"
      {...props}
    />
  );

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(demoAtivoClient).mockReturnValue(false);
});

describe("NivelNotifier — toast de level-up (024)", () => {
  it("baseline antiga dispara o toast uma vez e grava a faixa nova", () => {
    localStorage.setItem(K, "0");
    const { desmontar } = monta();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Subiu de nível: Constância",
      expect.objectContaining({
        description: expect.stringContaining("Segue firme"),
      })
    );
    expect(localStorage.getItem(K)).toBe("1");
    desmontar();
  });

  it("primeira visita semeia a baseline em silêncio — sem falso level-up", () => {
    const { desmontar } = monta();
    expect(toast.success).not.toHaveBeenCalled();
    expect(localStorage.getItem(K)).toBe("1");
    desmontar();
  });

  it("baseline no nível atual (ou acima) não repete o toast", () => {
    localStorage.setItem(K, "1");
    const a = monta();
    expect(toast.success).not.toHaveBeenCalled();
    a.desmontar();
    // a segunda montagem da mesma visita lê a baseline já gravada
    localStorage.setItem(K, "-1");
    const b = monta();
    expect(toast.success).toHaveBeenCalledTimes(1);
    b.desmontar();
    const c = monta();
    expect(toast.success).toHaveBeenCalledTimes(1);
    c.desmontar();
  });

  it("faixa perdida não des-avisa: a baseline guarda o maior visto", () => {
    localStorage.setItem(K, "3");
    const { desmontar } = monta();
    expect(toast.success).not.toHaveBeenCalled();
    expect(localStorage.getItem(K)).toBe("3");
    desmontar();
  });

  it("sem faixa nenhuma (atual null): nível nenhum, toast nenhum", () => {
    localStorage.setItem(K, "-1");
    const { desmontar } = monta({ atual: null, titulo: null, criterio: null });
    expect(toast.success).not.toHaveBeenCalled();
    expect(localStorage.getItem(K)).toBe("-1");
    desmontar();
  });

  it("demo: nunca dispara nem escreve baseline", () => {
    vi.mocked(demoAtivoClient).mockReturnValue(true);
    localStorage.setItem(K, "-1");
    const { desmontar } = monta();
    expect(toast.success).not.toHaveBeenCalled();
    expect(localStorage.getItem(K)).toBe("-1");
    desmontar();
  });

  it("storage indisponível: silêncio, sem quebrar a página", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("sem storage");
      });
    const { desmontar } = monta();
    expect(toast.success).not.toHaveBeenCalled();
    desmontar();
    spy.mockRestore();
  });
});
