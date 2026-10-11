#!/usr/bin/env node
// seed-e2e-staging — fixtures mínimas pro e2e de app (backend real) num
// Supabase de TESTE descartável: o stack local do CI (`supabase start` no
// runner — e2e-app.yml) ou um projeto staging remoto. Idempotente.
//
// Uso (depois das migrations + seed.sql do domínio estarem aplicados):
//
//   E2E_SUPABASE_URL=http://127.0.0.1:54321 \  # ou https://<staging>.supabase.co
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   E2E_MENTOR_PASSWORD=<senha-de-teste> \
//   node scripts/seed-e2e-staging.mjs
//
// Cria: profile mentor_dpp + auth user (senha_em setada → pula definir-senha),
// mentorado e dupla DPP ativa no 1º cronograma; profile coordenacao + auth
// user (mesmo esquema de senha); um mentor reserva com a 2ª dupla; um
// mentorado livre (fila "Aguardando par" + alvo do remanejo) e um par livre
// pra importação CSV. E a fixture do shell /jovem (REALIZA-108): profile
// mentorado + auth user com a ficha da mentorada da dupla …0030 vinculada,
// combinado pendente (+ um do mentor, checagem negativa), encontro futuro
// e as duas assinaturas pendentes. E a fixture da avaliação estrela
// (REALIZA-109): um encontro realizado sem avaliação — o trigger minta o
// link /avaliar e a pendência do "Suas avaliações". E a fixture da agenda
// do especialista (REALIZA-111): profile mentor_especialista + auth user,
// mentor_profiles tipo 'especialista' (o aceite real a cria), uma trilha
// 'especialista' ativa com a MESMA mentorada da dupla DPP e uma janela de
// grade (terça 19:00–21:00) que alimenta a projeção de slots do jovem.
// IDs fixos e2e00000-*, que o workflow usa pra cleanup determinístico.

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const SENHA = process.env.E2E_MENTOR_PASSWORD;
// coord usa a mesma senha do mentor quando E2E_COORD_PASSWORD não vem — um
// segredo de teste a menos no CI local
const SENHA_COORD = process.env.E2E_COORD_PASSWORD || SENHA;

if (!URL_ || !KEY || !SENHA) {
  console.error("uso: E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY e E2E_MENTOR_PASSWORD");
  process.exit(2);
}
if (URL_.includes("yhjzmxleotahijinjepl")) {
  // mesmo hard-stop do helpers.ts — este script escreve de verdade
  console.error("E2E_SUPABASE_URL aponta pra produção — abortado");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, "Content-Type": "application/json", Prefer: "return=representation" };

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  dupla: "e2e00000-0000-4000-8000-000000000030",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  mentorReserva: "e2e00000-0000-4000-8000-000000000050",
  mentorado2: "e2e00000-0000-4000-8000-000000000060",
  dupla2: "e2e00000-0000-4000-8000-000000000070",
  mentoradoLivre: "e2e00000-0000-4000-8000-000000000080",
  mentorImport: "e2e00000-0000-4000-8000-000000000090",
  mentoradoImport: "e2e00000-0000-4000-8000-0000000000a0",
  // fixture do shell /jovem — ids convergem com a fixture manual que já
  // existe no staging (profile 00b0, combinados c1/c2, assinaturas a1/a2)
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  combinadoJovem: "e2e00000-0000-4000-8000-0000000000c1",
  combinadoMentor: "e2e00000-0000-4000-8000-0000000000c2",
  encontroJovem: "e2e00000-0000-4000-8000-0000000000d1",
  // REALIZA-109: encontro realizado SEM avaliação — o trigger minta o link
  // /avaliar e a pendência do "Suas avaliações". numero 16 fica fora do
  // ciclo esperado (as datas oficiais já passadas são as baixas), não come
  // um faltante do semáforo nem disputa o proximoNumero dos specs de agenda.
  encontroAvaliacao: "e2e00000-0000-4000-8000-0000000000d2",
  assinaturaTermo: "e2e00000-0000-4000-8000-0000000000a1",
  assinaturaAutoriz: "e2e00000-0000-4000-8000-0000000000a2",
  // REALIZA-111: o id do Esp E2E coincide com o da fixture manual que o
  // Thiago criou no staging (o …0060 do mentorado2 é OUTRA tabela — não
  // conflita). duplaEsp/gradeEsp são novos do seed.
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  gradeEsp: "e2e00000-0000-4000-8000-0000000000f0",
};
const EMAIL = "e2e-mentor@realiza.test";
const COORD_EMAIL = "e2e-coord@realiza.test";
const JOVEM_EMAIL = "jovem-e2e@realiza.test";
const ESP_EMAIL = "esp-e2e@realiza.test";
// alimenta o "Chamar no WhatsApp" do card "Horários de …" na /jovem/agenda
const ESP_WHATSAPP = "5511999000070";
// assinaturas.token é uuid — os tokens fixos da fixture manual do staging
const TOKEN_TERMO_JOVEM = "e2e00000-0000-4000-8000-0000000000aa";
const TOKEN_AUTORIZ_JOVEM = "e2e00000-0000-4000-8000-0000000000ab";
// turma que o spec de cronograma cria pelo builder — prefixo único pro
// cleanup não depender de id conhecido
const TURMA_E2E_PREFIX = "E2E ";

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...HJ, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
const del = (path) => rest(path, { method: "DELETE" });
const patch = (path, body) =>
  rest(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });

