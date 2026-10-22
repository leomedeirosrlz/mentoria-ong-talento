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

  // a aterrissagem é a aba do papel primário (DPP) com as duas visões. A
  // aba DPP carrega o ?visao= explícito: /agenda pelado recai no default
  // do primário e a aba ficaria inalcançável pro híbrido esp-primário
  const abas = page.getByRole("navigation", { name: "Visão da agenda" });
  const abaDpp = abas.getByRole("link", { name: "Ciclo DPP" });
  const abaEsp = abas.getByRole("link", { name: "Especialista" });
  await expect(abaDpp).toBeVisible();
  await expect(abaEsp).toBeVisible();
  await expect(abaDpp).toHaveAttribute("href", "/agenda?visao=dpp");
  await expect(abaDpp).toHaveAttribute("aria-current", "page");

  // DPP → especialista: a agenda própria (grade semanal editável) — antes,
  // o editor de disponibilidade era inalcançável pro híbrido
  await abaEsp.click();
  await expect(page).toHaveURL(/visao=especialista/);
  await expect(abaEsp).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sua agenda")).toBeVisible();
  await expect(
    page.getByText("Toda semana", { exact: true })
  ).toBeVisible();
  // sem trilha esp ativa ainda: o estado vazio honesto
  await expect(
    page.getByText(/ainda não tem trilhas de especialista/)
  ).toBeVisible();

  // especialista → DPP: a aba explícita devolve o calendário oficial do
  // ciclo — sem o ?visao=dpp o clique pousaria de novo no default
  await abaDpp.click();
  await expect(page).toHaveURL(/\/agenda\?visao=dpp$/);
  await expect(abaDpp).toHaveAttribute("aria-current", "page");
});

test("agenda do híbrido: ?visao= fora do vocabulário vale como ausente", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda?visao=foo");

  // valor inválido cai no default do papel primário — com as abas
  // montadas, não numa visão quebrada nem num redirect
  const abas = page.getByRole("navigation", { name: "Visão da agenda" });
  await expect(
    abas.getByRole("link", { name: "Ciclo DPP" })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    abas.getByRole("link", { name: "Especialista" })
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
