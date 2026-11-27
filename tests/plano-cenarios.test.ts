import { describe, expect, it } from "vitest";
import {
  exigenciasDoCenario,
  friccaoDoCenario,
  simularCenariosPlano,
} from "@/lib/plano-cenarios";
import { CICLO_16, dt, encRealizado, mkDupla, mkEvento } from "./helpers";

// mesma régua do calendário real: 4 feitos, 12 a fazer, encerramento curto
// e o recesso do fixture entre o 12º e o 13º
const ENCERRAMENTO = {
  id: "ev-fim-cen",
  cronograma_id: "cron-t1",
  tipo: "evento_encerramento" as const,
  numero: null,
  data: "2026-01-20",
  data_fim: null,
  status: "pendente" as const,
  observacao: null,
  ordem: 170,
  titulo: "Encerramento",
  fase: null,
  instrumentos: [],
};
const EVENTOS = [...CICLO_16, ENCERRAMENTO];

const dupla4 = () =>
  mkDupla({
    iniciada_em: "2025-10-01",
    encontros: [1, 2, 3, 4].map((n, i) =>
      encRealizado(n, CICLO_16.filter((e) => e.tipo === "encontro")[i].data!)
    ),
  });

describe("simularCenariosPlano", () => {
  it("compara caminhos e devolve o melhor viável com data literal", () => {
    const r = simularCenariosPlano({
      dupla: dupla4(),
      eventos: EVENTOS,
      hoje: new Date("2025-11-25T12:00:00-03:00"),
    });

    // universo pequeno e ordenado: viável primeiro, data mais cedo
    expect(r.cenarios.length).toBeGreaterThanOrEqual(4);
    expect(r.cenarios.filter((c) => c.viavel).every((c) => c.data != null)).toBe(
      true
    );
    const datas = r.cenarios.map((c) => c.data ?? "9999");
    expect([...datas].sort()).toEqual(datas);

    expect(r.melhor).not.toBeNull();
    expect(r.melhor!.viavel).toBe(true);
    expect(r.melhor!.data! <= "2026-01-20").toBe(true);
    // o melhor caminho nomeia o custo: decisão de recesso ou fusão
    expect(
      r.melhor!.decisaoRecesso != null || r.melhor!.fusao.length > 0
    ).toBe(true);
  });

  it("menor fricção: o caminho que menos muda, com todos os passos", () => {
    const r = simularCenariosPlano({
      dupla: dupla4(),
      eventos: EVENTOS,
      hoje: new Date("2025-11-25T12:00:00-03:00"),
    });
    expect(r.menorFriccao).not.toBeNull();
    const c = r.menorFriccao!.cenario;
    expect(c.viavel).toBe(true);
    expect(r.menorFriccao!.passos.length).toBeGreaterThan(0);
    expect(r.menorFriccao!.passos[0].data).toBeTruthy();
    const menor = Math.min(
      ...r.cenarios.filter((x) => x.viavel).map(friccaoDoCenario)
    );
    expect(friccaoDoCenario(c)).toBe(menor);
    expect(c.data! <= "2026-01-20").toBe(true);
    // exigencias nomeiam só o que o caminho realmente pede
    const ex = exigenciasDoCenario(c);
    expect(ex.every((x) => typeof x === "string")).toBe(true);
  });

  it("a fusão reduz sessões e aparece no cenário", () => {
    const r = simularCenariosPlano({
      dupla: dupla4(),
      eventos: EVENTOS,
      hoje: new Date("2025-11-25T12:00:00-03:00"),
    });
    const base = r.cenarios.find((c) => c.id === "base")!;
    const fusao = r.cenarios.find((c) => c.id === "fusao_pares")!;
    expect(base.fusao).toEqual([]);
    expect(fusao.fusao.length).toBeGreaterThan(0);
    expect(fusao.sessoes).toBeLessThan(base.sessoes);
  });

  it("sem dupla aplicável devolve o motivo, sem inventar cenário", () => {
    const r = simularCenariosPlano({
      dupla: mkDupla({ trilha: "especialista" }),
      eventos: EVENTOS,
      hoje: new Date("2025-11-25T12:00:00-03:00"),
    });
    expect(r.melhor).toBeNull();
    expect(r.cenarios).toHaveLength(1);
    expect(r.cenarios[0].estado).toBe("nao_aplicavel");
    expect(r.cenarios[0].observacao).toBeTruthy();
  });
});
