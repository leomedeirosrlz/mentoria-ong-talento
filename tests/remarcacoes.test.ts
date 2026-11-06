import { describe, expect, it } from "vitest";
import { contagemRemarcacoes, remarcacoesDoMes } from "@/lib/remarcacoes";
import type { Encontro, EncontroRemarcacao } from "@/lib/types";
import { mkDupla, mkEncontro } from "./helpers";

let seq = 0;
/** Linha de histórico no formato do embed da DUPLA_SELECT (0153). */
function rem(
  enc: Encontro,
  dataAnterior: string,
  dataNova: string,
  createdAt: string,
  motivo: string | null = "Conflito de agenda"
): EncontroRemarcacao {
  return {
    id: `rem-${++seq}`,
    encontro_id: enc.id,
    dupla_id: enc.dupla_id,
    numero: enc.numero,
    data_anterior: dataAnterior,
    data_nova: dataNova,
    motivo,
    created_by: null,
    created_at: createdAt,
  };
}

describe("contagemRemarcacoes", () => {
  it("dupla sem encontros/remarcações → mapa vazio", () => {
    expect(contagemRemarcacoes(mkDupla()).size).toBe(0);
    expect(
      contagemRemarcacoes(mkDupla({ encontros: [mkEncontro(1), mkEncontro(2)] }))
        .size
    ).toBe(0);
  });

  it("conta por encontro e ignora os nunca remarcados", () => {
    const e1 = mkEncontro(1, { id: "e-1" });
    const e2 = mkEncontro(2, { id: "e-2" });
    e1.remarcacoes = [
      rem(e1, "2025-10-07T19:00:00-03:00", "2025-10-09T19:00:00-03:00", "2025-10-01T10:00:00-03:00"),
      rem(e1, "2025-10-09T19:00:00-03:00", "2025-10-07T19:00:00-03:00", "2025-10-03T18:00:00-03:00"),
    ];
    e2.remarcacoes = [
      rem(e2, "2025-10-14T19:00:00-03:00", "2025-10-15T20:00:00-03:00", "2025-10-10T09:00:00-03:00"),
    ];
    const contagem = contagemRemarcacoes(
      mkDupla({ encontros: [e1, e2, mkEncontro(3, { id: "e-3" })] })
    );
    expect(contagem.get("e-1")).toBe(2);
    expect(contagem.get("e-2")).toBe(1);
    expect(contagem.has("e-3")).toBe(false);
  });
});

describe("remarcacoesDoMes", () => {
  const e1 = mkEncontro(5, { id: "e-5" });
  e1.remarcacoes = [
    rem(e1, "2025-11-04T19:00:00-03:00", "2025-11-08T10:00:00-03:00", "2025-10-30T21:15:00-03:00"),
    rem(e1, "2025-11-08T10:00:00-03:00", "2025-11-04T19:00:00-03:00", "2025-11-02T18:40:00-03:00", "A prova foi adiada"),
  ];
  const e2 = mkEncontro(3, { id: "e-3", dupla_id: "d-2" });
  e2.remarcacoes = [
    // 31/out 22:30 em SP — ainda outubro apesar de ser 1º/nov em UTC
    rem(e2, "2025-11-18T19:00:00-03:00", "2025-11-20T19:30:00-03:00", "2025-11-01T01:30:00.000Z"),
  ];
  const duplas = [mkDupla({ id: "d-1", encontros: [e1] }), mkDupla({ id: "d-2", encontros: [e2] })];

  it("traz só o que foi remarcado no mês (fuso SP), achatado de todas as duplas", () => {
    const out = remarcacoesDoMes(duplas, 2025, 10);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.encontro.id).sort()).toEqual(["e-3", "e-5"]);
    // numero vem da row do encontro, não da linha de histórico
    expect(out.find((x) => x.encontro.id === "e-3")?.numero).toBe(3);
  });

  it("ordena por created_at e devolve o par de datas + motivo", () => {
    const out = remarcacoesDoMes(duplas, 2025, 11);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      numero: 5,
      data_anterior: "2025-11-08T10:00:00-03:00",
      data_nova: "2025-11-04T19:00:00-03:00",
      motivo: "A prova foi adiada",
    });
  });

  it("mês sem remarcação → []", () => {
    expect(remarcacoesDoMes(duplas, 2025, 12)).toEqual([]);
    expect(remarcacoesDoMes([], 2025, 10)).toEqual([]);
  });
});
