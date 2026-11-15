import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-413 — indicador de leitura nos materiais: check discreto na linha
// do card da semana e selo "lido" na meta da biblioteca. A marca é
// automática na abertura (a página do doc grava na montagem; o clique cobre
// arquivo e link externo) e persiste na sessão demo via cookie. O estado
// mora no cookie da sessão — read-only no dataset, seguro em qualquer
// ambiente.

test.describe("demo — leitura de materiais (REALIZA-413)", () => {
  test("mentor: lidos marcados, abrir marca e o reload mantém", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/materiais?aba=biblioteca");

    // baseline narrativo da persona: guia do mentor + roteiros dos encontros
    // já realizados (1–4) chegam marcados; o da semana corrente (5º) não
    const bib = page.getByRole("region", { name: /Resumo da biblioteca/ });
    await expect(
      bib.getByRole("link", { name: /Guia do Mentor DPP/ })
    ).toHaveAccessibleName(/lido/i);
    await expect(
      bib.getByRole("link", { name: /Roteiro Semana 4/ })
    ).toHaveAccessibleName(/lido/i);
    await expect(
      bib.getByRole("link", { name: /Roteiro Semana 6/ })
    ).not.toHaveAccessibleName(/lido/i);

    // card da semana: o roteiro do encontro vigente segue por ler
    const semana = page
      .getByRole("region", { name: /Encontro desta semana/ })
      .first();
    await expect(semana).toBeVisible();
    const roteiro = semana.getByRole("link", { name: /Roteiro/ }).first();
    await expect(roteiro).toBeVisible();
    await expect(roteiro).not.toHaveAccessibleName(/lido/i);

    // abrir marca — a página do doc grava a leitura na montagem
    await roteiro.click();
    await expect(page).toHaveURL(/\/materiais\/documento\//);

    // de volta, a linha do card mostra o já-lido — e segue depois do reload
    // (a marca mora no cookie da sessão demo)
    await page.goto("/materiais?aba=biblioteca");
    await expect(roteiro).toHaveAccessibleName(/lido/i);
    await page.reload();
    await expect(roteiro).toHaveAccessibleName(/lido/i);
  });
});
