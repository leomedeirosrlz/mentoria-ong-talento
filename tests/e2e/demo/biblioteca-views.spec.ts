import { entrarNaDemo, expect, test } from "../helpers";

// spec 029 — o alternador Cartões/Lista é o mesmo nas três bibliotecas
// (jovem, mentor, coordenação). Defaults por viewport × superfície
// (mobile Lista; desktop jovem Cartões, staff Lista), a escolha explícita
// persiste no aparelho e a Lista nunca monta preview (sem iframe/img).
// Demo é read-only — seguro em qualquer ambiente.

test.describe("demo — alternador Cartões/Lista da biblioteca (029)", () => {
  test("coordenação desktop: Lista por default; Cartões troca a gramática sem sair da URL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais?aba=biblioteca");

    const bib = page.getByRole("region", { name: /Todos os materiais/ });
    const toggle = page.getByRole("group", { name: "Modo de visualização" });
    await expect(toggle).toBeVisible();
    await expect(
      toggle.getByRole("button", { name: "Lista" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      toggle.getByRole("button", { name: "Cartões" })
    ).toHaveAttribute("aria-pressed", "false");

    // Lista = linhas dentro das seções; nunca preview (sem iframe/img —
    // o escopo é a biblioteca: avatar e logo do chrome vivem fora)
    await expect(bib.getByRole("listitem").first()).toBeVisible();
    await expect(bib.locator("iframe")).toHaveCount(0);
    await expect(bib.locator("img")).toHaveCount(0);

    const urlAntes = page.url();
    await toggle.getByRole("button", { name: "Cartões" }).click();

    // trocou sem navegar (FR-005): seções e contagens sobrevivem, os itens
    // viram cards — links com capa, não <li>
    await expect(
      toggle.getByRole("button", { name: "Cartões" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(page.url()).toBe(urlAntes);
    await expect(bib.getByRole("region", { name: /Guias/ })).toBeVisible();
    await expect(bib.getByRole("listitem")).toHaveCount(0);
    // o status sr-only anuncia modo + total (FR-001)
    await expect(toggle.getByRole("status")).toHaveText(/Cartões · \d+ itens/);

    // o ⋯ da coord (editar/anexar/excluir) fica FORA do <a> do card —
    // botão dentro de link é HTML inválido e comeria o toque
    const card = bib
      .getByRole("region", { name: /Guias/ })
      .getByRole("link", { name: /Guia do Mentor DPP/ });
    await expect(card).toBeVisible();
    await expect(card.locator("button")).toHaveCount(0);
    await expect(
      bib.getByRole("region", { name: /Guias/ }).getByRole("button", {
        name: /Ações de "Guia do Mentor DPP"/,
      })
    ).toBeVisible();
    await expect(bib.locator("iframe")).toHaveCount(0);

    // persiste no reload — a escolha explícita vence o default do staff
    await page.reload();
    await expect(
      toggle.getByRole("button", { name: "Cartões" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(bib.getByRole("listitem")).toHaveCount(0);

    // volta pra Lista: as linhas retornam com ⋯ e seções intactas
    await toggle.getByRole("button", { name: "Lista" }).click();
    await expect(bib.getByRole("listitem").first()).toBeVisible();
    await expect(
      bib.getByRole("region", { name: /Conteúdos e roteiros/ })
    ).toBeVisible();
  });

  test("mentor desktop: a mesma biblioteca com a mesma chave staff", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/materiais");

    const bib = page.getByRole("region", { name: /Todos os materiais/ });
    const toggle = page.getByRole("group", { name: "Modo de visualização" });
    await expect(
      toggle.getByRole("button", { name: "Lista" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(bib.getByRole("listitem").first()).toBeVisible();

    await toggle.getByRole("button", { name: "Cartões" }).click();
    await expect(bib.getByRole("region", { name: /Guias/ })).toBeVisible();
    await expect(bib.getByRole("listitem")).toHaveCount(0);
    // ⋯ de leitura do mentor (abrir em nova aba / copiar link) — sibling
    // do link, como no jovem
    const guia = bib
      .getByRole("region", { name: /Guias/ })
      .getByRole("link", { name: /Guia do Mentor DPP/ });
    await expect(guia).toBeVisible();
    await expect(guia.locator("button")).toHaveCount(0);
  });

  test("jovem desktop: Cartões por default no Acervo; Lista vira linhas", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    const acervo = page.locator("section#acervo");
    const toggle = acervo.getByRole("group", {
      name: "Modo de visualização",
    });
    await expect(
      toggle.getByRole("button", { name: "Cartões" })
    ).toHaveAttribute("aria-pressed", "true");
    // cartões: os itens do acervo são links com capa, não <li>
    await expect(acervo.getByRole("listitem")).toHaveCount(0);
    await expect(
      acervo.getByRole("link", { name: /Formação EaD gratuita/ })
    ).toBeVisible();
    await expect(acervo.locator("iframe")).toHaveCount(0);

    await toggle.getByRole("button", { name: "Lista" }).click();
    await expect(acervo.getByRole("listitem").first()).toBeVisible();
    await expect(
      acervo.getByRole("link", { name: /Formação EaD gratuita/ })
    ).toBeVisible();
    // a escolha persiste — jovem tem a própria chave, não a do staff
    await page.reload();
    await expect(
      toggle.getByRole("button", { name: "Lista" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(acervo.getByRole("listitem").first()).toBeVisible();
  });

  test("390px: toda superfície abre em Lista e os alvos têm ≥44px (FR-001/002)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    const acervo = page.locator("section#acervo");
    const toggle = acervo.getByRole("group", {
      name: "Modo de visualização",
    });
    // mobile nunca abre a estante de capas — Lista mesmo sem escolha
    await expect(
      toggle.getByRole("button", { name: "Lista" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(acervo.getByRole("listitem").first()).toBeVisible();
    await expect(acervo.locator("iframe")).toHaveCount(0);
    await expect(acervo.locator("img")).toHaveCount(0);

    // o grupo inteiro cabe e cada chip é alvo de toque confortável
    for (const nome of ["Cartões", "Lista"]) {
      const box = await toggle
        .getByRole("button", { name: nome })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
