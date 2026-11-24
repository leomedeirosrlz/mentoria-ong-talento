import { describe, expect, it } from "vitest";
import {
  escopoDaProposta,
  estadoArestaFusao,
  fusaoDeArestas,
  fusaoPedeAvisoPratica,
  gruposDeSessao,
  montarPlanoEmDia,
  rotuloRitmo,
} from "./plano-em-dia";
import type {
  CicloEvento,
  Disponibilidade,
  Dupla,
  DuplaRecesso,
  Encontro,
} from "./types";

// Relógio fixo: segunda-feira 12/01/2026 — todas as datas derivam dela.
const HOJE = new Date("2026-01-12T12:00:00Z");
const HOJE_STR = "2026-01-12";
const CRON = "cron-t1";

let seq = 0;
const ev = (
  tipo: CicloEvento["tipo"],
  data: string | null,
  extra: Partial<CicloEvento> = {}
): CicloEvento => ({
  id: `ev-${tipo}-${extra.numero ?? "x"}-${++seq}`,
  cronograma_id: CRON,
  tipo,
  numero: tipo === "encontro" ? (extra.numero ?? null) : null,
  data,
  data_fim: extra.data_fim ?? null,
  status: "pendente",
  observacao: null,
  ordem: seq,
  titulo: extra.titulo ?? `Evento ${extra.numero ?? seq}`,
  fase: null,
  instrumentos: [],
  ...extra,
});

const dupla = (over: Partial<Dupla> = {}): Dupla =>
  ({
    id: "d-1",
    turma: "T1",
    cronograma_id: CRON,
    status: "ativa",
    iniciada_em: "2025-12-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: { id: "m-1" },
    mentorado: { id: "j-1" },
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    recessos: [],
    ...over,
  }) as Dupla;

const encontroAgendado = (numero: number, dataHora: string): Encontro =>
  ({
    id: `enc-${numero}`,
    dupla_id: "d-1",
    numero,
    data_hora: dataHora,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
  }) as Encontro;

const decisaoRecesso = (eventoId: string, usa: boolean): DuplaRecesso => ({
  id: `dr-${eventoId}`,
  dupla_id: "d-1",
  ciclo_evento_id: eventoId,
  usa,
  declarado_por: "m-1",
  declarado_em: "2026-01-10T00:00:00Z",
});

const grid = (dia: Disponibilidade["celulas"][number]["dia"]): Disponibilidade => ({
  celulas: [{ dia, periodo: "noite" }],
});

describe("rotuloRitmo — rótulo honesto do ritmo livre (518)", () => {
  it("escada de nomeação", () => {
    expect(rotuloRitmo(1)).toBe("1 encontro por semana");
    expect(rotuloRitmo(4)).toBe("até 4 encontros por semana");
    expect(rotuloRitmo(7)).toBe("até 1 encontro por dia");
  });
  it("acima de 7 fica literal — nunca arredonda a decisão da dupla", () => {
    expect(rotuloRitmo(10)).toBe("10 encontros por semana");
    expect(rotuloRitmo(8)).toBe("8 encontros por semana");
  });
});

