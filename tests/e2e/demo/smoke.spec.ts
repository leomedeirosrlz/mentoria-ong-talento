import { entrarNaDemo, expect, pularOnboarding, test } from "../helpers";

// Superfície demo — pública, sem login, writes stubados. Vale como smoke de
// qualquer deploy (preview e produção) E como regressão das features que a
// demo espelha (ex.: modelo de eventos 0062 — etapas, semana dupla).

test("seleção de papel → onboarding → app", async ({ page }) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: /plataforma do Programa de Mentoria/i })
  ).toBeVisible();

  // um card por papel — o botão leva papel + persona
  await page.getByRole("button", { name: /Coordenação/ }).click();
  await pularOnboarding(page);
  await page.waitForURL((url) => url.pathname === "/");

  // DemoBar é a prova de que o cookie demo pegou
  await expect(page.getByText(/Demo · Coordenação/).first()).toBeVisible();
});

test("agenda: painel de etapas de preparação + semana do encontro", async ({
  page,
}) => {
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/agenda");

  // a semana corrente tem encontro oficial — rótulo "Semana do Nº encontro"
  // ou, em semana dupla, "Semana dos encontros N e M"
  await expect(
    page.getByText(/Semana do \d+º|Semana dos encontros/).first()
  ).toBeVisible();

  // painel colapsável do modelo 0062 — única superfície das etapas sem data
  const painel = page.locator("details", {
    hasText: "Etapas de preparação",
  });
  await expect(painel.getByText(/\d+ de \d+ concluídas/)).toBeVisible();
  await painel.locator("summary").click();
  await expect(painel.getByText("Triagem e matching")).toBeVisible();
  await expect(painel.getByText("Concluída").first()).toBeVisible();
});

test("mentor DPP: entra na demo e vê a jornada", async ({ page }) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda");

  // agenda do mentor: semana do encontro + trilha/rail do ciclo
  await expect(
    page.getByText(/Semana do \d+º|Semana dos encontros/).first()
  ).toBeVisible();
});

test("mentorado: card → boas-vindas → home do /jovem, e volta pra staff", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Mentorado/ }).click();

  // entrarNaDemo cai em "/" e o (app) devolve o mentorado pro shell dele
  await page.waitForURL((url) => url.pathname === "/jovem");

  // primeiro acesso da persona: boas-vindas de tela única (não o wizard de
  // staff) — "Entrar" grava o cookie demo_onboarded_mentorado
  await expect(
    page.getByRole("heading", { name: /Bem-vindo, Bia/i })
  ).toBeVisible();
  await page.getByRole("button", { name: "Entrar" }).click();

  // home da jovem: saudação com o nome social + as seções dela
  await expect(page.getByRole("heading", { name: /Olá, Bia/ })).toBeVisible();
  await expect(
    page.locator('section[aria-labelledby="dupla-titulo"]')
  ).toContainText("Minha mentoria");
  const combinados = page.locator(
    'section[aria-labelledby="combinados-titulo"]'
  );
  await expect(
    combinados.getByText("Resolver os 10 exercícios de fração da lista")
  ).toBeVisible();

  // o checkbox é sr-only — o clique honesto é no label; em demo o write
  // devolve o aviso em vez de mutar (a marca não muda de verdade)
  const pendente = combinados.locator("label", {
    hasText: "Resolver os 10 exercícios",
  });
  await pendente.click();
  await expect(
    page.getByText("Modo demonstração. Nada é gravado de verdade.")
  ).toBeVisible();
  await expect(
    combinados.getByRole("checkbox").first()
  ).not.toBeChecked();

  // a DemoBar segue no shell da jovem — trocar de papel volta pra staff
  const demoTrigger = page.getByRole("button", {
    name: "Controles da demonstração",
  });
  await expect(demoTrigger).toBeVisible();
  await expect(demoTrigger).toContainText("Mentorado");
  await demoTrigger.click();
  await page.getByRole("button", { name: /Coordenação/ }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(
    page.getByRole("button", { name: "Controles da demonstração" })
  ).toContainText("Coordenação");
});
