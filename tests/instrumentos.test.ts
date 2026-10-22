import { describe, expect, it } from "vitest";
import {
  agrupaEmSecoes,
  ehInstrumento,
  extraiEstruturaRoda,
  extraiGruposMeta,
  lePonteiro,
  pontoEixo,
  pontosPoligono,
  quebraRotuloEixo,
  rotuloQuadrante,
  RODA_CX,
  RODA_CY,
  RODA_RAIO,
} from "@/lib/forms/instrumentos";
import {
  campoRespondido,
  coletaRespostas,
  leDeValores,
  validaRespostas,
} from "@/lib/forms/resposta";
import type { FormularioCampo } from "@/lib/forms/schema";

const campo = (over: Partial<FormularioCampo> = {}): FormularioCampo => ({
  id: "f1",
  tipo: "texto",
  label: "Pergunta",
  obrigatorio: false,
  ...over,
});

const secao = (id: string, label: string) =>
  campo({ id, tipo: "secao", label });

// ---------- dispatch ----------

describe("ehInstrumento — o dispatcher do /f/<token>", () => {
  it("os 4 de jornada entram na via sob medida; o resto fica no genérico", () => {
    for (const s of ["visao", "metas", "pdm", "roda_vida"] as const)
      expect(ehInstrumento(s)).toBe(true);
    for (const s of [
      "anamnese",
      "avaliacao_360",
      "autoavaliacao_mentor",
      null,
      undefined,
    ] as const)
      expect(ehInstrumento(s)).toBe(false);
  });
});

// ---------- seções ----------

describe("agrupaEmSecoes", () => {
  it("cada 'secao' abre um bloco; campos antes da primeira ficam sem seção", () => {
    const blocos = agrupaEmSecoes([
      campo({ id: "a" }),
      secao("s1", "Um"),
      campo({ id: "b" }),
      campo({ id: "c" }),
      secao("s2", "Dois"),
      campo({ id: "d" }),
    ]);
    expect(blocos).toHaveLength(3);
    expect(blocos[0].secao).toBeNull();
    expect(blocos[0].campos.map((c) => c.id)).toEqual(["a"]);
    expect(blocos[1].secao?.id).toBe("s1");
    expect(blocos[1].campos.map((c) => c.id)).toEqual(["b", "c"]);
    expect(blocos[2].secao?.id).toBe("s2");
  });
});

// ---------- estrutura da roda ----------

const CAMPOS_RODA: FormularioCampo[] = [
  secao("s_como", "Como funciona"),
  secao("s_pessoal", "Pessoal"),
  ...["p_saude", "p_intelecto", "p_equilibrio", "p_independencia"].map((id) =>
    campo({ id, tipo: "escala_1_10", obrigatorio: true })
  ),
  secao("s_pro", "Profissional"),
  ...["pr_carreira", "pr_financas"].map((id) =>
    campo({ id, tipo: "escala_1_10", obrigatorio: true })
  ),
  campo({ id: "reflexao", tipo: "texto_longo", obrigatorio: true }),
];

describe("extraiEstruturaRoda", () => {
  it("seções antes da 1ª escala são instrução; depois são quadrantes", () => {
    const e = extraiEstruturaRoda(CAMPOS_RODA);
    expect(e).not.toBeNull();
    expect(e!.intro.map((s) => s.id)).toEqual(["s_como"]);
    expect(e!.quadrantes.map((q) => q.nome)).toEqual([
      "Pessoal",
      "Profissional",
    ]);
    expect(e!.quadrantes[0].campos).toHaveLength(4);
    expect(e!.quadrantes[1].campos).toHaveLength(2);
    // a reflexão não é escala — vai pra extras, nunca some
    expect(e!.extras.map((c) => c.id)).toEqual(["reflexao"]);
  });

  it("escala órfã de seção cai num quadrante sem nome; sem escala, null", () => {
    const orfa = extraiEstruturaRoda([
      campo({ id: "x", tipo: "escala_1_10" }),
    ]);
    expect(orfa!.quadrantes[0].nome).toBe("");
    expect(extraiEstruturaRoda([campo({ id: "t" })])).toBeNull();
  });
});

