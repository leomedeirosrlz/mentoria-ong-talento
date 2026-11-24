// @vitest-environment jsdom

// 025 FR-007 — o EncontroDisclosurePar segura UM estado pros dois lados
// do encontro (registro + avaliação do jovem): um clique num trigger
// abre/fecha os dois, e o deep link #registrar-{id} segue mandando — um
// hash novo devolve o controle ao hash.

import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  EncontroDisclosure,
  EncontroDisclosurePar,
} from "@/components/encontro-disclosure";
import { clicar, montar } from "./dom";

const triggerDe = (alvo: ParentNode, rotulo: string) =>
  [...alvo.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === rotulo
  ) as HTMLButtonElement;

// "painel aberto": o Root do trigger também carrega data-open — o Panel
// é o descendente [data-open], não o ancestral
const painelDe = (t: HTMLButtonElement) =>
  t.closest("[data-open]")?.querySelector("[data-open]") ?? null;

const Par = () => (
  <EncontroDisclosurePar encontroId="e1">
    <EncontroDisclosure encontroId="e1" summary={<span>Registro</span>}>
      <p>corpo do registro</p>
    </EncontroDisclosure>
    <EncontroDisclosure encontroId="e1" summary={<span>Avaliação</span>}>
      <p>corpo da avaliação</p>
    </EncontroDisclosure>
  </EncontroDisclosurePar>
);

const irParaHash = (hash: string) => {
  // mesmo contrato do abrirAncoraRegistro: pushState não dispara
  // hashchange, quem navega por ele acorda os assinantes no realiza:hash
  window.history.pushState(null, "", hash);
  act(() => {
    window.dispatchEvent(new Event("realiza:hash"));
  });
};

afterEach(() => {
  window.history.pushState(null, "", window.location.pathname);
});

describe("EncontroDisclosurePar (FR-007)", () => {
  it("clicar no Registro abre a Avaliação junto — o segundo clique fecha os dois", () => {
    const { alvo, desmontar } = montar(<Par />);
    const reg = triggerDe(alvo, "Registro");
    const ava = triggerDe(alvo, "Avaliação");
    expect(reg.getAttribute("aria-expanded")).toBe("false");
    expect(ava.getAttribute("aria-expanded")).toBe("false");

    act(() => clicar(reg));
    expect(reg.getAttribute("aria-expanded")).toBe("true");
    expect(ava.getAttribute("aria-expanded")).toBe("true");
    expect(painelDe(reg)?.textContent).toContain("corpo do registro");
    expect(painelDe(ava)?.textContent).toContain("corpo da avaliação");

    act(() => clicar(reg));
    expect(reg.getAttribute("aria-expanded")).toBe("false");
    expect(ava.getAttribute("aria-expanded")).toBe("false");
    desmontar();
  });

  it("clicar na Avaliação também abre o Registro", () => {
    const { alvo, desmontar } = montar(<Par />);
    act(() => clicar(triggerDe(alvo, "Avaliação")));
    expect(triggerDe(alvo, "Registro").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(triggerDe(alvo, "Avaliação").getAttribute("aria-expanded")).toBe(
      "true"
    );
    desmontar();
  });

  it("#registrar-{id} abre os dois lados e um hash novo devolve o controle ao hash", () => {
    const { alvo, desmontar } = montar(<Par />);
    const reg = triggerDe(alvo, "Registro");
    const ava = triggerDe(alvo, "Avaliação");

    irParaHash("#registrar-e1");
    expect(reg.getAttribute("aria-expanded")).toBe("true");
    expect(ava.getAttribute("aria-expanded")).toBe("true");

    // a escolha local vale até o próximo hash — fechar um fecha os dois
    act(() => clicar(reg));
    expect(reg.getAttribute("aria-expanded")).toBe("false");
    expect(ava.getAttribute("aria-expanded")).toBe("false");

    // o deep link clicado de novo reabre: hash novo zera o forcado do par
    irParaHash("#registrar-e1");
    expect(reg.getAttribute("aria-expanded")).toBe("true");
    expect(ava.getAttribute("aria-expanded")).toBe("true");

    // hash de outro alvo também reseta — e este não bate, então fecha
    irParaHash("#registrar-e2");
    expect(reg.getAttribute("aria-expanded")).toBe("false");
    expect(ava.getAttribute("aria-expanded")).toBe("false");
    desmontar();
  });

  it("fora do par cada disclosure manda no próprio (standalone)", () => {
    const { alvo, desmontar } = montar(
      <>
        <EncontroDisclosure encontroId="e1" summary={<span>Registro</span>}>
          <p>corpo do registro</p>
        </EncontroDisclosure>
        <EncontroDisclosure encontroId="e1" summary={<span>Avaliação</span>}>
          <p>corpo da avaliação</p>
        </EncontroDisclosure>
      </>
    );
    act(() => clicar(triggerDe(alvo, "Registro")));
    expect(triggerDe(alvo, "Registro").getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(triggerDe(alvo, "Avaliação").getAttribute("aria-expanded")).toBe(
      "false"
    );
    // mas o deep link segue abrindo os dois — cada um lê o próprio hash
    irParaHash("#registrar-e1");
    expect(triggerDe(alvo, "Avaliação").getAttribute("aria-expanded")).toBe(
      "true"
    );
    desmontar();
  });

  it("open/onOpenChange controla por fora e vence o par", () => {
    let visto: boolean | null = null;
    const { alvo, desmontar } = montar(
      <EncontroDisclosurePar encontroId="e1">
        <EncontroDisclosure
          encontroId="e1"
          summary={<span>Registro</span>}
          open={false}
          onOpenChange={(v) => {
            visto = v;
          }}
        >
          <p>corpo do registro</p>
        </EncontroDisclosure>
        <EncontroDisclosure encontroId="e1" summary={<span>Avaliação</span>}>
          <p>corpo da avaliação</p>
        </EncontroDisclosure>
      </EncontroDisclosurePar>
    );
    const reg = triggerDe(alvo, "Registro");
    act(() => clicar(reg));
    // o pai recebeu o pedido mas não atendeu — controlado não abre sozinho
    expect(visto).toBe(true);
    expect(reg.getAttribute("aria-expanded")).toBe("false");
    // e o gesto controlado não escreve no estado do par
    expect(triggerDe(alvo, "Avaliação").getAttribute("aria-expanded")).toBe(
      "false"
    );
    desmontar();
  });
});
