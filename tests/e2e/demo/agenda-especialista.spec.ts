import { entrarNaDemo, expect, test } from "../helpers";

// WP4 — a agenda do especialista vira grade visual semanal no card "Sua
// agenda". A persona mentor_especialista (Sofia) tem fixtures
// determinísticas pra grade nunca ficar vazia nem fora da janela:
//   · grade semanal: ter 18–21, qui 18–21, sáb 9–12 (3 janelas)
//   · exceções: bloqueio na PRÓXIMA terça 18–21 (semana de provas — rasga a
//     janela inteira daquele dia) + extra no PRÓXIMO domingo 10–12
//   · sessões ancoradas na grade: Bia sáb 10:00 (esp1 nº4) e Eduardo qui
//     19:30 (esp3 nº2) — sempre dentro das janelas, nunca no dia bloqueado
//
// Contrato da grade visual (a UI é de outro agente — este spec pode falhar
// até o merge): header "Sua agenda" + grade por dia seg–dom com eixo
// 8h–20h no desktop / cards por dia com pills no mobile (<768px); blocos
// com aria-label descritivo ("Terça 18h–21h disponível", "Sessão Ana
// Beatriz …", "Bloqueado", "Horários livres"); <details> "Editar grade"
// embrulha as seções intactas "Toda semana"/"Dias específicos" (defaultOpen
// só com grade vazia); "Próximos horários livres" fora do details; cards
// de trilha ganham "Propor outro horário" → /duplas/[id].
// Público, sem writes: vale em qualquer deploy, produção inclusive.

const TZ = "America/Sao_Paulo"; // fuso do app e da projeção de slots

/** "YYYY-MM-DD" de hoje + `dias` em BRT — casa com o ymd() do data.ts. */
const diaBrt = (dias: number) =>
  new Date(Date.now() + dias * 86400e3).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
/** dow do Postgres (0=dom … 6=sáb) de uma data ISO — meio-dia UTC tira o
 *  getDay da borda de fuso. */
const dowDe = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** 1ª data > hoje (BRT) com o dow pedido — `|| 7` = mesma regra do data.ts. */
const proximaDataDow = (dow: number) =>
  diaBrt(((dow - dowDe(diaBrt(0))) + 7) % 7 || 7);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

