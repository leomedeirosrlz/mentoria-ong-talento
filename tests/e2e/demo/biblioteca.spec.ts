import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-250 — a biblioteca deixa de ser uma lista única e vira seções
// derivadas do `tipo` do material. O dataset demo tem guia, template e
// link — "Conteúdos e roteiros" fica vazia e NÃO renderiza (seção sem
// resultado some, mesma regra de silêncio da 240). "Encontro N" segue
// meta da linha, nunca seção. Read-only — seguro em qualquer ambiente.

test.describe("demo — biblioteca por categoria (REALIZA-250)", () => {
  test("coordenação: seções nomeadas, vazia some e busca filtra dentro", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais?aba=biblioteca");

    const bib = page.getByRole("region", { name: /Todos os materiais/ });
    await expect(bib).toBeVisible();

    // cada categoria é um landmark nomeado (section + aria-labelledby no
    // heading da seção) — o leitor de tela anuncia a categoria ao navegar
    // entre grupos; o nome carrega a contagem ("Guias 2")
    const guias = bib.getByRole("region", { name: /Guias/ });
    const modelos = bib.getByRole("region", {
      name: /Modelos e instrumentos/,
    });
    const links = bib.getByRole("region", { name: /Links/ });
    await expect(guias).toBeVisible();
    await expect(modelos).toBeVisible();
    await expect(links).toBeVisible();
    // o demo não tem material do tipo "conteudo" — a seção não existe
    await expect(
      bib.getByRole("region", { name: /Conteúdos e roteiros/ })
    ).toHaveCount(0);
    // encontro é metadado da linha, não seção
    await expect(
      bib.getByRole("region", { name: /Encontro \d+/ })
    ).toHaveCount(0);

    // cada item cai em exatamente uma categoria: a soma das seções é o
    // total do acervo do papel
    const n =
      (await guias.getByRole("listitem").count()) +
      (await modelos.getByRole("listitem").count()) +
      (await links.getByRole("listitem").count());
    expect(n).toBeGreaterThanOrEqual(11);

    // ordem dentro da seção: encontro crescente primeiro (Encontro 1
    // antes do 2 e do 12) — o resto do critério é ordem→título
    const metas = await modelos
      .getByText(/Encontro \d+/)
      .allTextContents();
    const ordens = metas.map((t) =>
      Number(t.match(/Encontro (\d+)/)?.[1] ?? 0)
    );
    expect([...ordens].sort((a, b) => a - b)).toEqual(ordens);

    // a busca é global e filtra DENTRO das seções — a que zera some
    await page
      .getByRole("searchbox", { name: "Buscar material" })
      .fill("Guia do Mentor");
    await expect(guias).toBeVisible();
    await expect(guias.getByRole("listitem")).toHaveCount(2);
    await expect(
      bib.getByRole("region", { name: /Modelos e instrumentos/ })
    ).toHaveCount(0);
    await expect(
      bib.getByRole("region", { name: /Links/ })
    ).toHaveCount(0);

    // busca sem resultado: nenhuma seção, empty state no lugar
    await page
      .getByRole("searchbox", { name: "Buscar material" })
      .fill("zzz impossível");
    await expect(bib.getByRole("heading", { level: 3 })).toHaveCount(0);
    await expect(page.getByText(/Nenhum material com/)).toBeVisible();
  });

  test("mentor: card da semana em cima e a mesma biblioteca agrupada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/materiais");

    // o card do encontro vigente segue no topo; as categorias vêm abaixo
    const resumo = page.getByRole("region", { name: "Resumo da biblioteca" });
    await expect(resumo).toBeVisible();
    const guias = resumo.getByRole("region", { name: /Guias/ });
    await expect(guias).toBeVisible();
    await expect(
      resumo.getByRole("region", { name: /Modelos e instrumentos/ })
    ).toBeVisible();
    // o Ricardo é híbrido (DPP + especialista) — a seção Guias mostra os
    // dois guias da audiência dele, e só eles
    await expect(guias.getByText("Guia do Mentor DPP")).toBeVisible();
    await expect(guias.getByRole("listitem")).toHaveCount(2);
  });
});
