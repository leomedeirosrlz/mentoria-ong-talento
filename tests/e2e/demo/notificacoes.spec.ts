import { entrarNaDemo, expect, test } from "../helpers";

// 027 — popover do sino: corpo longo lê por inteiro com "Ler mais"/"Ler
// menos" (gesto próprio: não navega, não marca lida, não fecha o popover)
// e a releitura promove a frase do corpo pro título ambíguo. O dataset
// demo carrega os dois casos: a comunicado longa da Bia e a "Sugestão
// confirmada" mintada pela 0086 no sino do Ricardo.
test.describe("notificações — corpo longo e título contextual", () => {
  test("Ler mais expande o corpo no popover sem navegar nem marcar lida", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem");

    await page
      .getByRole("button", { name: /^Notificações(, \d+ não lidas)?$/ })
      .first()
      .click();
    // o painel do assistente divide o data-slot popover-content — o nome
    // acessível ("Notificações", do PopoverTitle) desambigua
    const popover = page.getByRole("dialog", { name: "Notificações" });
    await expect(popover).toBeVisible();

    const item = popover.locator("li", {
      hasText: "Semana da avaliação por terceiros",
    });
    await expect(item).toBeVisible();
    // o corpo nasce clampado em 2 linhas — o texto segue no DOM (leitor de
    // tela já lê), então a asserção do fechado é a classe do clamp — e o
    // toggle só existe porque o overflow é real
    const toggle = item.getByRole("button", { name: "Ler mais" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(item.locator("p.line-clamp-2")).toHaveCount(1);
    // title com o corpo completo é o piso sem hover/teclado (FR-010)
    await expect(
      item.locator("p[title*='convidar as 3 pessoas']")
    ).toHaveCount(1);

    const urlAntes = page.url();
    await toggle.click();

    // expande no lugar: aria-expanded atualiza, o clamp sai e o texto
    // inteiro aparece — e o popover NÃO fecha nem a URL muda (gesto
    // distinto do de navegar)
    await expect(item.getByRole("button", { name: "Ler menos" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await expect(item.locator("p.line-clamp-2")).toHaveCount(0);
    await expect(item.getByText(/a gente lembra na quinta/)).toBeVisible();
    await expect(popover).toBeVisible();
    expect(page.url()).toBe(urlAntes);

    // e segue sem mexer na leitura: o "Marcar como lida" do item continua
    // (expandir não é gesto de leitura) e o link dele aponta pra navegação
    await expect(
      item.getByRole("button", { name: "Marcar como lida" })
    ).toBeVisible();
    await expect(item.locator('a[href="/#avisos"]')).toHaveCount(1);

    // recolhe de volta — o clamp retorna
    await item.getByRole("button", { name: "Ler menos" }).click();
    await expect(item.getByRole("button", { name: "Ler mais" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(item.locator("p.line-clamp-2")).toHaveCount(1);

    // item de corpo curto não promete expansão que não existe — "Formação
    // confirmada" cabe nas 2 linhas do clamp, então nenhum toggle renderiza
    const curto = popover.locator("li", {
      hasText: "Formação confirmada",
    });
    await expect(curto).toBeVisible();
    await expect(
      curto.getByRole("button", { name: /Ler mais|Ler menos/ })
    ).toHaveCount(0);
  });

  test("título ambíguo mostra quem confirmou e o quê (releitura demo)", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/");

    await page
      .getByRole("button", { name: /^Notificações(, \d+ não lidas)?$/ })
      .first()
      .click();
    const popover = page.getByRole("dialog", { name: "Notificações" });
    await expect(popover).toBeVisible();

    // a mint real salva "Sugestão confirmada" + a frase no corpo — a
    // releitura promove "quem confirmou e o quê" pro título (FR-011b) e
    // deixa o próximo passo no corpo
    const item = popover.locator("li", {
      hasText: "Ana Beatriz Silva confirmou a sua sugestão de especialista",
    });
    await expect(item).toBeVisible();
    await expect(item.getByText("O pedido seguiu.")).toBeVisible();
    // e o título genérico não aparece em lugar nenhum da lista
    await expect(
      popover.getByText("Sugestão confirmada", { exact: true })
    ).toHaveCount(0);
  });
});
