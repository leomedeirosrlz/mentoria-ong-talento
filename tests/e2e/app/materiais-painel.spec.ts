import {
  appEnvOk,
  convergirDuplaAtiva,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// WP7 (REALIZA-140) — "Progresso da jornada", o painel agregado do
// /materiais da coordenação/supervisão (RPC painel_instrumentos_jornada,
// 0096): o estado das 7 estações por dupla — fatos brutos sem respostas e
// sem tokens — resolvido contra o cronograma oficial da turma.
// REALIZA-194 (v5c): os KPIs quadrados viraram a faixa segmentada por
// instrumento × turma, a lista "fora da janela" tem teto de 5 + "ver as
// outras" e a matriz por dupla mora atrás do <details> "Ver a matriz por
// dupla" — os asserts abaixo abrem o details antes de conferir células.
//
// O que o staging garante pra este spec:
//   · as duplas e2e (…0030, …0070, a pausada …00f2, a híbrida …0140) são
//     DPP ativa/pausada → ao menos uma linha → o painel renderiza;
//   · o cronograma "Calendário oficial" já passou do enc. 5 → roda
//     inicial/visão/metas/PDM sem resposta contam como fora da janela →
//     a lista de ação renderiza com "Ver ficha" e Lembrar/badge;
//   · specs NÃO escrevem aqui — o painel é leitura pura (o Lembrar de
//     verdade já tem cobertura própria em agenda-coordenacao).

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA =
  process.env.E2E_COORD_PASSWORD || process.env.E2E_MENTOR_PASSWORD || "";
const SUP_EMAIL = "sup-e2e@realiza.test";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
// senha compartilhada das personas staff do seed (mentor, supervisor, híbrido)
const SENHA_STAFF = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("coordenação — painel Progresso da jornada em /materiais", () => {
  test.beforeEach(async () => {
    // o painel só lista duplas DPP ativas/pausadas — um spec vizinho que
    // recriou o encontro 16 deixou a fixture 'concluida' e a linha some
    await convergirDuplaAtiva(DUPLA_ID);
  });

  test("KPIs, barras por instrumento, fora-da-janela e a linha da dupla", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/materiais");

    const painel = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Progresso da jornada",
        level: 2,
      }),
    });
    await expect(painel).toBeVisible();
    // o "Você vê / você não vê" (v5c) subiu pro topo da página — a caixa
    // de escopo cobre painel + instrumentos + biblioteca de uma vez
    await expect(page.getByText(/Você vê:/).first()).toBeVisible();

    // a faixa segmentada (v5c) — um segmento por instrumento com a
    // mini-barra de cada turma (fração própria, nunca agregado misturado)
    // a faixa é região focável (scroll por teclado, v5c) — o nome vem do
    // aria-label e os segmentos continuam filhos dela
    await expect(
      painel.getByRole("region", { name: "Cobertura por instrumento" })
    ).toBeVisible();
    await expect(
      painel.getByText("Roda da Vida · leitura inicial").first()
    ).toBeVisible();
    await expect(
      painel.locator('[role="img"][aria-label*="feitos"]').first()
    ).toBeVisible();
    // a avaliação do encontro é a única que não "fecha": conta
    // feitas/realizados por turma no rótulo acessível da mini-barra
    await expect(
      painel
        .locator('[role="img"][aria-label*="avaliações de encontro"]')
        .first()
    ).toBeVisible();

    // a lista de ação — as duplas e2e sem link nenhum marcam instrumentos
    // fora da janela do guia (enc. vigente do calendário > fim da janela)
    await expect(
      painel.getByRole("heading", { name: "Fora da janela do guia" })
    ).toBeVisible();
    const verFichaFora = painel
      .getByRole("link", { name: "Ver ficha" })
      .first();
    await expect(verFichaFora).toBeVisible();
    await expect(verFichaFora).toHaveAttribute("href", /^\/duplas\//);
    // Lembrar só vale pra dupla ativa — a pausada exibe o badge; um nudge
    // recente (cap 48h) vira o botão desabilitado "Lembrada dd/mm". Os três
    // estados podem coexistir entre duplas — .first() na união prova "há
    // affordance" sem violar o strict mode.
    const acao = painel
      .getByRole("button", { name: /^Lembrar / })
      .or(painel.getByRole("button", { name: /Lembrada / }))
      .or(painel.getByText("dupla pausada"))
      .first();
    await expect(acao).toBeVisible();

    // a matriz por dupla ficou atrás de gesto (v5c) — abre o <details>
    // agrupado por turma antes de conferir a linha da dupla
    await painel.getByText("Ver a matriz por dupla").click();

    // agrupamento por turma com o encontro vigente do calendário oficial
    await expect(
      painel.getByText(/· encontro \d+ do calendário/).first()
    ).toBeVisible();

    // a linha da dupla fixture — nome da mentorada + mentor + as 7 células
    // (a avaliação do encontro conta X de Y em vez do rótulo curto). O
    // exact na ficha separa a "Mentorada E2E" da "Mentorada E2E Dois" da
    // dupla2; o filtro Aval. descarta a row da lista fora-da-janela (que
    // não tem células).
    const linhaDupla = painel
      .locator("li", {
        has: page.getByText("Mentorada E2E", { exact: true }),
      })
      .filter({ has: page.getByText(/Aval\. \d+\/\d+/) });
    await expect(linhaDupla).toBeVisible();
    await expect(linhaDupla.getByText(/mentor Mentor E2E/)).toBeVisible();
    // as células ganharam um sufixo sr-only com o detalhe do estado
    // (REALIZA-51) — o texto exato da estação quebraria; o title da célula
    // é `${rótulo} · ${detalhe}` pra qualquer estado, âncora estável
    for (const celula of [
      "Roda inicial",
      "Visão",
      "Metas",
      "PDM",
      "Roda formal",
      "360º",
    ]) {
      await expect(
        linhaDupla.locator(`span[title^="${celula} ·"]`)
      ).toBeVisible();
    }
    await expect(linhaDupla.getByText(/Aval\. \d+\/\d+/)).toBeVisible();
    // o "Ver ficha" da linha aponta pra ficha da dupla certa
    await expect(
      linhaDupla.getByRole("link", { name: "Ver ficha" }).first()
    ).toHaveAttribute("href", `/duplas/${DUPLA_ID}`);

    // legenda — os estados honestos do painel, um ícone por estado igual
    // às células da matriz (Clock pro link expirado, CircleDashed pro "a
    // fazer" — a linha combinada "a fazer / link expirado" foi separada)
    for (const item of [
      "respondido",
      "link enviado, aguardando",
      "link expirado",
      "a fazer",
      "ainda não abriu na turma",
    ]) {
      await expect(
        painel.getByText(item, { exact: true }).first()
      ).toBeVisible();
    }

    // a biblioteca continua abaixo do painel — REALIZA-160 virou o acervo
    // progressivo por encontro: o landmark estável é o resumo dela + o
    // grupo Transversais (o "Guias" virou h3 dentro dele e cada encontro
    // fechado tem um "Nenhum material" escondido que pegava o .or().first)
    await expect(
      page.getByRole("region", { name: "Resumo da biblioteca" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Transversais" })
    ).toBeVisible();
  });

  // REALIZA-194 — a régua "Instrumentos do programa" do lado staff:
  // coord emite e lê respostas, card trancado é leitura pura pra todos.
  test("coord vê Enviar em lote e Ver respostas; trancado sem gesto nenhum", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/materiais");

    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();

    // a fixture e2e tem dupla DPP sem link algum de visão → o lote dela
    // tem elegíveis; a tag recorrente substituiu "janela aberta" na
    // avaliação de encontro (ela não tranca nem fecha)
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ }).first()
    ).toBeVisible();
    await expect(instrumentos.getByText("recorrente")).toBeVisible();

    // "Ver respostas" navega pro formulário oficial — coord-only
    const verRespostas = instrumentos
      .getByRole("link", { name: "Ver respostas" })
      .first();
    await expect(verRespostas).toBeVisible();
    await expect(verRespostas).toHaveAttribute("href", /^\/formularios\//);
    await verRespostas.click();
    await page.waitForURL(/\/formularios\/[^/]+/);
    await page.goBack();

    // card trancado (roda formal / 360º — o calendário e2e não passou do
    // enc. 12): o pill de liberação é leitura — zero link, zero botão
    const trancado = instrumentos.locator("article", {
      hasText: "Roda da Vida · aplicação formal",
    });
    await expect(trancado.getByText("trancado")).toBeVisible();
    await expect(trancado.getByRole("link")).toHaveCount(0);
    await expect(trancado.getByRole("button")).toHaveCount(0);

    // rodapé coord-only apontando os forms de bordo
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toBeVisible();
  });

  // REALIZA-194 — fronteira de papel no staging real: o supervisor vê a
  // régua escopada com a data de liberação (leitura do programa) mas sem
  // nenhum gesto de coord; Lembrar segue, que é a ação do auxiliar.
  test("supervisor vê liberação e Lembrar, sem lote nem respostas", async ({
    page,
  }) => {
    await loginComSenha(page, SUP_EMAIL, SENHA_STAFF);
    await page.goto("/materiais");

    const painel = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Progresso da jornada",
        level: 2,
      }),
    });
    await expect(painel).toBeVisible();
    // Lembrar fica pro supervisor (decisão mantida do v5c) — mesma união
    // de estados do spec de coord
    await expect(
      painel
        .getByRole("button", { name: /^Lembrar / })
        .or(painel.getByRole("button", { name: /Lembrada / }))
        .or(painel.getByText("dupla pausada"))
        .first()
    ).toBeVisible();

    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();
    // a data de liberação é leitura staff — o pill trancado aparece
    await expect(instrumentos.getByText(/libera/).first()).toBeVisible();
    // nada de gesto de coord
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ })
    ).toHaveCount(0);
    await expect(
      instrumentos.getByRole("link", { name: "Ver respostas" })
    ).toHaveCount(0);
    // trancado sem link/botão também pra ele
    const trancado = instrumentos.locator("article", {
      hasText: "Roda da Vida · aplicação formal",
    });
    await expect(trancado.getByRole("link")).toHaveCount(0);
    await expect(trancado.getByRole("button")).toHaveCount(0);
    // rodapé de formulários é coord-only
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toHaveCount(0);
  });

  // REALIZA-194 — o mentor lê catálogo + deep links (nunca espelho da
  // ficha): acervo vem antes do catálogo e cada card linka a ficha dele
  // na âncora #instrumentos; o rodapé repete o mapa de fichas.
  test("mentor vê acervo primeiro e catálogo com links pra ficha", async ({
    page,
  }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA_STAFF);
    await page.goto("/materiais");

    // painel staff-only some pro mentor
    await expect(
      page.getByRole("heading", { name: "Progresso da jornada" })
    ).toHaveCount(0);
    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();

    // ordem v5c: o acervo (o conteúdo útil) ANTES do catálogo
    const yAcervo = (
      await page
        .getByRole("region", { name: "Resumo da biblioteca" })
        .boundingBox()
    )?.y;
    const yCatalogo = (await instrumentos.boundingBox())?.y;
    if (yAcervo == null || yCatalogo == null) {
      throw new Error("seção sem bounding box");
    }
    expect(yAcervo).toBeLessThan(yCatalogo);

    // a ficha do mentor é 1 (dupla e2e …0030) → o card traz o botão "Na
    // ficha" apontando pra âncora de instrumentos; o rodapé repete o
    // mapa com o nome social do jovem
    const naFicha = instrumentos
      .getByRole("link", { name: "Na ficha" })
      .first();
    await expect(naFicha).toBeVisible();
    await expect(naFicha).toHaveAttribute(
      "href",
      `/duplas/${DUPLA_ID}#instrumentos`
    );
    await expect(
      instrumentos.getByText(
        /O estado e o envio de cada instrumento ficam na ficha da dupla:/
      )
    ).toBeVisible();
    await expect(
      instrumentos.getByRole("link", { name: "Mentorada E2E" })
    ).toBeVisible();
    // mentor nunca vê gesto de coord
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ })
    ).toHaveCount(0);
    await expect(
      instrumentos.getByRole("link", { name: "Ver respostas" })
    ).toHaveCount(0);
  });
});
