// Sessão combinada (018 · REALIZA-519): uma sessão física cobre mais de um
// nº do guia — UM registro mora na âncora (menor nº) com os demais na
// `cobertura`, e `sessao_id` compartilhado marca o grupo. Estas helpers
// derivam "quem cobre quem" de volta das rows — todo leitor que perguntaria
// "tem registro?" passa por elas, então a régua é testada uma vez aqui.

import { describe, expect, it } from "vitest";
import {
  avaliacaoCobreNumero,
  cobertosDaDupla,
  encontroAncoraDaCobertura,
  encontroTemConteudo,
  encontrosDaSessao,
} from "@/lib/ciclo";
import {
  encRealizado,
  mkAvaliacao,
  mkEncontro,
  mkRegistro,
} from "./helpers";

const SESSAO = "sessao-abc";

/** Âncora da sessão combinada: realizado com registro cobrindo `cobertos`. */
const encAncora = (
  numero: number,
  dia: string,
  cobertos: number[],
  sessaoId: string | null = SESSAO
) =>
  mkEncontro(numero, {
    status: "realizado",
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    sessao_id: sessaoId,
    registro: mkRegistro({ cobertura: cobertos }),
  });

/** Coberto pela sessão: realizado, mesmo sessao_id, sem registro próprio. */
const encCoberto = (
  numero: number,
  dia: string,
  sessaoId: string | null = SESSAO
) =>
  mkEncontro(numero, {
    status: "realizado",
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    sessao_id: sessaoId,
    registro: null,
  });

// ---------- cobertosDaDupla ----------

describe("cobertosDaDupla", () => {
  it("mapeia nº coberto → nº âncora a partir da cobertura do registro", () => {
    const encontros = [
      encAncora(5, "2025-11-04", [6, 7]),
      encCoberto(6, "2025-11-04"),
      encCoberto(7, "2025-11-04"),
    ];

    const mapa = cobertosDaDupla(encontros);

    expect(mapa.get(6)).toBe(5);
    expect(mapa.get(7)).toBe(5);
    expect(mapa.has(5)).toBe(false); // âncora não é coberta por ninguém
  });

  it("registro sem conteúdo (só defaults) NÃO ancora cobertura nenhuma", () => {
    // salvarRegistro recusa gravar registro vazio, então uma cobertura
    // marcada nele nunca vinga — o mapa precisa ignorar a sujeira
    const encontros = [
      encAncora(5, "2025-11-04", [6]),
      encCoberto(6, "2025-11-04"),
    ];
    encontros[0].registro = mkRegistro({
      tema: null,
      reflexoes: null,
      observacoes: null,
      atividades: [],
      cobertura: [6],
    });

    expect(cobertosDaDupla(encontros).size).toBe(0);
  });

  it("cobertura vazia/ausente e auto-referência não entram no mapa", () => {
    const encontros = [
      encRealizado(1, "2025-10-07"),
      encAncora(2, "2025-10-14", []),
      encAncora(3, "2025-10-21", [3]),
    ];

    const mapa = cobertosDaDupla(encontros);

    expect(mapa.size).toBe(0);
  });

  it("duas âncoras na mesma dupla mapeiam seus grupos independentes", () => {
    const encontros = [
      encAncora(2, "2025-10-14", [3], "s-1"),
      encCoberto(3, "2025-10-14", "s-1"),
      encAncora(5, "2025-11-04", [6], "s-2"),
      encCoberto(6, "2025-11-04", "s-2"),
    ];

    const mapa = cobertosDaDupla(encontros);

    expect(mapa.get(3)).toBe(2);
    expect(mapa.get(6)).toBe(5);
  });
});

// ---------- encontroTemConteudo ----------

