import {
  appEnvOk,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// WP7 (REALIZA-140) — "Progresso da jornada", o painel agregado do
// /materiais da coordenação/supervisão (RPC painel_instrumentos_jornada,
// 0096): o estado das 7 estações por dupla — fatos brutos sem respostas e
// sem tokens — resolvido contra o cronograma oficial da turma.
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
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("coordenação — painel Progresso da jornada em /materiais", () => {
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
    // o disclaimer honesto do recorte (o que a coord vê × o que não vê)
    await expect(painel.getByText(/Você vê:/)).toBeVisible();

    // KPIs — o 4º rótulo ("fora da janela do guia") repete no heading da
    // lista de ação e na legenda; a prova do KPI fica pelos três únicos
    for (const label of [
      "duplas no painel",
      "estações respondidas",
      "pendências na janela",
    ]) {
      await expect(painel.getByText(label)).toBeVisible();
    }

    // barras empilhadas por instrumento — a avaliação do encontro é a
    // única sem barra (é recorrente: conta feitas/realizados em texto)
    await expect(
      painel.getByRole("heading", { name: "Por instrumento" })
    ).toBeVisible();
    await expect(
      painel.locator('[role="img"][aria-label*="feitos"]').first()
    ).toBeVisible();
    await expect(
      painel.getByText(/avaliações de encontro respondidas — recorrente/)
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
    for (const celula of [
      "Roda inicial",
      "Visão",
      "Metas",
      "PDM",
      "Roda formal",
      "360º",
    ]) {
      await expect(
        linhaDupla.getByText(celula, { exact: true })
      ).toBeVisible();
    }
    await expect(linhaDupla.getByText(/Aval\. \d+\/\d+/)).toBeVisible();
    // o "Ver ficha" da linha aponta pra ficha da dupla certa
    await expect(
      linhaDupla.getByRole("link", { name: "Ver ficha" }).first()
    ).toHaveAttribute("href", `/duplas/${DUPLA_ID}`);

    // legenda — os 5 estados honestos do painel
    for (const item of [
      "respondido",
      "link enviado, aguardando",
      "a fazer / link expirado",
      "ainda não abriu na turma",
    ]) {
      await expect(
        painel.getByText(item, { exact: true }).first()
      ).toBeVisible();
    }

    // a biblioteca continua abaixo do painel — grupos ou o vazio honesto
    await expect(
      page
        .getByRole("heading", { name: "Guias" })
        .or(page.getByText(/Nenhum material/))
        .first()
    ).toBeVisible();
  });
});
