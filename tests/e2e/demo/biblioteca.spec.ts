import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-250 — a biblioteca deixa de ser uma lista única e vira seções
// derivadas do `tipo` do material. Depois da 0135/0138 e da 0194 o dataset
// demo espelha o catálogo de prod: 30 linhas, todas acionáveis — 16 roteiros
// e Perguntas Eficazes caem em "Conteúdos e roteiros", e TODO material com
// arquivo é documento nativo (path "doc:<slug>" → /materiais/documento/<slug>,
// sem passar pela rota de arquivo — guias, cronogramas e templates do cap. 14
// inclusos). "Encontro N" segue meta da linha, nunca seção. Read-only —
// seguro em qualquer ambiente.

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
      name: /^Modelos/,
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

    // REALIZA-380 — os guias e os cronogramas também são nativos: a linha
    // abre o documento do app, nunca a rota de arquivo nem PDF de storage
    await expect(
      guias.getByRole("link", { name: /Guia do Mentor DPP/ })
    ).toHaveAttribute("href", "/materiais/documento/guia-mentor-dpp");
    await expect(
      guias.getByRole("link", { name: /Guia do Mentor Especialista/ })
    ).toHaveAttribute("href", "/materiais/documento/guia-mentor-especialista");
    await expect(
      conteudos.getByRole("link", { name: /Perguntas Eficazes/ })
    ).toHaveAttribute("href", "/materiais/documento/perguntas-eficazes");
    await expect(
      conteudos.getByRole("link", { name: /Cronograma do programa — Turma 1/ })
    ).toHaveAttribute("href", "/materiais/documento/ciclo-cronograma");

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
    // a tabela de competências aparece mais de uma vez no documento
    await expect(
      page.getByRole("columnheader", { name: "Competência" }).first()
    ).toBeVisible();
    await page
      .locator("#conteudo")
      .getByRole("link", { name: "Materiais de apoio" })
      .click();
    await expect(page).toHaveURL(/\/materiais\?aba=biblioteca/);
    // o guia nativo renderiza no padrão dos demais docs de corpus: hero
    // com o título oficial e os cards de encontro do capítulo "Os 16
    // encontros" (REALIZA-380)
    await page.goto("/materiais/documento/guia-mentor-dpp");
    await expect(
      page.getByRole("heading", {
        name: "Guia do Mentor de Desenvolvimento Pessoal e Profissional",
        level: 1,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Os 16 encontros/ })
    ).toBeVisible();

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
      .getByRole("searchbox", { name: "Buscar material de apoio" })
      .fill("Guia do Mentor");
    await expect(guias).toBeVisible();
    await expect(guias.getByRole("listitem")).toHaveCount(2);
    await expect(
      bib.getByRole("region", { name: /Conteúdos e roteiros/ })
    ).toHaveCount(0);
    await expect(
      bib.getByRole("region", { name: /^Modelos/ })
    ).toHaveCount(0);
    await expect(
      bib.getByRole("region", { name: /Links/ })
    ).toHaveCount(0);

    // busca sem resultado: nenhuma seção, empty state no lugar
    await page
      .getByRole("searchbox", { name: "Buscar material de apoio" })
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
      resumo.getByRole("region", { name: /^Modelos/ })
    ).toBeVisible();
    // o Ricardo é híbrido (DPP + especialista) — a seção Guias mostra os
    // dois guias da audiência dele, e só eles
    await expect(guias.getByText("Guia do Mentor DPP")).toBeVisible();
    await expect(guias.getByRole("listitem")).toHaveCount(2);
  });
});
