import { describe, expect, it } from "vitest";
import { montarPlanoEmDia } from "@/lib/plano-em-dia";
import {
  CICLO_16,
  dth,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncontro,
  mkRegistro,
} from "./helpers";
import type { Dupla } from "@/lib/types";

// CICLO_16: 16 terças 2025-10-07 → 2026-01-20, recesso 2025-12-25→2026-01-04
// (entre enc.12 e enc.13) e uma formação. O plano sempre agenda a partir de
// "amanhã" — hoje via parâmetro, nunca o relógio.

const plano = (dupla: Dupla, hoje: string, ritmo?: number) =>
  montarPlanoEmDia({ dupla, eventos: CICLO_16, hoje: dt(hoje), ritmo });

describe("montarPlanoEmDia — aplicabilidade", () => {
  it("trilha especialista retorna não se aplica", () => {
    const r = plano(mkDupla({ trilha: "especialista" }), "2025-11-20");
    expect(r).toEqual({ aplicavel: false, motivo: expect.any(String) });
  });

  it("DPP sem cronograma retorna não se aplica", () => {
    const r = plano(mkDupla({ cronograma_id: null }), "2025-11-20");
    expect(r).toEqual({ aplicavel: false, motivo: expect.any(String) });
  });

  it("dupla em dia: sem passos a agendar e dataRecuperacao null", () => {
    const d = mkDupla({
      encontros: [1, 2, 3].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21"][i])
      ),
    });
    const r = plano(d, "2025-10-22");
    expect(r.aplicavel).toBe(true);
    if (!r.aplicavel) return;
    expect(r.emDia).toBe(true);
    expect(r.passos).toEqual([]);
    expect(r.dataRecuperacao).toBeNull();
  });
});

describe("montarPlanoEmDia — passos devidos", () => {
  it("faltantes viram passos 'agendar' em ordem de número", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07")],
    });
    const r = plano(d, "2025-11-03"); // enc.2,3,4 vencidos (5 vence em 11-04)
    if (!r.aplicavel) throw new Error("não aplicável");
    const agendar = r.passos.filter((p) => p.acao === "agendar");
    expect(agendar.map((p) => p.numero)).toEqual([2, 3, 4]);
    expect(agendar.every((p) => p.encontroId === null)).toBe(true);
  });

  it("buraco fora de ordem: repõe o menor número faltante", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07"), encRealizado(4, "2025-10-28")],
    });
    const r = plano(d, "2025-11-03"); // deve 2 e 3 (enc.5 vence em 11-04)
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.passos.map((p) => p.numero)).toEqual([2, 3]);
  });

  it("nao_aconteceu vira 'remarcar' na mesma row, nunca pulado", () => {
    const falta = mkEncontro(2, {
      status: "nao_aconteceu",
      data_hora: dth("2025-10-14").toISOString(),
    });
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07"), falta],
    });
    const r = plano(d, "2025-10-20");
    if (!r.aplicavel) throw new Error("não aplicável");
    const passo = r.passos.find((p) => p.numero === 2);
    expect(passo?.acao).toBe("remarcar");
    expect(passo?.encontroId).toBe(falta.id);
  });

  it("agendado vencido sem registro vira pendência (passo 0), não passo", () => {
    const limbo = encAgendado(2, "2025-10-14");
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07"), limbo],
    });
    const r = plano(d, "2025-10-20");
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.pendenciasRegistro).toEqual([
      expect.objectContaining({ numero: 2, estado: "limbo", encontroId: limbo.id }),
    ]);
    expect(r.passos.find((p) => p.numero === 2)).toBeUndefined();
  });

  it("realizado sem registro também é pendência", () => {
    const semRegistro = encRealizado(2, "2025-10-14", null);
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07"), semRegistro],
    });
    const r = plano(d, "2025-10-20");
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.pendenciasRegistro[0]?.estado).toBe("pendente_registro");
  });

  it("agendado futuro fica 'travado' com a data da row e ocupa a semana", () => {
    const travado = encAgendado(4, "2025-11-10");
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encRealizado(2, "2025-10-14"),
        travado,
      ],
    });
    const r = plano(d, "2025-10-29"); // deve o 3; enc.4 travado
    if (!r.aplicavel) throw new Error("não aplicável");
    const p3 = r.passos.find((p) => p.numero === 3)!;
    const p4 = r.passos.find((p) => p.numero === 4)!;
    expect(p4.acao).toBe("travado");
    expect(p4.data).toBe("2025-11-10");
    expect(p3.data < p4.data).toBe(true);
  });
});

