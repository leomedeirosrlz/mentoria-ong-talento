import { describe, expect, it } from "vitest";
import { avaliarRetroativo, motivoTardioOk } from "@/lib/retroativo-guarda";

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
