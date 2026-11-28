import {
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
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
//     aceite da dupla a põe pra valer — o outro lado é avisado, não
//     fica devendo aceite;
//   · 0245 "propor não é decidir pela dupla": a EQUIPE cobre recesso
//     pendente com suposição origem 'proposta' no escopo (pausa por
//     default) sem escrever dupla_recessos — membro que tenta suposição
//     é recusado. No aceite a RPC resolve cada suposição (decisão do
//     gesto quando veio, senão a própria) com a autoria de quem
//     respondeu e revalida as datas ANTES de escrever — troca que muda
//     data morre na RPC em vez de gravar combinado inválido;
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
const MENTOR_PROFILE = "e2e00000-0000-4000-8000-000000000010";

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
  ) as Promise<{
    ok?: boolean;
    error?: string;
    id?: string;
    versao?: number;
    status?: string;
    sessao_id?: string;
    idempotente?: boolean;
    substituido?: boolean;
  }>;

const propor = (jwt: string, dupla = DUPLA, esc = escopo([3, 4])) =>
  rpc(jwt, "plano_propor", { p_dupla: dupla, p_escopo: esc, p_via: "app" });

const responder = (
  jwt: string,
  plano: string,
  acao: string,
  motivo?: string,
  // 0245: o aceite pode levar a decisão repensada da dupla — a RPC a
  // persiste com a autoria de quem respondeu
  decisoes?: { cicloEventoId: string; usa: boolean }[]
) =>
  rpc(jwt, "plano_responder", {
    p_plano: plano,
    p_acao: acao,
    p_motivo: motivo ?? null,
    p_decisoes: decisoes ?? null,
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

const substituir = (
  jwt: string,
  plano: string,
  esc = escopo([3, 4]),
  motivo = "A decisão de recesso mudou no aceite — versão recalculada."
) =>
  rpc(jwt, "plano_substituir", {
    p_plano: plano,
    p_dupla: DUPLA,
    p_escopo: esc,
    p_motivo: motivo,
    p_via: "app",
  });

const aplicarSessao = (jwt: string, plano: string, dataHora: string) =>
  rpc(jwt, "plano_aplicar_sessao", {
    p_plano: plano,
    p_numeros: [3, 4],
    p_data_hora: dataHora,
    p_duracao_min: 120,
    p_via: "app",
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

const addDias = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type RecessoEvento = { id: string; data: string; data_fim: string | null };
type PeriodoRecesso = { ini: string; fim: string };

/** Recessos do cronograma e2e e a janela que a suposição precisa pra
 *  existir: `pendentes` são os períodos ainda abertos (fim ≥ amanhã, a
 *  mesma régua dos recessosPendentes do planner); `fimJanela` leva o
 *  escopo até depois do último, pra pendência cruzar a janela em
 *  qualquer época — a fixture clona o dez–jan do calendário real e
 *  cobre boa parte do ano (a sazonalidade do piso). */
async function recessosDoCronograma() {
  const evs = await buscarViaServiceRole<RecessoEvento[]>(
    "ciclo_eventos",
    `cronograma_id=eq.${CRON}&tipo=eq.recesso&data=not.is.null&select=id,data,data_fim&order=data`
  );
  const pendentes = evs.filter((ev) => (ev.data_fim ?? ev.data) >= hoje(1));
  const periodos: PeriodoRecesso[] = pendentes.map((ev) => ({
    ini: ev.data,
    fim: ev.data_fim ?? ev.data,
  }));
  const fimJanela = addDias(
    [...periodos.map((p) => p.fim)].sort().at(-1) ?? hoje(30),
    14
  );
  return { pendentes, periodos, fimJanela };
}

type Reces = Awaited<ReturnType<typeof recessosDoCronograma>>;

/** Data fora de todo período: caiu dentro, pula pro dia seguinte ao fim
 *  e repete — suposição de pausa não deixa passo dentro do recesso. */
function dataForaDoRecesso(ymd: string, periodos: readonly PeriodoRecesso[]) {
  let d = ymd;
  for (;;) {
    const dentro = periodos.find((p) => d >= p.ini && d <= p.fim);
    if (!dentro) return d;
    d = addDias(dentro.fim, 1);
  }
}

/** Escopo da EQUIPE com suposição (0245): `decisoes.recessos` cobre cada
 *  recesso PENDENTE com origem 'proposta' — `usa` é a suposição (pausa
 *  por default) e nada vira dupla_recessos na proposta. As datas dos
 *  passos ficam fora de período em pausa; `dentroId` marca o recesso
 *  assumido "seguir" que recebe um passo dentro dele — o cenário da
 *  troca que mudaria a data combinada no aceite. */
function escopoSuposicao(
  { pendentes, periodos, fimJanela }: Reces,
  dentroId?: string
) {
  const alvo = pendentes.find((ev) => ev.id === dentroId);
  // fim ≥ amanhã pelo filtro: max(ini, amanhã) sempre cabe no período
  const dentro = alvo ? (alvo.data >= hoje(1) ? alvo.data : hoje(1)) : null;
  const d1 = dentro ?? dataForaDoRecesso(hoje(3), periodos);
  return {
    ...escopo([3, 4]),
    janela: { inicio: hoje(1), fim: fimJanela },
    passos: [
      { numero: 3, data: d1, acao: "agendar" },
      { numero: 4, data: dataForaDoRecesso(addDias(d1, 4), periodos), acao: "agendar" },
    ],
    decisoes: {
      recessos: pendentes.map((ev) => ({
        cicloEventoId: ev.id,
        usa: ev.id !== dentroId,
        origem: "proposta",
      })),
    },
  };
}

test.describe("plano ficar em dia persistido (459)", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test.beforeEach(async () => {
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("notificacoes", "tipo=eq.plano_proposto");
    await limparEncontrosDaDupla(DUPLA);
    await convergirDuplaAtiva(DUPLA);
    // o calendário e2e tem recesso (dez–jan) que cruza a janela hoje+30 boa
    // parte do ano: a proposta da DUPLA segue exigindo a decisão real —
    // a 0245 só destrava pendência coberta por suposição da EQUIPE no
    // escopo — e sem a row a proposta ouve 'falta a dupla confirmar o
    // recesso', flake sazonal, mesmo defeito do hoje() em UTC. O piso
    // registra "vamos seguir nos encontrando" (usa=false libera a data na
    // RPC); a proposta da equipe SEM decisão é cenário próprio que limpa
    // o piso, e a cobertura do recesso em si é do recesso.spec, mesma dupla
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
    // até ele dar ciência (aceite idempotente num plano valendo)
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
    // nasce valendo
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

  test("substituição no aceite é atômica: fecha a antiga e propõe a nova na mesma transação", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);

    const prop = await propor(jwtMentor);
    expect(prop).toMatchObject({ ok: true, versao: 1, status: "aceito" });

    const sub = await substituir(jwtMentor, prop.id!);
    expect(sub).toMatchObject({
      ok: true,
      versao: 2,
      status: "aceito",
      substituido: true,
    });
    expect(sub.id).toBeTruthy();

    const [antiga] = await buscarViaServiceRole<{ status: string }[]>(
      "dupla_planos",
      `id=eq.${prop.id!}&select=status`
    );
    expect(antiga.status).toBe("contestado");
    const [nova] = await buscarViaServiceRole<{ status: string }[]>(
      "dupla_planos",
      `id=eq.${sub.id!}&select=status`
    );
    expect(nova.status).toBe("aceito");

    // escopo inválido não pode deixar a dupla sem plano: o fechamento da
    // versão nova desfaz junto e a antiga continua valendo
    const falha = await substituir(jwtMentor, sub.id!, escopo([99]));
    expect(falha.error).toMatch(/fora da trilha|encontro/i);
    const [viva] = await buscarViaServiceRole<{ status: string }[]>(
      "dupla_planos",
      `id=eq.${sub.id!}&select=status`
    );
    expect(viva.status).toBe("aceito");
  });

  test("a notificação de proposta já nasce com autoria no banco", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);

    await propor(jwtMentor);
    const [n] = await buscarViaServiceRole<
      { titulo: string; corpo: string }[]
    >(
      "notificacoes",
      "tipo=eq.plano_proposto&order=created_at.desc&limit=1&select=titulo,corpo"
    );
    // a row do banco segue com a copy da RPC (migrations são do lead) —
    // a família "valer" é a reescrita de leitura do notificar.ts pro
    // membro da dupla, coberta no unit. Aqui o que interessa é a autoria
    // e a copy nova da 0237 no lugar da da 0225
    expect(n.titulo).toContain("em vigor");
    expect(n.corpo).toMatch(/combinou o plano/i);
    expect(n.corpo).not.toMatch(/Tem um plano pra vocês/);
  });

  test("plano_aplicar_sessao é idempotente no banco e recusa data diferente", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);

    const prop = await propor(jwtMentor);
    await responder(jwtJovem, prop.id!, "aceitar");
    const quando = `${hoje(3)}T19:00:00-03:00`;

    const s1 = await aplicarSessao(jwtMentor, prop.id!, quando);
    expect(s1).toMatchObject({ ok: true });
    expect(s1.sessao_id).toBeTruthy();

    const s2 = await aplicarSessao(jwtMentor, prop.id!, quando);
    expect(s2).toMatchObject({
      ok: true,
      idempotente: true,
      sessao_id: s1.sessao_id,
    });

    const rows = await buscarViaServiceRole<
      { numero: number; sessao_id: string | null }[]
    >(
      "encontros",
      `dupla_id=eq.${DUPLA}&numero=in.(3,4)&select=numero,sessao_id`
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sessao_id))).toEqual(
      new Set([s1.sessao_id])
    );

    const outraData = await aplicarSessao(
      jwtMentor,
      prop.id!,
      `${hoje(4)}T19:00:00-03:00`
    );
    expect(outraData.error).toMatch(/já está marcada/i);
  });

  test("fronteira de papel: lado propõe, estranho não responde, RLS trava", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    // 0225: o jovem também propõe — proposta de lado nasce "aceito" já
    // valendo, com o carimbo do lado dele
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
    // aceite da dupla é o que põe pra valer
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

  test("a equipe propõe com recesso pendente — suposição no escopo, aceite grava a decisão", async ({
    page,
  }) => {
    // 0245 "propor não é decidir pela dupla": o piso do arquivo grava a
    // decisão real pra fluir a proposta da DUPLA; aqui o cenário é a
    // pendência — a equipe cobre com suposição origem 'proposta' (pausa
    // por default) e nada entra em dupla_recessos até o aceite
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    const reces = await recessosDoCronograma();
    // a suposição só destrava pendência que cruza a janela — com o
    // recesso da fixture já encerrado não há o que assumir (a mesma
    // sazonalidade do piso: dez–jan cobre boa parte do ano)
    test.skip(
      reces.pendentes.length === 0,
      "recesso da fixture já passou — sem pendência a proposta não carrega suposição"
    );

    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    const esc = escopoSuposicao(reces);

    // pra dupla a decisão continua prévia: membro cobrindo pendência por
    // suposição é recusado, e sem suposição nem a equipe propõe — a
    // folga é prerrogativa de quem não decide
    expect((await propor(jwtMentor, DUPLA, esc)).error).toMatch(
      /decisão do recesso é da dupla|Declare o recesso/i
    );
    const semSuposicao = { ...esc, decisoes: {} };
    expect((await propor(jwtCoord, DUPLA, semSuposicao)).error).toMatch(
      /falta a dupla confirmar o recesso/i
    );

    // a equipe propõe — nasce "proposto" e NENHUMA linha entra em
    // dupla_recessos: decidir segue sendo gesto da dupla
    const prop = await propor(jwtCoord, DUPLA, esc);
    expect(prop).toMatchObject({ ok: true, status: "proposto" });
    expect(
      await buscarViaServiceRole(
        "dupla_recessos",
        `dupla_id=eq.${DUPLA}&select=id`
      )
    ).toHaveLength(0);

    // a RPC carimba a suposição no escopo e já avisa a dupla no sino com
    // o que a proposta considera — copy sem travessão
    const [gravado] = await buscarViaServiceRole<
      { escopo: { assumido?: boolean } }[]
    >("dupla_planos", `id=eq.${prop.id!}&select=escopo`);
    expect(gravado.escopo.assumido).toBe(true);
    const [sino] = await buscarViaServiceRole<{ corpo: string }[]>(
      "notificacoes",
      "tipo=eq.plano_proposto&order=created_at.desc&limit=1&select=corpo"
    );
    expect(sino.corpo).toMatch(/A proposta considera pausa/i);
    expect(sino.corpo).toMatch(/confirme ou troque antes de aceitar/i);

    // a dupla lê a mesma frase no card do combinado — com as duas
    // respostas à mão pra confirmar ou repensar antes do aceite
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA}`);
    const card = page.getByRole("region", {
      name: "Plano pra ficar em dia",
    });
    await expect(
      card.getByText(/A proposta considera pausa/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      card.getByText(/confirme ou troque antes de aceitar/i)
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Vamos seguir nos encontrando" })
    ).toBeVisible();

    // aceitar sem repensar confirma a suposição: cada pendência grava
    // dupla_recessos com a autoria de quem aceitou e o combinado entra
    // em vigor
    await card.getByRole("button", { name: "Aceitar" }).click();
    await expect
      .poll(async () => (await planoVivo())?.status, { timeout: 15_000 })
      .toBe("aceito");
    const decisoes = await buscarViaServiceRole<
      { ciclo_evento_id: string; usa: boolean; declarado_por: string | null }[]
    >("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    expect(decisoes).toHaveLength(reces.pendentes.length);
    for (const d of decisoes) {
      expect(d.usa).toBe(true);
      expect(d.declarado_por).toBe(MENTOR_PROFILE);
    }
  });

  test("trocar a suposição que muda as datas morre no aceite — a RPC revalida antes de gravar", async () => {
    // a decisão repensada no aceite viaja em p_decisoes (0245): quando
    // ela invalida uma data combinada a saída é contestar + recalcular,
    // nunca gravar combinado que já não vale — a revalidação roda antes
    // do primeiro write
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    const reces = await recessosDoCronograma();
    test.skip(
      reces.pendentes.length === 0,
      "recesso da fixture já passou — sem pendência não há troca pra medir"
    );

    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);

    // suposição "seguir" deixa um passo DENTRO do período — trocar pra
    // pausa no aceite mudaria a data combinada
    const ev = reces.pendentes[0];
    const esc = escopoSuposicao(reces, ev.id);
    const prop = await propor(jwtCoord, DUPLA, esc);
    expect(prop).toMatchObject({ ok: true, status: "proposto" });

    const troca = await responder(jwtMentor, prop.id!, "aceitar", undefined, [
      { cicloEventoId: ev.id, usa: true },
    ]);
    expect(troca.error).toMatch(/muda as datas/i);
    // revalidação antes da escrita: nada gravou e o plano segue
    // esperando a dupla
    expect(
      await buscarViaServiceRole(
        "dupla_recessos",
        `dupla_id=eq.${DUPLA}&select=id`
      )
    ).toHaveLength(0);
    expect((await planoVivo())?.status).toBe("proposto");

    // confirmando a suposição o aceite grava cada pendência com a
    // autoria de quem respondeu — seguir no período do passo, pausa nos
    // demais
    const ace = await responder(jwtMentor, prop.id!, "aceitar");
    expect(ace).toMatchObject({ ok: true, status: "aceito" });
    const rows = await buscarViaServiceRole<
      { ciclo_evento_id: string; usa: boolean; declarado_por: string | null }[]
    >("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    expect(rows).toHaveLength(reces.pendentes.length);
    expect(rows.find((r) => r.ciclo_evento_id === ev.id)?.usa).toBe(false);
    expect(rows.every((r) => r.declarado_por === MENTOR_PROFILE)).toBe(true);
  });
});
