import { describe, expect, it } from "vitest";
import {
  linhasEncerramentoDosPares,
  paresEncerramento,
  resumoAderencia,
  resumoEncerramento,
} from "@/lib/relatorios/operacional";
import { linhasAderencia, linhasEncerramento } from "@/lib/relatorios/dados";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encerramento,
  Encontro,
  MentoradoPar,
  Profile,
} from "@/lib/types";

// Derivações das duas seções acionáveis do hub operacional (REALIZA-389):
// o resumo e a fila leem a MESMA fonte do CSV — a paridade com
// linhasAderencia/linhasEncerramento é testada, não assumida.
//
// Âncora: quarta 07/10/2026 meio-dia em SP. Calendário C1 com encontros
// 6 (22/09), 7 (29/09) e 8 (06/10) já devidos → esperado = 3.
const HOJE = new Date("2026-10-07T12:00:00-03:00");

function mkProfile(nome: string): Profile {
  return {
    id: `p-${nome}`,
    user_id: null,
    nome,
    email: `${nome}@x.test`,
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
  };
}

function mkMentorado(nome: string): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social: null,
    avatar_path: null,
    whatsapp: null,
    email: null,
    ong_origem: null,
    cidade: null,
    uf: null,
    interesses: [],
    disponibilidade: null,
    situacao: "ativo",
  };
}

// created_at alimenta diasAtrasoRegistro (o atraso médio do CSV) — um
// registro sem data faria a média sair NaN na fixture
const COM_REGISTRO = {
  id: "r1",
  created_at: "2026-10-07T12:00:00Z",
} as Encontro["registro"];
const reg = (over: object): Encontro["registro"] =>
  ({
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    created_at: "2026-10-07T12:00:00Z",
    ...over,
  }) as Encontro["registro"];

