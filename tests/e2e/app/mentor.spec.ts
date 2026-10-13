import type { Locator, Page } from "@playwright/test";
import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// Backend real (staging ou supabase local do CI): a fixture vem de
// scripts/seed-e2e-staging.mjs — mentor com dupla DPP ativa e senha. Specs
// escrevem de verdade e limpam via service role no afterEach.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
} as const;
// os 3 tipos do trigger encontros_agenda_notify — o piso de sino zera os
// dois lados do par (o dedup suprime corpo repetido não-lido: uma sobra de
// run morto faria o insert do gesto nem acontecer)
const TIPOS_AGENDA = "encontro_marcado,encontro_alterado,encontro_desfeito";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Agendado direto no banco na dupla fixture — piso dos gestos de link e
 *  remarcação (o teste não exercita o agendar). `emDiasFuturo` negativo cria
 *  o "agendado que já passou" do limbo. Data truncada no MINUTO: o
 *  datetime-local não carrega segundos e a action lê o valor naïve como
 *  -03:00 — uma sobra de :42s marcaria a data como "mudada" num re-submit. */
function criarAgendado(numero: number, emDiasFuturo: number, link?: string) {
  const ms = Math.floor((Date.now() + emDiasFuturo * 86400e3) / 60000) * 60000;
  return inserirViaServiceRole("encontros", {
    dupla_id: DUPLA_ID,
    numero,
    data_hora: new Date(ms).toISOString(),
    status: "agendado",
    ...(link ? { link } : {}),
    created_by: IDS.mentorProfile,
  });
}

/** "YYYY-MM-DDTHH:mm" pro datetime-local — sempre relativo a agora. */
function emDias(dias: number, hora = "19:00") {
  const d = new Date(Date.now() + dias * 86400e3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hora}`;
}

/** Mesmo render do formatDateTime (ciclo.ts): o datetime naïve que a action
 *  recebe entra como -03:00 — o rótulo da linha é esse instante em SP. */
function rotuloDataHora(local: string) {
  return new Date(`${local}-03:00`).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Card do encontro na ficha da dupla — a âncora é o id `registrar-<uuid>`
 *  que a linha carrega pro deep link do registro. */
function linhaFicha(page: Page, encontroId: string) {
  return page.locator(`#registrar-${encontroId}`);
}

/** Passo além da semana corrente e sem pendência dorme no <details>
 *  "Próximos N encontros" — a linha existe no DOM mas escondida; um clique
 *  no summary abre. No-op quando a linha já está visível (nº ≤ semana ou
 *  pendente — agendado vencido sempre nasce fora do details). */
async function abrirProximosSePreciso(row: Locator, page: Page) {
  if (await row.isVisible().catch(() => false)) return;
  await page
    .getByText(/^Próximos \d+ encontros$/)
    .click()
    .catch(() => {});
}

type Notif = { titulo: string; corpo: string | null; href: string | null };

/** Sinos de agenda recebidos por um lado da dupla — os três tipos só nascem
 *  do trigger encontros_agenda_notify. */
async function sinosDe(profileId: string, tipo: string): Promise<Notif[]> {
  return buscarViaServiceRole<Notif[]>(
    "notificacoes",
    `select=titulo,corpo,href&profile_id=eq.${profileId}&tipo=eq.${tipo}`
  );
}