// ---- cronograma existente (o seed.sql do domínio já criou um) ----
const [cron] = await rest("cronogramas?select=id,turma&order=inicio_em&limit=1");
if (!cron) {
  console.error("nenhum cronograma no staging — rode `supabase db push` (migrations + seed) antes");
  process.exit(1);
}
console.log(`cronograma: ${cron.id} (${cron.turma})`);

// ---- limpeza de leftovers de runs anteriores ----
// o afterEach dos specs é a regra; isto é o piso pra quando um run morre no
// meio — sem ele, um remanejo/cronograma/import pendurado quebrava o run
// seguinte em cascata (dupla2 encerrada, "par já existe", turma duplicada).
{
  // filhos da 0071 primeiro: avaliacoes_encontro e avaliacao_links têm FK
  // pra encontros E pra duplas com NO ACTION — qualquer delete de dupla ou
  // de encontro abaixo bate em 409 se sobrar avaliação/link pendurado (e
  // o run manual do Thiago deixou vários). Abrange as fixtures E as duplas
  // que a limpeza apaga (sucessoras de remanejo, par do import, vínculos
  // do mentorado livre e QUALQUER outra dupla do mentorado do jovem que não
  // sejam as duas fixtures — uma leftover de trilha no staging roubava o
  // "dupla atual" do /jovem e ainda poluía o histórico de avaliações). O
  // log de e-mail de apoio sobrevive à avaliação — ref_id é solto de
  // propósito.
  const morrem = await rest(
    `duplas?select=id&or=(id.in.(${IDS.dupla},${IDS.dupla2},${IDS.duplaEsp}),remanejada_de.eq.${IDS.dupla2},mentor_id.eq.${IDS.mentorImport},mentorado_id.eq.${IDS.mentoradoLivre},and(mentorado_id.eq.${IDS.mentorado},id.not.in.(${IDS.dupla},${IDS.duplaEsp})))`
  );
  const morremIds = (morrem ?? []).map((d) => d.id);
  if (morremIds.length) {
    await del(`emails_enviados?tipo=eq.apoio_jovem`);
    await del(`avaliacoes_encontro?dupla_id=in.(${morremIds.join(",")})`);
    await del(`avaliacao_links?dupla_id=in.(${morremIds.join(",")})`);
    // apoio_jovem aponta pra ficha — pra qualquer coord real do staging,
    // não só as fixtures (o sweep por profile_id abaixo não os alcança)
    for (const dId of morremIds)
      await del(`notificacoes?tipo=eq.apoio_jovem&href=eq./duplas/${dId}`);
  }
  // as condenadas de verdade — as três duplas fixture ficam (a do jovem, a
  // dupla2 que só volta a 'ativa' e a trilha esp, também fixture). Filhos
  // NO ACTION primeiro: especialista_, formulario_, supervisoes e
  // encerramentos referenciam duplas sem cascade; encontros carrega
  // registros/notas/interações em cascade, mas as avaliações/links só
  // saíram acima por causa do dupla_id espelhado.
  const condenadas = morremIds.filter(
    (d) => ![IDS.dupla, IDS.dupla2, IDS.duplaEsp].includes(d)
  );
  if (condenadas.length) {
    const ids = condenadas.join(",");
    // dupla↔solicitação de especialista é FK circular (0027/0028): zera a
    // aresta na dupla antes de varrer a solicitação e seus eventos
    await patch(`duplas?id=in.(${ids})`, { solicitacao_id: null });
    const sols = await rest(
      `solicitacoes_especialista?select=id&or=(dupla_dpp_id.in.(${ids}),dupla_id.in.(${ids}))`
    );
    const solIds = (sols ?? []).map((s) => s.id);
    if (solIds.length) {
      await del(`especialista_eventos?solicitacao_id=in.(${solIds.join(",")})`);
      await del(`solicitacoes_especialista?id=in.(${solIds.join(",")})`);
    }
    await del(`formulario_links?dupla_id=in.(${ids})`);
    await del(`supervisoes?dupla_id=in.(${ids})`);
    await del(`encerramentos?dupla_id=in.(${ids})`);
    await del(`encontros?dupla_id=in.(${ids})`);
    await del(`duplas?id=in.(${ids})`);
    console.log(`limpeza: ${condenadas.length} dupla(s) pendurada(s) removidas`);
  }
  await patch(`duplas?id=eq.${IDS.dupla2}`, { status: "ativa" });
  const e2eProfiles = [IDS.mentorProfile, IDS.coordProfile, IDS.mentorReserva, IDS.mentorImport, IDS.jovemProfile, IDS.espProfile].join(",");
  const e2eMentorados = [IDS.mentorado, IDS.mentorado2, IDS.mentoradoLivre, IDS.mentoradoImport].join(",");
  // nota de saída do remanejo + notificações "dupla_formada" dos specs
  await del(
    `pessoa_notas?texto=like.*remanejamento*&or=(profile_id.in.(${e2eProfiles}),mentorado_id.in.(${e2eMentorados}))`
  );
  await del(`notificacoes?profile_id=in.(${e2eProfiles})`);
  // pedidos de ajuda do spec /jovem: o filtro por destinatário acima cobre
  // só as fixtures de staff — created_by alcança qualquer coord real do
  // staging que o jovem tenha notificado de verdade
  await del(`notificacoes?created_by=eq.${IDS.jovemProfile}`);
  // prompts de avaliação endereçados ao jovem (o trigger 0071 minta com
  // created_by nulo sob service role — o filtro é pelo destinatário)
  await del(
    `notificacoes?profile_id=eq.${IDS.jovemProfile}&tipo=eq.avaliacao_pendente`
  );
  // encontros pendurados de runs mortos nas duplas e2e — menos as fixtures
  // do jovem, que os blocos de seed abaixo re-carimbam/re-convergem. A
  // trilha esp não tem encontro de seed (o spec mantém o próprio): todos os
  // dela são leftover — os filhos já morreram no sweep de avaliações acima.
  await del(
    `encontros?dupla_id=in.(${IDS.dupla},${IDS.dupla2},${IDS.duplaEsp})&id=not.in.(${IDS.encontroJovem},${IDS.encontroAvaliacao})`
  );
  // agenda do especialista (0073): janelas/exceções que um run de spec
  // morreu sem desfazer — a janela fixture é recriada no bloco do esp. Se o
  // profile ainda não existir o delete é no-op (o filtro não casa nada).
  await del(`especialista_grade?profile_id=eq.${IDS.espProfile}`);
  await del(`especialista_excecoes?profile_id=eq.${IDS.espProfile}`);
  // cronogramas criados pelo spec de turmas — eventos primeiro: a FK
  // ciclo_eventos.cronograma_id (0061) não tem ON DELETE CASCADE
  const crons = await rest(`cronogramas?select=id&turma=like.${encodeURIComponent(TURMA_E2E_PREFIX)}*`);
  if (crons?.length) {
    const ids = crons.map((c) => c.id).join(",");
    await del(`ciclo_eventos?cronograma_id=in.(${ids})`);
    await del(`cronogramas?id=in.(${ids})`);
    console.log(`limpeza: ${crons.length} cronograma(s) E2E removidos`);
  }
}

