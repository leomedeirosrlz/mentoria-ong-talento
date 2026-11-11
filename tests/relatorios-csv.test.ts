import { describe, expect, it } from "vitest";
import {
  celula,
  csvDoc,
  dataHora,
  dia,
  duplaNoRecorte,
  filtraPorRecorte,
  nomeCsv,
  recorteDeParams,
  slugCsv,
} from "@/lib/relatorios/csv-core";
import {
  csvAderencia,
  csvAssinaturasPendentes,
  csvEncerramento,
  csvFormsTaxa,
  csvInteracoes,
  csvSolicitacoes,
  type LinhaAderencia,
  type LinhaAssinaturaPendente,
  type LinhaEncerramento,
  type LinhaFormsTaxa,
  type LinhaInteracao,
  type LinhaSolicitacao,
} from "@/lib/relatorios/csv";

// Geradores CSV dos 6 tipos novos (REALIZA-178): convenção BOM+`;`+aspas+
// CRLF, anti-fórmula no celula, datas dd/mm/aaaa no fuso do programa e a
// régua de recorte ?turma=/?cronograma= (turmaDaDupla vivo).

const linhas = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n");

describe("csv-core — convenção do documento", () => {
  it("csvDoc: BOM + CRLF + tudo entre aspas + linha final", () => {
    const csv = csvDoc(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const ls = linhas(csv);
    expect(ls).toHaveLength(3);
    expect(ls[0]).toBe('"a";"b"');
    expect(ls[1]).toBe('"1";"2"');
  });

  it("celula escapa aspas dobrando e protege fórmula", () => {
    expect(celula('disse "oi"')).toBe('"disse ""oi"""');
    expect(celula("=1+1")).toBe("\"'=1+1\"");
    expect(celula("\t@cmd")).toBe("\"'\t@cmd\"");
    expect(celula("-x")).toBe("\"'-x\"");
    expect(celula("+soma")).toBe("\"'+soma\"");
    expect(celula(null)).toBe('""');
  });

  it("nomeCsv é <tipo>-AAAA-MM-DD.csv", () => {
    expect(nomeCsv("aderencia")).toMatch(/^aderencia-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(slugCsv("Formulário Semanal!")).toBe("formulario-semanal");
  });
});

describe("csv-core — recorte ?turma=/?cronograma=", () => {
  const crons = [
    { id: "cr-t1", nome: "Ciclo T1", turma: "T1" },
    { id: "cr-t2", nome: "Ciclo T2", turma: "T2" },
  ];
  const duplas = [
    { id: "d1", turma: null, cronograma_id: "cr-t1" },
    { id: "d2", turma: "T1", cronograma_id: null },
    { id: "d3", turma: null, cronograma_id: "cr-t2" },
    { id: "d4", turma: null, cronograma_id: null },
  ];

  it("recorteDeParams lê turma e cronograma", () => {
    const r = recorteDeParams(
      new URLSearchParams("turma=T1&cronograma=cr-t1")
    );
    expect(r).toEqual({ turma: "T1", cronogramaId: "cr-t1" });
  });

  it("turma casa pelo rótulo vivo (cronograma tem prioridade ao selo)", () => {
    const out = filtraPorRecorte(duplas, { turma: "T1" }, crons);
    expect(out.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("cronograma casa o id cru", () => {
    const out = filtraPorRecorte(duplas, { cronogramaId: "cr-t2" }, crons);
    expect(out.map((d) => d.id)).toEqual(["d3"]);
  });

  it("sem recorte devolve tudo; recorte duplo intersecciona", () => {
    expect(filtraPorRecorte(duplas, {}, crons)).toHaveLength(4);
    const out = filtraPorRecorte(
      duplas,
      { turma: "T1", cronogramaId: "cr-t1" },
      crons
    );
    expect(out.map((d) => d.id)).toEqual(["d1"]);
  });

  it("duplaNoRecorte é a regra unitária por trás do filtro", () => {
    expect(
      duplaNoRecorte(duplas[0], { turma: "T1" }, crons)
    ).toBe(true);
    expect(
      duplaNoRecorte(duplas[2], { turma: "T1" }, crons)
    ).toBe(false);
  });
});

describe("csvAderencia", () => {
  const base: LinhaAderencia = {
    turma: "T1",
    cronograma: "Ciclo T1",
    trilha: "DPP",
    mentor: "Marcos",
    mentorado: "Ana",
    esperados: 6,
    realizados: 5,
    aderencia: 83,
    atrasoMedioRegistro: 1.5,
    avaliacaoMedia: 3.5,
    remarcacoes: 2,
    semaforo: "em atenção",
    motivos: "1 encontro atrasado | registro pendente",
  };

  it("header e colunas na ordem do spec", () => {
    const ls = linhas(csvAderencia([base]));
    expect(ls[0]).toBe(
      '"turma";"cronograma";"trilha";"mentor";"mentorado";"encontros_esperados";"encontros_realizados";"aderencia_pct";"atraso_medio_registro_dias";"avaliacao_media";"remarcacoes";"semaforo";"motivos"'
    );
    expect(ls[1]).toContain('"em atenção"');
    expect(ls[1]).toContain('"83%"');
    expect(ls[1]).toContain('"1,5"'); // decimal pt-BR
  });

  it("métricas null saem vazias (especialista sem régua)", () => {
    const ls = linhas(
      csvAderencia([
        { ...base, aderencia: null, atrasoMedioRegistro: null, avaliacaoMedia: null },
      ])
    );
    const c = ls[1].split(";");
    expect(c[7]).toBe('""');
    expect(c[8]).toBe('""');
    expect(c[9]).toBe('""');
  });

  it("motivos passa pelo anti-fórmula do celula", () => {
    const ls = linhas(csvAderencia([{ ...base, motivos: "=cmd()" }]));
    expect(ls[1]).toContain("\"'=cmd()\"");
  });
});

describe("csvAssinaturasPendentes", () => {
  it("1 linha por pendência com status pendente/expirado", () => {
    const rows: LinhaAssinaturaPendente[] = [
      {
        nome: "Ana",
        papel: "Mentorado",
        documento: "Autorização",
        status: "expirado",
        emitido_em: "2026-01-10T10:00:00Z",
        expira_em: "2026-02-01T00:00:00Z",
      },
      {
        nome: "Ricardo",
        papel: "Mentor DPP",
        documento: "Termo do mentor",
        status: "pendente",
        emitido_em: "2026-01-10T10:00:00Z",
        expira_em: "",
      },
    ];
    const ls = linhas(csvAssinaturasPendentes(rows));
    expect(ls[0]).toBe(
      '"nome";"papel";"documento";"status";"emitido_em";"expira_em"'
    );
    expect(ls[1]).toContain('"expirado"');
    // ordenação pt-BR por nome: Ana antes de Ricardo
    expect(ls[1]).toContain('"Ana"');
    // datas saem dd/mm/aaaa
    expect(ls[1]).toContain('"10/01/2026"');
  });
});

describe("csvInteracoes", () => {
  it("inclui vinculo_resposta e in_app como labels", () => {
    const rows: LinhaInteracao[] = [
      {
        dupla: "Marcos ↔ Ana",
        tipo: "vínculo de resposta",
        canal: "na plataforma",
        autor: "Clara",
        data: "2026-02-10T13:00:00Z",
        nota: "=planilha()",
      },
    ];
    const ls = linhas(csvInteracoes(rows));
    expect(ls[0]).toBe('"dupla";"tipo";"canal";"autor";"data";"nota"');
    expect(ls[1]).toContain('"vínculo de resposta"');
    expect(ls[1]).toContain('"na plataforma"');
    // nota livre protegida contra fórmula
    expect(ls[1]).toContain("\"'=planilha()\"");
  });
});

describe("csvSolicitacoes", () => {
  it("status_efetivo + latência em dias", () => {
    const rows: LinhaSolicitacao[] = [
      {
        mentorado: "Ana",
        demanda: "Inglês",
        origem: "jovem",
        status: "em negociação",
        criada_em: "2026-02-01T10:00:00Z",
        respondida_em: "2026-02-04T10:00:00Z",
        latencia: 3,
        especialista: "Paula",
      },
    ];
    const ls = linhas(csvSolicitacoes(rows));
    expect(ls[1]).toContain('"em negociação"');
    expect(ls[1]).toContain('"3"');
  });
});

describe("csvEncerramento", () => {
  it("checklist N de 4 + resumo sim/não", () => {
    const rows: LinhaEncerramento[] = [
      {
        mentor: "Marcos",
        mentorado: "Ana",
        tipo: "concluída",
        checklist: "4 de 4",
        decidido_por: "Clara",
        resumo_jornada: "sim",
        created_at: "2026-03-01T12:00:00Z",
      },
    ];
    const ls = linhas(csvEncerramento(rows));
    expect(ls[0]).toContain('"checklist"');
    expect(ls[1]).toContain('"4 de 4"');
    expect(ls[1]).toContain('"concluída"');
  });
});

describe("csvFormsTaxa", () => {
  const link = (extra: Partial<LinhaFormsTaxa>): LinhaFormsTaxa => ({
    formulario: "Ficha semanal",
    destinatario: "Marcos",
    papel: "Mentor DPP",
    dupla: "Marcos ↔ Ana",
    origem: "manual",
    emitido_em: "2026-02-01T10:00:00Z",
    respondido: "não",
    respostas: 0,
    respondido_em: null,
    ...extra,
  });

  it("link sem resposta sai respondido=não — a taxa é derivável", () => {
    const ls = linhas(csvFormsTaxa([link({})]));
    expect(ls[0]).toBe(
      '"formulario";"destinatario";"papel";"dupla";"origem";"emitido_em";"respondido";"respostas";"respondido_em"'
    );
    expect(ls[1]).toContain('"não"');
    expect(ls[1]).toContain('"0"');
  });

  it("multi_uso conta N respostas e mostra a última data", () => {
    const ls = linhas(
      csvFormsTaxa([
        link({
          respondido: "sim",
          respostas: 3,
          respondido_em: "2026-02-05T10:00:00Z",
        }),
      ])
    );
    expect(ls[1]).toContain('"sim"');
    expect(ls[1]).toContain('"3"');
  });
});

describe("datas no fuso do programa", () => {
  it("dataHora/dia formatam dd/mm/aaaa no TZ de SP", () => {
    expect(dia("2026-02-10T02:30:00Z")).toBe("09/02/2026"); // 23:30 SP do dia 9
    expect(dataHora("2026-02-10T13:00:00Z")).toBe("10/02/2026 10:00");
    expect(dia(null)).toBe("");
    expect(dataHora("lixo")).toBe("");
  });
});