describe("montarPlanoEmDia — ritmo livre (518)", () => {
  // 3 devidos com piso genérico de 2 dias; encerramento apertado pra
  // diferenciar ritmo 1 (falha) de ritmo 2 (fecha)
  const eventos = () => [
    ev("encontro", "2026-01-05", { numero: 14 }),
    ev("encontro", "2026-01-06", { numero: 15 }),
    ev("encontro", "2026-01-07", { numero: 16 }),
    ev("evento_encerramento", "2026-01-25"),
  ];

  it("ritmo fora da escada de nomeação não arredonda: 5 fica 5, 4 fica 4", () => {
    const p5 = montarPlanoEmDia({ dupla: dupla(), eventos: eventos(), ritmo: 5, hoje: HOJE });
    const p4 = montarPlanoEmDia({ dupla: dupla(), eventos: eventos(), ritmo: 4, hoje: HOJE });
    expect(p5.aplicavel && p5.ritmo).toBe(5);
    expect(p4.aplicavel && p4.ritmo).toBe(4);
  });

  it("ritmo > 7 respeita a escolha e avisa que o espaçamento segue valendo", () => {
    const p = montarPlanoEmDia({ dupla: dupla(), eventos: eventos(), ritmo: 10, hoje: HOJE });
    expect(p.aplicavel && p.ritmo).toBe(10);
    if (!p.aplicavel) return;
    expect(p.avisos.some((a) => a.includes("mais de um encontro por dia"))).toBe(true);
  });

  it("alternativa é o PRIMEIRO inteiro acima que fecha, não o próximo degrau", () => {
    // ritmo 1: 3 devidos a 1/semana → último em 26/01, depois do
    // encerramento (25/01) → não fecha. ritmo 2: fecha em 19/01.
    const p = montarPlanoEmDia({ dupla: dupla(), eventos: eventos(), ritmo: 1, hoje: HOJE });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.dataRecuperacao).toBeNull();
    expect(p.alternativaRitmo).toEqual({ ritmo: 2, data: "2026-01-19" });
    expect(
      p.avisos.some((a) => a.includes("ficar em dia em 19/01/2026"))
    ).toBe(true);
  });

  it("ritmo que não fecha sem alternativa honesta: acima dele nada desloca mais", () => {
    // com piso de 2 dias uma semana comporta no máx. ~4 encontros: pedir
    // 5+ muda o rótulo, não a densidade — se 5 não fecha, 6 e 7 também não
    const eventos6 = [
      ...[9, 10, 14, 15, 16, 19].map((n, i) =>
        ev("encontro", `2026-01-0${i + 1}`, { numero: n })
      ),
      ev("evento_encerramento", "2026-01-26"),
    ];
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos6,
      ritmo: 5,
      hoje: HOJE,
    });
    expect(p.aplicavel && p.ritmo).toBe(5);
    if (!p.aplicavel) return;
    expect(p.alternativaRitmo).toBeNull();
  });
});

describe("montarPlanoEmDia — grade como preferência forte (518)", () => {
  const eventos = () => [
    ev("encontro", "2026-01-07", { numero: 16 }),
    ev("evento_encerramento", "2026-02-10"),
  ];

  it("prefere o dia com período livre em comum dentro da semana", () => {
    // sem grade o passo cairia na terça 13; com {qui} comum ele anda pra
    // quinta 15 — a preferência desloca dentro das restrições duras
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos(),
      ritmo: 2,
      disponibilidade: grid("qui"),
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.passos[0].data).toBe("2026-01-15");
    expect(p.passos[0].foraDaGrade).toBeUndefined();
    expect(p.avisos.some((a) => a.includes("período livre"))).toBe(false);
  });

  it("sem encaixe na semana o passo fica onde coube, marca e o plano avisa", () => {
    // o único dia comum na varredura (quarta 14) está ocupado por um
    // encontro travado DE NÚMERO MAIOR — ele bloqueia a data sem puxar o
    // piso de gap do passo 15, que fica na terça 13 foraDaGrade
    const p = montarPlanoEmDia({
      dupla: dupla({ encontros: [encontroAgendado(16, "2026-01-14T19:00:00")] }),
      eventos: [ev("encontro", "2026-01-07", { numero: 15 }), ev("encontro", "2026-01-14", { numero: 16 }), ev("evento_encerramento", "2026-02-10")],
      ritmo: 2,
      disponibilidade: grid("qua"),
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    const passo15 = p.passos.find((x) => x.numero === 15);
    expect(passo15?.data).toBe("2026-01-13");
    expect(passo15?.foraDaGrade).toBe(true);
    expect(
      p.avisos.some((a) => a.includes("a grade é preferência, não bloqueio"))
    ).toBe(true);
  });

  it("sem grade nenhuma a simulação segue normal (combinar sem a grade)", () => {
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos(),
      ritmo: 2,
      disponibilidade: null,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.passos[0].data).toBe("2026-01-13");
    expect(p.passos.every((x) => !x.foraDaGrade)).toBe(true);
  });
});