// ---- profile do mentor (precisa existir ANTES do auth user pro trigger vincular) ----
let [mentor] = await rest(`profiles?select=id,user_id&email=eq.${EMAIL}`);
if (!mentor) {
  [mentor] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorProfile,
      email: EMAIL,
      nome: "Mentor E2E",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile mentor criado");
} else {
  console.log("profile mentor já existe");
}

// ---- auth user com senha (senha_em → o app não desvia pra /auth/definir-senha) ----
async function garantirAuthUser(email, senha, profile) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: HJ,
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { senha_em: new Date().toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`admin createUser ${email} → ${res.status}: ${await res.text()}`);
  const user = await res.json();
  // o trigger handle_new_user já vinculou user_id pelo e-mail
  console.log(`auth user criado: ${user.id} (${email})`);
  return user;
}

if (!mentor.user_id) {
  await garantirAuthUser(EMAIL, SENHA, mentor);
} else {
  console.log(`auth user mentor já vinculado: ${mentor.user_id}`);
}

// ---- profile da coordenação + auth user (login próprio dos specs de coord) ----
let [coord] = await rest(`profiles?select=id,user_id&email=eq.${COORD_EMAIL}`);
if (!coord) {
  [coord] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.coordProfile,
      email: COORD_EMAIL,
      nome: "Coordenação E2E",
      role: "coordenacao",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile coord criado");
} else {
  console.log("profile coord já existe");
}
if (!coord.user_id) {
  await garantirAuthUser(COORD_EMAIL, SENHA_COORD, coord);
} else {
  console.log(`auth user coord já vinculado: ${coord.user_id}`);
}

