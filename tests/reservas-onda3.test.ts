import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ocupadosAgendados } from "../src/lib/sugestoes-encontro";

describe("fonte única de instantes reservados", () => {
  it("ocupadosAgendados reserva só agendado/remarcado com data e rotula com artigo", () => {
    const out = ocupadosAgendados(
      [
        { data_hora: "2026-12-02T22:00:00Z", status: "agendado", numero: 6 },
        { data_hora: "2026-12-03T22:00:00Z", status: "cancelado", numero: 7 },
        { data_hora: null, status: "remarcado", numero: 8 },
      ],
      (e) => ({ rotulo: `${e.numero}º encontro`, rotuloArtigo: `o ${e.numero}º encontro` })
    );
    expect(out).toEqual([
      {
        inicio: "2026-12-02T22:00:00Z",
        rotulo: "6º encontro",
        rotuloArtigo: "o 6º encontro",
      },
    ]);
  });

  it("mentor, ficha, agenda e especialista alimentam o mesmo seletor", () => {
    const fontes = [
      "src/components/mentor-home.tsx",
      "src/components/agenda-minha.tsx",
      "src/components/agenda-especialista.tsx",
      "src/app/(app)/duplas/[id]/page.tsx",
      "src/app/(app)/duplas/[id]/encontro-row.tsx",
    ].map((p) => readFileSync(p, "utf8"));
    expect(fontes.every((s) => s.includes("ocupados"))).toBe(true);
    expect(fontes[0]).toContain("ocupadosAgendados");
    expect(fontes[1]).toContain("ocupadosAgendados");
    expect(fontes[2]).toContain("ocupadosAgendados");
    expect(fontes[3]).toContain("ocupadosAgenda");
    expect(fontes[4]).toContain("ocupadosAgenda");
    expect(readFileSync("src/components/agendar-encontro-dialog.tsx", "utf8")).toContain("ocupadosExtra={ocupados}");
    expect(readFileSync("src/components/seletor-dia-hora.tsx", "utf8")).toContain("ocupadosExtra");
  });
});
