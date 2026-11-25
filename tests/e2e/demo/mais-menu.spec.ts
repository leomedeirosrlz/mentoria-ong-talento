import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-157 — o menu "Mais" da ficha tinha itens híbridos
// (Dialog.Trigger render={Menu.Item}) que não preenchiam a largura do
// popup e exigiam o Portal keepMounted. Agora cada item é um menuitem
// comum: preenche a linha inteira, abre o dialog irmão e devolve o foco
// pro "Mais" ao fechar. Spec demo — leitura só, segura em qualquer
// ambiente (o "Enviar formulário" abre o dialog; nada é submetido).
//
// Review 21/11 (#9): o cabeçalho da ficha mostra UMA ação primária e o ⋯
// carrega TODO o resto — em qualquer viewport (o layout anterior punha
// os itens em linha a partir do sm e o "Mais" só no celular). E o estado
// do pedido de especialista não vira item desabilitado: mora num lugar
// só, o card "Pedidos em aberto" da aba Agora.
//
// A prova pede uma dupla DPP ativa SEM solicitação de especialista em
// aberto. A d-ok (Ricardo × Ana) não serve mais: o dataset ganhou pedidos
// vivos pra ela ("contra_proposta" + "aberta" em data.ts) e a ficha
// esconde "Solicitar mentor especialista" enquanto um pedido ocupa a vaga
// (solEmAberto em duplas/[id]/page.tsx). A d-t2b (Luiza × Laura, T2
// ativa, nenhuma solicitação no fixture) preserva o recorte medido aqui.
const DUPLA_SEM_PEDIDO = "de000000-0000-4000-8000-000000001548"; // Luiza × Laura
// Ricardo × Matheus: pendência de registro + pedido 'aberta' — prova a
// primária do mentor e o estado do pedido contido no card
const DUPLA_T2C = "de000000-0000-4000-8000-000000001549";
// d-ok (Ricardo × Ana): sempre sobra um agendado no futuro — o 5º na terça
// da semana ou o 6º na seguinte — então a remarcação do DPP mora no ⋯
const DUPLA_OK = "de000000-0000-4000-8000-000000001537";
// d-esp1 (Sofia × Ana): trilha de especialista ativa com a tentativa nº4
// já agendada — a remarcação dela é "sessão", não "encontro"
const DUPLA_ESP1 = "de000000-0000-4000-8000-000000001542";

// coordenação em dupla ativa: quatro itens, nesta ordem no popup
const ITENS = [
  "Enviar formulário",
  "Solicitar mentor especialista",
  "Editar dupla",
  "Remanejar dupla",
] as const;

