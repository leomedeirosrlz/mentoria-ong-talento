import { entrarNaDemo, expect, test } from "../helpers";

// Card "Aguardando par" (REALIZA-101 + rework REALIZA-446) no modo demo —
// coord-only em /pessoas. Com gente esperando o card já abre EXPANDIDO
// (a fila é a chamada de entrada, não contexto escondido): o título traz a
// contagem separada ("N mentorados · M mentores com vaga"), a fila ordena
// por espera e o "Parear agora" leva ao modo de decisão, onde as colunas
// viram radiogroups com uma lista fixa embaixo que nunca vira esqueleto
// quando o outro lado é clicado — era o bug reportado: selecionar um lado
// sumia com a seleção do outro. O bloco de sugestões semânticas fica vazio
// na demo (o rank volta [] do stub), então a cobertura é a estabilidade
// das listas. Rafael (~22 dias de espera) e Wendel (~6) são os mentorados sem
// par; os mentores DPP aparecem todos na lista fixa — André cheio (2/2),
// Luiza e Carlos 1/2.
test.describe("demo — fila 'Aguardando par' e pareamento", () => {
  test("abre aberto com contagem separada e fila em ordem de espera", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const card = page.locator(
      'section[aria-labelledby="fila-espera-titulo"]'
    );
    // aberto por padrão — com espera na fila o card é o trabalho, não um
    // detalhe colapsável. O gatilho carrega a contagem dos DOIS lados:
    // o que falta pra parear fica legível sem abrir nada
    const gatilho = card.getByRole("button", { name: /Aguardando par/ });
    await expect(gatilho).toHaveAttribute("aria-expanded", "true");
    await expect(
      card.getByText("2 mentorados · 2 mentores com vaga")
    ).toBeVisible();

    // a fila é promessa por ordem de chegada — Rafael (carimbo ~22 dias
    // atrás; a hora do carimbo faz o "há N dias" variar entre 21 e 22) é a
    // primeira linha do card, Wendel (~6) vem depois
    const linhas = card.locator("li");
    await expect(linhas.first()).toContainText("Rafael Nunes");
    await expect(linhas.first()).toContainText(/há 2[12] dias/);
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Wendel Ferreira" })
    ).toBeVisible();
    await expect(card.getByText(/há [56] dias/)).toBeVisible();

    // ação por linha é rotulada — "Parear <nome>", não um ícone de canto
    await expect(
      card.getByRole("button", { name: "Parear Rafael" })
    ).toBeVisible();
    // e a entrada em massa no fim do card
    await expect(
      card.getByRole("button", { name: "Parear agora" })
    ).toBeVisible();
  });

  test("busca por nome e chip de turma recortam a fila", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const card = page.locator(
      'section[aria-labelledby="fila-espera-titulo"]'
    );
    // o dataset cruza três turmas (T1, T2, 2025/2026) — o recorte aparece
    // mesmo com fila curta
    const busca = card.getByLabel("Buscar na fila por nome");
    await expect(busca).toBeVisible();
    await busca.fill("Wendel");
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Wendel Ferreira" })
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Rafael Nunes" })
    ).toHaveCount(0);
    await busca.fill("");
    // o debounce de 300ms precisa virar lista antes do chip — a espera
    // no retorno do Rafael é o flush
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Rafael Nunes" })
    ).toBeVisible();

    // chip de turma: T2 guarda os dois mentorados; T1 só deixa o Carlos
    // (mentor dela) — a coluna zerada explica o recorte, não fica muda
    await card.getByRole("button", { name: /^T1 ·/ }).click();
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Carlos Menezes" })
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: /Abrir perfil de (Rafael|Wendel)/ })
    ).toHaveCount(0);
    await expect(card.getByText("Nada nesse recorte.")).toBeVisible();
    // "Todas" devolve o card inteiro
    await card.getByRole("button", { name: "Todas", exact: true }).click();
    await expect(
      card.getByRole("link", { name: "Abrir perfil de Rafael Nunes" })
    ).toBeVisible();
  });

  test("parear mantém lista fixa, espera visível e CTA de decisão", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const card = page.locator(
      'section[aria-labelledby="fila-espera-titulo"]'
    );

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

    // a espera migrou pro modo de decisão: Rafael encabeça a lista dos
    // livres e o "há N dias" segue destacado na meta da linha
    const linhaRafael = colMentorados.getByRole("radio", {
      name: /Rafael Nunes/,
    });
    await expect(colMentorados.getByRole("radio").first()).toHaveText(
      /Rafael Nunes/
    );
    await expect(linhaRafael.getByText(/há 2[12] dias/)).toBeVisible();
    // cheio afunda marcado, não some — a régua X/Y é visível por linha
    await expect(
      colMentores
        .getByRole("radio", { name: /André Rocha/ })
        .getByText(/2\/2 · sem vaga/)
    ).toBeVisible();

    // rodapé de decisão sempre à vista: o que falta + o primário. Antes da
    // seleção ele diz o que falta e o "Formar dupla" fica desabilitado
    await expect(
      card.getByRole("button", { name: "Formar dupla", exact: true })
    ).toBeDisabled();
    await expect(card.getByText("Nenhum lado escolhido ainda.")).toBeVisible();

    // clicar num lado NÃO esconde a lista do outro: antes a coluna
    // inteira virava esqueleto e sumia até a linha recém-selecionada
    await linhaRafael.click();
    for (const nome of ["André Rocha", "Luiza Campos", "Carlos Menezes"]) {
      await expect(
        colMentores.getByRole("radio", { name: new RegExp(nome) })
      ).toBeVisible();
    }
    // o rodapé acompanha a seleção parcial
    await expect(card.getByText("Falta escolher o mentor.")).toBeVisible();

    // idem no sentido oposto — a mentorada escolhida continua marcada
    await colMentores.getByRole("radio", { name: /Luiza Campos/ }).click();
    await expect(linhaRafael).toHaveAttribute("aria-checked", "true");

    // a afinidade monta com os dois lados alinhados (demo compara campos
    // reais; o ranqueamento semântico fica vazio no stub) e o rodapé
    // nomeia o par pronto
    await expect(card.getByText("Afinidade do par")).toBeVisible();
    await expect(
      card.getByText("Mentorado", { exact: true })
    ).toBeVisible();
    await expect(card.getByText("Mentor", { exact: true })).toBeVisible();
    await expect(card.getByText(/Par pronto:/)).toBeVisible();

    // "Formar dupla" habilita com os dois escolhidos — mentor livre
    await expect(
      card.getByRole("button", { name: "Formar dupla", exact: true })
    ).toBeEnabled();
  });

  test("/duplas tem a entrada da fila pra /pessoas#aguardando-par", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    const entrada = page.getByRole("link", { name: /Aguardando par/ });
    await expect(entrada).toBeVisible();
    await expect(entrada).toHaveAttribute(
      "href",
      "/pessoas#aguardando-par"
    );

    // o destino pousa no card âncora — já aberto, com a fila em foco
    await entrada.click();
    await page.waitForURL("**/pessoas**");
    await expect(
      page.locator('section#aguardando-par')
    ).toBeVisible();
  });
});
