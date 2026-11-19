import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-34 — criar turma importando o cronograma de arquivo:
//   upload CSV → leitura (16 encontros + turma detectados) → revisão
//   editável → criarCronograma grava e o card aparece em /turmas.
//
// O label "E2E Import" é do prefixo "E2E " — o sweep do seed cobre
// leftovers; a spec ainda limpa o que criou no afterEach (mesmo piso do
// operacional/turma-rename).

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

const TURMA = "E2E Import T9";

const CSV = [
  "Etapa;Data;Observação",
  "Cronograma da Turma 9;;",
  "Inscrições;20/05/2026 a 10/06/2026;",
  ...Array.from({ length: 16 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 5, 24 + i * 7));
    return `Encontro ${i + 1};${d.toISOString().slice(0, 10)};`;
  }),
  "Encerramento;21/10/2026;",
].join("\n");

test.skip(
  !appEnvOk() || !COORD_SENHA,
  "sem credenciais de teste (E2E_*) — pula specs de app"
);

async function limpar() {
  const crons = await buscarViaServiceRole<{ id: string }[]>(
    "cronogramas",
    `select=id&turma=eq.${encodeURIComponent(TURMA)}`
  );
  for (const c of crons) {
    await limparViaServiceRole("ciclo_eventos", `cronograma_id=eq.${c.id}`);
    await limparViaServiceRole("cronogramas", `id=eq.${c.id}`);
  }
}

test.beforeEach(limpar);
test.afterEach(limpar);

test("importa CSV: leitura → prévia editável → grava e aparece em /turmas", async ({
  page,
}) => {
  await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
  await page.goto("/turmas/novo");

  await page.getByText("Importar de arquivo").click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "cronograma-t9.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf-8"),
  });
  await page.getByRole("button", { name: "Ler arquivo" }).click();

  // leitura: 18 eventos (preparação + 16 encontros + encerramento)
  await expect(page.getByText(/eventos reconhecidos/)).toBeVisible();
  await expect(page.getByText(/turma “Turma 9”/)).toBeVisible();

  await page.getByRole("button", { name: "Revisar prévia editável" }).click();

  // prévia importada: origem + identidade editável + lista materializada.
  // A turma detectada vem sugerida; a coordenação ajusta pro label real.
  await expect(page.getByText(/Importado de cronograma-t9\.csv/)).toBeVisible();
  await expect(page.locator("#cb-turma")).toHaveValue("Turma 9");
  await page.locator("#cb-turma").fill(TURMA);
  await expect(page.getByText(/16 encontros oficiais/)).toBeVisible();

  // **/turmas/* casaria a URL atual (/turmas/novo) e a espera resolveria
  // antes da action gravar — espera a rota do cronograma criado (uuid)
  await page.getByRole("button", { name: "Criar cronograma" }).click();
  await page.waitForURL(/\/turmas\/[0-9a-f-]{36}/);

  await page.goto("/turmas");
  await expect(
    page.getByRole("link", { name: new RegExp(TURMA) })
  ).toBeVisible();
});

// Spec 009 US1, caso de borda: documento fora do padrão (datas por
// extenso, sem "Encontro N", sem turma) sai com sinais de complexidade —
// leitura parcial, confiança baixa — e, com provider configurado, iria à
// IA sem clique. O e2e roda sem IA_API_* (mesma régua do assistente): o
// que se prova aqui é o deck honesto — prévia parcial com avisos, botão
// de IA escondido e NADA persistido sem a revisão humana. O caminho da
// IA (tier forte, limite, auditoria) está coberto em vitest
// (importar-cronograma-action.test.ts).
const TXT_COMPLEXO = [
  "Jornada de acompanhamento — ciclo do ano",
  "Semana 1 · 06 de junho · boas-vindas e combinados",
  "Semana 2 · 13 de junho · escuta ativa e presença",
  "Semana 3 · 20 de junho · sonhos e planos",
].join("\n");

test("doc complexo sem provider: prévia honesta e nada grava sem revisão", async ({
  page,
}) => {
  await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
  await page.goto("/turmas/novo");

  await page.getByText("Importar de arquivo").click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "jornada.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(TXT_COMPLEXO, "utf-8"),
  });
  await page.getByRole("button", { name: "Ler arquivo" }).click();

  // leitura determinística honesta: eventos parciais + avisos; sem
  // IA_API_* o botão de IA nem aparece (feature se esconde, não falha)
  await expect(page.getByText(/3 eventos reconhecidos/)).toBeVisible();
  await expect(
    page
      .locator("ul.list-disc li")
      .filter({ hasText: "A turma não foi identificada" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /com IA/ })
  ).not.toBeVisible();

  // a revisão humana segue obrigatória: a prévia abre o builder editável
  await page.getByRole("button", { name: "Revisar prévia editável" }).click();
  await expect(
    page.getByText(/Importado de jornada\.txt/)
  ).toBeVisible();

  // nada foi gravado: cronogramas só recebe linha via criarCronograma,
  // que exige o clique na prévia revisada
  const crons = await buscarViaServiceRole<{ id: string }[]>(
    "cronogramas",
    "select=id&turma=like.E2E*"
  );
  expect(crons).toHaveLength(0);
});
