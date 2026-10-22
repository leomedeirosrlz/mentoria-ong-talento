import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-163 (superfície demo) — o CampoDisponibilidade virou a matriz
// dia×período "pinta e clica" (mesma interação do Excel): arrastar pinta
// células no estado-alvo da âncora, cabeçalhos alternam linha/coluna
// inteira, e o teclado opera por roving tabindex + setas + Espaço. O spec
// afirma a interação — gravação é stubada no modo demo, então o que vale
// é o estado visual (aria-pressed) mudando por gesto.
// A persona mentorado (Bia) já traz ter/qui × noite pré-marcada na ficha.

test.describe("matriz de disponibilidade (REALIZA-163)", () => {
  test.beforeEach(async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/perfil");
    await page
      .getByRole("button", { name: "Editar sua disponibilidade" })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("grid", { name: "Dias e períodos livres na semana" })
    ).toBeVisible();
  });

  test("arrastar pinta células contíguas; arrastar sobre ligadas apaga", async ({
    page,
  }) => {
    const dialogo = page.getByRole("dialog");
    const centro = async (nome: string) => {
      const box = await dialogo
        .getByRole("button", { name: nome, exact: true })
        .boundingBox();
      if (!box) throw new Error(`sem bounding box: ${nome}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    // arraste seg→qua na linha "de manhã" — todas apagadas → pinta as 3
    const ini = await centro("Segunda de manhã");
    const fim = await centro("Quarta de manhã");
    await page.mouse.move(ini.x, ini.y);
    await page.mouse.down();
    await page.mouse.move(fim.x, fim.y, { steps: 12 });
    await page.mouse.up();
    for (const d of ["Segunda", "Terça", "Quarta"]) {
      await expect(
        dialogo.getByRole("button", { name: `${d} de manhã`, exact: true })
      ).toHaveAttribute("aria-pressed", "true");
    }

    // arraste que NASCE em célula ligada apaga — ter e qui de noite vinham
    // marcadas na ficha e saem juntas
    const iniOn = await centro("Terça de noite");
    const fimOn = await centro("Quinta de noite");
    await page.mouse.move(iniOn.x, iniOn.y);
    await page.mouse.down();
    await page.mouse.move(fimOn.x, fimOn.y, { steps: 12 });
    await page.mouse.up();
    for (const d of ["Terça", "Quinta"]) {
      await expect(
        dialogo.getByRole("button", { name: `${d} de noite`, exact: true })
      ).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("cabeçalhos alternam coluna e linha inteiras", async ({ page }) => {
    const dialogo = page.getByRole("dialog");
    // coluna do domingo inteira liga/desliga pelo cabeçalho
    await dialogo
      .getByRole("button", { name: "Alternar Domingo inteiro" })
      .click();
    for (const p of ["manhã", "tarde", "noite"]) {
      await expect(
        dialogo.getByRole("button", {
          name: `Domingo de ${p}`,
          exact: true,
        })
      ).toHaveAttribute("aria-pressed", "true");
    }
    await dialogo
      .getByRole("button", { name: "Alternar Domingo inteiro" })
      .click();
    for (const p of ["manhã", "tarde", "noite"]) {
      await expect(
        dialogo.getByRole("button", {
          name: `Domingo de ${p}`,
          exact: true,
        })
      ).toHaveAttribute("aria-pressed", "false");
    }

    // linha "Tarde" inteira liga pelo rótulo — cobre dias que ninguém pintou
    await dialogo
      .getByRole("button", { name: "Alternar Tarde inteira" })
      .click();
    for (const d of ["Segunda", "Sexta", "Domingo"]) {
      await expect(
        dialogo.getByRole("button", { name: `${d} de tarde`, exact: true })
      ).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("clique simples alterna uma vez só", async ({ page }) => {
    // regressão: o pointerdown pinta a célula e o click sintético do tap
    // chega depois — sem o guard de detail o par desfazia a marca e o
    // salvar mandava grade vazia
    const dialogo = page.getByRole("dialog");
    const celula = dialogo.getByRole("button", {
      name: "Sábado de tarde",
      exact: true,
    });
    await celula.click();
    await expect(celula).toHaveAttribute("aria-pressed", "true");
    await celula.click();
    await expect(celula).toHaveAttribute("aria-pressed", "false");
  });

  test("teclado: setas navegam e Espaço alterna a célula focada", async ({
    page,
  }) => {
    const dialogo = page.getByRole("dialog");
    const alvo = dialogo.getByRole("button", {
      name: "Segunda de tarde",
      exact: true,
    });
    await alvo.focus();
    // roving tabindex: a seta move o foco pra vizinha e Espaço alterna ela
    await page.keyboard.press("ArrowRight");
    const vizinha = dialogo.getByRole("button", {
      name: "Terça de tarde",
      exact: true,
    });
    await expect(vizinha).toBeFocused();
    await page.keyboard.press(" ");
    await expect(vizinha).toHaveAttribute("aria-pressed", "true");
    // e alterna de volta — sem duplo toggle pelo caminho do teclado
    await page.keyboard.press(" ");
    await expect(vizinha).toHaveAttribute("aria-pressed", "false");
  });
});