describe("encontroTemConteudo", () => {
  it("registro próprio com conteúdo vale sem consultar mapa nenhum", () => {
    const enc = encRealizado(1, "2025-10-07");

    expect(encontroTemConteudo(enc)).toBe(true);
  });

  it("coberto pela âncora vale — com a lista ou com o mapa já montado", () => {
    const ancora = encAncora(5, "2025-11-04", [6]);
    const coberto = encCoberto(6, "2025-11-04");
    const encontros = [ancora, coberto];

    expect(encontroTemConteudo(coberto, encontros)).toBe(true);
    expect(encontroTemConteudo(coberto, cobertosDaDupla(encontros))).toBe(true);
  });

  it("realizado sem registro e sem âncora é falso — segue devendo", () => {
    const pendente = encRealizado(4, "2025-10-28", null);

    expect(encontroTemConteudo(pendente, [])).toBe(false);
    expect(encontroTemConteudo(pendente, new Map())).toBe(false);
  });

  it("cobertura declarada por encontro de OUTRO nº não cobre este", () => {
    // mapa da dupla não cobre o 4º — ele segue sem conteúdo
    const encontros = [encAncora(5, "2025-11-04", [6])];
    const foraDoGrupo = encRealizado(4, "2025-10-28", null);

    expect(encontroTemConteudo(foraDoGrupo, encontros)).toBe(false);
  });
});

// ---------- encontroAncoraDaCobertura ----------

describe("encontroAncoraDaCobertura", () => {
  it("devolve a row da âncora pra UI dizer 'o registro do 5º vale por este'", () => {
    const ancora = encAncora(5, "2025-11-04", [6]);
    const coberto = encCoberto(6, "2025-11-04");

    const anc = encontroAncoraDaCobertura(coberto, [ancora, coberto]);

    expect(anc?.numero).toBe(5);
    expect(anc?.sessao_id).toBe(SESSAO);
  });

  it("âncora, sessão simples e sem-registro devolvem null", () => {
    const ancora = encAncora(5, "2025-11-04", [6]);
    const simples = encRealizado(7, "2025-11-11");
    const pendente = encRealizado(8, "2025-11-18", null);
    const encontros = [ancora, encCoberto(6, "2025-11-04"), simples, pendente];

    expect(encontroAncoraDaCobertura(ancora, encontros)).toBeNull();
    expect(encontroAncoraDaCobertura(simples, encontros)).toBeNull();
    expect(encontroAncoraDaCobertura(pendente, encontros)).toBeNull();
  });
});

// ---------- encontrosDaSessao ----------

describe("encontrosDaSessao", () => {
  it("agrupa as rows do mesmo sessao_id, ordenadas — a âncora primeiro", () => {
    const ancora = encAncora(5, "2025-11-04", [6, 7]);
    const c6 = encCoberto(6, "2025-11-04");
    const c7 = encCoberto(7, "2025-11-04");
    const outros = encRealizado(8, "2025-11-11");
    const encontros = [c7, outros, ancora, c6];

    const grupo = encontrosDaSessao(ancora, encontros);

    expect(grupo.map((e) => e.numero)).toEqual([5, 6, 7]);
    // partir de qualquer membro devolve o mesmo grupo
    expect(encontrosDaSessao(c7, encontros).map((e) => e.numero)).toEqual([
      5, 6, 7,
    ]);
  });

  it("sem sessao_id devolve só o próprio — sessão simples", () => {
    const enc = encRealizado(1, "2025-10-07");

    expect(encontrosDaSessao(enc, [enc, encRealizado(2, "2025-10-14")])).toEqual(
      [enc]
    );
  });
});

// ---------- avaliacaoCobreNumero ----------

describe("avaliacaoCobreNumero", () => {
  it("a avaliação do jovem cobre o grupo inteiro — âncora inclusa", () => {
    const aval = mkAvaliacao({ encontro_id: "e-5", cobertura: [5, 6] });
    const ancora = mkEncontro(5, { id: "e-5" });
    const coberto = mkEncontro(6, { id: "e-6" });

    expect(avaliacaoCobreNumero(aval, ancora)).toBe(true); // por encontro_id
    expect(avaliacaoCobreNumero(aval, coberto)).toBe(true); // por cobertura
    expect(avaliacaoCobreNumero(aval, mkEncontro(7))).toBe(false);
  });

  it("sessão simples: só o encontro_id responde; null não cobre nada", () => {
    const aval = mkAvaliacao({ encontro_id: "e-3", cobertura: null });
    const dono = mkEncontro(3, { id: "e-3" });

    expect(avaliacaoCobreNumero(aval, dono)).toBe(true);
    expect(avaliacaoCobreNumero(aval, mkEncontro(4))).toBe(false);
    expect(avaliacaoCobreNumero(null, dono)).toBe(false);
    expect(avaliacaoCobreNumero(undefined, dono)).toBe(false);
  });
});
