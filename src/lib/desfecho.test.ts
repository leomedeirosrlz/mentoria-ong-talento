import { describe, expect, it } from "vitest";
import {
  DESFECHO_N_MIN,
  DESFECHO_POSITIVAS,
  DESFECHO_SITUACOES,
  desfechoPositivo,
  formatPct,
  leRespostaDesfecho,
  montaDesfechoCard,
  parseDesfechoAgregado,
  type DesfechoAgregado,
} from "./desfecho";

// Régua e vocabulário do "Depois da mentoria" (REALIZA-216) — as listas
// são a fronteira de privacidade: uma opção fora do lugar muda o número
// público. Os casos cobrem o que o SQL da 0124 devolve.

describe("vocabulário", () => {
  it("8 situações na ordem do formulário", () => {
    expect(DESFECHO_SITUACOES).toEqual([
      "Estudando",
      "Trabalhando com carteira (CLT)",
      "Estágio",
      "Jovem Aprendiz",
      "Trabalhando sem carteira / bicos",
      "Empreendendo",
      "Procurando trabalho",
      "Nenhuma das anteriores",
    ]);
  });

  it("positivas = as 6 que contam 'estudando ou trabalhando'", () => {
    expect(DESFECHO_POSITIVAS.has("Estudando")).toBe(true);
    expect(DESFECHO_POSITIVAS.has("Trabalhando com carteira (CLT)")).toBe(true);
    expect(DESFECHO_POSITIVAS.has("Estágio")).toBe(true);
    expect(DESFECHO_POSITIVAS.has("Jovem Aprendiz")).toBe(true);
    expect(
      DESFECHO_POSITIVAS.has("Trabalhando sem carteira / bicos")
    ).toBe(true);
    expect(DESFECHO_POSITIVAS.has("Empreendendo")).toBe(true);
    expect(DESFECHO_POSITIVAS.has("Procurando trabalho")).toBe(false);
    expect(DESFECHO_POSITIVAS.has("Nenhuma das anteriores")).toBe(false);
    // e o contrato é simétrico: toda positiva é situação conhecida
    for (const s of DESFECHO_POSITIVAS)
      expect(DESFECHO_SITUACOES).toContain(s);
  });
});

describe("parseDesfechoAgregado", () => {
  it("null/lixo → null (card some, relatório segue)", () => {
    expect(parseDesfechoAgregado(null)).toBeNull();
    expect(parseDesfechoAgregado(undefined)).toBeNull();
    expect(parseDesfechoAgregado("x")).toBeNull();
    expect(parseDesfechoAgregado({})).toBeNull();
  });

  it("momento insuficiente carrega só n", () => {
    const ag = parseDesfechoAgregado({
      encerramento: { n: 3, suficiente: false },
      "6m": { n: 0, suficiente: false },
    });
    expect(ag?.encerramento).toEqual({ n: 3, suficiente: false });
    expect(ag?.["6m"]).toEqual({ n: 0, suficiente: false });
  });

  it("momento suficiente preserva média, pct e quebra por opção", () => {
    const ag = parseDesfechoAgregado({
      encerramento: {
        n: 10,
        suficiente: true,
        media_ajudou: 4.2,
        pct_estudando_trabalhando: 80,
        opcoes: [
          { opcao: "Estudando", n: 5, pct: 50 },
          { opcao: "Empreendendo", n: 3, pct: 30 },
        ],
      },
      "6m": { n: 0, suficiente: false },
    });
    expect(ag?.encerramento.media_ajudou).toBe(4.2);
    expect(ag?.encerramento.pct_estudando_trabalhando).toBe(80);
    expect(ag?.encerramento.opcoes).toHaveLength(2);
  });

  it("entradas malformadas em opcoes são descartadas, não explode", () => {
    const ag = parseDesfechoAgregado({
      encerramento: {
        n: 6,
        suficiente: true,
        media_ajudou: 3,
        pct_estudando_trabalhando: 50,
        opcoes: [{ opcao: "Estudando", n: 3, pct: 50 }, "lixo", 42, null],
      },
      "6m": { n: 0, suficiente: false },
    });
    expect(ag?.encerramento.opcoes).toEqual([
      { opcao: "Estudando", n: 3, pct: 50 },
    ]);
  });
});

