import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// /registros agrupado por ?grupo=dupla|semana|avaliacao (REALIZA-175).
// Demo como coordenação vê todas as 16 duplas — ~94 registros com
// avaliações variadas (baixa/regular/boa/excelente no dataset).
// O default é `grupo=dupla` implícito (param ausente == dupla).

const DUPLA_HEAD = /^Dupla: .+ × .+ · \d+ registros?$/;
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

test("default: agrupa por dupla em 2 colunas no xl", async ({ page }) => {
  await abreRegistros(page);

  // switcher presente com a opção ativa correta
  const switcher = page.getByRole("group", { name: "Agrupar registros" });
  await expect(switcher).toBeVisible();
  await expect(
    switcher.getByRole("link", { name: "por dupla" })
  ).toHaveAttribute("aria-current", "page");

  // headers de dupla no formato "Dupla: X × Y · K registros"
  const headers = page.getByRole("heading", { name: DUPLA_HEAD });
  expect(await headers.count()).toBeGreaterThanOrEqual(3);

  // xl (1280 default): os dois primeiros grupos ficam lado a lado —
  // mesma linha de topo, colunas distintas
  const b0 = await headers.nth(0).boundingBox();
  const b1 = await headers.nth(1).boundingBox();
  expect(b0).not.toBeNull();
  expect(b1).not.toBeNull();
  expect(Math.abs(b0!.y - b1!.y)).toBeLessThan(8);
  expect(b1!.x).toBeGreaterThan(b0!.x + 200);
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
    page.getByRole("heading", { name: DUPLA_HEAD }).first()
  ).toBeVisible();
});

test("busca + agrupamento combinam (?q=…&grupo=dupla)", async ({ page }) => {
  // "Roda" casa o tema do encontro 12 DPP — filtra pra poucas duplas
  await abreRegistros(page, "?q=Roda&grupo=dupla");

  // chip de busca ativo + agrupamento segue aplicado sobre os filtrados
  await expect(page.getByText(/Busca: “Roda”/)).toBeVisible();
  const headers = page.getByRole("heading", { name: DUPLA_HEAD });
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

  test("grupos por dupla empilham em coluna única", async ({ page }) => {
    await abreRegistros(page);
    const headers = page.getByRole("heading", { name: DUPLA_HEAD });
    expect(await headers.count()).toBeGreaterThanOrEqual(2);
    const b0 = await headers.nth(0).boundingBox();
    const b1 = await headers.nth(1).boundingBox();
    // sem grade xl: o 2º grupo nasce abaixo do 1º
    expect(b1!.y).toBeGreaterThan(b0!.y + 100);
    expect(Math.abs(b0!.x - b1!.x)).toBeLessThan(8);
  });
});
