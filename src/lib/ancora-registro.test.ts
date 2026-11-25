import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirAncoraRegistro } from "./ancora-registro";

// o ambiente do vitest é node — o window é stubado com só o que o helper
// toca. O que se garante aqui é o CONTRATO da âncora: navegar pelo
// pushState (o canal que o Next patcheia — o `location.hash =` não o
// alcançava e o hash morria no write hashless do refresh pós-action) e
// acordar os assinantes pelo `realiza:hash` (pushState não emite
// hashchange).

function stubWindow() {
  const pushState = vi.fn();
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { history: { pushState }, dispatchEvent });
  return { pushState, dispatchEvent };
}

describe("abrirAncoraRegistro", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("navega pro #registrar-<id> pelo pushState", () => {
    const { pushState } = stubWindow();
    abrirAncoraRegistro("e4");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith(null, "", "#registrar-e4");
  });

  it("dispara realiza:hash — o evento que acorda RegistroInline/RegistroDetails", () => {
    const { dispatchEvent } = stubWindow();
    abrirAncoraRegistro("e4");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const ev = dispatchEvent.mock.calls[0][0] as Event;
    expect(ev).toBeInstanceOf(Event);
    expect(ev.type).toBe("realiza:hash");
  });
});
