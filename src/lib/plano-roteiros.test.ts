import { describe, expect, it } from "vitest";
import {
  contextoRoteiro,
  materiaisComRoteiroPlano,
  montarDocCombinado,
  montarRoteiro,
  numerosMarcadosDe,
  numerosRealizadosDe,
  roteiroForaDeVersao,
  roteirosDevidos,
  rotuloStatusRoteiro,
  slugRoteiro,
} from "./plano-roteiros";
import type { CorpusDoc } from "./materiais/corpus-doc";
import type { DuplaPlanoRoteiro } from "./types";

/** Montagem determinística dos documentos do plano (020) — o lazy, o
 *  roteiro semanal e o doc do combinado, todos testáveis sem banco. */

const corpusFake: CorpusDoc = {
  slug: "roteiro-encontro-07",
  fonte: "roteiro-encontro-07",
  titulo: "Roteiro do 7º encontro: Ajustes no Plano",
  tipo: null,
  natureza: null,
  versao: null,
  origem: null,
  audiencia: ["todos"],
  lede: [],
  ledeAnchor: null,
  secoes: [
    {
      secao: "ficha",
      titulo: "7º encontro · Ficha do encontro",
      grupo: null,
      nivel: 2,
      anchor: "ficha",
      fase: null,
      blocos: [
        { kind: "lista", itens: ["<b>Duração:</b> 1h", "<b>Foco:</b> ajuste"] },
      ],
    },
    {
      secao: "durante",
      titulo: "7º encontro · Durante o encontro",
      grupo: null,
      nivel: 2,
      anchor: "durante",
      fase: null,
      blocos: [
        { kind: "subtitulo", texto: "Momento 1", nivel: 3 },
        { kind: "par", html: "Abertura." },
      ],
    },
  ],
};

describe("roteirosDevidos — a régua lazy (FR-003)", () => {
  it("primeiro encontro marcado → semana 1 devida; encontro N concluído → N+1, nunca N+2", () => {
    // nada marcado, nada feito → nada devido
    expect(
      roteirosDevidos({ numeros: [5, 6], marcados: [], realizados: [] })
    ).toEqual([]);
    // 5 marcado → só a semana 5
    expect(
      roteirosDevidos({ numeros: [5, 6], marcados: [5], realizados: [] })
    ).toEqual([5]);
    // 5 realizado, 6 marcado → só a 6 (a 5 já passou, não ganha retroativo)
    expect(
      roteirosDevidos({ numeros: [5, 6], marcados: [6], realizados: [5] })
    ).toEqual([6]);
    // 5 e 6 feitos, 7 do plano e 8 fora — 7 devida (a seguinte), nunca 8
    expect(
      roteirosDevidos({
        numeros: [5, 6, 7, 8],
        marcados: [],
        realizados: [5, 6],
      })
    ).toEqual([7]);
  });

  it("encontro já realizado não ganha roteiro retroativo", () => {
    expect(
      roteirosDevidos({ numeros: [5, 6], marcados: [], realizados: [5] })
    ).toEqual([6]);
  });

  it("remarcado e nao_aconteceu ocupam calendário como marcado", () => {
    expect(
      numerosMarcadosDe([
        { numero: 5, status: "remarcado" },
        { numero: 6, status: "nao_aconteceu" },
        { numero: 7, status: "cancelado" },
      ])
    ).toEqual([5, 6]);
    expect(
      numerosRealizadosDe([
        { numero: 5, status: "realizado" },
        { numero: 6, status: "agendado" },
      ])
    ).toEqual([5]);
  });
});

describe("montarRoteiro — corpus + contexto + ajustes", () => {
  it("abre com o contexto do plano e fecha com as seções do corpus", () => {
    const blocos = montarRoteiro(corpusFake, {
      numero: 7,
      passo: { data: "2026-12-02", sessao: "s1", duracao_min: 120 },
      sessaoGrupo: [6, 7],
      ajustes: [{ sugestao: "Começa 15min antes", justificativa: "agenda da escola" }],
      recesso: { titulo: "Recesso de fim de ano" },
    });
    expect(blocos[0]).toMatchObject({ kind: "callout", tom: "tip" });
    expect((blocos[0] as { html: string }).html).toContain("Do plano de vocês");
    expect((blocos[0] as { html: string }).html).toContain("Recesso de fim de ano");
    expect(blocos[1]).toMatchObject({ kind: "callout", tom: "info" });
    // o prefixo "7º encontro · " some do subtítulo
    const subs = blocos.filter((b) => b.kind === "subtitulo");
    expect(subs.map((s) => (s as { texto: string }).texto)).toEqual([
      "Ficha do encontro",
      "Durante o encontro",
      "Momento 1",
    ]);
    // o corpo do corpus vem inteiro depois dos contextos
    expect(blocos.at(-1)).toMatchObject({ kind: "par", html: "Abertura." });
  });

  it("corpus ausente → só o contexto (nunca quebra)", () => {
    const blocos = montarRoteiro(null, { numero: 3, passo: { data: "2026-12-02" } });
    expect(blocos).toHaveLength(1);
    expect(blocos[0].kind).toBe("callout");
  });

  it("sem contexto nenhum → o corpus puro", () => {
    const blocos = montarRoteiro(corpusFake, { numero: 7 });
    expect(blocos[0]).toMatchObject({ kind: "subtitulo", texto: "Ficha do encontro" });
  });
});

