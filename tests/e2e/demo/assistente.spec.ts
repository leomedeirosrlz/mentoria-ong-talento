import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-243 — a bolha em modo demo (sdd §8): transcript enlatado, chips
// com respostas fixas e NENHUM fetch à API — honesto, sem fingir LLM.

test("demo: bolha abre e chips respondem enlatado sem chamar a API", async ({
  page,
}) => {
  let chamadasApi = 0;
  await page.route("**/api/ia/chat", (route) => {
    chamadasApi++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  // entrarNaDemo só planta os cookies no /demo (wizard, sem shell) — a
  // bolha mora no AppShell, então precisa de uma tela do app
  await page.goto("/");

  // seletor estável entre os rótulos Abrir/Fechar (o nome muda no clique)
  const fab = page.locator('[aria-controls="painel-assistente"]');
  // REALIZA-382: na demo a bolha sempre aparece (vitrine do assistente),
  // IA_BOLHA ou não — sem flag nem sessão ela responde com dados de exemplo
  await expect(fab).toBeVisible();
  await fab.click();

  const painel = page.locator("#painel-assistente");
  await expect(painel).toBeVisible();
  await expect(painel.getByText(/responde com dados de exemplo/)).toBeVisible();

  await painel.getByRole("button", { name: "Resumo da semana" }).click();
  await expect(painel.getByText(/números são de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);

  // input livre → a resposta fixa de demonstração
  await painel
    .getByRole("textbox", { name: "Mensagem pra Liza" })
    .fill("e os relatórios?");
  await painel.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(painel.getByText(/respostas de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);
});

test("demo: aba de ajustes abre com config de exemplo e nada persiste", async ({
  page,
}) => {
  // REALIZA-382: o gear da bolha é coord-only — na demo abre o painel com
  // dataset local (modelos/tier/esforço/health prontos), sem Supabase e
  // sem o probe de /api/ia/modelos
  let chamadasModelos = 0;
  await page.route("**/api/ia/modelos**", (route) => {
    chamadasModelos++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");

  const fab = page.locator('[aria-controls="painel-assistente"]');
  await expect(fab).toBeVisible();
  await fab.click();
  const painel = page.locator("#painel-assistente");

  await painel
    .getByRole("button", { name: "Ajustes do assistente" })
    .click();

  await expect(
    painel.getByText(/ajustes são de exemplo e nada é gravado/)
  ).toBeVisible();
  // selects dos três tiers abrem com os slugs do dataset demo
  await expect(painel.getByLabel("Modelo Rápido")).toContainText(
    "glm-5.3-flash"
  );
  await expect(painel.getByLabel("Modelo Balanceado")).toContainText(
    "deepseek-v4.1-flash"
  );
  await expect(painel.getByLabel("Modelo Forte")).toContainText(
    "deepseek-v4-pro"
  );
  // o interruptor do roteador responde localmente (estado muda, nada grava)
  const roteamento = painel.getByLabel("Roteamento automático");
  await expect(roteamento).toBeChecked();
  await roteamento.click();
  await expect(roteamento).not.toBeChecked();
  expect(chamadasModelos).toBe(0);
});
