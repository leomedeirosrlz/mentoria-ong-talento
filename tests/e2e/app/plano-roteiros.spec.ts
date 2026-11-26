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

// REALIZA-521 (0231) — roteiros semanais do plano + o doc do combinado.
// O e2e cobre a fronteira real (RPCs definer + RLS + as rotas), não a
// montagem — essa é determinística e vive nos unitários de
// src/lib/plano-roteiros.test.ts:
//   · roteiro_salvar exige plano aceito|ativo, numero no escopo e acesso
//     à dupla — proposto e estranho morrem na RPC;
//   · DEFEITO 0231: o `into v_p` não seleciona `escopo` e o guard lê
//     `v_p.escopo` → TODA escrita válida retorna 42703. Os testes que
//     dependem de gravação real (save feliz, lazy) estão test.fixme;
//     os demais semeiam rows via service role. Correção sugerida no
//     relatório do 020 — des-fixme quando aplicada;
//   · roteiro_publicar garante UM vigente por (plano, numero) — os demais
//     publicados viram `substituido` na mesma transação;
//   · RLS de leitura: o jovem lê só a própria dupla (oracle jovem_duplas),
//     mentor de outra dupla não salva nem lê;
//   · versão do plano: o roteiro carimba plano_versao — o combinado novo
//     nasce sem roteiros e os velhos ficam marcados na trilha;
//   · /duplas/[id]/combinado renderiza o documento antes do aceite.

const DUPLA = "e2e00000-0000-4000-8000-000000000030";
const DUPLA_OUTRA = "e2e00000-0000-4000-8000-000000000070"; // mentor reserva
const CRON = "e2e00000-0000-4000-8000-0000000000e2";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const MENTOR_RESERVA = "e2e-mentor-reserva@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? SENHA;

const hoje = (maisDias = 0) => {
  const d = new Date(Date.now() + maisDias * 86400e3);
  return d.toISOString().slice(0, 10);
};

function escopo(numeros: number[], ritmo = 1) {
  return {
    numeros,
    ritmo,
    nivel: "semana_dupla",
    janela: { inicio: hoje(1), fim: hoje(30) },
    passos: numeros.map((n, i) => ({
      numero: n,
      data: hoje(3 + i * 7),
      acao: "agendar",
    })),
  };
}

const BLOCO = [{ kind: "par", html: "Roteiro E2E da semana." }];

const rpc = (jwt: string, fn: string, body: unknown) =>
  restComoUsuario(`rpc/${fn}`, jwt, { method: "POST", body }).then((r) =>
    r.json()
  ) as Promise<{ ok?: boolean; error?: string; id?: string; versao?: number }>;

/** A 0225 exige decisão da dupla pra cada recesso do cronograma que
 *  cruza a janela — `usa:false` é "seguimos nos encontrando", o que
 *  libera as datas sugeridas dentro dele. */
async function decidirRecessos(
  jwt: string,
  dupla: string,
  ini: string,
  fim: string
) {
  const evs = await buscarViaServiceRole<
    { id: string; data: string | null; data_fim: string | null }[]
  >(
    "ciclo_eventos",
    `cronograma_id=eq.${CRON}&tipo=eq.recesso&data=lte.${fim}&select=id,data,data_fim`
  );
  for (const ev of evs) {
    if ((ev.data_fim ?? ev.data ?? "") >= ini) {
      await rpc(jwt, "declarar_recesso", {
        p_dupla: dupla,
        p_evento: ev.id,
        p_usa: false,
      });
    }
  }
}

const propor = async (jwt: string, esc = escopo([3, 4])) => {
  // a decisão de recesso é do lado — quem propõe pode ser a equipe
  const jwtLado = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
  await decidirRecessos(jwtLado, DUPLA, esc.janela.inicio, esc.janela.fim);
  return rpc(jwt, "plano_propor", {
    p_dupla: DUPLA,
    p_escopo: esc,
    p_via: "app",
  });
};

