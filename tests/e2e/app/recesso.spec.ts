import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  jwtDoUsuario,
  limparViaServiceRole,
  loginComSenha,
  restComoUsuario,
  test,
} from "../helpers";

// REALIZA-462/518 — recesso opcional por dupla (migrations 0218/0225). O
// e2e cobre a fronteira real em staging:
//   · a RPC declarar_recesso é a ÚNICA porta de escrita — a 0225
//     restringiu a decisão aos DOIS lados da dupla: mentor e mentorado
//     declaram; coordenação, mentor de outra dupla e insert direto
//     levam a recusa de domínio;
//   · (dupla, evento) é único — a última declaração vale, com autoria;
//   · a leitura é escopada: o jovem lê a decisão da própria dupla pela
//     tabela (RLS) e as janelas pela jovem_recessos — usa null é o
//     tri-estado "pendente" (sem row = a dupla ainda não decidiu);
//   · na ficha, o mentor declara pela UI e a decisão aparece.
// Domínio puro (planner/semáforo/agenda) está em tests/recesso-dupla.test.ts.

const DUPLA = "e2e00000-0000-4000-8000-000000000030";
const DUPLA_OUTRA = "e2e00000-0000-4000-8000-000000000070"; // mentor reserva
const MENTOR_PROFILE = "e2e00000-0000-4000-8000-000000000010";
const CRON = "e2e00000-0000-4000-8000-0000000000e2";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

type RecessoRow = {
  dupla_id: string;
  ciclo_evento_id: string;
  usa: boolean;
  declarado_por: string | null;
  declarado_em: string;
};

async function recessoDoCronograma(): Promise<{ id: string }> {
  const [ev] = await buscarViaServiceRole<{ id: string }[]>(
    "ciclo_eventos",
    `cronograma_id=eq.${CRON}&tipo=eq.recesso&select=id&order=data&limit=1`
  );
  return ev;
}

async function declarar(
  jwt: string,
  dupla: string,
  evento: string,
  usa: boolean
) {
  const res = await restComoUsuario("rpc/declarar_recesso", jwt, {
    method: "POST",
    body: { p_dupla: dupla, p_evento: evento, p_usa: usa },
  });
  return res.json() as Promise<{ ok?: boolean; error?: string }>;
}

test.describe("recesso opcional (462) — declarar_recesso", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test.afterEach(async () => {
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
  });

  test("mentor da dupla declara; última vale com autoria e data", async () => {
    const ev = await recessoDoCronograma();
    const jwt = await jwtDoUsuario(MENTOR_EMAIL, SENHA);

    const r1 = await declarar(jwt, DUPLA, ev.id, false);
    expect(r1).toEqual({ ok: true });

    let rows = await buscarViaServiceRole<RecessoRow[]>(
      "dupla_recessos",
      `dupla_id=eq.${DUPLA}&ciclo_evento_id=eq.${ev.id}`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].usa).toBe(false);
    expect(rows[0].declarado_por).toBe(MENTOR_PROFILE);
    expect(rows[0].declarado_em).toBeTruthy();

    // redeclarar atualiza a MESMA linha — última decisão vale
    const r2 = await declarar(jwt, DUPLA, ev.id, true);
    expect(r2).toEqual({ ok: true });
    rows = await buscarViaServiceRole<RecessoRow[]>(
      "dupla_recessos",
      `dupla_id=eq.${DUPLA}&ciclo_evento_id=eq.${ev.id}`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].usa).toBe(true);
  });

  test("tri-estado: o jovem também decide; equipe e estranho recusam", async () => {
    const ev = await recessoDoCronograma();
    const [encontro] = await buscarViaServiceRole<{ id: string }[]>(
      "ciclo_eventos",
      `cronograma_id=eq.${CRON}&tipo=eq.encontro&select=id&order=data&limit=1`
    );
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    // 0225: a decisão é SÓ da dupla — o mentorado declara igual o mentor
    expect(await declarar(jwtJovem, DUPLA, ev.id, false)).toEqual({
      ok: true,
    });

    // a equipe vê e cobra, não decide: coord leva a recusa do banco
    expect(await declarar(jwtCoord, DUPLA, ev.id, true)).toMatchObject({
      error: expect.stringMatching(/só a dupla/i),
    });
    // mentor DPP logado, mas a dupla não é dele
    expect(await declarar(jwtMentor, DUPLA_OUTRA, ev.id, false)).toMatchObject(
      { error: expect.stringMatching(/só a dupla/i) }
    );
    // o evento precisa ser recesso do cronograma dela
    expect(await declarar(jwtMentor, DUPLA, encontro.id, false)).toMatchObject(
      { error: expect.stringMatching(/recesso/) }
    );
  });

  test("insert direto na tabela morre no RLS — a escrita é só pela RPC", async () => {
    const ev = await recessoDoCronograma();
    const jwt = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const res = await restComoUsuario("dupla_recessos", jwt, {
      method: "POST",
      body: {
        dupla_id: DUPLA,
        ciclo_evento_id: ev.id,
        usa: false,
      },
    });
    // policy de escrita não existe pra authenticated → 401/403
    expect([401, 403]).toContain(res.status);
  });

  test("leitura escopada: o jovem vê a decisão da própria dupla e a janela", async () => {
    const ev = await recessoDoCronograma();
    // 0225: quem declara é a dupla — o mentor grava a decisão que o jovem lê
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    expect(await declarar(jwtMentor, DUPLA, ev.id, false)).toEqual({
      ok: true,
    });

    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const res = await restComoUsuario(
      `dupla_recessos?dupla_id=eq.${DUPLA}&select=usa,ciclo_evento_id`,
      jwtJovem
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { usa: boolean; ciclo_evento_id: string }[];
    expect(rows).toEqual([
      { usa: false, ciclo_evento_id: ev.id },
    ]);

    // e a janela chega pela jovem_recessos (o papel não lê ciclo_eventos)
    const jr = await restComoUsuario("rpc/jovem_recessos", jwtJovem, {
      method: "POST",
      body: {},
    });
    expect(jr.status).toBe(200);
    const janelas = (await jr.json()) as {
      ciclo_evento_id: string;
      usa: boolean;
    }[];
    expect(janelas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ciclo_evento_id: ev.id, usa: false }),
      ])
    );
  });

  test("na ficha, o mentor declara e a decisão aparece", async ({ page }) => {
    const ev = await recessoDoCronograma();
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA}`);

    // a decisão mora no card "Para ficar em dia" quando o plano está na
    // tela e segue em card próprio sem ele — o gesto é o mesmo
    await page
      .getByRole("button", { name: "Vamos seguir nos encontrando" })
      .click();
    await expect(
      page.getByText("seguem se encontrando")
    ).toBeVisible({ timeout: 15_000 });

    const rows = await buscarViaServiceRole<RecessoRow[]>(
      "dupla_recessos",
      `dupla_id=eq.${DUPLA}&ciclo_evento_id=eq.${ev.id}`
    );
    expect(rows[0]?.usa).toBe(false);
    expect(rows[0]?.declarado_por).toBe(MENTOR_PROFILE);
  });
});
