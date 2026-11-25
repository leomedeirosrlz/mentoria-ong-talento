import type { Page } from "@playwright/test";
import {
  appEnvOk,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  rpcViaServiceRole,
  test,
  tokensDoUsuario,
} from "../helpers";

// REALIZA-373 — os edge cases do handoff do magic link contra o backend
// real. O que o spec cobre:
//
//  - /auth/link SEM ?h= com tokens válidos: não descarta mais o link —
//    segura os tokens e pede o gesto explícito ("Entrar como {email}"), que
//    só então vira sessão (anti-fixação preservada).
//  - race falhar × registrar (0181): tokens sempre vencem tombstone —
//    registrar tardio resgata nonce failed; falhar tardio não apaga tokens;
//    2º registrar não sobrescreve tokens bons.
//  - link sobrevive a reload: o pedido (nonce+email+em) na sessionStorage
//    remonta o painel e o poll resgata o handoff publicado — e limpa a
//    espera em toda saída terminal.
//  - janela do pedido (70min): fora dela não restaura; cruzando durante a
//    espera morre com aviso; handoff publicado mas expirado idem.
//
// Os tokens vêm do grant password do GoTrue (tokensDoUsuario) — access e
// refresh reais e casados, que é o que o setSession do gesto/resgate exige.

const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

// nonces que o spec criou — o afterEach varre os que o poll não consumiu
// (pegar é uso único; os restantes seriam varridos pelo TTL de 10min mesmo)
const nonces: string[] = [];
const novoNonce = () => {
  const n = crypto.randomUUID();
  nonces.push(n);
  return n;
};

test.afterEach(async () => {
  if (!nonces.length) return;
  await limparViaServiceRole("login_handoffs", `nonce=in.(${nonces.join(",")})`)
    .catch(() => {});
  nonces.length = 0;
});

/** Planta o pedido como o pedirLink gravaria e recarrega — o restore
 *  mora no effect de mount, então o reload é o gatilho real. */
async function plantarPedidoERecarregar(
  page: Page,
  pedido: { h: string; email: string; em: number }
) {
  await page.goto("/login");
  await page.evaluate(
    (p) => sessionStorage.setItem("login:pedido", JSON.stringify(p)),
    pedido
  );
  await page.reload();
}

const PAINEL_ENVIADO = "Link enviado";
const FORM_PEDIDO = "Receber link de acesso";

// ---------- gesto explícito do link sem ?h= ----------

test("link sem ?h= oferece o gesto e entra neste aparelho", async ({
  page,
}) => {
  const { access_token, refresh_token } = await tokensDoUsuario(EMAIL, SENHA);
  await page.goto(
    `/auth/link#access_token=${access_token}&refresh_token=${refresh_token}&type=magiclink`
  );
  // o card mostra o e-mail do JWT — a pessoa confirma a conta antes de entrar
  await expect(
    page.getByText(`Entrar como ${EMAIL} neste aparelho?`)
  ).toBeVisible();
  // a sessão NÃO existe antes do clique — anti-fixação
  await page.getByRole("button", { name: "Entrar neste aparelho" }).click();
  // fixture tem senha_em → vai pro destino (senão /auth/definir-senha — os
  // dois saem de /auth/link, que é o que interessa)
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/link"), {
    timeout: 30_000,
  });
});

test("gesto com token inválido cai no card de falha", async ({ page }) => {
  // JWT com claim email de verdade (o decode é display-only) mas assinatura
  // falsa — o card aparece e o setSession é quem rejeita de fato
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwtFalso = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    email: "fantasma@realiza.test",
  })}.assinatura`;
  await page.goto(
    `/auth/link#access_token=${jwtFalso}&refresh_token=refresh-falso`
  );
  await expect(
    page.getByText(/Entrar como .* neste aparelho\?/)
  ).toBeVisible();
  await page.getByRole("button", { name: "Entrar neste aparelho" }).click();
  await expect(page.getByText("Link inválido ou expirado")).toBeVisible({
    timeout: 15_000,
  });
});

// ---------- race falhar × registrar (0181) ----------

test("registrar tardio resgata o tombstone failed", async () => {
  const nonce = novoNonce();
  // a ordem da corrida real: o primeiro publish morreu no transitório, a
  // página marcou falho e a pessoa clicou de novo — tokens têm que ganhar
  await rpcViaServiceRole("falhar_login_handoff", { p_nonce: nonce });
  await rpcViaServiceRole("registrar_login_handoff", {
    p_nonce: nonce,
    p_access: "at-resgatado",
    p_refresh: "rt-resgatado",
  });
  const got = await rpcViaServiceRole<{
    access_token?: string;
    refresh_token?: string;
    failed?: boolean;
  }>("pegar_login_handoff", { p_nonce: nonce });
  expect(got).toEqual({
    access_token: "at-resgatado",
    refresh_token: "rt-resgatado",
  });
});

test("falhar tardio nunca apaga tokens já publicados", async () => {
  const nonce = novoNonce();
  await rpcViaServiceRole("registrar_login_handoff", {
    p_nonce: nonce,
    p_access: "at-bom",
    p_refresh: "rt-bom",
  });
  await rpcViaServiceRole("falhar_login_handoff", { p_nonce: nonce });
  const got = await rpcViaServiceRole<{
    access_token?: string;
    failed?: boolean;
  }>("pegar_login_handoff", { p_nonce: nonce });
  expect(got).toEqual({ access_token: "at-bom", refresh_token: "rt-bom" });
});

