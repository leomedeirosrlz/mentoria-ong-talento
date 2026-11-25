import { describe, expect, it } from "vitest";
import type {
  Conquista,
  NiveisJornada,
  NivelJornada,
} from "@/lib/conquistas";
import {
  MAX_SELOS,
  chaveDoSelo,
  escolhaValida,
  lerEscolha,
  opcaoDoSelo,
  pecasEscolhiveis,
  selosDoPerfil,
  serializaEscolha,
} from "@/lib/selos-perfil";

// REALIZA-529 — "até 3 selos no perfil": a regra mora na lib pura. A
// escolha guarda a família sem o degrau (acompanha a evolução), nunca
// passa de 3, nunca vaza pra outra pessoa e nunca nasce vazia sem o
// jovem ter pedido.

const TOM = { cor: "#000", tinta: "#fff" };
const faixa = (
  chave: NivelJornada["chave"],
  estado: NivelJornada["estado"]
): NivelJornada => ({
  chave,
  titulo: chave,
  criterio: "c",
  detalhe: "d",
  estado,
  data: estado === "ganho" ? "2026-03-01" : null,
  glifo: { tipo: "nivel", chave },
  tom: TOM,
});
const NIVEL = {
  faixas: [
    faixa("inicio", "ganho"),
    faixa("constancia", "ganho"),
    faixa("veterania", "futuro"),
    faixa("completa", "futuro"),
  ],
  atual: "constancia",
} as unknown as NiveisJornada;

const conq = (chave: string, data: string | null, familia = false): Conquista =>
  ({
    chave,
    titulo: chave,
    detalhe: "",
    data,
    criterio: "",
    glifo: { tipo: "phosphor", nome: "flag" },
    tom: TOM,
    ...(familia ? { familia: "combinados", tier: 2 } : {}),
  }) as Conquista;

const ESTANTE = [
  conq("marco:primeiro", "2026-03-10"),
  conq("conta:combinados-2", "2026-04-01", true),
  conq("inst:visao", "2026-03-20"),
  conq("conta:avaliacoes", null),
];

describe("chaveDoSelo", () => {
  it("família perde o degrau; o resto mantém a chave", () => {
    expect(chaveDoSelo(ESTANTE[1])).toBe("conta:combinados");
    expect(chaveDoSelo(ESTANTE[0])).toBe("marco:primeiro");
  });
});

describe("pecasEscolhiveis", () => {
  it("traz as faixas ganhas (a mais alta primeiro) e a estante; faixa futura e superada ficam de fora", () => {
    const n = {
      ...NIVEL,
      faixas: [
        faixa("inicio", "superado"),
        faixa("constancia", "ganho"),
        faixa("veterania", "futuro"),
        faixa("completa", "futuro"),
      ],
    } as NiveisJornada;
    expect(pecasEscolhiveis(n, ESTANTE).map((p) => p.chave)).toEqual([
      "nivel:constancia",
      "marco:primeiro",
      "conta:combinados",
      "inst:visao",
      "conta:avaliacoes",
    ]);
  });

  it("sem nível, só a estante", () => {
    expect(pecasEscolhiveis(null, ESTANTE)).toHaveLength(4);
  });
});

describe("selosDoPerfil", () => {
  const pecas = pecasEscolhiveis(NIVEL, ESTANTE);

  it("sem escolha: a faixa atual e as duas conquistas mais recentes", () => {
    expect(selosDoPerfil(pecas, null).map((p) => p.chave)).toEqual([
      "nivel:constancia",
      "conta:combinados",
      "inst:visao",
    ]);
  });

  it("com escolha: só ela, na ordem dela", () => {
    expect(
      selosDoPerfil(pecas, ["inst:visao", "nivel:inicio"]).map((p) => p.chave)
    ).toEqual(["inst:visao", "nivel:inicio"]);
  });

  it("escolha vazia é respeitada: perfil sem selos", () => {
    expect(selosDoPerfil(pecas, [])).toEqual([]);
  });

  it("chave que a pessoa não tem mais some em silêncio", () => {
    expect(
      selosDoPerfil(pecas, ["marco:metade", "marco:primeiro"]).map((p) => p.chave)
    ).toEqual(["marco:primeiro"]);
  });

  it("nunca passa de 3, nem com cookie adulterado", () => {
    expect(
      selosDoPerfil(pecas, pecas.map((p) => p.chave)).length
    ).toBeLessThanOrEqual(MAX_SELOS);
  });

  it("sem faixa, a vitrine padrão é só as conquistas recentes", () => {
    const so = pecasEscolhiveis(null, ESTANTE);
    expect(selosDoPerfil(so, null).map((p) => p.chave)).toEqual([
      "conta:combinados",
      "inst:visao",
      "marco:primeiro",
    ]);
  });
});

describe("escolhaValida", () => {
  it("aceita 0 a 3 chaves bem formadas e únicas", () => {
    expect(escolhaValida([])).toEqual([]);
    expect(escolhaValida(["marco:primeiro", "conta:combinados"])).toEqual([
      "marco:primeiro",
      "conta:combinados",
    ]);
  });

  it("recusa 4 chaves, duplicadas, tortas ou de outro tipo", () => {
    expect(
      escolhaValida(["a:b", "c:d", "e:f", "g:h"])
    ).toBeNull();
    expect(escolhaValida(["a:b", "a:b"])).toBeNull();
    expect(escolhaValida(["sem-dois-pontos"])).toBeNull();
    expect(escolhaValida(["a:b|c:d"])).toBeNull();
    expect(escolhaValida("a:b")).toBeNull();
    expect(escolhaValida([1])).toBeNull();
  });
});

describe("cookie da escolha", () => {
  it("vai e volta pelo dono", () => {
    const raw = serializaEscolha("ficha-1", ["nivel:inicio", "inst:visao"]);
    expect(lerEscolha(raw, "ficha-1")).toEqual(["nivel:inicio", "inst:visao"]);
  });

  it("outro dono no mesmo navegador não herda a vitrine", () => {
    const raw = serializaEscolha("ficha-1", ["nivel:inicio"]);
    expect(lerEscolha(raw, "ficha-2")).toBeNull();
  });

  it("escolha vazia sobrevive (é diferente de não ter escolhido)", () => {
    expect(lerEscolha(serializaEscolha("f", []), "f")).toEqual([]);
    expect(lerEscolha(undefined, "f")).toBeNull();
  });

  it("valor torto vira 'sem escolha'", () => {
    expect(lerEscolha("f|a:b|c:d|e:f|g:h", "f")).toBeNull();
    expect(lerEscolha("f|lixo", "f")).toBeNull();
  });
});

describe("opcaoDoSelo", () => {
  it("faixa vira 'Nível' e conquista datada mostra a data", () => {
    const pecas = pecasEscolhiveis(NIVEL, ESTANTE);
    expect(opcaoDoSelo(pecas[0]).linha).toBe("Nível");
    expect(opcaoDoSelo(pecas[2]).titulo).toBe("marco:primeiro");
    expect(opcaoDoSelo(pecas[2]).linha).toBe("10 de mar. de 2026");
  });
});
