// Demo (REALIZA-295) — a seção de PAT não aparece: a demo roda sobre o
// dataset stubado, sem sessão real, e a RLS owner-only derrubaria o
// insert. O gate é server-side (demoRole), então nem o card renderiza.

import { entrarNaDemo, expect, test } from "../helpers";

test("perfil de staff em demo não mostra a seção de token", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/perfil");
  await expect(
    page.getByRole("heading", { name: "Conta" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conectar IA externa" })
  ).not.toBeVisible();
});

test("perfil do jovem em demo não mostra a seção de token", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentorado");
  await page.goto("/jovem/perfil");
  await expect(
    page.getByRole("heading", { name: "Conta" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conectar IA externa" })
  ).not.toBeVisible();
});
