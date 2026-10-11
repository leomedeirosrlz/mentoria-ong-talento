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
// e as duas assinaturas pendentes. IDs fixos e2e00000-*, que o workflow usa
// pra cleanup determinístico.

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
  assinaturaTermo: "e2e00000-0000-4000-8000-0000000000a1",
  assinaturaAutoriz: "e2e00000-0000-4000-8000-0000000000a2",
};
const EMAIL = "e2e-mentor@realiza.test";
const COORD_EMAIL = "e2e-coord@realiza.test";
const JOVEM_EMAIL = "jovem-e2e@realiza.test";
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
  await del(`duplas?remanejada_de=eq.${IDS.dupla2}`); // sucessoras de remanejo
  await del(`duplas?mentor_id=eq.${IDS.mentorImport}`); // par do import CSV
  await del(`duplas?mentorado_id=eq.${IDS.mentoradoLivre}`); // qualquer vínculo do livre
  await patch(`duplas?id=eq.${IDS.dupla2}`, { status: "ativa" });
  const e2eProfiles = [IDS.mentorProfile, IDS.coordProfile, IDS.mentorReserva, IDS.mentorImport, IDS.jovemProfile].join(",");
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
  // encontros pendurados de runs mortos nas duplas e2e — menos a fixture do
  // jovem, que o bloco de seed abaixo re-carimba (a data é sempre now+3d)
  await del(
    `encontros?dupla_id=in.(${IDS.dupla},${IDS.dupla2})&id=neq.${IDS.encontroJovem}`
  );
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
console.log("  E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY = do staging");
