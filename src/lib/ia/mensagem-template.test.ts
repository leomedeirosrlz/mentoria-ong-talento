import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executarTool, type EventoIa } from "./tools";
import { SITE_URL } from "@/lib/site";

// REALIZA-388: a tool passa inteira pelo executarTool (schema, gate de
// papel, audit coletada em memória) — só o PostgREST é simulado, com as
// mesmas cadeias .from().select() que as queries reais fazem.

type Linhas = { data: unknown; count?: number };

const primeiro = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Cadeia encadeável que resolve {data, error, count} no await e
 *  {data: primeira linha} no maybeSingle — cobre select/in/eq/order/limit
 *  e qualquer outro método que a query encadeie. */
function tabela(res: Linhas) {
  const b: Record<string, unknown> = {};
  const resp = () => ({ data: res.data, error: null, count: res.count });
  for (const m of [
    "select",
    "in",
    "eq",
    "neq",
    "not",
    "is",
    "or",
    "gte",
    "gt",
    "lte",
    "lt",
    "order",
    "limit",
    "range",
    "contains",
    "ilike",
  ])
    b[m] = () => b;
  b.maybeSingle = async () => ({ data: primeiro(res.data), error: null });
  b.single = b.maybeSingle;
  b.then = (resolve: (v: unknown) => unknown) => resolve(resp());
  return b;
}

function supa(tabelas: Record<string, Linhas>): SupabaseClient {
  return {
    from: (t: string) => tabela(tabelas[t] ?? { data: [] }),
  } as unknown as SupabaseClient;
}

const DUPLA = {
  id: "11111111-1111-4111-8111-111111111111",
  turma: "Turma 1",
  trilha: "dpp",
  status: "ativa",
  desfecho: null,
  cronograma_id: null,
  iniciada_em: "2026-02-01",
  demanda: null,
  mentor_id: "m-1",
  supervisor_id: "s-1",
  mentor: { nome: "Ricardo Souza", nome_social: null },
  mentorado: {
    nome: "Ana Beatriz Lima",
    nome_social: "Ana",
    whatsapp: "5511955555555",
  },
  supervisor: { nome: "Paula Reis", nome_social: null },
  encontros: [
    {
      id: "e-1",
      numero: 3,
      status: "realizado",
      data_hora: "2026-03-01T14:00:00Z",
      realizado_em: "2026-03-01T15:10:00Z",
      registro: null,
      avaliacao_jovem: null,
    },
    {
      id: "e-2",
      numero: 4,
      status: "agendado",
      data_hora: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      realizado_em: null,
      registro: null,
      avaliacao_jovem: null,
    },
  ],
  encaminhamentos: [{ status: "pendente", prazo: "2026-03-18" }],
};

const eventos: EventoIa[] = [];

const rodar = (
  args: unknown,
  tabelas: Record<string, Linhas>,
  papeis: ("coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista" | "mentorado")[] = ["mentor_dpp"]
) =>
  executarTool("mensagem_template", args, supa(tabelas), "chat", papeis, undefined, undefined, {
    coletarEvento: (ev) => eventos.push(ev),
  });

