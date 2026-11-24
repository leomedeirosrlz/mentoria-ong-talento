import {
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  restComoUsuario,
  test,
} from "../helpers";

// REALIZA-459/513/518 (0219+0224+0225) — o plano "ficar em dia"
// persistido. O e2e cobre a fronteira real em staging, não a UI (o card é
// projeção das mesmas RPCs):
//   · plano_propor fala os dois lados da dupla, a coordenação e quem
//     supervisiona (auxiliar de turma entra pela RPC, não pelo campo
//     supervisor) — estranho e insert direto morrem na fronteira;
//   · a proposta é única por dupla (segundo plano aberto é recusado) e o
//     ritmo é escolha livre ≥1 (0225 — 8+ é válido, o espaçamento do
//     guia é que limita as datas);
//   · aceite é ÚNICO (0225): proposta de lado nasce "aceito" com o
//     carimbo do proponente; a da equipe nasce "proposto" e o primeiro
//     aceite da dupla a coloca em vigor — o outro lado é avisado, não
//     fica devendo aceite;
//   · contestar é terminal — plano novo nasce versão+1, nunca reabre;
//   · plano_aplicar_passo é definer com guard de membro: só escopo, só
//     futuro dentro da janela, idempotente no par (plano, numero) e
//     atômico com a linha do encontro;
//   · jovem_plano devolve o combinado + os dois aceites — nada de
//     semáforo/motivo interno.
// Domínio (nível FR-011, overlay do semáforo) está em tests/plano-overlay.test.ts.

const DUPLA = "e2e00000-0000-4000-8000-000000000030";
const DUPLA_OUTRA = "e2e00000-0000-4000-8000-000000000070"; // mentor reserva
const CRON = "e2e00000-0000-4000-8000-0000000000e2"; // cronograma da dupla
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

