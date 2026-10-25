import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// /registros agrupado por ?grupo=dupla|semana|avaliacao (REALIZA-175).
// Demo como coordenação vê todas as 16 duplas — ~94 registros com
// avaliações variadas (baixa/regular/boa/excelente no dataset).
// O default é `grupo=dupla` implícito (param ausente == dupla).
// Layout: lista compacta + registro (seleção em ?r=) — no lg+ o registro
// fica à direita; no celular abre numa folha (REALIZA-211).

// o cabeçalho de grupo usa o lockup DuplaNomes:
// "Mentor e Mentorado · K registros", sem o prefixo "Dupla:"
const DUPLA_HEAD_LG = /^.+ e .+ · \d+ registros?$/;
const SEMANA_HEAD = /^Semana de \d{2}\/\d{2}\//;
const AVAL_HEAD =
  /^(Avaliação: (Baixa|Regular|Boa|Excelente)|Sem avaliação) · \d+ registros?$/;

async function abreRegistros(page: Page, qs = "") {
  await entrarNaDemo(page, "coordenacao");
  await page.goto(`/registros${qs}`);
  // a lista só é o que interessa — espera o h1 ancora o SSR (exact: os
  // headers de grupo terminam em "· N registros" e casariam substring)
  await expect(
    page.getByRole("heading", { name: "Registros", exact: true })
  ).toBeVisible();
}

test("default: agrupa por dupla em mestre/detalhe no lg", async ({
  page,
}) => {
  await abreRegistros(page);

  // switcher presente com a opção ativa correta
  const switcher = page.getByRole("group", { name: "Agrupar registros" });
  await expect(switcher).toBeVisible();
  await expect(
    switcher.getByRole("link", { name: "por dupla" })
  ).toHaveAttribute("aria-current", "page");

  // headers de dupla no formato "Mentor e Mentorado · K registros"
  const headers = page.getByRole("heading", { name: DUPLA_HEAD_LG });
  expect(await headers.count()).toBeGreaterThanOrEqual(3);

  // lg (1280 default): a lista fica à esquerda e o registro aberto à
  // direita — mesma linha de topo, colunas distintas
  const detalhe = page.getByRole("article", {
    name: /\d+º (encontro|passo)/,
  });
  await expect(detalhe).toBeVisible();
  const bh = await headers.first().boundingBox();
  const bd = await detalhe.boundingBox();
  expect(bh).not.toBeNull();
  expect(bd).not.toBeNull();
  expect(Math.abs(bh!.y - bd!.y)).toBeLessThan(16);
  expect(bd!.x).toBeGreaterThan(bh!.x + 200);

  // clicar numa linha troca a seleção via ?r= — a lista marca o ativo
  const linha = page.locator("a[data-registro]").nth(1);
  const id = await linha.getAttribute("data-registro");
  await linha.click();
  await page.waitForURL(new RegExp(`r=${id}`));
  await expect(page.locator(`a[data-registro="${id}"]`)).toHaveAttribute(
    "aria-current",
    "true"
  );
});

test("?grupo=semana: cabeçalhos 'Semana de dd/mm/aaaa'", async ({ page }) => {
  await abreRegistros(page, "?grupo=semana");

  const headers = page.getByRole("heading", { name: SEMANA_HEAD });
  expect(await headers.count()).toBeGreaterThanOrEqual(2);
  // coluna única: os dois primeiros headers empilham (y distintos)
  const b0 = await headers.nth(0).boundingBox();
  const b1 = await headers.nth(1).boundingBox();
  expect(b1!.y).toBeGreaterThan(b0!.y + 100);
});

