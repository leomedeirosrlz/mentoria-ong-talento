import {
  appEnvOk,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-243/244 — o assistente saiu da nav e virou bolha flutuante
// (FAB bottom-right → drop-up). A rota /assistente virou redirect pra /.
// Sem IA_API_* no ambiente de e2e a feature se apresenta honesta: card de
// indisponível no painel, composer escondido — comportamento de rollback.
//
// A API coberta por sessão: POST sem login não chega na rota — o proxy
// desvia pra /login. As respostas de gate (503/429/400) seguem JSON —
// o stream SSE só abre depois que tudo passa.

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

test.describe("assistente", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test("staff vê a bolha, abre o painel e fecha com Escape", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);

    // fora do nav — nenhum link "Assistente" na sidebar
    await expect(
      page.getByRole("link", { name: "Assistente" })
    ).not.toBeVisible();

    const fab = page.locator('[aria-controls="painel-assistente"]');
    // bolha desligada por padrão (IA_BOLHA != 1) enquanto a rodada de UI não
    // fecha — o CI liga a flag pra exercitar a feature
    if ((await fab.count()) === 0) {
      test.skip(true, "bolha desligada (IA_BOLHA != 1)");
    }
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute("aria-expanded", "false");
    await fab.click();
    await expect(fab).toHaveAttribute("aria-expanded", "true");

    // painel: header + saudação. O composer depende do provider: o e2e
    // local roda sem IA_API_* (card "indisponível" honesto); o preview da
    // Vercel tem as envs e mostra o composer de verdade.
    const painel = page.locator("#painel-assistente");
    await expect(painel).toBeVisible();
    await expect(painel.getByText(/Oi/)).toBeVisible();
    const composer = page.getByRole("textbox", {
      name: "Mensagem pro assistente",
    });
    if (await composer.count()) {
      await expect(composer).toBeVisible();
    } else {
      await expect(
        painel.getByText(/assistente está indisponível/i)
      ).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(painel).not.toBeVisible();
    await expect(fab).toHaveAttribute("aria-expanded", "false");
  });

  test("/assistente redireciona pro início", async ({ page }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/assistente");
    await expect(page).toHaveURL(/\/$/);
  });

  test("POST /api/ia/chat sem sessão é desviado pro login", async ({
    request,
  }) => {
    // request fixture = contexto novo, sem cookies — o proxy responde
    // 307 → /login (a auth da rota é a sessão; sem ela nem a rota roda)
    const res = await request.post("/api/ia/chat", {
      data: { messages: [{ role: "user", content: "oi" }] },
      maxRedirects: 0,
    });
    expect([307, 401]).toContain(res.status());
  });

  test("POST /api/ia/chat logado responde honesto sobre o provider", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    const res = await page.request.post("/api/ia/chat", {
      data: { messages: [{ role: "user", content: "oi" }] },
      // o request só resolve com o stream fechado — geração real pode
      // passar dos 30s padrão do APIRequestContext
      timeout: 90_000,
    });
    // sem IA_API_* (e2e local): 503 JSON amigável. Com provider real
    // (preview Vercel): 200 abrindo o stream SSE.
    if (res.status() === 200) {
      expect(res.headers()["content-type"]).toMatch(/text\/event-stream/i);
      return;
    }
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/indisponível/i);
  });
});