test.describe("demo — ações de segunda ordem da ficha", () => {
  test("desktop: uma primária + ⋯ com os quatro itens, dialog abre e foco volta", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_SEM_PEDIDO}`);

    // nada em linha: os itens só existem como menuitem do ⋯ — nenhum
    // botão solto no cabeçalho (review #9)
    for (const nome of ITENS)
      await expect(
        page.getByRole("button", { name: nome, exact: true })
      ).toHaveCount(0);

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await expect(mais).toBeVisible();
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    const itens = popup.getByRole("menuitem");
    // contagem e ORDEM — toHaveText normaliza o espaço de cada item
    await expect(itens).toHaveText([...ITENS]);

    await popup
      .getByRole("menuitem", { name: "Enviar formulário" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(mais).toBeFocused();
  });

  test("celular: itens preenchem o popup, dialog abre e foco volta pro Mais", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_SEM_PEDIDO}`);

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    const itens = popup.getByRole("menuitem");
    await expect(itens).toHaveText([...ITENS]);

    // assert positivo do REALIZA-157: cada item é a linha inteira do popup —
    // p-1 do container desconta os 8px de respiro lateral. A medição é uma
    // evaluate só: o popup entra com zoom-in-95 (~150ms) e medir popup e
    // item em awaits separados lia dois scales da animação. Na mesma
    // chamada o scale cancela exato — 8·(1-s) nunca passa de 0.4px.
    const diffs = await popup.evaluate((el) =>
      [...el.querySelectorAll('[role="menuitem"]')].map((item) =>
        Math.abs(
          item.getBoundingClientRect().width -
            (el.getBoundingClientRect().width - 8)
        )
      )
    );
    expect(diffs).toHaveLength(ITENS.length);
    for (const d of diffs) expect(d).toBeLessThan(2);

    await popup
      .getByRole("menuitem", { name: "Enviar formulário" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(mais).toBeFocused();

    // reabrir mostra o mesmo menu — o estado dos dialogs não vaza
    await mais.click();
    await expect(popup.getByRole("menuitem")).toHaveCount(ITENS.length);
  });

  test("mentor: a primária é o registrar e o pedido mora só no card", async ({
    page,
  }) => {
    // d-t2c (Ricardo × Matheus): 2º realizado sem registro + pedido de
    // especialista 'aberta' no fixture — o header vende UMA ação e o
    // estado do pedido não se repete em chip, pill e menu
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_T2C}`);

    // a primária do mentor é o link pra rota de registro — o único
    // apelo visual do cabeçalho; o resto está no ⋯
    const registrar = page.getByRole("link", {
      name: "Registrar 2º encontro",
    });
    await expect(registrar).toBeVisible();

    // o estado do pedido em aberto mora no card da Agora — nem chip no
    // header nem item desabilitado no menu (review #9)
    await expect(
      page.locator('section[aria-labelledby="pedidos-abertos"]')
    ).toBeVisible();
    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    // com pedido em aberto a vaga está ocupada: "Solicitar" não é item —
    // e nenhum item desabilitado narra o estado (a ficha já conta no card)
    await expect(
      popup.getByRole("menuitem", { name: /Solicitar mentor especialista/ })
    ).toHaveCount(0);
    await expect(popup.locator('[role="menuitem"][aria-disabled="true"]')).toHaveCount(0);
    // as ações de segunda ordem do mentor estão lá
    await expect(
      popup.getByRole("menuitem", { name: "Pedir apoio" })
    ).toBeVisible();
    await expect(
      popup.getByRole("menuitem", { name: /especialista pro jovem/ })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("mentor DPP: próximo já marcado → ⋯ vende 'Remarcar Nº · data' e abre o dialog (REALIZA-509)", async ({
    page,
  }) => {
    // d-ok (Ricardo × Ana): o 5º agendado é na terça da semana (limbo a
    // partir de quarta) e o 6º na seguinte — sempre sobra um no futuro,
    // então a primária nunca é o agendar e o ⋯ carrega a remarcação já
    // rotulada com o slot ("Remarcar 6º · terça 24/11 às 19:00")
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}`);

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await expect(mais).toBeVisible();
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    // nº e data variam com o dia do run (5º ou 6º) — o que não muda é a
    // gramática "Remarcar Nº · <dia> <dd/mm> às <hh:mm>"
    const item = popup.getByRole("menuitem", {
      name: /^Remarcar \d+º · \S+ \d{2}\/\d{2} às \d{2}:\d{2}$/,
    });
    await expect(item).toBeVisible();

    await item.click();
    // o dialog mora fora do popup e já abre em modo remarcação
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /º encontro/ })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Confirmar remarcação/ })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("especialista: trilha com tentativa marcada → ⋯ vende 'Remarcar sessão' (REALIZA-509)", async ({
    page,
  }) => {
    // d-esp1 (Sofia × Ana): a tentativa nº4 tá agendada — a trilha não
    // cria row por aqui, só move a que existe; o rótulo é "sessão"
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto(`/duplas/${DUPLA_ESP1}`);

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await expect(mais).toBeVisible();
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    const item = popup.getByRole("menuitem", { name: "Remarcar sessão" });
    await expect(item).toBeVisible();

    await item.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "sessão de especialista" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