// ---------- geometria do radar ----------

describe("geometria da roda (pontoEixo/lePonteiro)", () => {
  it("eixo 0 aponta pra cima e o raio escala com a fração", () => {
    const topo = pontoEixo(0, 16, 1);
    expect(topo.x).toBeCloseTo(RODA_CX);
    expect(topo.y).toBeCloseTo(RODA_CY - RODA_RAIO);
    const metade = pontoEixo(0, 16, 0.5);
    expect(metade.y).toBeCloseTo(RODA_CY - RODA_RAIO / 2);
  });

  it("pontosPoligono devolve total pontos separados por espaço", () => {
    const s = pontosPoligono(16, Array(16).fill(0.5));
    expect(s.split(" ")).toHaveLength(16);
  });

  it("lePonteiro: ponto no eixo devolve o próprio eixo e a nota do raio", () => {
    const total = 16;
    const p = pontoEixo(3, total, 0.5); // eixo 3, nota 5
    const alvo = lePonteiro(p.x, p.y, total);
    expect(alvo.indice).toBe(3);
    expect(alvo.nota).toBe(5);
  });

  it("lePonteiro: entre dois eixos escolhe o mais próximo; aro e fora = 10", () => {
    const entre = pontoEixo(0, 16, 1);
    const entre2 = pontoEixo(1, 16, 1);
    const meio = lePonteiro(
      (entre.x + entre2.x) / 2,
      (entre.y + entre2.y) / 2,
      16
    );
    expect([0, 1]).toContain(meio.indice);
    const fora = lePonteiro(RODA_CX, RODA_CY - RODA_RAIO * 3, 16);
    expect(fora.nota).toBe(10);
    expect(fora.indice).toBe(0);
    const centro = lePonteiro(RODA_CX, RODA_CY, 16);
    expect(centro.nota).toBe(1);
  });

  it("rotuloQuadrante fica fora do aro, no meio do arco do grupo", () => {
    const r = rotuloQuadrante(0, 4, 16, 16);
    const dist = Math.hypot(r.x - RODA_CX, r.y - RODA_CY);
    expect(dist).toBeCloseTo(RODA_RAIO + 16);
  });
});

// ---------- rótulos externos da roda (REALIZA-143, variante A) ----------

describe("quebraRotuloEixo — a coroa de nomes do desktop", () => {
  it("os 16 rótulos oficiais viram no máximo 2 linhas, como no mock v1", () => {
    const oficiais = [
      "Saúde e disposição",
      "Intelecto e cultura",
      "Equilíbrio emocional",
      "Independência",
      "Carreira e trabalho",
      "Finanças",
      "Escola / universidade",
      "Contribuição social",
      "Família",
      "Amigos",
      "Relacionamento amoroso",
      "Vida social",
      "Hobbies e diversão",
      "Atividade física",
      "Realização e felicidade",
      "Espiritualidade",
    ];
    for (const l of oficiais) {
      const linhas = quebraRotuloEixo(l);
      expect(linhas.length).toBeGreaterThanOrEqual(1);
      expect(linhas.length).toBeLessThanOrEqual(2);
      // nenhuma linha nasce vazia e o texto todo sobrevive
      expect(linhas.every((x) => x.trim().length > 0)).toBe(true);
      expect(linhas.join(" ").replace(/\s+/g, " ")).toBe(l);
    }
  });

  it("corta guloso com teto de 14: 'Saúde e' / 'disposição'", () => {
    expect(quebraRotuloEixo("Saúde e disposição")).toEqual([
      "Saúde e",
      "disposição",
    ]);
    expect(quebraRotuloEixo("Relacionamento amoroso")).toEqual([
      "Relacionamento",
      "amoroso",
    ]);
  });

  it("rótulo curto fica em linha única; '/' nunca abre linha", () => {
    expect(quebraRotuloEixo("Família")).toEqual(["Família"]);
    expect(quebraRotuloEixo("Vida social")).toEqual(["Vida social"]);
    expect(quebraRotuloEixo("Escola / universidade")).toEqual([
      "Escola /",
      "universidade",
    ]);
  });

  it("palavra maior que o teto fica inteira; excedente fecha na 2ª linha", () => {
    expect(quebraRotuloEixo("Espiritualidade")).toEqual(["Espiritualidade"]);
    expect(quebraRotuloEixo("Vida contemplativa e meditativa")).toEqual([
      "Vida",
      "contemplativa e meditativa",
    ]);
  });
});

