import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-250 — a biblioteca deixa de ser uma lista única e vira seções
// derivadas do `tipo` do material. Depois da 0135/0138 o dataset demo
// espelha o catálogo de prod: 30 linhas, todas acionáveis — 16 roteiros e
// Perguntas Eficazes caem em "Conteúdos e roteiros", os templates do cap. 14
// são documentos nativos (path "doc:<slug>" → /materiais/documento/<slug>,
// sem passar pela rota de arquivo). "Encontro N" segue meta da linha, nunca
// seção. Read-only — seguro em qualquer ambiente.

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
    const conteudos = bib.getByRole("region", {
      name: /Conteúdos e roteiros/,
    });
    const modelos = bib.getByRole("region", {
      name: /Modelos e instrumentos/,
    });
    const links = bib.getByRole("region", { name: /Links/ });
    await expect(guias).toBeVisible();
    await expect(conteudos).toBeVisible();
    await expect(modelos).toBeVisible();
    await expect(links).toBeVisible();
    // encontro é metadado da linha, não seção
    await expect(
      bib.getByRole("region", { name: /Encontro \d+/ })
    ).toHaveCount(0);

    // o catálogo espelha prod: 2 guias, 20 conteúdos (16 roteiros +
    // Perguntas Eficazes + Feedback Construtivo + 2 cronogramas),
    // 6 modelos (Roda da Vida, Definindo Metas, os 3 modelos de mensagem e o
    // checklist de competências; o checklist de autoavaliação saiu —
    // REALIZA-236), 2 links
    await expect(guias.getByRole("listitem")).toHaveCount(2);
    await expect(conteudos.getByRole("listitem")).toHaveCount(20);
    await expect(modelos.getByRole("listitem")).toHaveCount(6);
    await expect(links.getByRole("listitem")).toHaveCount(2);
    await expect(
      conteudos.getByRole("link", { name: /Roteiro Semana 16/ })
    ).toBeVisible();
    await expect(
      conteudos.getByRole("link", { name: /Perguntas Eficazes/ })
    ).toBeVisible();

    // os templates do cap. 14 são documentos nativos — o link abre a
    // página do app, nunca a rota de arquivo (/api/material) nem "em breve"
    const doc = modelos.getByRole("link", {
      name: /Checklist de competências do mentor/,
    });
    await expect(doc).toHaveAttribute(
      "href",
      "/materiais/documento/checklist-competencias"
    );
    await expect(
      modelos.getByRole("link", {
        name: /Mensagem de preparação do mentorado/,
      })
    ).toHaveAttribute("href", "/materiais/documento/mensagem-preparacao");

    // o documento renderiza de verdade — hero do guia + corpo copiável +
    // voltar pra biblioteca; slug desconhecido cai em 404
    await doc.click();
    await expect(page).toHaveURL("/materiais/documento/checklist-competencias");
    await expect(
      page.getByRole("heading", { name: "Checklist de competências do mentor", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/Competência/)).toBeVisible();
    await page
      .getByRole("link", { name: "Biblioteca de materiais" })
      .click();
    await expect(page).toHaveURL(/\/materiais\?aba=biblioteca/);
    await page.goto("/materiais/documento/nao-existe");
    await expect(page.getByText(/não encontrada|not found/i).first()).toBeVisible();
    await page.goto("/materiais?aba=biblioteca");

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
      bib.getByRole("region", { name: /Conteúdos e roteiros/ })
    ).toHaveCount(0);
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
      resumo.getByRole("region", { name: /Conteúdos e roteiros/ })
    ).toBeVisible();
    await expect(
      resumo.getByRole("region", { name: /Modelos e instrumentos/ })
    ).toBeVisible();
    // o Ricardo é híbrido (DPP + especialista) — a seção Guias mostra os
    // dois guias da audiência dele, e só eles
    await expect(guias.getByText("Guia do Mentor DPP")).toBeVisible();
    await expect(guias.getByRole("listitem")).toHaveCount(2);
  });
});
