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

  await page.getByRole("button", { name: "Criar cronograma" }).click();
  await page.waitForURL("**/turmas/*");

  await page.goto("/turmas");
  await expect(
    page.getByRole("link", { name: new RegExp(TURMA) })
  ).toBeVisible();
});
