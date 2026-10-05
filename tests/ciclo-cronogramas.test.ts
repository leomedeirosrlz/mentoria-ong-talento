// Helpers de cronograma da 0061: recorte por cronograma da dupla, vigente,
// tetos e o isolamento entre duas turmas com calendários paralelos.
import { describe, expect, it } from "vitest";
import {
  alvoAgendamento,
  cronogramasOpcoes,
  cronogramaVigente,
  duplasSemEncontroDoNumero,
  eventosDoCronograma,
  maxNumeroEncontro,
  rotuloCronograma,
  saudadeDaDupla,
  textoResumoSemana,
  totalDaTrilha,
  resumoSemanaDe,
} from "@/lib/ciclo";
import {
  CICLO_16,
  CRON_T1,
  CRON_T2,
  dt,
  encRealizado,
  mkCronograma,
  mkDupla,
  mkEvento,
} from "./helpers";

// T2 = T1 inteiro deslocado 4 semanas — os mesmos números, outras datas. A
// identidade do oficial é (cronograma, nº): sem o recorte os dois se misturam.
const T2 = CICLO_16.map((e) => {
  const d = new Date(`${e.data}T12:00:00-03:00`);
  d.setDate(d.getDate() + 28);
  return {
    ...e,
    id: `t2-${e.id}`,
    cronograma_id: CRON_T2,
    data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  };
});
const TODOS = [...CICLO_16, ...T2];

describe("eventosDoCronograma", () => {
  it("recorta só os eventos do cronograma pedido", () => {
    const recorte = eventosDoCronograma(TODOS, CRON_T2);
    expect(recorte.length).toBe(CICLO_16.length);
    expect(recorte.every((e) => e.cronograma_id === CRON_T2)).toBe(true);
  });

  it("null/undefined devolve [] — trilha livre e legada não têm calendário", () => {
    expect(eventosDoCronograma(TODOS, null)).toEqual([]);
    expect(eventosDoCronograma(TODOS, undefined)).toEqual([]);
  });
});

describe("cronogramaVigente", () => {
  const t1 = mkCronograma({ id: CRON_T1, nome: "Terças", turma: "T1" });
  const t2 = mkCronograma({
    id: CRON_T2,
    nome: "Terças+Quintas",
    turma: "T2",
    inicio_em: "2025-11-01",
    fim_em: "2026-02-28",
  });

  it("dois ativos sobrepostos desempatam pelo início mais antigo", () => {
    expect(cronogramaVigente([t2, t1], dt("2025-11-15"))?.id).toBe(CRON_T1);
  });

  it("hoje antes de todos: aponta o próximo a começar", () => {
    const futuro = mkCronograma({ id: "cron-futuro", inicio_em: "2026-03-01", fim_em: "2026-06-30" });
    expect(cronogramaVigente([t2, futuro], dt("2025-10-20"))?.id).toBe(CRON_T2);
  });

  it("todos encerrados: cai no encerrado mais recente", () => {
    const encerrado = mkCronograma({ id: "cron-ant", status: "encerrado", inicio_em: "2024-01-01", fim_em: "2024-06-30" });
    const fechados = [encerrado, mkCronograma({ id: CRON_T1, status: "encerrado" })];
    expect(cronogramaVigente(fechados, dt("2025-10-15"))?.id).toBe(CRON_T1);
  });

  it("lista vazia → null", () => {
    expect(cronogramaVigente([])).toBeNull();
  });
});

describe("cronogramasOpcoes + rotuloCronograma", () => {
  it("ordena por turma e nome; rótulo é 'turma · nome'", () => {
    const b = mkCronograma({ id: "b", turma: "T2", nome: "Quintas" });
    const a = mkCronograma({ id: "a", turma: "T1", nome: "Terças" });
    expect(cronogramasOpcoes([b, a]).map((c) => c.id)).toEqual(["a", "b"]);
    expect(rotuloCronograma(a)).toBe("T1 · Terças");
  });
});

