import { describe, expect, it } from "vitest";
import {
  atrasadasPainel,
  estacoesJornada,
  estacoesPainelDupla,
  resumoJornada,
  type PainelJornadaLinha,
  type PainelTurmaCtx,
  type Entrega360,
  type EntregaJornada,
  type EncontroJornada,
  type Estacao,
  type EstacaoChave,
  type EventoJornada,
  type InstrumentoJornada,
} from "./jornada";
import type { FormularioCampo } from "./forms/schema";

// Estações da "Minha jornada" — cronograma fixture de terças a partir de
// 03/03/2026 (enc. 12 = 19/05, enc. 16 = 16/06). `agora` fixado pra
// vigência de link ser determinística.

const AGORA = new Date("2026-04-22T12:00:00-03:00");
const DIA1 = "2026-03-03";
const dataEnc = (n: number): string => {
  const d = new Date(`${DIA1}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d.toISOString().slice(0, 10);
};

const cronograma = (ate = 16): EventoJornada[] => [
  // evento não-encontro no meio — não pode virar âncora de janela
  { numero: null, data: "2026-04-04", tipo: "formacao", fase: null, instrumentos: [] },
  { numero: null, data: "2026-07-01", tipo: "etapa_preparacao", fase: null, instrumentos: [] },
  ...Array.from({ length: ate }, (_, i) => ({
    numero: i + 1,
    data: dataEnc(i + 1),
    tipo: "encontro" as const,
    fase: null,
    instrumentos: [],
  })),
];

const campo = (over: Partial<FormularioCampo> = {}): FormularioCampo => ({
  id: "f1",
  tipo: "texto",
  label: "Pergunta",
  obrigatorio: false,
  ...over,
});

const CAMPOS_VISAO: FormularioCampo[] = [
  campo({ id: "filme", tipo: "texto_longo", obrigatorio: true }),
  campo({ id: "declaracao_visao", tipo: "texto_longo", obrigatorio: true }),
];

const CAMPOS_METAS: FormularioCampo[] = [
  campo({ id: "declaracao_visao", tipo: "texto_longo" }),
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    campo({ id: `meta_${n}`, obrigatorio: n <= 3 }),
    campo({ id: `porque_${n}`, tipo: "texto_longo" }),
  ]),
];

const CAMPOS_PDM: FormularioCampo[] = [
  campo({ id: "declaracao_visao", tipo: "texto_longo", obrigatorio: true }),
  ...[1, 2, 3].flatMap((n) => [
    campo({ id: `meta_${n}`, obrigatorio: n === 1 }),
    campo({ id: `is_${n}` }),
    campo({ id: `prazo_${n}`, tipo: "data" }),
  ]),
  ...[1, 2, 3].map((n) => campo({ id: `submetas_${n}`, tipo: "texto_longo" })),
];

const CAMPOS_RODA: FormularioCampo[] = [
  campo({ id: "s_como", tipo: "secao", label: "Como funciona" }),
  campo({ id: "s_pessoal", tipo: "secao", label: "Pessoal" }),
  campo({ id: "p_saude", tipo: "escala_1_10", label: "Saúde e disposição" }),
  campo({ id: "p_equilibrio", tipo: "escala_1_10", label: "Equilíbrio emocional" }),
  campo({ id: "s_prof", tipo: "secao", label: "Profissional" }),
  campo({ id: "pr_carreira", tipo: "escala_1_10", label: "Carreira e trabalho" }),
  campo({ id: "pr_financas", tipo: "escala_1_10", label: "Finanças" }),
  campo({ id: "reflexao", tipo: "texto_longo" }),
];

let seq = 0;
const entrega = (over: Partial<EntregaJornada> = {}): EntregaJornada => ({
  link_id: `link-${++seq}`,
  token: `tok-${seq}`,
  destino: "mentorado",
  status: "pendente",
  respondido_em: null,
  respostas: null,
  contexto: {},
  created_at: "2026-03-06T10:00:00-03:00",
  usado_em: null,
  expira_em: null,
  ...over,
});

const entrega360 = (over: Partial<Entrega360> = {}): Entrega360 => ({
  link_id: `link360-${++seq}`,
  token: `tok360-${seq}`,
  status: "pendente",
  respondido_em: null,
  respostas: null,
  contexto: {},
  created_at: "2026-06-10T10:00:00-03:00",
  expira_em: null,
  ...over,
});

const inst = (
  sistema: InstrumentoJornada["sistema"],
  campos: FormularioCampo[],
  entregas: EntregaJornada[] = []
): InstrumentoJornada => ({
  sistema,
  formulario_id: `form-${sistema}`,
  titulo: sistema,
  descricao: null,
  ativo: true,
  campos,
  entregas,
});

const encontro = (
  numero: number,
  status: EncontroJornada["status"] = "realizado"
): EncontroJornada => ({ id: `enc-${numero}`, numero, status, data: null });

const realizados = (ate: number): EncontroJornada[] =>
  Array.from({ length: ate }, (_, i) => encontro(i + 1));

type Input = Parameters<typeof estacoesJornada>[0];
const base = (over: Partial<Input> = {}): Input => ({
  cronograma: cronograma(),
  instrumentos: [],
  avaliacao360: [],
  encontros: [],
  avaliacoesFeitas: [],
  agora: AGORA,
  ...over,
});

const por = (est: Estacao[], chave: EstacaoChave): Estacao =>
  est.find((e) => e.chave === chave)!;

// ---------- ordem e estrutura ----------

describe("estacoesJornada — esqueleto", () => {
  it("sempre devolve as 7 estações na ordem narrativa do guia", () => {
    const est = estacoesJornada(base());
    expect(est.map((e) => e.chave)).toEqual([
      "roda_inicial",
      "visao",
      "metas",
      "pdm",
      "avaliacao_encontro",
      "roda_formal",
      "avaliacao_360",
    ]);
    expect(est[0].janela).toMatchObject({ encIni: 1, encFim: 1, dataIni: dataEnc(1), dataFim: dataEnc(1), label: "Enc. 1" });
    expect(por(est, "roda_formal").janela).toMatchObject({
      dataIni: dataEnc(12),
      dataFim: dataEnc(14),
    });
  });

  it("cronograma vazio: estações seguem derivando das entregas, datas null", () => {
    const est = estacoesJornada(
      base({
        cronograma: [],
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-08T21:00:00-03:00",
              respostas: { declaracao_visao: "Ser dev até 2028" },
            }),
          ]),
        ],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("feito");
    expect(v.janela.dataIni).toBeNull();
    expect(v.janela.dataFim).toBeNull();
    // trancada sem data da turma → detalhe sem o "(dd/mm)"
    expect(por(est, "avaliacao_360").detalhe).toBe("libera no enc. 16");
  });
});

// ---------- feito + snippet ----------

describe("estacoesJornada — feito com snippet do campo real", () => {
  it("visão cita a Declaração de Visão", () => {
    const declaracao =
      "Em até 3 anos, serei uma profissional formada e independente, ajudando minha família.";
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-08T21:03:00-03:00",
              respostas: { filme: "...", declaracao_visao: declaracao },
            }),
          ]),
        ],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("feito");
    expect(v.respondidoEm).toBe("2026-03-08T21:03:00-03:00");
    expect(v.snippet).toEqual({ tag: "Você escreveu", texto: declaracao });
    expect(v.respostas?.declaracao_visao).toBe(declaracao);
    expect(v.token).toBeNull();
  });

  it("metas cita a primeira meta via extraiMetas", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(2),
        instrumentos: [
          inst("metas", CAMPOS_METAS, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-15T19:00:00-03:00",
              respostas: {
                meta_1: "Concluir o ensino médio com notas pro ENEM",
                porque_1: "É a porta da faculdade",
                meta_2: "Conseguir um jovem aprendiz",
              },
            }),
          ]),
        ],
      })
    );
    expect(por(est, "metas").snippet).toEqual({
      tag: "Sua meta",
      texto: "Concluir o ensino médio com notas pro ENEM",
    });
  });

  it("PDM resume em contagens — metas extraídas + itens de submetas_N", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("pdm", CAMPOS_PDM, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-20T19:26:00-03:00",
              respostas: {
                meta_1: "Conseguir um jovem aprendiz até dezembro",
                is_1: "Contrato assinado",
                meta_2: "Subir a média de matemática pra 7,0",
                submetas_1:
                  "1. Montar o currículo com a Luana (até sexta). 2. Me inscrever nos 3 programas (até 15/09). 3. Treinar entrevista no enc. 6.",
                submetas_2: "1. 30 min de exercícios terça e quinta",
              },
            }),
          ]),
        ],
      })
    );
    const p = por(est, "pdm");
    expect(p.estado).toBe("feito");
    expect(p.snippet).toEqual({
      tag: "O combinado",
      texto: "2 metas · 4 de 20 submetas",
    });
    expect(p.detalhe).toBe("2 metas · 4 de 20 submetas");
  });

  it("PDM sem estrutura citável → snippet null", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("pdm", CAMPOS_PDM, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-20T19:26:00-03:00",
              respostas: { declaracao_visao: "Só a visão veio" },
            }),
          ]),
        ],
      })
    );
    expect(por(est, "pdm").estado).toBe("feito");
    expect(por(est, "pdm").snippet).toBeNull();
    expect(por(est, "pdm").detalhe).toBeNull();
  });

  it("roda cita o par de eixos mais distantes", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-04T20:00:00-03:00",
              respostas: {
                p_saude: 9,
                p_equilibrio: 6,
                pr_carreira: 7,
                pr_financas: 3,
                reflexao: "Finanças me aperta.",
              },
            }),
          ]),
        ],
      })
    );
    const r = por(est, "roda_inicial");
    expect(r.estado).toBe("feito");
    expect(r.snippet).toEqual({
      tag: "O que você marcou",
      texto: "Finanças 3/10 · Saúde e disposição 9/10",
    });
  });

  it("snippet trunca em ~140 chars com reticência", () => {
    const longa = "Quero ser médica veterinária e ter meu próprio consultório. ".repeat(4).trim();
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-08T21:00:00-03:00",
              respostas: { declaracao_visao: longa },
            }),
          ]),
        ],
      })
    );
    const s = por(est, "visao").snippet!;
    expect(s.texto.length).toBeLessThanOrEqual(140);
    expect(s.texto.endsWith("…")).toBe(true);
  });

  it("a mais recente respondida é a que vale — a anterior não reabre a estação", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-08T21:00:00-03:00",
              created_at: "2026-03-05T10:00:00-03:00",
              respostas: { declaracao_visao: "Primeira versão" },
            }),
            entrega({
              status: "respondido",
              respondido_em: "2026-03-20T21:00:00-03:00",
              created_at: "2026-03-19T10:00:00-03:00",
              respostas: { declaracao_visao: "Versão revisada" },
            }),
          ]),
        ],
      })
    );
    expect(por(est, "visao").snippet?.texto).toBe("Versão revisada");
    expect(por(est, "visao").respondidoEm).toBe("2026-03-20T21:00:00-03:00");
  });
});

// ---------- a_fazer ----------

describe("estacoesJornada — a_fazer", () => {
  it("entrega pendente pro mentorado → token (CTA Continuar), sem detalhe", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [inst("visao", CAMPOS_VISAO, [entrega({ token: "tok-vivo" })])],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("a_fazer");
    expect(v.token).toBe("tok-vivo");
    expect(v.detalhe).toBeNull();
  });

  it("pendente com destino 'mentor' NUNCA vira CTA da jovem", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [entrega({ destino: "mentor" })]),
        ],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("a_fazer");
    expect(v.token).toBeNull();
    expect(v.detalhe).toBe("o mentor envia quando chegar a hora");
  });

  it("sem entrega dentro da janela → 'envia quando chegar a hora' por emissor", () => {
    const est = estacoesJornada(base({ encontros: realizados(1) }));
    expect(por(est, "visao").detalhe).toBe("o mentor envia quando chegar a hora");
    expect(por(est, "metas").detalhe).toBe("o mentor envia quando chegar a hora");
  });

  it("sem entrega com a janela já passada → copy honesta, sem promessa futura", () => {
    const est = estacoesJornada(base({ encontros: realizados(16) }));
    expect(por(est, "visao").detalhe).toBe(
      "o link ainda não chegou — fala com teu mentor"
    );
    expect(por(est, "roda_formal").detalhe).toBe(
      "o link ainda não chegou — fala com teu mentor"
    );
    // a janela da 360º é o próprio enc. 16 — no teto da régua ela segue
    // "dentro da janela"; atraso dela aparece via link expirado
    expect(por(est, "avaliacao_360").detalhe).toBe(
      "a coordenação envia quando chegar a hora"
    );
  });

  it("link expirado → detalhe 'peça pra reenviar', sem token", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({ status: "expirado", expira_em: "2026-04-01T00:00:00-03:00" }),
          ]),
        ],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("a_fazer");
    expect(v.token).toBeNull();
    expect(v.detalhe).toBe("o link expirou — peça ao mentor pra reenviar");
  });

  it("pendente com expira_em já passada conta como expirado (agora decide)", () => {
    const est = estacoesJornada(
      base({
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            // status 'pendente' mas venceu antes de `agora`
            entrega({ expira_em: "2026-04-20T00:00:00-03:00" }),
          ]),
        ],
      })
    );
    expect(por(est, "visao").detalhe).toBe("o link expirou — peça ao mentor pra reenviar");
  });

  it("expirado da coordenação (360º) pede reenvio à coordenação", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(16),
        avaliacao360: [entrega360({ status: "expirado", expira_em: "2026-04-01T00:00:00-03:00" })],
      })
    );
    expect(por(est, "avaliacao_360").detalhe).toBe(
      "o link expirou — peça à coordenação pra reenviar"
    );
  });
});

// ---------- trancada ----------

describe("estacoesJornada — trancada", () => {
  it("jovem no enc. 5: roda formal e 360º trancadas com data dd/mm da turma", () => {
    const est = estacoesJornada(base({ encontros: realizados(5) }));
    const rf = por(est, "roda_formal");
    const a360 = por(est, "avaliacao_360");
    expect(rf.estado).toBe("trancada");
    expect(rf.detalhe).toBe(`libera no enc. 12 (${dataEnc(12).slice(8, 10)}/${dataEnc(12).slice(5, 7)})`);
    expect(rf.detalhe).toBe("libera no enc. 12 (19/05)");
    expect(a360.estado).toBe("trancada");
    expect(a360.detalhe).toBe("libera no enc. 16 (16/06)");
    expect(rf.token).toBeNull();
    expect(a360.token).toBeNull();
  });

  it("jovem no enc. 0: metas (enc. 2) trancada; enc. 1 abre roda inicial, visão, PDM e avaliação", () => {
    const est = estacoesJornada(base());
    expect(por(est, "metas").estado).toBe("trancada");
    expect(por(est, "metas").detalhe).toBe("libera no enc. 2 (10/03)");
    for (const c of ["roda_inicial", "visao", "pdm", "avaliacao_encontro"] as const)
      expect(por(est, c).estado).toBe("a_fazer");
  });

  it("trancada vale mesmo com link emitido antes da hora — nunca botão", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(5),
        avaliacao360: [entrega360({ token: "tok-antes-da-hora" })],
      })
    );
    const a360 = por(est, "avaliacao_360");
    expect(a360.estado).toBe("trancada");
    expect(a360.token).toBeNull();
  });

  it("mas respondida antes da janela já consta como feita", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(5),
        avaliacao360: [
          entrega360({
            status: "respondido",
            respondido_em: "2026-04-10T20:00:00-03:00",
            respostas: { o_que_leva: "Levo a amizade e a disciplina das metas." },
          }),
        ],
      })
    );
    const a360 = por(est, "avaliacao_360");
    expect(a360.estado).toBe("feito");
    expect(a360.snippet?.texto).toContain("Levo a amizade");
  });
});

// ---------- roda inicial × formal ----------

describe("estacoesJornada — roda inicial × formal", () => {
  const respostaRoda = { p_saude: 8, pr_financas: 4 };

  it("1 entrega cedo é a leitura inicial; a formal segue na janela dela", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(5),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              created_at: "2026-03-05T10:00:00-03:00",
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: respostaRoda,
            }),
          ]),
        ],
      })
    );
    expect(por(est, "roda_inicial").estado).toBe("feito");
    expect(por(est, "roda_formal").estado).toBe("trancada");
  });

  it("2 entregas separam: criada ≥ data do enc. 12 é a aplicação formal", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(14),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              created_at: "2026-03-05T10:00:00-03:00",
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: respostaRoda,
            }),
            entrega({
              status: "respondido",
              created_at: `${dataEnc(12)}T19:00:00-03:00`,
              respondido_em: `${dataEnc(12)}T20:30:00-03:00`,
              respostas: { p_saude: 9, pr_financas: 6 },
            }),
          ]),
        ],
      })
    );
    const ini = por(est, "roda_inicial");
    const for_ = por(est, "roda_formal");
    expect(ini.estado).toBe("feito");
    expect(for_.estado).toBe("feito");
    expect(for_.snippet?.texto).toBe("Finanças 6/10 · Saúde e disposição 9/10");
    expect(for_.respondidoEm).toBe(`${dataEnc(12)}T20:30:00-03:00`);
  });

  it("contexto->>'momento' ganha da data — vínculo explícito do emissor", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(14),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              contexto: { momento: "formal" },
              created_at: "2026-03-05T10:00:00-03:00", // cedo, mas marcada formal
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: respostaRoda,
            }),
          ]),
        ],
      })
    );
    expect(por(est, "roda_formal").estado).toBe("feito");
    expect(por(est, "roda_inicial").estado).toBe("a_fazer");
  });
});

// ---------- avaliação do encontro (recorrente) ----------

describe("estacoesJornada — avaliação do encontro", () => {
  it("em dia → feito 'em dia · X de Y'", () => {
    const encs = realizados(3);
    const est = estacoesJornada(
      base({ encontros: encs, avaliacoesFeitas: encs.map((e) => e.id) })
    );
    const a = por(est, "avaliacao_encontro");
    expect(a.estado).toBe("feito");
    expect(a.detalhe).toBe("em dia · 3 de 3");
    expect(a.token).toBeNull(); // o CTA dela é a home/agenda — a UI decide
  });

  it("pendência aponta o encontro mais antigo sem avaliação", () => {
    const encs = realizados(4);
    const est = estacoesJornada(
      base({ encontros: encs, avaliacoesFeitas: [encs[0].id, encs[2].id] })
    );
    const a = por(est, "avaliacao_encontro");
    expect(a.estado).toBe("a_fazer");
    expect(a.detalhe).toBe("falta avaliar o encontro 2");
  });

  it("sem encontro realizado ainda → a_fazer honesto, sem número", () => {
    const est = estacoesJornada(base());
    const a = por(est, "avaliacao_encontro");
    expect(a.estado).toBe("a_fazer");
    expect(a.detalhe).toBe("a primeira sai depois do encontro 1");
  });

  it("agendado/remarcado não conta como realizado — só o feito move a régua", () => {
    const encs = [
      encontro(1, "realizado"),
      encontro(2, "agendado"),
      encontro(3, "remarcado"),
    ];
    const est = estacoesJornada(
      base({ encontros: encs, avaliacoesFeitas: ["enc-1"] })
    );
    expect(por(est, "avaliacao_encontro").detalhe).toBe("em dia · 1 de 1");
    // e a régua das estações também: corrente = 2 → metas abre, roda formal não
    expect(por(est, "metas").estado).toBe("a_fazer");
    expect(por(est, "roda_formal").estado).toBe("trancada");
  });
});

// ---------- resumo ----------

describe("resumoJornada", () => {
  it("progresso de feitas e a próxima parada (a_fazer antes de trancada)", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(5),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              created_at: "2026-03-05T10:00:00-03:00",
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: { p_saude: 8, pr_financas: 4 },
            }),
          ]),
          inst("visao", CAMPOS_VISAO, [
            entrega({
              status: "respondido",
              respondido_em: "2026-03-08T21:00:00-03:00",
              respostas: { declaracao_visao: "Ser dev" },
            }),
          ]),
        ],
      })
    );
    const r = resumoJornada(est);
    expect(r.total).toBe(7);
    expect(r.feitas).toBe(2);
    expect(r.proxima?.titulo).toBe("Definindo minhas metas");
  });
});

// ---------- regressões da revisão WP7 ----------

describe("regressão — resposta do mentor não fecha estação da jovem (M1)", () => {
  it("respondida com destino 'mentor' não vira feito nem snippet 'Você escreveu'", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(5),
        instrumentos: [
          inst("visao", CAMPOS_VISAO, [
            entrega({
              destino: "mentor",
              status: "respondido",
              token: null,
              respondido_em: "2026-03-08T21:00:00-03:00",
              respostas: { declaracao_visao: "Visão do mentor" },
            }),
          ]),
        ],
      })
    );
    const v = por(est, "visao");
    expect(v.estado).toBe("a_fazer");
    expect(v.snippet).toBeNull();
    expect(v.respostas).toBeNull();
    expect(v.token).toBeNull();
  });

  it("entrega do mentor com token stripped (null) é invisível pro CTA", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(2),
        instrumentos: [
          inst("metas", CAMPOS_METAS, [
            entrega({ destino: "mentor", token: null }),
          ]),
        ],
      })
    );
    const m = por(est, "metas");
    expect(m.estado).toBe("a_fazer");
    expect(m.token).toBeNull();
  });
});

describe("regressão — roda: primeira sem marca é sempre a inicial (A1)", () => {
  const respostaRoda = { p_saude: 8, pr_financas: 4 };

  it("emparelhamento tardio: 1ª roda criada DEPOIS do enc. 12 ainda é a inicial", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(13),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              created_at: `${dataEnc(13)}T10:00:00-03:00`,
              respondido_em: `${dataEnc(13)}T20:00:00-03:00`,
              respostas: respostaRoda,
            }),
          ]),
        ],
      })
    );
    expect(por(est, "roda_inicial").estado).toBe("feito");
    expect(por(est, "roda_formal").estado).toBe("a_fazer");
    expect(por(est, "roda_formal").snippet).toBeNull();
  });

  it("2ª roda sem marca é a formal — mesmo criada cedo (adiantada)", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(3),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              created_at: "2026-03-05T10:00:00-03:00",
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: respostaRoda,
            }),
            entrega({
              status: "pendente",
              created_at: "2026-03-10T10:00:00-03:00",
            }),
          ]),
        ],
      })
    );
    expect(por(est, "roda_inicial").estado).toBe("feito");
    const f = por(est, "roda_formal");
    // formal sem marca emitida cedo: a estação segue trancada (janela 12-14)
    expect(f.estado).toBe("trancada");
    expect(f.token).toBeNull();
  });

  it("momento explícito da RPC vence a ordem de criação", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(13),
        instrumentos: [
          inst("roda_vida", CAMPOS_RODA, [
            entrega({
              status: "respondido",
              contexto: { momento: "formal" },
              created_at: "2026-03-05T10:00:00-03:00",
              respondido_em: "2026-03-05T20:00:00-03:00",
              respostas: respostaRoda,
            }),
            entrega({
              status: "respondido",
              contexto: { momento: "inicial" },
              created_at: `${dataEnc(13)}T10:00:00-03:00`,
              respondido_em: `${dataEnc(13)}T20:00:00-03:00`,
              respostas: { p_saude: 6, pr_financas: 6 },
            }),
          ]),
        ],
      })
    );
    expect(por(est, "roda_inicial").estado).toBe("feito");
    expect(por(est, "roda_inicial").respondidoEm).toBe(
      `${dataEnc(13)}T20:00:00-03:00`
    );
    expect(por(est, "roda_formal").estado).toBe("feito");
  });
});

describe("regressão — re-emissão depois de respondida reabre a estação (M3)", () => {
  it("PDM respondido + link novo pendente → a_fazer com CTA, resposta antiga preservada no server", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(9),
        instrumentos: [
          inst("pdm", CAMPOS_PDM, [
            entrega({
              status: "respondido",
              created_at: "2026-03-10T10:00:00-03:00",
              respondido_em: "2026-03-15T20:00:00-03:00",
              respostas: { meta_1: "Passar no vestibular" },
            }),
            entrega({
              status: "pendente",
              created_at: `${dataEnc(9)}T10:00:00-03:00`,
              token: "tok-reemissao",
            }),
          ]),
        ],
      })
    );
    const p = por(est, "pdm");
    expect(p.estado).toBe("a_fazer");
    expect(p.token).toBe("tok-reemissao");
    expect(p.detalhe).toContain("nova rodada");
  });

  it("link novo pro MENTOR depois de respondida não reabre a estação dela", () => {
    const est = estacoesJornada(
      base({
        encontros: realizados(9),
        instrumentos: [
          inst("pdm", CAMPOS_PDM, [
            entrega({
              status: "respondido",
              created_at: "2026-03-10T10:00:00-03:00",
              respondido_em: "2026-03-15T20:00:00-03:00",
              respostas: { meta_1: "Meta" },
            }),
            entrega({
              destino: "mentor",
              status: "pendente",
              created_at: `${dataEnc(9)}T10:00:00-03:00`,
            }),
          ]),
        ],
      })
    );
    expect(por(est, "pdm").estado).toBe("feito");
  });
});

// ---------- painel coord/supervisor (B5 — paridade com a jornada) ----------

describe("painel — estacoesPainelDupla + atrasadasPainel", () => {
  const ctxPainel = (encVigente: number): PainelTurmaCtx => ({
    encVigente,
    dataEnc: (n) => dataEnc(n),
  });

  const linha = (over: Partial<PainelJornadaLinha> = {}): PainelJornadaLinha => ({
    dupla_id: "d1",
    turma: "T1",
    cronograma_id: "c1",
    mentor_id: "m1",
    mentor_nome: "Mentor",
    mentorado_id: "jd1",
    jovem_nome: "Jovem",
    entregas: {},
    avaliacoes_encontro: { feitas: 0, realizados: 0, max_numero: null },
    ...over,
  });

  it("roda: a primeira entrega sem marca é a inicial, a segunda a formal", () => {
    const estados = estacoesPainelDupla(
      linha({
        entregas: {
          roda_vida: [
            { status: "respondido", created_at: "2026-03-05T10:00:00-03:00", destino: "mentorado" },
            { status: "pendente", created_at: `${dataEnc(13)}T10:00:00-03:00`, destino: "mentorado" },
          ],
        },
      }),
      ctxPainel(13)
    );
    expect(estados.roda_inicial).toBe("respondido");
    expect(estados.roda_formal).toBe("pendente");
  });

  it("roda tardia sem marca: 1ª entrega criada após o enc. 12 segue sendo a inicial", () => {
    const estados = estacoesPainelDupla(
      linha({
        entregas: {
          roda_vida: [
            { status: "respondido", created_at: `${dataEnc(13)}T10:00:00-03:00`, destino: "mentorado" },
          ],
        },
      }),
      ctxPainel(13)
    );
    expect(estados.roda_inicial).toBe("respondido");
    expect(estados.roda_formal).not.toBe("respondido");
  });

  it("contexto->>'momento' explícito vence a ordem", () => {
    const estados = estacoesPainelDupla(
      linha({
        entregas: {
          roda_vida: [
            { status: "respondido", created_at: `${dataEnc(13)}T10:00:00-03:00`, destino: "mentorado", contexto: { momento: "inicial" } },
          ],
        },
      }),
      ctxPainel(13)
    );
    expect(estados.roda_inicial).toBe("respondido");
    expect(estados.roda_formal).not.toBe("respondido");
  });

  it("entrega do mentor não fecha a estação da jovem no painel", () => {
    const estados = estacoesPainelDupla(
      linha({
        entregas: {
          visao: [
            { status: "respondido", created_at: "2026-03-05T10:00:00-03:00", destino: "mentor" },
          ],
        },
      }),
      ctxPainel(3)
    );
    expect(estados.visao).not.toBe("respondido");
  });

  it("régua da dupla: dupla recém-emparelhada não fica 'fora da janela' pela coorte", () => {
    const estados = estacoesPainelDupla(linha(), ctxPainel(10));
    // coorte no enc. 10, dupla ainda sem encontro realizado (max_numero null → posição 1)
    const atrasadas = atrasadasPainel(estados, ctxPainel(10), 1);
    expect(atrasadas).not.toContain("visao");
    expect(atrasadas).not.toContain("metas");
    // coorte no enc. 10, dupla acompanhando (posição 10): visao/metas fora da janela
    const atrasadas2 = atrasadasPainel(estados, ctxPainel(10), 10);
    expect(atrasadas2).toContain("visao");
    expect(atrasadas2).toContain("metas");
  });

  it("avaliação recorrente: realizados=0 trancada, feitas=realizados em dia, senão pendente", () => {
    const base_ = { realizados: 0, feitas: 0, max_numero: null };
    expect(
      estacoesPainelDupla(linha({ avaliacoes_encontro: base_ }), ctxPainel(5))
        .avaliacao_encontro
    ).toBe("trancada");
    expect(
      estacoesPainelDupla(
        linha({ avaliacoes_encontro: { realizados: 3, feitas: 3, max_numero: 3 } }),
        ctxPainel(5)
      ).avaliacao_encontro
    ).toBe("respondido");
    expect(
      estacoesPainelDupla(
        linha({ avaliacoes_encontro: { realizados: 3, feitas: 1, max_numero: 3 } }),
        ctxPainel(5)
      ).avaliacao_encontro
    ).toBe("pendente");
  });
});