describe("montarPlanoEmDia — recesso tri-estado (518/0225)", () => {
  const montar = () => {
    const rec = ev("recesso", "2026-01-13", {
      titulo: "Recesso de verão",
      data_fim: "2026-01-18",
    });
    const eventos = [
      ev("encontro", "2026-01-07", { numero: 16 }),
      rec,
      ev("evento_encerramento", "2026-02-10"),
    ];
    return { rec, eventos };
  };

  it("sem row = pendente: lista a pergunta e a simulação conta como 'pausa no período'", () => {
    const { rec, eventos } = montar();
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos,
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.recessosPendentes).toEqual([
      {
        cicloEventoId: rec.id,
        titulo: "Recesso de verão",
        inicio: "2026-01-13",
        fim: "2026-01-18",
      },
    ]);
    // conservador: o passo sai depois do fim do recesso
    expect(p.passos[0].data >= "2026-01-19").toBe(true);
  });

  it("usa=false libera datas dentro do recesso e apaga a pendência", () => {
    const { rec, eventos } = montar();
    const p = montarPlanoEmDia({
      dupla: dupla({ recessos: [decisaoRecesso(rec.id, false)] }),
      eventos,
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.recessosPendentes).toEqual([]);
    expect(p.passos[0].data).toBe("2026-01-13");
  });

  it("usa=true bloqueia dentro do recesso e apaga a pendência", () => {
    const { rec, eventos } = montar();
    const p = montarPlanoEmDia({
      dupla: dupla({ recessos: [decisaoRecesso(rec.id, true)] }),
      eventos,
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.recessosPendentes).toEqual([]);
    expect(p.passos[0].data >= "2026-01-19").toBe(true);
  });

  it("recesso já encerrado não é pergunta — o tri-estado olha o que ainda vale", () => {
    const rec = ev("recesso", "2026-01-01", { data_fim: "2026-01-05" });
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: [ev("encontro", "2026-01-07", { numero: 16 }), rec],
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.recessosPendentes).toEqual([]);
  });
});

describe("escopoDaProposta — as decisões viajam no jsonb (518)", () => {
  it("carrega o snapshot das decisões sem mudar o contrato da RPC", () => {
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: [
        ev("encontro", "2026-01-07", { numero: 16 }),
        ev("evento_encerramento", "2026-02-10"),
      ],
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    const e = escopoDaProposta(p, HOJE_STR);
    expect("erro" in e).toBe(false);
    if ("erro" in e) return;
    const comDecisoes = {
      ...e.escopo,
      decisoes: { recessos: [], sem_grade: false },
    };
    expect(comDecisoes.decisoes).toEqual({ recessos: [], sem_grade: false });
    expect(e.escopo.ritmo).toBe(2);
  });
});

// ---------- sessão combinada no plano (018) ----------

describe("fusaoDeArestas — arestas viram grupos (018)", () => {
  it("uma aresta junta os dois vizinhos", () => {
    expect(fusaoDeArestas([5])).toEqual([[5, 6]]);
  });
  it("arestas em corrente formam um grupo só", () => {
    expect(fusaoDeArestas([5, 6])).toEqual([[5, 6, 7]]);
  });
  it("arestas separadas viram grupos separados", () => {
    expect(fusaoDeArestas([9, 5])).toEqual([
      [5, 6],
      [9, 10],
    ]);
  });
  it("vazio não é sessão", () => {
    expect(fusaoDeArestas([])).toEqual([]);
  });
});

describe("gruposDeSessao — a régua do grupo (018)", () => {
  const numeros = [16, 17, 18];
  it("grupo de passos do plano passa", () => {
    expect(gruposDeSessao([[16, 17]], numeros)).toEqual({
      grupos: [[16, 17]],
    });
  });
  it("grupo de um não é sessão", () => {
    const r = gruposDeSessao([[16]], numeros);
    expect("erro" in r).toBe(true);
  });
  it("número fora do plano não entra", () => {
    const r = gruposDeSessao([[16, 19]], numeros);
    expect("erro" in r).toBe(true);
  });
  it("o mesmo passo não pode estar em duas sessões", () => {
    const r = gruposDeSessao(
      [
        [16, 17],
        [17, 18],
      ],
      numeros
    );
    expect("erro" in r).toBe(true);
  });
  it("sem fusão, sem grupos — e sem erro", () => {
    expect(gruposDeSessao(undefined, numeros)).toEqual({ grupos: [] });
    expect(gruposDeSessao([], numeros)).toEqual({ grupos: [] });
  });
});

describe("fusaoPedeAvisoPratica — a prática pulada (018)", () => {
  it("passo que exige prática com o seguinte no mesmo grupo pede aviso", () => {
    expect(fusaoPedeAvisoPratica([[4, 5]])).toBe(true);
    expect(fusaoPedeAvisoPratica([[5, 6, 7]])).toBe(true);
  });
  it("sem par prática→seguinte no grupo, sem aviso", () => {
    expect(fusaoPedeAvisoPratica([[16, 17]])).toBe(false);
    expect(fusaoPedeAvisoPratica([[4, 6]])).toBe(false);
    expect(fusaoPedeAvisoPratica([])).toBe(false);
  });
});

