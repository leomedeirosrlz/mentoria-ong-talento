import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  restComoUsuario,
  test,
} from "../helpers";

// WP5/D5 — a agenda da coordenação contra o staging real: a superfície de
// monitoramento (abas/sections/postura), o escopo por papel (RLS + RPC) e o
// lembrete de verdade — clique na fila → interacao 'nudge' + notificação
// 'lembrete' → cap de 48h por dupla valendo pra QUALQUER autor (0094).
//
// Fixture do lembrete: a dupla2 (e2e…0070 — Mentor E2E Reserva × Mentorada
// E2E Dois) é o alvo porque nenhuma fixture cria encontro nela — sem row do
// vigente ela sempre cai na fila "Para acompanhar" como "sem data" com o
// Lembrar livre. O piso replica o sweep do seed: status 'ativa', encontros
// fora e nudges zerados (o cap conta qualquer autor — um run morto deixaria
// a dupla travada por 48h e o spec pularia de bandeja).
//
// Cleanup cirúrgico: só o que ESTE run criou — nudge/lembrete com
// created_at >= t0 do clique (e autor/created_by da coord e2e). Nada de
// seed é tocado; a dupla volta sem encontros como estava.

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
// senha compartilhada das personas staff do seed (mentor, supervisor, híbrido)
const SENHA_STAFF = process.env.E2E_MENTOR_PASSWORD ?? "";
const SUP_EMAIL = "sup-e2e@realiza.test";

const IDS = {
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  supProfile: "e2e00000-0000-4000-8000-000000000100",
  dupla: "e2e00000-0000-4000-8000-000000000030",
  dupla2: "e2e00000-0000-4000-8000-000000000070",
  duplaHibDpp: "e2e00000-0000-4000-8000-000000000140",
} as const;

const TZ = "America/Sao_Paulo";
/** "YYYY-MM-DD" de hoje no fuso do programa — a régua do vigente. */
const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

type DuplaRow = { id: string; status: string; mentor_id: string | null; cronograma_id: string | null };

/** Lê a dupla2 fresca (mentor_id/cronograma_id não são hardcoded — o
 *  remanejo já mexeu nessa dupla uma vez) e devolve a row. Falha cedo se a
 *  fixture não existir — o seed precisa ter rodado. */
async function lerDupla2(): Promise<DuplaRow> {
  const [d] = await buscarViaServiceRole<DuplaRow[]>(
    "duplas",
    `select=id,status,mentor_id,cronograma_id&id=eq.${IDS.dupla2}`
  );
  if (!d) throw new Error("dupla fixture e2e…0070 ausente — rode pnpm seed:e2e");
  return d;
}

/** Piso do spec de lembrete: dupla2 ativa, sem encontros (sempre "sem
 *  data" na fila) e sem nudge recente (cap de 48h conta qualquer autor).
 *  Idempotente — seguro re-rodar em retry e em runs seguidos. */
async function convergirDupla2ParaFila(): Promise<DuplaRow> {
  await limparEncontrosDaDupla(IDS.dupla2); // filhos 0071 antes dos pais
  let d = await lerDupla2();
  if (d.status !== "ativa") {
    await atualizarViaServiceRole("duplas", `id=eq.${IDS.dupla2}`, {
      status: "ativa",
    });
    d = await lerDupla2();
  }
  // nudges nunca são fixture — limpa o resíduo de runs mortos (o RPC olha
  // os últimos 48h de QUALQUER autor)
  await limparViaServiceRole(
    "interacoes",
    `dupla_id=eq.${IDS.dupla2}&tipo=eq.nudge`
  );
  return d;
}

/** Vigente do cronograma da dupla2: o último evento 'encontro' com data <=
 *  hoje. Sem vigente a fila não tem sinal pra ela — condição de ambiente,
 *  não bug: o spec pula com motivo declarado. */
async function vigenteDaDupla(d: DuplaRow) {
  if (!d.cronograma_id) return null;
  const [ev] = await buscarViaServiceRole<{ numero: number }[]>(
    "ciclo_eventos",
    `select=numero,data&cronograma_id=eq.${d.cronograma_id}&tipo=eq.encontro` +
      `&data=lte.${hojeSP()}&order=data.desc&limit=1`
  );
  return ev ?? null;
}

