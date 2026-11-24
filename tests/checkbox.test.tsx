// @vitest-environment jsdom

// 025 (FR-004) — a Checkbox do kit é um span role=checkbox (base-ui) que
// emite um input escondido irmão. O contrato que as migrações dependem:
// clique no quadrado alterna, a label envolvente alterna (CheckboxLinha),
// o FormData carrega name/value e `indeterminate` vira aria-checked=mixed.

import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Checkbox, CheckboxLinha } from "@/components/ui/checkbox";
import { clicar, montar } from "./dom";

function caixa(alvo: ParentNode): HTMLElement {
  const el = alvo.querySelector('[role="checkbox"]');
  if (!el) throw new Error("role=checkbox não achado");
  return el as HTMLElement;
}

function inputEscondido(alvo: ParentNode): HTMLInputElement {
  const el = alvo.querySelector('input[type="checkbox"]');
  if (!el) throw new Error("input escondido não achado");
  return el as HTMLInputElement;
}

describe("Checkbox do kit", () => {
  it("clique alterna e avisa pelo onCheckedChange", () => {
    const spy = vi.fn();
    const { alvo, desmontar } = montar(
      <Checkbox onCheckedChange={spy} />
    );
    const el = caixa(alvo);
    expect(el.getAttribute("aria-checked")).toBe("false");
    clicar(el);
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(inputEscondido(alvo).checked).toBe(true);
    expect(spy).toHaveBeenCalledWith(true, expect.anything());
    clicar(el);
    expect(el.getAttribute("aria-checked")).toBe("false");
    desmontar();
  });

  it("CheckboxLinha: clique no texto da label alterna", () => {
    const { alvo, desmontar } = montar(
      <CheckboxLinha>Marcar como feito</CheckboxLinha>
    );
    const label = alvo.querySelector("label")!;
    clicar(label.querySelector("span:last-child") ?? label);
    expect(caixa(alvo).getAttribute("aria-checked")).toBe("true");
    desmontar();
  });

  it("participa do form nativo: name/value entram no FormData", () => {
    const { alvo, desmontar } = montar(
      <form>
        <Checkbox name="atividade" value="leitura" />
        <Checkbox name="livre" />
      </form>
    );
    const [a, b] = [...alvo.querySelectorAll('[role="checkbox"]')];
    const form = alvo.querySelector("form")!;
    // desmarcado não posta — mesma semântica do input nativo
    expect(new FormData(form).get("atividade")).toBeNull();
    clicar(a);
    clicar(b);
    const fd = new FormData(form);
    expect(fd.get("atividade")).toBe("leitura");
    // sem value explícito posta "on", como o nativo
    expect(fd.get("livre")).toBe("on");
    desmontar();
  });

  it("controlled: o estado manda, não o DOM", () => {
    function Caso() {
      const [feito, setFeito] = useState(false);
      return (
        <Checkbox checked={feito} onCheckedChange={(v) => setFeito(v)} />
      );
    }
    const { alvo, desmontar } = montar(<Caso />);
    const el = caixa(alvo);
    clicar(el);
    expect(el.getAttribute("aria-checked")).toBe("true");
    desmontar();
  });

  it("indeterminate: aria-checked=mixed e input.indeterminate", () => {
    const { alvo, desmontar } = montar(<Checkbox indeterminate />);
    expect(caixa(alvo).getAttribute("aria-checked")).toBe("mixed");
    expect(inputEscondido(alvo).indeterminate).toBe(true);
    desmontar();
  });

  it("disabled não alterna", () => {
    const { alvo, desmontar } = montar(<Checkbox disabled />);
    clicar(caixa(alvo));
    expect(caixa(alvo).getAttribute("aria-checked")).toBe("false");
    desmontar();
  });
});
