import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  corpoDigestSemanal,
  DIGEST_CONFIG_PADRAO,
  montarDigestSemanal,
  normalizarDigestConfig,
  validarDigestConfigInput,
  type DigestConfig,
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
    // sem config na fila → padrão: audiência é a coordenação, sem extra
    expect(r.audiencia).toEqual(["coordenacao"]);
  });

  it("destinatários configurados: união papéis + pessoas + e-mails com dedup", async () => {
    const cfg: DigestConfig = {
      ...DIGEST_CONFIG_PADRAO,
      destinatarios: {
        papeis: ["coordenacao", "supervisor"],
        profiles: ["7d0f0f7f-5a04-4f1f-b359-1b2f4f5d9f9d"],
        emails: ["externo@parceiro.org", "c@x.com"],
      },
    };
    const supa = fakeSupa({
      duplas: [{ data: [] }],
      ciclo_eventos: [{ data: [] }, { data: [] }],
      cronogramas: [{ data: [] }],
      assinaturas: [{ count: 0 }],
      profiles: [{ data: [{ id: "p-coord" }] }, { data: [{ id: "p-avulso" }] }],
      profiles_contato: [
        {
          data: [
            { id: "p-coord", email: "c@x.com" },
            { id: "p-avulso", email: "avulsa@realiza.vc" },
          ],
        },
      ],
    });
    const r = await montarDigestSemanal(supa, SEMANA, dth("2025-10-27", "12:00"), cfg);
    const destinos = r.mensagens.map((m) => m.to).sort();
    // c@x.com aparece 1× mesmo entrando por papel e por e-mail explícito
    expect(destinos).toEqual([
      "avulsa@realiza.vc",
      "c@x.com",
      "externo@parceiro.org",
    ]);
    expect(r.audiencia).toEqual(["coordenacao", "supervisor", "lista_direta"]);
  });

  it("seções desligadas não entram no corpo", async () => {
    const cfg: DigestConfig = {
      ...DIGEST_CONFIG_PADRAO,
      secoes: { encontros: false, riscos: false, pendencias: true },
    };
    const dupla = mkDupla({
      mentorado: mkMentorado({ nome: "Ana Silva Souza", nome_social: null }),
      encontros: [encRealizado(1, "2025-10-07")],
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
    const r = await montarDigestSemanal(supa, SEMANA, dth("2025-10-27", "12:00"), cfg);
    expect(r.mensagens[0].html).not.toContain("Encontros da semana");
    expect(r.mensagens[0].html).not.toContain("Duplas em risco");
    expect(r.mensagens[0].html).toContain("Pendências");
    // as contagens seguem computadas pro log do job — a seção é só corpo
    expect(r.nPendentes).toBeGreaterThan(0);
  });
});

// ---------- rodarDigestSemanal (guard + dedup) ----------

function adminFake({
  dedup,
  inseridos,
  configRow,
  gtes,
}: {
  dedup: number;
  inseridos: Record<string, unknown>[];
  /** Row da digest_config quando o job lê pelo caminho real — [] = sem row. */
  configRow?: Record<string, unknown>[];
  /** Captura os bounds do .gte() no dedup — valida a janela da cadência. */
  gtes?: string[];
}) {
  return {
    from(tabela: string) {
      if (tabela === "digest_config") {
        const q: Record<string, unknown> & {
          then: (res: (v: unknown) => unknown) => Promise<unknown>;
        } = {
          select: () => q,
          eq: () => q,
          then: (res) =>
            Promise.resolve({
              data: configRow ?? [],
              count: null,
              error: null,
            }).then(res),
        };
        return q;
      }
      if (tabela !== "emails_enviados") throw new Error(`tabela ${tabela}`);
      const q: Record<string, unknown> & {
        then: (res: (v: unknown) => unknown) => Promise<unknown>;
      } = {
        select: () => q,
        eq: () => q,
        gt: () => q,
        gte: (_c: string, v: string) => {
          gtes?.push(v);
          return q;
        },
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
  assunto: "Digest semanal: teste",
  mensagens: [{ to: "c@x.com", subject: "s", html: "<p>h</p>" }],
  audiencia: ["coordenacao"],
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

  // ---------- config (REALIZA-451) ----------

  it("cadencia desligado → pulado sem montar, enviar nem dedup", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn();
    const montar = vi.fn(MONTAR_FALSO);
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar: enviar as never,
      montar,
      lerConfig: vi.fn(async () => ({
        ...DIGEST_CONFIG_PADRAO,
        cadencia: "desligado" as const,
      })),
    });
    expect(r).toEqual({ ok: true, pulado: "digest desligado na configuração" });
    expect(montar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
    expect(inseridos).toHaveLength(0);
  });

  it("dia_semana configurado: segunda em outro dia → pulado; no dia → envia", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const lerConfig = vi.fn(async () => ({
      ...DIGEST_CONFIG_PADRAO,
      diaSemana: 3, // quarta
    }));
    // segunda (2025-10-27) com dia=3 → não roda
    const r1 = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar: vi.fn(async () => ({ enviados: 1, falhas: [] })) as never,
      montar: vi.fn(MONTAR_FALSO),
      lerConfig,
    });
    expect(r1).toEqual({ ok: true, pulado: true });
    // quarta (2025-10-29) com dia=3 → roda
    const r2 = await rodarDigestSemanal(ctx("2025-10-29"), {
      admin: adminFake({ dedup: 0, inseridos }),
      enviar: vi.fn(async () => ({ enviados: 1, falhas: [] })) as never,
      montar: vi.fn(MONTAR_FALSO),
      lerConfig,
    });
    expect(r2.ok).toBe(true);
    expect(r2.enviados).toBe(1);
  });

  it("quinzenal: dedup olha os últimos 14 dias, não a semana civil", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const gtes: string[] = [];
    const lerConfig = vi.fn(async () => ({
      ...DIGEST_CONFIG_PADRAO,
      cadencia: "quinzenal" as const,
    }));
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 1, inseridos, gtes }),
      enviar: vi.fn() as never,
      montar: vi.fn(MONTAR_FALSO),
      lerConfig,
    });
    expect(r.pulado).toBe("quinzenal: último envio há menos de 14 dias");
    expect(gtes).toHaveLength(1);
    // bound = hoje(12:00Z) − 14d → 2025-10-13T12:00 — diferente do início
    // da semana civil que a cadência semanal usaria
    expect(gtes[0]).toBe("2025-10-13T12:00:00.000Z");
    expect(inseridos).toHaveLength(0);
  });

  it("sem row na tabela → lerDigestConfig real devolve o padrão e envia", async () => {
    const inseridos: Record<string, unknown>[] = [];
    const enviar = vi.fn(async () => ({ enviados: 1, falhas: [] }));
    const montar = vi.fn(MONTAR_FALSO);
    // sem lerConfig injetada: o job lê digest_config pelo admin fake (row ausente)
    const r = await rodarDigestSemanal(ctx(SEG), {
      admin: adminFake({ dedup: 0, inseridos, configRow: [] }),
      enviar: enviar as never,
      montar,
    });
    expect(r.ok).toBe(true);
    expect(r.enviados).toBe(1);
    expect(montar).toHaveBeenCalledWith(
      expect.anything(),
      { seg: SEG, dom: "2025-11-02" },
      undefined,
      DIGEST_CONFIG_PADRAO
    );
  });
});

