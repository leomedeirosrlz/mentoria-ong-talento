import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-484 + spec 023 + REALIZA-525 — /jovem/pessoas virou o
// DIRETÓRIO do programa: default "Todos" (adultos com papel, jovens com
// conta e o catálogo de especialistas), busca e a rede dela marcada com
// selo. Os filtros saíram das pills expostas (estouravam o celular) pro
// painel único "Filtros" (525): vínculo e tema são rádios do modal,
// aplicados de uma vez com a contagem viva no gatilho. O card da rede
// abre o WhatsApp que a view já entrega — o mesmo dado da ficha, nunca
// um canal não-autorizado. A persona mentorado (Bia) cobre os cenários.

// o card do diretório navega por UM link nomeado (aria-label "Abrir
// perfil de …") — o nome acessível não se mistura com os chips
const cardDe = (page: import("@playwright/test").Page, nome: string) =>
  page.getByRole("link", { name: `Abrir perfil de ${nome}` });

const cardInteiroDe = (
  page: import("@playwright/test").Page,
  nome: string
) => cardDe(page, nome).locator("xpath=ancestor::*[@data-slot='card']");

const filtros = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^Filtros/ });

/** O gesto completo do painel: abre "Filtros", marca a opção pelo label
 *  (o rádio é sr-only — quem recebe o clique é a pill que o envolve, a
 *  mesma régua do login por senha) e aplica. Sheet no mobile e Dialog
 *  no desktop expõem o mesmo role="dialog". */