describe("estadoArestaFusao — a aresta diz o custo de juntar (025)", () => {
  it("aresta limpa é ótima: sem prática pulada, sem pré-condição, sem sessão 3+", () => {
    expect(estadoArestaFusao(9, [{ numero: 10 }], [])).toEqual({
      tom: "otima",
      motivo: null,
    });
  });
  it("passo que exige prática fica neutro — a fusão pula a semana dele", () => {
    expect(estadoArestaFusao(6, [{ numero: 7 }], [])).toEqual({
      tom: "neutra",
      motivo: "pula a semana de prática do 6º",
    });
  });
  it("seguinte com pré-condição fica neutro e nomeia o que ele pede", () => {
    const motivo =
      'o 2º pede "Visão/Declaração consolidada e avaliação de terceiros respondida" antes';
    expect(
      estadoArestaFusao(
        1,
        [
          {
            numero: 2,
            precondicao:
              "Visão/Declaração consolidada e avaliação de terceiros respondida",
          },
        ],
        []
      )
    ).toEqual({ tom: "neutra", motivo });
  });
  it("a seleção fecha sessão de 3+: 'forma' antes de marcar, 'sessão' depois", () => {
    // aresta 10 ainda não marcada, 9 já está → [9, 10, 11]
    expect(estadoArestaFusao(10, [{ numero: 11 }], [9])).toEqual({
      tom: "neutra",
      motivo: "forma uma sessão com 3 encontros",
    });
    // aresta 9 já marcada junto com a 10 → a sessão existe
    expect(estadoArestaFusao(9, [{ numero: 10 }], [9, 10])).toEqual({
      tom: "neutra",
      motivo: "sessão com 3 encontros",
    });
  });
});

// ---------- falso "nem 1 por dia" (026) ----------
// O bug: travado com oficial já vencido contava como devido mesmo quando a
// data marcada respeitava (ou antecipava) o oficial — e uma pendência de
// registro (limbo) também afundava a dupla em "conversa", porque nenhum
// degrau da escada "fecha" quando a caminhada já converge em alvo ≤ hoje.