describe("montarDocCombinado — o documento antes do aceite", () => {
  const escopo = {
    numeros: [5, 6],
    ritmo: 1,
    janela: { inicio: "2026-11-24", fim: "2027-02-20" },
    passos: [
      { numero: 5, data: "2026-11-26", acao: "agendar" },
      { numero: 6, data: "2026-12-03", acao: "remarcar", sessao: "s1", duracao_min: 120 },
      { numero: 7, data: "2026-12-03", acao: "agendar", sessao: "s1", duracao_min: 120 },
    ],
  };

  it("cobra proposta, ritmo, encontros (com sessão e estado) e a regra", () => {
    const blocos = montarDocCombinado({
      status: "proposto",
      versao: 2,
      propostoEm: "2026-11-23T10:00:00Z",
      quemPropos: "A equipe",
      escopo,
      aceites: { mentor: true, mentorado: false },
      nomes: { mentor: "Ricardo", mentorado: "Ana" },
      recessos: [
        { titulo: "Fim de ano", inicio: "2026-12-20", fim: "2027-01-31", usa: true },
      ],
      marcados: new Map([[5, "2026-11-28"]]),
      realizados: [],
    });
    const texto = JSON.stringify(blocos);
    expect(texto).toContain("A equipe");
    expect(texto).toContain("versão 2");
    expect(texto).toContain("1 encontro por semana");
    expect(texto).toContain("remarcação");
    expect(texto).toContain("mesma sessão");
    expect(texto).toContain("marcado pra");
    expect(texto).toContain("pausa combinada");
    expect(texto).toContain("Ricardo aceitou");
    expect(texto).toContain("Ana ainda não respondeu");
    // todas as seções previstas
    const subs = blocos
      .filter((b) => b.kind === "subtitulo")
      .map((b) => (b as { texto: string }).texto);
    expect(subs).toEqual([
      "O ritmo",
      "Os encontros",
      "Recessos no caminho",
      "Como vale",
    ]);
  });

  it("escopo sem numeros vira aviso, nunca quebra", () => {
    const blocos = montarDocCombinado({ status: "ativo", versao: 1, escopo: null });
    expect(blocos).toHaveLength(1);
    expect(blocos[0].kind).toBe("callout");
  });
});

describe("helpers de status e a troca do link", () => {
  const row = (o: Partial<DuplaPlanoRoteiro>): DuplaPlanoRoteiro =>
    ({
      id: "r1",
      dupla_id: "d",
      plano_id: "p",
      numero: 5,
      versao: 1,
      plano_versao: 1,
      conteudo: [],
      status: "publicado",
      gerado_por: null,
      gerado_via: "app",
      gerado_em: "",
      editado_por: null,
      publicado_por: null,
      publicado_em: null,
      updated_at: "",
      ...o,
    }) as DuplaPlanoRoteiro;

  it("rótulos e a marca de versão anterior", () => {
    expect(rotuloStatusRoteiro(row({ status: "publicado" }))).toBe("Vigente");
    expect(rotuloStatusRoteiro(row({ status: "rascunho" }))).toBe("Rascunho");
    expect(rotuloStatusRoteiro(row({ status: "substituido" }))).toBe("Versão anterior");
    expect(roteiroForaDeVersao(row({ plano_versao: 1 }), { versao: 2 })).toBe(true);
    expect(roteiroForaDeVersao(row({ plano_versao: 2 }), { versao: 2 })).toBe(false);
  });

  it("a disclosure troca o roteiro do corpus pelo vigente da dupla", () => {
    const materiais = [
      { href: "/materiais/documento/roteiro-encontro-07", titulo: "Roteiro do 7º" },
      { href: "/materiais/documento/ficha-padrao", titulo: "Ficha" },
    ];
    const com = materiaisComRoteiroPlano(materiais, {
      numero: 7,
      href: "/duplas/d/roteiro/7",
    });
    expect(com[0].href).toBe("/duplas/d/roteiro/7");
    expect(com.some((m) => m.href.includes("roteiro-encontro-07"))).toBe(false);
    expect(com.some((m) => m.href.includes("ficha-padrao"))).toBe(true);
    // sem vigente a lista fica intacta
    expect(materiaisComRoteiroPlano(materiais, null)).toEqual(materiais);
  });

  it("slug canônico", () => {
    expect(slugRoteiro(7)).toBe("roteiro-encontro-07");
    expect(slugRoteiro(16)).toBe("roteiro-encontro-16");
  });
});

describe("contextoRoteiro — o que o plano injeta no roteiro", () => {
  it("acha o passo, o grupo da sessão e o recesso que cobre a data", () => {
    const plano = {
      escopo: {
        numeros: [6, 7],
        passos: [
          { numero: 6, data: "2026-12-03", acao: "agendar", sessao: "s1" },
          { numero: 7, data: "2026-12-03", acao: "agendar", sessao: "s1" },
        ],
      },
    } as never;
    const ctx = contextoRoteiro(plano, 7, {
      recessos: [
        { titulo: "Férias", inicio: "2026-12-01", fim: "2026-12-31", usa: false },
        { titulo: "Outro", inicio: "2027-01-01", fim: "2027-01-31", usa: null },
      ],
    });
    expect(ctx.passo?.data).toBe("2026-12-03");
    expect(ctx.sessaoGrupo).toEqual([6, 7]);
    expect(ctx.recesso?.titulo).toBe("Férias");
    // recesso pausado não cobre data de encontro — só o que a dupla
    // decidiu atravessar (usa=false) vira contexto de roteiro
    const ctx2 = contextoRoteiro(plano, 7, {
      recessos: [
        { titulo: "Outro", inicio: "2026-12-01", fim: "2026-12-31", usa: true },
      ],
    });
    expect(ctx2.recesso).toBeNull();
  });
});
