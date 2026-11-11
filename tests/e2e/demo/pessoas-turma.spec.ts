import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-39 in demo mode — /pessoas groups by turma by default for the
// coord, derived from duplas.turma + turma_inscricoes + escopo_turma. The
// dataset has multi-turma people (Ricardo: T1 + T2 + 2025/2026), a
// "Sem turma" bucket and every operational status. Read-only spec.

test.describe("demo — /pessoas por turma", () => {
  test("padrão é turma: grupos por ciclo, 'Sem turma' por último", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    await expect(
      page.getByRole("button", { name: "Por turma" })
    ).toHaveAttribute("aria-pressed", "true");

    const headings = page.locator("h2", {
      has: page.locator("span.font-normal"),
    });
    const texts = await headings.allTextContents();
    const turmas = texts.filter((t) => /\(\d+\)$/.test(t.trim()));
    // turmas mais novas primeiro; 2025/2026 é o ciclo histórico
    expect(turmas[0]).toContain("Turma 2 · 2026/2027");
    expect(turmas[1]).toContain("Turma 1 · 2026/2027");
    expect(turmas[2]).toContain("2025/2026");
    expect(turmas[turmas.length - 1]).toContain("Sem turma");
  });

  test("pessoa em várias turmas aparece em todas", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    // Ricardo mentora na T1 (d-ok), tem inscrição/papel na T2 e duplas
    // históricas no 2025/2026 — uma linha em cada grupo
    const sec = (nome: string) =>
      page.locator("section", {
        has: page.locator("h2", { hasText: nome }),
      });
    await expect(
      sec("Turma 2 · 2026/2027").getByText("Ricardo Tavares").first()
    ).toBeVisible();
    await expect(
      sec("Turma 1 · 2026/2027").getByText("Ricardo Tavares").first()
    ).toBeVisible();
    await expect(
      sec("2025/2026").getByText("Ricardo Tavares").first()
    ).toBeVisible();
  });

  test("status operacionais visíveis nas linhas", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");
    for (const s of [
      "convidado",
      "não acessou",
      "termo pendente",
      "documentos pendentes",
      "ativo",
      "inativo",
    ]) {
      await expect(
        page.getByText(s, { exact: true }).first()
      ).toBeVisible();
    }
  });

  test("?agrupar=papel restaura a leitura global e persiste na URL", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    await page.getByRole("button", { name: "Por papel" }).click();
    await expect(page).toHaveURL(/agrupar=papel/);
    await expect(
      page.getByRole("button", { name: "Por papel" })
    ).toHaveAttribute("aria-pressed", "true");
    // grupos globais por papel, sem seções de turma
    await expect(
      page.getByRole("heading", { name: /Coordenação e equipe/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Mentores/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Sem turma/ })
    ).toHaveCount(0);
  });

  test("fora da coordenação: sem toggle de agrupamento nem gestão em lote", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/pessoas");

    await expect(
      page.getByRole("button", { name: "Por turma" })
    ).toHaveCount(0);
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    // nem status operacional — os badges de gestão são coord-only
    await expect(page.getByText("não acessou", { exact: true })).toHaveCount(0);
  });
});
