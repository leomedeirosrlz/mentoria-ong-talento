import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  avaliacaoCobreNumero,
  avaliacoesPendentesPorSessao,
  coberturaDoRegistro,
  encontrosDaSessao,
  gradeCombinada,
  passosCobertosCandidatos,
  recessosAlterados,
  sessaoJaAplicada,
} from "./ciclo";
import { montarPlanoEmDia } from "./plano-em-dia";
import { planoContestavel } from "./plano-combinado";
import { sessaoGrupoDaSessao } from "./registro-contexto";
import { relerPlanoPropostoDeMembro } from "./notificar";
import { IA_TOOLS } from "./ia/tools";
import type {
  CicloEvento,
  Disponibilidade,
  Dupla,
  Encontro,
  EncontroStatus,
  Notificacao,
} from "./types";
import type { PassoGuia } from "./ciclo";

// Relógio fixo: segunda-feira 12/01/2026 — todas as datas derivam dela.
const HOJE = new Date("2026-01-12T12:00:00Z");
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

const enc = (
  numero: number,
  over: Partial<Encontro> = {}
): Encontro =>
  ({
    id: `enc-${numero}-${++seq}`,
    dupla_id: "d-1",
    numero,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado" as EncontroStatus,
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    ...over,
  }) as Encontro;

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

const guia = (nums: number[]): PassoGuia[] =>
  nums.map((n) => ({
    id: `pg-${n}`,
    numero: n,
    titulo: `Passo ${n}`,
    data: null,
    fase: null,
    instrumentos: [],
  }));

const grid = (celulas: { dia: Disponibilidade["celulas"][number]["dia"]; periodo: Disponibilidade["celulas"][number]["periodo"] }[]): Disponibilidade => ({
  celulas,
});

describe("avaliação única por sessão (P0 — 018/0230)", () => {
  const membros = (sessaoId = "sess-1") => [
    enc(14, {
      status: "realizado",
      realizado_em: "2026-01-05T20:00:00Z",
      sessao_id: sessaoId,
    }),
    enc(15, { sessao_id: sessaoId }),
    enc(16, { sessao_id: sessaoId }),
  ];

  it("o grupo vira UMA pendência ancorada no menor número", () => {
    const out = avaliacoesPendentesPorSessao(membros(), []);
    expect(out).toHaveLength(1);
    expect(out[0].encontro.numero).toBe(14);
    expect(out[0].sessao).toEqual([14, 15, 16]);
  });

  it("avaliação na âncora encerra o grupo inteiro", () => {
    const m = membros();
    const out = avaliacoesPendentesPorSessao(m, [
      { encontro_id: m[0].id, dupla_id: "d-1", cobertura: [14, 15, 16] },
    ]);
    expect(out).toEqual([]);
  });

  it("avaliação num membro NÃO âncora também encerra — o sessao_id do grupo vale", () => {
    const m = membros();
    const out = avaliacoesPendentesPorSessao(m, [
      { encontro_id: m[2].id, dupla_id: "d-1" },
    ]);
    expect(out).toEqual([]);
  });

  it("cobertura por números prova a avaliação mesmo sem sessao_id na row", () => {
    const m = membros(null as unknown as string).map((e) => ({
      ...e,
      sessao_id: null,
    }));
    const out = avaliacoesPendentesPorSessao(m, [
      { encontro_id: m[0].id, dupla_id: "d-1", cobertura: [14, 15, 16] },
    ]);
    expect(out).toEqual([]);
  });

  it("grupo sem realizado não pede avaliação", () => {
    const out = avaliacoesPendentesPorSessao(
      [enc(14, { sessao_id: "s" }), enc(15, { sessao_id: "s" })],
      []
    );
    expect(out).toEqual([]);
  });

  it("rows avulsas (sem sessao_id) seguem uma pendência por row", () => {
    const out = avaliacoesPendentesPorSessao(
      [
        enc(14, { status: "realizado", realizado_em: "2026-01-05T20:00:00Z" }),
        enc(15, { status: "realizado", realizado_em: "2026-01-07T20:00:00Z" }),
      ],
      []
    );
    expect(out.map((o) => o.encontro.numero)).toEqual([14, 15]);
    expect(out.every((o) => o.sessao.length === 1)).toBe(true);
  });
});

