import { describe, expect, it } from "vitest";
import {
  agregaAvaliacoes,
  mediaQuantizadaDpp,
  resumoAvaliacaoJovem,
} from "./avaliacao-agregado";
import type {
  AvaliacaoEncontro,
  AvaliacaoJovem,
  AvanceiAvaliacao,
  Dificuldade,
  Registro,
} from "./types";

const aval = (
  estrelas: number,
  extra: Partial<
    Pick<AvaliacaoEncontro, "avancei" | "sentimento" | "temas">
  > = {}
) => ({
  estrelas,
  avancei: (extra.avancei ?? null) as AvanceiAvaliacao | null,
  sentimento: extra.sentimento ?? null,
  temas: extra.temas ?? null,
});

const reg = (
  avaliacao: AvaliacaoJovem | null = null,
  dificuldade: Dificuldade | null = null
): Pick<Registro, "avaliacao" | "dificuldade"> => ({
  avaliacao,
  dificuldade,
});

describe("agregaAvaliacoes — lado do jovem", () => {
  it("média das estrelas e % de avancei sobre quem respondeu", () => {
    const agg = agregaAvaliacoes(
      [
        aval(5, { avancei: "sim" }),
        aval(4, { avancei: "sim" }),
        aval(3, { avancei: "nao" }),
        aval(4), // sem avancei — não entra no denominador
      ],
      []
    );
    expect(agg.jovem.n).toBe(4);
    expect(agg.jovem.mediaEstrelas).toBeCloseTo(4);
    expect(agg.jovem.pctAvanceiSim).toBeCloseTo((2 / 3) * 100);
    expect(agg.jovem.avancei).toEqual({ sim: 2, um_pouco: 0, nao: 1 });
  });

  it("sentimentos e temas contam por frequência (tema é multiescolha)", () => {
    const agg = agregaAvaliacoes(
      [
        aval(5, { sentimento: "bem", temas: ["pdm", "carreira"] }),
        aval(4, { sentimento: "bem", temas: ["pdm"] }),
        aval(3, { sentimento: "mal", temas: ["familia"] }),
      ],
      []
    );
    expect(agg.jovem.sentimentos).toEqual([
      { chave: "bem", n: 2 },
      { chave: "mal", n: 1 },
    ]);
    expect(agg.jovem.temas).toEqual([
      { chave: "pdm", n: 2 },
      { chave: "carreira", n: 1 },
      { chave: "familia", n: 1 },
    ]);
  });

  it("série vazia devolve nulls, não zeros — 'sem dado' ≠ 'média 0'", () => {
    const agg = agregaAvaliacoes([], []);
    expect(agg.jovem.mediaEstrelas).toBeNull();
    expect(agg.jovem.pctAvanceiSim).toBeNull();
    expect(agg.mentor.media).toBeNull();
  });

  it("lacuna: encontro realizado sem avaliação não entra na conta", () => {
    // o caller entrega só as avaliações que existem — 5 realizados com 3
    // avaliados = série de 3; a média é sobre o respondido
    const agg = agregaAvaliacoes(
      [aval(4), aval(2), aval(5)],
      [reg("boa"), reg()] // registro sem avaliação também não conta
    );
    expect(agg.jovem.n).toBe(3);
    expect(agg.jovem.mediaEstrelas).toBeCloseTo((4 + 2 + 5) / 3);
    expect(agg.mentor.n).toBe(1);
    expect(agg.mentor.media).toBeCloseTo(3);
  });
});

describe("agregaAvaliacoes — lado do mentor (escala 1–4)", () => {
  it("média por PESO_AVALIACAO e histograma de dificuldades", () => {
    const agg = agregaAvaliacoes(
      [],
      [
        reg("excelente", "nenhuma"),
        reg("boa", "aprendizagem"),
        reg("regular", "aprendizagem"),
        reg("baixa", null),
      ]
    );
    expect(agg.mentor.n).toBe(4);
    expect(agg.mentor.media).toBeCloseTo((4 + 3 + 2 + 1) / 4);
    expect(agg.mentor.dificuldades).toEqual([
      { chave: "aprendizagem", n: 2 },
      { chave: "nenhuma", n: 1 },
    ]);
  });
});

describe("mediaQuantizadaDpp — a régua da 0071", () => {
  it("lote <3 não libera — nem média nem base", () => {
    expect(mediaQuantizadaDpp([5, 4])).toEqual({ n: 2, liberado: false });
    expect(mediaQuantizadaDpp([])).toEqual({ n: 0, liberado: false });
  });

  it("quantiza em 0,5 sobre as k primeiras (anti difference-attack)", () => {
    // 4 avaliações: k=3, a 4ª NÃO entra — uma resposta nova não reabre
    // a conta sobre o lote já revelado
    const r = mediaQuantizadaDpp([5, 5, 4, 1]);
    expect(r.liberado).toBe(true);
    expect(r.base).toBe(3);
    expect(r.media).toBeCloseTo(4.5); // round((14/3)*2)/2 = 4.5

    // 7 avaliações: k=6 — arredonda pra baixo em meia
    const r2 = mediaQuantizadaDpp([5, 4, 4, 5, 4, 3, 5]);
    expect(r2.base).toBe(6);
    expect(r2.media).toBe(4); // (25/6)≈4.1667 → round(*2)/2 = 4.0
  });
});

describe("resumoAvaliacaoJovem — o tile do resumo da jornada", () => {
  it("série vazia devolve null — o tile se omite", () => {
    expect(resumoAvaliacaoJovem([])).toBeNull();
  });

  it("média, n, trajetória por nº de encontro e temas top-3", () => {
    const r = resumoAvaliacaoJovem([
      { numero: 4, estrelas: 4, temas: ["estudos"] },
      { numero: 1, estrelas: 3, temas: ["pdm", "estudos"] },
      { numero: 2, estrelas: 3, temas: ["pdm"] },
      { numero: 7, estrelas: 5, temas: ["carreira", "pdm", "familia"] },
    ]);
    expect(r).not.toBeNull();
    expect(r!.n).toBe(4);
    expect(r!.media).toBeCloseTo(3.8, 1); // (3+3+4+5)/4 arredondado a 0,1
    // trajetória respeita o nº do encontro, não a ordem do array
    expect(r!.trajetoria).toEqual({ primeiro: 3, ultimo: 5 });
    // pdm citado 3×, estudos 2×, carreira/familia empatam em 1× (chave
    // ordena o desempate — carreira antes de familia)
    expect(r!.temasTop).toEqual(["pdm", "estudos", "carreira"]);
  });

  it("1 avaliação: média sai, mas não há 1º→último pra contar", () => {
    const r = resumoAvaliacaoJovem([{ numero: 3, estrelas: 4 }]);
    expect(r!.n).toBe(1);
    expect(r!.media).toBe(4);
    expect(r!.trajetoria).toBeNull();
    expect(r!.temasTop).toEqual([]);
  });
});
