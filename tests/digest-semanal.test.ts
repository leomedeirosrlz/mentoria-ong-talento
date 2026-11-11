import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  corpoDigestSemanal,
  montarDigestSemanal,
} from "@/lib/relatorios/digest";
import { rodarDigestSemanal } from "@/lib/jobs-digest";
import type { JobContext } from "@/lib/jobs";
import { CICLO_16, dth, encRealizado, mkDupla, mkMentorado } from "./helpers";

// Digest semanal (REALIZA-178): corpo puro (LGPD — 1º nome + motivos de
// enum), montagem com universo fake (cliente estrutural) e o job do tick
// (guard de segunda + dedup por emails_enviados enviados>0).

const SEG = "2025-10-27"; // segunda
const SEMANA = { seg: SEG, dom: "2025-11-02" };

// ---------- corpoDigestSemanal (puro) ----------

describe("corpoDigestSemanal", () => {
  it("lista risco com 1º nome + motivo e contabiliza pendências", () => {
    const { assunto, conteudoHtml, nPendentes } = corpoDigestSemanal({
      semana: SEMANA,
      resumos: [],
      riscos: [{ nome: "Ana", motivo: "2 encontros atrasados" }],
      nAtencao: 3,
      nLimbo: 1,
      nAssinaturas: 2,
      formacoesSemChamada: 1,
    });
    expect(assunto).toContain("Digest semanal");
    expect(conteudoHtml).toContain("Ana");
    expect(conteudoHtml).toContain("2 encontros atrasados");
    expect(conteudoHtml).toContain("+ 3 em atenção");
    expect(nPendentes).toBe(4);
  });

  it("nunca serializa texto livre — escapa o que recebe", () => {
    const { conteudoHtml } = corpoDigestSemanal({
      semana: SEMANA,
      resumos: [],
      riscos: [{ nome: "<img>", motivo: "<b>script</b>" }],
      nAtencao: 0,
      nLimbo: 0,
      nAssinaturas: 0,
      formacoesSemChamada: 0,
    });
    expect(conteudoHtml).not.toContain("<img>");
    expect(conteudoHtml).toContain("&lt;img&gt;");
  });
});

// ---------- montarDigestSemanal (universo fake) ----------

/** Cliente estrutural: encadeia os métodos que os fetchers usam; a fila
 *  por tabela devolve respostas diferentes em chamadas sucessivas
 *  (ciclo_eventos é consultado 2× — eventos e depois formações). */