describe("âncora e cobertura da avaliação (P0)", () => {
  it("encontrosDaSessao devolve o grupo ordenado — o primeiro é a âncora", () => {
    const m = [
      enc(15, { sessao_id: "s" }),
      enc(14, { sessao_id: "s" }),
      enc(16, { sessao_id: "s" }),
    ];
    expect(encontrosDaSessao(m[1], m).map((e) => e.numero)).toEqual([14, 15, 16]);
    expect(encontrosDaSessao(enc(20), [enc(20)])).toHaveLength(1);
  });

  it("avaliacaoCobreNumero: a âncora e cada número da cobertura contam", () => {
    const a = { encontro_id: "enc-14", cobertura: [14, 15, 16] };
    expect(avaliacaoCobreNumero(a, { id: "enc-14", numero: 14 })).toBe(true);
    expect(avaliacaoCobreNumero(a, { id: "enc-16", numero: 16 })).toBe(true);
    expect(avaliacaoCobreNumero(a, { id: "enc-17", numero: 17 })).toBe(false);
    expect(avaliacaoCobreNumero(null, { id: "enc-14", numero: 14 })).toBe(false);
  });
});

describe("coberturaDoRegistro — derivação atômica (P1-1)", () => {
  it("âncora nunca aparece na própria cobertura", () => {
    expect(coberturaDoRegistro(14, 14, [15, 16])).toEqual([15, 16]);
  });
  it("o próprio encontro postado entra quando NÃO é a âncora", () => {
    expect(coberturaDoRegistro(14, 15, [16])).toEqual([15, 16]);
  });
  it("deduplica, ordena e ignora repetição da âncora", () => {
    expect(coberturaDoRegistro(14, 16, [15, 16, 14, 15])).toEqual([15, 16]);
  });
  it("sessão simples grava vazio — nada vira promessa", () => {
    expect(coberturaDoRegistro(14, 14, [])).toEqual([]);
  });
});

describe("registro em sessão planejada — grupo fechado (P1-2)", () => {
  const passos = guia([14, 15, 16, 17]);
  it("sessaoGrupoDaSessao devolve os outros membros em ordem, com título do guia", () => {
    const d = dupla({
      encontros: [
        enc(14, { sessao_id: "s" }),
        enc(16, { sessao_id: "s" }),
        enc(15, { sessao_id: "s" }),
        enc(17),
      ],
    });
    expect(
      sessaoGrupoDaSessao({ dupla: d, encontroId: d.encontros[0].id, passos })
    ).toEqual([
      { numero: 15, titulo: "Passo 15" },
      { numero: 16, titulo: "Passo 16" },
    ]);
  });
  it("fora de sessão e na trilha especialista não há grupo", () => {
    const d = dupla({ encontros: [enc(14)] });
    expect(
      sessaoGrupoDaSessao({ dupla: d, encontroId: d.encontros[0].id, passos })
    ).toBeNull();
    const esp = dupla({
      trilha: "especialista",
      encontros: [enc(1, { sessao_id: "s" }), enc(2, { sessao_id: "s" })],
    });
    expect(
      sessaoGrupoDaSessao({ dupla: esp, encontroId: esp.encontros[0].id, passos: [] })
    ).toBeNull();
  });
  it("row de OUTRO grupo não é candidata de cobertura — nem na tela", () => {
    const encontros = [
      enc(14, { sessao_id: "sess-A" }),
      enc(15, {
        sessao_id: "sess-B",
        data_hora: "2026-01-08T19:00:00Z",
      }),
      enc(16, { data_hora: "2026-01-08T19:00:00Z" }),
    ];
    const cand = passosCobertosCandidatos(
      passos,
      encontros,
      14,
      HOJE,
      "sess-A"
    ).map((p) => p.numero);
    // 15 (outro grupo) fica de fora; 16 (agendado vencido, sem sessão) entra
    expect(cand).toEqual([16]);
  });
});

