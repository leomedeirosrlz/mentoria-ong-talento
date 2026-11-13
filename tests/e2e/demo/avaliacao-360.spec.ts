import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-71 in demo mode — the pending 360 links are the only ones that
// render the "Sua trajetória" card: Ana's side of d-ok (Ricardo already
// answered his) and Ricardo's link on the still-open d-rito rite. The
// mentor side must show his own 1–4 series plus Gustavo's quantized
// media (3-eval batch releases it), never comments/sentiments/apoio.
// Read-only spec, safe for demo.

const TOK_360_ANA = "demo-tok-360-ana-00000001"; // mentorado, pendente (d-ok)
const TOK_360_RICARDO_RITO = "demo-tok-360-ricardo-rito1"; // mentor, pendente (d-rito)
const TOK_360_ISABELA = "demo-tok-360-isabela-oficia"; // expired
const TOK_RODA_EDUARDO = "demo-tok-roda-eduardo-000001"; // pendente, not a 360
const DUPLA_FIM = "de000000-0000-4000-8000-000000001541"; // Luiza × Isabela

const TRAJETORIA = "Sua trajetória neste ciclo";

test.describe("demo — 360º com contexto da trajetória", () => {
  test("/f/<token> mentor: série dele + média do jovem, sem campos privados", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/f/${TOK_360_RICARDO_RITO}`);

    const card = page.locator("section", { hasText: TRAJETORIA });
    await expect(card).toBeVisible();
    await expect(card.getByText("suas avaliações de encontro")).toBeVisible();
    // d-rito has 16 encontros, all with registros
    await expect(
      card.getByLabel("16 encontros avaliados por você")
    ).toBeVisible();
    // 3 evals [4,3,4] → batch of 3 → mean 3.67 → quantized 3.5
    await expect(
      card.getByText(/média 3,5 de 5/)
    ).toBeVisible();

    // privacy: the visible-to-mentor comentario of eval 3 exists in the
    // dataset but the payload never carries text fields — assert absent
    await expect(
      page.getByText(/curso de elétrica/)
    ).toHaveCount(0);
  });

  test("/f/<token> mentorado: próprias estrelas em barras + resumo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_360_ANA}`);

    const card = page.locator("section", { hasText: TRAJETORIA });
    await expect(card).toBeVisible();
    // d-ok has 4 avaliacoes [5,4,5,4] → mean 4.5, 3× "sim" no avancei
    await expect(
      card.getByLabel("4 encontros avaliados por você")
    ).toBeVisible();
    await expect(
      card.getByText(/você avaliou 4 encontros · média 4,5 · avançou em 3/)
    ).toBeVisible();

    // her comentario must not leak either (own-side context is stars only)
    await expect(
      page.getByText(/destravar o PDM/)
    ).toHaveCount(0);
  });

  test("link expirado cai no estado, sem card", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_360_ISABELA}`);
    await expect(
      page.getByText("Este link expirou")
    ).toBeVisible();
    await expect(page.locator("section", { hasText: TRAJETORIA })).toHaveCount(0);
  });

  test("form pendente fora dos 360º não ganha card", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_RODA_EDUARDO}`);
    await expect(
      page.getByRole("heading", { name: /Roda da Vida/ })
    ).toBeVisible();
    await expect(page.locator("section", { hasText: TRAJETORIA })).toHaveCount(0);
  });

  test("resumo da jornada: tile 'Avaliação do jovem' com série da d-fim", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_FIM}`);

    // 378 — a retrospectiva é o bloco de destaque: faixa de celebração,
    // tira de encontros e a série do jovem em sparkline. O resumo coexiste
    // embaixo, compacto — o relatório completo abre sob disclosure.
    const retro = page.locator('section[aria-label="Retrospectiva da jornada"]');
    await expect(retro).toBeVisible();
    await expect(
      retro.getByRole("img", { name: /Encontros realizados: 1º/ })
    ).toBeVisible();
    await expect(
      retro.getByRole("img", { name: /Estrelas do jovem/ })
    ).toBeVisible();
    await expect(retro.getByText("4.0/5")).toBeVisible();

    const resumo = page.locator('section[aria-label="Resumo da jornada"]');
    await expect(resumo).toBeVisible();
    await resumo
      .getByRole("button", { name: "Ver os dados completos" })
      .click();
    // the mentor tile keeps its own scale — renamed to disambiguate
    await expect(resumo.getByText("Avaliação do mentor")).toBeVisible();
    // 16 evals [3,3,4,3,2,4,4,4,4,5,4,4,5,5,5,5] → mean 4.0, 3★→5★
    const tile = resumo.locator("div", { hasText: "Avaliação do jovem" }).first();
    await expect(tile.getByText("4.0/5")).toBeVisible();
    await expect(tile.getByText("média de 16 avaliações")).toBeVisible();
    await expect(tile.getByText(/1º→último: 3★ → 5★/)).toBeVisible();
    await expect(tile.getByText("Carreira e futuro")).toBeVisible();
  });

  test("checklist do rito: linha de trajetória sob o item da 360", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_FIM}`);

    // d-fim's checklist has avaliacao_360_enviada checked — the line
    // carries the same aggregate the resumo tile shows
    await expect(
      page.getByText(/a jornada avaliada pelo jovem: média 4,0\/5 · 16 avaliações · 1º→último 3★→5★/)
    ).toBeVisible();
  });
});