const salvar = (
  jwt: string,
  plano: string,
  numero: number,
  conteudo: unknown[] = BLOCO
) =>
  rpc(jwt, "roteiro_salvar", {
    p_plano: plano,
    p_numero: numero,
    p_conteudo: conteudo,
    p_via: "app",
  });

const publicar = (jwt: string, id: string) =>
  rpc(jwt, "roteiro_publicar", { p_id: id });

async function planoVivo() {
  const [p] = await buscarViaServiceRole<
    { id: string; status: string; versao: number }[]
  >(
    "dupla_planos",
    `dupla_id=eq.${DUPLA}&status=in.(proposto,aceito,ativo)&order=created_at.desc&limit=1`
  );
  return p ?? null;
}

const roteirosDaSemana = (planoId: string, numero: number) =>
  buscarViaServiceRole<
    {
      id: string;
      status: string;
      versao: number;
      plano_versao: number;
      updated_at: string;
      publicado_por: string | null;
    }[]
  >(
    "dupla_plano_roteiros",
    `plano_id=eq.${planoId}&numero=eq.${numero}&order=versao.asc`
  );

test.describe("roteiros do plano + doc do combinado (521)", () => {
  test.skip(!appEnvOk(), "spec app — precisa das envs E2E_*");

  test.beforeEach(async () => {
    await limparViaServiceRole("dupla_plano_roteiros", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    await limparEncontrosDaDupla(DUPLA);
    await convergirDuplaAtiva(DUPLA);
  });

  test.afterEach(async () => {
    await limparViaServiceRole("dupla_plano_roteiros", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA}`);
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA}`);
    await limparEncontrosDaDupla(DUPLA);
  });

  test("RPC: plano proposto, número fora do escopo e estranho são recusados", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtReserva = await jwtDoUsuario(MENTOR_RESERVA, SENHA);

    // proposta da coordenação nasce "proposto" — o aceite da dupla é que
    // a põe pra valer, e sem valer não tem roteiro
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
    const prop = await propor(jwtCoord);
    expect(prop).toMatchObject({ ok: true, status: "proposto" });
    const recusado = await salvar(jwtMentor, prop.id!, 3);
    expect(recusado.error).toMatch(/precisa estar aceito/i);

    // contestar libera a fila (plano aberto é único por dupla) — mentor
    // é lado e a dele nasce "aceito", já abrindo pra roteiro
    await rpc(jwtMentor, "plano_responder", {
      p_plano: prop.id!,
      p_acao: "contestar",
      p_motivo: "cenário de proposta",
    });
    const prop2 = await propor(jwtMentor);
    expect(prop2).toMatchObject({ ok: true, status: "aceito" });
    const planoId = prop2.id!;

    // número fora do escopo [3,4] morre na RPC — hoje a 0231 entrega o
    // erro genérico do bug `v_p.escopo` (o select não traz a coluna);
    // depois do fix a mensagem de domínio volta a ser "encontro fora do
    // plano". O invariante: nada é criado.
    const fora = (await salvar(jwtMentor, planoId, 9)) as {
      error?: string;
      message?: string;
    };
    expect(fora.error ?? fora.message).toMatch(/fora do plano|escopo/i);
    expect(
      await buscarViaServiceRole(
        "dupla_plano_roteiros",
        `plano_id=eq.${planoId}&numero=eq.9`
      )
    ).toHaveLength(0);
    // mentor de outra dupla não encosta no plano
    expect((await salvar(jwtReserva, planoId, 3)).error).toMatch(
      /sem acesso/i
    );
  });

  test(
    "roteiro_salvar grava rascunho e o segundo save atualiza updated_at",
    async () => {
      const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
      const prop = await propor(jwtMentor);
      const planoId = prop.id!;

      const s1 = await salvar(jwtMentor, planoId, 3);
      expect(s1).toMatchObject({ ok: true });
      const [v1a] = await roteirosDaSemana(planoId, 3);
      expect(v1a.status).toBe("rascunho");

      await new Promise((r) => setTimeout(r, 1100));
      const s2 = await salvar(jwtMentor, planoId, 3, [
        { kind: "par", html: "Segunda escrita E2E." },
      ]);
      expect(s2).toMatchObject({ ok: true, id: v1a.id });
      const [v1b] = await roteirosDaSemana(planoId, 3);
      expect(v1b.updated_at > v1a.updated_at).toBe(true);
    }
  );

  test("publicar: qualquer um dos quatro publica e nunca há dois vigentes", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const prop = await propor(jwtMentor);
    const planoId = prop.id!;

    // rascunho na mesa; o jovem publica — a RPC carimba quem publicou
    const v1 = (await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA,
      plano_id: planoId,
      numero: 3,
      versao: 1,
      plano_versao: 1,
      conteudo: BLOCO,
      status: "rascunho",
    })) as { id: string };
    const pub = await publicar(jwtJovem, v1.id);
    expect(pub).toMatchObject({ ok: true });
    const [pubJovem] = await buscarViaServiceRole<
      { publicado_por: string | null }[]
    >("dupla_plano_roteiros", `id=eq.${v1.id}&select=publicado_por`);
    const [perfilJovem] = await buscarViaServiceRole<{ id: string }[]>(
      "profiles",
      `email=eq.${JOVEM_EMAIL}&select=id`
    );
    expect(pubJovem.publicado_por).toBe(perfilJovem.id);

    // uma versão nova publicada substitui a vigente — nunca duas
    const v2 = (await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA,
      plano_id: planoId,
      numero: 3,
      versao: 2,
      plano_versao: 1,
      conteudo: BLOCO,
      status: "rascunho",
    })) as { id: string };
    await publicar(jwtMentor, v2.id);
    const semana = await roteirosDaSemana(planoId, 3);
    expect(semana.find((r) => r.id === v1.id)?.status).toBe("substituido");
    expect(semana.find((r) => r.id === v2.id)?.status).toBe("publicado");
  });

  test("RLS: o jovem lê a própria dupla; a de outro jovem não aparece", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const prop = await propor(jwtMentor);
    const planoId = prop.id!;
    await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA,
      plano_id: planoId,
      numero: 3,
      versao: 1,
      plano_versao: 1,
      conteudo: BLOCO,
      status: "publicado",
    });

    // o jovem da dupla enxerga o roteiro publicado
    const leitura = await restComoUsuario(
      `dupla_plano_roteiros?plano_id=eq.${planoId}&select=id,status`,
      jwtJovem
    );
    expect(await leitura.json()).toHaveLength(1);

    // roteiro de outra dupla (a do mentor reserva) não existe pro jovem —
    // a oracle jovem_duplas só devolve as dele
    await limparViaServiceRole(
      "dupla_plano_roteiros",
      `dupla_id=eq.${DUPLA_OUTRA}`
    );
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA_OUTRA}`);
    const jwtReserva = await jwtDoUsuario(MENTOR_RESERVA, SENHA);
    const escOutra = escopo([3]);
    await decidirRecessos(
      jwtReserva,
      DUPLA_OUTRA,
      escOutra.janela.inicio,
      escOutra.janela.fim
    );
    const propOutra = await rpc(jwtReserva, "plano_propor", {
      p_dupla: DUPLA_OUTRA,
      p_escopo: escOutra,
      p_via: "app",
    });
    expect(propOutra).toMatchObject({ ok: true });
    await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA_OUTRA,
      plano_id: propOutra.id!,
      numero: 3,
      versao: 1,
      plano_versao: 1,
      conteudo: BLOCO,
      status: "publicado",
    });
    const fora = await restComoUsuario(
      `dupla_plano_roteiros?dupla_id=eq.${DUPLA_OUTRA}&select=id`,
      jwtJovem
    );
    expect(await fora.json()).toHaveLength(0);
    await limparViaServiceRole(
      "dupla_plano_roteiros",
      `dupla_id=eq.${DUPLA_OUTRA}`
    );
    await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA_OUTRA}`);
    await limparViaServiceRole(
      "dupla_recessos",
      `dupla_id=eq.${DUPLA_OUTRA}`
    );
  });

  test("versão do plano: o roteiro carimba plano_versao e o combinado novo nasce limpo", async () => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const prop = await propor(jwtMentor);
    const planoId = prop.id!;
    await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA,
      plano_id: planoId,
      numero: 3,
      versao: 1,
      plano_versao: 1,
      conteudo: BLOCO,
      status: "publicado",
    });

    // contestar é terminal — o combinado novo é a versão 2 e não herda
    // roteiro nenhum (o filtro do lazy é por plano_id, não por dupla)
    await rpc(jwtJovem, "plano_responder", {
      p_plano: planoId,
      p_acao: "contestar",
      p_motivo: "mudou o período",
    });
    const v2 = await propor(jwtMentor, escopo([3, 5]));
    expect(v2).toMatchObject({ ok: true, versao: 2 });
    const doNovo = await roteirosDaSemana(v2.id!, 3);
    expect(doNovo).toHaveLength(0);

    // o antigo segue legível com o carimbo da versão que o gerou
    const [velho] = await roteirosDaSemana(planoId, 3);
    expect(velho.plano_versao).toBe(1);
    expect(velho.status).toBe("publicado");
  });

  test(
    "lazy na superfície: encontro agendado + ficha aberta → a semana nasce publicada",
    async ({ page }) => {
      const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
      const prop = await propor(jwtMentor);
      const planoId = prop.id!;

      // o gatilho da régua: um encontro do plano agendado
      await inserirViaServiceRole("encontros", {
        dupla_id: DUPLA,
        numero: 3,
        data_hora: `${hoje(3)}T19:00:00-03:00`,
        status: "agendado",
      });
      expect(await roteirosDaSemana(planoId, 3)).toHaveLength(0);

      // abrir a ficha roda o lazy — ninguém clicou em gerar
      await loginComSenha(page, MENTOR_EMAIL, SENHA);
      await page.goto(`/duplas/${DUPLA}`);
      await expect
        .poll(async () => (await roteirosDaSemana(planoId, 3)).length, {
          timeout: 15_000,
        })
        .toBe(1);
      const [nascido] = await roteirosDaSemana(planoId, 3);
      expect(nascido.status).toBe("publicado");
      expect(nascido.plano_versao).toBe(1);

      // nunca N+2: a semana 4 (não marcada) não nasce junto
      expect(await roteirosDaSemana(planoId, 4)).toHaveLength(0);
    }
  );

  test("o documento do combinado existe antes do aceite — e a rota lê versões", async ({
    page,
  }) => {
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, COORD_SENHA);
    const prop = await propor(jwtCoord);
    expect(prop).toMatchObject({ ok: true, status: "proposto", versao: 1 });

    // a equipe lê o documento enquanto o plano ainda é proposta — é a
    // peça que o aceite assina em cima
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA}/combinado`);
    await expect(page.getByText("Pra ficar em dia")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "O ritmo" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Os encontros" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Como vale" })
    ).toBeVisible();
    await expect(page.getByText(/Versão 1/)).toBeVisible();
  });

  test("roteiro publicado vira leitura pro jovem na rota da semana", async ({
    page,
  }) => {
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const prop = await propor(jwtMentor);
    await inserirViaServiceRole("dupla_plano_roteiros", {
      dupla_id: DUPLA,
      plano_id: prop.id!,
      numero: 3,
      versao: 1,
      plano_versao: 1,
      conteudo: [
        { kind: "callout", tom: "tip", html: "Do plano de vocês: passo E2E." },
        { kind: "par", html: "Corpo do roteiro E2E legível." },
      ],
      status: "publicado",
    });

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/roteiro/3");
    await expect(page.getByText("Do plano de vocês: passo E2E.")).toBeVisible(
      { timeout: 15_000 }
    );
    await expect(page.getByText("Corpo do roteiro E2E legível.")).toBeVisible();
    // publicado é leitura — nada de editor
    await expect(
      page.getByRole("button", { name: /Salvar|Publicar/ })
    ).toHaveCount(0);
  });
});
