import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const retro = readFileSync("supabase/migrations/0242_retroativo_tardio.sql", "utf8");
const agenda = readFileSync("supabase/migrations/0243_agenda_mentorado_legado.sql", "utf8");

describe("migrations da onda 3 (não aplicadas pelo agente)", () => {
  it("0242 persiste motivo/flag tardio e a RPC exige motivo depois de 7 dias", () => {
    expect(retro).toContain("add column motivo_retroativo text");
    expect(retro).toContain("add column retroativo_tardio boolean");
    expect(retro).toContain("p_motivo_tardio text default null");
    expect(retro).toContain("current_date - v_oficial > 7");
    expect(retro).toContain("Já passaram mais de 7 dias");
  });

  it("0243 aceita rows legadas e compara o par civil por minuto", () => {
    expect(agenda).toContain("status in ('agendado','remarcado','cancelado')");
    expect(agenda).toContain("to_char(v_existente.data_hora at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')");
    expect(agenda).toContain("to_char(p_data_hora at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')");
  });
});
