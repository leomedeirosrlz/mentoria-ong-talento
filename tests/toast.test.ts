// tipoDoToast (src/lib/toast.ts) — a regra do REALIZA-495 em forma pura:
// só a DEMO_MSG exata sai como info; todo o resto segue erro. O desvio em
// si (error → info do Sonner) fica coberto pelo e2e demo/toast.spec.
import { describe, expect, it } from "vitest";
import { DEMO_MSG } from "@/lib/demo/shared";
import { tipoDoToast } from "@/lib/toast";

describe("tipoDoToast", () => {
  it("DEMO_MSG é aviso de demo, não falha — vira info", () => {
    expect(tipoDoToast(DEMO_MSG)).toBe("info");
  });

  it("erro real segue error", () => {
    expect(tipoDoToast("Sem conexão. Tente de novo.")).toBe("error");
  });

  it("string vazia é error — só a mensagem exata vira info", () => {
    expect(tipoDoToast("")).toBe("error");
  });
});
