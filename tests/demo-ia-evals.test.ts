// lib/demo/ia-evals — a máquina de evals da demo (REALIZA-382): histórico
// determinístico + run "na fila" que o laço /executar dirige de verdade
// via cookie demo_eval. Cookie mockado como no demo-ia.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      jar.has(nome) ? { value: jar.get(nome) } : undefined,
    set: (nome: string, value: string) => jar.set(nome, value),
    delete: (nome: string) => jar.delete(nome),
  }),
  headers: async () => new Headers(),
}));

import {
  demoEvalDetalhe,
  demoEvalExecutar,
  demoEvalProximo,
  demoEvalReagendar,
  demoEvalRuns,
} from "@/lib/demo/ia-evals";

const runNaFila = async () =>
  (await demoEvalRuns()).find((r) => r.status !== "concluido");

beforeEach(() => jar.clear());

describe("demoEvalRuns", () => {
  it("serve 3 runs prontos: 2 fechados com resumo + 1 na fila", async () => {
    const runs = await demoEvalRuns();
    expect(runs).toHaveLength(3);
    const fechados = runs.filter((r) => r.status === "concluido");
    expect(fechados).toHaveLength(2);
    for (const r of fechados) {
      expect(r.resumo?.total).toBeGreaterThan(0);
      expect((r.resumo!.ok + r.resumo!.falhas + r.resumo!.erros)).toBe(
        r.resumo!.total
      );
    }
    const aberto = await runNaFila();
    expect(aberto).toBeDefined();
    expect(aberto!.resumo).toBeNull();
  });
});

describe("laço /executar", () => {
  it("proximo → executar avança célula a célula até fechar o run", async () => {
    const run = (await runNaFila())!;
    const total =
      (await demoEvalDetalhe(run.id))!.itens.length;
    expect(total).toBe(10); // 5 casos × 2 modelos × 1 rep

    // ?proximo aponta a primeira célula antes de qualquer POST
    const p0 = await demoEvalProximo(run.id);
    expect(p0.proximo?.id).toBe(`${run.id}-i0`);

    let feito = false;
    for (let i = 0; i < total + 3 && !feito; i++) {
      const r = await demoEvalExecutar(run.id, { semDelay: true });
      feito = r.feito;
    }
    expect(feito).toBe(true);

    // depois de fechar, o run reabre com resumo e vereditos estáveis
    const d = await demoEvalDetalhe(run.id);
    expect(d!.run.status).toBe("concluido");
    expect(d!.run.resumo).not.toBeNull();
    const vereditos1 = d!.itens.map((i) => `${i.status}:${i.latencia_ms}`);
    const vereditos2 = (await demoEvalDetalhe(run.id))!.itens.map(
      (i) => `${i.status}:${i.latencia_ms}`
    );
    expect(vereditos1).toEqual(vereditos2); // determinístico por (run, índice)
    expect((await demoEvalProximo(run.id)).proximo).toBeNull();
  });

  it("PATCH reagenda falhas/erros e o run reabre como rodando", async () => {
    const run = (await runNaFila())!;
    let feito = false;
    while (!feito)
      feito = (await demoEvalExecutar(run.id, { semDelay: true })).feito;

    const { reagendados } = await demoEvalReagendar(run.id);
    const d = await demoEvalDetalhe(run.id);
    const falhosos = d!.itens.filter(
      (i) => i.status === "falhou" || i.status === "erro"
    ).length;
    expect(reagendados).toBe(falhosos + 0); // reagendou exatamente os ruins
    if (reagendados > 0) {
      expect(d!.run.status === "concluido").toBe(false);
      const p = await demoEvalProximo(run.id);
      expect(p.proximo).not.toBeNull(); // voltaram pra fila
    } else {
      // grade toda ok: nada pra reagendar, run segue concluído
      expect(d!.run.status).toBe("concluido");
    }
  });
});
