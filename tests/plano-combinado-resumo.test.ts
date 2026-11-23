import { describe, expect, it } from "vitest";
import { resumoCombinado, type PlanoCombinado } from "@/lib/plano-combinado";

// REALIZA-513 — a régua do combinado que a ficha, a agenda do jovem e os
// banners das duas homes leem: quem falta aceitar e o próximo passo.

const base: PlanoCombinado = {
  id: "pl-1",
  status: "proposto",
  versao: 1,
  aprovado_lado: null,
  escopo: {
    ritmo: 7,
    passos: [
      { numero: 9, data: "2026-11-26" },
      { numero: 8, data: "2026-11-24" },
      { numero: 10, data: "2026-11-28" },
    ],
  },
};

describe("resumoCombinado", () => {
  it("proposta sem aceite: falta os dois, passos em ordem e o último dia", () => {
    const r = resumoCombinado(base);
    expect(r.falta).toBe("os_dois");
    expect(r.passos.map((p) => p.numero)).toEqual([8, 9, 10]);
    expect(r.ate).toBe("2026-11-28");
    expect(r.proximo?.numero).toBe(8);
  });

  it("mentor que propôs já aceitou: falta o jovem", () => {
    const r = resumoCombinado({ ...base, aceites: { mentor: true, mentorado: false } });
    expect(r.falta).toBe("mentorado");
  });

  it("aceito pelos dois: sem falta, progresso por passo marcado e feito", () => {
    const r = resumoCombinado(
      {
        ...base,
        status: "ativo",
        aceites: { mentor: true, mentorado: true },
        passos: [{ numero: 9, data_nova: "2026-11-26T22:00:00Z" }],
      },
      [8]
    );
    expect(r.falta).toBeNull();
    expect(r.passos.map((p) => p.estado)).toEqual(["feito", "marcado", "pendente"]);
    expect(r.marcados).toBe(2);
    expect(r.feitos).toBe(1);
    expect(r.proximo?.numero).toBe(10);
  });

  it("leitura antiga sem os dois carimbos cai no aprovado_lado", () => {
    const r = resumoCombinado({ ...base, aprovado_lado: "mentorado" });
    expect(r.aceites).toEqual({ mentor: false, mentorado: true });
    expect(r.falta).toBe("mentor");
  });

  it("plano fechado não está aberto e não cobra aceite", () => {
    const r = resumoCombinado({ ...base, status: "expirado" });
    expect(r.aberto).toBe(false);
    expect(r.falta).toBeNull();
  });
});