// ---- mentor reserva: tem a 2ª dupla; sem auth user (nunca loga) ----
const [reserva] = await rest(`profiles?select=id&id=eq.${IDS.mentorReserva}`);
if (!reserva) {
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorReserva,
      email: "e2e-mentor-reserva@realiza.test",
      nome: "Mentor E2E Reserva",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("mentor reserva criado");
}

// ---- mentor livre pro import CSV — profile sem dupla, sem auth ----
const [mImport] = await rest(`profiles?select=id&id=eq.${IDS.mentorImport}`);
if (!mImport) {
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorImport,
      email: "e2e-mentor-import@realiza.test",
      nome: "Mentor E2E Import",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("mentor do import criado");
}

// ---- mentorados + duplas ----
const MENTORADOS = [
  { id: IDS.mentorado, nome: "Mentorada E2E" },
  { id: IDS.mentorado2, nome: "Mentorada E2E Dois" },
  // livre de propósito: alvo do remanejo e visível na fila "Aguardando par"
  { id: IDS.mentoradoLivre, nome: "Mentorada E2E Livre", ong_origem: "ONG E2E", whatsapp: "5511999000080" },
  { id: IDS.mentoradoImport, nome: "Mentorado E2E Import" },
];
for (const m of MENTORADOS) {
  const [existe] = await rest(`mentorados?select=id&id=eq.${m.id}`);
  if (!existe) {
    await rest("mentorados", { method: "POST", body: JSON.stringify(m) });
    console.log(`mentorado criado: ${m.nome}`);
  }
}