describe("Liza — ritmo livre e aceite único (P1-3)", () => {
  const schema = IA_TOOLS.plano_propor.schema;
  it("ritmo acima de 7 é válido — o produto não impõe teto", () => {
    expect(
      schema.safeParse({ dupla_id: crypto.randomUUID(), ritmo: 10 }).success
    ).toBe(true);
  });
  it("o piso segue: zero e negativo falham", () => {
    const id = crypto.randomUUID();
    expect(schema.safeParse({ dupla_id: id, ritmo: 0 }).success).toBe(false);
    expect(schema.safeParse({ dupla_id: id, ritmo: -2 }).success).toBe(false);
    expect(schema.safeParse({ dupla_id: id, ritmo: 1.5 }).success).toBe(false);
  });
  it("omitir o ritmo usa o mais leve que fecha", () => {
    expect(schema.safeParse({ dupla_id: crypto.randomUUID() }).success).toBe(
      true
    );
  });
  it("a descrição ensina aceite ÚNICO e ritmo sem teto — nunca bilateral nem 1 a 7", () => {
    const d = IA_TOOLS.plano_propor.descricao;
    expect(d).toContain("ÚNICO");
    expect(d).not.toContain("1 a 7");
    expect(d).not.toMatch(/dois lados/i);
    expect(IA_TOOLS.plano_responder.descricao).toContain("ÚNICO");
  });

  it("aceite único na superfície inteira — descrições e o card da Liza (527)", () => {
    // a régua do aceite é ÚNICA (0225): nenhuma tool do plano promete o
    // contrato bilateral nem a copy do CardPlano diz "aceite dos dois"
    for (const n of [
      "plano_propor",
      "plano_responder",
      "declarar_recesso",
    ] as const) {
      const d = IA_TOOLS[n].descricao;
      expect(d, `descricao de ${n}`).not.toMatch(
        /aceite dos dois|dos dois lados/i
      );
    }
    // o card é tsx — o guard lê a fonte como o materiais-anel faz
    const cards = readFileSync(
      path.join(process.cwd(), "src/components/assistente-cards.tsx"),
      "utf8"
    );
    expect(cards).not.toMatch(/aceite dos dois|dos dois lados/i);
    // e o tipo espelha o contrato novo, não a era 0224
    const types = readFileSync(
      path.join(process.cwd(), "src/lib/types.ts"),
      "utf8"
    );
    expect(types).not.toMatch(/só sai de `?proposto`? com os dois/i);
  });
});

describe('CTA "Combinar o plano" gateado pelo planner (P1-4)', () => {
  it("backlog com limbo e nao_aconteceu gera passos agendáveis — a régua do CTA", () => {
    // rows: 14 nao_aconteceu (remarca a mesma), 15 agendado vencido sem
    // registro (limbo), 16 sem row (devido) — o gate antigo por numerosRetro
    // só contava o 16 e escondia o CTA com backlog real
    const r = montarPlanoEmDia({
      dupla: dupla({
        encontros: [
          enc(14, {
            status: "nao_aconteceu",
            data_hora: "2026-01-05T19:00:00Z",
          }),
          enc(15, {
            status: "agendado",
            data_hora: "2026-01-07T19:00:00Z",
          }),
        ],
      }),
      eventos: [
        ev("encontro", "2026-01-05", { numero: 14 }),
        ev("encontro", "2026-01-07", { numero: 15 }),
        ev("encontro", "2026-01-09", { numero: 16 }),
        ev("evento_encerramento", "2026-02-20"),
      ],
      hoje: HOJE,
    });
    expect(r.aplicavel).toBe(true);
    if (!r.aplicavel) return;
    // o limbo derruba o emDia pela pendência de registro e os devidos
    // (nao_aconteceu remarca a mesma row, o sem row agenda) somam os
    // 2 passos que o gate pede — backlog que o numerosRetro não via
    expect(r.emDia).toBe(false);
    expect(r.pendenciasRegistro.map((p) => p.numero)).toEqual([15]);
    const agendaveis = r.passos.filter((p) => p.acao !== "travado");
    expect(agendaveis.length).toBeGreaterThanOrEqual(2);
    expect(agendaveis.map((p) => p.numero)).toEqual(
      expect.arrayContaining([14, 16])
    );
  });

  it("dupla em dia não acende o CTA", () => {
    const r = montarPlanoEmDia({
      dupla: dupla(),
      eventos: [
        ev("encontro", "2026-01-14", { numero: 14 }),
        ev("evento_encerramento", "2026-02-20"),
      ],
      hoje: HOJE,
    });
    expect(r.aplicavel).toBe(true);
    if (!r.aplicavel) return;
    expect(r.emDia).toBe(true);
  });
});