async function aplicarFaceta(
  page: import("@playwright/test").Page,
  nome: string
) {
  await filtros(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .locator("label", {
      has: page.getByRole("radio", { name: nome, exact: true }),
    })
    .click();
  await dialog.getByRole("button", { name: /^Aplicar/ }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("jovem — diretório Pessoas", () => {
  test("o diretório abre em Todos — a rede marcada e o programa inteiro", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");

    // default "Todos": nenhum filtro ativo (o gatilho não ganha contagem),
    // a contagem anunciada e a rede dela marcada no meio do programa
    await expect(filtros(page)).toHaveAccessibleName("Filtros");
    await expect(
      page.getByRole("status").filter({ hasText: /\d+ pessoas/ })
    ).toBeVisible();

    // a rede dela, dedup por pessoa (o Paulo supervisiona as 3 duplas) —
    // selo "Sua rede" + vínculo na voz dela
    await expect(cardDe(page, "Ricardo Tavares")).toBeVisible();
    await expect(cardDe(page, "Paulo Serra")).toHaveCount(1);
    await expect(cardDe(page, "Marina Duarte")).toBeVisible();
    await expect(
      cardDe(page, "Caio Henrique Oliveira")
    ).toBeVisible();
    await expect(cardDe(page, "Dandara Souza")).toBeVisible();
    await expect(page.getByText("Seu mentor")).toBeVisible();
    await expect(page.getByText("Sua rede").first()).toBeVisible();

    // programa inteiro por decisão (023): gente de fora da rede dela —
    // mentora de outra dupla e o catálogo completo, sem selo de rede
    await expect(cardDe(page, "Beatriz Lins")).toBeVisible();
    await expect(cardDe(page, "Marcos Vinícius")).toBeVisible();
    const beatriz = cardInteiroDe(page, "Beatriz Lins");
    await expect(beatriz.getByText("Sua rede")).toHaveCount(0);

    // REALIZA-525: o WhatsApp abre no card da rede — o mesmo canal da
    // ficha (mentor/colega com opt-in). mailto nunca viaja no diretório,
    // e quem não é da rede dela segue sem canal algum
    const main = page.getByRole("main");
    await expect(main.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(
      cardInteiroDe(page, "Ricardo Tavares").getByRole("link", {
        name: /Conversar com Ricardo Tavares no WhatsApp/,
      })
    ).toHaveAttribute("href", /wa\.me\/5511987654003/);
    await expect(
      cardInteiroDe(page, "Caio Henrique Oliveira").getByRole("link", {
        name: /Conversar com Caio Henrique Oliveira no WhatsApp/,
      })
    ).toHaveAttribute("href", /wa\.me\/5511976123002/);
    // Dandara é rede (colega) mas não compartilhou — sem botão
    await expect(
      cardInteiroDe(page, "Dandara Souza").locator('a[href*="wa.me"]')
    ).toHaveCount(0);
    await expect(beatriz.locator('a[href*="wa.me"]')).toHaveCount(0);
    // e o card do especialista da trilha dela também abre o canal
    await expect(
      cardInteiroDe(page, "Sofia Nogueira").getByRole("link", {
        name: /Conversar com Sofia Nogueira no WhatsApp/,
      })
    ).toHaveAttribute("href", /wa\.me\/5511987654004/);

    // "Minha rede" recorta sem recarregar — a URL registra o estado
    await aplicarFaceta(page, "Minha rede");
    await expect(page).toHaveURL(/\?papel=rede/);
    await expect(cardDe(page, "Ricardo Tavares")).toBeVisible();
    await expect(cardDe(page, "Sofia Nogueira")).toBeVisible();
    await expect(cardDe(page, "Helena Prado")).toBeVisible();
    await expect(cardDe(page, "Caio Henrique Oliveira")).toBeVisible();
    await expect(cardDe(page, "Beatriz Lins")).toHaveCount(0);
    await expect(cardDe(page, "Marcos Vinícius")).toHaveCount(0);

    // "Especialistas" abre o catálogo rico — a linha "Atende:" mora aqui
    await aplicarFaceta(page, "Especialistas");
    await expect(page).toHaveURL(/papel=especialistas/);
    await expect(cardDe(page, "Sofia Nogueira")).toBeVisible();
    await expect(cardDe(page, "Marcos Vinícius")).toBeVisible();
    await expect(cardDe(page, "Camila Ferraz")).toBeVisible();
    await expect(page.getByText(/Atende:/).first()).toBeVisible();
    await expect(cardDe(page, "Ricardo Tavares")).toHaveCount(0);
    // a especialista da trilha dela segue marcada mesmo na faceta
    const sofia = cardDe(page, "Sofia Nogueira").locator(
      "xpath=ancestor::*[@data-slot='card']"
    );
    await expect(sofia.getByText("Seu especialista")).toBeVisible();

    // busca dentro do recorte — contagem e URL acompanham
    await page.getByLabel("Buscar pessoa").fill("Sofia");
    await expect(cardDe(page, "Sofia Nogueira")).toBeVisible();
    await expect(cardDe(page, "Marcos Vinícius")).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: /1 de \d+/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/busca=Sofia/);
  });

  test("o painel Filtros aplica vínculo + tema num gesto — e a página nunca rola na horizontal", async ({
    page,
  }) => {
    // 390px: a largura que motivou a 525 — o FormSurface vira a folha de
    // rodapé (mesmo role=dialog) com as opções todas dentro da tela
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");

    // nenhuma régua de pills exposta — o diretório só tem a entrada Filtros
    await expect(
      page.getByRole("group", { name: "Filtrar por vínculo" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Filtrar por tema" })
    ).toHaveCount(0);
    // e a página não ganha scroll horizontal — o vazamento que as pills
    // causavam não volta por outro caminho
    const larguraOk = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    );
    expect(larguraOk).toBe(true);

    // a folha de rodapé abre com os dois fieldsets e o rascunho não
    // aplica até o "Aplicar" — o rádio é sr-only, quem clica é a pill
    await filtros(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: "Minha rede" })
    ).toBeAttached();
    await expect(
      dialog.getByRole("button", { name: "Aplicar" })
    ).toBeVisible();
    await dialog
      .locator("label", {
        has: page.getByRole("radio", { name: "Minha rede", exact: true }),
      })
      .click();
    await dialog
      .locator("label", {
        has: page.getByRole("radio", { name: /^matemática/ }),
      })
      .click();
    // rascunho ≠ aplicado: a URL e a contagem do gatilho só mudam no Aplicar
    await expect(page).not.toHaveURL(/papel=rede/);
    await dialog.getByRole("button", { name: "Aplicar (2)" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page).toHaveURL(/papel=rede/);
    await expect(page).toHaveURL(/area=matem/);
    await expect(filtros(page)).toHaveAccessibleName("Filtros, 2 ativos");
    // matemática dentro da rede dela = a especialista da trilha
    await expect(cardDe(page, "Sofia Nogueira")).toBeVisible();
    await expect(cardDe(page, "Ricardo Tavares")).toHaveCount(0);

    // o foco volta pro gatilho que abriu a folha — convenção do kit
    await expect(filtros(page)).toBeFocused();

    // "Limpar filtros" zera os dois de uma vez
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(filtros(page)).toHaveAccessibleName("Filtros");
    await expect(cardDe(page, "Ricardo Tavares")).toBeVisible();
  });

  test("ficha do mentor — origem do vínculo e os canais que a view já dá", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");
    await cardDe(page, "Ricardo Tavares").click();
    await page.waitForURL("**/jovem/pessoas/*");

    await expect(
      page.getByRole("heading", { name: "Ricardo Tavares", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Seu mentor", { exact: true })).toBeVisible();
    await expect(page.getByText("Turma 1")).toBeVisible();
    // mentor não é especialista — sem o bloco de projeção do catálogo
    await expect(
      page.getByRole("heading", { name: "Sobre" })
    ).toHaveCount(0);
    // os dois canais diretos que a jovem_contatos já entrega
    await expect(
      page.getByRole("link", { name: "ricardo.tavares@realiza.vc" })
    ).toHaveAttribute("href", "mailto:ricardo.tavares@realiza.vc");
    await expect(
      page.getByRole("link", { name: /Conversar com Ricardo Tavares/ })
    ).toHaveAttribute("href", /wa\.me\/5511987654003/);
    // nada coord-only: RG/CPF dos dados civis nunca chegam à view
    const html = await page.content();
    expect(html).not.toContain("28694751011");
    expect(html).not.toContain("41.208.776");
  });

  test("ficha da especialista da trilha — projeção pública + canal aberto", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");
    await cardDe(page, "Sofia Nogueira").click();
    await page.waitForURL("**/jovem/pessoas/*");

    await expect(
      page.getByRole("heading", { name: "Sofia Nogueira", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText("Seu especialista", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Turma 1")).toBeVisible();
    await expect(
      page.getByText("São Paulo · SP", { exact: true })
    ).toBeVisible();

    // o enriquecimento vem da jovem_especialistas: origem da trilha,
    // atuação, áreas, experiência e a janela em dia+período (nunca slot)
    const sobre = page.locator("section", {
      has: page.getByRole("heading", { name: "Sobre" }),
    });
    await expect(
      sobre.getByText(/Dificuldade em matemática/)
    ).toBeVisible();
    await expect(
      sobre.getByText("Professora de matemática · Colégio particular")
    ).toBeVisible();
    await expect(sobre.getByText("matemática").first()).toBeVisible();
    await expect(sobre.getByText(/há 10 anos/)).toBeVisible();
    await expect(sobre.getByText(/ter à noite · qui à noite/)).toBeVisible();

    // a trilha existe — o canal direto mora na seção Contato, não num
    // link de catálogo (que aqui nem aparece)
    await expect(
      page.getByRole("link", { name: "sofia.nogueira@realiza.vc" })
    ).toHaveAttribute("href", "mailto:sofia.nogueira@realiza.vc");
    await expect(
      page.getByRole("link", { name: /Conversar com Sofia Nogueira/ })
    ).toHaveAttribute("href", /wa\.me\/5511987654004/);
    await expect(
      page.getByRole("link", { name: /catálogo de especialistas/ })
    ).toHaveCount(0);
  });

  test("ficha de especialista fora da rede — catálogo sem canal direto", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    // Marcos só existe pra Bia via catálogo — a ficha resolve pela
    // jovem_especialistas (nada o linka, entra direto pela URL)
    await page.goto(
      "/jovem/pessoas/de000000-0000-4000-8000-000000000012"
    );

    await expect(
      page.getByRole("heading", { name: "Marcos Vinícius", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText("Mentor especialista", { exact: true })
    ).toBeVisible();
    const bloco = page.locator("section", {
      has: page.getByRole("heading", { name: "Especialista do programa" }),
    });
    await expect(
      bloco.getByText("Engenheiro de dados, professor em curso técnico aos sábados.")
    ).toBeVisible();
    await expect(bloco.getByText("tecnologia").first()).toBeVisible();
    await expect(bloco.getByText(/mural de especialistas/)).toBeVisible();
    // sem trilha: a nota explica o fechamento e a ficha aponta pra onde
    // o pedido acontece
    await expect(
      bloco.getByText(/contato direto abre quando a sua trilha/)
    ).toBeVisible();
    const link = bloco.getByRole("link", {
      name: "Ver no catálogo de especialistas",
    });
    await expect(link).toHaveAttribute("href", "/jovem/especialistas");

    // nada de canal direto nem campo fora da projeção pública
    await expect(
      page.getByRole("heading", { name: "Contato" })
    ).toHaveCount(0);
    const main = page.getByRole("main");
    await expect(main.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(main.locator('a[href*="wa.me"]')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain("marcosvinicius"); // linkedin
    expect(html).not.toContain("termo-marcos"); // documento_path
    expect(html).not.toContain("5511987654012"); // whatsapp dele
    expect(html).not.toContain("marcos.vinicius@realiza.vc");
  });

  test("ficha da colega — whatsapp só atrás do opt-in dela", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");

    // Caio compartilhou — o link de WhatsApp aparece na ficha dele
    await cardDe(page, "Caio Henrique Oliveira").click();
    await page.waitForURL("**/jovem/pessoas/*");
    await expect(
      page.getByRole("heading", {
        name: "Caio Henrique Oliveira",
        level: 1,
      })
    ).toBeVisible();
    await expect(
      page.getByText("Colega da turma", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Turma 1")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Conversar no WhatsApp/ })
    ).toHaveAttribute("href", /wa\.me\/5511976123002/);
    // as notas da ficha do Caio são coord-only — nunca renderizam
    expect(await page.content()).not.toContain("tímido no primeiro contato");

    // Dandara não compartilhou — a ficha mostra a explicação, sem botão
    await page.goto("/jovem/pessoas");
    await cardDe(page, "Dandara Souza").click();
    await page.waitForURL("**/jovem/pessoas/*");
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
    await expect(
      page.getByText(/Ainda não compartilhou o contato/)
    ).toBeVisible();
  });

  test("id fora das projeções cai no mesmo 404 de quem não existe", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(
      "/jovem/pessoas/de000000-0000-4000-8000-ffffffffffff"
    );
    await expect(page.getByText("Página não encontrada")).toBeVisible();
  });
});
