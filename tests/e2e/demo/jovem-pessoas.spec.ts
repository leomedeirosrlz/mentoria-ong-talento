import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-484 — Pessoas é a REDE do jovem (mentor, especialista das
// trilhas, supervisão, coordenação, colegas), nunca um segundo catálogo:
// a seção de especialistas aponta pra /jovem/especialistas em vez de
// repetir os cards. A ficha enriquece com a projeção pública que as views
// já liberam — bio/áreas/experiência/janela do especialista e a origem
// do vínculo — sem abrir leitura em profiles. A persona mentorado (Bia)
// cobre os quatro cenários: contato com canal aberto, especialista da
// própria trilha, especialista que ela só conhece do catálogo e colega.

const secao = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`section[aria-labelledby="${id}-titulo"]`);

// a linha da pessoa leva à ficha — o hasText a isola dos botões de
// e-mail/WhatsApp da mesma linha (aria-label também carrega o nome)
const fichaDe = (
  page: import("@playwright/test").Page,
  secaoId: string,
  nome: string
) =>
  secao(page, secaoId)
    .locator('a[href^="/jovem/pessoas/"]')
    .filter({ hasText: nome });

test.describe("jovem — diretório Pessoas", () => {
  test("a rede agrupada por vínculo + Conhecer especialistas pro catálogo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");

    // a rede dela, um grupo por vínculo — nenhum card de catálogo
    const mentoria = secao(page, "mentoria");
    await expect(mentoria.getByText("Ricardo Tavares")).toBeVisible();
    const especialistas = secao(page, "especialistas");
    await expect(especialistas.getByText("Sofia Nogueira")).toBeVisible();
    await expect(especialistas.getByText("Helena Prado")).toBeVisible();
    await expect(
      especialistas.getByText("trilha concluída")
    ).toBeVisible();
    const supervisao = secao(page, "supervisao");
    // o Paulo supervisiona as 3 duplas — o diretório deduplica por pessoa
    await expect(supervisao.getByText("Paulo Serra")).toHaveCount(1);
    await expect(
      secao(page, "coordenacao").getByText("Marina Duarte")
    ).toBeVisible();
    const colegas = secao(page, "colegas");
    await expect(colegas.getByText("Caio Henrique Oliveira")).toBeVisible();
    await expect(colegas.getByText("Dandara Souza")).toBeVisible();

    // o catálogo rico NÃO se duplica aqui: sem CTA de pedido nem a
    // linha "Atende:" dos cards — só o link pro destino
    await expect(
      page.getByRole("button", { name: "Pedir trilha" })
    ).toHaveCount(0);
    await expect(page.getByText(/Atende:/)).toHaveCount(0);
    const link = especialistas.getByRole("link", {
      name: "Conhecer especialistas",
    });
    await expect(link).toHaveAttribute("href", "/jovem/especialistas");
    await link.click();
    await page.waitForURL("**/jovem/especialistas");
    await expect(
      page.getByRole("heading", { name: "Especialistas", level: 1 })
    ).toBeVisible();
  });

  test("ficha do mentor — origem do vínculo e os canais que a view já dá", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pessoas");
    await fichaDe(page, "mentoria", "Ricardo Tavares").click();
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
    await fichaDe(page, "especialistas", "Sofia Nogueira").click();
    await page.waitForURL("**/jovem/pessoas/*");

    await expect(
      page.getByRole("heading", { name: "Sofia Nogueira", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText("Seu especialista", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Turma 1")).toBeVisible();
    await expect(page.getByText("São Paulo · SP")).toBeVisible();

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
      "/jovem/pessoas/de000000-0000-4000-8000-00000000000c"
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
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
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
    await fichaDe(page, "colegas", "Caio Henrique Oliveira").click();
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
    await fichaDe(page, "colegas", "Dandara Souza").click();
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
