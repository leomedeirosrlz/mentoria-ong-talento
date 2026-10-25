import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-149/150 (WP6b) — a persona mentor_dpp (Ricardo) é HÍBRIDA no
// dataset: role primário DPP + papel efetivo mentor_especialista em
// profile_papeis. O edge case da auditoria: antes do WP6b, todas as
// decisões de superfície liam só o primário e o lado especialista dele
// sumia — sem mural na home e sem editor de horários.
// Público, sem writes: vale em qualquer deploy, produção inclusive.

test("home do híbrido: mural de especialista monta junto com a visão DPP", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/");

  // o mural que só existia pro especialista puro — o híbrido recebe e
  // responde pedidos. Na home nova ele vem recolhido com o contador de
  // abertos no título — abrir mostra os cards (o broadcast da Dandara
  // chega pra ele)
  const mural = page.locator("details#mural-especialista");
  await expect(mural).toBeAttached();
  await expect(
    mural.getByRole("heading", { name: /Pedidos de especialista \(\d+\)/ })
  ).toBeVisible();
  await expect(mural).not.toHaveJSProperty("open", true);
  await mural.locator("summary").click();
  await expect(mural).toHaveJSProperty("open", true);
  await expect(mural.getByText(/Dandara/).first()).toBeVisible();
});

test("agenda do híbrido sem trilha: sem aba Especialista, horários no perfil", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda");

  // REALIZA-207: a aba Especialista só existe com trilha pra mostrar. O
  // Ricardo é especialista sem trilha ativa → a agenda é só a do ciclo DPP
  await expect(
    page.getByRole("navigation", { name: "Visão da agenda" })
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();

  // ?visao=especialista cai mudo na visão DPP (sem banner de erro: ele é
  // especialista, só não tem o que mostrar ali)
  await page.goto("/agenda?visao=especialista");
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();
  await expect(page.getByText(/não se aplica ao seu papel/)).toHaveCount(0);

  // os horários de especialista seguem editáveis: moram no perfil
  await page.goto("/perfil#horarios");
  await expect(
    page.locator("#horarios").getByRole("heading", {
      name: "Quando você pode atender",
    })
  ).toBeVisible();
});

test("agenda do híbrido: ?visao= fora do vocabulário vale como ausente", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda?visao=foo");

  // valor inválido cai no default do papel primário (DPP), não numa visão
  // quebrada nem num redirect
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();
});

test("duplas do híbrido: seção DPP presente (esp aparece quando houver trilha)", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/duplas");

  // Ricardo tem duplas DPP ativas — a visão híbrida renderiza a seção dele
  // por trilha; a seção especialista só entra quando existir dupla dela
  await expect(
    page.getByRole("heading", { name: "Minhas duplas" })
  ).toBeVisible();
});
