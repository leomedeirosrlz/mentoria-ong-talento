import {
  agirComConfirma,
  appEnvOk,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// WP7 (REALIZA-140) — a guarda de emissão da jornada: o "Enviar formulário"
// da ficha da dupla NÃO pode entregar os 4 instrumentos da jornada (Visão,
// Metas, PDM, Roda da Vida) — a entrega deles é do mentor pela seção
// Instrumentos da ficha (a action recusa também). O select do dialog filtra
// `ehInstrumento(f.sistema)`; 360º/anamnese/autoavaliação seguem oficiais e
// emissíveis pela coordenação.
//
// Spec read-only: abre o dialog, abre o select e confere a lista — nenhum
// link é gerado (o "Gerar N links" ficaria pra suite de formulários, não
// pra guarda).

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA =
  process.env.E2E_COORD_PASSWORD || process.env.E2E_MENTOR_PASSWORD || "";
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("guarda — Enviar formulário não oferece instrumentos da jornada", () => {
  test("select do dialog filtra Visão/Metas/PDM/Roda e mantém os oficiais", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}`);

    // o Enviar formulário mora no "Mais" do header da ficha — menuitem
    // comum que abre o dialog controlado (mesmo padrão do Solicitar
    // especialista; REALIZA-157 tirou o Dialog.Trigger de dentro do popup)
    const item = page.getByRole("menuitem", { name: "Enviar formulário" });
    await agirComConfirma(
      () =>
        page.getByRole("button", { name: "Mais ações da dupla" }).click(),
      () => item.isVisible()
    );
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => item.click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByRole("heading", { name: "Enviar formulário" })
    ).toBeVisible();

    // o SelectTrigger é o botão rotulado pelo Label "Formulário" — o id do
    // label vem do useId da instância (o dialog aparece 2x na ficha)
    const labelId = await dialog
      .getByText("Formulário", { exact: true })
      .getAttribute("id");
    expect(labelId).toBeTruthy();
    const selectTrigger = dialog.locator(
      `button[aria-labelledby="${labelId}"]`
    );
    await agirComConfirma(
      () => selectTrigger.click(),
      () => page.getByRole("option").first().isVisible()
    );

    // a guarda: os 4 instrumentos de jornada NUNCA viram opção — a entrega
    // deles é do mentor pela seção Instrumentos da ficha (0080)
    for (const titulo of [
      "Construindo a sua Visão",
      "Definindo Minhas Metas",
      "Plano de Desenvolvimento do Mentorado",
      "Roda da Vida",
    ]) {
      await expect(
        page.getByRole("option", { name: new RegExp(titulo) })
      ).toHaveCount(0);
    }

    // e os oficiais de coordenação seguem emissíveis — 360º e anamnese são
    // seleção válida pra dupla (pelo menos um precisa existir no ambiente)
    await expect(
      page
        .getByRole("option", { name: /Avaliação 360º/ })
        .or(page.getByRole("option", { name: /Anamnese/ }))
        .first()
    ).toBeVisible();
  });
});