const DUPLAS = [
  { id: IDS.dupla, mentor_id: IDS.mentorProfile, mentorado_id: IDS.mentorado },
  { id: IDS.dupla2, mentor_id: IDS.mentorReserva, mentorado_id: IDS.mentorado2 },
];
for (const d of DUPLAS) {
  const [existe] = await rest(`duplas?select=id&id=eq.${d.id}`);
  if (!existe) {
    await rest("duplas", {
      method: "POST",
      body: JSON.stringify({
        ...d,
        turma: cron.turma,
        cronograma_id: cron.id,
        trilha: "dpp",
        status: "ativa",
        iniciada_em: "2026-09-08",
      }),
    });
    console.log(`dupla criada: ${d.id}`);
  }
}

// ---- especialista (REALIZA-111): profile + auth + trilha + grade ----
// Mesmo esquema do mentor/jovem: profile ANTES do auth user pro
// handle_new_user vincular; converge papel/ativo/onboarded/whatsapp — no
// staging o profile já existia (fixture manual) e nasceu sem esses campos.
let [esp] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em,whatsapp&email=eq.${ESP_EMAIL}`
);
if (!esp) {
  [esp] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.espProfile,
      email: ESP_EMAIL,
      nome: "Esp E2E",
      role: "mentor_especialista",
      ativo: true,
      whatsapp: ESP_WHATSAPP,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile especialista criado");
} else {
  const fixes = {};
  if (esp.role !== "mentor_especialista") fixes.role = "mentor_especialista";
  if (!esp.ativo) fixes.ativo = true;
  // sem o carimbo o login cai no wizard de onboarding, não na /agenda
  if (!esp.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (!esp.whatsapp) fixes.whatsapp = ESP_WHATSAPP;
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${esp.id}`, fixes);
    console.log(`profile especialista convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile especialista já existe");
  }
}
if (!esp.user_id) {
  // auth user órfão (um run morto entre o insert do GoTrue e o vínculo): o
  // handle_new_user só roda no INSERT — re-criar daria 422, então o caminho
  // é update de senha + patch manual do user_id.
  const lista = await fetch(
    `${URL_}/auth/v1/admin/users?filter=${encodeURIComponent(ESP_EMAIL)}`,
    { headers: H }
  ).then((r) => r.json());
  const orfao = (lista.users ?? []).find(
    (u) => u.email?.toLowerCase() === ESP_EMAIL
  );
  if (orfao) {
    const res = await fetch(`${URL_}/auth/v1/admin/users/${orfao.id}`, {
      method: "PUT",
      headers: HJ,
      body: JSON.stringify({
        password: SENHA,
        email_confirm: true,
        user_metadata: { senha_em: new Date().toISOString() },
      }),
    });
    if (!res.ok)
      throw new Error(`admin updateUser ${ESP_EMAIL} → ${res.status}: ${await res.text()}`);
    await patch(`profiles?id=eq.${esp.id}`, { user_id: orfao.id });
    console.log(`auth user esp órfão re-vinculado: ${orfao.id}`);
  } else {
    const user = await garantirAuthUser(ESP_EMAIL, SENHA, esp);
    // o trigger já vinculou pelo e-mail; se não (timing estranho), crava —
    // sem o vínculo o login cai em "cadastro não encontrado"
    const [depois] = await rest(`profiles?select=user_id&id=eq.${esp.id}`);
    if (!depois?.user_id) {
      await patch(`profiles?id=eq.${esp.id}`, { user_id: user.id });
      console.log("vínculo profile↔auth do esp cravado à mão");
    }
  }
} else {
  console.log(`auth user esp já vinculado: ${esp.user_id}`);
}

// o aceite real (0028) garante a row em mentor_profiles — a capacidade por
// trilha (0073) mora nela; sem a row o trigger assume o cap implícito 1, o
// que basta, mas a fixture fica mais fiel com ela
const [mpEsp] = await rest(
  `mentor_profiles?select=profile_id&profile_id=eq.${esp.id}`
);
if (!mpEsp) {
  await rest("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({ profile_id: esp.id, tipo: "especialista" }),
  });
  console.log("mentor_profiles do esp criado");
}

// trilha ativa Esp × a mesma mentorada da dupla DPP — um mentorado carrega
// as duas trilhas (a vaga é por trilha: índice parcial (mentorado_id,
// trilha) em ativa/pausada). solicitacao_id fica null — a coluna é nullable
// e o spec testa a agenda, não o fluxo de aceite. cronograma_id é null de
// propósito (a trilha esp não tem calendário oficial — CHECK da 0061 só
// exige pra DPP). iniciada_em ANTES da DPP fixture ("2026-09-08"): a home
// do jovem escolhe a "dupla atual" por iniciada_em desc e a esp não pode
// saltar à frente; o mais recente possível respeitando isso.
const ontem = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
const iniciadaEsp = ontem < "2026-09-08" ? ontem : "2026-09-07";
const [duplaEsp] = await rest(`duplas?select=id,status&id=eq.${IDS.duplaEsp}`);
if (!duplaEsp) {
  await rest("duplas", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.duplaEsp,
      mentor_id: IDS.espProfile,
      mentorado_id: IDS.mentorado,
      turma: cron.turma,
      cronograma_id: null,
      trilha: "especialista",
      status: "ativa",
      iniciada_em: iniciadaEsp,
      demanda: "E2E: mentoria especializada (vestibular e rotina de estudos).",
    }),
  });
  console.log("dupla da trilha especialista criada");
} else if (duplaEsp.status !== "ativa") {
  // um encerramento manual no staging não pode deixar a fixture fora do ar
  await patch(`duplas?id=eq.${IDS.duplaEsp}`, { status: "ativa" });
  console.log("dupla da trilha especialista reativada");
} else {
  console.log("dupla da trilha especialista já existe");
}

// grade mínima: 1 janela semanal (terça 19–21). O spec de agenda adiciona
// MAIS pela UI e o jovem precisa de slots já projetados no "Horários de …"
// da /jovem/agenda. A limpeza no topo varreu tudo do profile — insert seco.
await rest("especialista_grade", {
  method: "POST",
  body: JSON.stringify({
    id: IDS.gradeEsp,
    profile_id: esp.id,
    dia_semana: 2,
    hora_inicio: "19:00",
    hora_fim: "21:00",
  }),
});
console.log("janela de grade do esp (terça 19–21) criada");

// ---- jovem (mentorado) — fixtures do shell /jovem (REALIZA-108) ----
// Mesmo esquema do mentor: profile ANTES do auth user pro handle_new_user
// vincular. onboarded_em carimbado — os specs caem na home, não na tela de
// boas-vindas; a convergência cobre a fixture manual do staging, que nasceu
// sem o carimbo (e qualquer drift de papel/ativo).
let [jovem] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em&email=eq.${JOVEM_EMAIL}`
);
if (!jovem) {
  [jovem] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.jovemProfile,
      email: JOVEM_EMAIL,
      nome: "Jovem E2E",
      role: "mentorado",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile jovem criado");
} else {
  const fixes = {};
  if (jovem.role !== "mentorado") fixes.role = "mentorado";
  if (!jovem.ativo) fixes.ativo = true;
  if (!jovem.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${jovem.id}`, fixes);
    console.log(`profile jovem convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile jovem já existe");
  }
}
if (!jovem.user_id) {
  await garantirAuthUser(JOVEM_EMAIL, SENHA, jovem);
} else {
  console.log(`auth user jovem já vinculado: ${jovem.user_id}`);
}

