import { describe, expect, it } from "vitest";
import { montarPlanoEmDia } from "@/lib/plano-em-dia";
import { saudadeDaDupla } from "@/lib/ciclo";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
} from "./helpers";
import type { DuplaPlano } from "@/lib/types";

// REALIZA-459 (0219) — o plano persistido é overlay sobre o calendário:
// encontro do escopo com data combinada no futuro já tem dono, então o
// semáforo não conta como atraso enquanto o plano vive. E o planner
// nomeia o nível de flexibilização (FR-011) sondando ritmo 1 e 2.

const realizadosAte = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    encRealizado(i + 1, CICLO_16.filter((e) => e.tipo === "encontro")[i].data!)
  );

const mkPlano = (
  status: DuplaPlano["status"],
  numeros: number[],
  over: Partial<DuplaPlano> = {}
): DuplaPlano => ({
  id: "pl-1",
  dupla_id: "d-1",
  status,
  escopo: { numeros, ritmo: 2 },
  versao: 1,
  proposto_por: "p-1",
  proposto_via: "app",
  aprovado_por: null,
  aprovado_lado: null,
  aprovado_em: null,
  contestado_por: null,
  contestado_motivo: null,
  contestado_em: null,
  expira_em: "2026-02-01T00:00:00-03:00",
  concluido_em: null,
  created_at: "2025-11-01T12:00:00-03:00",
  updated_at: "2025-11-01T12:00:00-03:00",
  ...over,
});

describe("plano persistido (459) — semáforo: atraso acordado não é risco", () => {
  const duplaDevendo = (planos?: DuplaPlano[]) =>
    mkDupla({
      iniciada_em: "2025-10-01",
      encontros: realizadosAte(2),
      planos,
    });

  it("sem plano: atraso conta normal", () => {
    const s = saudadeDaDupla(duplaDevendo(), CICLO_16, dt("2025-11-20"));
    expect(s.esperado - s.feitos).toBeGreaterThan(0);
    expect(s.sinais.some((i) => i.tipo === "atraso")).toBe(true);
  });

  it("plano aceito com passo marcado no futuro tira o escopo do atraso", () => {
    // escopo 3..6 combinado: 3 e 4 já agendados pra frente; 5 e 6 são
    // oficiais futuros — só o atraso "coberto" sai da conta
    const d = duplaDevendo([mkPlano("aceito", [3, 4])]);
    d.encontros = [
      ...realizadosAte(2),
      encAgendado(3, "2025-11-25"),
      encAgendado(4, "2025-12-02"),
    ];
    const sem = saudadeDaDupla(duplaDevendo(), CICLO_16, dt("2025-11-20"));
    const com = saudadeDaDupla(d, CICLO_16, dt("2025-11-20"));
    expect(com.esperado).toBe(sem.esperado - 2);
    expect(com.esperado - com.feitos).toBeLessThan(
      sem.esperado - sem.feitos
    );
  });

  it("plano SÓ proposto ainda não é acordo — o atraso segue contando", () => {
    const d = duplaDevendo([mkPlano("proposto", [3, 4])]);
    d.encontros = [
      ...realizadosAte(2),
      encAgendado(3, "2025-11-25"),
      encAgendado(4, "2025-12-02"),
    ];
    const sem = saudadeDaDupla(duplaDevendo(), CICLO_16, dt("2025-11-20"));
    const com = saudadeDaDupla(d, CICLO_16, dt("2025-11-20"));
    expect(com.esperado).toBe(sem.esperado);
  });

  it("plano contestado/expirado não cobre — terminal não vale acordo", () => {
    for (const status of ["contestado", "expirado", "concluido"] as const) {
      const d = duplaDevendo([mkPlano(status, [3, 4])]);
      d.encontros = [
        ...realizadosAte(2),
        encAgendado(3, "2025-11-25"),
        encAgendado(4, "2025-12-02"),
      ];
      const sem = saudadeDaDupla(duplaDevendo(), CICLO_16, dt("2025-11-20"));
      const com = saudadeDaDupla(d, CICLO_16, dt("2025-11-20"));
      expect(com.esperado).toBe(sem.esperado);
    }
  });

  it("escopo sem data marcada não cobre: combinado sem data segue devendo", () => {
    const d = duplaDevendo([mkPlano("ativo", [3])]);
    // 3 devido mas NUNCA agendado — escopo vivo sem data combinada
    const sem = saudadeDaDupla(duplaDevendo(), CICLO_16, dt("2025-11-20"));
    const com = saudadeDaDupla(d, CICLO_16, dt("2025-11-20"));
    expect(com.esperado).toBe(sem.esperado);
  });
});

describe("FR-011 — nível nomeado de flexibilização", () => {
  // CICLO_16 não tem evento de encerramento — sem ele o plano "sempre
  // fecha" e o nível nunca sobe. O probe precisa do muro do ciclo.
  const COM_FIM = (data: string) => [
    ...CICLO_16,
    {
      id: "ev-fim",
      cronograma_id: "cron-t1",
      tipo: "evento_encerramento" as const,
      numero: null,
      data,
      data_fim: null,
      status: "pendente" as const,
      observacao: null,
      ordem: 170,
      titulo: "Encerramento",
      fase: null,
      instrumentos: [],
    },
  ];

  it("em dia é ritmo_normal", () => {
    const d = mkDupla({
      encontros: [1, 2, 3].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21"][i])
      ),
    });
    const r = montarPlanoEmDia({
      dupla: d,
      eventos: CICLO_16,
      hoje: dt("2025-10-22"),
    });
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.emDia).toBe(true);
    expect(r.nivel).toBe("ritmo_normal");
  });

  it("atraso que fecha com 1/semana é ritmo_normal", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07")],
    });
    const r = montarPlanoEmDia({
      dupla: d,
      eventos: CICLO_16,
      hoje: dt("2025-10-15"), // deve só o 2
    });
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.nivel).toBe("ritmo_normal");
    expect(r.sugestao).toMatch(/um encontro por semana/i);
  });

  it("atraso que só fecha com 2/semana é semana_dupla", () => {
    // 9 devidos em 03/12: com 1/semana a projeção só alcança o calendário
    // depois do encerramento de 15/03 (os oficiais seguem vencendo no
    // caminho); com 2/semana convergiria em 11/02 — semana dupla é o
    // mínimo que recupera
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    const r = montarPlanoEmDia({
      dupla: d,
      eventos: COM_FIM("2026-03-15"),
      hoje: dt("2025-12-03"), // deve os enc.1–9 (oficial do 9º é 02/12)
    });
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.nivel).toBe("semana_dupla");
    expect(r.sugestao).toMatch(/dois encontros/i);
  });

  it("atraso que nem 2/semana fecha é conversa_coord", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    const r = montarPlanoEmDia({
      dupla: d,
      eventos: COM_FIM("2026-01-22"),
      hoje: dt("2026-01-15"), // backlog enorme — nem semana dupla fecha
    });
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.nivel).toBe("conversa_coord");
    expect(r.sugestao).toMatch(/coordenação/i);
    expect(r.dataRecuperacao).toBeNull();
  });
});
