import { describe, expect, it } from "vitest";
import { conquistasDoJovem, type ConquistasInput } from "./conquistas";
import {
  demoJovemAssinaturas,
  demoJovemAvaliacoes,
  demoJovemDuplas,
  demoJovemEncaminhamentos,
  demoJovemEncontros,
  demoJovemPerfil,
  demoMe,
} from "./demo/queries";
import { demoJovemJornada } from "./demo/forms-data";
import { demoPdmDaDupla } from "./demo/pdm-data";
import type {
  EntregaJornada,
  EventoJornada,
  InstrumentoJornada,
  JovemJornadaDados,
} from "./jornada";

// "Suas conquistas" do perfil — estante (marcos datados + instrumentos
// entregues + contagens) e a faixa do próximo marco. Fixtures: terças a
// partir de 03/03/2026, `agora` fixado pra vigência de link ser
// determinística (mesmo padrão de jornada.test.ts).

const AGORA = new Date("2026-04-22T12:00:00-03:00");
const DIA1 = "2026-03-03";
const dia = (n: number): string => {
  const d = new Date(`${DIA1}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d.toISOString().slice(0, 10);
};

const DUPLA_DPP = {
  id: "d1",
  trilha: "dpp",
  status: "ativa",
  iniciada_em: "2026-02-24",
};
const DUPLA_ESP = {
  id: "d2",
  trilha: "especialista",
  status: "ativa",
  iniciada_em: "2026-02-24",
};

type Enc = ConquistasInput["encontros"][number];
const enc = (n: number, over: Partial<Enc> = {}): Enc => ({
  id: `e${n}`,
  dupla_id: "d1",
  numero: n,
  status: "realizado",
  realizado_em: `${dia(n)}T19:00:00-03:00`,
  data_hora: `${dia(n)}T19:00:00-03:00`,
  ...over,
});

const encEsp = (n: number): Enc =>
  enc(n, { id: `es${n}`, dupla_id: "d2", numero: n });

const base = (over: Partial<ConquistasInput> = {}): ConquistasInput => ({
  encontros: [],
  duplas: [],
  jornada: null,
  avaliacoes: [],
  encaminhamentos: [],
  agora: AGORA,
  ...over,
});

const cronograma: EventoJornada[] = Array.from({ length: 16 }, (_, i) => ({
  numero: i + 1,
  data: dia(i + 1),
  tipo: "encontro" as const,
  fase: null,
  instrumentos: [],
}));

const entrega = (over: Partial<EntregaJornada> = {}): EntregaJornada => ({
  link_id: "l1",
  token: "t1",
  destino: "mentorado",
  status: "respondido",
  respondido_em: "2026-03-04T10:00:00-03:00",
  respostas: { campo: "texto" },
  contexto: null,
  created_at: "2026-03-01T10:00:00-03:00",
  usado_em: "2026-03-04T10:00:00-03:00",
  expira_em: null,
  ...over,
});

const instrumento = (
  sistema: InstrumentoJornada["sistema"],
  entregas: EntregaJornada[]
): InstrumentoJornada => ({
  sistema,
  formulario_id: `f-${sistema}`,
  titulo: sistema,
  descricao: null,
  ativo: true,
  campos: [],
  entregas,
});

const jornada = (
  instrumentos: InstrumentoJornada[]
): JovemJornadaDados => ({
  dupla_id: "d1",
  cronograma,
  instrumentos,
  avaliacao_360: [],
});

const chaves = (r: ReturnType<typeof conquistasDoJovem>) =>
  r.conquistas.map((c) => c.chave);

describe("conquistasDoJovem", () => {
  it("sem dupla não tem jornada: nada renderiza", () => {
    const r = conquistasDoJovem(base());
    expect(r.temJornada).toBe(false);
    expect(r.conquistas).toEqual([]);
    expect(r.proximoMarco).toBeNull();
  });

  it("jovem novo com dupla DPP: estante vazia + faixa do 1º encontro", () => {
    const r = conquistasDoJovem(base({ duplas: [DUPLA_DPP] }));
    expect(r.temJornada).toBe(true);
    expect(r.conquistas).toEqual([]);
    expect(r.proximoMarco).toEqual({
      marco: "primeiro",
      rotulo: "Primeiro encontro",
      atual: 0,
      alvo: 1,
      total: 16,
      sessao: false,
      texto: "Falta 1 encontro com seu mentor",
    });
  });

  it("marcos vêm datados pelo p-ésimo realizado e o próximo diz o que falta", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: Array.from({ length: 8 }, (_, i) => enc(i + 1)),
      })
    );
    // 8 seguidos: a família presença (024) carimba o tier 2 na mesma data
    expect(chaves(r)).toEqual([
      "marco:primeiro",
      "marco:metade",
      "conta:presenca-2",
    ]);
    expect(r.conquistas[0].data).toBe(`${dia(1)}T19:00:00-03:00`);
    expect(r.conquistas[1].data).toBe(`${dia(8)}T19:00:00-03:00`);
    expect(r.conquistas[0].titulo).toBe("Primeiro encontro");
    expect(r.proximoMarco).toMatchObject({
      marco: "reta_final",
      atual: 8,
      alvo: 13,
      texto: "Faltam 5 encontros com seu mentor",
    });
  });

  it("encontros não realizados não cruzam limiar", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [
          enc(1),
          enc(2, { status: "agendado" }),
          enc(3, { status: "nao_aconteceu", realizado_em: null }),
        ],
      })
    );
    expect(chaves(r)).toEqual(["marco:primeiro"]);
    expect(r.proximoMarco).toMatchObject({ marco: "metade", atual: 1, alvo: 8 });
  });

  it("jornada completa: 4 marcos e nenhuma faixa", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: Array.from({ length: 16 }, (_, i) => enc(i + 1)),
      })
    );
    expect(chaves(r)).toEqual([
      "marco:primeiro",
      "marco:metade",
      "marco:reta_final",
      "marco:completo",
      "conta:presenca-3",
    ]);
    expect(r.proximoMarco).toBeNull();
  });

  it("instrumentos entregues entram com o respondido_em; a recorrente fica de fora", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [enc(1)],
        jornada: jornada([
          instrumento("visao", [entrega()]),
          instrumento("roda_vida", [
            entrega({ contexto: { momento: "inicial" } }),
          ]),
          instrumento("metas", [entrega({ status: "pendente", respondido_em: null, respostas: null })]),
        ]),
      })
    );
    const ks = chaves(r);
    expect(ks).toContain("inst:visao");
    expect(ks).toContain("inst:roda_inicial");
    expect(ks).not.toContain("inst:metas"); // pendente não é conquista
    expect(ks).not.toContain("inst:avaliacao_encontro");
    const visao = r.conquistas.find((c) => c.chave === "inst:visao")!;
    expect(visao.data).toBe("2026-03-04T10:00:00-03:00");
    expect(visao.glifo).toEqual({ tipo: "instrumento", chave: "visao" });
  });

  it("ordem cronológica da estante segue a data de cada conquista", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [enc(1)],
        jornada: jornada([
          instrumento("visao", [
            entrega({ respondido_em: "2026-02-20T10:00:00-03:00" }),
          ]),
        ]),
      })
    );
    // a Visão (fev) veio antes do 1º encontro (mar)
    expect(chaves(r)).toEqual(["inst:visao", "marco:primeiro"]);
  });

  it("contagens: avaliações com data da última, combinados sem carimbo, sessões esp", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP, DUPLA_ESP],
        encontros: [enc(1), encEsp(1), encEsp(2)],
        avaliacoes: [
          { encontro_id: "e1", dupla_id: "d1", created_at: "2026-03-04T12:00:00-03:00" },
          { encontro_id: "es1", dupla_id: "d2", created_at: "2026-03-10T12:00:00-03:00" },
          { encontro_id: "es2", dupla_id: "d2", created_at: "2026-03-20T12:00:00-03:00" },
        ],
        encaminhamentos: [
          { status: "feito", created_at: "2026-03-05T12:00:00-03:00" },
          { status: "feito", created_at: "2026-03-15T12:00:00-03:00" },
          { status: "pendente", created_at: "2026-03-16T12:00:00-03:00" },
          { status: "atrasado", created_at: "2026-03-17T12:00:00-03:00" },
        ],
      })
    );
    const porChave = new Map(r.conquistas.map((c) => [c.chave, c]));

    const aval = porChave.get("conta:avaliacoes")!;
    expect(aval.titulo).toBe("3 avaliações enviadas");
    expect(aval.data).toBe("2026-03-20T12:00:00-03:00");

    const comb = porChave.get("conta:combinados")!;
    expect(comb.titulo).toBe("2 combinados feitos");
    expect(comb.data).toBeNull();

    const esp = porChave.get("conta:especialista")!;
    expect(esp.titulo).toBe("2 sessões com especialista");
    expect(esp.data).toBe(`${dia(2)}T19:00:00-03:00`);

    // a régua dos marcos é a DPP (não soma sessão no mesmo número)
    expect(porChave.get("marco:primeiro")?.titulo).toBe("Primeiro encontro");
    expect(r.proximoMarco).toMatchObject({
      marco: "metade",
      atual: 1,
      alvo: 8,
      texto: "Faltam 7 encontros com seu mentor",
    });
  });

  it("só trilha de especialista: marcos falam de sessão, régua de 5", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_ESP], encontros: [encEsp(1), encEsp(2)] })
    );
    expect(r.temJornada).toBe(true);
    const primeiro = r.conquistas.find((c) => c.chave === "marco:primeiro")!;
    expect(primeiro.titulo).toBe("Primeira sessão");
    expect(r.proximoMarco).toMatchObject({
      marco: "metade",
      atual: 2,
      alvo: 3,
      texto: "Falta 1 sessão com especialista",
    });
    expect(chaves(r)).toContain("conta:especialista");
  });

  it("sem trilha esp, dupla especialista zerada não abre jornada", () => {
    const r = conquistasDoJovem(base({ duplas: [DUPLA_ESP] }));
    expect(r.temJornada).toBe(false);
    expect(r.conquistas).toEqual([]);
    expect(r.proximoMarco).toBeNull();
  });

  it("jornada null (RPC fora) mantém marcos e contagens — só instrumentos somem", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [enc(1)],
        jornada: null,
        avaliacoes: [
          { encontro_id: "e1", dupla_id: "d1", created_at: "2026-03-05T12:00:00-03:00" },
        ],
      })
    );
    expect(chaves(r)).toEqual(["marco:primeiro", "conta:avaliacoes"]);
    expect(r.proximoMarco).toMatchObject({ marco: "metade" });
  });
});

// ---------- marcos de ação (485 — a faixa "Próximo marco" do topo
// da jornada): 1º encontro, avaliação, PDM, jornada completa. Estado
// ganho/não ganho sempre em texto; o próximo é o primeiro não ganho.
describe("marcos de ação", () => {
  it("sem dupla: marcos vazio — a faixa não renderiza", () => {
    const r = conquistasDoJovem(base());
    expect(r.temJornada).toBe(false);
    expect(r.marcos).toEqual([]);
  });

  it("jovem novo sem RPC: 3 marcos (sem PDM), o 1º encontro é o próximo", () => {
    const r = conquistasDoJovem(base({ duplas: [DUPLA_DPP] }));
    expect(r.marcos.map((m) => m.chave)).toEqual([
      "primeiro",
      "avaliou",
      "completo",
    ]);
    expect(r.marcos[0]).toMatchObject({
      titulo: "Primeiro encontro",
      ganho: false,
      proximo: true,
      linha: "Falta 1 encontro com seu mentor",
      progresso: { atual: 0, alvo: 1 },
    });
    expect(r.marcos[1]).toMatchObject({
      ganho: false,
      linha: "Depois do 1º encontro",
    });
    expect(r.marcos[2]).toMatchObject({
      titulo: "Jornada completa",
      ganho: false,
      proximo: false,
      linha: "Faltam 16 encontros com seu mentor",
      progresso: { atual: 0, alvo: 16 },
    });
  });

  it("avaliação pendente: 'Falta avaliar o encontro N' e é o próximo", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_DPP], encontros: [enc(1), enc(2)] })
    );
    const aval = r.marcos.find((m) => m.chave === "avaliou")!;
    expect(aval).toMatchObject({
      ganho: false,
      proximo: true,
      linha: "Falta avaliar o encontro 1",
    });
  });

  it("ganhos datados, contagem de avaliação e 'Faltam N' no próximo", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: Array.from({ length: 4 }, (_, i) => enc(i + 1)),
        avaliacoes: [
          { encontro_id: "e1", dupla_id: "d1", created_at: "2026-03-05T12:00:00-03:00" },
          { encontro_id: "e2", dupla_id: "d1", created_at: "2026-03-12T12:00:00-03:00" },
        ],
        jornada: jornada([instrumento("pdm", [entrega()])]),
      })
    );
    expect(r.marcos.map((m) => m.chave)).toEqual([
      "primeiro",
      "avaliou",
      "pdm",
      "completo",
    ]);
    expect(r.marcos[0]).toMatchObject({
      ganho: true,
      proximo: false,
      data: `${dia(1)}T19:00:00-03:00`,
    });
    expect(r.marcos[1]).toMatchObject({
      ganho: true,
      linha: "Avaliou 2 encontros com seu mentor",
    });
    expect(r.marcos[2]).toMatchObject({
      titulo: "Plano de Desenvolvimento",
      ganho: true,
      data: "2026-03-04T10:00:00-03:00",
    });
    expect(r.marcos[3]).toMatchObject({
      ganho: false,
      proximo: true,
      linha: "Faltam 12 encontros com seu mentor",
      progresso: { atual: 4, alvo: 16 },
    });
  });

  it("PDM com link vivo não ganho é o próximo e diz o que falta", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [enc(1)],
        avaliacoes: [
          { encontro_id: "e1", dupla_id: "d1", created_at: "2026-03-05T12:00:00-03:00" },
        ],
        jornada: jornada([
          instrumento("pdm", [
            entrega({ status: "pendente", respondido_em: null, respostas: null }),
          ]),
        ]),
      })
    );
    const pdm = r.marcos.find((m) => m.chave === "pdm")!;
    expect(pdm).toMatchObject({
      ganho: false,
      proximo: true,
      linha: "Esperando sua resposta",
      progresso: null,
    });
  });

  it("só especialista: 3 marcos falam de sessão, régua de 5", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_ESP], encontros: [encEsp(1), encEsp(2)] })
    );
    expect(r.marcos.map((m) => m.chave)).toEqual([
      "primeiro",
      "avaliou",
      "completo",
    ]);
    expect(r.marcos[0].titulo).toBe("Primeira sessão");
    expect(r.marcos[0].ganho).toBe(true);
    // sem avaliação, ela é o próximo gesto — o "completo" ainda não chegou
    expect(r.marcos[1]).toMatchObject({ ganho: false, proximo: true });
    expect(r.marcos[2]).toMatchObject({
      ganho: false,
      proximo: false,
      linha: "Faltam 3 sessões com especialista",
      progresso: { atual: 2, alvo: 5 },
    });
  });

  it("jornada completa: marco completo datado; avaliação pendente segue como próximo", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: Array.from({ length: 16 }, (_, i) => enc(i + 1)),
      })
    );
    const completo = r.marcos.find((m) => m.chave === "completo")!;
    expect(completo.ganho).toBe(true);
    expect(completo.data).toBe(`${dia(16)}T19:00:00-03:00`);
    // a jornada fechou, mas as 16 sessões ainda não foram avaliadas:
    // "Avaliação do encontro" é o próximo gesto da faixa
    expect(r.marcos[1]).toMatchObject({ ganho: false, proximo: true });
  });
});

// ---------- a faixa "Próximo marco" (515): ela mostra SÓ o primeiro
// marco ainda não ganho — os ganhos ficam na estante do perfil; quando
// nada falta, a faixa vira o estado de conclusão ----------
describe("seleção do próximo marco (faixa da jornada, 515)", () => {
  const proximo = (r: ReturnType<typeof conquistasDoJovem>) =>
    r.marcos.find((m) => m.proximo) ?? null;

  it("jovem novo: o próximo é o 1º encontro — nenhum ganho renderiza", () => {
    const r = conquistasDoJovem(base({ duplas: [DUPLA_DPP] }));
    expect(proximo(r)?.chave).toBe("primeiro");
    // os demais são futuros, nunca "ganhos a caminho"
    expect(r.marcos.filter((m) => m.ganho)).toHaveLength(0);
  });

  it("1º encontro feito: o próximo salta pra avaliação, não pro ganho", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_DPP], encontros: [enc(1)] })
    );
    const p = proximo(r);
    expect(p?.chave).toBe("avaliou");
    expect(p?.ganho).toBe(false);
    // o marco ganho continua no array (alimenta a estante), mas não é o próximo
    expect(r.marcos.filter((m) => m.ganho).map((m) => m.chave)).toEqual([
      "primeiro",
    ]);
  });

  it("todos os marcos ganhos: sem próximo — a faixa vira conclusão", () => {
    const encontros = Array.from({ length: 16 }, (_, i) => enc(i + 1));
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros,
        avaliacoes: encontros.map((e, i) => ({
          encontro_id: e.id,
          dupla_id: "d1",
          created_at: `${dia(i + 1)}T20:00:00-03:00`,
        })),
        jornada: jornada([instrumento("pdm", [entrega()])]),
      })
    );
    expect(r.marcos.every((m) => m.ganho)).toBe(true);
    expect(proximo(r)).toBeNull();
  });
});

// ---------- níveis por tempo de programa (016): tempo dentro de dupla
// é o eixo, encontros realizados são o piso; toda data sai de carimbo
// real e o que falta é contagem, nunca data projetada.
const antes = (n: number): string => {
  const d = new Date(AGORA.getTime() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
};
/** encontro realizado `n` dias antes do AGORA */
const encAntes = (num: number, n: number, over: Partial<Enc> = {}): Enc =>
  enc(num, {
    realizado_em: `${antes(n)}T19:00:00-03:00`,
    data_hora: `${antes(n)}T19:00:00-03:00`,
    ...over,
  });
type Dupla = ConquistasInput["duplas"][number];
const dppDesde = (n: number, over: Partial<Dupla> = {}): Dupla => ({
  ...DUPLA_DPP,
  iniciada_em: antes(n),
  ...over,
});
const estados = (r: ReturnType<typeof conquistasDoJovem>) =>
  r.nivel!.faixas.map((f) => `${f.chave}:${f.estado}`);

describe("níveis da jornada", () => {
  it("sem jornada não tem nível", () => {
    expect(conquistasDoJovem(base()).nivel).toBeNull();
  });

  it("1 semana: Início, e Constância diz quanto falta em contagem", () => {
    const r = conquistasDoJovem(
      base({ duplas: [dppDesde(7)], encontros: [encAntes(1, 2)] })
    );
    expect(r.nivel!.atual).toBe("inicio");
    expect(r.nivel!.diasDePrograma).toBe(7);
    expect(estados(r)).toEqual([
      "inicio:ganho",
      "constancia:futuro",
      "veterania:futuro",
      "completa:futuro",
    ]);
    // o início é o dia em que a dupla começou
    expect(r.nivel!.faixas[0].data?.slice(0, 10)).toBe(antes(7));
    expect(r.nivel!.proximo).toEqual({
      chave: "constancia",
      falta: "Faltam 3 encontros e 23 dias",
      encontros: { atual: 1, alvo: 4 },
      dias: { atual: 7, alvo: 30 },
    });
    expect(r.nivel!.faixas[1].criterio).toBe(
      "1 mês de programa e 4 encontros com seu mentor"
    );
  });

  it("1 mês com 4 encontros: Constância datada pelo que veio por último", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(35)],
        encontros: [
          encAntes(1, 28),
          encAntes(2, 21),
          encAntes(3, 14),
          encAntes(4, 2),
        ],
      })
    );
    expect(r.nivel!.atual).toBe("constancia");
    // os 30 dias cruzaram 5 dias atrás; o 4º encontro, 2 dias atrás
    expect(r.nivel!.faixas[1].data).toBe(
      new Date(`${antes(2)}T19:00:00-03:00`).toISOString()
    );
    expect(r.nivel!.proximo).toMatchObject({
      chave: "veterania",
      falta: "Faltam 4 encontros e 55 dias",
    });
  });

  it("tempo sozinho não sobe de nível: 3 meses com 2 encontros é Início", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(95)],
        encontros: [encAntes(1, 80), encAntes(2, 60)],
      })
    );
    expect(r.nivel!.atual).toBe("inicio");
    expect(r.nivel!.proximo).toMatchObject({
      chave: "constancia",
      falta: "Faltam 2 encontros com seu mentor",
    });
  });

  it("3 meses com 8 encontros: Veterania; a próxima é a jornada completa", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(95)],
        encontros: Array.from({ length: 8 }, (_, i) =>
          encAntes(i + 1, 88 - i * 7)
        ),
      })
    );
    expect(r.nivel!.atual).toBe("veterania");
    expect(r.nivel!.faixas[2].titulo).toBe("Veterania");
    // 90 dias cruzaram 5 dias atrás — depois do 8º encontro (39 dias)
    expect(r.nivel!.faixas[2].data?.slice(0, 10)).toBe(antes(5));
    expect(r.nivel!.proximo).toEqual({
      chave: "completa",
      falta: "Faltam 8 encontros com seu mentor",
      encontros: { atual: 8, alvo: 16 },
      dias: null,
    });
  });

  it("programa completo: as 4 faixas ganhas e nada de próximo", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(130)],
        encontros: Array.from({ length: 16 }, (_, i) =>
          encAntes(i + 1, 120 - i * 7)
        ),
      })
    );
    expect(r.nivel!.atual).toBe("completa");
    expect(estados(r).every((e) => e.endsWith(":ganho"))).toBe(true);
    expect(r.nivel!.faixas[3].data).toBe(
      new Date(`${antes(15)}T19:00:00-03:00`).toISOString()
    );
    expect(r.nivel!.proximo).toBeNull();
  });

  it("cada faixa diz o que reconhece, por trilha", () => {
    const dpp = conquistasDoJovem(base({ duplas: [dppDesde(7)] }));
    expect(dpp.nivel!.faixas.map((f) => [f.titulo, f.detalhe])).toEqual([
      ["Início", "Toda jornada começa num primeiro passo. A sua já começou."],
      [
        "Constância",
        "Você seguiu firme no seu primeiro mês de programa, encontro após encontro.",
      ],
      [
        "Veterania",
        "3 meses de programa: você já tem história para contar aqui.",
      ],
      ["Jornada completa", "Você completou os encontros com seu mentor."],
    ]);
    const esp = conquistasDoJovem(
      base({ duplas: [DUPLA_ESP], encontros: [encEsp(1)] })
    );
    expect(esp.nivel!.faixas.map((f) => f.detalhe).slice(1)).toEqual([
      "Você seguiu firme no seu primeiro mês de programa, sessão após sessão.",
      "2 meses de programa: você já tem história para contar aqui.",
      "Você completou as sessões com especialista.",
    ]);
  });

  it("trilha de especialista usa a régua dela, não a DPP", () => {
    const esp = { ...DUPLA_ESP, iniciada_em: antes(40) };
    const r = conquistasDoJovem(
      base({
        duplas: [esp],
        encontros: [
          encAntes(1, 35, { id: "es1", dupla_id: "d2" }),
          encAntes(2, 20, { id: "es2", dupla_id: "d2" }),
        ],
      })
    );
    expect(r.nivel!.atual).toBe("constancia");
    expect(r.nivel!.faixas.map((f) => f.criterio)).toEqual([
      "Começar a trilha com especialista",
      "1 mês de programa e 2 sessões com especialista",
      "2 meses de programa e 3 sessões com especialista",
      "Completar as 5 sessões com especialista",
    ]);
    expect(r.nivel!.proximo).toMatchObject({
      chave: "veterania",
      falta: "Falta 1 sessão e 20 dias",
    });
  });

  it("trilha que fecha antes do tempo: faixas puladas ficam superadas, sem data", () => {
    const esp = {
      ...DUPLA_ESP,
      status: "concluida",
      iniciada_em: antes(30),
      encerrada_em: antes(6),
    };
    const r = conquistasDoJovem(
      base({
        duplas: [esp],
        encontros: [28, 23, 18, 12, 7].map((d, i) =>
          encAntes(i + 1, d, { id: `es${i + 1}`, dupla_id: "d2" })
        ),
      })
    );
    expect(r.nivel!.atual).toBe("completa");
    expect(estados(r)).toEqual([
      "inicio:ganho",
      "constancia:superado",
      "veterania:superado",
      "completa:ganho",
    ]);
    expect(r.nivel!.faixas[1].data).toBeNull();
    expect(r.nivel!.diasDePrograma).toBe(24);
  });

  it("sem data de início nem encontro: nenhuma faixa e nenhuma data", () => {
    const r = conquistasDoJovem(
      base({ duplas: [dppDesde(0, { iniciada_em: null })] })
    );
    expect(r.nivel!.atual).toBeNull();
    expect(r.nivel!.diasDePrograma).toBeNull();
    expect(r.nivel!.faixas.every((f) => f.data === null)).toBe(true);
    expect(r.nivel!.proximo).toMatchObject({
      chave: "inicio",
      falta: "Falta 1 encontro com seu mentor",
      dias: null,
    });
  });

  it("sem iniciada_em, o 1º encontro abre a contagem", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(0, { iniciada_em: null })],
        encontros: [encAntes(1, 12)],
      })
    );
    expect(r.nivel!.atual).toBe("inicio");
    expect(r.nivel!.diasDePrograma).toBe(12);
  });

  it("dupla encerrada para o relógio no encerramento e some a contagem", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [
          dppDesde(240, { status: "encerrada", encerrada_em: antes(200) }),
        ],
        encontros: [230, 225, 218, 210].map((d, i) => encAntes(i + 1, d)),
      })
    );
    expect(r.nivel!.diasDePrograma).toBe(40);
    expect(r.nivel!.atual).toBe("constancia");
    expect(r.nivel!.parada).toBe("encerrada");
    expect(r.nivel!.proximo).toMatchObject({ chave: "veterania", falta: null });
  });

  it("dupla pausada: o nível fica, a contagem do próximo não anda", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [dppDesde(20, { status: "pausada" })],
        encontros: [encAntes(1, 14)],
      })
    );
    expect(r.nivel!.parada).toBe("pausada");
    expect(r.nivel!.atual).toBe("inicio");
    expect(r.nivel!.proximo?.falta).toBeNull();
  });

  it("remanejo: dias somam dentro de dupla, a lacuna entre elas não conta", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [
          dppDesde(100, {
            id: "d0",
            status: "encerrada",
            encerrada_em: antes(80),
          }),
          dppDesde(15),
        ],
        encontros: [encAntes(1, 95, { dupla_id: "d0", id: "x1" }), encAntes(2, 10)],
      })
    );
    expect(r.nivel!.diasDePrograma).toBe(35);
    expect(r.nivel!.parada).toBeNull();
  });
});

describe("conquistas futuras", () => {
  it("nunca carregam data — o futuro não se carimba", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [enc(1)],
        jornada: jornada([
          instrumento("metas", [
            entrega({ status: "pendente", respondido_em: null, respostas: null }),
          ]),
        ]),
        encaminhamentos: [{ status: "pendente", created_at: "2026-03-05T12:00:00-03:00" }],
      })
    );
    expect(r.futuras.length).toBeGreaterThan(0);
    for (const f of r.futuras) expect("data" in f).toBe(false);
  });

  it("marcos restantes, instrumento pendente e contas que faltam, com critério", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: Array.from({ length: 4 }, (_, i) => enc(i + 1)),
        jornada: jornada([
          instrumento("metas", [
            entrega({ status: "pendente", respondido_em: null, respostas: null }),
          ]),
        ]),
        encaminhamentos: [
          { status: "pendente", created_at: "2026-03-05T12:00:00-03:00" },
          { status: "atrasado", created_at: "2026-03-06T12:00:00-03:00" },
        ],
      })
    );
    const porChave = new Map(r.futuras.map((f) => [f.chave, f]));
    expect(porChave.get("marco:metade")).toMatchObject({
      criterio: "Chegar a 8 encontros com seu mentor",
      linha: "Faltam 4 encontros com seu mentor",
      progresso: { atual: 4, alvo: 8 },
      proximo: true,
    });
    expect(porChave.get("marco:completo")).toMatchObject({
      criterio: "Completar os 16 encontros com seu mentor",
      proximo: false,
    });
    expect(porChave.get("inst:metas")).toMatchObject({
      criterio: "Definir as suas metas",
      progresso: null,
    });
    expect(porChave.get("conta:avaliacoes")).toMatchObject({
      linha: "Falta avaliar o encontro 1",
    });
    expect(porChave.get("conta:combinados")).toMatchObject({
      linha: "2 combinados em aberto",
    });
    // a estante segue earned-only: nada futuro vazou pra lá (o run de 4
    // seguidos já carimbou o tier 1 da presença)
    expect(chaves(r)).toEqual(["marco:primeiro", "conta:presenca-1"]);
    expect(r.conquistas[0].criterio).toBe("Ter o 1º encontro com seu mentor");
  });

  it("especialista sem combinado em aberto não ganha promessa de combinado", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_ESP], encontros: [encEsp(1)] })
    );
    expect(r.futuras.map((f) => f.chave)).not.toContain("conta:combinados");
  });

  it("tudo conquistado: área de futuras vazia", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        // 16 seguidos com 200min cada: presença e horas fecham a escada
        encontros: Array.from({ length: 16 }, (_, i) =>
          enc(i + 1, { duracao_min: 200 })
        ),
        avaliacoes: Array.from({ length: 30 }, (_, i) => ({
          encontro_id: `e${(i % 16) + 1}`,
          dupla_id: "d1",
          created_at: `${dia(1)}T2${i % 10}:00:00-03:00`,
        })),
        encaminhamentos: Array.from({ length: 50 }, (_, i) => ({
          status: "feito",
          created_at: `2026-03-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00-03:00`,
        })),
        pdmItens: [
          ...Array.from({ length: 5 }, (_, i) => ({
            parentId: null,
            status: "atingida",
            atingidaEm: `2026-03-0${i + 1}T12:00:00-03:00`,
          })),
          ...Array.from({ length: 25 }, (_, i) => ({
            parentId: `m${1 + (i % 5)}`,
            status: "atingida",
            atingidaEm: `2026-04-0${(i % 9) + 1}T12:00:00-03:00`,
          })),
        ],
        perfil: {
          whatsapp: "5511999990000",
          disponibilidade: { ter: ["noite"] },
          bioOuInteresses: true,
        },
        assinaturas: [
          {
            slug: "termo-mentorando",
            status: "assinado",
            assinado_em: "2026-02-20T12:00:00-03:00",
          },
        ],
      })
    );
    expect(r.futuras).toEqual([]);
  });
});

// ---------- famílias com tiers (024): uma peça evolutiva por contagem —
// a estante guarda só o maior degrau, a futura mostra o próximo, e a
// derivação é pura nos dois sentidos (contagem caiu, degrau desce junto)
describe("famílias com tiers", () => {
  const feitos = (n: number): ConquistasInput["encaminhamentos"] =>
    Array.from({ length: n }, (_, i) => ({
      status: "feito",
      created_at: `2026-03-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00-03:00`,
    }));

  it("sem jornada, as peças gerais ainda chegam como futuras", () => {
    const r = conquistasDoJovem(base());
    expect(r.temJornada).toBe(false);
    expect(r.conquistas).toEqual([]);
    expect(r.futuras.map((f) => f.familia).sort()).toEqual([
      "perfil",
      "termo",
    ]);
  });

  it("a estante guarda só o MAIOR tier e a futura mostra o próximo degrau", () => {
    const r = conquistasDoJovem(
      base({ duplas: [DUPLA_DPP], encaminhamentos: feitos(6) })
    );
    const comb = r.conquistas.filter((c) => c.familia === "combinados");
    expect(comb.map((c) => c.chave)).toEqual(["conta:combinados-1"]);
    expect(comb[0]).toMatchObject({
      tier: 1,
      raridade: "inicial",
      data: null, // a view não expõe feito_em — data honesta
      titulo: "Palavra cumprida",
    });
    expect(comb[0].tiers!.map((t) => [t.n, t.ganho])).toEqual([
      [1, true],
      [2, false],
      [3, false],
      [4, false],
    ]);
    expect(comb[0].proximo).toMatchObject({
      n: 2,
      titulo: "De palavra",
      progresso: { atual: 6, alvo: 15 },
    });
    const fut = r.futuras.find((f) => f.chave === "conta:combinados-2")!;
    expect(fut.linha).toBe("Faltam 9 combinados com seu mentor");
    expect(fut.glifo).toEqual({
      tipo: "familia",
      familia: "combinados",
      tier: 2,
    });
  });

  it("regressão honesta: a contagem cai e a peça desce de degrau", () => {
    const antes = conquistasDoJovem(
      base({ duplas: [DUPLA_DPP], encaminhamentos: feitos(16) })
    );
    expect(chaves(antes)).toContain("conta:combinados-2");
    const depois = conquistasDoJovem(
      base({ duplas: [DUPLA_DPP], encaminhamentos: feitos(14) })
    );
    expect(chaves(depois)).not.toContain("conta:combinados-2");
    expect(chaves(depois)).toContain("conta:combinados-1");
    expect(depois.futuras.map((f) => f.chave)).toContain(
      "conta:combinados-2"
    );
  });

  it("horas deduplicam por sessao_id e carimbam o cruzamento do limiar", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [
          enc(1, { duracao_min: 60 }),
          enc(2, { duracao_min: 90 }),
          enc(3, { duracao_min: 60, sessao_id: "s1" }),
          enc(4, { duracao_min: 60, sessao_id: "s1" }), // a mesma hora física
          enc(5, { duracao_min: 75 }),
          enc(6, { duracao_min: 90 }),
          enc(7, { duracao_min: null }), // sem minuto não soma nada
          enc(8, { duracao_min: 75 }),
        ],
      })
    );
    // 60+90+60+75+90+75 = 450min → o tier 1 (7h=420) cruzou no 8º encontro
    const h = r.conquistas.find((c) => c.familia === "horas")!;
    expect(h.chave).toBe("conta:horas-1");
    expect(h.titulo).toBe("Sete horas");
    expect(h.data).toBe(`${dia(8)}T19:00:00-03:00`);
    const fut = r.futuras.find((f) => f.familia === "horas")!;
    expect(fut.chave).toBe("conta:horas-2");
    // a barra mostra horas de verdade, não minutos
    expect(fut.progresso).toEqual({ atual: 7, alvo: 15 });
  });

  it("metas e submetas contam os 'atingida' do PDM por parentId, só na DPP", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        pdmItens: [
          {
            parentId: null,
            status: "atingida",
            atingidaEm: "2026-03-10T12:00:00-03:00",
          },
          { parentId: null, status: "ativa", atingidaEm: null },
          // descartada não infla nenhuma das duas contagens
          {
            parentId: null,
            status: "descartada",
            atingidaEm: "2026-03-01T12:00:00-03:00",
          },
          {
            parentId: "a",
            status: "atingida",
            atingidaEm: "2026-03-12T12:00:00-03:00",
          },
          {
            parentId: "a",
            status: "atingida",
            atingidaEm: "2026-03-13T12:00:00-03:00",
          },
          {
            parentId: "b",
            status: "atingida",
            atingidaEm: "2026-03-14T12:00:00-03:00",
          },
        ],
      })
    );
    const metas = r.conquistas.find((c) => c.familia === "metas")!;
    expect(metas.chave).toBe("pdm:metas-1");
    expect(metas.data).toBe("2026-03-10T12:00:00-03:00");
    const subs = r.conquistas.find((c) => c.familia === "submetas")!;
    expect(subs.chave).toBe("pdm:submetas-1"); // 3 submetas atingidas
    // a trilha de especialista não tem PDM: a família não nasce
    const esp = conquistasDoJovem(
      base({
        duplas: [DUPLA_ESP],
        encontros: [encEsp(1)],
        pdmItens: [
          {
            parentId: null,
            status: "atingida",
            atingidaEm: "2026-03-10T12:00:00-03:00",
          },
        ],
      })
    );
    expect(esp.conquistas.some((c) => c.familia === "metas")).toBe(false);
    expect(esp.futuras.some((f) => f.familia === "metas")).toBe(false);
  });

  it("avaliações carimbam o created_at da avaliação do limiar", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        avaliacoes: Array.from({ length: 5 }, (_, i) => ({
          encontro_id: `e${i + 1}`,
          dupla_id: "d1",
          created_at: `2026-03-0${i + 1}T12:00:00-03:00`,
        })),
      })
    );
    const a = r.conquistas.find((c) => c.familia === "avaliacoes")!;
    expect(a.chave).toBe("conta:avaliacoes-1");
    expect(a.titulo).toBe("Voz treinada");
    expect(a.data).toBe("2026-03-05T12:00:00-03:00"); // a 5ª, não a 1ª
    expect(a.raridade).toBe("inicial");
  });

  it("presença: nao_aconteceu quebra a sequência, agendado não", () => {
    const r = conquistasDoJovem(
      base({
        duplas: [DUPLA_DPP],
        encontros: [
          enc(1),
          enc(2),
          enc(3),
          enc(4, { status: "nao_aconteceu", realizado_em: null }),
          enc(5, { status: "agendado", realizado_em: null }),
          enc(6),
          enc(7),
          enc(8),
          enc(9),
        ],
      })
    );
    // o run atual é 4 (encontros 6–9): só o tier 1, carimbado no último
    expect(chaves(r)).toContain("conta:presenca-1");
    expect(chaves(r)).not.toContain("conta:presenca-2");
    expect(r.conquistas.find((c) => c.familia === "presenca")!.data).toBe(
      `${dia(9)}T19:00:00-03:00`
    );
  });

  it("perfil completo ganha 'Cara do lugar'; a falta vira linha honesta", () => {
    const r = conquistasDoJovem(
      base({
        perfil: {
          whatsapp: "5511999990000",
          disponibilidade: { ter: ["noite"] },
          bioOuInteresses: true,
        },
      })
    );
    const p = r.conquistas.find((c) => c.familia === "perfil")!;
    expect(p.chave).toBe("perfil:completo-1");
    expect(p.titulo).toBe("Cara do lugar");
    const semZap = conquistasDoJovem(
      base({
        perfil: {
          whatsapp: null,
          disponibilidade: { ter: ["noite"] },
          bioOuInteresses: true,
        },
      })
    );
    expect(semZap.futuras.find((f) => f.familia === "perfil")!.linha).toBe(
      "Falta preencher: WhatsApp"
    );
    const faltandoDuas = conquistasDoJovem(
      base({
        perfil: {
          whatsapp: null,
          disponibilidade: null,
          bioOuInteresses: true,
        },
      })
    );
    expect(
      faltandoDuas.futuras.find((f) => f.familia === "perfil")!.linha
    ).toBe("Faltam preencher: WhatsApp e disponibilidade");
  });

  it("o termo assinado carimba assinado_em; pendente ou ausente vira futura", () => {
    const r = conquistasDoJovem(
      base({
        assinaturas: [
          {
            slug: "termo-mentorando",
            status: "assinado",
            assinado_em: "2026-02-20T12:00:00-03:00",
          },
        ],
      })
    );
    const t = r.conquistas.find((c) => c.familia === "termo")!;
    expect(t.chave).toBe("doc:termo-1");
    expect(t.data).toBe("2026-02-20T12:00:00-03:00");
    // outro documento assinado não vale: o slug certo é o termo-mentorando
    const outro = conquistasDoJovem(
      base({
        assinaturas: [
          {
            slug: "autorizacao-responsavel",
            status: "assinado",
            assinado_em: "2026-02-20T12:00:00-03:00",
          },
        ],
      })
    );
    expect(outro.futuras.some((f) => f.familia === "termo")).toBe(true);
  });
});

// ---------- paridade demo (024): a persona mentorado precisa ter uma
// família em tier ganho, uma futura com progresso e nível pro selo
describe("paridade demo (persona mentorado)", () => {
  it("a Ana tem tier ganho, futura com progresso e nível pro selo", () => {
    const duplas = demoJovemDuplas("mentorado");
    const perfil = demoJovemPerfil("mentorado")!;
    const me = demoMe("mentorado", true);
    const pdmItens = duplas
      .filter((d) => d.id != null && (d.trilha ?? "dpp") !== "especialista")
      .flatMap(
        (d) =>
          (demoPdmDaDupla("mentorado", d.id!)?.itens ?? []).map((i) => ({
            parentId: i.parentId,
            status: i.status,
            atingidaEm: i.atingidaEm,
          }))
      );
    const r = conquistasDoJovem({
      encontros: demoJovemEncontros("mentorado"),
      duplas,
      jornada: demoJovemJornada("mentorado"),
      avaliacoes: demoJovemAvaliacoes("mentorado"),
      encaminhamentos: demoJovemEncaminhamentos("mentorado"),
      assinaturas: demoJovemAssinaturas("mentorado", null),
      pdmItens,
      perfil: {
        whatsapp: perfil.whatsapp,
        disponibilidade: perfil.disponibilidade,
        bioOuInteresses:
          !!me.bio?.trim() || (me.interesses?.length ?? 0) > 0,
      },
    });
    // o selo "Seu nível" do header renderiza
    expect(r.nivel).not.toBeNull();
    expect(r.nivel!.atual).not.toBeNull();
    // pelo menos uma família em tier ganho (presença e perfil, na conta)
    expect(r.conquistas.some((c) => c.familia === "presenca")).toBe(true);
    expect(r.conquistas.some((c) => c.familia === "perfil")).toBe(true);
    // e pelo menos uma futura já com progresso honesto
    expect(
      r.futuras.some((f) => f.progresso != null && f.progresso.atual > 0)
    ).toBe(true);
  });
});
