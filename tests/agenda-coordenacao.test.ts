import { describe, expect, it } from "vitest";
import {
  dimensoesDoItem,
  itensDaSemanaPrograma,
  paraAcompanhar,
  resumosPorCronograma,
  sinteseMonitoramento,
  type ItemParaAcompanhar,
} from "@/lib/agenda-coordenacao";
import { LEMBRETE_INTERVALO_MS } from "@/lib/ciclo";
import type { Interacao } from "@/lib/interacoes";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encaminhamento,
  Encontro,
  MentoradoPar,
  Profile,
} from "@/lib/types";

// Âncora: quarta 07/10/2026, meio-dia em SP (TZ=America/Sao_Paulo no vitest)
// → semana corrente seg 05/10 → dom 11/10. AGORA_SEG é a segunda da mesma
// semana — antes da data oficial da terça, pra estados "em dia" existirem.
const AGORA = new Date("2026-10-07T12:00:00-03:00");
const AGORA_SEG = new Date("2026-10-05T12:00:00-03:00");

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

function mkMentorado(nome: string, nome_social: string | null = null): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social,
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

function mkEvento(
  numero: number | null,
  data: string | null,
  tipo: CicloEvento["tipo"] = "encontro",
  cronogramaId = "c1",
  over: Partial<CicloEvento> = {}
): CicloEvento {
  return {
    id: `ev-${cronogramaId}-${tipo}-${numero ?? data}`,
    cronograma_id: cronogramaId,
    tipo,
    numero,
    data,
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: numero ?? 90,
    titulo: numero != null ? `Encontro ${numero}` : "Evento",
    fase: null,
    instrumentos: [],
    ...over,
  };
}

