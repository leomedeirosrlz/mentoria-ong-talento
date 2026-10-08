// REALIZA-30 (migration 0062): o cronograma oficial ganhou seções além dos
// encontros — etapas de preparação (datadas ou só "Concluída"), recesso,
// encerramento e observações operacionais — e a T2 tem semanas com DOIS
// encontros oficiais (terça + quinta). Estes testes fixam: a ordenação por
// `ordem` (não por data), o denominador só-`encontro`, o âncora da semana
// pelo menor nº e os guards de `data` null.
import { describe, expect, it } from "vitest";
import {
  alvoAgendamento,
  duplasSemEncontroDoNumero,
  encontrosDaSemana,
  encontroEsperado,
  eventoDaSemana,
  eventosDoCronograma,
  inicioDefaultDupla,
  resumoSemanaDe,
  saudadeDaDupla,
  totalEncontros,
} from "@/lib/ciclo";
import type { CicloEvento } from "@/lib/types";
import {
  CRON_T1,
  dt,
  encRealizado,
  mkDupla,
  mkEvento,
} from "./helpers";

/** Etapa de preparação — por padrão "concluída" (a ONG parceira entrega
 *  triagem/matching já feito, sem data — `data: null` vem por `over`). */
const mkEtapa = (
  titulo: string,
  ordem: number,
  over: Partial<CicloEvento> = {}
): CicloEvento =>
  mkEvento(0, "2025-08-04", {
    id: `etapa-${ordem}`,
    tipo: "etapa_preparacao",
    numero: null,
    ordem,
    titulo,
    fase: null,
    status: "concluida",
    ...over,
  });

describe("eventosDoCronograma — a sequência do PDF é por `ordem`, não por data", () => {
  it("etapa concluída sem data fica no lugar dela, não depois do encerramento", () => {
    const eventos: CicloEvento[] = [
      mkEvento(1, "2025-10-07", { ordem: 30 }),
      mkEtapa("Inscrições", 10, { data: "2025-08-04", data_fim: "2025-08-22" }),
      mkEtapa("Triagem e matching", 20, { data: null }), // concluída, sem data
      mkEvento(2, "2025-10-14", { ordem: 40 }),
      mkEvento(0, "2026-06-15", {
        id: "encerramento",
        tipo: "evento_encerramento",
        numero: null,
        ordem: 50,
        titulo: "Evento de encerramento",
      }),
    ];
    const ordenados = eventosDoCronograma(eventos, CRON_T1);
    expect(ordenados.map((e) => e.ordem)).toEqual([10, 20, 30, 40, 50]);
    // `data nulls last` jogaria a triagem pro fim da lista — o PDF manda antes
    expect(ordenados[1].data).toBeNull();
    expect(ordenados[1].status).toBe("concluida");
  });
});

describe("semana com dois encontros oficiais — quinta dupla da T2", () => {
  // semana calendário 03/11–09/11/2025: terça 04/11 (enc 5) + quinta 06/11 (enc 6)
  const SEMANA_DUPLA: CicloEvento[] = [
    mkEvento(5, "2025-11-04", { observacao: "Semana de encontro duplo" }),
    mkEvento(6, "2025-11-06", { observacao: "Encontro duplo" }),
  ];

  it("encontrosDaSemana devolve os dois, em ordem de número", () => {
    expect(
      encontrosDaSemana(SEMANA_DUPLA, dt("2025-11-05")).map((e) => e.numero)
    ).toEqual([5, 6]);
  });

  it("o âncora é o MENOR numero — a regra é nº, não a coincidência data-asc", () => {
    // quinta declarada com nº menor que a terça → âncora passa pra quinta
    const invertido: CicloEvento[] = [
      mkEvento(6, "2025-11-04"),
      mkEvento(5, "2025-11-06"),
    ];
    expect(eventoDaSemana(invertido, dt("2025-11-05"))?.numero).toBe(5);
    expect(eventoDaSemana(SEMANA_DUPLA, dt("2025-11-05"))?.numero).toBe(5);
  });

  it("a quinta segue 'da semana' depois que a terça passou (janela de registro)", () => {
    // sexta 07/11 ainda lê como a semana dos encontros 5 e 6
    expect(eventoDaSemana(SEMANA_DUPLA, dt("2025-11-07"))?.numero).toBe(5);
    expect(encontrosDaSemana(SEMANA_DUPLA, dt("2025-11-07"))).toHaveLength(2);
  });

  it("encontro oficial de quinta também ancora a semana sozinho", () => {
    const eventos: CicloEvento[] = [mkEvento(3, "2025-11-06")];
    expect(eventoDaSemana(eventos, dt("2025-11-05"))?.data).toBe("2025-11-06");
  });

  it("formação/etapa/encerramento na mesma semana não viram oficial", () => {
    const eventos: CicloEvento[] = [
      mkEvento(5, "2025-11-04"),
      mkEvento(0, "2025-11-05", {
        id: "f",
        tipo: "formacao",
        numero: null,
        ordem: 55,
        titulo: "Formação",
      }),
      mkEtapa("Triagem", 1, { data: null }),
    ];
    expect(
      encontrosDaSemana(eventos, dt("2025-11-05")).map((e) => e.numero)
    ).toEqual([5]);
  });

  it("resumoSemanaDe mede reposição pela semana calendário da data oficial", () => {
    // dupla pulou a terça e fez o encontro 6 na quinta — no resumo do 5º ela
    // SE encontrou na semana: reposição, não "sem encontro"
    const d = mkDupla({ encontros: [encRealizado(6, "2025-11-06")] });
    const r5 = resumoSemanaDe([d], SEMANA_DUPLA[0]);
    expect(r5?.realizaram).toBe(0);
    expect(r5?.reposicao).toBe(1);
    // no resumo do 6º, realizou
    expect(resumoSemanaDe([d], SEMANA_DUPLA[1])?.realizaram).toBe(1);
  });
});