describe("montaDesfechoCard", () => {
  const base = (n: number, suf = true): DesfechoAgregado => ({
    encerramento: {
      n,
      suficiente: suf,
      media_ajudou: 4,
      pct_estudando_trabalhando: 60,
      opcoes: [
        { opcao: "Estudando", n: Math.ceil(n / 2), pct: 50 },
        { opcao: "Procurando trabalho", n: Math.floor(n / 2), pct: 50 },
      ],
    },
    "6m": { n: 0, suficiente: false },
  });

  it("null → card nenhum", () => {
    expect(montaDesfechoCard(null)).toEqual([]);
  });

  it("momento sem resposta não vira linha", () => {
    const linhas = montaDesfechoCard(base(7));
    expect(linhas).toHaveLength(1);
    expect(linhas[0].chave).toBe("encerramento");
    expect(linhas[0].rotulo).toBe("No fim da mentoria");
  });

  it(`n < ${DESFECHO_N_MIN} sai como insuficiente, sem média nem quebra`, () => {
    const linhas = montaDesfechoCard({
      encerramento: { n: 4, suficiente: false },
      "6m": { n: 0, suficiente: false },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].suficiente).toBe(false);
    expect(linhas[0].pctPositivo).toBeNull();
    expect(linhas[0].mediaAjudou).toBeNull();
    expect(linhas[0].opcoes).toEqual([]);
  });

  it("dois momentos saem na ordem da narrativa", () => {
    const ag: DesfechoAgregado = {
      encerramento: { n: 8, suficiente: true, opcoes: [] },
      "6m": { n: 6, suficiente: true, opcoes: [] },
    };
    const linhas = montaDesfechoCard(ag);
    expect(linhas.map((l) => l.chave)).toEqual(["encerramento", "6m"]);
    expect(linhas[1].rotulo).toBe("6 meses depois");
  });

  it("pct positivo deriva das contagens quando a RPC não manda pronto", () => {
    const linhas = montaDesfechoCard({
      encerramento: {
        n: 10,
        suficiente: true,
        opcoes: [
          { opcao: "Estudando", n: 4, pct: 40 },
          { opcao: "Empreendendo", n: 2, pct: 20 },
          { opcao: "Procurando trabalho", n: 4, pct: 40 },
        ],
      },
      "6m": { n: 0, suficiente: false },
    });
    // 4 + 2 = 6 positivos de 10 → 60%
    expect(linhas[0].pctPositivo).toBe(60);
  });

  it("pct da RPC vence quando vem pronto", () => {
    const linhas = montaDesfechoCard(base(10));
    expect(linhas[0].pctPositivo).toBe(60);
  });
});

describe("desfechoPositivo", () => {
  it("qualquer situação positiva conta", () => {
    expect(desfechoPositivo(["Estudando"])).toBe(true);
    expect(
      desfechoPositivo(["Nenhuma das anteriores", "Estágio"])
    ).toBe(true);
  });

  it("só procurando/nenhuma não conta", () => {
    expect(desfechoPositivo(["Procurando trabalho"])).toBe(false);
    expect(desfechoPositivo(["Nenhuma das anteriores"])).toBe(false);
    expect(desfechoPositivo([])).toBe(false);
  });
});

describe("leRespostaDesfecho", () => {
  it("resposta cheia vira o trio", () => {
    const r = leRespostaDesfecho({
      situacao: ["Estudando", "Estágio"],
      ajudou: 5,
      conquista: "Passei na faculdade",
    });
    expect(r).toEqual({
      situacao: ["Estudando", "Estágio"],
      ajudou: 5,
      conquista: "Passei na faculdade",
    });
  });

  it("campos ruins degradam por campo; nada legível devolve null", () => {
    const r = leRespostaDesfecho({ situacao: ["Estudando"], ajudou: 9 });
    expect(r).toEqual({ situacao: ["Estudando"], ajudou: null, conquista: null });
    expect(leRespostaDesfecho({ situacao: "Estudando", ajudou: 9 })).toBeNull();
  });

  it("strings não-situacao são filtradas da lista", () => {
    const r = leRespostaDesfecho({
      situacao: ["Estudando", 3, null, "Empreendendo"],
      ajudou: 4,
    });
    expect(r?.situacao).toEqual(["Estudando", "Empreendendo"]);
  });

  it("conquista em branco vira null; sem nada legível devolve null", () => {
    expect(leRespostaDesfecho({ conquista: "   " })).toBeNull();
    expect(leRespostaDesfecho(null)).toBeNull();
    expect(leRespostaDesfecho({ outro: 1 })).toBeNull();
  });
});

describe("formatPct", () => {
  it("inteiro sem casa; quebrado com vírgula pt-BR", () => {
    expect(formatPct(80)).toBe("80%");
    expect(formatPct(77.8)).toBe("77,8%");
  });
});
