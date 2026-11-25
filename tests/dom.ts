// Harness mínimo de DOM pros testes de componente — o repo não usa
// testing-library: createRoot + act (React 19) cobrem montar, clicar,
// digitar e os eventos de foco que o React escuta na raiz (focusin/
// focusout). Arquivos que usam isto levam `// @vitest-environment jsdom`.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// jsdom não implementa estas APIs de viewport — os componentes chamam sem
// checar (scrollTo a cada passo do wizard, observers de medida)
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

/** Monta o elemento num <div> do document e devolve container, root e
 *  desmontar. `atualizar` re-renderiza com props novas — simula o layout
 *  reentregando prop depois de um router.refresh (ex.: termo nulado). */
export function montar(el: ReactElement) {
  const alvo = document.createElement("div");
  document.body.appendChild(alvo);
  const root: Root = createRoot(alvo);
  act(() => root.render(el));
  return {
    alvo,
    root,
    atualizar(el2: ReactElement) {
      act(() => root.render(el2));
    },
    desmontar() {
      act(() => root.unmount());
      alvo.remove();
    },
  };
}

// ── eventos crus — quem chama embrulha em act() conforme o fluxo ──

export function clicar(el: Element) {
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
}

/** Digitação num input controlado: setter nativo + `input` borbulhando —
 *  é o evento que o onChange do React escuta. */
export function digitar(
  input: HTMLInputElement | HTMLTextAreaElement,
  valor: string
) {
  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Autofill silencioso do browser/gerenciador: valor escrito por fora do
 *  setter JS, sem evento nenhum — o tracker de input do React não registra
 *  (num controlado, o commit seguinte repõe a prop: é o clobber que o
 *  adotarAutofill existe pra evitar). Pra reproduzir no jsdom: remove a
 *  sombra de tracking que o React define na instância e escreve pelo
 *  setter do prototype — o slot interno (#value, lido pelo FormData)
 *  recebe o valor e o _valueTracker fica desatualizado. */
export function autofiliar(input: HTMLInputElement, valor: string) {
  delete (input as unknown as Record<string, unknown>).value;
  input.value = valor;
}

/** Foco como o React escuta: `focusin`/`focusout` borbulham e cobrem
 *  onFocus/onBlur e os captures usados no form do termo. */
export function focar(el: HTMLElement) {
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

export function desfocar(el: HTMLElement) {
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

export function submeter(form: HTMLFormElement) {
  form.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true })
  );
}

/** Drena a cadeia de uma action assíncrona em transição: a resolução da
 *  promise + o render seguinte levam mais de um macrotask — três giros
 *  dentro de act cobrem o ciclo inteiro sem depender de timing. */
export async function assentar() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Espera `ms` reais dentro de act — cobre o que um setTimeout(0) não
 *  alcança: o rAF do showPicker (jsdom agenda em ~16ms) e animações de
 *  popup do Base UI que escalonam o mount. */
export async function esperar(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Item de Select/Base UI: o click sozinho é tratado como "virtual" e
 *  só commita num item já destacado — o gesto completo do mouse é
 *  pointerdown (marca o item como clicável) → mouseup → click. */
export function clicarItem(el: Element) {
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** Botão do rodapé fixo pelo texto visível. */
export function botao(alvo: ParentNode, texto: string): HTMLButtonElement {
  const btn = [...alvo.querySelectorAll("button")].find(
    (b) => b.textContent?.trim().startsWith(texto)
  );
  if (!btn) throw new Error(`botão "${texto}" não achado`);
  return btn as HTMLButtonElement;
}