describe("mensagem_template — schema e gate", () => {
  it("rejeita slug fora do enum", async () => {
    const r = await rodar({ slug: "nao-existe" }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Argumentos inválidos");
  });

  it("rejeita dupla_id que não é uuid", async () => {
    const r = await rodar({ slug: "mensagem-preparacao", dupla_id: "x" }, {});
    expect(r.ok).toBe(false);
  });

  it("mentorado não passa no gate de papel", async () => {
    const r = await rodar({ slug: "mensagem-preparacao" }, {}, ["mentorado"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não está disponível pro seu papel");
  });
});

describe("mensagem_template — sem dupla_id", () => {
  it("devolve o template e o índice de duplas pra escolha", async () => {
    const r = await rodar(
      { slug: "mensagem-preparacao" },
      {
        duplas: {
          data: [
            {
              id: DUPLA.id,
              trilha: "dpp",
              status: "ativa",
              turma: "Turma 1",
              mentor: { nome: "Ricardo Souza", nome_social: null },
              mentorado: { nome: "Ana Beatriz Lima", nome_social: "Ana" },
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              trilha: "dpp",
              status: "ativa",
              turma: "Turma 1",
              mentor: { nome: "Ricardo Souza", nome_social: null },
              mentorado: { nome: "Matheus Alves", nome_social: null },
            },
          ],
          count: 2,
        },
      }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      template: { slug: string; corpo: string };
      total: number;
      duplas: { dupla_id: string; mentorado: string | null }[];
    };
    expect(d.template.slug).toBe("mensagem-preparacao");
    expect(d.template.corpo).toContain("[Nome]");
    expect(d.total).toBe(2);
    expect(d.duplas.map((x) => x.mentorado)).toEqual(["Ana", "Matheus Alves"]);
  });
});

describe("mensagem_template — com dupla_id", () => {
  it("indicadas traz contatos e o link público de cada pessoa", async () => {
    const r = await rodar(
      { slug: "mensagem-indicadas", dupla_id: DUPLA.id },
      {
        duplas: { data: [DUPLA] },
        profiles_contato: {
          data: [
            { id: "m-1", whatsapp: "5511911111111" },
            { id: "s-1", whatsapp: "5511922222222" },
          ],
        },
        ciclo_eventos: { data: [] },
        terceiros_contatos: {
          data: [
            {
              id: "t-1",
              nome: "Maria Silva",
              vinculo: "familiar",
              whatsapp: "5511933333333",
              token: "tok_maria",
              expira_em: "2026-04-01T00:00:00Z",
              status: "pendente",
              created_at: "2026-03-01T00:00:00Z",
            },
          ],
        },
      }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      dupla: {
        contatos: {
          mentor: { whatsapp: string | null } | null;
          mentorado: { whatsapp: string | null } | null;
        };
        indicadas: {
          nome: string;
          whatsapp: string | null;
          link: string;
          status: string;
        }[];
      };
    };
    // whatsapp do staff sai da profiles_contato; o do jovem, do embed
    expect(d.dupla.contatos.mentor?.whatsapp).toBe("5511911111111");
    expect(d.dupla.contatos.mentorado?.whatsapp).toBe("5511955555555");
    expect(d.dupla.indicadas).toHaveLength(1);
    expect(d.dupla.indicadas[0].nome).toBe("Maria Silva");
    expect(d.dupla.indicadas[0].link).toBe(`${SITE_URL}/t/tok_maria`);
    // resposta livre da indicada nunca viaja — nem a coluna entra no select
  });

  it("encaminhamento traz as tarefas pendentes da dupla", async () => {
    const r = await rodar(
      { slug: "mensagem-encaminhamento", dupla_id: DUPLA.id },
      {
        duplas: { data: [DUPLA] },
        profiles_contato: { data: [] },
        ciclo_eventos: { data: [] },
        encaminhamentos: {
          data: [
            {
              id: "en-1",
              descricao: "revisar o PDM com as metas",
              responsavel: "mentorado",
              prazo: "2026-03-18",
              status: "pendente",
              numero: 1,
              feito_em: null,
              created_at: "2026-03-02T00:00:00Z",
              dupla: { id: DUPLA.id, trilha: "dpp", turma: "Turma 1", status: "ativa", mentor: null, mentorado: null },
            },
          ],
        },
      }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      dupla: {
        combinados_pendentes: { texto: string; prazo: string | null }[];
        ultimo_encontro: { numero: number } | null;
        proximo_encontro: { numero: number } | null;
      };
    };
    expect(d.dupla.combinados_pendentes[0].texto).toBe(
      "revisar o PDM com as metas"
    );
    expect(d.dupla.ultimo_encontro?.numero).toBe(3);
    expect(d.dupla.proximo_encontro?.numero).toBe(4);
    // encaminhamento não carrega indicadas e vice-versa
    expect("indicadas" in d.dupla).toBe(false);
  });

  it("preparação traz nomes e contatos sem carregar extras", async () => {
    const r = await rodar(
      { slug: "mensagem-preparacao", dupla_id: DUPLA.id },
      {
        duplas: { data: [DUPLA] },
        profiles_contato: { data: [{ id: "m-1", whatsapp: "5511911111111" }] },
        ciclo_eventos: { data: [] },
      }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      template: { nota: string };
      dupla: { mentor: string | null; mentorado: string | null };
    };
    expect(d.dupla.mentor).toBe("Ricardo Souza");
    expect(d.dupla.mentorado).toBe("Ana");
    expect(d.template.nota).toContain("whatsapp");
    expect("combinados_pendentes" in (d.dupla as object)).toBe(false);
  });

  it("dupla fora do escopo devolve dupla:null, sem vazar existência", async () => {
    const r = await rodar(
      { slug: "mensagem-preparacao", dupla_id: DUPLA.id },
      { duplas: { data: [] }, ciclo_eventos: { data: [] } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.dados as { dupla: unknown }).dupla).toBeNull();
  });
});
