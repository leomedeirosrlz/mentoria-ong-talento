import { entrarNaDemo, expect, test } from "../helpers";

// WP6 — /jovem/especialistas: catálogo rico + sugestão do mentor + trilhas
// (stepper do guia + feed de devolutivas). A persona mentorado (Bia) tem os
// três cenários no dataset: sugestão pendente do Ricardo, trilha concluída
// com a Helena (devolutivas datadas) e o catálogo de especialistas.

test("mentorado vê catálogo, sugestão pendente e trilha com devolutivas", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentorado");
  await page.goto("/jovem/especialistas");

  // catálogo rico — especialista com bio/áreas/vagas
  await expect(
    page.getByRole("heading", { name: /Especialistas/i }).first()
  ).toBeVisible();

  // sugestão do mentor DPP esperando resposta — ações confirmar/dispensar
  await expect(page.getByText(/sugeriu|sugestão/i).first()).toBeVisible();

  // a trilha da Bia com a Helena: stepper do guia + feed datado
  await expect(page.getByText("Helena").first()).toBeVisible();
});

test("nav do jovem tem o item Especialistas", async ({ page }) => {
  await entrarNaDemo(page, "mentorado");
  await page.goto("/jovem");
  await expect(
    page.getByRole("link", { name: /Especialistas/i }).first()
  ).toBeVisible();
});
