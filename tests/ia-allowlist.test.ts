// Allowlist estática da camada de IA — o registry é o contrato inteiro
// que o modelo enxerga: o provider converte cada entrada em function
// calling (JSON Schema) e executarTool confia na chave pra achar a tool.
// Cada entrada tem que ser autossuficiente por construção:
//   · `nome` igual à chave do mapa — o modelo chama pela string e um
//     nome divergente quebraria o dispatch silenciosamente;
//   · descrição pt-BR não-vazia — é o que o modelo lê pra escolher;
//   · schema zod strict — campos fora do contrato são rejeitados;
//   · roles dentro do vocabulário app_role do banco — papel inventado
//     nunca casa com my_papeis() e a tool morreria fechada pra todos.
// O comportamento de execução (gate, zod, auditoria) já é coberto em
// ia-tools.test.ts — aqui é só a inspeção estática da allowlist.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { IA_TOOLS, IA_TOOL_CATALOGO, IA_TOOL_NOMES } from "@/lib/ia/tools";
import type { AppRole } from "@/lib/types";

// vocabulário fechado do enum app_role (tipos.ts) — a fonte real é o banco
const APP_ROLES: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];

const UUID = "11111111-2222-4333-8444-555555555555";

/** Menor conjunto de args válido por tool — prova que o schema parseia
 *  e serve de base pro teste de estrictez (mesmo args + chave extra). */
const ARGS_MINIMOS: Record<string, Record<string, unknown>> = {
  resumo_semana: {},
  ficha_dupla: { dupla_id: UUID },
  registros_da_dupla: { dupla_id: UUID },
  aguardando_par: {},
  capacidade_mentores: {},
  duplas_do_usuario: {},
  agenda_do_periodo: {},
  guia_consulta: { pergunta: "como funciona o encontro?" },
  instrumentos_da_dupla: { dupla_id: UUID },
  chamados_resumo: {},
  pessoas_busca: { nome: "Maria" },
};

describe("allowlist — forma do registry", () => {
  it("a chave do mapa é o nome — sem divergência nem duplicata", () => {
    // Object.keys já garante chave única; o risco real é `nome` interno
    // divergir da chave e o dispatch por string achar outra tool
    expect(IA_TOOL_NOMES.length).toBeGreaterThan(0);
    for (const chave of IA_TOOL_NOMES) {
      expect(IA_TOOLS[chave].nome).toBe(chave);
    }
    // nome no formato que function-calling aceita (^[a-zA-Z0-9_-]+$)
    for (const t of Object.values(IA_TOOLS)) {
      expect(t.nome).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it("toda tool tem descrição pt-BR não-vazia", () => {
    for (const t of Object.values(IA_TOOLS)) {
      // descrição de verdade, não stub — o modelo escolhe por ela
      expect(t.descricao.trim().length).toBeGreaterThanOrEqual(20);
    }
  });

  it("toda tool tem schema zod que vira JSON Schema de objeto", () => {
    for (const t of Object.values(IA_TOOLS)) {
      expect(typeof t.schema.safeParse).toBe("function");
      // é isso que o provider manda como `parameters` na function
      const json = z.toJSONSchema(t.schema) as { type?: string };
      expect(json.type).toBe("object");
    }
  });

  it("todo schema é strict: args mínimos passam, chave extra não", () => {
    for (const [nome, t] of Object.entries(IA_TOOLS)) {
      const minimo = ARGS_MINIMOS[nome];
      // se ARGS_MINIMOS não cobre a tool nova, o teste avisa na hora
      expect(minimo, `ARGS_MINIMOS sem entrada pra ${nome}`).toBeDefined();
      expect(t.schema.safeParse(minimo).success).toBe(true);
      expect(
        t.schema.safeParse({ ...minimo, campo_que_nao_existe: 1 }).success
      ).toBe(false);
    }
  });

  it("toda role é um AppRole conhecido, sem duplicata na mesma tool", () => {
    for (const t of Object.values(IA_TOOLS)) {
      expect(t.roles.length).toBeGreaterThan(0);
      expect(new Set(t.roles).size).toBe(t.roles.length);
      for (const r of t.roles) {
        expect(APP_ROLES).toContain(r);
      }
    }
  });
});

describe("allowlist — catálogo pro transporte", () => {
  it("o catálogo espelha o registry: mesmos nomes, mesma ordem", () => {
    expect(IA_TOOL_CATALOGO.map((t) => t.nome)).toEqual(IA_TOOL_NOMES);
  });

  it("cada entrada do catálogo carrega descrição, roles e o mesmo schema", () => {
    for (const item of IA_TOOL_CATALOGO) {
      const t = IA_TOOLS[item.nome as keyof typeof IA_TOOLS];
      expect(item.descricao).toBe(t.descricao);
      expect(item.roles).toBe(t.roles);
      expect(item.schema).toBe(t.schema);
    }
  });
});
