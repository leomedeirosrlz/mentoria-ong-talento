import {
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  restComoUsuario,
  test,
} from "../helpers";

// REALIZA-459/513 (0219+0224) — o plano "ficar em dia" persistido. O e2e
// cobre a fronteira real em staging, não a UI (o card é projeção das
// mesmas RPCs):
//   · plano_propor fala coord, supervisor da dupla ou o mentor dela —
//     jovem, mentor de outra dupla e insert direto morrem na fronteira;
//   · a proposta é única por dupla (segundo plano aberto é recusado) e o
//     ritmo vale 1–7 (0224 — até 1 encontro por dia);
//   · aceite é BILATERAL (0224): o mentor que propõe já carrega o aceite
//     dele (aceito_mentor_em), mas o plano só sai de "proposto" quando o
//     outro lado responde — um lado sozinho não abre o plano;
//   · contestar é terminal — plano novo nasce versão+1, nunca reabre;
//   · plano_aplicar_passo é definer com guard de membro: só escopo, só
//     futuro dentro da janela, idempotente no par (plano, numero) e
//     atômico com a linha do encontro;
//   · jovem_plano devolve o combinado + os dois aceites — nada de
//     semáforo/motivo interno.
// Domínio (nível FR-011, overlay do semáforo) está em tests/plano-overlay.test.ts.

const DUPLA = "e2e00000-0000-4000-8000-000000000030";
const DUPLA_OUTRA = "e2e00000-0000-4000-8000-000000000070"; // mentor reserva
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

const hoje = (maisDias = 0) => {
  const d = new Date(Date.now() + maisDias * 86400e3);
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
  });

  test.afterEach(async () => {
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparEncontrosDaDupla(DUPLA);
  });

  test("mentor propõe, jovem aceita, mentor aplica passo — o acordo vive", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);

    const prop = await propor(jwtMentor);
    expect(prop).toMatchObject({ ok: true, versao: 1 });
    const planoId = prop.id!;

    // um plano aberto por dupla — a segunda proposta morre na RPC
    const dup = await propor(jwtMentor);
    expect(dup.error).toMatch(/plano aberto/i);

    // 0224: quem propõe sendo mentor já carrega o aceite dele — mas o
    // plano SEGUE "proposto" até o outro lado responder
    let vivo = (await planoVivo())!;
    expect(vivo.status).toBe("proposto");
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
      status: "proposto",
      versao: 1,
      aceito_mentor: true,
      aceito_mentorado: false,
    });
    for (const k of ["semaforo", "motivo", "sinais", "aprovado_por"]) {
      expect(jp).not.toHaveProperty(k);
    }

    // o lado que falta é o do jovem — o aceite dele abre o plano
    const ace = await responder(jwtJovem, planoId, "aceitar");
    expect(ace).toEqual({ ok: true });
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

  test("ritmo vale 1–7 (0224): 7 = um encontro por dia, 0 e 8 recusam", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);

    // fora da faixa morre na proposta
    expect(
      (await propor(jwtMentor, DUPLA, escopo([3], 0))).error
    ).toBeTruthy();
    expect(
      (await propor(jwtMentor, DUPLA, escopo([3], 8))).error
    ).toBeTruthy();

    // ritmo 7 — o teto honesto do 513 — é aceito e segue proposto
    const prop = await propor(jwtMentor, DUPLA, escopo([3, 4], 7));
    expect(prop).toMatchObject({ ok: true, versao: 1 });
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
    expect(contesta).toEqual({ ok: true });

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

  test("fronteira de papel: jovem não propõe, estranho não responde, RLS trava", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    // jovem não propõe plano (0224: coord, supervisor da dupla ou mentor)
    expect((await propor(jwtJovem)).error).toBeTruthy();
    // mentor de outra dupla não propõe aqui — DUPLA_OUTRA é do mentor
    // reserva, não dele: o guard de membro recusa
    expect((await propor(jwtMentor, DUPLA_OUTRA)).error).toBeTruthy();

    // 0224: coordenação PODE propor — o combinado nasce "proposto" sem
    // nenhum aceite de lado (ela não é mentor nem mentorado)
    const prop = await propor(jwtCoord);
    expect(prop).toMatchObject({ ok: true });
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