test.describe("mentor DPP — fluxos reais", () => {
  test.beforeEach(async ({ page }) => {
    // o piso cobre o encontro que a fixture do shell /jovem semeia na MESMA
    // dupla (id e2e…00d1): se ele pendura (run morto entre arquivos ou spec
    // rodado solto), a home mostraria "encontro agendado" e o CTA "Agendar
    // encontro" do teste abaixo sumiria — a limpeza prévia parte do zero
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    // qualquer encontro que o spec criou na dupla fixture — independente do
    // assert ter passado ou não (um leftover "realizado" apaga o CTA "Agendar
    // encontro" da home e quebra o próximo run em cascata)
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
  });

  test("login cai na home do mentor, não no onboarding", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login|\/auth\/definir-senha/);
    // home do mentor: o próximo passo da dupla é o protagonista
    await expect(page.getByText(/encontro/i).first()).toBeVisible();
  });

  test("agenda renderiza a semana e o cronograma oficial", async ({ page }) => {
    await page.goto("/agenda");
    await expect(
      page.getByText(/Semana do \d+º|Semana dos encontros|Semana/).first()
    ).toBeVisible();
  });

  test("agendar encontro pela home persiste de verdade", async ({ page }) => {
    // CTA da home do mentor — o dialog abre com a data oficial sugerida.
    await page.getByRole("button", { name: "Agendar encontro" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // a data oficial do seed é fixa e já passou — preencher ela cairia no
    // fluxo retroativo ("Registrar encontro"). O spec força data futura pra
    // exercitar o agendamento de verdade; o cleanup no afterEach desfaz.
    const futuro = new Date(Date.now() + 3 * 86400e3);
    const ymd = `${futuro.getFullYear()}-${String(futuro.getMonth() + 1).padStart(2, "0")}-${String(futuro.getDate()).padStart(2, "0")}`;
    await dialog.locator("#data_hora").fill(`${ymd}T19:00`);

    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();

    // toast de sucesso e o dialog fecha — o refresh traz o card novo.
    // O card da home fala "Nº encontro agendado" — o toast novo é
    // "Agendamento confirmado — Nº encontro."; o \. final ancora nele.
    await expect(
      page.getByText(/Agendamento confirmado — \d+º encontro\./i)
    ).toBeVisible();
    await expect(dialog).not.toBeVisible();
  });

  test.describe("link da chamada e remarcação por linha (REALIZA-23)", () => {
    // o datetime-local é naïve e a action interpreta como -03:00 — browser
    // fora do fuso de SP reescreveria o instante num re-submit e a RPC
    // cobraria motivo à toa (mesmo guard do jovem-agenda)
    test.use({ timezoneId: "America/Sao_Paulo" });

    test.beforeEach(async () => {
      // piso de sino depois do login: o gesto do teste é o único evento de
      // agenda que interessa — sobras de run anterior com o mesmo corpo
      // fariam o dedup do trigger suprimir o insert
      await limparViaServiceRole(
        "notificacoes",
        `profile_id=in.(${IDS.mentorProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA})`
      );
    });

    test.afterEach(async () => {
      // o insert do fixture dispara "marcado" (creditado à coordenação) e os
      // gestos geram os sinos bilaterais — zera os três tipos dos dois lados
      await limparViaServiceRole(
        "notificacoes",
        `profile_id=in.(${IDS.mentorProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA})`
      );
    });

    test("ficha: editar o link atualiza o chip Entrar e avisa o jovem", async ({
      page,
    }) => {
      // agendado futuro SEM link — o lápis é o "adicionar" da linha
      const enc = await criarAgendado(5, 4);
      await page.goto(`/duplas/${DUPLA_ID}`);

      const linha = linhaFicha(page, String(enc.id));
      await abrirProximosSePreciso(linha, page);
      await expect(linha).toBeVisible();
      await linha
        .getByRole("button", { name: "Editar link da chamada" })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Editar link da chamada" })
      ).toBeVisible();
      // a data não se mexe — o dialog só fala do link
      await expect(
        dialog.getByText("O horário continua o mesmo — só o link muda.")
      ).toBeVisible();

      await dialog.locator("#link").fill("https://meet.google.com/e2e-ficha");
      await dialog.getByRole("button", { name: "Salvar" }).click();

      await expect(page.getByText("Link atualizado.")).toBeVisible();
      await expect(dialog).not.toBeVisible();

      // o chip "Entrar na chamada" aponta o link novo
      await expect(
        linha.getByRole("link", { name: /Entrar na chamada/ })
      ).toHaveAttribute("href", "https://meet.google.com/e2e-ficha");

      // write real: update direto na row (RLS do mentor), link persistido
      const [row] = await buscarViaServiceRole<{ link: string | null }[]>(
        "encontros",
        `select=link&id=eq.${String(enc.id)}`
      );
      expect(row.link).toBe("https://meet.google.com/e2e-ficha");

      // o sino do outro lado — "atualizou o link", não "moveu" (a data não
      // mudou; o trigger separa os dois eventos)
      const [notif] = (await sinosDe(IDS.jovemProfile, "encontro_alterado"))
        .filter((n) => n.titulo === "5º encontro alterado");
      expect(notif).toBeTruthy();
      expect(notif?.corpo).toMatch(
        /Mentor E2E atualizou o link do encontro de \d{2}\/\d{2}\./
      );
      expect(notif?.href).toBe("/jovem/agenda");
    });

    test("ficha: remover o link some o chip — o lápis continua", async ({
      page,
    }) => {
      const enc = await criarAgendado(5, 4, "https://meet.google.com/e2e-velho");
      await page.goto(`/duplas/${DUPLA_ID}`);

      const linha = linhaFicha(page, String(enc.id));
      await abrirProximosSePreciso(linha, page);
      await expect(
        linha.getByRole("link", { name: /Entrar na chamada/ })
      ).toHaveAttribute("href", "https://meet.google.com/e2e-velho");

      await linha
        .getByRole("button", { name: "Editar link da chamada" })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      // o campo abre preenchido com o link gravado
      await expect(dialog.locator("#link")).toHaveValue(
        "https://meet.google.com/e2e-velho"
      );
      await dialog.getByRole("button", { name: "Remover link" }).click();

      await expect(page.getByText("Link removido.")).toBeVisible();
      await expect(dialog).not.toBeVisible();

      // chip some da linha, lápis fica — sem link o gesto vira "adicionar"
      await expect(
        linha.getByRole("link", { name: /Entrar na chamada/ })
      ).toHaveCount(0);
      await expect(
        linha.getByRole("button", { name: "Editar link da chamada" })
      ).toBeVisible();

      const [row] = await buscarViaServiceRole<{ link: string | null }[]>(
        "encontros",
        `select=link&id=eq.${String(enc.id)}`
      );
      expect(row.link).toBeNull();
    });

    test("ficha: remarcar um agendado já passado exige motivo e grava", async ({
      page,
    }) => {
      // limbo: agendado de anteontem — o encontro ficou pra trás sem registro
      // e o "Remarcar" da linha é a saída honesta (ao lado do "não aconteceu")
      const enc = await criarAgendado(4, -1);
      await page.goto(`/duplas/${DUPLA_ID}`);

      const linha = linhaFicha(page, String(enc.id));
      // agendado vencido é pendência — a linha nasce fora do <details>
      await expect(linha).toBeVisible();
      await linha.getByRole("button", { name: "Remarcar" }).click();
      const dialog = page.getByRole("dialog");
      // modo remarcação: o título é o encontro e o submit é "Confirmar remarcação"
      await expect(
        dialog.getByRole("heading", { name: "4º encontro" })
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Confirmar remarcação" })
      ).toBeVisible();

      const alvo = emDias(6);
      await dialog.locator("#data_hora").fill(alvo);
      // a data mudou → o hint some e o motivo passa a ser exigido
      await expect(
        dialog.getByText("Só precisa se mudar a data.")
      ).toHaveCount(0);
      await dialog.locator("#motivo-select").click();
      await page.getByRole("option", { name: "Conflito de agenda" }).click();
      await dialog
        .getByRole("button", { name: "Confirmar remarcação" })
        .click();

      await expect(
        page.getByText("Remarcação confirmada — 4º encontro.")
      ).toBeVisible();
      await expect(dialog).not.toBeVisible();

      // a linha mostra a data nova e o motivo — leitura honesta do limbo
      // resolvido
      await expect(
        linha.getByText(`agendado ${rotuloDataHora(alvo)}`)
      ).toBeVisible();
      await expect(
        linha.getByText("remarcado: Conflito de agenda")
      ).toBeVisible();

      const [row] = await buscarViaServiceRole<
        { status: string; data_hora: string; motivo_reagendamento: string | null }[]
      >(
        "encontros",
        `select=status,data_hora,motivo_reagendamento&id=eq.${String(enc.id)}`
      );
      expect(row.status).toBe("agendado");
      expect(row.motivo_reagendamento).toBe("Conflito de agenda");
      expect(new Date(row.data_hora).getTime()).toBeGreaterThan(Date.now());
    });

    test("agenda: o lápis no detalhe do dia troca o link", async ({ page }) => {
      const enc = await criarAgendado(5, 3);
      // ?dia= abre a agenda no dia do encontro (deep-link do calendário)
      const dia = new Date(String(enc.data_hora)).toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });
      await page.goto(`/agenda?dia=${dia}`);

      const detalhe = page.locator(
        'section[aria-label="Detalhe do dia selecionado"]'
      );
      // a linha do encontro da dupla no dia — "5º encontro · agendado, às 19:00"
      const linhaDia = detalhe.locator("li", {
        has: page.getByText("5º encontro", { exact: false }),
      });
      await expect(linhaDia.getByText(/agendado/)).toBeVisible();
      await linhaDia
        .getByRole("button", { name: "Editar link da chamada" })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Editar link da chamada" })
      ).toBeVisible();
      await dialog.locator("#link").fill("https://meet.google.com/e2e-agenda");
      await dialog.getByRole("button", { name: "Salvar" }).click();

      await expect(page.getByText("Link atualizado.")).toBeVisible();
      await expect(dialog).not.toBeVisible();

      // o chip verde do encontro na agenda aponta o link novo
      await expect(
        linhaDia.getByRole("link", { name: /Entrar na chamada/ })
      ).toHaveAttribute("href", "https://meet.google.com/e2e-agenda");

      const [row] = await buscarViaServiceRole<{ link: string | null }[]>(
        "encontros",
        `select=link&id=eq.${String(enc.id)}`
      );
      expect(row.link).toBe("https://meet.google.com/e2e-agenda");
    });

    test("coord acompanha e copia o link — não edita nem remarca", async ({
      page,
    }) => {
      const enc = await criarAgendado(5, 3, "https://meet.google.com/e2e-coord");
      await relogar(page, COORD_EMAIL, COORD_SENHA);
      await page.goto(`/duplas/${DUPLA_ID}`);

      const linha = linhaFicha(page, String(enc.id));
      await abrirProximosSePreciso(linha, page);
      await expect(linha).toBeVisible();
      // quem monitora copia pra repassar — nunca edita
      await expect(
        linha.getByRole("button", { name: /Copiar link da chamada/ })
      ).toBeVisible();
      await expect(
        linha.getByRole("button", { name: "Editar link da chamada" })
      ).toHaveCount(0);
      await expect(
        linha.getByRole("button", { name: "Remarcar" })
      ).toHaveCount(0);
    });
  });
});
