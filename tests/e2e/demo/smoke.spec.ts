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
  await page.goto("/agenda?aba=calendario");

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
  // WP3: o default do mentor virou "Minha agenda" — o calendário oficial é
  // a aba explícita ?aba=calendario
  await page.goto("/agenda?aba=calendario");

  // agenda do mentor: semana do encontro + trilha/rail do ciclo
  await expect(
    page.getByText(/Semana do \d+º|Semana dos encontros/).first()
  ).toBeVisible();
});

test("mentorado: card → wizard do 1º acesso → home do /jovem, e volta pra staff", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Mentorado/ }).click();

  // entrarNaDemo cai em "/" e o (app) devolve o mentorado pro shell dele
  await page.waitForURL((url) => url.pathname === "/jovem");

  // primeiro acesso da persona: wizard de 3 passos do jovem (REALIZA-114),
  // não o de staff — boas-vindas → grade semanal → contato
  await expect(
    page.getByRole("heading", { name: /Bem-vindo\(a\) ao Realiza, Bia/i })
  ).toBeVisible();

  // passo da grade: a ficha demo da Bia já traz ter/qui × noite pré-marcada
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Quando dá pra você?" })
  ).toBeVisible();
  // a grade agora é a matriz dia×período (REALIZA-163) — ter/qui × noite
  // da ficha demo viram as duas células ligadas
  await expect(
    page.getByRole("grid", { name: "Dias e períodos livres na semana" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Alternar Domingo inteiro" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Terça de noite" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Quinta de noite" })
  ).toHaveAttribute("aria-pressed", "true");

  // "Preencher depois" é a saída honesta — na demo a grade já veio pronta,
  // então seguimos por ela pra conferir o passo de contato
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu contato tá certo?" })
  ).toBeVisible();
  await expect(
    page.getByText(/Compartilhar meu WhatsApp com os colegas/)
  ).toBeVisible();

  // "Entrar" grava o cookie demo_onboarded_mentorado
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

test("stub demo: tabelas da rodada têm dataset (sem aviso no console)", async ({
  page,
}) => {
  // Quando uma superfície consulta uma tabela sem caso em linhas(), o stub
  // devolve [] e avisa `[demo] tabela "X" consultada sem dataset` UMA vez.
  // As tabelas das telas finais já têm dataset — este teste é o guardrail:
  // quando /chamados (ou a superfície de papeis/devolutivas) entrar, uma
  // regressão do caso em linhas() falha aqui em vez de renderizar vazio.
  const avisos: string[] = [];
  page.on("console", (msg) => {
    if (
      msg.type() === "warning" &&
      /\[demo\] tabela "(chamados|chamado_comentarios|chamado_atualizacoes|devolutivas|profile_papeis)"/.test(
        msg.text()
      )
    )
      avisos.push(msg.text());
  });
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");
  await page.goto("/agenda");
  // WP3: o calendário continua sendo a superfície pesada da agenda — a
  // visita à aba explícita mantém a cobertura de console-error nela
  await page.goto("/agenda?aba=calendario");
  expect(avisos).toEqual([]);
});
