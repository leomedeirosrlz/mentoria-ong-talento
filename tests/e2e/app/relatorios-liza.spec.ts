import type { Page } from "@playwright/test";
import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// e2e app dos cards "Perguntar à Liza" (REALIZA-456): a camada SQL prova o
// contrato sem queimar chamada de LLM — RLS coord-only, RPC com dedup e
// supersede atômicos, badge "desatualizado" quando o hash muda, e o canal
// 'relatorio' valendo no ledger de ia_eventos.
//
// A UI de geração (botão → provider → card) é coberta no spec demo com a
// resposta enlatada; aqui o provider real ficaria caro e instável.

const REST = () => process.env.E2E_SUPABASE_URL!;
const KEY = () => process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;

/** JWT do usuário logado na página — @supabase/ssr guarda a sessão em
 *  cookies httpOnly "sb-<ref>-auth-token[.N]" (chunks ordenados, valor
 *  "base64-<json>"); no modo proxy local o storageKey vira "realiza-auth"
 *  (src/lib/supabase/config.ts), mesmo formato e mesmo chunking. É como o
 *  e2e chama REST como o papel real, não como service role. */
async function tokenDaPagina(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const chunks = cookies
    .filter((c) =>
      c.name.match(/^(sb-.+-auth-token|realiza-auth)(\.\d+)?$/)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!chunks.length) throw new Error("cookie de sessão supabase não achado");
  let raw = decodeURIComponent(chunks.map((c) => c.value).join(""));
  if (raw.startsWith("base64-")) {
    raw = Buffer.from(raw.slice(7), "base64url").toString("utf8");
  }
  const sessao = JSON.parse(raw) as { access_token?: string };
  if (!sessao.access_token) throw new Error("access_token ausente na sessão");
  return sessao.access_token;
}

