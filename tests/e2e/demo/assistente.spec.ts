import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-179 — /assistente em modo demo (sdd §8): transcript enlatado,
// chips com respostas fixas e NENHUM fetch ao provider — honesto, sem
// fingir LLM.

test("demo: chips respondem enlatado sem chamar a API", async ({ page }) => {
  let chamadasApi = 0;
  await page.route("**/api/ia/chat", (route) => {
    chamadasApi++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/assistente");

  await expect(
    page.getByRole("heading", { name: "Assistente" })
  ).toBeVisible();
  await expect(
    page.getByText(/responde com exemplos fixos/)
  ).toBeVisible();

  await page.getByRole("button", { name: "Resumo da semana" }).click();
  await expect(page.getByText(/resumo sai de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);

  // input livre → a resposta fixa de demonstração
  await page
    .getByRole("textbox", { name: "Mensagem pro assistente" })
    .fill("e os relatórios?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText(/respostas de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);
});