// a ficha do jovem é a mentorada da dupla fixture — sem profile_id aqui as
// views jovem_* (my_mentorado_id) ficam vazias e o shell inteiro esvazia
{
  const [ficha] = await rest(
    `mentorados?select=id,profile_id&id=eq.${IDS.mentorado}`
  );
  if (ficha && ficha.profile_id !== jovem.id) {
    await patch(`mentorados?id=eq.${IDS.mentorado}`, { profile_id: jovem.id });
    console.log("ficha da mentorada vinculada ao jovem");
  } else {
    console.log("ficha da mentorada já vinculada ao jovem");
  }
}

// combinados: um do jovem (a lista dele na home) e um do mentor — este é a
// checagem negativa do spec (a view jovem_encaminhamentos filtra
// responsavel='mentorado'). Descrições iguais às da fixture manual do
// staging pros dois ambientes convergirem.
const prazoFuturo = new Date(Date.now() + 10 * 86400e3)
  .toISOString()
  .slice(0, 10);
const [combJovem] = await rest(
  `encaminhamentos?select=id,status,prazo&id=eq.${IDS.combinadoJovem}`
);
if (!combJovem) {
  await rest("encaminhamentos", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.combinadoJovem,
      dupla_id: IDS.dupla,
      descricao: "Ler o capítulo 3 do guia até o próximo encontro",
      responsavel: "mentorado",
      prazo: prazoFuturo,
      status: "pendente",
    }),
  });
  console.log("combinado do jovem criado");
} else {
  // o spec marca como feito — o seed devolve a pendente; e o prazo precisa
  // continuar no futuro (vencido renderiza "passou do prazo" na home)
  const fixes = {};
  if (combJovem.status !== "pendente") fixes.status = "pendente";
  if (combJovem.prazo !== prazoFuturo) fixes.prazo = prazoFuturo;
  if (Object.keys(fixes).length) {
    await patch(`encaminhamentos?id=eq.${IDS.combinadoJovem}`, fixes);
    console.log("combinado do jovem re-convergido");
  } else {
    console.log("combinado do jovem já existe");
  }
}
const [combMentor] = await rest(
  `encaminhamentos?select=id&id=eq.${IDS.combinadoMentor}`
);
if (!combMentor) {
  await rest("encaminhamentos", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.combinadoMentor,
      dupla_id: IDS.dupla,
      descricao: "Mentor prepara material de revisão",
      responsavel: "mentor",
      prazo: prazoFuturo,
      status: "pendente",
    }),
  });
  console.log("combinado do mentor criado");
} else {
  console.log("combinado do mentor já existe");
}

