import { describe, expect, it } from "vitest";
import { jornadaDaDupla, marcosEntre, passosDaTrilha } from "@/lib/ciclo";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  ESP_5,
  mkDupla,
  mkEncontro,
} from "./helpers";

const PASSOS = passosDaTrilha("dpp", CICLO_16);
const HOJE = dt("2025-10-15"); // qua — semana do encontro 2

describe("marcosEntre", () => {
  it("trilha de 16: marcos em 1, 8 (metade), 13 (reta final) e 16 (completo)", () => {
    expect(marcosEntre(0, 1, 16)).toEqual(["primeiro"]);
    expect(marcosEntre(0, 8, 16)).toEqual(["primeiro", "metade"]);
    expect(marcosEntre(7, 9, 16)).toEqual(["metade"]);
    expect(marcosEntre(12, 14, 16)).toEqual(["reta_final"]);
    expect(marcosEntre(13, 16, 16)).toEqual(["completo"]);
    expect(marcosEntre(0, 16, 16)).toEqual([
      "primeiro",
      "metade",
      "reta_final",
      "completo",
    ]);
  });

  it("só o que é novo entre antes e depois — e nada quando não avança", () => {
    expect(marcosEntre(3, 3, 16)).toEqual([]);
    expect(marcosEntre(8, 5, 16)).toEqual([]);
  });

  it("trilha curta (5) não tem reta final — total−3 ≤ metade", () => {
    expect(marcosEntre(0, 5, 5)).toEqual(["primeiro", "metade", "completo"]);
    expect(marcosEntre(0, 2, 5)).toEqual(["primeiro"]);
  });
});

describe("jornadaDaDupla", () => {
  it("estados dos nós seguem a gramática: completo/pendente/limbo/agendado/nao_aconteceu/futuro", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07"), // realizado + registro
        encRealizado(2, "2025-10-14", null), // realizado sem registro
        encAgendado(3, "2025-10-10"), // passou e ninguém registrou → limbo
        encAgendado(4, "2025-10-28"), // futuro agendado
        mkEncontro(5, { status: "nao_aconteceu" }),
        mkEncontro(6, { status: "remarcado", data_hora: "2025-11-01T19:00:00-03:00" }),
      ],
    });
    const j = jornadaDaDupla(dupla, PASSOS, HOJE);
    expect(j.total).toBe(16);
    expect(j.nos.map((n) => n.estado).slice(0, 6)).toEqual([
      "realizado_completo",
      "pendente_registro",
      "limbo",
      "agendado",
      "nao_aconteceu",
      "agendado", // remarcado ainda por vir
    ]);
    expect(j.nos[10].estado).toBe("futuro"); // sem row
    expect(j.feitos).toBe(2);
    expect(j.comRegistro).toBe(1);
    expect(j.pendentesRegistro).toBe(2); // pendente_registro + limbo
    // "você está aqui" = primeiro passo não realizado — o limbo do nº 3
    expect(j.proximoNumero).toBe(3);
    expect(j.nos[0].marco).toBe("primeiro");
    expect(j.nos[2].marco).toBeNull(); // marco só depois de cruzado
    expect(j.faseAtual).toEqual({ indice: 1, total: 2, nome: "Fase 1" });
    expect(j.completa).toBe(false);
    expect(j.janelaCortada).toBe(false);
  });

  it("iniciada_em poda o início: posição renumera e janelaCortada acende", () => {
    const j = jornadaDaDupla(
      mkDupla({ iniciada_em: "2025-10-21" }),
      PASSOS,
      HOJE
    );
    expect(j.total).toBe(14); // encontros 3–16
    expect(j.nos[0].numero).toBe(3);
    expect(j.nos[0].posicao).toBe(1);
    expect(j.janelaCortada).toBe(true);
  });

  it("trilha completa: proximoNumero null e marco no último nó", () => {
    const dupla = mkDupla({
      encontros: CICLO_16.filter((e) => e.tipo === "encontro").map((e) =>
        encRealizado(e.numero!, e.data)
      ),
    });
    const j = jornadaDaDupla(dupla, PASSOS, dt("2026-02-01"));
    expect(j.completa).toBe(true);
    expect(j.proximoNumero).toBeNull();
    expect(j.nos[15].marco).toBe("completo");
    expect(j.nos[7].marco).toBe("metade");
    expect(j.nos[12].marco).toBe("reta_final");
  });

  it("dupla pausada congela o 'você está aqui' mas mantém o estado dos nós", () => {
    const dupla = mkDupla({
      status: "pausada",
      encontros: [encRealizado(1, "2025-10-07")],
    });
    const j = jornadaDaDupla(dupla, PASSOS, HOJE);
    expect(j.proximoNumero).toBeNull();
    expect(j.nos[0].estado).toBe("realizado_completo");
    expect(j.nos[0].marco).toBe("primeiro");
  });

  it("especialista: passos sem data — janela é o guia inteiro mesmo com iniciada_em", () => {
    const passos = passosDaTrilha("especialista", CICLO_16, ESP_5);
    const dupla = mkDupla({
      trilha: "especialista",
      iniciada_em: "2025-10-01",
      encontros: [encRealizado(1, "2025-10-05")],
    });
    const j = jornadaDaDupla(dupla, passos, HOJE);
    expect(j.total).toBe(5);
    expect(j.feitos).toBe(1);
    expect(j.proximoNumero).toBe(2);
    expect(j.faseAtual).toBeNull(); // passos da especialista não têm fase
  });
});
