// @vitest-environment jsdom

// REALIZA-507 — R7: dois passos pendentes do combinado não podem sugerir o
// mesmo instante (as datas combinadas iguais clampam no mesmo min) e,
// depois de confirmar um passo, os seguintes não reoferecem o instante
// confirmado — ele entra nos ocupados antes do refresh devolver tudo.

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
const aplicarPassoPlano = vi.fn(async (..._args: unknown[]) => ({
  ok: true as const,
}));
vi.mock("@/lib/actions-plano", () => ({
  aplicarPassoPlano: (...args: unknown[]) => aplicarPassoPlano(...args),
  responderPlano: vi.fn(async () => ({ ok: true })),
}));

import {
  PlanoAcordosCard,
  type PlanoCombinado,
} from "@/components/plano-acordos";
import type { SeletorSugestoes } from "@/components/seletor-dia-hora";
import { perfilDeEncontros } from "@/lib/sugestoes-encontro";
import { assentar, botao, clicar, digitar, montar } from "./dom";

const HOJE = "2026-11-21"; // sábado
const JANELA = { inicio: "2026-11-21", fim: "2026-12-19" };

const SUGESTOES: SeletorSugestoes = {
  datas: [], // o card recalcula por passo via datasDoPasso
  perfil: perfilDeEncontros([], new Date("2026-11-21T12:00:00-03:00")),
  disponibilidade: null,
  ocupados: [],
  duracaoMin: 60,
  hoje: HOJE,
  janela: JANELA,
};

const planoCom = (
  passos: { numero: number; data: string }[]
): PlanoCombinado => ({
  id: "pl1",
  status: "ativo",
  versao: 1,
  aprovado_lado: "mentorado",
  janela: JANELA,
  escopo: { ritmo: 2, passos },
  passos: [],
});

// os passos moram no <ol> do card — a régua de progresso e os chips de
// aceite (513) também usam lista, então o recorte é por elemento
const linhas = (alvo: ParentNode) => [...alvo.querySelectorAll("ol li")];

describe("sugestões dos passos pendentes (507)", () => {
  it("duas datas combinadas no mesmo dia não saem com o mesmo instante", () => {
    const { alvo } = montar(
      <PlanoAcordosCard
        plano={planoCom([
          { numero: 3, data: "2026-12-01" },
          { numero: 4, data: "2026-12-01" },
        ])}
        podeResponder={false}
        podeAplicar
        sugestoes={SUGESTOES}
      />
    );
    const textos = linhas(alvo).map((li) => li.textContent ?? "");
    expect(textos[0]).toContain("ter 01/12 às 19:00");
    // antes do 507 os dois clampavam no mesmo dia e repetiam 19:00 —
    // agora o 19:00 confirmado choca 19:00 e 19:30, o livre é 20:00
    expect(textos[1]).toContain("ter 01/12 às 20:00");
    expect(textos[1]).not.toContain("às 19:00");
  });

  it("confirmar um passo tira o instante dele da sugestão do seguinte", async () => {
    const { alvo, desmontar } = montar(
      <PlanoAcordosCard
        plano={planoCom([
          { numero: 3, data: "2026-12-01" },
          { numero: 4, data: "2026-12-02" },
        ])}
        podeResponder={false}
        podeAplicar
        sugestoes={SUGESTOES}
      />
    );
    // o 4º nasce sugerindo qua 02/12 às 19:00
    expect(linhas(alvo)[1].textContent).toContain("qua 02/12 às 19:00");

    // move o 3º pra esse mesmo instante pelo seletor ("Outra data")
    const li3 = linhas(alvo)[0];
    act(() => clicar(botao(li3, "Outra data")));
    await assentar();
    const dlg = document.querySelector('[role="dialog"], [data-slot="sheet-content"]') ?? document.body;
    act(() => clicar(botao(dlg as ParentNode, "Outro dia")));
    await assentar();
    const dia = dlg.querySelector<HTMLInputElement>('input[type="date"]')!;
    act(() => digitar(dia, "2026-12-02"));
    await assentar();
    act(() => clicar(botao(dlg as ParentNode, "Confirmar data")));
    await assentar();

    expect(aplicarPassoPlano).toHaveBeenCalledWith(
      "pl1",
      3,
      "2026-12-02T19:00:00-03:00",
      undefined,
      undefined,
      undefined
    );
    const textos = linhas(alvo).map((li) => li.textContent ?? "");
    expect(textos[0]).toContain("Marcado pra qua 02/12 às 19:00");
    // o 4º não pode reoferecer o instante que o 3º acabou de tomar —
    // 19:00 choca 19:00 e 19:30, então o próximo livre é 20:00
    expect(textos[1]).toContain("sugestão qua 02/12 às 20:00");
    expect(textos[1]).not.toContain("às 19:00");
    desmontar();
  });

  it("o instante confirmado aparece como choque no seletor do outro passo", async () => {
    const { alvo, desmontar } = montar(
      <PlanoAcordosCard
        plano={planoCom([
          { numero: 3, data: "2026-12-01" },
          { numero: 4, data: "2026-12-02" },
        ])}
        podeResponder={false}
        podeAplicar
        sugestoes={SUGESTOES}
      />
    );
    // confirma o 3º direto na sugestão (ter 01/12 às 19:00)
    act(() => clicar(botao(linhas(alvo)[0], "Confirmar")));
    await assentar();

    // abre o seletor do 4º e vai pro dia do confirmado: 19:00 vira choque
    act(() => clicar(botao(linhas(alvo)[1], "Outra data")));
    await assentar();
    const dlg = document.querySelector('[role="dialog"], [data-slot="sheet-content"]') ?? document.body;
    act(() => clicar(botao(dlg as ParentNode, "Outro dia")));
    await assentar();
    act(() =>
      digitar(
        dlg.querySelector<HTMLInputElement>('input[type="date"]')!,
        "2026-12-01"
      )
    );
    await assentar();
    const ocupadoChip = [...dlg.querySelectorAll('[role="radio"]')].find(
      (r) => r.getAttribute("aria-label") === "19:00" || r.getAttribute("aria-label")?.startsWith("19:00,")
    );
    expect(ocupadoChip?.getAttribute("aria-label")).toContain("indisponível");
    expect(ocupadoChip?.getAttribute("aria-disabled")).toBe("true");
    desmontar();
  });
});