test.describe("agenda da coordenação — monitoramento e lembrete real (WP5/D5)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("monitoramento é a aterrissagem — heading, postura, abas e seções", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { name: "Agenda do programa" })
    ).toBeVisible();
    // a postura da página virou a linha da semana (redesign sem parágrafo
    // explicativo): "Semana N · D a D de Mês · hoje, {dia da semana}"
    await expect(
      page.getByText(/Semana \d+ · \d+ a \d+ de .+ · hoje,/)
    ).toBeVisible();

    // abas links role=tab — Monitoramento selecionado por default
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(
      abas.getByRole("tab", { name: "Monitoramento" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      abas.getByRole("tab", { name: "Calendário" })
    ).toHaveAttribute("aria-selected", "false");

    // as seções do modo existem mesmo com fila vazia, na ordem do v8b
    // (REALIZA-195): orientação do programa antes do detalhe operacional
    // — 1º "Semana do programa", 2º "Números da semana", por último o
    // "Painel da semana" que abriga a fila "Duplas para acompanhar"
    // (role=group; o conteúdo depende do staging — a moldura é o contrato)
    await expect(page.locator("section[aria-label]").first()).toHaveAttribute(
      "aria-label",
      "Semana do programa"
    );
    for (const label of [
      "Semana do programa",
      "Números da semana",
      "Painel da semana",
    ])
      await expect(
        page.locator(`section[aria-label="${label}"]`)
      ).toBeVisible();
    await expect(
      page.locator('[role="group"][aria-label="Duplas para acompanhar"]')
    ).toBeVisible();

    // deep-link pro calendário: os chips da coord são Dia/Semana/Mês/Ciclo
    // (REALIZA-195) — "Horários" e a superfície de agendar são só do mentor
    // (REALIZA-25 já cobre os valores; aqui basta a transição + a ausência
    // do clique-vazio)
    await abas.getByRole("tab", { name: "Calendário" }).click();
    await page.waitForURL(/aba=calendario/);
    await expect(
      page.getByRole("button", { name: /^Agendar encontro na / })
    ).toHaveCount(0);
  });

  test("escopo real — supervisor restrito às supervisionadas, coord não", async () => {
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
    const jwtSup = await jwtDoUsuario(SUP_EMAIL, SENHA_STAFF);

    // leitura na pele de cada papel — o que o RLS devolve pra cada um
    const [resSup, resCoord] = await Promise.all([
      restComoUsuario("duplas?select=id", jwtSup),
      restComoUsuario("duplas?select=id", jwtCoord),
    ]);
    expect(resSup.status).toBe(200);
    expect(resCoord.status).toBe(200);
    const idsSup = ((await resSup.json()) as { id: string }[]).map((r) => r.id);
    const idsCoord = ((await resCoord.json()) as { id: string }[]).map(
      (r) => r.id
    );

    // o supervisor enxerga as supervisionadas (duplas.supervisor_id) e não
    // enxerga a dupla DPP do híbrido — sem aresta, sem linha
    expect(idsSup).toContain(IDS.dupla);
    expect(idsSup).not.toContain(IDS.duplaHibDpp);
    expect(idsCoord).toContain(IDS.duplaHibDpp);

    const jwtMentor = await jwtDoUsuario(
      process.env.E2E_MENTOR_EMAIL ?? "",
      SENHA_STAFF
    );
    try {
      // o mesmo escopo vale pra RPC — um mentor nudando o mentor de outra
      // dupla (ou mesmo o mentor da própria) recebe sem_permissao: pra
      // mentor DPP a RPC só aceita destino 'mentorado' na PRÓPRIA dupla.
      // E o gate é NULL-safe: a dupla híbrida NÃO é supervisionada
      // (supervisor_id NULL) — antes do fix, "NULL = v_me" virava NULL e o
      // NOT passava. Agora supervisor JWT nela recebe sem_permissao.
      const rpcSup = await restComoUsuario("rpc/enviar_lembrete", jwtSup, {
        method: "POST",
        body: { p_dupla_id: IDS.duplaHibDpp, p_destino: "mentor" },
      });
      expect(rpcSup.status).toBe(200);
      expect(await rpcSup.json()).toMatchObject({
        ok: false,
        erro: "sem_permissao",
      });
      for (const [duplaId, destino] of [
        [IDS.dupla2, "mentorado"], // dupla de outro mentor
        [IDS.dupla, "mentor"], // a própria — destino vedado a mentor
      ] as const) {
        const rpc = await restComoUsuario("rpc/enviar_lembrete", jwtMentor, {
          method: "POST",
          body: { p_dupla_id: duplaId, p_destino: destino },
        });
        expect(rpc.status).toBe(200);
        const corpo = (await rpc.json()) as { ok: boolean; erro?: string };
        expect(corpo).toMatchObject({ ok: false, erro: "sem_permissao" });
      }
    } finally {
      // se o gate falhasse a RPC teria escrito — varre por garantia
      await limparViaServiceRole(
        "interacoes",
        `dupla_id=in.(${IDS.dupla},${IDS.dupla2})&tipo=eq.nudge` +
          `&autor_id=eq.${IDS.mentorProfile}`
      );
      await limparViaServiceRole(
        "notificacoes",
        `tipo=eq.lembrete&created_by=in.(${IDS.mentorProfile},${IDS.supProfile})`
      );
      await limparViaServiceRole(
        "interacoes",
        `dupla_id=eq.${IDS.duplaHibDpp}&tipo=eq.nudge&autor_id=eq.${IDS.supProfile}`
      );
    }
  });

  test("lembrete real pela fila — envia, registra, notifica e trava 48h", async ({
    page,
  }) => {
    const dupla = await convergirDupla2ParaFila();
    test.skip(
      !(await vigenteDaDupla(dupla)),
      "sem encontro vigente no cronograma da fixture — a fila não tem sinal"
    );
    const mentorId = dupla.mentor_id;
    expect(mentorId).toBeTruthy();

    // marca d'água do run — o cleanup só carrega o que nasceu depois daqui
    const t0 = new Date().toISOString();
    try {
      await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
      await page.goto("/agenda");

      // a dupla sem data cai na fila — as linhas mostram primeiro nome
      // ("Mentorada · Mentor"), que colide entre fixtures; o "Ver ficha ›"
      // com o href da dupla é o discriminante estável. A fila é um
      // role=group dentro do "Painel da semana" (REALIZA-195)
      const fila = page.locator(
        '[role="group"][aria-label="Duplas para acompanhar"]'
      );
      const linha = fila.locator("li", {
        has: page.locator(`a[href="/duplas/${IDS.dupla2}"]`),
      });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await expect(linha).toContainText(/sem data|atrasad|pendente/i);

      // se o mentor tiver whatsapp válido a UI abre o wa.me junto — fecha o
      // popup sem deixar a aba pendurada no runner
      page.on("popup", (popup) => popup.close().catch(() => {}));

      const lembrar = linha.getByRole("button", {
        name: /^Lembrar( .*)?$/,
      });
      await expect(lembrar).toBeEnabled();
      await lembrar.click();
      await expect(page.getByText("Lembrete enviado.")).toBeVisible({
        timeout: 15_000,
      });

      // readback no banco — a RPC loga a interação e notifica o mentor
      const nudges = await buscarViaServiceRole<{ id: string; nota: string }[]>(
        "interacoes",
        `select=id,nota&dupla_id=eq.${IDS.dupla2}&tipo=eq.nudge` +
          `&autor_id=eq.${IDS.coordProfile}&canal=eq.in_app&created_at=gte.${t0}`
      );
      expect(nudges).toHaveLength(1);
      expect(nudges[0].nota).toBe("lembrete → mentor");

      const notifs = await buscarViaServiceRole<
        { id: string; titulo: string; href: string }[]
      >(
        "notificacoes",
        `select=id,titulo,href&profile_id=eq.${mentorId}&tipo=eq.lembrete` +
          `&created_by=eq.${IDS.coordProfile}&created_at=gte.${t0}`
      );
      expect(notifs).toHaveLength(1);
      expect(notifs[0].titulo).toMatch(/^Lembrete — /);
      expect(notifs[0].href).toBe(`/duplas/${IDS.dupla2}`);

      // o cap de 48h chega na UI: refresh → a linha mostra "Lembrada dd/mm"
      // desabilitado com a razão no title
      await page.reload();
      const bloqueada = fila
        .locator("li", {
          has: page.locator(`a[href="/duplas/${IDS.dupla2}"]`),
        })
        .getByRole("button", { name: /^Lembrada \d{2}\/\d{2}$/ });
      await expect(bloqueada).toBeVisible({ timeout: 15_000 });
      await expect(bloqueada).toBeDisabled();
      await expect(bloqueada).toHaveAttribute(
        "title",
        /1 lembrete a cada 48h por dupla — destrava \d{2}\/\d{2}/
      );

      // e o mesmo cap barra na RPC — segundo envio como coord devolve o
      // intervalo com o carimbo de quando libera
      const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
      const retry = await restComoUsuario("rpc/enviar_lembrete", jwtCoord, {
        method: "POST",
        body: { p_dupla_id: IDS.dupla2, p_destino: "mentor" },
      });
      expect(retry.status).toBe(200);
      const corpoRetry = (await retry.json()) as {
        ok: boolean;
        erro?: string;
        bloqueado_ate?: string;
      };
      expect(corpoRetry.ok).toBe(false);
      expect(corpoRetry.erro).toBe("intervalo_48h");
      expect(corpoRetry.bloqueado_ate).toBeTruthy();
    } finally {
      // só o que este run criou — a dupla fixture, o mentor e qualquer
      // interação/notificação pré-existente ficam intocados
      await limparViaServiceRole(
        "interacoes",
        `dupla_id=eq.${IDS.dupla2}&tipo=eq.nudge&autor_id=eq.${IDS.coordProfile}` +
          `&created_at=gte.${t0}`
      );
      await limparViaServiceRole(
        "notificacoes",
        `profile_id=eq.${mentorId}&tipo=eq.lembrete` +
          `&created_by=eq.${IDS.coordProfile}&created_at=gte.${t0}`
      );
    }
  });
});
