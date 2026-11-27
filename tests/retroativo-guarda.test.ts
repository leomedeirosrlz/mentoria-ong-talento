import { describe, expect, it } from "vitest";
import {
  avaliarRetroativo,
  diasDeAtraso,
  motivoTardioOk,
} from "@/lib/retroativo-guarda";

describe("guarda do retroativo", () => {
  it("bloqueia passo antes do vencimento oficial", () => {
    expect(avaliarRetroativo({ base: "2026-11-20", hoje: "2026-11-19" }).bloqueado).toContain("ainda não chegou");
  });
  it("passa direto até 7 dias do vencimento", () => {
    expect(avaliarRetroativo({ base: "2026-11-12", hoje: "2026-11-19" }).tardio).toBe(false);
  });
  it("marca tardio depois de 7 dias e exige motivo", () => {
    expect(avaliarRetroativo({ base: "2026-11-11", hoje: "2026-11-19" }).tardio).toBe(true);
    expect(motivoTardioOk(" ")).toBe(false);
    expect(motivoTardioOk("só conseguimos confirmar agora")).toBe(true);
  });
});

describe("diasDeAtraso", () => {
  it("conta da data oficial até hoje no fuso do programa", () => {
    expect(diasDeAtraso("2026-11-17", "2026-11-26")).toBe(9);
    expect(diasDeAtraso("2026-11-26", "2026-11-26")).toBe(0);
    expect(diasDeAtraso(null, "2026-11-26")).toBe(0);
  });
});