function mkCronograma(over: Partial<Cronograma> = {}): Cronograma {
  return {
    id: "c1",
    nome: "Calendário oficial",
    turma: "T1",
    trilha: "dpp",
    inicio_em: "2026-09-01",
    fim_em: "2027-06-30",
    encontros_esperados: 16,
    status: "ativo",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const COM_REGISTRO = { id: "r1" } as Encontro["registro"];

// ---- calendários das turmas ----
// C1 (T1): encontros às terças — 6 em 22/09, 7 em 29/09, 8 em 06/10
// (semana corrente), 9 em 13/10, 10 em 20/10.
// C2 (T2): encontros às quartas — 4 em 30/09, 5 em 07/10 (hoje), 6 em 14/10.
// C3 (T3): só o encontro 1, semana que vem (13/10) — vigente futuro.
// C4 (T4): rascunho — nunca vira card.
// C5 (T5): ativo mas sem evento nenhum — não vira card, meta vazia.
const C1 = mkCronograma({ id: "c1", turma: "T1" });
const C2 = mkCronograma({ id: "c2", turma: "T2" });
const C3 = mkCronograma({ id: "c3", turma: "T3" });
const C4 = mkCronograma({ id: "c4", turma: "T4", status: "rascunho" });
const C5 = mkCronograma({ id: "c5", turma: "T5" });

const EV_C1 = [
  mkEvento(6, "2026-09-22"),
  mkEvento(7, "2026-09-29"),
  mkEvento(8, "2026-10-06"),
  mkEvento(9, "2026-10-13"),
  mkEvento(10, "2026-10-20"),
];
const EV_C2 = [
  mkEvento(4, "2026-09-30", "encontro", "c2"),
  mkEvento(5, "2026-10-07", "encontro", "c2"),
  mkEvento(6, "2026-10-14", "encontro", "c2"),
];
const EV_C3 = [mkEvento(1, "2026-10-13", "encontro", "c3")];
const EV_C4 = [mkEvento(1, "2026-10-06", "encontro", "c4")];
const EVENTOS = [...EV_C1, ...EV_C2, ...EV_C3, ...EV_C4];

// dupla realizada no encontro 8 (19h de terça), com registro
const dA = mkDupla({
  id: "dA",
  encontros: [
    mkEncontro({
      dupla_id: "dA",
      numero: 8,
      status: "realizado",
      data_hora: "2026-10-06T22:00:00Z",
      realizado_em: "2026-10-06T22:00:00Z",
      registro: COM_REGISTRO,
    }),
  ],
});
// enc8 agendado pra quinta 19h — reposição na mesma semana
const dB = mkDupla({
  id: "dB",
  mentor: mkProfile("Bruno Paz"),
  mentorado: mkMentorado("Beatriz Reis"),
  encontros: [
    mkEncontro({ dupla_id: "dB", numero: 8, data_hora: "2026-10-08T22:00:00Z" }),
  ],
});
// nunca agendou nada — 3 oficiais já vencidos
const dC = mkDupla({
  id: "dC",
  mentor: mkProfile("Caio Melo"),
  mentorado: mkMentorado("Clara Dias"),
});
const dD = mkDupla({ id: "dD", status: "pausada" });
const dE = mkDupla({
  id: "dE",
  turma: "T2",
  cronograma_id: "c2",
  mentor: mkProfile("Érica Fontes"),
  mentorado: mkMentorado("Elisa Nunes"),
  encontros: [
    mkEncontro({ dupla_id: "dE", numero: 5, data_hora: "2026-10-07T22:00:00Z" }),
  ],
});

// ============================================================
describe("resumosPorCronograma", () => {
  it("um card por cronograma ativo com eventos — rascunho e sem-eventos ficam fora", () => {
    const cards = resumosPorCronograma(
      [dA, dB, dC, dD, dE],
      [C5, C4, C3, C1, C2], // fora de ordem — a saída segue a ordem de turma
      EVENTOS,
      AGORA
    );
    expect(cards.map((c) => c.turma)).toEqual(["T1", "T2", "T3"]);
  });

  it("barra de três segmentos soma as ativas — realizaram/agendadas/sem data", () => {
    const [t1, t2] = resumosPorCronograma(
      [dA, dB, dC, dD, dE],
      [C1, C2],
      EVENTOS,
      AGORA
    );
    expect(t1).toMatchObject({
      cronogramaId: "c1",
      eventoNumero: 8,
      eventoData: "2026-10-06",
      ativas: 3, // dA, dB, dC — pausada (dD) não é ativa
      pausadas: 1,
      realizaram: 1, // dA
      semAgendamento: 1, // dC
      agendadas: 1, // dB
    });
    expect(t1.realizaram + t1.agendadas + t1.semAgendamento).toBe(t1.ativas);
    expect(t2).toMatchObject({
      ativas: 1,
      realizaram: 0,
      semAgendamento: 0,
      agendadas: 1,
      eventoNumero: 5,
    });
    expect(t2.realizaram + t2.agendadas + t2.semAgendamento).toBe(t2.ativas);
  });

  it("régua: feito / atual / futuro pelo número vigente, na ordem do cronograma", () => {
    const [t1] = resumosPorCronograma([dA], [C1], EVENTOS, AGORA);
    expect(t1.regua.map((p) => [p.numero, p.estado])).toEqual([
      [6, "feito"],
      [7, "feito"],
      [8, "atual"],
      [9, "futuro"],
      [10, "futuro"],
    ]);
    // cronograma sem dupla ainda tem card e régua — vigente é o próximo
    const [, , t3] = resumosPorCronograma(
      [dA, dB, dC, dD, dE],
      [C1, C2, C3],
      EVENTOS,
      AGORA
    );
    expect(t3.eventoNumero).toBe(1);
    expect(t3.eventoData).toBe("2026-10-13");
    expect(t3.regua).toEqual([
      { numero: 1, data: "2026-10-13", estado: "atual" },
    ]);
    expect(t3.ativas).toBe(0);
  });

  it("meta 'terças 19h' — dia da data oficial + hora modal dos agendamentos", () => {
    const [t1, t2, t3] = resumosPorCronograma(
      [dA, dB, dC, dD, dE],
      [C1, C2, C3],
      EVENTOS,
      AGORA
    );
    expect(t1.meta).toBe("terças 19h");
    expect(t2.meta).toBe("quartas 19h");
    // sem agendamento nenhum, só o dia oficial
    expect(t3.meta).toBe("terças");
  });
});

// ============================================================
describe("paraAcompanhar", () => {
  // dLimbo: fez o 6, tem o 7 agendado já vencido sem registro (limbo) —
  // o limbo cobre o 7 no esperado, então atraso zera
  const dLimbo = mkDupla({
    id: "dL",
    mentorado: mkMentorado("Bruna Sá"),
    encontros: [
      mkEncontro({
        dupla_id: "dL",
        numero: 6,
        status: "realizado",
        data_hora: "2026-09-22T22:00:00Z",
        realizado_em: "2026-09-22T22:00:00Z",
        registro: COM_REGISTRO,
      }),
      mkEncontro({
        dupla_id: "dL",
        numero: 7,
        data_hora: "2026-09-29T22:00:00Z", // venceu, sem registro → limbo
      }),
      mkEncontro({
        dupla_id: "dL",
        numero: 8,
        data_hora: "2026-10-08T22:00:00Z", // já remarcado
      }),
    ],
  });
  // dPend: registro do 6 pendente, resto em dia — motivo único
  const dPend = mkDupla({
    id: "dP",
    mentor: mkProfile("Paulo Reis"),
    mentorado: mkMentorado("Elisa Ramos"),
    encontros: [
      mkEncontro({
        dupla_id: "dP",
        numero: 6,
        status: "realizado",
        data_hora: "2026-09-22T22:00:00Z",
        realizado_em: "2026-09-22T22:00:00Z",
      }),
      mkEncontro({
        dupla_id: "dP",
        numero: 7,
        status: "realizado",
        data_hora: "2026-09-29T22:00:00Z",
        realizado_em: "2026-09-29T22:00:00Z",
        registro: COM_REGISTRO,
      }),
      mkEncontro({
        dupla_id: "dP",
        numero: 8,
        data_hora: "2026-10-08T22:00:00Z",
      }),
    ],
  });
  // dSemData: em dia até o 7, sem row do 8 — em segunda ainda não há atraso
  const dSemData = mkDupla({
    id: "dS",
    mentorado: mkMentorado("Ana Beatriz"),
    encontros: [6, 7].map((n) =>
      mkEncontro({
        dupla_id: "dS",
        numero: n,
        status: "realizado",
        data_hora: `2026-09-${n === 6 ? "22" : "29"}T22:00:00Z`,
        realizado_em: `2026-09-${n === 6 ? "22" : "29"}T22:00:00Z`,
        registro: COM_REGISTRO,
      })
    ),
  });

  it("sem_data puro: motivo único, contexto com o prazo de domingo", () => {
    const itens = paraAcompanhar([dSemData], EVENTOS, {}, AGORA_SEG);
    expect(itens).toHaveLength(1);
    expect(itens[0].motivos).toEqual(["sem_data"]);
    expect(itens[0].contexto).toBe(
      "Encontro 8 · T1 — ainda sem data nesta semana (prazo: dom 11)"
    );
    expect(itens[0].rotuloLembrete).toBe("Lembrar");
    expect(itens[0].saude.semaforo).toBe("atencao"); // preventivo aceso
  });

  it("vigente futuro: 'sem data' nomeia o dia do encontro, não 'nesta semana'", () => {
    const dFutura = mkDupla({ id: "dF", turma: "T3", cronograma_id: "c3" });
    const itens = paraAcompanhar([dFutura], EVENTOS, {}, AGORA);
    expect(itens[0].motivos).toEqual(["sem_data"]);
    expect(itens[0].contexto).toBe(
      "Encontro 1 · T3 — ainda sem data para 13/10 (prazo: dom 18)"
    );
  });

  it("acumula atraso + sem_data sem duplicar o item", () => {
    const itens = paraAcompanhar([dC], EVENTOS, {}, AGORA);
    expect(itens).toHaveLength(1);
    expect(itens[0].motivos).toEqual(["atraso", "sem_data"]);
    expect(itens[0].contexto).toBe(
      "3 encontros atrasados (enc. 6 e 7 e 8 · T1) — sem data para o 8"
    );
    expect(itens[0].saude.semaforo).toBe("risco");
    expect(itens[0].rotuloLembrete).toBe("Lembrar");
  });

  it("limbo vira motivo próprio e aparece no contexto", () => {
    const itens = paraAcompanhar([dLimbo], EVENTOS, {}, AGORA_SEG);
    expect(itens).toHaveLength(1);
    expect(itens[0].motivos).toEqual(["limbo"]);
    expect(itens[0].contexto).toContain("7º encontro agendado já passou");
    expect(itens[0].rotuloLembrete).toBe("Lembrar");
  });

  it("registro_pendente → 'Lembrar registro' (sozinho ou combinado)", () => {
    const [pend] = paraAcompanhar([dPend], EVENTOS, {}, AGORA_SEG);
    expect(pend.motivos).toEqual(["registro_pendente"]);
    expect(pend.rotuloLembrete).toBe("Lembrar registro");
    expect(pend.contexto).toBe(
      "Encontro 8 · T1 agendado qui 8, 19h · registro do 6º encontro pendente"
    );
    // sem registro_pendente na lista, o botão é o genérico
    const [combo] = paraAcompanhar([dSemData], EVENTOS, {}, AGORA);
    expect(combo.motivos).toEqual(["atraso", "sem_data"]);
    expect(combo.rotuloLembrete).toBe("Lembrar");
  });

  it("trilha de especialista fala 'sessão' nos sufixos da fila", () => {
    const dEspLimbo = mkDupla({
      id: "dE1",
      trilha: "especialista",
      cronograma_id: null,
      mentor: mkProfile("Rui Martins"),
      encontros: [
        mkEncontro({
          dupla_id: "dE1",
          numero: 2,
          status: "agendado",
          data_hora: "2026-10-06T22:00:00Z", // vencido, sem registro → limbo
        }),
      ],
    });
    const dEspPend = mkDupla({
      id: "dE2",
      trilha: "especialista",
      cronograma_id: null,
      mentor: mkProfile("Rui Martins"),
      mentorado: mkMentorado("Sofia Alves"),
      encontros: [
        mkEncontro({
          dupla_id: "dE2",
          numero: 1,
          status: "realizado",
          data_hora: "2026-10-05T22:00:00Z", // >24h antes de AGORA
          registro: null, // realizada sem registro → registro_pendente
        }),
      ],
    });
    const [limbo, pend] = paraAcompanhar(
      [dEspLimbo, dEspPend],
      EVENTOS,
      {},
      AGORA
    );
    expect(limbo.contexto).toContain("2ª sessão agendada já passou");
    expect(limbo.contexto).not.toContain("encontro");
    expect(pend.contexto).toContain("registro da 1ª sessão pendente");
    expect(pend.rotuloLembrete).toBe("Lembrar registro");
  });

  it("ordena risco → atenção → ok e empata por nome", () => {
    const itens = paraAcompanhar([dPend, dC, dLimbo], EVENTOS, {}, AGORA);
    // dC é a única em risco; dLimbo ("Bruna Sá · André") antes de dPend
    // ("Elisa Ramos · Paulo") por nome do mentorado
    expect(itens.map((i) => i.duplaId)).toEqual(["dC", "dL", "dP"]);
    expect(itens[0].saude.semaforo).toBe("risco");
    expect(itens[1].saude.semaforo).toBe("atencao");
  });

  it("bloqueadoAte: nudge recente trava 48h; contato não é nudge; antigo libera", () => {
    const nudgeRecente: Interacao = {
      dupla_id: "dP",
      tipo: "nudge",
      canal: "in_app",
      created_at: "2026-10-07T11:00:00-03:00", // 1h atrás
      autor: null,
    };
    const contato: Interacao = {
      dupla_id: "dL",
      tipo: "contato", // último contato existe mas não é nudge → ignora
      canal: "whatsapp",
      created_at: "2026-10-07T11:00:00-03:00",
      autor: null,
    };
    const nudgeVelho: Interacao = {
      dupla_id: "dC",
      tipo: "nudge",
      canal: "whatsapp",
      created_at: "2026-10-04T10:00:00-03:00", // >48h → já livre
      autor: null,
    };
    const itens = paraAcompanhar(
      [dC, dLimbo, dPend],
      EVENTOS,
      { dP: nudgeRecente, dL: contato, dC: nudgeVelho },
      AGORA
    );
    const porId = Object.fromEntries(itens.map((i) => [i.duplaId, i]));
    expect(porId.dP.ultimoNudge).toBe(nudgeRecente);
    expect(porId.dP.bloqueadoAte?.getTime()).toBe(
      new Date("2026-10-07T11:00:00-03:00").getTime() + LEMBRETE_INTERVALO_MS
    );
    expect(porId.dL.ultimoNudge).toBeNull();
    expect(porId.dL.bloqueadoAte).toBeNull();
    expect(porId.dC.bloqueadoAte).toBeNull();
  });

  it("pausada/concluída não entram; lista vazia sai vazia", () => {
    const dConcluida = mkDupla({ id: "dX", status: "concluida" });
    expect(
      paraAcompanhar([dD, dConcluida], EVENTOS, {}, AGORA)
    ).toEqual([]);
    expect(paraAcompanhar([], EVENTOS, {}, AGORA)).toEqual([]);
  });

  // REALIZA-172 — dupla concluída com a row do rito sem decisão entra na
  // fila como pendência da coordenação: motivo próprio, contexto único e
  // CTA de ficha (a fila desenha "Concluir rito", sem LembreteButton)
  it("concluída com encerramento pendente entra com motivo 'encerramento'", () => {
    const dRito = mkDupla({ id: "dR", status: "concluida" });
    const [item] = paraAcompanhar(
      [dRito],
      EVENTOS,
      {},
      AGORA,
      new Set(["dR"])
    );
    expect(item.motivos).toEqual(["encerramento"]);
    expect(item.contexto).toBe(
      "Rito de encerramento pendente — concluir na ficha"
    );
    expect(item.contextoPartes).toEqual([item.contexto]);
    expect(item.rotuloLembrete).toBe("Concluir rito");
    expect(item.bloqueadoAte).toBeNull();
    // dimensões: só a operacional carrega a pendência — jornada fechada
    // não tem atraso nem acompanhamento a cobrar
    const dim = dimensoesDoItem(item);
    expect(dim.operacional?.rotulo).toBe("encerramento pendente");
    expect(dim.cronograma).toBeNull();
    expect(dim.acompanhamento).toBeNull();
  });

  it("o motivo 'encerramento' não vaza pra ativa nem pra concluída sem pendência", () => {
    // ativa com a row pendente (a autoavaliação chegou cedo) → nada cobra
    // o rito enquanto a jornada corre. Ela pode entrar na fila por outros
    // motivos (esta tem 3 oficiais vencidos e nada marcado) — a invariante
    // é o motivo 'encerramento' nunca aparecer fora da concluída
    const dAtiva = mkDupla({ id: "dAv" });
    for (const item of paraAcompanhar(
      [dAtiva],
      EVENTOS,
      {},
      AGORA,
      new Set(["dAv"])
    )) {
      expect(item.motivos).not.toContain("encerramento");
      expect(item.contexto).not.toContain("Rito de encerramento");
      expect(dimensoesDoItem(item).operacional?.rotulo).not.toBe(
        "encerramento pendente"
      );
    }
    // concluída SEM pendência registrada no set → segue fora da fila
    const dConc = mkDupla({ id: "dC2", status: "concluida" });
    expect(
      paraAcompanhar([dConc], EVENTOS, {}, AGORA, new Set())
    ).toEqual([]);
    // decidida (sem row pendente) mesmo no set de outra dupla → nada
    expect(
      paraAcompanhar([dConc], EVENTOS, {}, AGORA, new Set(["dX"]))
    ).toEqual([]);
  });
});

// ============================================================
// REALIZA-161 — a fila virou dashboard: badges por dimensão (vermelho só
// no acompanhamento) e a faixa de síntese do topo. Âncora AGORA_SEG
// (segunda 05/10): esperado = enc. 6 e 7, vigente = enc. 8 na semana.
describe("dimensoesDoItem + sinteseMonitoramento", () => {
  const reg = (over: object): Encontro["registro"] =>
    ({ id: `r-${Math.random().toString(36).slice(2, 8)}`, ...over }) as Encontro["registro"];
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
  // dois realizados com registro (6 e 7) cobrem o esperado de segunda —
  // cada fixture só muda o que o teste acende
  const baseEmDia = (duplaId: string): Encontro[] => [
    encRealizado(duplaId, 6, "2026-09-22"),
    encRealizado(duplaId, 7, "2026-09-29"),
  ];

  // pedido de apoio no registro do 7 (origem mentor) + sem row do 8
  const dApoio = mkDupla({
    id: "dApoio",
    mentor: mkProfile("Sofia Prado"),
    mentorado: mkMentorado("Lara Reis"),
    encontros: [
      encRealizado("dApoio", 6, "2026-09-22"),
      encRealizado("dApoio", 7, "2026-09-29", reg({ precisa_apoio: true })),
    ],
  });
  // avaliação baixa + dificuldade no último registro → combo crítico
  const dCombo = mkDupla({
    id: "dCombo",
    mentorado: mkMentorado("Maitê Luz"),
    encontros: [
      encRealizado("dCombo", 6, "2026-09-22"),
      encRealizado("dCombo", 7, "2026-09-29",
        reg({ avaliacao: "baixa", dificuldade: "participacao" })),
    ],
  });
  // dificuldade sozinha (avaliação regular) → atenção, não crise
  const dDif = mkDupla({
    id: "dDif",
    mentorado: mkMentorado("Nina Paes"),
    encontros: [
      encRealizado("dDif", 6, "2026-09-22"),
      encRealizado("dDif", 7, "2026-09-29",
        reg({ avaliacao: "regular", dificuldade: "organizacao" })),
    ],
  });
  // nada realizado nem marcado — atraso puro (esperado 2) + sem data do 8
  const dAtrasada = mkDupla({
    id: "dAtrasada",
    mentor: mkProfile("Rui Alves"),
    mentorado: mkMentorado("Otto Braga"),
  });
  // enc. 6 realizado sem registro + sem row do 8
  const dReg = mkDupla({
    id: "dRP",
    mentorado: mkMentorado("Iris Lins"),
    encontros: [
      encRealizado("dRP", 6, "2026-09-22", null),
      encRealizado("dRP", 7, "2026-09-29"),
    ],
  });
  // combinado vencido — encaminhamento pendente com prazo passado
  const dEncam = mkDupla({
    id: "dEncam",
    mentorado: mkMentorado("Lia Noce"),
    encontros: baseEmDia("dEncam"),
    encaminhamentos: [
      {
        id: "enc-1",
        dupla_id: "dEncam",
        registro_id: null,
        descricao: "Ligar pra família sobre o horário",
        responsavel: "mentor",
        prazo: "2026-10-01",
        status: "pendente",
        created_at: "2026-09-25T00:00:00Z",
      } satisfies Encaminhamento,
    ],
  });
  // enc. 8 marcado como não-aconteceu: não entra na fila (tem row), mas a
  // barra hatch do card conta ela em "sem agendamento" — a distinção que o
  // semData da síntese pega dos resumos
  const dNao = mkDupla({
    id: "dNao",
    mentorado: mkMentorado("Bia Sales"),
    encontros: [
      ...baseEmDia("dNao"),
      mkEncontro({
        dupla_id: "dNao",
        numero: 8,
        status: "nao_aconteceu",
        data_hora: "2026-10-06T22:00:00Z",
      }),
    ],
  });

  it("apoio aberto → acompanhamento danger 'Apoio pedido' (origem no detalhe)", () => {
    const [item] = paraAcompanhar([dApoio], EVENTOS, {}, AGORA_SEG);
    const d = dimensoesDoItem(item);
    expect(d.acompanhamento).toEqual({
      tom: "danger",
      rotulo: "Apoio pedido",
      detalhe: "pedido do mentor",
    });
    expect(d.cronograma).toEqual({ tom: "muted", rotulo: "sem data" });
    expect(d.operacional).toBeNull();
  });

  it("avaliação baixa + dificuldade → 'Acompanhamento crítico' danger; só dificuldade → warn", () => {
    const [combo] = paraAcompanhar([dCombo], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(combo).acompanhamento).toEqual({
      tom: "danger",
      rotulo: "Acompanhamento crítico",
    });
    const [dif] = paraAcompanhar([dDif], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(dif).acompanhamento).toEqual({
      tom: "warn",
      rotulo: "Acompanhamento",
    });
  });

  it("atraso puro vira warn no cronograma — nunca danger (tudo risco = nada é risco)", () => {
    const [item] = paraAcompanhar([dAtrasada], EVENTOS, {}, AGORA_SEG);
    const d = dimensoesDoItem(item);
    expect(d.acompanhamento).toBeNull();
    expect(d.cronograma).toEqual({
      tom: "warn",
      rotulo: "2 encontros atrasados",
    });
    expect(d.operacional).toBeNull();
  });

  it("limbo → 'agendamento vencido'; sem_data sozinho → 'sem data' muted", () => {
    const dLimbo = mkDupla({
      id: "dLimbo",
      mentorado: mkMentorado("Bela Ruas"),
      encontros: [
        encRealizado("dLimbo", 6, "2026-09-22"),
        // agendado já vencido sem registro → limbo cobre o esperado do 7
        mkEncontro({
          dupla_id: "dLimbo",
          numero: 7,
          data_hora: "2026-09-29T22:00:00Z",
        }),
      ],
    });
    const [limbo] = paraAcompanhar([dLimbo], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(limbo).cronograma).toEqual({
      tom: "warn",
      rotulo: "agendamento vencido",
    });
    const dSoSemData = mkDupla({
      id: "dSD",
      mentorado: mkMentorado("Cora Melo"),
      encontros: baseEmDia("dSD"),
    });
    const [sd] = paraAcompanhar([dSoSemData], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(sd).cronograma).toEqual({
      tom: "muted",
      rotulo: "sem data",
    });
  });

  it("operacional: registro pendente e combinado vencido saem em muted", () => {
    const [pend] = paraAcompanhar([dReg], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(pend).operacional).toEqual({
      tom: "muted",
      rotulo: "registro pendente",
    });
    const [enc] = paraAcompanhar([dEncam], EVENTOS, {}, AGORA_SEG);
    expect(dimensoesDoItem(enc).operacional).toEqual({
      tom: "muted",
      rotulo: "encaminhamento vencido",
    });
  });

  it("item sem nada aceso → as três dimensões null", () => {
    const limpo: ItemParaAcompanhar = {
      duplaId: "d0",
      nomes: "Ana · André",
      turma: "T1",
      saude: {
        semaforo: "ok",
        motivo: "Em dia",
        motivos: ["Em dia"],
        sinais: [],
        apoio: { aberto: false },
        esperado: 2,
        feitos: 2,
        proximo: null,
        registroPendente: false,
        pediuApoio: false,
        apoioJovem: false,
        avaliacaoJovemPendente: 0,
      },
      motivos: [],
      contexto: "Em dia",
      contextoPartes: ["Em dia"],
      rotuloLembrete: "Lembrar",
      ultimoNudge: null,
      bloqueadoAte: null,
    };
    expect(dimensoesDoItem(limpo)).toEqual({
      acompanhamento: null,
      cronograma: null,
      operacional: null,
    });
  });

  it("contextoPartes: [0] é o caso decisório, o resto segue — contexto intacto", () => {
    const [item] = paraAcompanhar([dAtrasada], EVENTOS, {}, AGORA_SEG);
    expect(item.contextoPartes).toEqual([
      "2 encontros atrasados (enc. 6 e 7 · T1)",
      "sem data para o 8",
    ]);
    // o texto legado continua colando o lead com " — "
    expect(item.contexto).toBe(
      "2 encontros atrasados (enc. 6 e 7 · T1) — sem data para o 8"
    );
    const [pend] = paraAcompanhar([dReg], EVENTOS, {}, AGORA_SEG);
    // a pendência é o motivo que pôs a dupla na fila — encabeça as partes
    // (o "ainda sem data" vira contexto secundário, não a boa notícia)
    expect(pend.contextoPartes[0]).toBe("registro do 6º encontro pendente");
    expect(pend.contextoPartes[1]).toContain("ainda sem data");
  });

  it("síntese: counts da fila + 'sem data' reconciliado com os cards", () => {
    const nudgeRecente: Interacao = {
      dupla_id: "dRP",
      tipo: "nudge",
      canal: "in_app",
      created_at: "2026-10-05T11:00:00-03:00", // 1h antes de AGORA_SEG
      autor: null,
    };
    const duplas = [dApoio, dAtrasada, dReg, dEncam, dNao];
    const fila = paraAcompanhar(duplas, EVENTOS, { dRP: nudgeRecente }, AGORA_SEG);
    const resumos = resumosPorCronograma(duplas, [C1], EVENTOS, AGORA_SEG);
    expect(
      sinteseMonitoramento(fila, resumos, duplas, EVENTOS, AGORA_SEG)
    ).toEqual({
      total: 4, // dNao não entra na fila (tem row do enc. 8)
      criticas: 1, // só dApoio
      atencao: 3,
      // semAgendamento do card = 5: as 4 sem row do 8 + dNao (não-aconteceu)
      semData: 5,
      registrosPendentes: 1, // dReg
      lembretesEm48h: 1, // o nudge de 1h atrás na dReg segura ela no cap
      apoioAberto: 1, // o pedido da dApoio — independente de estar na fila
    });
  });

  it("síntese vazia zera tudo", () => {
    expect(sinteseMonitoramento([], [], [], EVENTOS, AGORA_SEG)).toEqual({
      total: 0,
      criticas: 0,
      atencao: 0,
      semData: 0,
      registrosPendentes: 0,
      lembretesEm48h: 0,
      apoioAberto: 0,
    });
  });
});

// ============================================================
describe("itensDaSemanaPrograma", () => {
  const programacao = [
    ...EVENTOS,
    mkEvento(null, "2026-10-10", "formacao", "c1", {
      titulo: "Formação de mentores",
      observacao: "10h–12h · Sede",
    }),
    mkEvento(null, "2026-10-09", "evento_encerramento", "c2", {
      titulo: "Festa de encerramento",
    }),
    mkEvento(null, "2026-10-11", "recesso", "c1", {
      titulo: "Recesso de outubro",
    }),
    mkEvento(null, null, "etapa_preparacao", "c1"), // sem data → fora
  ];
  const supervisoes: {
    id: string;
    data: string;
    supervisor?: { nome: string } | null;
    mentor?: { nome: string } | null;
    resumo?: string;
  }[] = [
    {
      id: "s1",
      data: "2026-10-07",
      supervisor: { nome: "Paula Nunes" },
      mentor: { nome: "André Lima" },
      resumo: "Sessão longa: ".padEnd(120, "x"),
    },
    { id: "s2", data: "2026-10-12", supervisor: { nome: "Paula Nunes" }, mentor: { nome: "Bruno Paz" } }, // fora da semana
  ];

  it("encontro oficial, formação, evento e supervisão — tipos e etiquetas certos", () => {
    const itens = itensDaSemanaPrograma(
      programacao,
      [C1, C2],
      supervisoes,
      AGORA
    );
    const porTitulo = Object.fromEntries(itens.map((i) => [i.titulo, i]));
    expect(porTitulo["Encontro 8 · T1"]).toMatchObject({
      tipo: "encontro_oficial",
      etiqueta: "turma 1",
      eventoId: null,
      diaKey: "2026-10-06",
    });
    expect(porTitulo["Encontro 5 · T2"].etiqueta).toBe("turma 2");
    expect(porTitulo["Formação de mentores"]).toMatchObject({
      tipo: "formacao",
      etiqueta: "oficial",
      detalhe: "10h–12h · Sede",
      diaKey: "2026-10-10",
    });
    expect(porTitulo["Formação de mentores"].eventoId).toBeTruthy();
    expect(porTitulo["Festa de encerramento"].tipo).toBe("evento");
    expect(porTitulo["Festa de encerramento"].eventoId).toBeNull();
    expect(porTitulo["Recesso de outubro"].tipo).toBe("evento");
  });

  it("supervisão da semana entra com nomes, etiqueta 'hoje' no dia corrente e resumo truncado", () => {
    const itens = itensDaSemanaPrograma(
      programacao,
      [C1, C2],
      supervisoes,
      AGORA
    );
    const sup = itens.find((i) => i.id === "sup-s1")!;
    expect(sup).toMatchObject({
      tipo: "supervisao",
      diaKey: "2026-10-07",
      titulo: "Supervisão · Paula Nunes × André Lima",
      etiqueta: "hoje",
      eventoId: null,
    });
    expect(sup.detalhe!.endsWith("…")).toBe(true);
    expect(sup.detalhe!.length).toBeLessThanOrEqual(95);
    // a de 12/10 é semana que vem — fora
    expect(itens.find((i) => i.id === "sup-s2")).toBeUndefined();
  });

  it("ordena por dia e título; sem-data e fora da semana ficam de fora", () => {
    const itens = itensDaSemanaPrograma(
      programacao,
      [C1, C2, C4], // C4 conhecido como rascunho → o evento dele não entra
      supervisoes,
      AGORA
    );
    const chaves = itens.map((i) => `${i.diaKey}|${i.titulo}`);
    expect(chaves).toEqual([...chaves].sort((a, b) => {
      const [dA, tA] = a.split("|");
      const [dB, tB] = b.split("|");
      return dA.localeCompare(dB) || tA.localeCompare(tB, "pt-BR");
    }));
    // 05–11/10 exatos: nem 13/10 (próxima) nem 30/09 (anterior) entram
    expect(itens.every((i) => i.diaKey >= "2026-10-05" && i.diaKey <= "2026-10-11")).toBe(true);
    // enc8 T1 + enc5 T2 + supervisão + encerramento + formação + recesso;
    // o encontro de c4 (rascunho) e o etapa sem data ficam fora
    expect(itens).toHaveLength(6);
    expect(itens.some((i) => i.titulo === "Encontro 1 · T4")).toBe(false);
  });

  it("semana cruzando o mês: seg 28/09 → dom 04/10", () => {
    const quartaDeSetembro = new Date("2026-09-30T12:00:00-03:00");
    const evs = [
      mkEvento(3, "2026-09-28", "encontro", "c1"), // seg — dentro
      mkEvento(4, "2026-10-04", "encontro", "c1"), // dom — dentro
      mkEvento(5, "2026-10-05", "encontro", "c1"), // seg seguinte — fora
    ];
    const itens = itensDaSemanaPrograma(evs, [C1], [], quartaDeSetembro);
    expect(itens.map((i) => i.titulo)).toEqual([
      "Encontro 3 · T1",
      "Encontro 4 · T1",
    ]);
  });
});