describe("montarPlanoEmDia — datas e cadência", () => {
  it("começa amanhã e respeita o ritmo por semana (2 default)", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    // quarta 2025-12-03: deve os enc.1–8 (todos vencidos)
    const r = plano(d, "2025-12-03");
    if (!r.aplicavel) throw new Error("não aplicável");
    const datas = r.passos.filter((p) => p.acao !== "travado").map((p) => p.data);
    expect(datas[0]).toBe("2025-12-04");
    // ritmo 2/sem + gaps: nunca mais que 2 numa mesma semana seg-dom
    const porSemana = new Map<string, number>();
    for (const iso of datas) {
      const dia = new Date(`${iso}T12:00:00`);
      const seg = new Date(dia);
      seg.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
      const k = seg.toISOString().slice(0, 10);
      porSemana.set(k, (porSemana.get(k) ?? 0) + 1);
    }
    expect(Math.max(...porSemana.values())).toBeLessThanOrEqual(2);
  });

  it("ritmo configurável: 3 por semana comprime mais", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    // todos os 16 devidos: o gap de prática domina o miolo, então a
    // diferença de ritmo aparece na cauda (9-16, passos sem exigência)
    const r2 = plano(d, "2026-01-20", 2);
    const r3 = plano(d, "2026-01-20", 3);
    if (!r2.aplicavel || !r3.aplicavel) throw new Error("não aplicável");
    const ultima = (r: typeof r2) =>
      r.passos.map((p) => p.data).sort().at(-1)!;
    expect(ultima(r3) < ultima(r2)).toBe(true);
  });

  it("pelo menos 2 dias entre dois encontros na mesma semana", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07")],
    });
    const r = plano(d, "2025-10-15"); // deve 2 (terça passada) — sem flags prática
    if (!r.aplicavel) throw new Error("não aplicável");
    const datas = r.passos.map((p) => p.data).sort();
    for (let i = 1; i < datas.length; i++) {
      const diff =
        (new Date(datas[i]).getTime() - new Date(datas[i - 1]).getTime()) /
        86_400_000;
      // gap do passo anterior pode ser 7 (prática) — nunca menos que 2
      expect(diff).toBeGreaterThanOrEqual(2);
    }
  });

  it("exige_pratica: enc.4 → enc.5 reserva 7 dias com aviso", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [1, 2, 3].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21"][i])
      ),
    });
    // deve 4 e 5 (4 exige prática → 5 só 7 dias depois)
    const r = plano(d, "2025-11-06");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p4 = r.passos.find((p) => p.numero === 4)!;
    const p5 = r.passos.find((p) => p.numero === 5)!;
    const diff =
      (new Date(p5.data).getTime() - new Date(p4.data).getTime()) / 86_400_000;
    expect(diff).toBeGreaterThanOrEqual(7);
    expect(p5.aviso).toMatch(/prática/);
  });

  it("exige_tarefa: enc.1 → enc.2 deixa só 2 dias", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    const r = plano(d, "2025-11-05");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p1 = r.passos.find((p) => p.numero === 1)!;
    const p2 = r.passos.find((p) => p.numero === 2)!;
    const diff =
      (new Date(p2.data).getTime() - new Date(p1.data).getTime()) / 86_400_000;
    expect(diff).toBe(2);
  });

  it("não agenda dentro do recesso — empurra pro fim", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: Array.from({ length: 11 }, (_, i) =>
        encRealizado(i + 1, CICLO_16.filter((e) => e.tipo === "encontro")[i].data!)
      ),
    });
    // deve o 12 (oficial 2025-12-23). hoje 2025-12-24 → amanhã cai no recesso
    const r = plano(d, "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.data >= "2026-01-05").toBe(true);
  });

  it("dataRecuperacao = data planejada do último passo devido", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-07")],
    });
    const r = plano(d, "2025-10-15"); // deve só o 2
    if (!r.aplicavel) throw new Error("não aplicável");
    const ultimo = r.passos.filter((p) => p.acao !== "travado").at(-1)!;
    expect(r.dataRecuperacao).toBe(ultimo.data);
  });

  it("travado já-vencido conta pro 'em dia' — recuperação na data dele", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encAgendado(2, "2025-10-25"), // oficial 10-14 vencida, marcado 25/10
      ],
    });
    const r = plano(d, "2025-10-20");
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.passos.filter((p) => p.acao !== "travado")).toEqual([]);
    expect(r.dataRecuperacao).toBe("2025-10-25");
  });
});