// ---------- grupos de metas ----------

describe("extraiGruposMeta", () => {
  const def: FormularioCampo[] = [
    campo({ id: "meta_2" }),
    campo({ id: "porque_2", tipo: "texto_longo" }),
    campo({ id: "meta_1", obrigatorio: true }),
    campo({ id: "is_1" }),
    campo({ id: "prazo_1", tipo: "data" }),
    campo({ id: "submetas_1", tipo: "texto_longo" }),
    campo({ id: "porque_9" }), // subcampo órfão — não vira meta
  ];

  it("agrupa subcampos pelo N e ordena pelo número, não pela posição", () => {
    const g = extraiGruposMeta(def);
    expect(g.map((x) => x.n)).toEqual([1, 2]);
    expect(g[0].is?.id).toBe("is_1");
    expect(g[0].prazo?.id).toBe("prazo_1");
    expect(g[0].submetas?.id).toBe("submetas_1");
    expect(g[1].porque?.id).toBe("porque_2");
  });
});

// ---------- coleta + validação compartilhadas ----------

describe("coleta/valida — espelho do submit genérico e sob medida", () => {
  const def: FormularioCampo[] = [
    campo({ id: "nome", obrigatorio: true }),
    campo({ id: "nota", tipo: "escala_1_10", obrigatorio: true }),
    campo({ id: "tags", tipo: "multi_select", opcoes: ["a", "b"] }),
    campo({ id: "ok", tipo: "checkbox" }),
    campo({ id: "email", formato: "email", obrigatorio: true }),
  ];

  it("escala sai número, multi_select sai array, texto sai trim/normalizado", () => {
    const { respostas } = coletaRespostas(
      def,
      leDeValores({
        nome: "  Ana  ",
        nota: 8,
        tags: ["a", "b"],
        ok: true,
        email: "ANA@Exemplo.com",
      })
    );
    expect(respostas.nome).toBe("Ana");
    expect(respostas.nota).toBe(8);
    expect(respostas.tags).toEqual(["a", "b"]);
    expect(respostas.ok).toBe(true);
    expect(respostas.email).toBe("ana@exemplo.com");
  });

  it("obrigatório vazio e formato inválido marcam erro por campo", () => {
    const { respostas, falhas } = coletaRespostas(
      def,
      leDeValores({ nome: "", nota: 8, email: "isso-não-é-email" })
    );
    const mapa = validaRespostas(def, respostas, falhas);
    expect(mapa.nome).toBeTruthy();
    expect(mapa.email).toBeTruthy(); // formato, não "responda"
    expect(mapa.nota).toBeUndefined();
  });

  it("opcional irreconhecível não bloqueia o envio", () => {
    const d2: FormularioCampo[] = [
      campo({ id: "opc", formato: "email", obrigatorio: false }),
    ];
    const { respostas, falhas } = coletaRespostas(
      d2,
      leDeValores({ opc: "lixo" })
    );
    expect(falhas.has("opc")).toBe(true);
    expect(validaRespostas(d2, respostas, falhas)).toEqual({});
  });

  it("campoRespondido cobre os tipos (escala 0 não acontece; multi vazio não)", () => {
    expect(campoRespondido(campo({}), "x")).toBe(true);
    expect(campoRespondido(campo({}), "  ")).toBe(false);
    expect(campoRespondido(campo({ tipo: "escala_1_10" }), 7)).toBe(true);
    expect(campoRespondido(campo({ tipo: "multi_select" }), [])).toBe(false);
    expect(campoRespondido(campo({ tipo: "checkbox" }), true)).toBe(true);
  });
});
