// Emissão self-service de PAT por papel (REALIZA-295) — o TokensMcp
// montado em /perfil (staff) e /jovem/perfil (mentorado) minta o próprio
// token pela UI e revoga na lista; na bolha da coord a seção segue onde
// nasceu. O token mintado pelo spec é revogado mas a linha fica em
// ia_mcp_tokens — o afterEach limpa pelo rótulo único (e o sweep do seed
// varre qualquer sobra de run morto).

import {
  appEnvOk,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

const ROTULO = "e2e-spec-mcp";

const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? SENHA;

test.describe("tokens MCP (emissão self-service)", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test.afterEach(async () => {
    // a linha revogada fica como auditoria no banco — apaga pra não
    // acumular credencial de teste no staging
    await limparViaServiceRole("ia_mcp_tokens", `rotulo=eq.${ROTULO}`);
  });

  test("mentor emite e revoga o próprio PAT em /perfil", async ({ page }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto("/perfil");

    const secao = page.locator("section", {
      has: page.getByRole("heading", { name: "Conectar IA externa" }),
    });
    await expect(secao).toBeVisible();
    // endpoint + prompt de conexão no lugar (o miolo compartilhado)
    await expect(secao.getByText(/POST .*\/api\/mcp/)).toBeVisible();

    await secao.getByLabel("Rótulo").fill(ROTULO);
    await secao.getByRole("button", { name: "Gerar token" }).click();

    // cru exibido uma vez — o formato é o da UI (rlz_mcp_ + 48 hex)
    await expect(secao.getByText(/rlz_mcp_[0-9a-f]{48}/)).toBeVisible();
    // a linha nova entra na lista antes do gesto de revogar
    await expect(secao.getByText(ROTULO)).toBeVisible();
    await secao
      .getByRole("button", { name: `Revogar ${ROTULO}` })
      .click();
    await expect(secao.getByText(ROTULO)).not.toBeVisible();
  });

  test("jovem emite e revoga o próprio PAT em /jovem/perfil", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/perfil");

    const secao = page.locator("section", {
      has: page.getByRole("heading", { name: "Conectar IA externa" }),
    });
    await expect(secao).toBeVisible();

    await secao.getByLabel("Nome do token").fill(ROTULO);
    await secao.getByRole("button", { name: "Gerar token" }).click();

    await expect(secao.getByText(/rlz_mcp_[0-9a-f]{48}/)).toBeVisible();
    await expect(secao.getByText(ROTULO)).toBeVisible();
    await secao
      .getByRole("button", { name: `Revogar ${ROTULO}` })
      .click();
    await expect(secao.getByText(ROTULO)).not.toBeVisible();
  });

  test("coord segue com a seção de tokens na bolha de ajustes", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);

    const fab = page.locator('[aria-controls="painel-assistente"]');
    if ((await fab.count()) === 0) {
      // mesma saída do spec do assistente: bolha é flag (IA_BOLHA)
      test.skip(true, "bolha desligada (IA_BOLHA != 1)");
    }
    await fab.click();
    await page
      .getByRole("button", { name: "Ajustes do assistente" })
      .click();

    await expect(page.getByText("IA externa (MCP)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gerar novo token" })
    ).toBeVisible();
  });
});
