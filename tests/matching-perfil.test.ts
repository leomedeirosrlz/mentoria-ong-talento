import { describe, expect, it } from "vitest";
import {
  TEMAS_MATCHING,
  montarDocMatching,
  ordenarPorRank,
  sanitizarTemas,
  type DadosMentor,
  type DadosMentorado,
} from "@/lib/matching";
import { docHash } from "@/lib/ia/matching";

const mentorBase: DadosMentor = {
  interesses: ["futebol", "tecnologia", "leitura"],
  motivacao: "Quero devolver o que a mentoria me deu.",
  bio: "Engenheira de software, 12 anos de estrada.",
  cargo: "Tech lead",
  empresa: "ACME",
  mentor_profiles: {
    experiencia_previa: "2 anos mentorando na ONG X",
    formacao_externa: "Computação — USP",
    areas: ["tecnologia", "carreira"],
  },
};

const mentoradoBase: DadosMentorado = {
  interesses: ["games", "música", "tecnologia"],
  motivacao: "Quero entrar na faculdade de computação.",
  objetivos: "Passar no vestibular e aprender inglês.",
  escolaridade: "medio",
  ong_origem: "ONG Horizonte",
};

describe("montarDocMatching", () => {
  it("mentor: carrega oferta — experiência, formação, áreas, atuação", () => {
    const doc = montarDocMatching("mentor", mentorBase);
    expect(doc).toContain("Interesses: futebol, tecnologia, leitura");
    expect(doc).toContain("Motivação para ser mentor: Quero devolver");
    expect(doc).toContain("Experiência com mentoria: 2 anos mentorando");
    expect(doc).toContain("Formação e estudos: Computação — USP");
    expect(doc).toContain("Áreas de atuação: tecnologia, carreira");
    expect(doc).toContain("Atuação profissional: Tech lead na empresa ACME");
    expect(doc).toContain("Sobre: Engenheira de software");
  });

  it("mentorado: carrega aspiração — motivação, objetivos, escolaridade, ONG", () => {
    const doc = montarDocMatching("mentorado", mentoradoBase);
    expect(doc).toContain("Interesses: games, música, tecnologia");
    expect(doc).toContain("Motivação para participar: Quero entrar");
    expect(doc).toContain("Objetivos no programa: Passar no vestibular");
    expect(doc).toContain("Escolaridade: Ensino médio");
    expect(doc).toContain("ONG de origem: ONG Horizonte");
  });

  it("omite campos vazios/nulos sem deixar rótulo órfão", () => {
    const doc = montarDocMatching("mentorado", {
      interesses: [],
      motivacao: null,
      objetivos: "Ser médico",
      escolaridade: null,
      ong_origem: null,
    });
    expect(doc).toBe("Objetivos no programa: Ser médico");
  });

  it("campos sensíveis/de regra nunca entram no doc", () => {
    const doc = montarDocMatching("mentorado", {
      ...mentoradoBase,
      // @ts-expect-error — campos fora do tipo não devem vazar mesmo se
      // um caller descuidado os incluir no objeto
      nome: "Ana",
      genero: "feminino",
      cor_raca: "preta",
      cidade: "Recife",
    });
    expect(doc).not.toContain("Ana");
    expect(doc).not.toContain("feminino");
    expect(doc).not.toContain("preta");
    expect(doc).not.toContain("Recife");
  });

  it("form_bruto: whitelist temática entra, chave civil fica de fora", () => {
    const doc = montarDocMatching("mentorado", {
      ...mentoradoBase,
      form_bruto: {
        "Qual seu sonho?": "Ser programador",
        "Seu CPF": "123.456.789-00",
        "Endereço completo": "Rua X, 123",
        "O que você gosta de fazer?": "Desenhar",
      },
    });
    expect(doc).toContain('Resposta "Qual seu sonho?": Ser programador');
    expect(doc).toContain('Resposta "O que você gosta de fazer?": Desenhar');
    expect(doc).not.toContain("CPF");
    expect(doc).not.toContain("123.456");
    expect(doc).not.toContain("Endereço");
  });

  it("doc vazio quando nada preenchido", () => {
    expect(montarDocMatching("mentorado", {})).toBe("");
  });
});

describe("docHash", () => {
  it("estável pro mesmo doc, muda com qualquer alteração", () => {
    const doc = montarDocMatching("mentor", mentorBase);
    expect(docHash(doc)).toBe(docHash(doc));
    expect(docHash(doc)).not.toBe(docHash(doc + " "));
    expect(docHash(doc)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sanitizarTemas", () => {
  it("filtra pro vocabulário fechado e capitaliza forma canônica", () => {
    const out = sanitizarTemas(
      '["tecnologia", "CARREIRA", "saude", "magia", "música", "jardinagem"]'
    );
    expect(out).toEqual(["tecnologia", "carreira", "saúde", "música"]);
  });

  it("deduplica e corta no máximo", () => {
    const muitos = [...TEMAS_MATCHING, ...TEMAS_MATCHING, "xyz"];
    const out = sanitizarTemas(JSON.stringify(muitos));
    expect(out.length).toBeLessThanOrEqual(6);
    expect(new Set(out).size).toBe(out.length);
  });

  it("resposta sem array → []", () => {
    expect(sanitizarTemas("não entendi")).toEqual([]);
    expect(sanitizarTemas(null)).toEqual([]);
    expect(sanitizarTemas("")).toEqual([]);
  });

  it("acheta formatos de resposta: objeto com array dentro também vale", () => {
    expect(sanitizarTemas('{ "temas": ["games"] }')).toEqual(["games"]);
  });

  it("extrai o array mesmo com texto ao redor e dropa o que foge do vocab", () => {
    expect(
      sanitizarTemas('Claro! Aqui estão: ["games", "artes", "arte"] — ok')
    ).toEqual(["games", "artes"]);
  });
});

describe("ordenarPorRank", () => {
  const pool = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("ranqueados primeiro na ordem do rank, demais preservam a ordem", () => {
    const out = ordenarPorRank(pool, ["c", "a"]);
    expect(out.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("rank vazio ou ausente → ordem intacta", () => {
    expect(ordenarPorRank(pool, []).map((x) => x.id)).toEqual([
      "a", "b", "c", "d",
    ]);
    expect(ordenarPorRank(pool, null).map((x) => x.id)).toEqual([
      "a", "b", "c", "d",
    ]);
    expect(ordenarPorRank(pool, undefined).map((x) => x.id)).toEqual([
      "a", "b", "c", "d",
    ]);
  });

  it("id do rank ausente no pool é ignorado sem quebrar", () => {
    const out = ordenarPorRank(pool, ["zzz", "b"]);
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("não muta a lista de entrada", () => {
    const antes = [...pool];
    ordenarPorRank(pool, ["d"]);
    expect(pool).toEqual(antes);
  });
});
