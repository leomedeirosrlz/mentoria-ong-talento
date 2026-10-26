import { describe, expect, it } from "vitest";
import { jornadaDaDupla, marcosEntre, passosDaTrilha } from "@/lib/ciclo";
import {
  datasOficiaisDe,
  encCorrenteDe,
  materialLiberadoParaJovem,
} from "@/lib/jornada";
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
        encRealizado(e.numero!, e.data!)
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

// REALIZA-160 — régua compartilhada do acervo progressivo
describe("encCorrenteDe — a âncora única", () => {
  it("maior realizado + 1, teto 16; agendado não conta", () => {
    expect(encCorrenteDe([])).toBe(1);
    expect(
      encCorrenteDe([encRealizado(4, "2025-10-01"), encAgendado(5, "2025-10-08")])
    ).toBe(5);
    expect(encCorrenteDe([encRealizado(16, "2025-10-01")])).toBe(16);
  });
});

// REALIZA-215 — a data oficial como rede de segurança: a régua avança
// pelo calendário da turma quando o registro atrasa mais de 7 dias
describe("encCorrenteDe — rede de segurança pela data oficial", () => {
  const HOJE = dt("2025-11-12"); // qua — o enc. 5 oficial (04/11) passou há 8 dias
  const OFICIAIS = [
    { numero: 1, data: "2025-10-07" },
    { numero: 2, data: "2025-10-14" },
    { numero: 3, data: "2025-10-21" },
    { numero: 4, data: "2025-10-28" }, // há 15 dias
    { numero: 5, data: "2025-11-04" }, // há 8 dias
    { numero: 6, data: "2025-11-11" }, // ontem — não passou de 7
    { numero: 7, data: "2025-12-01" }, // futuro
  ];

  it("só realizado conta quando não há datasOficiais", () => {
    expect(
      encCorrenteDe([encRealizado(3, "2025-10-21")], { hoje: HOJE, ativa: true })
    ).toBe(4);
    expect(
      encCorrenteDe([], { datasOficiais: [], hoje: HOJE, ativa: true })
    ).toBe(1);
  });

  it("evento oficial passado há mais de 7 dias avança a régua sem realizado", () => {
    expect(
      encCorrenteDe([], { datasOficiais: OFICIAIS, hoje: HOJE, ativa: true })
    ).toBe(6); // 5 encontros oficiais vencidos com folga → corrente 6
  });

  it("ingresso tardio: conta só os encontros oficiais desde o início da dupla", () => {
    // a dupla começou em 25/10 — vencidos desde então: 28/10 e 04/11
    expect(
      encCorrenteDe([], {
        datasOficiais: OFICIAIS,
        hoje: HOJE,
        ativa: true,
        inicio: "2025-10-25",
      })
    ).toBe(3);
    // nasceu hoje: nada passou ainda — começa no 1º, sem pular instrumentos
    expect(
      encCorrenteDe([], {
        datasOficiais: OFICIAIS,
        hoje: HOJE,
        ativa: true,
        inicio: "2025-11-12T10:00:00-03:00",
      })
    ).toBe(1);
  });

  it("há 6 dias ainda não avança — a folga de uma semana não venceu", () => {
    expect(
      encCorrenteDe([], {
        datasOficiais: [{ numero: 5, data: "2025-11-06" }],
        hoje: HOJE,
        ativa: true,
      })
    ).toBe(1);
    // exatos 7 dias idem — a regra exige MAIS de 7
    expect(
      encCorrenteDe([], {
        datasOficiais: [{ numero: 5, data: "2025-11-05" }],
        hoje: HOJE,
        ativa: true,
      })
    ).toBe(1);
  });

  it("dupla pausada não avança pela data — o tempo dela está congelado", () => {
    expect(
      encCorrenteDe([], { datasOficiais: OFICIAIS, hoje: HOJE, ativa: false })
    ).toBe(1);
    // e sem o flag `ativa` o default é não aplicar a régua por data
    expect(encCorrenteDe([], { datasOficiais: OFICIAIS, hoje: HOJE })).toBe(1);
  });

  it("nunca regride: o realizado vence quando está à frente do calendário", () => {
    expect(
      encCorrenteDe([encRealizado(8, "2025-11-10")], {
        datasOficiais: OFICIAIS,
        hoje: HOJE,
        ativa: true,
      })
    ).toBe(9); // max(8+1, 5+1)
  });

  it("e o calendário destrava quando está à frente do realizado", () => {
    expect(
      encCorrenteDe([encRealizado(2, "2025-10-14")], {
        datasOficiais: OFICIAIS,
        hoje: HOJE,
        ativa: true,
      })
    ).toBe(6); // max(2+1, 5+1)
  });

  it("teto 16 mesmo com o cronograma inteiro vencido", () => {
    const cicloInteiro = CICLO_16.filter((e) => e.tipo === "encontro").map(
      (e) => ({ numero: e.numero!, data: e.data! })
    );
    expect(
      encCorrenteDe([], {
        datasOficiais: cicloInteiro,
        hoje: dt("2026-03-01"),
        ativa: true,
      })
    ).toBe(16);
  });
});

describe("datasOficiaisDe", () => {
  it("só encontro com nº e data — formação, marco e etapa sem data ficam fora", () => {
    expect(
      datasOficiaisDe([
        { numero: 1, data: "2025-10-07", tipo: "encontro" },
        { numero: null, data: "2025-10-22", tipo: "formacao" },
        { numero: null, data: null, tipo: "etapa_preparacao" },
        { numero: 16, data: "2026-01-20", tipo: "evento_encerramento" },
        { numero: 2, data: "2025-10-14", tipo: "encontro" },
      ])
    ).toEqual([
      { numero: 1, data: "2025-10-07" },
      { numero: 2, data: "2025-10-14" },
    ]);
  });
});

describe("materialLiberadoParaJovem — acervo progressivo", () => {
  const mat = (encontro_num: number | null) => ({ encontro_num });

  it("sem vínculo de encontro fica sempre disponível", () => {
    expect(materialLiberadoParaJovem(mat(null), 1)).toBe(true);
    expect(materialLiberadoParaJovem(mat(null), null)).toBe(true);
  });

  it("marcado libera quando a régua alcança o encontro", () => {
    expect(materialLiberadoParaJovem(mat(5), 4)).toBe(false);
    expect(materialLiberadoParaJovem(mat(5), 5)).toBe(true);
    expect(materialLiberadoParaJovem(mat(16), 5)).toBe(false);
    expect(materialLiberadoParaJovem(mat(16), 16)).toBe(true);
  });

  it("sem jornada em curso (null) libera tudo — não há cronograma a esperar", () => {
    expect(materialLiberadoParaJovem(mat(12), null)).toBe(true);
  });
});