function mkEncontro(over: Partial<Encontro>): Encontro {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    dupla_id: "d1",
    numero: 1,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d1",
    turma: "T1",
    cronograma_id: "c1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile("André Lima"),
    mentorado: mkMentorado("Ana Souza"),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

function mkEvento(numero: number, data: string, cronogramaId = "c1"): CicloEvento {
  return {
    id: `ev-${cronogramaId}-${numero}`,
    cronograma_id: cronogramaId,
    tipo: "encontro",
    numero,
    data,
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: numero,
    titulo: `Encontro ${numero}`,
    fase: null,
    instrumentos: [],
  };
}

const CRONS: Cronograma[] = [
  {
    id: "c1",
    nome: "Ciclo T1",
    turma: "T1",
    trilha: "dpp",
    inicio_em: "2026-09-01",
    fim_em: "2027-06-30",
    encontros_esperados: 16,
    status: "ativo",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const EVENTOS = [
  mkEvento(6, "2026-09-22"),
  mkEvento(7, "2026-09-29"),
  mkEvento(8, "2026-10-06"),
  mkEvento(9, "2026-10-13"),
];

const encRealizado = (
  duplaId: string,
  numero: number,
  dia: string,
  registro: Encontro["registro"] = COM_REGISTRO
): Encontro =>
  mkEncontro({
    dupla_id: duplaId,
    numero,
    status: "realizado",
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    registro,
  });

// os 3 devidos feitos e com registro — em dia, fora da fila
const dOk = mkDupla({
  id: "dOk",
  mentor: mkProfile("Bruno Paz"),
  mentorado: mkMentorado("Bianca Reis"),
  encontros: [
    encRealizado("dOk", 6, "2026-09-22"),
    encRealizado("dOk", 7, "2026-09-29"),
    encRealizado("dOk", 8, "2026-10-06"),
  ],
});
// 2 de 3: 1 atrasado → atenção; um realizado sem registro (>24h) também acende
const dAtencao = mkDupla({
  id: "dAtencao",
  mentor: mkProfile("Caio Melo"),
  mentorado: mkMentorado("Clara Dias"),
  encontros: [
    encRealizado("dAtencao", 6, "2026-09-22"),
    encRealizado("dAtencao", 7, "2026-09-29", null),
  ],
});
// 0 de 3: 3 atrasados → risco
const dRisco = mkDupla({
  id: "dRisco",
  mentor: mkProfile("Davi Rocha"),
  mentorado: mkMentorado("Dora Pinto"),
});
// em dia mas com pedido de apoio do mentor → topo da fila, semáforo ok
const dApoio = mkDupla({
  id: "dApoio",
  mentor: mkProfile("Éder Sá"),
  mentorado: mkMentorado("Elisa Nunes"),
  encontros: [
    encRealizado("dApoio", 6, "2026-09-22"),
    encRealizado("dApoio", 7, "2026-09-29"),
    encRealizado("dApoio", 8, "2026-10-06", reg({ precisa_apoio: true })),
  ],
});
const dPausada = mkDupla({ id: "dPausada", status: "pausada" });
const dFechada = mkDupla({ id: "dFechada", status: "concluida" });

const DUPLAS = [dOk, dAtencao, dRisco, dApoio, dPausada, dFechada];

describe("resumoAderencia — régua agregada", () => {
  const resumo = resumoAderencia(DUPLAS, EVENTOS, CRONS, HOJE);

  it("só dupla ativa entra no denominador do calendário", () => {
    // 4 ativas × 3 devidos; pausada e concluída fora da cobrança
    expect(resumo.esperados).toBe(12);
    expect(resumo.realizadosNoPrazo).toBe(8);
    expect(resumo.emAtraso).toBe(4);
    expect(resumo.atrasDoCalendario).toBe(2);
    expect(resumo.adiantados).toBe(0);
  });

  it("conta registro pendente só nas ativas", () => {
    expect(resumo.registrosPendentes).toBe(1); // dAtencao
  });

  it("fila = ativas com sinal ou apoio, apoio primeiro", () => {
    expect(resumo.fila.map((i) => i.dupla.id)).toEqual([
      "dApoio",
      "dRisco",
      "dAtencao",
    ]);
  });

  it("demais = o resto do recorte (em dia + fora da régua), por nome", () => {
    // "André Lima" (pausada e concluída, mesma mentor — ordem de entrada no
    // empate) antes de "Bruno Paz"
    expect(resumo.demais.map((i) => i.dupla.id)).toEqual([
      "dPausada",
      "dFechada",
      "dOk",
    ]);
  });

  it("itens mantêm a ordem do recorte — paridade literal com o CSV", () => {
    expect(resumo.itens.map((i) => i.dupla.id)).toEqual(
      DUPLAS.map((d) => d.id)
    );
    expect(resumo.itens.map((i) => i.linha)).toEqual(
      linhasAderencia(DUPLAS, EVENTOS, CRONS, HOJE)
    );
  });

  it("adiantados somam o que passou do devido", () => {
    // dupla com 1 realizada "extra" (reposição adiantada): esperado 3, fez 4
    const dExtra = mkDupla({
      id: "dExtra",
      encontros: [
        encRealizado("dExtra", 6, "2026-09-22"),
        encRealizado("dExtra", 7, "2026-09-29"),
        encRealizado("dExtra", 8, "2026-10-06"),
        encRealizado("dExtra", 9, "2026-10-07"),
      ],
    });
    const r = resumoAderencia([dExtra], EVENTOS, CRONS, HOJE);
    expect(r.esperados).toBe(3);
    expect(r.realizadosNoPrazo).toBe(3);
    expect(r.adiantados).toBe(1);
    expect(r.emAtraso).toBe(0);
  });

  it("atraso médio pondera pelos registros de cada dupla", () => {
    const atrasado = (duplaId: string, numero: number, dias: number) => {
      const feito = "2026-09-22";
      const gravado = new Date(
        new Date(`${feito}T22:00:00Z`).getTime() + dias * 86400000
      ).toISOString();
      return encRealizado(
        duplaId,
        numero,
        feito,
        reg({ created_at: gravado })
      );
    };
    // dX: 1 registro com 4d de atraso; dY: 2 registros com 1d
    const dX = mkDupla({
      id: "dX",
      encontros: [atrasado("dX", 6, 4)],
    });
    const dY = mkDupla({
      id: "dY",
      encontros: [atrasado("dY", 6, 1), atrasado("dY", 7, 1)],
    });
    const r = resumoAderencia([dX, dY], EVENTOS, CRONS, HOJE);
    // (4×1 + 1×2) / 3 = 2
    expect(r.atrasoMedioRegistro).toBeCloseTo(2);
    // sem registro nenhum → null (o card cai no "—")
    expect(
      resumoAderencia([dRisco], EVENTOS, CRONS, HOJE).atrasoMedioRegistro
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------

function mkEncerramento(over: Partial<Encerramento>): Encerramento {
  return {
    id: `enc-${over.dupla_id ?? "x"}`,
    dupla_id: "d1",
    tipo: "pendente",
    checklist: {},
    resumo_jornada: null,
    decidido_por: null,
    created_at: "2026-09-15T12:00:00Z",
    ...over,
  };
}

const CHECKLIST_COMPLETA = {
  feedback_final: true,
  feedback_mutuo: true,
  revisao_pdm: true,
  avaliacao_360_enviada: true,
};

const dE1 = mkDupla({ id: "dE1", status: "concluida" });
const dE2 = mkDupla({ id: "dE2", turma: "T2", cronograma_id: "c2" });
const dE3 = mkDupla({ id: "dE3", status: "concluida" });
const dE4 = mkDupla({ id: "dE4", status: "encerrada", encerrada_em: "2026-09-22" });

const e1 = mkEncerramento({
  id: "e1",
  dupla_id: "dE1",
  checklist: { feedback_final: true, revisao_pdm: true },
  created_at: "2026-09-15T12:00:00Z", // 22 dias aberto
});
const e2 = mkEncerramento({
  id: "e2",
  dupla_id: "dE2",
  checklist: {},
  created_at: "2026-10-05T12:00:00Z", // 2 dias
});
const e3 = mkEncerramento({
  id: "e3",
  dupla_id: "dE3",
  tipo: "concluida",
  checklist: CHECKLIST_COMPLETA,
  resumo_jornada: "Jornada completa.",
  decidido_por: "p-coord",
  decidido: { nome: "Clara Costa" },
  created_at: "2026-09-01T12:00:00Z",
});
const e4 = mkEncerramento({
  id: "e4",
  dupla_id: "dE4",
  tipo: "encerrada",
  checklist: { feedback_final: true },
  decidido_por: "p-coord",
  created_at: "2026-09-20T12:00:00Z",
});
const eOrfao = mkEncerramento({
  id: "eOrfao",
  dupla_id: "d-ghost",
  created_at: "2026-10-01T12:00:00Z", // 6 dias
});

const ENCS = [e1, e2, e3, e4, eOrfao];
const DUPLAS_E = [dE1, dE2, dE3, dE4];

describe("paresEncerramento — recorte", () => {
  const CRONS_E = [
    { id: "c1", turma: "T1" },
    { id: "c2", turma: "T2" },
  ];

  it("sem recorte mantém todos — inclusive o órfão de dupla", () => {
    const pares = paresEncerramento(ENCS, DUPLAS_E, {}, CRONS_E);
    expect(pares.map((p) => p.enc.id)).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
      "eOrfao",
    ]);
    expect(pares.find((p) => p.enc.id === "eOrfao")?.dupla).toBeNull();
  });

  it("?turma= filtra pela turma viva da dupla e solta o órfão", () => {
    const pares = paresEncerramento(
      ENCS,
      DUPLAS_E,
      { turma: "T1" },
      CRONS_E
    );
    // dE1/dE3/dE4 são T1 (cronograma c1); dE2 é T2; órfão cai com recorte
    expect(pares.map((p) => p.enc.id)).toEqual(["e1", "e3", "e4"]);
  });

  it("?cronograma= casa o cronograma da dupla", () => {
    const pares = paresEncerramento(
      ENCS,
      DUPLAS_E,
      { cronogramaId: "c2" },
      CRONS_E
    );
    expect(pares.map((p) => p.enc.id)).toEqual(["e2"]);
  });
});

describe("resumoEncerramento", () => {
  const pares = paresEncerramento(ENCS, DUPLAS_E, {}, [
    { id: "c1", turma: "T1" },
    { id: "c2", turma: "T2" },
  ]);
  const resumo = resumoEncerramento(pares, HOJE);

  it("pendentes mais antigos primeiro; decididos mais recentes primeiro", () => {
    expect(resumo.pendentes.map((i) => i.enc.id)).toEqual([
      "e1", // 22 dias
      "eOrfao", // 6 dias
      "e2", // 2 dias
    ]);
    expect(resumo.decididos.map((i) => i.enc.id)).toEqual(["e4", "e3"]);
    expect(resumo.maisAntigoDias).toBe(22);
  });

  it("conta concluída/encerrada separadas do pendente", () => {
    expect(resumo.total).toBe(5);
    expect(resumo.concluidas).toBe(1);
    expect(resumo.encerradas).toBe(1);
  });

  it("checklist do item conta feitos/faltantes na ordem canônica", () => {
    const i1 = resumo.pendentes.find((i) => i.enc.id === "e1")!;
    expect(i1.feitos).toBe(2);
    expect(i1.total).toBe(4);
    expect(i1.faltantes).toEqual(["feedback_mutuo", "avaliacao_360_enviada"]);
    expect(i1.diasAberto).toBe(22);
  });

  it("faltantes agrega o que falta nos pendentes, mais frequente primeiro", () => {
    // e1: mutuo+360 · e2: os 4 · órfão: os 4
    expect(resumo.faltantes).toEqual([
      { key: "feedback_mutuo", n: 3 },
      { key: "avaliacao_360_enviada", n: 3 },
      { key: "feedback_final", n: 2 },
      { key: "revisao_pdm", n: 2 },
    ]);
  });

  it("sem pendente: maisAntigoDias null e faltantes vazio", () => {
    const r = resumoEncerramento(
      [
        { enc: e3, dupla: dE3 },
        { enc: e4, dupla: dE4 },
      ],
      HOJE
    );
    expect(r.pendentes).toEqual([]);
    expect(r.maisAntigoDias).toBeNull();
    expect(r.faltantes).toEqual([]);
  });
});

describe("linhasEncerramentoDosPares — paridade com o CSV", () => {
  it("produz as mesmas linhas de linhasEncerramento sobre os mesmos dados", () => {
    const crons = [
      { id: "c1", turma: "T1" },
      { id: "c2", turma: "T2" },
    ];
    const pares = paresEncerramento(ENCS, DUPLAS_E, {}, crons);
    const viaPares = linhasEncerramentoDosPares(pares);

    // o caminho do export: rows + mapa de duplas + linhasEncerramento
    const rows = ENCS.map((e) => ({
      dupla_id: e.dupla_id,
      tipo: e.tipo,
      checklist: e.checklist,
      resumo_jornada: e.resumo_jornada,
      created_at: e.created_at,
      decidido: e.decidido?.nome ?? "",
    }));
    const porId = new Map(
      DUPLAS_E.map((d) => [
        d.id,
        {
          id: d.id,
          turma: d.turma,
          cronograma_id: d.cronograma_id,
          mentor_id: d.mentor.id,
          mentorado_id: d.mentorado.id,
          mentor: { nome: d.mentor.nome },
          mentorado: { nome: d.mentorado.nome },
        },
      ])
    );
    const viaLinhas = linhasEncerramento(rows, porId, {}, crons);
    expect(viaPares).toEqual(viaLinhas);
    expect(viaPares[2].checklist).toBe("4 de 4");
    expect(viaPares[2].decidido_por).toBe("Clara Costa");
    expect(viaPares[2].resumo_jornada).toBe("sim");
  });
});