test("?grupo=avaliacao: severidade primeiro, balde vazio some", async ({
  page,
}) => {
  await abreRegistros(page, "?grupo=avaliacao");

  const headers = page.getByRole("heading", {
    name: /^Avaliação: |^Sem avaliação/,
  });
  const textos = await headers.allTextContents();
  expect(textos.length).toBeGreaterThanOrEqual(3);
  // o dataset demo tem 1 registro "baixa" (dupla risco) — abre a lista
  expect(textos[0]).toMatch(/^Avaliação: Baixa/);
  // severidade decrescente: "boa" nunca abre grupo antes de "regular"
  expect(textos.join("|")).toMatch(/Regular(.|\n)*Boa/);
  // todo header é um balde preenchido no formato certo
  for (const t of textos) expect(t).toMatch(AVAL_HEAD);
});

test("?grupo=<lixo> cai no default dupla", async ({ page }) => {
  await abreRegistros(page, "?grupo=nao-existe");
  await expect(
    page
      .getByRole("group", { name: "Agrupar registros" })
      .getByRole("link", { name: "por dupla" })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: DUPLA_HEAD_LG }).first()
  ).toBeVisible();
});

test("busca + agrupamento combinam (?q=…&grupo=dupla)", async ({ page }) => {
  // "Roda" casa o tema do encontro 12 DPP — filtra pra poucas duplas
  await abreRegistros(page, "?q=Roda&grupo=dupla");

  // chip de busca ativo + agrupamento segue aplicado sobre os filtrados
  await expect(page.getByText(/Busca: “Roda”/)).toBeVisible();
  const headers = page.getByRole("heading", { name: DUPLA_HEAD_LG });
  expect(await headers.count()).toBeGreaterThanOrEqual(1);
  // o switcher marca o grupo ativo e os links preservam a busca
  const porSemana = page.getByRole("link", { name: "por semana" });
  await expect(porSemana).toHaveAttribute("href", /q=Roda/);
  await expect(porSemana).toHaveAttribute("href", /grupo=semana/);
});

test("switcher de grupo preserva filtros ativos no href", async ({ page }) => {
  await abreRegistros(page, "?apoio=1&grupo=semana");
  const porAvaliacao = page.getByRole("link", { name: "por avaliação" });
  await expect(porAvaliacao).toHaveAttribute("href", /apoio=1/);
  await expect(porAvaliacao).toHaveAttribute("href", /grupo=avaliacao/);
});