describe("recessosAlterados — autoria preservada (P1-5/9)", () => {
  const vigentes = [
    { ciclo_evento_id: "ev-a", usa: true },
    { ciclo_evento_id: "ev-b", usa: false },
  ];
  it("só viaja o que MUDOU — regravar igual roubaria o declarado_por", () => {
    const mudaram = recessosAlterados(vigentes, [
      { cicloEventoId: "ev-a", usa: true },
      { cicloEventoId: "ev-b", usa: true },
      { cicloEventoId: "ev-c", usa: false },
    ]);
    expect(mudaram.map((d) => d.cicloEventoId)).toEqual(["ev-b", "ev-c"]);
  });
  it("nada mudou, nada viaja — nem upsert cego", () => {
    expect(
      recessosAlterados(vigentes, [
        { cicloEventoId: "ev-a", usa: true },
        { cicloEventoId: "ev-b", usa: false },
      ])
    ).toEqual([]);
  });
});

describe("gradeCombinada — um lado só não é 'em comum' (P1-7)", () => {
  const segNoite = grid([{ dia: "seg", periodo: "noite" }]);
  const segNoiteETerManha = grid([
    { dia: "seg", periodo: "noite" },
    { dia: "ter", periodo: "manha" },
  ]);
  it("dois lados marcaram: devolve a interseção real", () => {
    const g = gradeCombinada(segNoiteETerManha, segNoite);
    expect(g?.celulas).toEqual([{ dia: "seg", periodo: "noite" }]);
  });
  it("um lado só: null — a simulação roda sem grade até o outro chegar", () => {
    expect(gradeCombinada(segNoite, null)).toBeNull();
    expect(gradeCombinada(null, segNoite)).toBeNull();
    expect(gradeCombinada(segNoite, { celulas: [] })).toBeNull();
    expect(gradeCombinada(null, null)).toBeNull();
  });
  it("dois lados sem sobreposição: null também (sem encaixe real)", () => {
    expect(
      gradeCombinada(segNoite, grid([{ dia: "ter", periodo: "manha" }]))
    ).toBeNull();
  });
});

describe("planoContestavel — janela de contestação (P1-8)", () => {
  const escopo = [{ numero: 14 }, { numero: 15 }, { numero: 16 }];
  it("enquanto nenhum passo do escopo aconteceu, contesta", () => {
    expect(planoContestavel(escopo, [10, 11])).toBe(true);
    expect(planoContestavel(escopo, [])).toBe(true);
  });
  it("o primeiro realizado do escopo fecha a janela — o botão some junto", () => {
    expect(planoContestavel(escopo, [15])).toBe(false);
  });
  it("sem escopo lido não bloqueia — a RPC decide de qualquer jeito", () => {
    expect(planoContestavel(null, [15])).toBe(true);
    expect(planoContestavel(undefined, [15])).toBe(true);
  });
});

describe("sessaoJaAplicada — aplicação idempotente por grupo (P1-10)", () => {
  const rows = [
    enc(14, { sessao_id: "s-1", data_hora: "2026-01-20T19:00:00Z" }),
    enc(15, { sessao_id: "s-1", data_hora: "2026-01-20T19:00:00Z" }),
    enc(16, { sessao_id: "s-1", data_hora: "2026-01-20T19:00:00Z" }),
  ];
  it("mesmo grupo, mesma data: retry puro, devolve a existente", () => {
    expect(
      sessaoJaAplicada(rows, [14, 15, 16], "2026-01-20T19:00:00Z")
    ).toBe("mesma");
  });
  it("subgrupo da sessão aplicada também é retry", () => {
    expect(sessaoJaAplicada(rows, [14, 15], "2026-01-20T19:00:00Z")).toBe(
      "mesma"
    );
  });
  it("mesma sessão, outra data pedida: recusa — a RPC remintaria o sessao_id", () => {
    expect(
      sessaoJaAplicada(rows, [14, 15, 16], "2026-01-21T19:00:00Z")
    ).toBe("outra_data");
  });
  it("aplicação parcial ou sessões mistas não é 'já aplicada'", () => {
    expect(
      sessaoJaAplicada(
        [
          enc(14, { sessao_id: "s-1" }),
          enc(15, { sessao_id: "s-2" }),
          enc(16, { sessao_id: "s-1" }),
        ],
        [14, 15, 16],
        "2026-01-20T19:00:00Z"
      )
    ).toBeNull();
    expect(
      sessaoJaAplicada(
        [enc(14, { sessao_id: "s-1" }), enc(15), enc(16, { sessao_id: "s-1" })],
        [14, 15, 16],
        "2026-01-20T19:00:00Z"
      )
    ).toBeNull();
  });
  it("grupo ainda não aplicado: null — segue pra RPC", () => {
    expect(
      sessaoJaAplicada([enc(14), enc(15)], [14, 15], "2026-01-20T19:00:00Z")
    ).toBeNull();
  });
});

