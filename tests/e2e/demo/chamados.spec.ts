import { entrarNaDemo, expect, test } from "../helpers";

// 0084 — chamados unificados no modo demo: a fila da equipe e os "meus
// pedidos" do autor saem do mesmo dataset. Sem writes — spec demo seguro
// em qualquer ambiente, produção inclusa.

const CH_REGISTRO = "de000000-0000-4000-8000-000000022569"; // CHA-000141
const CH_JOVEM = "de000000-0000-4000-8000-000000022570"; // CHA-000142
const CH_AGENDA = "de000000-0000-4000-8000-000000022571"; // CHA-000143
const CH_PLATAFORMA = "de000000-0000-4000-8000-000000022572"; // CHA-000144
const CH_RESOLVIDO = "de000000-0000-4000-8000-000000022557"; // CHA-000129

test.describe("demo — chamados (WP1)", () => {
  test("coordenação vê a fila inteira e a conversa com internos", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/chamados");

    await expect(
      page.getByRole("heading", { name: "Chamados", level: 1 })
    ).toBeVisible();
    // a fila: os dois nascidos de flag (registro da Fernanda + pedido do
    // Caio) e o de plataforma da Ana — nada mascarado pra coord. A linha
    // mostra assunto + autor/contexto; o número fica na busca e no detalhe
    const fila = page.getByRole("region", { name: "Fila de chamados" });
    await expect(
      fila.getByText("Pedido de apoio no registro — 2º encontro")
    ).toBeVisible();
    await expect(
      fila.getByText("Preciso de ajuda — avaliação do 4º encontro")
    ).toBeVisible();
    await expect(
      fila.getByText("Não consigo anexar a foto do combinado")
    ).toBeVisible();
    await expect(fila.getByText("CHA-000141")).toHaveCount(0);

    // escala semântica: sem dono em vermelho, atendimento em âmbar com o
    // dono — a cor mora na pill, não no card; urgência com rótulo
    await expect(fila.getByText("Sem dono").first()).toBeVisible();
    await expect(fila.getByText("Com você").first()).toBeVisible();
    await expect(fila.getByText("Com Paulo").first()).toBeVisible();
    await expect(fila.getByText("Urgência").first()).toBeVisible();

    // abas de recorte; resolvidos e categoria moram no popover "Filtros"
    const abas = page.getByRole("tablist", { name: "Recorte da fila" });
    await expect(abas.getByRole("tab", { name: /^Sem dono/ })).toBeVisible();
    await expect(abas.getByRole("tab", { name: /^Todos/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(fila.getByText("O roteiro do encontro 4 não abria no app")).toHaveCount(0);
    await page.getByRole("button", { name: "Filtros" }).click();
    const pop = page.locator('[data-slot="popover-content"]');
    await expect(pop.getByText("Categoria")).toBeVisible();
    await pop.getByRole("switch").click();
    await expect(
      fila.getByText("O roteiro do encontro 4 não abria no app")
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // a busca ainda acha pelo número
    await page.getByRole("searchbox", { name: /Buscar/ }).fill("CHA-000142");
    await expect(
      fila.getByText("Preciso de ajuda — avaliação do 4º encontro")
    ).toBeVisible();
    await expect(
      fila.getByText("Não consigo anexar a foto do combinado")
    ).toHaveCount(0);

    // detalhe do chamado do jovem: contexto da avaliação + pedido original
    // como primeira mensagem + evento de sistema + nota interna da Marina
    await page.goto(`/chamados?c=${CH_JOVEM}`);
    const detalhe = page.getByRole("article");
    await expect(detalhe.getByText("CHA-000142")).toBeVisible();
    await expect(
      detalhe.getByText(/Avaliação do \d+º encontro/)
    ).toBeVisible();
    await expect(
      detalhe.getByText(/a gente trocou o tema na hora/)
    ).toBeVisible();
    await expect(
      detalhe.getByRole("button", { name: "Assumir" })
    ).toBeVisible();
    await expect(
      page.getByText(/marcou “preciso de ajuda” na avaliação/)
    ).toBeVisible();
    await expect(
      page.getByText(/Caso sensível — o comentário do Caio/)
    ).toBeVisible();

    // o chamado de registro cruza com a flag — contexto do encontro na linha
    await page.goto(`/chamados?c=${CH_REGISTRO}`);
    await expect(
      page.getByText(/o mentor marcou “preciso de apoio” no registro/)
    ).toBeVisible();
    await expect(
      page.getByText(/cruza com o risco da dupla/)
    ).toBeVisible();
  });

  test("auxiliar executivo vê a fila com plataforma mascarada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/chamados");

    // linha de plataforma chega mascarada: categoria e idade sim, conteúdo não
    const linhaPlataforma = page
      .getByRole("region", { name: "Fila de chamados" })
      .locator("li", { hasText: "Restrito à coordenação" });
    await expect(linhaPlataforma).toHaveCount(1);
    await expect(linhaPlataforma.getByText(/Plataforma/)).toBeVisible();
    await expect(
      page.getByText("Não consigo anexar a foto do combinado")
    ).toHaveCount(0);

    // e o detalhe mantém a máscara — sem autor, sem assunto, sem trilha.
    // ("Ana Beatriz" aparece na fila como dupla de OUTROS chamados — a
    // máscara cobre só o CHA-000144: autor, evento de sistema e anexo.)
    await page.goto(`/chamados?c=${CH_PLATAFORMA}`);
    await expect(
      page.getByText("Chamados de plataforma ficam só com a coordenação.")
    ).toBeVisible();
    await expect(page.getByRole("article").getByText("CHA-000144")).toBeVisible();
    await expect(linhaPlataforma.getByText(/Ana Beatriz/)).toHaveCount(0);
    await expect(
      page.getByText("Chamado aberto por Ana Beatriz Silva.")
    ).toHaveCount(0);
    await expect(page.getByText("print-do-erro.png")).toHaveCount(0);
    await expect(page.getByText(/Autor: /)).toHaveCount(0);

    // o chamado atribuído ao Paulo (persona supervisor) aparece no "Meus"
    // (a aba mostra a contagem — nome acessível é "Meus N")
    await page.goto("/chamados");
    await page.getByRole("tab", { name: /^Meus/ }).click();
    await expect(
      page.getByText("Guia do encontro 7: adaptar o roteiro pra dupla online")
    ).toBeVisible();
    await expect(
      page.getByText("Pedido de apoio no registro — 2º encontro")
    ).toHaveCount(0);
  });

  test("mentor vê só os próprios chamados — nada interno, nada do jovem", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/chamados");

    await expect(
      page.getByRole("heading", { name: "Meus chamados", level: 1 })
    ).toBeVisible();
    // os dois dele: o de agenda em atendimento e o antigo resolvido
    await expect(
      page.getByText("Trocar o encontro de terça pra quinta nas próximas duas semanas")
    ).toBeVisible();
    await expect(
      page.getByText("O roteiro do encontro 4 não abria no app")
    ).toBeVisible();
    // privacidade do canal do jovem: o chamado do Caio é da DUPLA do
    // mentor Carlos, não do Ricardo — e mesmo assim dupla_id não abre acesso
    await expect(
      page.getByText("Preciso de ajuda — avaliação do 4º encontro")
    ).toHaveCount(0);
    await expect(
      page.getByText("Pedido de apoio no registro — 2º encontro")
    ).toHaveCount(0);

    // detalhe: trilha pública (a resposta da Marina) sem o comentário interno
    await page.goto(`/chamados?c=${CH_AGENDA}`);
    await expect(
      page.getByText(/Conversei com a Ana — quinta funciona/)
    ).toBeVisible();
    await expect(page.getByText(/Remarcação simples/)).toHaveCount(0);
    // o detalhe substitui a lista do autor, com caminho de volta
    await expect(
      page.getByRole("region", { name: "Seus chamados" })
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Voltar para a lista" })
    ).toBeVisible();
    // pill do autor: quem está cuidando em vez de jargão de fila
    await expect(
      page.getByRole("article").getByText("Marina está cuidando")
    ).toBeVisible();
  });

  test("coordenação marca colega com @ autocomplete e vira chip", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/chamados?c=${CH_REGISTRO}`);

    // o composer da equipe abre no modo interno (vazar nota não tem volta)
    const campo = page.getByRole("textbox", { name: "Nota interna" });
    await expect(campo).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Nota interna" })
    ).toHaveAttribute("aria-checked", "true");

    // "@" abre o listbox com a equipe (demo: Marina é a persona logada —
    // sobram Paulo e Beatriz pra marcar; "você" aparece desabilitado)
    await campo.fill("vou conversar com o @");
    const lista = page.getByRole("listbox", { name: "Marcar alguém da equipe" });
    await expect(lista).toBeVisible();
    await expect(
      lista.getByRole("option", { name: /Paulo Serra/ })
    ).toBeVisible();
    await expect(
      lista.getByRole("option", { name: /Beatriz Lins/ })
    ).toBeVisible();
    await expect(
      lista.getByRole("option", { name: /Marina Duarte/ })
    ).toHaveAttribute("aria-disabled", "true");

    // filtro por prefixo: "@pau" deixa só o Paulo; Enter marca
    await campo.fill("vou conversar com o @pau");
    await expect(
      lista.getByRole("option", { name: /Beatriz/ })
    ).toHaveCount(0);
    await campo.press("Enter");
    await expect(lista).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Remover marcação de Paulo Serra" })
    ).toBeVisible();
    await expect(page.getByText("1 pessoa será notificada no app")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Salvar nota" })
    ).toBeEnabled();

    // remover o chip tira o token do texto
    await page
      .getByRole("button", { name: "Remover marcação de Paulo Serra" })
      .click();
    await expect(
      page.getByText("1 pessoa será notificada no app")
    ).toHaveCount(0);
    await expect(campo).not.toHaveValue(/@Paulo/);
  });

  test("anexo escolhido fica pendente com nome e dá pra remover", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/chamados?c=${CH_REGISTRO}`);

    // demo não grava — mas o estado pendente do composer é client-side:
    // thumb/tamanho/visibilidade aparecem antes de qualquer upload
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "print-do-erro-na-tela-de-registro-enorme.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    const pendente = page
      .getByRole("list", { name: "Anexos a enviar" })
      .locator("li");
    await expect(pendente).toHaveCount(1);
    await expect(pendente).toContainText("print-do-erro");
    await expect(pendente).toContainText("só a equipe vê");

    // modo público muda a visibilidade da legenda e o destino do envio
    await page.getByRole("radio", { name: "Responder a Fernanda" }).click();
    await expect(pendente).toContainText("o autor também vê");
    await expect(
      page.getByRole("button", { name: "Enviar a Fernanda" })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Remover anexo print-do-erro/ })
      .click();
    await expect(pendente).toHaveCount(0);
  });

  test("mentor não tem menções nem composer interno", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/chamados?c=${CH_AGENDA}`);

    const campo = page.getByRole("textbox", { name: "Mensagem para a equipe" });
    await expect(campo).toBeVisible();
    // "@" não abre nada pro autor — menção é instrumento da equipe
    await campo.fill("a Ana disse que @alguem avisa");
    await expect(
      page.getByRole("listbox", { name: "Marcar alguém da equipe" })
    ).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Nota interna" })).toHaveCount(0);
    await expect(page.getByText(/interna?\b/i)).toHaveCount(0);
  });

  test("mentorada acompanha os próprios pedidos no perfil", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/perfil");

    await expect(
      page.getByRole("heading", { name: "Meus pedidos de ajuda" })
    ).toBeVisible();
    // linha de duas linhas como a do staff: assunto em cima — o número
    // CHA é ruído de protocolo pro jovem e não aparece na lista
    const linha = page.getByRole("link", {
      name: /Não consigo anexar a foto do combinado/,
    });
    await expect(linha).toBeVisible();
    await expect(page.getByText("CHA-000144")).toHaveCount(0);
    // segunda linha: categoria como contexto + tempo da última
    // movimentação; a pill usa a fala do autor, não a da fila
    await expect(linha.getByText(/Plataforma · /)).toBeVisible();
    await expect(linha.getByText("Aguardando a equipe")).toBeVisible();

    // detalhe embutido no perfil: só a trilha pública, sem nome de staff
    await page.goto(`/jovem/perfil?c=${CH_PLATAFORMA}`);
    await expect(
      page.getByText("Chamado aberto por Ana Beatriz Silva.")
    ).toBeVisible();
    await expect(page.getByText(/comentário interno/i)).toHaveCount(0);
  });

  test("resolvido mostra a resposta final uma vez — a trilha não repete", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/chamados?c=${CH_RESOLVIDO}`);

    // a caixa verde carrega o resumo com a data; o evento automático
    // ("Chamado resolvido — …") sai da trilha pra não contar duas vezes
    const detalhe = page.getByRole("article");
    await expect(
      detalhe.getByText(/A família confirmou a mudança de turno/)
    ).toHaveCount(1);
    await expect(detalhe.getByText(/Chamado resolvido/)).toHaveCount(0);
  });
});