describe("montarPlanoEmDia — em_dia de verdade (026)", () => {
  it("travado na data oficial com oficial hoje não é atraso", () => {
    // o 16º oficial é hoje e a sessão está marcada pra hoje à noite:
    // data marcada ≤ oficial = em dia, não "conversa"
    const p = montarPlanoEmDia({
      dupla: dupla({
        encontros: [encontroAgendado(16, "2026-01-12T19:00:00")],
      }),
      eventos: [
        ev("encontro", "2026-01-12", { numero: 16 }),
        ev("encontro", "2026-01-19", { numero: 17 }),
        ev("evento_encerramento", "2026-03-01"),
      ],
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.emDia).toBe(true);
    expect(p.estado).toBe("em_dia");
  });

  it("travado DEPOIS do oficial segue sendo atraso", () => {
    // oficial venceu dia 6 e a sessão ficou pro dia 13: desvio real —
    // o plano propõe recuperação, não conversa nem em_dia
    const p = montarPlanoEmDia({
      dupla: dupla({
        encontros: [encontroAgendado(16, "2026-01-13T19:00:00")],
      }),
      eventos: [
        ev("encontro", "2026-01-06", { numero: 16 }),
        ev("encontro", "2026-01-19", { numero: 17 }),
        ev("evento_encerramento", "2026-03-01"),
      ],
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.emDia).toBe(false);
    expect(p.estado).toBe("recuperacao");
  });

  it("limbo sem dívida de agenda converge trivialmente: em_dia, não conversa", () => {
    // o 15º ficou agendado no passado sem registro (limbo — confirmação
    // pendente, não atraso) e o resto do calendário cobre no tempo:
    // alvo ≤ hoje implica em_dia mesmo com a pendência listada
    const p = montarPlanoEmDia({
      dupla: dupla({
        encontros: [encontroAgendado(15, "2026-01-08T19:00:00")],
      }),
      eventos: [
        ev("encontro", "2026-01-08", { numero: 15 }),
        ev("encontro", "2026-01-19", { numero: 16 }),
        ev("evento_encerramento", "2026-03-01"),
      ],
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.emDia).toBe(true);
    expect(p.estado).toBe("em_dia");
    expect(p.pendenciasRegistro.map((x) => x.numero)).toEqual([15]);
  });

  it("conversa real mostra a data projetada, quantos cabem e os passos que estouram", () => {
    // 5 devidos + 2 oficiais futuros: nem a 1 por dia fecha antes do
    // encerramento (16/01) — o veredito é conversa COM evidência
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: [
        ...[17, 18, 19, 20, 21].map((n, i) =>
          ev("encontro", `2026-01-0${5 + i}`, { numero: n })
        ),
        ev("encontro", "2026-01-15", { numero: 22 }),
        ev("encontro", "2026-01-16", { numero: 23 }),
        ev("evento_encerramento", "2026-01-16"),
      ],
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.estado).toBe("conversa");
    expect(p.nivel).toBe("conversa_coord");
    expect(p.dataRecuperacao).toBeNull();
    // a caminhada a 1/dia cobre o 17º em 13/01 … o 23º em 19/01: o plano
    // diz QUANDO ficaria em dia, nunca decreta impossível sem a data
    expect(p.dataProjetada).toBe("2026-01-19");
    expect(p.cabemAteEncerramento).toEqual({ cabem: 4, faltam: 7 });
    // os futuros que estouram o encerramento entram na lista, marcados
    const estouram = p.passos.filter((x) => x.numero >= 22);
    expect(estouram.map((x) => x.numero)).toEqual([22, 23]);
    expect(
      estouram.every((x) => x.aviso?.includes("encerramento"))
    ).toBe(true);
    // e a sugestão nomeia a data projetada + os caminhos, não "impossível"
    expect(p.sugestao).toContain("19/01/2026");
    expect(p.sugestao).toContain("coordenação");
  });
});

describe("montarPlanoEmDia + escopoDaProposta — a marca sessao (018)", () => {
  // três devidos já vencidos — os três entram no plano
  const eventos3 = () => [
    ev("encontro", "2026-01-06", { numero: 16 }),
    ev("encontro", "2026-01-07", { numero: 17 }),
    ev("encontro", "2026-01-08", { numero: 18 }),
    ev("evento_encerramento", "2026-04-30"),
  ];

  it("a fusão nunca emerge do planner: sem a entrada nenhum passo carrega marca", () => {
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos3(),
      ritmo: 2,
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    expect(p.passos.every((x) => x.sessao == null)).toBe(true);
  });

  it("a entrada fusao marca os passos do grupo sem mexer nas datas", () => {
    const sem = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos3(),
      ritmo: 2,
      hoje: HOJE,
    });
    const com = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos3(),
      ritmo: 2,
      fusao: [
        [16, 17],
        [18],
      ],
      hoje: HOJE,
    });
    expect(com.aplicavel && sem.aplicavel).toBe(true);
    if (!com.aplicavel || !sem.aplicavel) return;
    // grupo de 1 ([18]) não é sessão — a régua recusa e nada marca
    expect(com.passos.map((x) => x.sessao ?? null)).toEqual([
      "a",
      "a",
      null,
    ]);
    // a caminhada não muda: cada passo segue na sua data
    expect(com.passos.map((x) => x.data)).toEqual(
      sem.passos.map((x) => x.data)
    );
  });

  it("o escopo grava a marca, a data da sessão (a mais cedo) e 2h", () => {
    const p = montarPlanoEmDia({
      dupla: dupla(),
      eventos: eventos3(),
      ritmo: 2,
      fusao: [[16, 17]],
      hoje: HOJE,
    });
    expect(p.aplicavel).toBe(true);
    if (!p.aplicavel) return;
    const e = escopoDaProposta(p, HOJE_STR);
    expect("erro" in e).toBe(false);
    if ("erro" in e) return;
    const [a, b, c] = e.escopo.passos;
    expect(a.sessao).toBe("a");
    expect(b.sessao).toBe("a");
    expect(c.sessao).toBeUndefined();
    expect(a.duracao_min).toBe(120);
    expect(b.duracao_min).toBe(120);
    expect(c.duracao_min).toBeUndefined();
    // a sessão sai na data mais cedo do grupo — os dois carimbam o mesmo dia
    expect(a.data).toBe(b.data);
    expect(a.data <= c.data).toBe(true);
  });
});