describe("relerPlanoPropostoDeMembro — 'Fulano combinou' (P1-6)", () => {
  const notif = (over: Partial<Notificacao> = {}): Notificacao => ({
    id: `n-${++seq}`,
    tipo: "plano_proposto",
    titulo: 'Novo plano "ficar em dia" pra você responder',
    corpo: "A equipe propôs um plano. Responda.",
    href: "/plano",
    lida_em: null,
    created_at: "2026-01-10T10:00:00Z",
    created_by: null,
    ...over,
  });

  const supaJovem = (linhas: unknown[]) =>
    ({
      from: (tabela: string) => ({
        select: () =>
          tabela === "jovem_duplas"
            ? Promise.resolve({ data: linhas })
            : Promise.resolve({ data: [] }),
      }),
    }) as unknown as Parameters<typeof relerPlanoPropostoDeMembro>[0];

  const supaMentor = (linhas: unknown[]) =>
    ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: linhas }),
        }),
      }),
    }) as unknown as Parameters<typeof relerPlanoPropostoDeMembro>[0];

  it("proposta do mentor vira 'Fulano combinou' na tela do jovem", async () => {
    const out = await relerPlanoPropostoDeMembro(
      supaJovem([
        {
          mentor_id: "m-1",
          mentor_nome: "Ana Beatriz Souza",
          mentor_nome_social: null,
        },
      ]),
      { id: "j-1", role: "mentorado" },
      [notif({ created_by: "m-1" })]
    );
    expect(out[0].titulo).toBe('Plano "ficar em dia" valendo');
    expect(out[0].corpo).toContain("Ana combinou o plano");
  });

  it("proposta da equipe (created_by de staff) segue com a copy original", async () => {
    const original = notif({ created_by: "staff-9" });
    const out = await relerPlanoPropostoDeMembro(
      supaJovem([
        { mentor_id: "m-1", mentor_nome: "Ana", mentor_nome_social: null },
      ]),
      { id: "j-1", role: "mentorado" },
      [original]
    );
    expect(out[0]).toBe(original);
  });

  it("o mentor vê a proposta do jovem pelo profile_id embutido — objeto ou array", async () => {
    for (const embed of [
      { profile_id: "j-1", nome: "João Pedro", nome_social: null },
      [{ profile_id: "j-1", nome: "João Pedro", nome_social: "JP" }],
    ]) {
      const out = await relerPlanoPropostoDeMembro(
        supaMentor([{ mentorado: embed }]),
        { id: "m-1", role: "mentor_dpp" },
        [notif({ created_by: "j-1" })]
      );
      expect(out[0].titulo).toBe('Plano "ficar em dia" valendo');
      expect(out[0].corpo).toMatch(/João|JP combinou o plano/);
    }
  });

  it("sem notificação plano_proposto nem consulta o banco", async () => {
    let consultou = false;
    const supa = {
      from: () => {
        consultou = true;
        return { select: () => Promise.resolve({ data: [] }) };
      },
    } as unknown as Parameters<typeof relerPlanoPropostoDeMembro>[0];
    const out = await relerPlanoPropostoDeMembro(
      supa,
      { id: "m-1", role: "mentor_dpp" },
      [notif({ tipo: "comunicado" })]
    );
    expect(consultou).toBe(false);
    expect(out).toHaveLength(1);
  });
});