function fakeSupa(
  filas: Record<string, { data?: unknown[]; count?: number }[]>
): SupabaseClient {
  const usadas = new Map<string, number>();
  const from = (tabela: string) => {
    const i = usadas.get(tabela) ?? 0;
    usadas.set(tabela, i + 1);
    const fila = filas[tabela] ?? [{ data: [] }];
    const alvo = fila[Math.min(i, fila.length - 1)];
    const q: Record<string, unknown> & {
      then: (res: (v: unknown) => unknown) => Promise<unknown>;
    } = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      is: () => q,
      not: () => q,
      gte: () => q,
      gt: () => q,
      lte: () => q,
      order: () => q,
      then: (res) =>
        Promise.resolve({
          data: alvo.data ?? null,
          count: alvo.count ?? null,
          error: null,
        }).then(res),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

describe("montarDigestSemanal", () => {
  it("monta mensagens pra coordenação — 1º nome + motivo, sem texto livre", async () => {
    // dupla com 1 realizado de 3 esperados na segunda da semana → risco
    const dupla = mkDupla({
      mentorado: mkMentorado({
        nome: "Ana Silva Souza",
        nome_social: null,
      }),
      encontros: [
        encRealizado(1, "2025-10-07"),
        // 2 e 3 esperados (14/10, 21/10) sem encontro → 2 atrasos → risco
      ],
    });
    const supa = fakeSupa({
      duplas: [{ data: [dupla] }],
      ciclo_eventos: [{ data: CICLO_16 }, { data: [] }],
      cronogramas: [
        { data: [{ id: "cron-t1", nome: "Ciclo T1", turma: "T1" }] },
      ],
      assinaturas: [{ count: 2 }],
      profiles: [{ data: [{ id: "p-coord" }] }],
      profiles_contato: [{ data: [{ id: "p-coord", email: "c@x.com" }] }],
    });

    const r = await montarDigestSemanal(
      supa,
      SEMANA,
      dth("2025-10-27", "12:00")
    );
    expect(r.mensagens).toHaveLength(1);
    const msg = r.mensagens[0];
    expect(msg.to).toBe("c@x.com");
    expect(msg.subject).toBe(r.assunto);
    // LGPD: 1º nome do mentorado + motivo do semáforo — nunca sobrenome,
    // nunca os campos livres (reflexoes/observacoes nem existem no caminho)
    expect(msg.html).toContain("Ana");
    expect(msg.html).not.toContain("Silva Souza");
    expect(msg.html).not.toContain("reflexoes");
    expect(msg.html).not.toContain("observacoes");
    expect(msg.html).toContain("/relatorios");
    expect(r.nRisco).toBe(1);
  });
});

// ---------- rodarDigestSemanal (guard + dedup) ----------

function adminFake({
  dedup,
  inseridos,
}: {
  dedup: number;
  inseridos: Record<string, unknown>[];
}) {
  return {
    from(tabela: string) {
      if (tabela !== "emails_enviados") throw new Error(`tabela ${tabela}`);
      const q: Record<string, unknown> & {
        then: (res: (v: unknown) => unknown) => Promise<unknown>;
      } = {
        select: () => q,
        eq: () => q,
        gt: () => q,
        gte: () => q,
        insert: (row: Record<string, unknown>) => {
          inseridos.push(row);
          return Promise.resolve({ error: null });
        },
        then: (res) =>
          Promise.resolve({ count: dedup, data: null, error: null }).then(res),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

const MONTAR_FALSO = vi.fn(async () => ({
  assunto: "Digest semanal — teste",
  mensagens: [{ to: "c@x.com", subject: "s", html: "<p>h</p>" }],
  nRisco: 2,
  nPendentes: 3,
}));

describe("rodarDigestSemanal", () => {
  const ctx = (hoje: string): JobContext => ({ hoje, confirm: false });

  it("não-segunda → {ok, pulado} sem montar, enviar nem logar", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn();
    const montar = vi.fn(MONTAR_FALSO);
    const r = await rodarDigestSemanal(ctx("2025-10-28"), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar: enviar as never,
      montar,
    });
    expect(r).toEqual({ ok: true, pulado: true });
    expect(montar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
    expect(inseridos).toHaveLength(0);
  });

  it("segunda com envio>0 na semana → dedup devolve pulado", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn();
    const montar = vi.fn(MONTAR_FALSO);
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 1, inseridos }),
      enviar: enviar as never,
      montar,
    });
    expect(r.ok).toBe(true);
    expect(r.pulado).toBe("já enviado esta semana");
    expect(montar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
    expect(inseridos).toHaveLength(0);
  });

  it("segunda com envio=0 antes → tentativa legítima envia e grava log", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn(async () => ({ enviados: 1, falhas: [] }));
    const montar = vi.fn(MONTAR_FALSO);
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar,
      montar,
    });
    expect(r.ok).toBe(true);
    expect(r.enviados).toBe(1);
    expect(montar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    // a row de log SEMPRE grava — autor_id null no cron
    expect(inseridos).toHaveLength(1);
    expect(inseridos[0]).toMatchObject({
      autor_id: null,
      tipo: "digest",
      enviados: 1,
      audiencia: ["coordenacao"],
    });
  });

  it("falha de transporte → ok=false e log com enviados=0", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn(async () => ({
      enviados: 0,
      falhas: ["c@x.com"],
      error: "E-mail não configurado no servidor.",
    }));
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar,
      montar: vi.fn(MONTAR_FALSO),
    });
    expect(r.ok).toBe(false);
    expect(inseridos[0]).toMatchObject({ enviados: 0, tipo: "digest" });
  });
});
