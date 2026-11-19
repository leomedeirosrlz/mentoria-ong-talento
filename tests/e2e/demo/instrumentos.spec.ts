import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-117 no modo demo — os quatro instrumentos oficiais da jornada DPP
// (0080) viram formulários nativos. A dupla d-ok (Ricardo × Ana) tem visão,
// metas, PDM e a roda inicial respondidos (WP7 — fixture "jornada
// completa"); a dupla do João Pedro
// (Eduardo) tem links pendentes pra exercitar o /f/<token> público com os
// novos tipos (secao + escala_1_10). Sem writes — spec demo segura.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana
// Luiza × Isabela (concluída): o uid() do dataset formata o literal
// 0x0605 em DECIMAL ("1541") — "…000605" é um id inexistente e a ficha
// dele caía no 404, fazendo o teste abaixo passar no vazio
const DUPLA_FIM = "de000000-0000-4000-8000-000000001541";
const DUPLA_MATHEUS = "de000000-0000-4000-8000-000000001549"; // Ricardo × Matheus
const TOK_VISAO_EDUARDO = "demo-tok-visao-eduardo-00001";
const TOK_RODA_EDUARDO = "demo-tok-roda-eduardo-000001";

test.describe("demo — instrumentos oficiais da jornada", () => {
  test("ficha da dupla: status por instrumento + resultado estruturado", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    // a ficha virou abas por URL: instrumentos/PDM/terceiros/voz do jovem
    // moram em ?aba=instrumentos
    await page.goto(`/duplas/${DUPLA_OK}?aba=instrumentos`);

    const sec = page.locator("section", {
      hasText: "Instrumentos da jornada",
    });
    await expect(sec.getByText("Construindo a sua Visão")).toBeVisible();
    await expect(sec.getByText("Definindo Minhas Metas")).toBeVisible();
    await expect(sec.getByText("Roda da Vida")).toBeVisible();

    // cinco respondidos — a roda inicial da Ana entrou na WP7 (fixture
    // "jornada completa"), fechando visão/metas/PDM/roda/checklist 0190
    await expect(sec.getByText("respondido", { exact: true })).toHaveCount(5);
    await expect(
      sec.getByRole("button", { name: "Ver resposta" }).first()
    ).toBeVisible();

    // resultado estruturado do PDM — metas com indicador/prazo/submeta,
    // não o dump campo-a-campo. O filtro é pelo título completo: os guias
    // de "Como conduzir" da Visão/Metas citam "PDM" no texto e casariam
    // num hasText solto
    const pdm = sec.locator("li", {
      hasText: "Plano de Desenvolvimento do Mentorado",
    });
    const dialog = page.getByRole("dialog");
    // clique-resiliente: a ilha do diálogo pode ainda estar hidratando
    // quando o botão SSR já aparece — repete até o dialog abrir (mesmo
    // padrão do assistente.spec.ts)
    await expect(async () => {
      await pdm.getByRole("button", { name: "Ver resposta" }).click();
      await expect(dialog).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(dialog.getByText("Declaração de Visão")).toBeVisible();
    await expect(dialog.getByText(/Indicador:/).first()).toBeVisible();
    await expect(
      dialog.getByText(/Desdobramento da meta/).first()
    ).toBeVisible();
  });

  test("mentor da dupla: seção visível, enviar responde toast demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    // Matheus: visão respondida + roda pendente — metas/PDM seguem
    // "não enviado", que é onde o Enviar vive (aba Instrumentos da ficha)
    await page.goto(`/duplas/${DUPLA_MATHEUS}?aba=instrumentos`);

    const sec = page.locator("section", {
      hasText: "Instrumentos da jornada",
    });
    await expect(sec.getByText("Definindo Minhas Metas")).toBeVisible();
    await sec.getByRole("button", { name: "Gerar link" }).first().click();
    await expect(page.getByText(/Modo demonstração/)).toBeVisible();
  });

  test("/f/<token>: visão numera só perguntas e mostra seções", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_VISAO_EDUARDO}`);
    await expect(
      page.getByRole("heading", { name: /Construindo a sua Visão/ })
    ).toBeVisible();
    await expect(page.getByText(/Instrumento oficial/)).toBeVisible();
    // 8 campos na definição, 6 são perguntas — 2 'secao' não contam
    await expect(page.getByText(/6 perguntas/)).toBeVisible();
    await expect(page.getByText("Antes de responder")).toBeVisible();
    await expect(
      page.getByText("Sua Declaração de Visão", { exact: true })
    ).toBeVisible();
  });

  // dupla fechada = jornada congelada: ninguém emite, copia ou manda link
  // de instrumento — só lê. O pin trava a decisão REALIZA-151 (o gating
  // vive só no JSX: sem spec, regredir não quebra nada)
  test("dupla concluída não oferece ação de emissão de instrumento", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    // a seção segue visível pra leitura na aba Instrumentos — o que morre
    // são as ações de link (jornada congelada), não o histórico
    await page.goto(`/duplas/${DUPLA_FIM}?aba=instrumentos`);

    const sec = page.locator("section", {
      hasText: "Instrumentos da jornada",
    });
    // pin anti-vácuo: a seção renderiza de verdade (os 4 instrumentos
    // aparecem) antes de medir a ausência de ações
    await expect(sec.getByText("Construindo a sua Visão")).toBeVisible();
    await expect(sec.getByText("Roda da Vida")).toBeVisible();
    await expect(
      sec.getByRole("button", { name: "Gerar link" })
    ).toHaveCount(0);
    await expect(
      sec.getByRole("button", { name: /Copiar link/ })
    ).toHaveCount(0);
    await expect(
      sec.getByRole("link", { name: /WhatsApp/ })
    ).toHaveCount(0);
    // o menu "Mais" também não oferece "Enviar formulário" em dupla fechada
    const mais = page.getByRole("button", { name: "Mais" });
    if (await mais.count()) {
      await mais.click();
      await expect(
        page.getByRole("menuitem", { name: /Enviar formulário/ })
      ).toHaveCount(0);
    }
  });

  test("/f/<token>: roda da vida com quadrantes e escala 1–10", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_RODA_EDUARDO}`);
    await expect(
      page.getByRole("heading", { name: /Roda da Vida/ })
    ).toBeVisible();
    // os 4 quadrantes são seções — visíveis, mas fora da contagem
    for (const q of [
      "Pessoal",
      "Profissional",
      "Relacionamentos",
      "Qualidade de vida",
    ])
      await expect(
        page.getByRole("heading", { name: q, exact: true })
      ).toBeVisible();
    // 16 áreas (escala 1–10) + reflexão final — seções não contam
    await expect(page.getByText(/17 perguntas/)).toBeVisible();
    await expect(page.getByText("Nada satisfeito").first()).toBeVisible();
    await expect(page.getByText("Muito satisfeito").first()).toBeVisible();
  });

  // REALIZA-440/441 — a página por instrumento do mentor: o seletor de
  // mentorado filtra por ?dupla= (a régua linka a dupla em foco), a linha
  // já resume o resultado e "Ver resposta" expande a leitura completa
  test("página por instrumento (mentor): seletor filtra e resumo abre resposta", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/materiais/instrumentos/roda_inicial?dupla=${DUPLA_OK}`);

    // o seletor repete o padrão da régua + "Todas" — a lista inteira é o
    // default sem filtro
    const seletor = page.getByRole("navigation", {
      name: "Filtrar por mentorado",
    });
    await expect(
      seletor.getByRole("link", { name: "Todas", exact: true })
    ).toBeVisible();
    await expect(
      seletor.getByRole("link", { name: "Bia", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      seletor.getByRole("link", { name: "Matheus Gonçalves", exact: true })
    ).toBeVisible();

    // só a linha da dupla em foco renderiza
    const sec = page.getByRole("region", {
      name: "Duplas — Roda da Vida · leitura inicial",
    });
    const linha = sec.locator("li", { hasText: "Bia" });
    await expect(linha).toBeVisible();
    await expect(sec.locator("li", { hasText: "Matheus" })).toHaveCount(0);

    // o resumo já conta o resultado antes de abrir: a mini-roda com a
    // média (o mesmo desenho que a pessoa preencheu). O 1º "Média geral"
    // é o do resumo — o do resultado expandido já existe no painel oculto
    await expect(
      linha.getByRole("img", { name: /Roda da Vida: média/ })
    ).toBeVisible();
    await expect(linha.getByText(/Média geral/).first()).toBeVisible();

    // "Ver resposta" expande a leitura completa e vira "Fechar resposta"
    const gatilho = linha.getByRole("button", { name: /resposta/ });
    const painelId = await gatilho.getAttribute("aria-controls");
    // clique-resiliente: o toggle é ilha client — repete até abrir
    await expect(async () => {
      await gatilho.click();
      await expect(
        linha.getByRole("button", { name: "Fechar resposta" })
      ).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(
      linha.locator("ul li", { hasText: "Carreira e trabalho" })
    ).toBeVisible();
    await linha.getByRole("button", { name: "Fechar resposta" }).click();
    // o painel animado colapsa — o conteúdo segue no DOM mas some da tela
    await expect(page.locator(`[id="${painelId}"]`)).toBeHidden();
    await expect(
      linha.getByRole("button", { name: "Ver resposta" })
    ).toHaveAttribute("aria-expanded", "false");

    // "Todas" devolve a lista inteira
    await seletor.getByRole("link", { name: "Todas", exact: true }).click();
    await expect(page).toHaveURL("/materiais/instrumentos/roda_inicial");
    await expect(sec.locator("li", { hasText: "Matheus" })).toBeVisible();
  });

  // staff: a resposta carrega sob demanda — mesmo gatilho/gramática do
  // toggle do mentor (REALIZA-441)
  test("página por instrumento (coord): Ver resposta carrega sob demanda", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais/instrumentos/roda_inicial");

    const sec = page.getByRole("region", {
      name: "Duplas — Roda da Vida · leitura inicial",
    });
    const linha = sec.locator("li", { hasText: "Bia" });
    // clique-resiliente: a ilha lazy pode ainda estar hidratando
    await expect(async () => {
      await linha.getByRole("button", { name: "Ver resposta" }).click();
      await expect(
        linha.getByRole("button", { name: "Fechar resposta" })
      ).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(
      linha.getByRole("button", { name: "Fechar resposta" })
    ).toBeVisible();
    // a roda desenhada chega com o payload lazy
    await expect(
      linha.getByRole("img", { name: /Roda da Vida: média/ }).first()
    ).toBeVisible();
  });

  // REALIZA-442 — a visão resume a declaração na linha e a narrativa lê
  // com hierarquia própria (perguntas numeradas, resposta em primeiro
  // plano)
  test("página por instrumento (mentor): visão resume a declaração e abre a narrativa", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/materiais/instrumentos/visao?dupla=${DUPLA_OK}`);

    const sec = page.getByRole("region", {
      name: "Duplas — Construindo a sua Visão",
    });
    const linha = sec.locator("li", { hasText: "Bia" });
    // a declaração já aparece na linha (resumo) antes de abrir — o 1º
    // blockquote é o da linha; o hero do resultado mora no painel oculto
    await expect(linha.locator("blockquote").first()).toBeVisible();

    // clique-resiliente: o toggle é ilha client — repete até abrir
    await expect(async () => {
      await linha.getByRole("button", { name: "Ver resposta" }).click();
      await expect(
        linha.getByRole("button", { name: "Fechar resposta" })
      ).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(linha.getByText("Declaração de Visão")).toBeVisible();
    await expect(linha.getByText("O filme da vida ideal")).toBeVisible();
    // as 5 perguntas da narrativa numeradas — a primeira do fixture da Ana
    await expect(linha.locator("ol li").first()).toBeVisible();
    await expect(
      linha.getByText(/Narre as cenas desse filme/)
    ).toBeVisible();
    await expect(
      linha.getByText(/No filme eu me vejo formada/)
    ).toBeVisible();
  });
});
