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

  // a bolha mora no shell — qualquer tela serve
  const fab = page.getByRole("button", { name: "Abrir assistente" });
  await expect(fab).toBeVisible();
  await fab.click();

  const painel = page.locator("#painel-assistente");
  await expect(painel).toBeVisible();
  await expect(painel.getByText(/responde com exemplos fixos/)).toBeVisible();

  await painel.getByRole("button", { name: "Resumo da semana" }).click();
  await expect(painel.getByText(/resumo sai de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);

  // input livre → a resposta fixa de demonstração
  await painel
    .getByRole("textbox", { name: "Mensagem pro assistente" })
    .fill("e os relatórios?");
  await painel.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(painel.getByText(/respostas de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);
});
