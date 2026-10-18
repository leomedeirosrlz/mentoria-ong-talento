import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-149/150 (WP6b) — a persona mentor_dpp (Ricardo) é HÍBRIDA no
// dataset: role primário DPP + papel efetivo mentor_especialista em
// profile_papeis. O edge case da auditoria: antes do WP6b, todas as
// decisões de superfície liam só o primário e o lado especialista dele
// sumia — sem mural na home, sem aba de agenda, sem grade editável.
// Público, sem writes: vale em qualquer deploy, produção inclusive.

test("home do híbrido: mural de especialista monta junto com a visão DPP", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/");

  // o mural que só existia pro especialista puro — o híbrido recebe e
  // responde pedidos (a pedido broadcast da Dandara é visível pra ele)
  await expect(
    page.getByRole("heading", { name: "Pedidos de especialista" })
  ).toBeVisible();
  await expect(page.getByText(/Dandara/).first()).toBeVisible();
});

test("agenda do híbrido: duas abas — Ciclo DPP + Especialista com grade editável", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda");

  // a aterrissagem é a aba do papel primário (DPP) com as duas visões
  const abas = page.getByRole("navigation", { name: "Visão da agenda" });
  await expect(abas.getByRole("link", { name: "Ciclo DPP" })).toBeVisible();
  await expect(
    abas.getByRole("link", { name: "Especialista" })
  ).toBeVisible();

  // a aba especialista mostra a agenda própria (grade semanal editável) —
  // antes, o editor de disponibilidade era inalcançável pro híbrido
  await abas.getByRole("link", { name: "Especialista" }).click();
  await expect(page).toHaveURL(/visao=especialista/);
  await expect(page.getByText("Sua agenda")).toBeVisible();
  await expect(
    page.getByText("Toda semana", { exact: true })
  ).toBeVisible();
  // sem trilha esp ativa ainda: o estado vazio honesto
  await expect(
    page.getByText(/ainda não tem trilhas de especialista/)
  ).toBeVisible();
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
