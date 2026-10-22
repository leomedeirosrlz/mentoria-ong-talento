import { afterEach, describe, expect, it, vi } from "vitest";
import { saudadeDaDupla, toDateStr } from "@/lib/ciclo";
import {
  autorizarCron,
  diasDoRange,
  paramsDoTick,
  saudeParaRow,
} from "@/lib/jobs";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
} from "./helpers";

// Orquestração do job diário do semáforo (REALIZA-182): o cálculo tem suite
// própria (ciclo-semaforo.test.ts) — aqui se testa o mapeamento
// DuplaSaude→row, o range de dias, os params do tick e o bearer CRON_SECRET.

describe("saudeParaRow — mapeamento DuplaSaude → row", () => {
  it("dupla com atrasos vira row 'risco' com o sinal de atraso", () => {
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });
    const saude = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-28")); // 4 esperados, 1 feito
    const row = saudeParaRow(dupla.id, "2025-10-28", saude, "cron");
    expect(row.semaforo).toBe("risco");
    expect(row.esperado).toBe(4);
    expect(row.feitos).toBe(1);
    expect(row.sinais).toContainEqual(
      expect.objectContaining({ tipo: "atraso", tom: "risco" })
    );
    expect(row.motivos[0]).toContain("atraso");
    expect(row.dia).toBe("2025-10-28");
    expect(row.fonte).toBe("cron");
  });

  it("dupla em dia vira row 'ok' sem sinais", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07"),
        encRealizado(2, "2025-10-14"),
        encAgendado(3, "2025-10-21"),
      ],
    });
    const saude = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-15"));
    const row = saudeParaRow(dupla.id, "2025-10-15", saude, "backfill");
    expect(row.semaforo).toBe("ok");
    expect(row.sinais).toEqual([]);
    expect(row.motivos[0]).toBe("Próximo encontro 21 de out. de 2025");
    expect(row.registro_pendente).toBe(false);
    expect(row.pediu_apoio).toBe(false);
    expect(row.apoio_jovem).toBe(false);
    // os 2 realizados ainda não têm a estrela do jovem — pendência é dele
    expect(row.avaliacao_jovem_pendente).toBe(2);
    expect(row.fonte).toBe("backfill");
  });

  it("proximo/motivo (legado) não viram colunas — motivo deriva de motivos[0]", () => {
    const saude = saudadeDaDupla(mkDupla(), CICLO_16, dt("2025-10-15"));
    const row = saudeParaRow("d-1", "2025-10-15", saude, "lazy");
    expect("proximo" in row).toBe(false);
    expect("motivo" in row).toBe(false);
    expect(row.motivos[0]).toBe(saude.motivo);
  });
});

describe("diasDoRange", () => {
  it("range inclusivo: hoje-2 → hoje gera 3 dias", () => {
    expect(diasDoRange("2025-10-14", "2025-10-16")).toEqual([
      "2025-10-14",
      "2025-10-15",
      "2025-10-16",
    ]);
  });

  it("desde = hoje → só hoje (run normal do cron)", () => {
    expect(diasDoRange("2025-10-16", "2025-10-16")).toEqual(["2025-10-16"]);
  });
});

describe("paramsDoTick — validação de ?desde/?confirm", () => {
  it("sem params → ctx com hoje BRT e sem desde", () => {
    const p = paramsDoTick(new URLSearchParams());
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.ctx.hoje).toBe(toDateStr(new Date()));
      expect(p.ctx.desde).toBeUndefined();
      expect(p.ctx.confirm).toBe(false);
    }
  });

  it("desde mal formatado ou no futuro → 400", () => {
    for (const ruim of ["14/10/2025", "2025-1-1", "amanha", "2999-01-01"]) {
      const p = paramsDoTick(new URLSearchParams(`desde=${ruim}`));
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.resposta.status).toBe(400);
    }
  });

  it("desde >60 dias sem confirm → 400; com confirm=1 passa", () => {
    const longe = paramsDoTick(new URLSearchParams("desde=2000-01-01"));
    expect(longe.ok).toBe(false);
    if (!longe.ok) expect(longe.resposta.status).toBe(400);
    const confirmado = paramsDoTick(
      new URLSearchParams("desde=2000-01-01&confirm=1")
    );
    expect(confirmado.ok).toBe(true);
    if (confirmado.ok) {
      expect(confirmado.ctx.desde).toBe("2000-01-01");
      expect(confirmado.ctx.confirm).toBe(true);
    }
  });
});

describe("autorizarCron — bearer CRON_SECRET", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem CRON_SECRET configurado → 503 (não roda aberto)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = autorizarCron(new Request("http://x/api/jobs/tick"));
    expect(r?.status).toBe(503);
    expect(await r?.json()).toMatchObject({
      error: expect.stringContaining("CRON_SECRET"),
    });
  });

  it("sem header ou bearer errado → 401", () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste");
    const semHeader = autorizarCron(new Request("http://x/api/jobs/tick"));
    expect(semHeader?.status).toBe(401);
    const errado = autorizarCron(
      new Request("http://x/api/jobs/tick", {
        headers: { authorization: "Bearer outro" },
      })
    );
    expect(errado?.status).toBe(401);
  });

  it("bearer certo → null (autorizado)", () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste");
    const r = autorizarCron(
      new Request("http://x/api/jobs/tick", {
        headers: { authorization: "Bearer segredo-de-teste" },
      })
    );
    expect(r).toBeNull();
  });
});
