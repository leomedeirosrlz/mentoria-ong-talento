import { describe, expect, it } from "vitest";
import { conquistasDoJovem, type ConquistasInput } from "./conquistas";
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
    expect(chaves(r)).toEqual(["marco:primeiro", "marco:metade"]);
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
    expect(aval.data).toBe(new Date("2026-03-20T12:00:00-03:00").toISOString());

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