describe("montarPlanoEmDia — encerramento e pré-condições", () => {
  const COM_FECHAMENTO = [
    ...CICLO_16,
    {
      id: "ev-fim",
      cronograma_id: "cron-t1",
      tipo: "evento_encerramento" as const,
      numero: null,
      data: "2026-01-22",
      data_fim: null,
      status: "pendente" as const,
      observacao: null,
      ordem: 170,
      titulo: "Encerramento",
      fase: null,
      instrumentos: [],
    },
  ];

  it("plano que não fecha antes do encerramento avisa e zera dataRecuperacao", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    const r = montarPlanoEmDia({
      dupla: d,
      eventos: COM_FECHAMENTO,
      hoje: dt("2026-01-15"), // deve TODOS os 16 — impossível até 22/01
    });
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.dataRecuperacao).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/depois do encerramento/);
  });

  it("enc.12 carrega pré-condição da Roda da Vida", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: Array.from({ length: 10 }, (_, i) =>
        encRealizado(i + 1, CICLO_16.filter((e) => e.tipo === "encontro")[i].data!)
      ),
    });
    const r = plano(d, "2025-12-24"); // deve 11 e 12 (recesso só empurra a data)
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.precondicao).toMatch(/Roda da Vida/);
  });

  it("marcos: enc.1, 9 e 16 marcados", () => {
    const d = mkDupla({ iniciada_em: "2025-10-01", encontros: [] });
    const r = plano(d, "2026-01-20"); // todos os 16 devidos
    if (!r.aplicavel) throw new Error("não aplicável");
    const marcos = r.passos.filter((p) => p.marco).map((p) => p.numero);
    expect(marcos).toEqual([1, 9, 16]);
  });
});

describe("montarPlanoEmDia — âncora do último encontro (review)", () => {
  it("realizado ontem com exige pratica empurra o próximo passo 7d", () => {
    // enc.4 (pratica) feito 11-04; hoje 11-05 — o 5º NÃO pode ser amanhã
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [1, 2, 3].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21"][i])
      ).concat([encRealizado(4, "2025-11-04")]),
    });
    const r = plano(d, "2025-11-05");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p5 = r.passos.find((p) => p.numero === 5)!;
    expect(p5.data).toBe("2025-11-11"); // 04 + 7d, não hoje+1
  });

  it("limbo de ontem também ancora o gap conservadoramente", () => {
    // enc.4 agendado ontem sem registro: pode ter acontecido — mesmo piso
    const limbo = encAgendado(4, "2025-11-04");
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [1, 2, 3].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21"][i])
      ).concat([limbo]),
    });
    const r = plano(d, "2025-11-05");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p5 = r.passos.find((p) => p.numero === 5)!;
    expect(p5.data).toBe("2025-11-11");
  });
});

describe("montarPlanoEmDia — piso running-max (review)", () => {
  it("travado fora de ordem não regride a âncora do gap", () => {
    // travado 9 (sem exige, gap 2d) datado logo após hoje, enquanto o
    // devido 8 (prática, gap 7d) só cabe em janeiro — se o 10º herdar a
    // âncora regrida sai 1 dia depois do 8º e quebra o piso mínimo
    const travado9 = encAgendado(9, "2025-12-10");
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [travado9],
    });
    const r = plano(d, "2025-12-09"); // devidos: 1-8 e 10 (oficial 12-09)
    if (!r.aplicavel) throw new Error("não aplicável");
    const p8 = r.passos.find((p) => p.numero === 8)!;
    const p10 = r.passos.find((p) => p.numero === 10)!;
    expect(p8.data).toBe("2026-01-26");
    // piso = max(8º+7d=02-02, travado9+2d=12-12) → 02-02; com a âncora
    // regrida pelo travado saía 01-27 (1 dia depois do 8º, quebra o piso)
    expect(p10.data).toBe("2026-02-02");
    expect(r.avisos.join(" ")).toMatch(/antes da data sugerida/);
  });
});

describe("montarPlanoEmDia — gates de escopo (review)", () => {
  it("dupla não ativa retorna não se aplica", () => {
    const d = mkDupla({ status: "pausada", encontros: [] });
    const r = plano(d, "2025-11-20");
    expect(r).toEqual({ aplicavel: false, motivo: expect.any(String) });
  });

  it("agendado sem data ('a combinar') vencido vira remarcar na mesma row", () => {
    const semData = mkEncontro(5, { status: "agendado", data_hora: null });
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [1, 2, 3, 4].map((n, i) =>
        encRealizado(n, ["2025-10-07", "2025-10-14", "2025-10-21", "2025-10-28"][i])
      ).concat([semData]),
    });
    const r = plano(d, "2025-11-20");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p5 = r.passos.find((p) => p.numero === 5)!;
    expect(p5.acao).toBe("remarcar");
    expect(p5.encontroId).toBe(semData.id);
  });
});