test("dialog Filtros é right-sized (~max-w-md)", async ({ page }) => {
  await abreRegistros(page);
  await page.getByRole("button", { name: /Filtros/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  // max-w-md = 448px — lg (512) falharia; folga pra subpixel/margins
  expect(box!.width).toBeLessThanOrEqual(464);
  expect(box!.width).toBeGreaterThanOrEqual(384);
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("lista compacta; o registro abre numa folha e fecha de volta", async ({
    page,
  }) => {
    await abreRegistros(page);
    // REALIZA-211: a mesma lista do desktop, sem registro aberto ao lado
    const headers = page.getByRole("heading", { name: DUPLA_HEAD_LG });
    expect(await headers.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("article", { name: /\d+º (encontro|passo)/ })).toHaveCount(0);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(390);

    const linha = page.locator("a[data-registro]").first();
    const id = await linha.getAttribute("data-registro");
    await linha.click();
    await page.waitForURL(new RegExp(`r=${id}`));
    const folha = page.getByRole("dialog", { name: "Registro do encontro" });
    await expect(folha).toBeVisible();
    await expect(folha.getByRole("article")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(folha).toBeHidden();
    await expect(page).not.toHaveURL(/r=/);
  });
});

// ---------- painel "Panorama" (REALIZA-198) ----------
// O dashboard é server-rendered acima da lista: pills de recorte navegam por
// URL (?turma=/?periodo=), os toggles de métrica são estado local do client
// component e a lista agrupada segue intacta embaixo.

test.describe("panorama do ciclo", () => {
  test("renderiza os três cards + pills de recorte acima da lista", async ({
    page,
  }) => {
    await abreRegistros(page);

    // seção nomeada + grupos de recorte acessíveis
    await expect(
      page.getByRole("heading", { name: "Panorama do ciclo", exact: true })
    ).toBeVisible();
    const turma = page.getByRole("group", { name: "Recortar por turma" });
    await expect(turma.getByRole("link", { name: "Todas" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    // dataset demo tem T1 e T2 com duplas — as duas pills aparecem
    await expect(
      turma.getByRole("link", { name: "Turma 1" })
    ).toBeVisible();
    await expect(
      turma.getByRole("link", { name: "Turma 2" })
    ).toBeVisible();

    const periodo = page.getByRole("group", { name: "Recortar por período" });
    await expect(
      periodo.getByRole("link", { name: "Ciclo todo" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      periodo.getByRole("link", { name: "Últimas 8 semanas" })
    ).toBeVisible();

    // cards: cobertura (barras) + situação das duplas + linha ★
    await expect(
      page.getByRole("heading", { name: "Encontros realizados e registrados" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Situação das duplas", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Avaliação média do jovem" })
    ).toBeVisible();
    // a situação é uma barra segmentada nomeada com os números por
    // extenso (o mesmo resumo de /duplas e da agenda, não um donut)
    await expect(
      page.getByRole("img", { name: /em andamento: \d+ em risco/ })
    ).toBeVisible();
    // as barras são uma imagem nomeada com os dados por extenso
    await expect(
      page.getByRole("img", { name: /Barras por encontro/ })
    ).toBeVisible();

    // a lista continua embaixo — o painel não substitui a lista
    await expect(
      page.getByRole("heading", { name: DUPLA_HEAD_LG }).first()
    ).toBeVisible();
  });

  test("pill de turma filtra painel E lista (mesmo recorte na URL)", async ({
    page,
  }) => {
    await abreRegistros(page);
    const link = page
      .getByRole("group", { name: "Recortar por turma" })
      .getByRole("link", { name: "Turma 1" });
    await expect(link).toHaveAttribute("href", /\?turma=/);
    await link.click();
    await page.waitForURL(/turma=/);

    // chip removível + legenda do painel com uma turma só
    await expect(page.getByText("Turma: T1")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Turma 1" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: DUPLA_HEAD_LG }).first()
    ).toBeVisible();
  });

  test("pill de período corta a janela e marca chip", async ({ page }) => {
    await abreRegistros(page);
    await page
      .getByRole("group", { name: "Recortar por período" })
      .getByRole("link", { name: "Últimas 4 semanas" })
      .click();
    await page.waitForURL(/periodo=4s/);
    await expect(page.getByText("Últimas 4 semanas").last()).toBeVisible();
  });

  test("toggle de métrica das barras troca o headline sem navegar", async ({
    page,
  }) => {
    await abreRegistros(page);
    const grupo = page.getByRole("group", { name: "Métrica das barras" });
    // REALIZA-211: realizado e registrado moram no mesmo gráfico (cor
    // cheia × clara) — não existe mais a métrica "Realizados" à parte
    await expect(
      page.getByRole("heading", { name: "Encontros realizados e registrados" })
    ).toBeVisible();
    await expect(grupo.getByRole("button", { name: "Realizados" })).toHaveCount(0);
    await expect(page.getByText("aconteceu, falta o registro")).toBeVisible();
    await grupo.getByRole("button", { name: "Avaliações ★" }).click();
    await expect(
      page.getByRole("heading", { name: "Avaliações do jovem por encontro" })
    ).toBeVisible();
    // estado local — a URL continua limpa
    expect(page.url()).not.toContain("metrica=");
  });

  test("modo 'visão do mentor' troca a linha pra escala 1–4", async ({
    page,
  }) => {
    await abreRegistros(page);
    await page
      .getByRole("group", { name: "Modo da linha" })
      .getByRole("button", { name: "Visão do mentor" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nota média do mentor" })
    ).toBeVisible();
  });
});
