// @vitest-environment jsdom

// Spec 022 US3 — a prévia da ficha herda o gate de largura do /f/:
// instrumento sob medida abre o popup `full` (a moldura de documento de
// 768px precisa caber) e o frame usa a largura pública por sistema no
// modo "Computador"; o modo "Celular" segue fixado em ~390px pra todos.

import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FormularioSistema } from "@/lib/forms/schema";

// o FormularioPublico real puxa server actions — a asserção é da
// moldura/popup, então um stub vazio basta
vi.mock("@/app/f/[token]/formulario-publico", () => ({
  FormularioPublico: () => null,
}));

import { FormularioPreview } from "@/app/(app)/formularios/formulario-preview";
import { assentar, botao, clicar, montar } from "./dom";

/** A moldura interna da prévia — o único div com transition de max-width. */
const moldura = () =>
  [...document.querySelectorAll("div")].find((d) =>
    d.className.includes("transition-[max-width]")
  ) as HTMLElement | undefined;

const popup = () =>
  document.querySelector('[data-slot="dialog-content"]') as
    | HTMLElement
    | undefined;

async function abrirPrevia(sistema?: FormularioSistema | null) {
  const { alvo, desmontar } = montar(
    <FormularioPreview
      titulo="Plano de Desenvolvimento"
      descricao={null}
      campos={[]}
      sistema={sistema}
    />
  );
  act(() => clicar(botao(alvo, "Pré-visualizar")));
  await assentar();
  return { desmontar };
}

function paraComputador() {
  const toggle = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Computador"
  );
  expect(toggle).toBeTruthy();
  act(() => clicar(toggle!));
}

describe("largura da prévia por sistema (022)", () => {
  it("instrumento: popup full + moldura de documento no Computador", async () => {
    const { desmontar } = await abrirPrevia("pdm");
    // modo default é Celular — a moldura do WhatsApp não se move
    expect(moldura()?.className).toContain("max-w-[390px]");
    expect(popup()?.className).toContain("sm:max-w-[calc(100%-2rem)]");

    paraComputador();
    await assentar();
    expect(moldura()?.className).toContain("sm:max-w-3xl");
    expect(moldura()?.className).not.toContain("max-w-[390px]");
    desmontar();
  });

  it("form genérico: popup 2xl + moldura estreita no Computador", async () => {
    const { desmontar } = await abrirPrevia(null);
    expect(moldura()?.className).toContain("max-w-[390px]");
    expect(popup()?.className).toContain("sm:max-w-2xl");

    paraComputador();
    await assentar();
    expect(moldura()?.className).toContain("max-w-xl");
    expect(moldura()?.className).not.toContain("sm:max-w-3xl");
    desmontar();
  });

  it("checklist do mentor (instrumento de dupla, renderer genérico) fica estreito", async () => {
    const { desmontar } = await abrirPrevia("competencias_mentor");
    paraComputador();
    await assentar();
    expect(moldura()?.className).toContain("max-w-xl");
    expect(moldura()?.className).not.toContain("sm:max-w-3xl");
    expect(popup()?.className).toContain("sm:max-w-2xl");
    desmontar();
  });
});