describe("maxNumeroEncontro + totalDaTrilha", () => {
  it("maxNumeroEncontro é o maior nº, não a soma das linhas dos cronogramas", () => {
    expect(maxNumeroEncontro(TODOS)).toBe(16);
    expect(maxNumeroEncontro([])).toBe(0);
  });

  it("totalDaTrilha mede o recorte da dupla; vazio cai no teto canônico", () => {
    const t2Curto = T2.filter((e) => e.tipo === "encontro").slice(0, 14);
    expect(totalDaTrilha("dpp", t2Curto)).toBe(14);
    expect(totalDaTrilha("dpp", [])).toBe(16);
    expect(totalDaTrilha("especialista", T2)).toBe(5);
  });
});

describe("isolamento entre cronogramas concorrentes", () => {
  it("saudadeDaDupla conta o esperado do calendário DA DUPLA, não a união", () => {
    // hoje: T1 já teve 5 encontros oficiais, T2 só 1 (deslocada 4 semanas).
    // A dupla da T2 não pode aparecer 4 atrasada por eventos que não são dela.
    const duplaT2 = mkDupla({ cronograma_id: CRON_T2, turma: "T2" });
    const saude = saudadeDaDupla(duplaT2, TODOS, dt("2025-11-11"));
    const esperadoT2 = T2.filter(
      (e) => e.tipo === "encontro" && e.data <= "2025-11-11"
    ).length;
    expect(saude.esperado).toBe(esperadoT2);
    expect(esperadoT2).toBeLessThan(5);
  });

  it("alvoAgendamento sugere a data do cronograma da dupla", () => {
    const duplaT2 = mkDupla({ cronograma_id: CRON_T2, turma: "T2" });
    const alvo = alvoAgendamento(duplaT2, TODOS, dt("2025-10-08"));
    // 1º encontro da T2 é ~4 semanas depois do da T1 (2025-11-04)
    expect(alvo.sugeridoProximo).toBe(
      T2.find((e) => e.tipo === "encontro" && e.numero === alvo.proximoNumero)?.data
    );
  });

  it("resumoSemanaDe conta só a coorte do cronograma do evento", () => {
    const dT1 = mkDupla({ id: "d-t1", encontros: [encRealizado(2, "2025-10-14")] });
    const dT2 = mkDupla({ id: "d-t2", cronograma_id: CRON_T2, turma: "T2" });
    // resumo do 2º da T1: a T2 nem entra no denominador
    const r = resumoSemanaDe([dT1, dT2], CICLO_16[1]);
    expect(r?.total).toBe(1);
    expect(r?.realizaram).toBe(1);
    // e o espelho: resumo do 2º da T2 (4 semanas depois) só enxerga a T2
    const rT2 = resumoSemanaDe([dT1, dT2], T2.find((e) => e.numero === 2)!);
    expect(rT2?.total).toBe(1);
    expect(rT2?.realizaram).toBe(0);
  });

  it("duplasSemEncontroDoNumero não puxa dupla de outra turma", () => {
    const dT1 = mkDupla({ id: "d-t1" });
    const dT2 = mkDupla({ id: "d-t2", cronograma_id: CRON_T2, turma: "T2" });
    const sem = duplasSemEncontroDoNumero([dT1, dT2], CICLO_16[1]);
    expect(sem.map((d) => d.id)).toEqual(["d-t1"]);
  });
});

describe("textoResumoSemana", () => {
  it("etiqueta do cronograma entra na primeira linha quando passada", () => {
    const d = mkDupla({ encontros: [encRealizado(2, "2025-10-14")] });
    const r = resumoSemanaDe([d], CICLO_16[1])!;
    const texto = textoResumoSemana(r, [], "T2 · Terças+Quintas");
    expect(texto.split("\n")[0]).toContain("T2 · Terças+Quintas");
    // sem etiqueta a linha não ganha nada
    expect(textoResumoSemana(r).split("\n")[0]).not.toContain("T2");
  });
});
