import {
  appEnvOk,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-179 fase 1 (chat interno): a página /assistente entra no shell de
// todos os papéis staff. Sem IA_API_* no ambiente de e2e a feature se
// apresenta honesta: header + card de indisponível, composer escondido —
// é o comportamento de rollback documentado no plan.
//
// A API coberta por sessão: POST sem login não chega na rota — o proxy
// desvia pra /login (a rota não entra na lista pública; a auth é o cookie).

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

test.describe("assistente", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test("nav mostra Assistente pra staff e a página abre honesta", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await expect(
      page.getByRole("link", { name: "Assistente" }).first()
    ).toBeVisible();
    await page.goto("/assistente");
    await expect(
      page.getByRole("heading", { name: "Assistente" })
    ).toBeVisible();
    await expect(page.getByText(/Sou o assistente do Realiza/)).toBeVisible();
    // provider fora do ambiente de e2e → card de indisponível no lugar do
    // composer (feature flag honesta — nada de composer morto)
    await expect(
      page.getByText(/assistente está indisponível/i)
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Mensagem pro assistente" })
    ).not.toBeVisible();
  });

  test("POST /api/ia/chat sem sessão é desviado pro login", async ({
    request,
  }) => {
    // request fixture = contexto novo, sem cookies — mede o comportamento
    // de quem bate na API de fora. O proxy responde 307 → /login (a auth da
    // rota é a sessão; sem ela nem a rota roda)
    const res = await request.post("/api/ia/chat", {
      data: { messages: [{ role: "user", content: "oi" }] },
      maxRedirects: 0,
    });
    expect([307, 401]).toContain(res.status());
  });

  test("POST /api/ia/chat logado sem provider devolve 503 amigável", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    const res = await page.request.post("/api/ia/chat", {
      data: { messages: [{ role: "user", content: "oi" }] },
    });
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/indisponível/i);
  });
});