// encontro futuro — alimenta o card "Encontros" da home e a agenda. A data
// é sempre now+3d: um run velho deixaria o agendado no passado e esvaziaria
// os blocos, então todo run re-carimba (status agendado→agendado não dispara
// o guard 0043 — o WHEN só olha mudança de status).
const dataEncontro = new Date(Date.now() + 3 * 86400e3).toISOString();
const [encJovem] = await rest(
  `encontros?select=id&id=eq.${IDS.encontroJovem}`
);
if (!encJovem) {
  await rest("encontros", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.encontroJovem,
      dupla_id: IDS.dupla,
      numero: 8,
      data_hora: dataEncontro,
      status: "agendado",
    }),
  });
  console.log("encontro futuro do jovem criado");
} else {
  await patch(`encontros?id=eq.${IDS.encontroJovem}`, {
    data_hora: dataEncontro,
    status: "agendado",
  });
  console.log("encontro futuro do jovem renovado");
}

// encontro REALIZADO sem avaliação (REALIZA-109): o trigger em
// encontros→'realizado' minta o avaliacao_links e notifica o jovem — é a
// pendência que o /jovem ("Suas avaliações") e a ficha da dupla ("voz do
// jovem") exibem. numero 16 fica fora do ciclo esperado (o semáforo conta
// as datas oficiais já passadas — hoje os números baixos), então não come
// um faltante e não disputa proximoNumero com os specs de agendamento.
const dataRealizado = new Date(Date.now() - 2 * 86400e3).toISOString();
const [encAval] = await rest(
  `encontros?select=id,status&id=eq.${IDS.encontroAvaliacao}`
);
if (!encAval) {
  await rest("encontros", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.encontroAvaliacao,
      dupla_id: IDS.dupla,
      numero: 16,
      data_hora: dataRealizado,
      realizado_em: dataRealizado,
      status: "realizado",
    }),
  });
  console.log("encontro realizado (avaliação pendente) criado");
} else {
  // re-carimba a data (um run velho deixaria o realizado meses atrás) e
  // reconverge a pendência: o spec submete a avaliação de verdade — o seed
  // devolve o encontro "sem estrela" pro próximo run. O guard 0043 só
  // trava mudança DE status; update de data em realizado passa.
  await del(`avaliacoes_encontro?encontro_id=eq.${IDS.encontroAvaliacao}`);
  await patch(`encontros?id=eq.${IDS.encontroAvaliacao}`, {
    data_hora: dataRealizado,
    realizado_em: dataRealizado,
  });
  console.log("encontro de avaliação re-convergido");
}
// o link é mintado pelo trigger no insert; se a row existir sem link (run
// morto entre os deletes), recria na mão — token precisa de ≥20 chars
const [linkAval] = await rest(
  `avaliacao_links?select=token,status&encontro_id=eq.${IDS.encontroAvaliacao}`
);
if (!linkAval) {
  await rest("avaliacao_links", {
    method: "POST",
    body: JSON.stringify({
      token: crypto.randomUUID(),
      encontro_id: IDS.encontroAvaliacao,
      dupla_id: IDS.dupla,
      expira_em: new Date(Date.now() + 60 * 86400e3).toISOString(),
    }),
  });
  console.log("link de avaliação recriado (faltava)");
} else if (linkAval.status !== "pendente") {
  await patch(`avaliacao_links?encontro_id=eq.${IDS.encontroAvaliacao}`, {
    status: "pendente",
    respondido_em: null,
    respondido_por_profile_id: null,
  });
  console.log("link de avaliação re-convergido pra pendente");
}

