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
const TOK_360_ANA = "demo-tok-360-ana-00000001";
// fMetas (uid 0x4008 → decimal) — a régua não tem link pendente em demo,
// a cobertura do fill-form de Metas vai pela prévia da ficha do form
const URL_METAS = "/formularios/de000000-0000-4000-8000-000000016392";

// REALIZA-442, reescrita na 010 — gramática pergunta→resposta em TODAS
// as superfícies: o nº da régua é texto no verde da marca (--ok-text),
// sem disco; o enunciado lê em primeiro plano e a resposta idem.
// Seletores estáveis: data-numero-pergunta pro número e a substring do
// atributo class pro primeiro plano
const NUMERO = "[data-numero-pergunta]";
const FG = '[class*="text-foreground"]';

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
    // a ficha de meta lê "Meta N" em texto — o número da régua fica nas
    // perguntas, não duplicado no rótulo da ficha
    const meta1 = dialog.locator("li", { hasText: "Meta 1" }).first();
    await expect(
      meta1.getByText("Meta 1", { exact: true })
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
    // clique-resiliente: a ilha do emitir pode ainda estar hidratando
    // quando o botão SSR já aparece — repete até o toast demo subir.
    // O escopo é a linha do instrumento (Matheus tem vários "Gerar link")
    await expect(async () => {
      await sec
        .locator("li", { hasText: "Definindo Minhas Metas" })
        .getByRole("button", { name: "Gerar link" })
        .click();
      await expect(page.getByText(/Modo demonstração/)).toBeVisible({
        timeout: 1500,
      });
    }).toPass();
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

    // hierarquia 010: 1ª e 5ª perguntas da régua com o nº verde em texto
    // e enunciado em primeiro plano — a declaração (6ª) troca o nº pelo
    // ícone, mas veste a mesma cor de texto
    const filme = page.locator('[data-campo="filme"]');
    await expect(
      filme.locator(NUMERO, { hasText: "1" }).first()
    ).toBeVisible();
    await expect(filme.locator("label").first()).toHaveClass(
      /text-foreground/
    );
    const valoriza = page.locator('[data-campo="valoriza"]');
    await expect(
      valoriza.locator(NUMERO, { hasText: "5" }).first()
    ).toBeVisible();
    const declaracao = page.locator('[data-campo="declaracao_visao"]');
    await expect(declaracao.locator(NUMERO)).toHaveCount(0);
    await expect(
      declaracao.locator("label").first()
    ).toHaveClass(/text-foreground/);
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

    // hierarquia 010: cada área é um slider com o nº verde da régua e o
    // rótulo em primeiro plano; a reflexão segue a numeração (a 17ª)
    const saude = page.locator('[data-campo="p_saude"]');
    await expect(saude).toHaveAttribute("aria-label", /1\. Saúde/);
    await expect(
      saude.locator(NUMERO, { hasText: "1" }).first()
    ).toBeVisible();
    await expect(
      saude.locator("span", { hasText: "Saúde e disposição" })
    ).toHaveClass(/text-foreground/);
    const reflexao = page.locator('[data-campo="reflexao"]');
    await expect(
      reflexao.locator(NUMERO, { hasText: "17" }).first()
    ).toBeVisible();
    await expect(reflexao.locator(FG).first()).toBeVisible();
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

    // só a linha da dupla em foco renderiza — o separador do aria-label
    // ("Duplas: título") variou no passe de copy; a regex tolera a
    // pontuação e ancora no título
    const sec = page.getByRole("region", {
      name: /^Duplas\s*[:—–-]\s*Roda da Vida · leitura inicial$/,
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
      name: /^Duplas\s*[:—–-]\s*Roda da Vida · leitura inicial$/,
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
      name: /^Duplas\s*[:—–-]\s*Construindo a sua Visão$/,
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
    // a leitura repete a gramática da escrita: nº verde em texto +
    // enunciado em primeiro plano na 1ª pergunta da régua
    const primeira = linha.locator("ol li").first();
    await expect(
      primeira.locator(NUMERO, { hasText: "1" })
    ).toBeVisible();
    await expect(primeira.locator("p").first()).toHaveClass(
      /text-foreground/
    );
  });

  // REALIZA-442 (escopo corrigido) — Metas não tem link pendente em demo:
  // a cobertura do fill-form vai pela prévia da ficha, que renderiza o
  // próprio InstrumentoFlow
  test("prévia da Metas: ficha Meta N e enunciados em primeiro plano", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(URL_METAS);
    await page.getByRole("button", { name: "Pré-visualizar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // ficha Meta 1: o N mora no título "Meta 1" (sem número duplicado),
    // os rótulos dos campos leem em primeiro plano
    const ficha = dialog.locator("article", { hasText: "Meta 1" }).first();
    await expect(
      ficha.getByRole("heading", { name: "Meta 1" })
    ).toBeVisible();
    const meta1 = dialog.locator('[data-campo="meta_1"]');
    await expect(meta1.locator("label")).toHaveClass(/text-foreground/);
    // preciso_* são perguntas soltas da régua — a 2ª vem logo depois da
    // declaração (1ª): nº verde em texto com o número da régua
    const preciso = dialog.locator('[data-campo="preciso_criar"]');
    await expect(
      preciso.locator(NUMERO, { hasText: "2" })
    ).toBeVisible();
    await expect(preciso.locator("label")).toHaveClass(/text-foreground/);
  });

  // o 360º é form oficial fora da régua: cai no renderer genérico —
  // mesma gramática por campos comuns (escala, multi_select, select)
  test("/f/<token>: 360º genérico numera perguntas em verde e enunciados em primeiro plano", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_360_ANA}`);
    await expect(
      page.getByRole("heading", { name: /Avaliação Geral de Mentorados/ })
    ).toBeVisible();
    // o genérico é um wizard por seção — a régua numera só perguntas
    // visíveis (a condicional "quais mudanças" fica oculta até o "sim")
    await expect(
      page.getByText("Atingimento das expectativas")
    ).toBeVisible();

    // 1ª e 2ª perguntas (escala 1–5 + multi_select): fieldset com o nº
    // verde + legend em primeiro plano
    const expectativa = page.locator('[data-campo="expectativa_atendida"]');
    await expect(
      expectativa.locator(NUMERO, { hasText: "1" })
    ).toBeVisible();
    await expect(expectativa.locator("legend " + FG)).toBeVisible();
    const expectativas = page.locator('[data-campo="expectativas"]');
    await expect(
      expectativas.locator(NUMERO, { hasText: "2" })
    ).toBeVisible();
    await expect(expectativas.locator("legend " + FG)).toBeVisible();

    // responde a etapa 1 e avança — a numeração atravessa a seção sem
    // reiniciar: a 1ª pergunta do processo é a 3ª da régua. O radio da
    // escala é sr-only: o clique real é no label que o embrulha
    await expectativa
      .locator("label", { hasText: /^4$/ })
      .click();
    await page
      .getByRole("checkbox", { name: "Desenvolvimento profissional" })
      .check();
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(
      page.getByText("Avaliação do processo de mentoria")
    ).toBeVisible();
    const estrutura = page.locator('[data-campo="estrutura_programa"]');
    await expect(
      estrutura.locator(NUMERO, { hasText: "3" })
    ).toBeVisible();
    await expect(estrutura.locator(FG).first()).toBeVisible();
  });
});
