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

test.describe("coordenação — instrumentos da jornada em /materiais", () => {
  test.beforeEach(async () => {
    // a fila só lista duplas DPP ativas/pausadas — um spec vizinho que
    // recriou o encontro 16 deixou a fixture 'concluida' e a linha some
    await convergirDuplaAtiva(DUPLA_ID);
  });

  test("3 estados por instrumento, fila de atrasados e Lembrar o jovem", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/materiais");

    // REALIZA-209: duas abas, a coord abre em Instrumentos
    const abas = page.getByRole("tablist", { name: "Seções de materiais" });
    await expect(abas.getByRole("tab")).toHaveCount(2);
    await expect(
      abas.getByRole("tab", { name: "Instrumentos" })
    ).toHaveAttribute("aria-selected", "true");

    const inst = page.locator('section[aria-labelledby="instrumentos-titulo"]');
    const roda = inst.locator("article", { hasText: "Roda da Vida · leitura inicial" });
    await expect(roda.getByText(/responderam/)).toBeVisible();
    await expect(
      inst.locator("article", { hasText: "Avaliação do encontro" }).getByText(/de \d+ avaliados/)
    ).toBeVisible();

    // a fila de atrasados: cada linha aponta pra ficha (âncora de
    // instrumentos) e lembra o JOVEM, não o mentor
    const fila = page.locator('section[aria-labelledby="atrasados-titulo"]');
    await expect(
      fila.getByRole("link", { name: "Ver ficha" }).first()
    ).toHaveAttribute("href", /^\/duplas\/.+#instrumentos$/);
    await expect(
      fila
        .getByRole("button", { name: /^Lembrar / })
        .or(fila.getByRole("button", { name: /Lembrada / }))
        .or(fila.getByText("dupla pausada"))
        .first()
    ).toBeVisible();
    await expect(fila.getByRole("button", { name: /^Lembrar Mentor E2E/ })).toHaveCount(0);

    // REALIZA-210: a biblioteca é uma lista só
    await page.goto("/materiais?aba=biblioteca");
    await expect(
      page.getByRole("heading", { name: /Todos os materiais/ })
    ).toBeVisible();
    await expect(page.locator("details")).toHaveCount(0);
  });

  // REALIZA-194 — a régua "Instrumentos do programa" do lado staff:
  // coord emite e lê respostas, card trancado é leitura pura pra todos.
  test("coord vê Enviar em lote e Ver respostas; trancado sem gesto nenhum", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/materiais?aba=instrumentos");

    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();

    // a fixture e2e tem dupla DPP sem link algum de visão → o lote dela
    // tem elegíveis; a tag "a cada encontro" substituiu a tag de estado na
    // avaliação de encontro (ela não tranca nem fecha)
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ }).first()
    ).toBeVisible();
    await expect(instrumentos.getByText("a cada encontro")).toBeVisible();

    // REALIZA-331: o card inteiro abre a página do instrumento — as
    // respostas por dupla moram lá dentro (/materiais/instrumentos/<chave>)
    const abrir = instrumentos
      .getByRole("link", { name: /^Abrir / })
      .first();
    await expect(abrir).toBeVisible();
    await expect(abrir).toHaveAttribute(
      "href",
      /^\/materiais\/instrumentos\//
    );
    await abrir.click();
    await page.waitForURL(/\/materiais\/instrumentos\/[^/]+/);
    // a página por instrumento: seletor no topo (troca sem sair da
    // leitura) + uma linha por dupla do escopo
    await expect(
      page.getByRole("navigation", { name: "Trocar de instrumento" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ficha" }).first()
    ).toBeVisible();
    await page.goBack();

    // REALIZA-257: a janela do guia é indicador pra coordenação, não trava —
    // e a régua é a posição da dupla (último realizado + 1), não o calendário
    // da turma. Card fora da janela mostra quando ela abre e continua
    // consultável (o cadeado "ainda não abriu" não existe pro coord).
    const rodaFormal = instrumentos.locator("article", {
      hasText: "Roda da Vida · aplicação formal",
    });
    await expect(rodaFormal).toBeVisible();
    if (
      await rodaFormal
        .getByText("janela não aberta")
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      // indicador de janela + card navegável (a página mostra as duplas
      // "ainda não abriu"); emitir em lote não tem elegível fora da janela
      await expect(rodaFormal.getByText(/abre no encontro 12/)).toBeVisible();
      await expect(
        rodaFormal.getByRole("link", { name: /^Abrir / })
      ).toBeVisible();
      await expect(
        rodaFormal.getByRole("button", { name: /Enviar em lote/ })
      ).toHaveCount(0);
    } else {
      await expect(rodaFormal.getByText("liberado").first()).toBeVisible();
    }
    // invariante do papel: na régua da coord nenhum card carrega o cadeado
    await expect(instrumentos.getByText("ainda não abriu")).toHaveCount(0);

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

    // Lembrar fica pro supervisor, agora na fila de atrasados e direto pro
    // jovem — mesma união de estados do spec de coord
    const fila = page.locator('section[aria-labelledby="atrasados-titulo"]');
    await expect(
      fila
        .getByRole("button", { name: /^Lembrar / })
        .or(fila.getByRole("button", { name: /Lembrada / }))
        .or(fila.getByText("dupla pausada"))
        .first()
    ).toBeVisible();

    // a régua mora na aba Instrumentos
    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();
    // a régua mostra o estado real das estações — "ainda não abriu" só
    // quando o escopo inteiro está abaixo do encIni (régua = posição da
    // dupla, não o calendário). A …0030 carrega o realizado nº16 da
    // avaliação pendente, então estações tardias podem já estar abertas:
    // pill "libera no encontro N" quando fechada, "liberado" quando não.
    const libera = instrumentos.getByText(/libera no encontro/);
    if (await libera.first().isVisible()) {
      await expect(libera.first()).toBeVisible();
    } else {
      await expect(
        instrumentos.getByText("liberado").first()
      ).toBeVisible();
    }
    // nada de gesto de coord
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ })
    ).toHaveCount(0);
    await expect(
      instrumentos.getByRole("link", { name: "Ver respostas" })
    ).toHaveCount(0);
    // trancado continua sem ação: o único link do card é o de navegação
    // pra página do instrumento (leitura pura por lá — linhas "ainda não
    // abriu", nenhum gesto); a data de liberação é um pill, não um botão
    const rodaFormal = instrumentos.locator("article", {
      hasText: "Roda da Vida · aplicação formal",
    });
    await expect(rodaFormal.getByRole("button")).toHaveCount(0);
    // e o invariante geral: card "ainda não abriu" tem só o link "Abrir"
    for (const card of await instrumentos
      .locator("article", { hasText: "ainda não abriu" })
      .all()) {
      const links = card.getByRole("link");
      await expect(links).toHaveCount(1);
      await expect(links.first()).toHaveAttribute(
        "href",
        /^\/materiais\/instrumentos\//
      );
      await expect(card.getByRole("button")).toHaveCount(0);
    }
    // rodapé de formulários é coord-only
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toHaveCount(0);
  });

  // REALIZA-194 — o mentor lê catálogo + deep links (nunca espelho da
  // ficha): o acervo é a aba default dele (o conteúdo útil primeiro) e na
  // aba Instrumentos cada card linka a ficha dele na âncora #instrumentos;
  // o rodapé repete o mapa de fichas.
  test("mentor vê acervo primeiro e catálogo com links pra ficha", async ({
    page,
  }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA_STAFF);
    await page.goto("/materiais");

    // painel staff-only some pro mentor — e o acervo é a aba de abertura
    // dele (a ordem "acervo antes do catálogo" virou a aba default)
    await expect(
      page.locator('section[aria-labelledby="atrasados-titulo"]')
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Resumo da biblioteca" })
    ).toBeVisible();

    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Instrumentos do programa",
        level: 2,
      }),
    });
    await expect(instrumentos).toBeVisible();

    // a ficha do mentor é 1 (dupla e2e …0030) → o card traz o botão "Na
    // ficha" apontando pra âncora de instrumentos; o rodapé repete o
    // mapa com o nome social do jovem
    const naFicha = instrumentos
      .getByRole("link", { name: "Na ficha" })
      .first();
    await expect(naFicha).toBeVisible();
    await expect(naFicha).toHaveAttribute(
      "href",
      `/duplas/${DUPLA_ID}?aba=instrumentos#instrumentos`
    );
    await expect(
      instrumentos.getByText(/Estado e envio por dupla na ficha:/)
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
