import { entrarNaDemo, expect, test } from "../helpers";

// Card "Aguardando par" (REALIZA-101 + rework out/2026) no modo demo —
// coord-only em /pessoas. A tela abre com o card FECHADO; expandir é
// escolha da coord. No modo Parear as colunas viram radiogroups com uma
// lista fixa embaixo, que nunca vira esqueleto quando o outro lado é
// clicado — era o bug reportado: selecionar um lado sumia com a seleção
// do outro. O bloco de sugestões semânticas fica vazio na demo (o rank
// volta [] do stub), então a cobertura é a estabilidade das listas.
// Rafael e Wendel são os mentorados sem par do dataset; os mentores DPP
// aparecem todos na lista fixa — André cheio (2/2), Luiza e Carlos 1/2.
test.describe("demo — fila 'Aguardando par' e pareamento", () => {
  test("abre fechado, expande e pareia sem esconder a lista fixa", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const card = page.locator(
      'section[aria-labelledby="fila-espera-titulo"]'
    );
    // fechado por padrão — a fila é contexto, não se impõe
    const gatilho = card.getByRole("button", { name: /Aguardando par ·/ });
    await expect(gatilho).toHaveAttribute("aria-expanded", "false");
    await gatilho.click();
    await expect(gatilho).toHaveAttribute("aria-expanded", "true");

    // modo fila: os dois mentorados sem par do dataset
    for (const nome of ["Rafael Nunes", "Wendel Ferreira"]) {
      await expect(
        card.getByRole("link", { name: `Abrir perfil de ${nome}` })
      ).toBeVisible();
    }

    // modo Parear — as colunas viram radiogroups com a lista fixa
    await card.getByRole("button", { name: "Parear", exact: true }).click();
    const colMentorados = card.getByRole("radiogroup", {
      name: "Mentorados livres",
    });
    const colMentores = card.getByRole("radiogroup", {
      name: "Mentores DPP",
    });
    await expect(colMentorados).toBeVisible();
    await expect(colMentores).toBeVisible();
    // cheio afunda marcado, não some — a régua X/Y é visível por linha
    await expect(
      colMentores
        .getByRole("radio", { name: /André Rocha/ })
        .getByText(/2\/2 · sem vaga/)
    ).toBeVisible();

    // clicar num lado NÃO esconde a lista do outro: antes a coluna
    // inteira virava esqueleto e sumia até a linha recém-selecionada
    await colMentorados.getByRole("radio", { name: /Rafael Nunes/ }).click();
    for (const nome of ["André Rocha", "Luiza Campos", "Carlos Menezes"]) {
      await expect(
        colMentores.getByRole("radio", { name: new RegExp(nome) })
      ).toBeVisible();
    }

    // idem no sentido oposto — a mentorada escolhida continua marcada
    await colMentores.getByRole("radio", { name: /Luiza Campos/ }).click();
    await expect(
      colMentorados.getByRole("radio", { name: /Rafael Nunes/ })
    ).toHaveAttribute("aria-checked", "true");

    // a afinidade monta com os dois lados alinhados (demo compara campos
    // reais; o ranqueamento semântico fica vazio no stub)
    await expect(card.getByText("Afinidade do par")).toBeVisible();
    await expect(
      card.getByText("Mentorado", { exact: true })
    ).toBeVisible();
    await expect(card.getByText("Mentor", { exact: true })).toBeVisible();

    // "Formar dupla" habilita com os dois escolhidos — mentor livre
    await expect(
      card.getByRole("button", { name: "Formar dupla", exact: true })
    ).toBeEnabled();
  });
});