test.describe("agenda demo do especialista — grade visual semanal (WP4)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("grade desktop: janelas, sessões e exceções como blocos rotulados", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    await expect(
      page.getByText("Sua agenda", { exact: true })
    ).toBeVisible();

    // as três janelas semanais da Sofia — um bloco por dia com aria-label
    // "<Dia> <H>h–<H>h … disponível" (contrato). ^= ancora no dia: sessões
    // e exceções têm labels próprios que não terminam em "disponível"
    await expect(
      page.locator('[aria-label^="Terça"][aria-label*="disponível"]:visible').first()
    ).toBeVisible();
    await expect(
      page.locator('[aria-label^="Quinta"][aria-label*="disponível"]:visible').first()
    ).toBeVisible();
    await expect(
      page.locator('[aria-label^="Sábado"][aria-label*="disponível"]:visible').first()
    ).toBeVisible();
    // labels de hora: a janela de ter/qui começa às 18h, a de sábado às 9h —
    // o formato exato ("18h" vs "18:00") é do contrato; o dígito basta
    await expect(
      page.locator('[aria-label^="Terça"][aria-label*="18"]:visible').first()
    ).toBeVisible();
    const janelas = page.locator('[aria-label$="disponível"]:visible');
    expect(await janelas.count()).toBeGreaterThanOrEqual(3);

    // sessão posicionada na grade: "Sessão Eduardo · sessão 2 19h30" — a
    // fixture ancora em HOJE justamente porque a grade só desenha a semana
    // corrente (seg–dom); "próximo sábado" da Bia sai dela aos domingos
    await expect(
      page.locator('[aria-label^="Sessão"][aria-label*="Eduardo"]:visible').first()
    ).toBeVisible();

    // exceções datadas ancoradas em HOJE (mesma razão): o bloqueio do
    // meio-dia hachura na coluna de hoje e o extra de 7h–9h aparece clipado
    // no eixo 8h–20h — fora da grade de janelas
    await expect(
      page.locator('[aria-label*="bloqueado"]:visible').first()
    ).toBeVisible();
    await expect(
      page.locator('[aria-label*="extra"]:visible').first()
    ).toBeVisible();

    // faixas "Horários livres" na grade dependem de slot projetado dentro
    // da semana (domingo → zero) — o assert determinístico é a legenda
    await expect(page.getByText("Livre p/ agendar")).toBeVisible();
  });

  test("'Editar grade' vem colapsado e abre as seções intactas", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    // a projeção fica FORA do details — visível sem abrir o editor
    const livres = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Próximos horários livres" }),
      });
    await expect(livres).toBeVisible();
    // quinta 18:00 sempre tem slot (a sessão do Eduardo só come 19:30/20:00);
    // domingo 10:00 vem do extra — e a próxima terça, bloqueada, não projeta
    await expect(
      livres.getByText(/quinta \d{2}\/\d{2} às 18:00/).first()
    ).toBeVisible();
    await expect(
      livres.getByText(/domingo \d{2}\/\d{2} às 10:00/).first()
    ).toBeVisible();
    await expect(
      livres.getByText(new RegExp(`terça ${ddmm(proximaDataDow(2))} às`))
    ).toHaveCount(0);

    // grade não-vazia → defaultOpen falso: o editor fica fechado até o
    // clique no summary
    // TODO(contrato): se "Editar grade" virar um <button> custom em vez de
    // <summary>, trocar por getByRole("button", { name: /Editar grade/ })
    const summary = page
      .locator("summary")
      .filter({ hasText: /Editar grade/ })
      .first();
    await expect(summary).toBeVisible();
    await expect(
      page.getByText("Toda semana", { exact: true })
    ).toBeHidden();
    await expect(
      page.getByText("Dias específicos", { exact: true })
    ).toBeHidden();

    await summary.click();
    await expect(
      page.getByText("Toda semana", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Dias específicos", { exact: true })
    ).toBeVisible();

    // conteúdo intacto: a janela de terça na grade e as duas exceções na
    // lista (o texto "dd de mmm. de aaaa · HH:MM–HH:MM" + badge)
    const grade = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Toda semana" }) });
    const excecoes = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Dias específicos" }) });
    await expect(
      grade.locator("li", { hasText: "Terça" }).getByText("18:00–21:00")
    ).toBeVisible();
    await expect(
      grade.locator("li", { hasText: "Sábado" }).getByText("09:00–12:00")
    ).toBeVisible();
    await expect(
      excecoes
        .locator("li", { hasText: "18:00–21:00" })
        .getByText("Bloqueio", { exact: true })
    ).toBeVisible();
    await expect(
      excecoes
        .locator("li", { hasText: "10:00–12:00" })
        .getByText("Extra", { exact: true })
    ).toBeVisible();
  });

  test("cards de trilha: 'Propor outro horário' linka a ficha da dupla", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    // Sofia carrega duas trilhas — os dois cards nomeiam as mentoradas
    await expect(page.getByText(/Ana Beatriz/).first()).toBeVisible();
    await expect(page.getByText(/Eduardo/).first()).toBeVisible();
    // a fila "Próximos" de cada card lista a sessão agendada da trilha
    await expect(page.getByText(/sessão 4/).first()).toBeVisible();
    await expect(page.getByText(/sessão 2/).first()).toBeVisible();

    // o CTA novo sai pra ficha da dupla — um por card de trilha, apontando
    // pra /duplas/<id> (o uid do dataset é decimal, não o hex do mapa)
    const ctas = page.getByRole("link", { name: /Propor outro horário/ });
    await expect(ctas).toHaveCount(2);
    for (const href of await ctas.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href"))
    )) {
      expect(href).toMatch(/^\/duplas\/de000000-/);
    }
  });
});

test.describe("agenda demo do especialista — grade no mobile (WP4)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Sao_Paulo",
  });

  test("<768px: cards por dia com pills, sem colunas", async ({ page }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    // os mesmos blocos rotulados, agora como pills nos cards por dia —
    // os dias sem conteúdo podem ou não renderizar card (contrato),
    // então ancora nos dias que têm janela/extra
    await expect(page.getByText(/^Terça/).first()).toBeVisible();
    await expect(page.getByText(/^Sábado/).first()).toBeVisible();
    await expect(page.getByText(/^Domingo/).first()).toBeVisible();
    await expect(
      page.locator('[aria-label^="Terça"][aria-label*="disponível"]:visible').first()
    ).toBeVisible();
    await expect(
      page.locator('[aria-label^="Sábado"][aria-label*="disponível"]:visible').first()
    ).toBeVisible();
    await expect(
      page
        .locator('[aria-label^="Sessão"][aria-label*="Eduardo"]:visible')
        .first()
    ).toBeVisible();

    // sem a grade de colunas: nenhum columnheader no layout mobile
    // TODO(contrato): se a grade desktop usar outra marca (ex.: role=grid ou
    // header de dias solto), trocar este assert negativo pelo marcador real
    await expect(page.getByRole("columnheader")).toHaveCount(0);
  });
});