async function restComoUsuario(
  token: string,
  caminho: string,
  init: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const anon = process.env.E2E_SUPABASE_ANON_KEY ?? KEY();
  const res = await fetch(`${REST()}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

// a página calcula recorteKey({aba:"aderencia"}) = "aderencia|||||" — o
// card só renderiza se a key bater com o recorte atual da URL. O cleanup
// usa o prefixo hash-e2e do contexto_hash, não a key (ela é compartilhada
// com cards reais da coordenação no staging).
const KEY_REAL = "aderencia|||||";

const CARD_ARGS = {
  p_secao: "aderencia",
  p_recorte: {},
  p_recorte_key: KEY_REAL,
  p_contexto_hash: "hash-e2e-1",
  p_pergunta: "O que pede ação agora?",
  p_resposta_md: "Resposta de teste — três achados pedem ação.",
  p_modelo: "e2e-modelo",
  p_tier: "forte",
};

type CardRow = {
  id: string;
  secao: string;
  contexto_hash: string;
  superseded_by: string | null;
};

test.describe("relatorios — cards da Liza (456)", () => {
  test.skip(!appEnvOk(), "env e2e do backend real ausente");

  test.afterEach(async () => {
    await limparViaServiceRole(
      "relatorio_ia_cards",
      `recorte_key=eq.${encodeURIComponent(KEY_REAL)}&contexto_hash=like.hash-e2e-*`
    );
    await limparViaServiceRole(
      "ia_eventos",
      "canal=eq.relatorio&args->>spec=eq.e2e-456"
    );
  });

  test("RLS: mentor não lê nem insere; a RPC barra papel sem coordenação", async ({
    page,
  }) => {
    await loginComSenha(
      page,
      process.env.E2E_MENTOR_EMAIL!,
      process.env.E2E_MENTOR_PASSWORD!
    );
    const mentor = await tokenDaPagina(page);

    const sel = await restComoUsuario(mentor, "relatorio_ia_cards?select=id");
    expect(sel.status).toBe(200);
    expect((sel.body as unknown[]).length).toBe(0);

    const ins = await restComoUsuario(mentor, "relatorio_ia_cards", {
      method: "POST",
      body: JSON.stringify({
        secao: "aderencia",
        recorte_key: "x",
        contexto_hash: "x",
        pergunta: "x",
        resposta_md: "x",
      }),
    });
    expect([400, 401, 403]).toContain(ins.status);

    const rpc = await restComoUsuario(mentor, "rpc/relatorio_ia_card_registrar", {
      method: "POST",
      body: JSON.stringify(CARD_ARGS),
    });
    expect([400, 403]).toContain(rpc.status);
  });

  test("RPC: cria o vigente, deduplica, pendura o anterior e a página mostra desatualizado", async ({
    page,
  }) => {
    await loginComSenha(
      page,
      process.env.E2E_COORD_EMAIL!,
      process.env.E2E_COORD_PASSWORD!
    );
    const coord = await tokenDaPagina(page);
    const registrar = async (args: Record<string, unknown>) => {
      const res = await restComoUsuario(coord, "rpc/relatorio_ia_card_registrar", {
        method: "POST",
        body: JSON.stringify(args),
      });
      const body = res.body;
      const row = (Array.isArray(body) ? body[0] : body) as CardRow;
      return { status: res.status, row };
    };

    const c1 = await registrar(CARD_ARGS);
    expect(c1.status).toBe(200);
    expect(c1.row.secao).toBe("aderencia");
    expect(c1.row.contexto_hash).toBe("hash-e2e-1");

    // mesmo contexto+pergunta → dedup: a MESMA row, sem gerar irmã
    const c2 = await registrar(CARD_ARGS);
    expect(c2.status).toBe(200);
    expect(c2.row.id).toBe(c1.row.id);

    // contexto mudou → nova vigente e a anterior fica pendurada nela
    const c3 = await registrar({ ...CARD_ARGS, p_contexto_hash: "hash-e2e-2" });
    expect(c3.status).toBe(200);
    expect(c3.row.id).not.toBe(c1.row.id);

    const todas = await buscarViaServiceRole<CardRow[]>(
      "relatorio_ia_cards",
      `select=id,superseded_by&recorte_key=eq.${encodeURIComponent(KEY_REAL)}&contexto_hash=like.hash-e2e-*`
    );
    expect(todas).toHaveLength(2);
    expect(todas.find((t) => t.id === c1.row.id)!.superseded_by).toBe(c3.row.id);
    expect(todas.find((t) => t.id === c3.row.id)!.superseded_by).toBeNull();

    // o card vigente renderiza na seção; o hash dele ('hash-e2e-2') difere
    // do contexto real calculado na hora → badge "Desatualizado"
    await page.goto("/relatorios/operacionais?aba=aderencia");
    await expect(
      page.getByText(/Resposta de teste/).first()
    ).toBeVisible();
    await expect(page.getByText(/Desatualizado/)).toBeVisible();
  });

  test("canal 'relatorio' vale no ledger e 'bogus' continua barrado no CHECK", async () => {
    const profiles = await buscarViaServiceRole<{ id: string }[]>(
      "profiles",
      "select=id&limit=1"
    );
    const post = (corpo: Record<string, unknown>) =>
      fetch(`${REST()}/rest/v1/ia_eventos`, {
        method: "POST",
        headers: {
          apikey: KEY(),
          Authorization: `Bearer ${KEY()}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(corpo),
      });

    const okRes = await post({
      profile_id: profiles[0].id,
      canal: "relatorio",
      tool: "mensagem",
      args: { spec: "e2e-456" },
      ok: true,
    });
    expect(okRes.status).toBe(201);

    const bad = await post({
      profile_id: profiles[0].id,
      canal: "bogus",
      tool: "mensagem",
      args: { spec: "e2e-456" },
      ok: true,
    });
    // viola ia_eventos_canal_check (23514 → 400 no PostgREST atual)
    expect([400, 409]).toContain(bad.status);
  });
});