test("segundo registrar não sobrescreve tokens bons (where failed)", async () => {
  const nonce = novoNonce();
  // dois cliques no e-mail com links reemitidos — o da vez roubaria a row
  // sem o guard, e a aba que pediu entraria na sessão do clique errado
  await rpcViaServiceRole("registrar_login_handoff", {
    p_nonce: nonce,
    p_access: "at-primeiro",
    p_refresh: "rt-primeiro",
  });
  await rpcViaServiceRole("registrar_login_handoff", {
    p_nonce: nonce,
    p_access: "at-segundo",
    p_refresh: "rt-segundo",
  });
  const got = await rpcViaServiceRole<{
    access_token?: string;
  }>("pegar_login_handoff", { p_nonce: nonce });
  expect(got).toEqual({
    access_token: "at-primeiro",
    refresh_token: "rt-primeiro",
  });
});

// ---------- link sobrevive a reload ----------

test("reload restaura o painel e o poll resgata o handoff publicado", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { access_token, refresh_token } = await tokensDoUsuario(EMAIL, SENHA);
  const nonce = novoNonce();
  await plantarPedidoERecarregar(page, {
    h: nonce,
    email: EMAIL,
    em: Date.now(),
  });
  await expect(page.getByText(PAINEL_ENVIADO)).toBeVisible();
  await expect(page.getByText(EMAIL)).toBeVisible();
  // a aba do e-mail abriu o link: publica os tokens pro nonce — o poll
  // (2.5s) resgata e entra sozinho, como se não houvesse reload
  await rpcViaServiceRole("registrar_login_handoff", {
    p_nonce: nonce,
    p_access: access_token,
    p_refresh: refresh_token,
  });
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
});

test("'Usar outro e-mail' encerra a espera e limpa o pedido", async ({
  page,
}) => {
  await plantarPedidoERecarregar(page, {
    h: novoNonce(),
    email: EMAIL,
    em: Date.now(),
  });
  await expect(page.getByText(PAINEL_ENVIADO)).toBeVisible();
  await page.getByRole("button", { name: "Usar outro e-mail" }).click();
  await expect(
    page.getByRole("button", { name: FORM_PEDIDO })
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("login:pedido"))
  ).toBeNull();
});

// ---------- janela do pedido (70min) ----------

test("pedido fora da janela não restaura — form limpo e storage varrida", async ({
  page,
}) => {
  await plantarPedidoERecarregar(page, {
    h: novoNonce(),
    email: EMAIL,
    // 71min atrás: o link OTP (1h) já morreu com folga — restaurar uma
    // espera morta só esconderia o form
    em: Date.now() - 71 * 60 * 1000,
  });
  await expect(
    page.getByRole("button", { name: FORM_PEDIDO })
  ).toBeVisible();
  // o restore roda num tick pós-mount — dá um respiro antes de afirmar a
  // ausência, senão o check passa antes do efeito rodar
  await page.waitForTimeout(1500);
  await expect(page.getByText(PAINEL_ENVIADO)).not.toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("login:pedido"))
  ).toBeNull();
});

test("pedido que cruza a janela durante a espera morre com aviso", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await plantarPedidoERecarregar(page, {
    h: novoNonce(),
    email: EMAIL,
    // ainda dentro da janela por ~20s (folga pra reload frio de preview):
    // restaura, e o tick do poll seguinte ao deadline encerra a espera
    em: Date.now() - (70 * 60 * 1000 - 20_000),
  });
  await expect(page.getByText(PAINEL_ENVIADO)).toBeVisible();
  await expect(
    page.getByText("O link expirou. Peça um novo pra entrar.")
  ).toBeVisible({ timeout: 40_000 });
});

test("handoff marcado failed vira o card de link inválido aqui", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const nonce = novoNonce();
  await plantarPedidoERecarregar(page, {
    h: nonce,
    email: EMAIL,
    em: Date.now(),
  });
  await expect(page.getByText(PAINEL_ENVIADO)).toBeVisible();
  // a aba do e-mail achou o link queimado e tombou o nonce — o poll recebe
  // {failed} e mostra o card de link inválido (aqui o "pedir novo" faz
  // sentido: é o mesmo navegador que pediu)
  await rpcViaServiceRole("falhar_login_handoff", { p_nonce: nonce });
  await expect(page.getByText("Link inválido ou expirado")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: "Pedir novo link" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("login:pedido"))
  ).toBeNull();
});

test("handoff publicado mas expirado (TTL 10min) mata a espera", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const { access_token, refresh_token } = await tokensDoUsuario(EMAIL, SENHA);
  const nonce = novoNonce();
  await plantarPedidoERecarregar(page, {
    h: nonce,
    email: EMAIL,
    em: Date.now(),
  });
  await expect(page.getByText(PAINEL_ENVIADO)).toBeVisible();
  // a aba dormiu além do TTL: a row já nasce vencida (inserir direto evita
  // a corrida do poll consumir os tokens antes do PATCH envelhecer)
  await inserirViaServiceRole("login_handoffs", {
    nonce,
    access_token,
    refresh_token,
    expires_at: new Date(Date.now() - 1000).toISOString(),
  });
  await expect(
    page.getByText("O link expirou antes de ser aberto. Peça um novo link.")
  ).toBeVisible({ timeout: 20_000 });
  // e o pedido morreu junto — reload não ressuscita a espera
  await page.reload();
  await expect(
    page.getByRole("button", { name: FORM_PEDIDO })
  ).toBeVisible();
});