describe("denominador do ciclo — só tipo 'encontro' conta", () => {
  const CALENDARIO_CHEIO: CicloEvento[] = [
    mkEtapa("Inscrições", 5, { data: "2025-08-04" }),
    mkEtapa("Triagem e matching", 15, { data: null }),
    mkEvento(1, "2025-10-07", { ordem: 20 }),
    mkEvento(2, "2025-10-14", { ordem: 30 }),
    mkEvento(0, "2025-10-09", {
      id: "form",
      tipo: "formacao",
      numero: null,
      ordem: 25,
      titulo: "Formação",
    }),
    mkEvento(0, "2025-10-10", {
      id: "fim",
      tipo: "evento_encerramento",
      numero: null,
      ordem: 99,
      titulo: "Evento de encerramento",
    }),
  ];

  it("etapas, formação e encerramento datados não inflam 'esperado'", () => {
    // qui 09/10: só o encontro 1 venceu — formacao/encerramento/etapas passadas
    // não são encontro
    const s = saudadeDaDupla(mkDupla(), CALENDARIO_CHEIO, dt("2025-10-09"));
    expect(s.esperado).toBe(1);
    expect(encontroEsperado(CALENDARIO_CHEIO, dt("2025-10-09"))).toBe(1);
    expect(totalEncontros(CALENDARIO_CHEIO)).toBe(2); // só os dois 'encontro'
  });

  it("dupla da semana dupla: dois oficiais no mesmo seg–dom contam 2 esperados", () => {
    const eventos: CicloEvento[] = [
      mkEvento(5, "2025-11-04"),
      mkEvento(6, "2025-11-06"),
    ];
    // sex 07/11: ambos já passaram — a semana dupla pesa 2 no denominador
    const s = saudadeDaDupla(mkDupla(), eventos, dt("2025-11-07"));
    expect(s.esperado).toBe(2);
    // fez os dois na semana (ter e qui) → sem atraso
    const ok = saudadeDaDupla(
      mkDupla({
        encontros: [
          encRealizado(5, "2025-11-04"),
          encRealizado(6, "2025-11-06"),
        ],
      }),
      eventos,
      dt("2025-11-07")
    );
    expect(ok.esperado).toBe(2);
    expect(ok.feitos).toBe(2);
  });
});

describe("alvoAgendamento — a data sugerida é a oficial como ela é", () => {
  it("oficial de quinta sugere quinta, não a terça da semana", () => {
    const eventos: CicloEvento[] = [
      mkEvento(1, "2025-11-04"),
      mkEvento(2, "2025-11-06"), // quinta da semana dupla
      mkEvento(3, "2025-11-11"),
    ];
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-11-04")] });
    const alvo = alvoAgendamento(dupla, eventos, dt("2025-11-05"));
    expect(alvo.proximoNumero).toBe(2);
    expect(alvo.sugeridoProximo).toBe("2025-11-06");
  });
});

describe("data null — guards do modelo 0062", () => {
  it("eventoDaSemana e inicioDefaultDupla ignoram eventos sem data", () => {
    const eventos: CicloEvento[] = [
      mkEtapa("Triagem", 5, { data: null }),
      mkEvento(1, "2025-10-07", { ordem: 10 }),
    ];
    expect(eventoDaSemana(eventos, dt("2025-10-08"))?.numero).toBe(1);
    expect(inicioDefaultDupla(eventos)).toBe("2025-09-30");
  });

  it("resumoSemanaDe de evento sem data e sem janela explícita é null", () => {
    // encontro com numero mas sem data — não há semana oficial pra derivar
    const evSemData = mkEtapa("Triagem", 10, { data: null, numero: 5 });
    expect(resumoSemanaDe([mkDupla()], evSemData)).toBeNull();
    // com a janela explícita a medida segue possível — o caller dita o recorte
    const r = resumoSemanaDe([mkDupla()], evSemData, {
      seg: "2025-10-06",
      dom: "2025-10-12",
    });
    expect(r?.total).toBe(1);
  });

  it("duplasSemEncontroDoNumero sem data oficial não gera coorte", () => {
    // sem `data` não há "janela alcançou a data oficial" pra comparar iniciada_em
    expect(
      duplasSemEncontroDoNumero(
        [mkDupla()],
        mkEtapa("Triagem", 10, { data: null, numero: 1 })
      )
    ).toEqual([]);
  });
});
