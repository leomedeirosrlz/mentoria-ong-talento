import { describe, expect, it } from "vitest";
import {
  agruparRegistros,
  grupoRegistrosDe,
  type RegistroAgrupavel,
} from "@/lib/registros";

// Agrupamento da timeline de /registros (?grupo=) — datas âncora nas terças
// do ciclo de referência e TZ fixa America/Sao_Paulo (env do vitest).

function mk(
  over: Partial<RegistroAgrupavel> & {
    /** atalho: monta `encontro.dupla` a partir de nomes legíveis;
     *  `null` explícito = registro órfão (sem encontro). */
    dupla?: { id: string; mentor: string; mentorado: string } | null;
  } = {}
): RegistroAgrupavel {
  const { dupla, ...rest } = over;
  return {
    created_at: "2025-10-15T10:00:00-03:00",
    avaliacao: "boa",
    encontro:
      dupla === null
        ? null
        : {
            dupla: dupla
              ? {
                  id: dupla.id,
                  mentor: { nome: dupla.mentor },
                  mentorado: { nome: dupla.mentorado },
                }
              : {
                  id: "d-0",
                  mentor: { nome: "Mentor Padrão" },
                  mentorado: { nome: "Mentorado Padrão" },
                },
          },
    ...rest,
  };
}

const DUPLA_A = { id: "d-a", mentor: "Ana", mentorado: "Bia" };
const DUPLA_B = { id: "d-b", mentor: "Caio", mentorado: "Duda" };

describe("grupoRegistrosDe", () => {
  it("aceita os três eixos e devolve dupla como default", () => {
    expect(grupoRegistrosDe("dupla")).toBe("dupla");
    expect(grupoRegistrosDe("semana")).toBe("semana");
    expect(grupoRegistrosDe("avaliacao")).toBe("avaliacao");
    expect(grupoRegistrosDe(undefined)).toBe("dupla");
  });

  it("lixo na URL cai no default em vez de quebrar", () => {
    expect(grupoRegistrosDe("qualquer-coisa")).toBe("dupla");
    expect(grupoRegistrosDe("")).toBe("dupla");
    expect(grupoRegistrosDe("DUPLA")).toBe("dupla");
  });
});

describe("agruparRegistros · dupla", () => {
  it("agrupa por dupla.id na ordem de primeira aparição", () => {
    const itens = [
      mk({ dupla: DUPLA_B }),
      mk({ dupla: DUPLA_A }),
      mk({ dupla: DUPLA_B }),
    ];
    const grupos = agruparRegistros(itens, "dupla");
    expect(grupos.map((g) => g.chave)).toEqual(["d-b", "d-a"]);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[0].rotulo).toBe("Dupla: Caio × Duda");
    expect(grupos[1].rotulo).toBe("Dupla: Ana × Bia");
  });

  it("não reordena dentro do grupo — a ordem da lista segue valendo", () => {
    const itens = [
      mk({ dupla: DUPLA_A, created_at: "2025-10-15T10:00:00-03:00" }),
      mk({ dupla: DUPLA_A, created_at: "2025-10-08T10:00:00-03:00" }),
    ];
    const [g] = agruparRegistros(itens, "dupla");
    expect(g.itens).toEqual(itens);
  });

  it("registro sem dupla vai pro balde residual 'Dupla removida' no fim", () => {
    const itens = [
      mk({ dupla: null }), // residual aparece primeiro na entrada…
      mk({ dupla: DUPLA_A }),
    ];
    const grupos = agruparRegistros(itens, "dupla");
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Dupla: Ana × Bia",
      "Dupla removida", // …mas fecha a lista
    ]);
  });

  it("dupla sem mentor/mentorado mostra — no lugar do nome", () => {
    const itens = [
      mk({
        encontro: {
          dupla: { id: "d-x", mentor: null, mentorado: null },
        },
      }),
    ];
    const [g] = agruparRegistros(itens, "dupla");
    expect(g.rotulo).toBe("Dupla: — × —");
  });
});

describe("agruparRegistros · semana", () => {
  it("cai no balde da segunda-feira da semana do created_at", () => {
    // 15/10 é quinta da semana 13–19/10; 08/10 cai na semana 06–12/10
    const itens = [
      mk({ created_at: "2025-10-15T23:30:00-03:00" }),
      mk({ created_at: "2025-10-13T08:00:00-03:00" }), // a própria segunda
      mk({ created_at: "2025-10-08T10:00:00-03:00" }),
    ];
    const grupos = agruparRegistros(itens, "semana");
    expect(grupos.map((g) => g.chave)).toEqual(["2025-10-13", "2025-10-06"]);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[0].rotulo).toBe("Semana de 13/10/2025");
    expect(grupos[1].rotulo).toBe("Semana de 06/10/2025");
  });

  it("domingo ainda pertence à semana que começou na segunda", () => {
    const itens = [mk({ created_at: "2025-10-19T10:00:00-03:00" })];
    const [g] = agruparRegistros(itens, "semana");
    expect(g.chave).toBe("2025-10-13");
    expect(g.rotulo).toBe("Semana de 13/10/2025");
  });

  it("created_at inválido vira 'Sem data' residual no fim", () => {
    const itens = [
      mk({ created_at: "lixo" }),
      mk({ created_at: "2025-10-15T10:00:00-03:00" }),
    ];
    const grupos = agruparRegistros(itens, "semana");
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Semana de 13/10/2025",
      "Sem data",
    ]);
  });
});

describe("agruparRegistros · avaliacao", () => {
  it("ordena os baldes por severidade: baixa → regular → boa → excelente", () => {
    const itens = [
      mk({ avaliacao: "excelente" }),
      mk({ avaliacao: "boa" }),
      mk({ avaliacao: "baixa" }),
      mk({ avaliacao: "regular" }),
      mk({ avaliacao: "boa" }),
    ];
    const grupos = agruparRegistros(itens, "avaliacao");
    expect(grupos.map((g) => g.chave)).toEqual([
      "baixa",
      "regular",
      "boa",
      "excelente",
    ]);
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Avaliação: Baixa",
      "Avaliação: Regular",
      "Avaliação: Boa",
      "Avaliação: Excelente",
    ]);
    expect(grupos[2].itens).toHaveLength(2);
  });

  it("avaliacao null vira 'Sem avaliação' e fecha a lista", () => {
    const itens = [mk({ avaliacao: null }), mk({ avaliacao: "baixa" })];
    const grupos = agruparRegistros(itens, "avaliacao");
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Avaliação: Baixa",
      "Sem avaliação",
    ]);
  });

  it("balde vazio não renderiza (sem avaliação baixa, sem header)", () => {
    const grupos = agruparRegistros([mk({ avaliacao: "boa" })], "avaliacao");
    expect(grupos.map((g) => g.chave)).toEqual(["boa"]);
  });
});

describe("agruparRegistros · geral", () => {
  it("lista vazia devolve zero grupos", () => {
    for (const g of ["dupla", "semana", "avaliacao"] as const)
      expect(agruparRegistros([], g)).toEqual([]);
  });
});