const hoje = (maisDias = 0) => {
  // mesma régua do servidor: dia civil em America/Sao_Paulo (toDateStr).
  // toISOString lê em UTC — entre 21h e 23h59 em SP a data UTC já é
  // amanhã e toda a janela/passo desloca um dia na virada
  const spYmd = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const d = new Date(`${spYmd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + maisDias);
  return d.toISOString().slice(0, 10);
};

/** Escopo no formato que a Liza/app monta: numeros + ritmo + janela +
 *  passos datados (o planner valida; a RPC grava verbatim). */
function escopo(numeros: number[], ritmo = 2) {
  return {
    numeros,
    ritmo,
    nivel: "semana_dupla",
    janela: { inicio: hoje(1), fim: hoje(30) },
    passos: numeros.map((n, i) => ({
      numero: n,
      data: hoje(3 + i * 4),
      acao: "agendar",
    })),
  };
}

const rpc = (jwt: string, fn: string, body: unknown) =>
  restComoUsuario(`rpc/${fn}`, jwt, { method: "POST", body }).then((r) =>
    r.json()
  ) as Promise<{ ok?: boolean; error?: string; id?: string; versao?: number }>;

const propor = (jwt: string, dupla = DUPLA, esc = escopo([3, 4])) =>
  rpc(jwt, "plano_propor", { p_dupla: dupla, p_escopo: esc, p_via: "app" });

const responder = (jwt: string, plano: string, acao: string, motivo?: string) =>
  rpc(jwt, "plano_responder", {
    p_plano: plano,
    p_acao: acao,
    p_motivo: motivo ?? null,
  });

const aplicar = (
  jwt: string,
  plano: string,
  numero: number,
  dataHora: string,
  extra: { p_motivo?: string } = {}
) =>
  rpc(jwt, "plano_aplicar_passo", {
    p_plano: plano,
    p_numero: numero,
    p_data_hora: dataHora,
    p_via: "app",
    ...extra,
  });

async function planoVivo() {
  const [p] = await buscarViaServiceRole<
    { id: string; status: string; versao: number }[]
  >(
    "dupla_planos",
    `dupla_id=eq.${DUPLA}&status=in.(proposto,aceito,ativo)&order=created_at.desc&limit=1`
  );
  return p ?? null;
}

test.describe("plano ficar em dia persistido (459)", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test.beforeEach(async () => {
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparEncontrosDaDupla(DUPLA);
    await convergirDuplaAtiva(DUPLA);
    // o calendário e2e tem recesso (dez–jan) que cruza a janela hoje+30 boa
    // parte do ano: sem a decisão da dupla, plano_propor devolve 'falta a
    // dupla confirmar o recesso' — flake sazonal, mesmo defeito do hoje()
    // em UTC. O piso registra "não vamos usar" (usa=false libera a data na
    // RPC); a cobertura do recesso em si é do recesso.spec, mesma dupla
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    const evs = await buscarViaServiceRole<{ id: string }[]>(
      "ciclo_eventos",
      `cronograma_id=eq.${CRON}&tipo=eq.recesso&select=id`
    );
    for (const ev of evs)
      await inserirViaServiceRole("dupla_recessos", {
        dupla_id: DUPLA,
        ciclo_evento_id: ev.id,
        usa: false,
      });
  });

  test.afterEach(async () => {
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    await limparEncontrosDaDupla(DUPLA);
  });

  test("mentor propõe, jovem aceita, mentor aplica passo — o acordo vive", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);

    const prop = await propor(jwtMentor);
    // 0225: proposta de lado nasce "aceito" — o combinado já está em
    // vigor; o outro lado é avisado, não fica devendo aceite
    expect(prop).toMatchObject({ ok: true, versao: 1, status: "aceito" });
    const planoId = prop.id!;

    // um plano aberto por dupla — a segunda proposta morre na RPC
    const dup = await propor(jwtMentor);
    expect(dup.error).toMatch(/plano aberto/i);

    // o carimbo do proponente nasce junto; o do outro lado segue vazio
    // até ele dar ciência (aceite idempotente num plano em vigor)
    let vivo = (await planoVivo())!;
    expect(vivo.status).toBe("aceito");
    const [carimbos] = await buscarViaServiceRole<
      { aceito_mentor_em: string | null; aceito_mentorado_em: string | null }[]
    >("dupla_planos", `id=eq.${planoId}&select=aceito_mentor_em,aceito_mentorado_em`);
    expect(carimbos.aceito_mentor_em).toBeTruthy();
    expect(carimbos.aceito_mentorado_em).toBeNull();

    // o jovem lê o combinado + os dois aceites — o recorte não vaza interno
    const jp = (await rpc(jwtJovem, "jovem_plano", {})) as Record<
      string,
      unknown
    >;
    expect(jp).toMatchObject({
      id: planoId,
      status: "aceito",
      versao: 1,
      aceito_mentor: true,
      aceito_mentorado: false,
    });
    for (const k of ["semaforo", "motivo", "sinais", "aprovado_por"]) {
      expect(jp).not.toHaveProperty(k);
    }

    // o jovem dá ciência — carimbo dele, o status não anda
    const ace = await responder(jwtJovem, planoId, "aceitar");
    expect(ace).toMatchObject({ ok: true });
    vivo = (await planoVivo())!;
    expect(vivo.status).toBe("aceito");

    // proposto → aplicar falha; aceito → aplica e vira ativo
    const quando = `${hoje(3)}T19:00:00-03:00`;
    const ap = await aplicar(jwtMentor, planoId, 3, quando);
    expect(ap).toMatchObject({ ok: true });
    vivo = (await planoVivo())!;
    expect(vivo.status).toBe("ativo");

    // a linha do encontro nasce agendada na data combinada
    const [enc] = await buscarViaServiceRole<
      { numero: number; data_hora: string; status: string }[]
    >("encontros", `dupla_id=eq.${DUPLA}&numero=eq.3`);
    expect(enc.status).toBe("agendado");
    expect(enc.data_hora.slice(0, 10)).toBe(hoje(3));

    // ledger do plano gravou o passo com autoria
    const [passo] = await buscarViaServiceRole<
      { numero: number; aplicado_por: string | null }[]
    >("dupla_plano_passos", `plano_id=eq.${planoId}&numero=eq.3`);
    expect(passo.aplicado_por).toBeTruthy();

    // idempotente: repetir o passo devolve o mesmo encontro
    const ap2 = await aplicar(jwtMentor, planoId, 3, `${hoje(4)}T19:00:00-03:00`);
    expect(ap2).toMatchObject({ ok: true, idempotente: true });
  });

  test("guards de domínio: escopo, janela e passado são recusados", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const prop = await propor(jwtMentor);
    const planoId = prop.id!;
    await responder(jwtJovem, planoId, "aceitar");

    // número fora do escopo [3,4]
    expect(
      (await aplicar(jwtMentor, planoId, 9, `${hoje(3)}T19:00:00-03:00`)).error
    ).toMatch(/não faz parte do plano/i);
    // data fora da janela (fim = hoje+30)
    expect(
      (await aplicar(jwtMentor, planoId, 3, `${hoje(45)}T19:00:00-03:00`)).error
    ).toMatch(/janela do plano/i);
    // nunca no passado
    expect(
      (await aplicar(jwtMentor, planoId, 3, `${hoje(-2)}T19:00:00-03:00`)).error
    ).toMatch(/data futura|pra frente/i);
  });

  test("ritmo é escolha livre ≥1 (0225): 0 recusa, 8+ é válido", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);

    // abaixo de 1 morre na proposta
    expect(
      (await propor(jwtMentor, DUPLA, escopo([3], 0))).error
    ).toBeTruthy();

    // acima de 7 é decisão da dupla — a RPC aceita (o espaçamento do guia
    // é que separa as datas, não o teto semanal); proposta de lado já
    // nasce em vigor
    const prop = await propor(jwtMentor, DUPLA, escopo([3, 4], 8));
    expect(prop).toMatchObject({ ok: true, versao: 1, status: "aceito" });
  });

  test("contestado é terminal — acordo novo é versão nova, nunca reabre", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);

    const prop = await propor(jwtMentor);
    const contesta = await responder(
      jwtJovem,
      prop.id!,
      "contestar",
      "essas datas não dão pra mim"
    );
    expect(contesta).toMatchObject({ ok: true, status: "contestado" });

    // terminal: nem aceitar nem contestar reabre
    expect(
      (await responder(jwtMentor, prop.id!, "aceitar")).error
    ).toMatch(/não está mais aberto/i);
    expect(
      (await responder(jwtJovem, prop.id!, "contestar")).error
    ).toMatch(/não está mais aberto/i);

    // novo acordo nasce como versão 2
    const v2 = await propor(jwtMentor);
    expect(v2).toMatchObject({ ok: true, versao: 2 });
  });

  test("fronteira de papel: lado propõe, estranho não responde, RLS trava", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    // 0225: o jovem também propõe — proposta de lado nasce "aceito" já
    // em vigor, com o carimbo do lado dele
    const propJovem = await propor(jwtJovem);
    expect(propJovem).toMatchObject({ ok: true, status: "aceito" });
    const [carimboJovem] = await buscarViaServiceRole<
      { aceito_mentor_em: string | null; aceito_mentorado_em: string | null }[]
    >("dupla_planos", `id=eq.${propJovem.id!}&select=aceito_mentor_em,aceito_mentorado_em`);
    expect(carimboJovem.aceito_mentor_em).toBeNull();
    expect(carimboJovem.aceito_mentorado_em).toBeTruthy();
    // o jovem tira o plano dele da frente pros cenários seguintes
    await responder(jwtJovem, propJovem.id!, "contestar");

    // mentor de outra dupla não propõe aqui — DUPLA_OUTRA é do mentor
    // reserva, não dele: o guard de membro recusa
    expect((await propor(jwtMentor, DUPLA_OUTRA)).error).toBeTruthy();

    // coordenação PODE propor — o combinado nasce "proposto" sem
    // nenhum aceite de lado (ela não é mentor nem mentorado): o primeiro
    // aceite da dupla é o que coloca em vigor
    const prop = await propor(jwtCoord);
    expect(prop).toMatchObject({ ok: true, status: "proposto" });
    const [carimbos] = await buscarViaServiceRole<
      { aceito_mentor_em: string | null; aceito_mentorado_em: string | null }[]
    >("dupla_planos", `id=eq.${prop.id!}&select=aceito_mentor_em,aceito_mentorado_em`);
    expect(carimbos.aceito_mentor_em).toBeNull();
    expect(carimbos.aceito_mentorado_em).toBeNull();

    // ...mas coordenação não é LADO — "só a dupla responde o plano"
    expect(
      (await responder(jwtCoord, prop.id!, "aceitar")).error
    ).toMatch(/só a dupla/i);

    // insert direto na tabela morre no RLS — escrita é só via RPC
    const direto = await restComoUsuario("dupla_planos", jwtMentor, {
      method: "POST",
      body: { dupla_id: DUPLA, escopo: escopo([5]), versao: 9 },
    });
    expect(direto.status).toBeGreaterThanOrEqual(400);
    const linhas = await buscarViaServiceRole<{ id: string }[]>(
      "dupla_planos",
      `dupla_id=eq.${DUPLA}&versao=eq.9`
    );
    expect(linhas).toHaveLength(0);
  });
});