// ---------- digest_config (REALIZA-451) ----------

describe("normalizarDigestConfig", () => {
  it("null/lixo → padrão integral (comportamento legado)", () => {
    expect(normalizarDigestConfig(null)).toEqual(DIGEST_CONFIG_PADRAO);
    expect(normalizarDigestConfig("x")).toEqual(DIGEST_CONFIG_PADRAO);
    expect(normalizarDigestConfig(42)).toEqual(DIGEST_CONFIG_PADRAO);
    expect(normalizarDigestConfig({})).toEqual(DIGEST_CONFIG_PADRAO);
  });

  it("campo inválido cai no default daquele campo só", () => {
    const c = normalizarDigestConfig({
      dia_semana: 9,
      cadencia: "mensal",
      destinatarios: "string solta",
      secoes: { riscos: false },
    });
    expect(c.diaSemana).toBe(1);
    expect(c.cadencia).toBe("semanal");
    expect(c.destinatarios).toEqual(DIGEST_CONFIG_PADRAO.destinatarios);
    expect(c.secoes).toEqual({
      encontros: true,
      riscos: false,
      pendencias: true,
    });
  });

  it("filtra papel fora do enum, uuid ruim e e-mail malformado", () => {
    const c = normalizarDigestConfig({
      destinatarios: {
        papeis: ["coordenacao", "intruso", "supervisor"],
        profiles: ["7d0f0f7f-5a04-4f1f-b359-1b2f4f5d9f9d", "não-uuid", ""],
        emails: ["ok@x.com", "  MAIUSCULA@X.COM ", "quebrado@"],
      },
    });
    expect(c.destinatarios.papeis).toEqual(["coordenacao", "supervisor"]);
    expect(c.destinatarios.profiles).toEqual([
      "7d0f0f7f-5a04-4f1f-b359-1b2f4f5d9f9d",
    ]);
    expect(c.destinatarios.emails).toEqual(["ok@x.com", "maiuscula@x.com"]);
  });
});

describe("validarDigestConfigInput", () => {
  const base = {
    diaSemana: 1,
    cadencia: "semanal",
    papeis: ["coordenacao"],
    profiles: [] as string[],
    emails: [] as string[],
    secoes: { encontros: true, riscos: true, pendencias: true },
  };

  it("input válido → ok com config normalizada", () => {
    const r = validarDigestConfigInput({
      ...base,
      diaSemana: 4,
      cadencia: "quinzenal",
      papeis: ["coordenacao", "supervisor"],
      profiles: ["7d0f0f7f-5a04-4f1f-b359-1b2f4f5d9f9d"],
      emails: ["a@b.com", " A@B.com ", "c@d.org"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.diaSemana).toBe(4);
      expect(r.config.cadencia).toBe("quinzenal");
      expect(r.config.destinatarios.emails).toEqual(["a@b.com", "c@d.org"]);
    }
  });

  it("rejeita dia fora de 0-6, cadência fora do enum e papel fora da equipe", () => {
    expect(validarDigestConfigInput({ ...base, diaSemana: 7 }).ok).toBe(false);
    expect(validarDigestConfigInput({ ...base, diaSemana: 1.5 }).ok).toBe(false);
    expect(
      validarDigestConfigInput({ ...base, cadencia: "mensal" }).ok
    ).toBe(false);
    const p = validarDigestConfigInput({ ...base, papeis: ["mentorado"] });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toContain("Papel inválido");
  });

  it("rejeita uuid e e-mail malformados, e nenhuma seção ativa", () => {
    expect(
      validarDigestConfigInput({ ...base, profiles: ["abc"] }).ok
    ).toBe(false);
    const e = validarDigestConfigInput({ ...base, emails: ["sem-arroba"] });
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.error).toContain("sem-arroba");
    const s = validarDigestConfigInput({
      ...base,
      secoes: { encontros: false, riscos: false, pendencias: false },
    });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.error).toContain("seção");
  });

  it("rejeita público zerado — desligado é o off, não lista vazia", () => {
    const r = validarDigestConfigInput({ ...base, papeis: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("destinatário");
  });
});