// documentos do jovem — a seção "Documentos" da home: termo dele (Assinar)
// + autorização do responsável (Encaminhar). Templates vêm do banco por
// slug; a fixture manual do staging já usa esses ids/tokens.
const [tplTermo] = await rest(
  "documento_templates?select=id&slug=eq.termo-mentorando&ativo=eq.true&limit=1"
);
const [tplAutoriz] = await rest(
  "documento_templates?select=id&slug=eq.autorizacao-responsavel&ativo=eq.true&limit=1"
);
if (!tplTermo || !tplAutoriz) {
  console.error(
    "templates termo-mentorando/autorizacao-responsavel ausentes — rode `db push` antes"
  );
  process.exit(1);
}
const ASSINATURAS_JOVEM = [
  { id: IDS.assinaturaTermo, template_id: tplTermo.id, token: TOKEN_TERMO_JOVEM },
  { id: IDS.assinaturaAutoriz, template_id: tplAutoriz.id, token: TOKEN_AUTORIZ_JOVEM },
];
for (const a of ASSINATURAS_JOVEM) {
  const [existe] = await rest(`assinaturas?select=id,status&id=eq.${a.id}`);
  if (!existe) {
    await rest("assinaturas", {
      method: "POST",
      body: JSON.stringify({
        id: a.id,
        template_id: a.template_id,
        mentorado_id: IDS.mentorado,
        token: a.token,
        token_expira_em: null,
        status: "pendente",
      }),
    });
    console.log(`assinatura do jovem criada: ${a.id}`);
  } else if (existe.status !== "pendente") {
    // ninguém assina em spec — um assinado/revogado aqui é dedo manual no
    // staging; a home do jovem testa o estado pendente
    await patch(`assinaturas?id=eq.${a.id}`, { status: "pendente" });
    console.log(`assinatura ${a.id} re-convergida pra pendente`);
  } else {
    console.log(`assinatura ${a.id} já existe`);
  }
}

console.log("\nseed e2e ok. Secrets/envs pro CI:");
console.log(`  E2E_MENTOR_EMAIL=${EMAIL}`);
console.log("  E2E_MENTOR_PASSWORD=<a que você passou>");
console.log(`  E2E_DUPLA_ID=${IDS.dupla}`);
console.log(`  E2E_COORD_EMAIL=${COORD_EMAIL}`);
console.log("  E2E_COORD_PASSWORD=<a que você passou, ou a do mentor>");
console.log(`  E2E_DUPLA2_ID=${IDS.dupla2}`);
console.log(`  E2E_JOVEM_EMAIL=${JOVEM_EMAIL}`);
console.log(`  E2E_ESP_EMAIL=${ESP_EMAIL}`);
console.log("  E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY = do staging");
