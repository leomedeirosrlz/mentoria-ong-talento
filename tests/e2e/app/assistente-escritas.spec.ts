import type { Page } from "@playwright/test";
import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  jwtDoUsuario,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  restComoUsuario,
  test,
} from "../helpers";

// REALIZA-126 — o approve das escritas da IA é DETERMINÍSTICO: o modelo
// nunca vê o confirmacao_id (a rota sanitiza o tool-result) e o Confirmar
// do card bate em POST /api/ia/confirmacao, que reusa o envelope chamando
// a tool com confirmacao_id. O que o e2e cobre sem provider LLM:
//   · a linha ia_confirmacoes criada via RPC (a mesma que a tool grava na
//     1ª chamada) + o POST consumindo atomicamente — uso único, dono e
//     hash de args conferidos no banco;
//   · a escrita chegando de fato (interacoes insert via core);
//   · o guard de domínio intacto pela tool: coord chama agendar_encontro
//     e recebe a recusa real "Quem agenda é a dupla" — sem contorno.
// O pedaço visual (card → clique) já é coberto pelos vitest da rota e do
// card; e2e do chat com provider fica pros ambientes com IA_API_*.

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const MENTOR_SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

// fixture do seed-e2e-staging: dupla viva mentor+jovem (…030)
const DUPLA = "e2e00000-0000-4000-8000-000000000030";

/** POST autenticado no endpoint de confirmação — page.request leva o
 *  cookie de sessão do login (contexto), igual ao fetch do card. */
function postConfirmacao(
  page: Page,
  body: { confirmacao_id: string; tool: string; args: Record<string, unknown> }
) {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
  return page.request.post("/api/ia/confirmacao", {
    data: body,
    headers: bypass
      ? { "x-vercel-protection-bypass": bypass }
      : undefined,
  });
}

/** Cria a linha ia_confirmacoes do dono do JWT — a mesma RPC que o
 *  executarTool chama na 1ª passada da tool de escrita. */
async function criarPrevia(
  jwt: string,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await restComoUsuario("rpc/ia_confirmacao_criar", jwt, {
    method: "POST",
    body: { p_tool: tool, p_args: args, p_resumo: `e2e ${tool}` },
  });
  expect(res.status).toBe(200);
  const id = (await res.json()) as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

test.describe("assistente — escritas confirmadas", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test("confirmacao executa a escrita, vale uma vez e recusa divergência", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    const jwt = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
    const nota = `e2e-${Date.now()}`;
    const args = { dupla_id: DUPLA, tipo: "contato", nota };

    // feliz: prévia → POST → insert em interacoes (canal in_app, autor
    // do dono da prévia — a coord)
    const cid = await criarPrevia(jwt, "registrar_interacao", args);
    const okRes = await postConfirmacao(page, {
      confirmacao_id: cid,
      tool: "registrar_interacao",
      args,
    });
    expect(okRes.status()).toBe(200);
    await expect(okRes.json()).resolves.toMatchObject({ ok: true });
    const linhas = await buscarViaServiceRole<{ canal: string }[]>(
      "interacoes",
      `dupla_id=eq.${DUPLA}&nota=eq.${nota}&select=canal`
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].canal).toBe("in_app");

    // uso único: a mesma prévia não executa de novo — nem duplica a linha
    const reuse = await postConfirmacao(page, {
      confirmacao_id: cid,
      tool: "registrar_interacao",
      args,
    });
    await expect(reuse.json()).resolves.toMatchObject({ ok: false });
    const depois = await buscarViaServiceRole<unknown[]>(
      "interacoes",
      `dupla_id=eq.${DUPLA}&nota=eq.${nota}`
    );
    expect(depois).toHaveLength(1);

    // args divergentes do hash guardado: a linha existe mas não casa —
    // falha fechado, sem efeito
    const cid2 = await criarPrevia(jwt, "registrar_interacao", args);
    const divergente = await postConfirmacao(page, {
      confirmacao_id: cid2,
      tool: "registrar_interacao",
      args: { ...args, nota: "adulterada" },
    });
    await expect(divergente.json()).resolves.toMatchObject({ ok: false });

    // dono errado: a prévia é da coord — o mentor logado não consome
    await relogar(page, MENTOR_EMAIL, MENTOR_SENHA);
    const cid3 = await criarPrevia(jwt, "registrar_interacao", args);
    const alheio = await postConfirmacao(page, {
      confirmacao_id: cid3,
      tool: "registrar_interacao",
      args,
    });
    await expect(alheio.json()).resolves.toMatchObject({ ok: false });

    await limparViaServiceRole(
      "interacoes",
      `dupla_id=eq.${DUPLA}&nota=like.e2e-*`
    );
  });

  test("coord chama agendar_encontro e recebe a recusa real do domínio", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    const jwt = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
    const args = {
      dupla_id: DUPLA,
      numero: 20,
      data_hora: "2099-06-02T19:00:00-03:00",
    };
    const cid = await criarPrevia(jwt, "agendar_encontro", args);
    const res = await postConfirmacao(page, {
      confirmacao_id: cid,
      tool: "agendar_encontro",
      args,
    });
    expect(res.status()).toBe(200);
    const j = (await res.json()) as { ok: boolean; erro?: string };
    expect(j.ok).toBe(false);
    expect(j.erro).toContain("Quem agenda é a dupla");
    // e não nasceu encontro fantasma nº 20
    const encs = await buscarViaServiceRole<unknown[]>(
      "encontros",
      `dupla_id=eq.${DUPLA}&numero=eq.20`
    );
    expect(encs).toHaveLength(0);
  });
});
