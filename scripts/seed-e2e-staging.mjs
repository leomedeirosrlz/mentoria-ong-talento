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
// E as personas da solicitação v2 (REALIZA-112): um 2º especialista (esp2)
// e um jovem SEM dupla DPP ativa (profile mentorado + mentorado vinculado) —
// alvos da triagem aguardando_coord e de pedidos direcionados.
// E a fixture do diretório do jovem (REALIZA-113): a ficha do jovem sem DPP
// ganha WhatsApp + uma dupla DPP PAUSADA na mesma turma (mentor próprio,
// sem auth) — ele vira "colega com conta" na mentorados_turma (a view não
// filtra status), mas segue sem DPP ativa: o pedido de especialista dele
// continua caindo em aguardando_coord. O toggle de compartilhamento é dos
// specs — o seed o devolve a false a cada run.
// E as personas da rodada de telas finais (WP0b/WP1): um supervisor com
// login próprio ligado às duplas fixture por duplas.supervisor_id (as duplas
// do híbrido ficam de fora — são a checagem negativa do escopo) e um mentor
// híbrido — DPP de uma dupla + especialista com trilha e grade próprias,
// como o guia prevê pro pool de especialistas (REALIZA-105). Os blocos de
// profile_papeis e chamados são DEFENSIVOS: enquanto as migrations do
// WP0b/WP1 não aterrissam no ambiente, os probes pulam tudo sem falhar.
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
  // REALIZA-112: 2º especialista (alvo de pedido direcionado sem bagunçar a
  // duplaEsp) e o jovem SEM dupla DPP — o pedido dele cai na triagem da
  // coordenação (aguardando_coord). Os ids convergem com a fixture manual
  // que o Thiago criou no staging; o 00f0 do jovem é profile — o gradeEsp
  // 00f0 é OUTRA tabela, não conflita.
  esp2Profile: "e2e00000-0000-4000-8000-0000000000c0",
  mentoradoSemDpp: "e2e00000-0000-4000-8000-0000000000d0",
  jovem2Profile: "e2e00000-0000-4000-8000-0000000000f0",
  // janela de grade do esp2 — os chips do pedido direcionado do jovem e os
  // slots da contra-proposta/aceite saem da grade REAL dele (0073)
  gradeEsp2: "e2e00000-0000-4000-8000-0000000000e1",
  cronogramaE2e: "e2e00000-0000-4000-8000-0000000000e2",
  // REALIZA-113: o "colega com conta" do diretório — o jovem sem DPP ganha
  // uma dupla DPP pausada (mentor próprio, nunca loga) na mesma turma.
  // 'pausada' e não 'ativa' de propósito: a RPC pedir_especialista_jovem e
  // o semDuplaDpp da home só olham DPP ativa — a triagem do pedido dele
  // segue intacta — e o sweep de duplas esp do spec 112 nem enxerga trilha
  // dpp. O trigger de capacidade conta ativa+pausada, então um mentor novo
  // (cap implícito 1 livre) em vez de pendurar no reserva.
  mentorColega: "e2e00000-0000-4000-8000-0000000000e2",
  duplaColega: "e2e00000-0000-4000-8000-0000000000f2",
  // REALIZA-114: o jovem do "1º acesso" — login próprio e ficha vinculada,
  // mas SEM carimbo de onboarding e SEM grade na ficha: é o estado que o
  // wizard do /jovem testa. O bloco re-zera os dois a cada run.
  jovem3Profile: "e2e00000-0000-4000-8000-0000000000e3",
  mentoradoOnboarding: "e2e00000-0000-4000-8000-0000000000f3",
  // Telas finais (WP0b/WP1): supervisor com login, mentor híbrido e as duas
  // pontas dele (ficha DPP + ficha de trilha — mentorado diferente em cada,
  // porque DPP do próprio jovem fica fora do pool de especialista), mais os
  // três chamados da fila de apoio quando a tabela do WP1 existir.
  supProfile: "e2e00000-0000-4000-8000-000000000100",
  hibProfile: "e2e00000-0000-4000-8000-000000000110",
  mentoradoHib: "e2e00000-0000-4000-8000-000000000120",
  mentoradoHibEsp: "e2e00000-0000-4000-8000-000000000130",
  duplaHibDpp: "e2e00000-0000-4000-8000-000000000140",
  duplaHibEsp: "e2e00000-0000-4000-8000-000000000150",
  gradeHib: "e2e00000-0000-4000-8000-000000000160",
  chamadoJovem: "e2e00000-0000-4000-8000-000000000170",
  chamadoUrgencia: "e2e00000-0000-4000-8000-000000000180",
  chamadoAtendimento: "e2e00000-0000-4000-8000-000000000190",
};
const EMAIL = "e2e-mentor@realiza.test";
const COORD_EMAIL = "e2e-coord@realiza.test";
const JOVEM_EMAIL = "jovem-e2e@realiza.test";
const ESP_EMAIL = "esp-e2e@realiza.test";
// alimenta o "Chamar no WhatsApp" do card "Horários de …" na /jovem/agenda
const ESP_WHATSAPP = "5511999000070";
// personas da solicitação v2 — mesmo esquema de senha compartilhada do mentor
const ESP2_EMAIL = "esp2-e2e@realiza.test";
const ESP2_WHATSAPP = "5511999990002";
const JOVEM2_EMAIL = "jovem2-e2e@realiza.test";
// o número que o opt-in dele libera pros colegas (0076) — alimenta o botão
// WhatsApp do card dele na /jovem/pessoas do jovem
const JOVEM2_WHATSAPP = "5511999000091";
// o jovem do onboarding (REALIZA-114): o WhatsApp é o que o passo de
// contato do wizard exibe e o que o opt-in poderia compartilhar
const JOVEM3_EMAIL = "jovem3-e2e@realiza.test";
const JOVEM3_WHATSAPP = "5511999000093";
// supervisor (papel auxiliar) e mentor híbrido — mesma senha compartilhada
// das demais personas staff (E2E_MENTOR_PASSWORD)
const SUP_EMAIL = "sup-e2e@realiza.test";
const HIB_EMAIL = "hib-e2e@realiza.test";
// assinaturas.token é uuid — os tokens fixos da fixture manual do staging
const TOKEN_TERMO_JOVEM = "e2e00000-0000-4000-8000-0000000000aa";
const TOKEN_AUTORIZ_JOVEM = "e2e00000-0000-4000-8000-0000000000ab";
// turma que o spec de cronograma cria pelo builder — prefixo único pro
// cleanup não depender de id conhecido
const TURMA_E2E_PREFIX = "E2E ";
// turma própria das fixtures (REALIZA-151): duplas e2e moravam no
// cronograma do domínio e a turma compartilhada vazava fixtures pro
// diretório/catálogo do jovem (mentorados_turma casa por string de turma)
// e pro contato de coordenação (jovem_contatos, 0097). "Turma E2E" NÃO
// casa o prefixo 'E2E ' — o sweep de leftovers dos specs não apaga ela.
const TURMA_E2E = "Turma E2E";

// CSVs das fixtures e2e — o sweep de leftovers e os blocos defensivos de
// profile_papeis/chamados lá no fim compartilham a mesma base
const E2E_PROFILES = [IDS.mentorProfile, IDS.coordProfile, IDS.mentorReserva, IDS.mentorImport, IDS.jovemProfile, IDS.espProfile, IDS.esp2Profile, IDS.jovem2Profile, IDS.mentorColega, IDS.jovem3Profile, IDS.supProfile, IDS.hibProfile].join(",");
const E2E_MENTORADOS = [IDS.mentorado, IDS.mentorado2, IDS.mentoradoLivre, IDS.mentoradoImport, IDS.mentoradoSemDpp, IDS.mentoradoOnboarding, IDS.mentoradoHib, IDS.mentoradoHibEsp].join(",");

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

// ---- cronograma E2E dedicado + eventos clonados do domínio ----
// Os specs leem vigente/cobertura por cronograma_id — os eventos têm que
// existir na turma E2E também (clone verbatim das linhas do domínio).
{
  const [tem] = await rest(`cronogramas?select=id&id=eq.${IDS.cronogramaE2e}`);
  if (!tem) {
    const [base] = await rest(
      `cronogramas?select=inicio_em,fim_em,encontros_esperados&id=eq.${cron.id}`
    );
    await rest("cronogramas", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.cronogramaE2e,
        nome: "Calendário oficial · Turma E2E",
        turma: TURMA_E2E,
        inicio_em: base?.inicio_em ?? null,
        fim_em: base?.fim_em ?? null,
        encontros_esperados: base?.encontros_esperados ?? 16,
        status: "ativo",
        created_by: IDS.coordProfile,
      }),
    });
    console.log("cronograma E2E criado");
  }
  const evE2e = await rest(
    `ciclo_eventos?select=id&cronograma_id=eq.${IDS.cronogramaE2e}`
  );
  if (!evE2e?.length) {
    const evDom = await rest(
      `ciclo_eventos?select=*&cronograma_id=eq.${cron.id}&order=data`
    );
    for (const [i, e] of (evDom ?? []).entries()) {
      const resto = { ...e };
      delete resto.id;
      await rest("ciclo_eventos", {
        method: "POST",
        body: JSON.stringify({
          id: `e2e00000-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`,
          ...resto,
          cronograma_id: IDS.cronogramaE2e,
        }),
      });
    }
    console.log(`ciclo_eventos E2E: ${evDom?.length ?? 0} eventos clonados`);
  }
}

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
    `duplas?select=id&or=(id.in.(${IDS.dupla},${IDS.dupla2},${IDS.duplaEsp}),remanejada_de.eq.${IDS.dupla2},mentor_id.eq.${IDS.mentorImport},mentorado_id.eq.${IDS.mentoradoLivre},mentorado_id.eq.${IDS.mentoradoSemDpp},mentorado_id.eq.${IDS.mentoradoHib},mentorado_id.eq.${IDS.mentoradoHibEsp},and(mentorado_id.eq.${IDS.mentorado},id.not.in.(${IDS.dupla},${IDS.duplaEsp})))`
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
  // as condenadas de verdade — as quatro duplas fixture ficam (a do jovem,
  // a dupla2 que só volta a 'ativa', a trilha esp e a dupla pausada do
  // colega, também fixtures). Filhos NO ACTION primeiro: especialista_,
  // formulario_, supervisoes e encerramentos referenciam duplas sem
  // cascade; encontros carrega registros/notas/interações em cascade, mas
  // as avaliações/links só saíram acima por causa do dupla_id espelhado.
  const condenadas = morremIds.filter(
    (d) =>
      ![
        IDS.dupla,
        IDS.dupla2,
        IDS.duplaEsp,
        IDS.duplaColega,
        IDS.duplaHibDpp,
        IDS.duplaHibEsp,
      ].includes(d)
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
      // o thread de negociação é o filho (a 0074 batizou de
      // solicitacao_propostas — "especialista_eventos" não existe como
      // tabela e o delete sempre dava 400: a sol ficava de pé, travava o
      // re-pedido pelo dedup e poluía o mural do especialista)
      await del(`solicitacao_propostas?solicitacao_id=in.(${solIds.join(",")})`);
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
  const e2eProfiles = E2E_PROFILES;
  const e2eMentorados = E2E_MENTORADOS;
  // solicitações de especialista ligadas a qualquer mentorado e2e — o sweep
  // de condenadas só alcança as que morrem junto das duplas; as que apontam
  // pras duplas FIXTURE (dupla_dpp_id) ficariam de pé: uma 'aberta'/
  // 'contra_proposta' pendurada trava o re-pedido (dedup) e polui o mural
  // dos specs de solicitação. Nulla a aresta dupla→sol antes do delete.
  {
    const sols = await rest(
      `solicitacoes_especialista?select=id&mentorado_id=in.(${e2eMentorados})`
    );
    const solIds = (sols ?? []).map((s) => s.id);
    if (solIds.length) {
      const csv = solIds.join(",");
      await patch(`duplas?solicitacao_id=in.(${csv})`, { solicitacao_id: null });
      await del(`solicitacao_propostas?solicitacao_id=in.(${csv})`);
      await del(`solicitacoes_especialista?id=in.(${csv})`);
      console.log(`limpeza: ${solIds.length} solicitação(ões) removidas`);
    }
  }
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
    `encontros?dupla_id=in.(${IDS.dupla},${IDS.dupla2},${IDS.duplaEsp},${IDS.duplaColega},${IDS.duplaHibDpp},${IDS.duplaHibEsp})&id=not.in.(${IDS.encontroJovem},${IDS.encontroAvaliacao})`
  );
  // agenda do especialista (0073): janelas/exceções que um run de spec
  // morreu sem desfazer — a janela fixture é recriada no bloco do esp. Se o
  // profile ainda não existir o delete é no-op (o filtro não casa nada).
  // esp2 idem — a grade dele vira fixture no bloco dele mais abaixo. O
  // híbrido também: a janela do papel especialista dele é recriada lá embaixo.
  await del(`especialista_grade?profile_id=eq.${IDS.espProfile}`);
  await del(`especialista_excecoes?profile_id=eq.${IDS.espProfile}`);
  await del(`especialista_grade?profile_id=eq.${IDS.esp2Profile}`);
  await del(`especialista_excecoes?profile_id=eq.${IDS.esp2Profile}`);
  await del(`especialista_grade?profile_id=eq.${IDS.hibProfile}`);
  await del(`especialista_excecoes?profile_id=eq.${IDS.hibProfile}`);
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
async function garantirAuthUser(email, senha) {
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

/** Vínculo profile↔auth garantido pra uma persona com login. O
 *  handle_new_user só roda no INSERT do GoTrue — um auth user órfão (run
 *  morto entre o insert e o vínculo) faz o createUser dar 422; nesse caso
 *  o caminho é update de senha + patch manual do user_id (mesma lógica que
 *  o bloco do esp trazia inline). */
async function vincularAuth(profile, email, senha = SENHA) {
  if (profile.user_id) {
    console.log(`auth user já vinculado: ${profile.user_id} (${email})`);
    return;
  }
  const lista = await fetch(
    `${URL_}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: H }
  ).then((r) => r.json());
  const orfao = (lista.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (orfao) {
    const res = await fetch(`${URL_}/auth/v1/admin/users/${orfao.id}`, {
      method: "PUT",
      headers: HJ,
      body: JSON.stringify({
        password: senha,
        email_confirm: true,
        user_metadata: { senha_em: new Date().toISOString() },
      }),
    });
    if (!res.ok)
      throw new Error(`admin updateUser ${email} → ${res.status}: ${await res.text()}`);
    await patch(`profiles?id=eq.${profile.id}`, { user_id: orfao.id });
    console.log(`auth user órfão re-vinculado: ${orfao.id} (${email})`);
  } else {
    const user = await garantirAuthUser(email, senha, profile);
    // o trigger já vinculou pelo e-mail; se não (timing estranho), crava —
    // sem o vínculo o login cai em "cadastro não encontrado"
    const [depois] = await rest(`profiles?select=user_id&id=eq.${profile.id}`);
    if (!depois?.user_id) {
      await patch(`profiles?id=eq.${profile.id}`, { user_id: user.id });
      console.log(`vínculo profile↔auth cravado à mão (${email})`);
    }
  }
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
        turma: TURMA_E2E,
        cronograma_id: IDS.cronogramaE2e,
        trilha: "dpp",
        status: "ativa",
        iniciada_em: "2026-09-08",
      }),
    });
    console.log(`dupla criada: ${d.id}`);
  }
}

// ---- grades de disponibilidade (REALIZA-24): overlay da agenda do mentor ----
// A tinta do calendário cruza a grade do mentor DPP (mentor_profiles via
// getMeuMentorProfile) com a da mentorada da dupla ativa (embed da dupla).
// Sem a row o overlay só pinta o lado do jovem — a fixture garante os três
// estados: ter/qui "ambos" (mesma noite), sábado só do mentor ("você
// livre"). Patch sempre converge — grade é dado aditivo, nenhum spec lê
// o estado vazio. O guard do mentor_profiles (0004) só trava os campos de
// validação no UPDATE — disponibilidade passa livre.
const GRADE_MENTOR_E2E = { dias: ["ter", "qui", "sab"], periodos: ["noite"] };
const GRADE_MENTORADA_E2E = { dias: ["ter", "qui"], periodos: ["noite"] };
const [mpMentor] = await rest(
  `mentor_profiles?select=profile_id,disponibilidade&profile_id=eq.${IDS.mentorProfile}`
);
if (!mpMentor) {
  await rest("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({
      profile_id: IDS.mentorProfile,
      tipo: "dpp",
      disponibilidade: GRADE_MENTOR_E2E,
    }),
  });
  console.log("mentor_profiles do mentor criado (grade da agenda)");
} else {
  // patch sempre converge — comparar JSON.stringify falharia por ordem de
  // chave do jsonb, e regravar a mesma grade é no-op de qualquer jeito
  await patch(`mentor_profiles?profile_id=eq.${IDS.mentorProfile}`, {
    disponibilidade: GRADE_MENTOR_E2E,
  });
  console.log("disponibilidade do mentor convergida");
}
await patch(`mentorados?id=eq.${IDS.mentorado}`, {
  disponibilidade: GRADE_MENTORADA_E2E,
});
console.log("disponibilidade da mentorada convergida");

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
// trilha (0073) mora nela; sem a row o trigger assume o cap implícito 1. O
// spec 112 efetiva uma 2ª trilha pro mesmo esp (mentorado2), então a fixture
// precisa de folga real — 3 vagas convergem a cada seed
const [mpEsp] = await rest(
  `mentor_profiles?select=profile_id,capacidade_especialista&profile_id=eq.${esp.id}`
);
if (!mpEsp) {
  await rest("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({
      profile_id: esp.id,
      tipo: "especialista",
      capacidade_especialista: 3,
    }),
  });
  console.log("mentor_profiles do esp criado");
} else if (mpEsp.capacidade_especialista !== 3) {
  await patch(`mentor_profiles?profile_id=eq.${esp.id}`, {
    capacidade_especialista: 3,
  });
  console.log("capacidade_especialista do esp convergida pra 3");
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
      turma: TURMA_E2E,
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

// ---- personas da solicitação v2 (REALIZA-112): esp2 + jovem sem DPP ----
// esp2 é o alvo limpo de pedido direcionado (não disputa a duplaEsp nem o
// cap do esp principal); jovem2/mentorado 00d0 não tem dupla DPP ATIVA — o
// pedido dele nasce 'aguardando_coord' e alimenta a fila de triagem do
// coord card (a dupla pausada que o coloca no diretório de colegas, 0076,
// não conta pro vínculo do pedido — a RPC só olha status 'ativa').
let [esp2] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em,whatsapp&email=eq.${ESP2_EMAIL}`
);
if (!esp2) {
  [esp2] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.esp2Profile,
      email: ESP2_EMAIL,
      nome: "Esp Dois E2E",
      role: "mentor_especialista",
      ativo: true,
      whatsapp: ESP2_WHATSAPP,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile esp2 criado");
} else {
  const fixes = {};
  if (esp2.role !== "mentor_especialista") fixes.role = "mentor_especialista";
  if (!esp2.ativo) fixes.ativo = true;
  if (!esp2.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (!esp2.whatsapp) fixes.whatsapp = ESP2_WHATSAPP;
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${esp2.id}`, fixes);
    console.log(`profile esp2 convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile esp2 já existe");
  }
}
await vincularAuth(esp2, ESP2_EMAIL);
// capacidade por trilha — a row segue o mesmo critério do esp principal
const [mpEsp2] = await rest(
  `mentor_profiles?select=profile_id&profile_id=eq.${esp2.id}`
);
if (!mpEsp2) {
  await rest("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({ profile_id: esp2.id, tipo: "especialista" }),
  });
  console.log("mentor_profiles do esp2 criado");
}

// janela mínima pro esp2 (quinta 19–21 — dia diferente da terça do esp
// principal pros slots não se confundirem): o pedido direcionado do jovem
// busca os horários dele pela RPC e o aceite valida contra a grade real.
// A limpeza no topo varreu tudo do profile — insert seco.
await rest("especialista_grade", {
  method: "POST",
  body: JSON.stringify({
    id: IDS.gradeEsp2,
    profile_id: esp2.id,
    dia_semana: 4,
    hora_inicio: "19:00",
    hora_fim: "21:00",
  }),
});
console.log("janela de grade do esp2 (quinta 19–21) criada");

let [jovem2] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em&email=eq.${JOVEM2_EMAIL}`
);
if (!jovem2) {
  [jovem2] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.jovem2Profile,
      email: JOVEM2_EMAIL,
      nome: "Jovem E2E Sem DPP",
      role: "mentorado",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile jovem sem DPP criado");
} else {
  const fixes = {};
  if (jovem2.role !== "mentorado") fixes.role = "mentorado";
  if (!jovem2.ativo) fixes.ativo = true;
  if (!jovem2.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${jovem2.id}`, fixes);
    console.log(`profile jovem sem DPP convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile jovem sem DPP já existe");
  }
}
await vincularAuth(jovem2, JOVEM2_EMAIL);
// a ficha mentorados vinculada — sem profile_id o my_mentorado_id() volta
// null e o pedido do jovem não tem dono (cai em triagem sem autor). O
// WhatsApp habilita o switch do card Privacidade (0076) e é o número que o
// opt-in libera; contato_compartilhado volta a false a cada run — um spec
// que liga o toggle não pode vazar opt-in pro run seguinte.
{
  const [ficha] = await rest(
    `mentorados?select=id,profile_id,whatsapp,contato_compartilhado&id=eq.${IDS.mentoradoSemDpp}`
  );
  if (!ficha) {
    await rest("mentorados", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.mentoradoSemDpp,
        nome: "Jovem E2E Sem DPP",
        profile_id: jovem2.id,
        whatsapp: JOVEM2_WHATSAPP,
      }),
    });
    console.log("mentorado sem DPP criado");
  } else {
    const fixes = {};
    if (ficha.profile_id !== jovem2.id) fixes.profile_id = jovem2.id;
    if (ficha.whatsapp !== JOVEM2_WHATSAPP) fixes.whatsapp = JOVEM2_WHATSAPP;
    if (ficha.contato_compartilhado) fixes.contato_compartilhado = false;
    if (Object.keys(fixes).length) {
      await patch(`mentorados?id=eq.${IDS.mentoradoSemDpp}`, fixes);
      console.log(
        `ficha do jovem sem DPP convergida (${Object.keys(fixes).join(", ")})`
      );
    } else {
      console.log("ficha do jovem sem DPP já vinculada");
    }
  }
}

// o mentor da dupla do colega — profile de staff sem auth (nunca loga). A
// capacidade implícita é 1 e ele só tem a dupla pausada, então o trigger
// duplas_capacidade passa de boa.
const [mColega] = await rest(
  `profiles?select=id&id=eq.${IDS.mentorColega}`
);
if (!mColega) {
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorColega,
      email: "e2e-mentor-colega@realiza.test",
      nome: "Mentor E2E Colega",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("mentor do colega criado");
}

// a dupla que põe o jovem sem DPP no diretório de colegas (0076): DPP
// pausada na mesma turma — a mentorados_turma não filtra status, mas
// "sem DPP ativa" ele continua (pedido de especialista cai em triagem).
// Converge status/turma a cada run — um run morto ou dedo manual no
// staging não deixa a fixture fora do ar.
{
  const [dc] = await rest(
    `duplas?select=id,status,turma,mentor_id,mentorado_id,trilha&id=eq.${IDS.duplaColega}`
  );
  if (!dc) {
    await rest("duplas", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.duplaColega,
        mentor_id: IDS.mentorColega,
        mentorado_id: IDS.mentoradoSemDpp,
        turma: TURMA_E2E,
        cronograma_id: IDS.cronogramaE2e,
        trilha: "dpp",
        status: "pausada",
        iniciada_em: "2026-09-08",
      }),
    });
    console.log("dupla pausada do colega criada");
  } else {
    const fixes = {};
    if (dc.status !== "pausada") {
      fixes.status = "pausada";
      // um encerramento manual deixa carimbo de saída — pausar de volta
      // sem limpar fingiria uma dupla morta
      fixes.encerrada_em = null;
      fixes.motivo_encerramento = null;
    }
    if (dc.turma !== TURMA_E2E) fixes.turma = TURMA_E2E;
    if (dc.mentor_id !== IDS.mentorColega) fixes.mentor_id = IDS.mentorColega;
    if (dc.mentorado_id !== IDS.mentoradoSemDpp)
      fixes.mentorado_id = IDS.mentoradoSemDpp;
    if (dc.trilha !== "dpp") fixes.trilha = "dpp";
    if (Object.keys(fixes).length) {
      await patch(`duplas?id=eq.${IDS.duplaColega}`, fixes);
      console.log(
        `dupla do colega convergida (${Object.keys(fixes).join(", ")})`
      );
    } else {
      console.log("dupla pausada do colega já existe");
    }
  }
}

// ---- jovem3 (REALIZA-114): o jovem do "1º acesso" ----
// Profile mentorado + auth + ficha vinculada, mas o estado inicial é o do
// nunca-entrou: onboarded_em null (o layout devolve o wizard em vez do
// shell) e a ficha sem disponibilidade nem opt-in. A convergência ZERA o
// carimbo a cada run — um spec que concluiu o wizard não pode vazar o
// "já vi" pro run seguinte (o spec também re-converge no beforeEach).
let [jovem3] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em&email=eq.${JOVEM3_EMAIL}`
);
if (!jovem3) {
  [jovem3] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.jovem3Profile,
      email: JOVEM3_EMAIL,
      nome: "Jovem E2E Onboarding",
      role: "mentorado",
      ativo: true,
    }),
  });
  console.log("profile jovem do onboarding criado");
} else {
  const fixes = {};
  if (jovem3.role !== "mentorado") fixes.role = "mentorado";
  if (!jovem3.ativo) fixes.ativo = true;
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${jovem3.id}`, fixes);
    console.log(
      `profile jovem do onboarding convergido (${Object.keys(fixes).join(", ")})`
    );
  }
}
await patch(`profiles?id=eq.${IDS.jovem3Profile}`, { onboarded_em: null });
await vincularAuth(jovem3, JOVEM3_EMAIL);
// a ficha: vínculo + WhatsApp (o passo de contato do wizard exibe), e a
// grade/opt-in de volta ao virgem — sem dupla de propósito: o spec só
// testa o wizard, o lembrete e a edição no perfil
{
  const [ficha] = await rest(
    `mentorados?select=id,profile_id,whatsapp&id=eq.${IDS.mentoradoOnboarding}`
  );
  if (!ficha) {
    await rest("mentorados", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.mentoradoOnboarding,
        nome: "Jovem E2E Onboarding",
        profile_id: jovem3.id,
        whatsapp: JOVEM3_WHATSAPP,
      }),
    });
    console.log("mentorado do onboarding criado");
  } else {
    const fixes = {};
    if (ficha.profile_id !== jovem3.id) fixes.profile_id = jovem3.id;
    if (ficha.whatsapp !== JOVEM3_WHATSAPP) fixes.whatsapp = JOVEM3_WHATSAPP;
    if (Object.keys(fixes).length) {
      await patch(`mentorados?id=eq.${IDS.mentoradoOnboarding}`, fixes);
      console.log(
        `ficha do jovem do onboarding convergida (${Object.keys(fixes).join(", ")})`
      );
    }
  }
  await patch(`mentorados?id=eq.${IDS.mentoradoOnboarding}`, {
    disponibilidade: null,
    contato_compartilhado: false,
  });
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

// ---- supervisor (auxiliar) — login próprio pras telas finais (WP9/WP1) ----
// A home do auxiliar e a fila de chamados precisam de um supervisor
// autenticado; duplas.supervisor_id é a aresta que as policies dele usam
// ("as supervisionadas" — 0023). As duplas do híbrido ficam SEM ele de
// propósito: são a checagem negativa do escopo.
let [sup] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em&email=eq.${SUP_EMAIL}`
);
if (!sup) {
  [sup] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.supProfile,
      email: SUP_EMAIL,
      nome: "Supervisor E2E",
      role: "supervisor",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile supervisor criado");
} else {
  const fixes = {};
  if (sup.role !== "supervisor") fixes.role = "supervisor";
  if (!sup.ativo) fixes.ativo = true;
  if (!sup.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${sup.id}`, fixes);
    console.log(`profile supervisor convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile supervisor já existe");
  }
}
await vincularAuth(sup, SUP_EMAIL);
// aresta supervisor↔dupla nas fixtures clássicas — converge a cada run; o
// trigger duplas_capacidade só olha mentor_id/status, então passa livre
for (const dId of [IDS.dupla, IDS.dupla2, IDS.duplaEsp, IDS.duplaColega]) {
  await patch(`duplas?id=eq.${dId}`, { supervisor_id: sup.id });
}
console.log("duplas fixture ligadas ao supervisor");

// ---- mentor híbrido (WP0b · REALIZA-105): DPP de uma dupla + especialista ----
// O guia prevê mentor voluntário no pool de especialistas — a mesma pessoa
// carrega os dois papéis. profiles.role fica 'mentor_dpp' (primário
// provisório até a profile_papeis entrar — o bloco defensivo dela vem
// abaixo); as duas duplas já materializam os dois lados do híbrido.
let [hib] = await rest(
  `profiles?select=id,user_id,role,ativo,onboarded_em&email=eq.${HIB_EMAIL}`
);
if (!hib) {
  [hib] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.hibProfile,
      email: HIB_EMAIL,
      nome: "Mentor E2E Híbrido",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile mentor híbrido criado");
} else {
  const fixes = {};
  if (hib.role !== "mentor_dpp") fixes.role = "mentor_dpp";
  if (!hib.ativo) fixes.ativo = true;
  if (!hib.onboarded_em) fixes.onboarded_em = new Date().toISOString();
  if (Object.keys(fixes).length) {
    await patch(`profiles?id=eq.${hib.id}`, fixes);
    console.log(`profile mentor híbrido convergido (${Object.keys(fixes).join(", ")})`);
  } else {
    console.log("profile mentor híbrido já existe");
  }
}
await vincularAuth(hib, HIB_EMAIL);

// mentor_profiles: tipo 'dpp' (primário) com vaga nos dois pools. Os campos
// de validação (tipo/capacidade*) ficam travados no UPDATE pelo guard 0004 —
// só a disponibilidade converge; os valores certos nascem no INSERT.
const GRADE_HIB = { dias: ["seg", "sex"], periodos: ["tarde", "noite"] };
const [mpHib] = await rest(
  `mentor_profiles?select=profile_id&profile_id=eq.${hib.id}`
);
if (!mpHib) {
  await rest("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({
      profile_id: hib.id,
      tipo: "dpp",
      capacidade: 1,
      capacidade_especialista: 1,
      disponibilidade: GRADE_HIB,
    }),
  });
  console.log("mentor_profiles do híbrido criado");
} else {
  await patch(`mentor_profiles?profile_id=eq.${hib.id}`, {
    disponibilidade: GRADE_HIB,
  });
  console.log("disponibilidade do híbrido convergida");
}

// as duas fichas dele — mentorados sem auth (nunca logam), uma pro DPP e
// outra pra trilha (especialista do PRÓPRIO jovem é vetado pelo guia — D9)
for (const m of [
  { id: IDS.mentoradoHib, nome: "Mentorada E2E Híbrido" },
  { id: IDS.mentoradoHibEsp, nome: "Mentorada E2E Trilha Híbrido" },
]) {
  const [existe] = await rest(`mentorados?select=id&id=eq.${m.id}`);
  if (!existe) {
    await rest("mentorados", { method: "POST", body: JSON.stringify(m) });
    console.log(`mentorado criado: ${m.nome}`);
  }
}

// a dupla DPP e a trilha — insert-or-converge no padrão das outras fixtures
{
  const [d] = await rest(`duplas?select=id,status&id=eq.${IDS.duplaHibDpp}`);
  if (!d) {
    await rest("duplas", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.duplaHibDpp,
        mentor_id: hib.id,
        mentorado_id: IDS.mentoradoHib,
        turma: TURMA_E2E,
        cronograma_id: IDS.cronogramaE2e,
        trilha: "dpp",
        status: "ativa",
        iniciada_em: "2026-09-08",
      }),
    });
    console.log("dupla DPP do híbrido criada");
  } else if (d.status !== "ativa") {
    await patch(`duplas?id=eq.${IDS.duplaHibDpp}`, {
      status: "ativa",
      encerrada_em: null,
      motivo_encerramento: null,
    });
    console.log("dupla DPP do híbrido reativada");
  } else {
    console.log("dupla DPP do híbrido já existe");
  }
}
{
  const [d] = await rest(`duplas?select=id,status&id=eq.${IDS.duplaHibEsp}`);
  if (!d) {
    await rest("duplas", {
      method: "POST",
      body: JSON.stringify({
        id: IDS.duplaHibEsp,
        mentor_id: hib.id,
        mentorado_id: IDS.mentoradoHibEsp,
        turma: TURMA_E2E,
        cronograma_id: null,
        trilha: "especialista",
        status: "ativa",
        iniciada_em: iniciadaEsp,
        demanda: "E2E: trilha especializada do mentor híbrido.",
      }),
    });
    console.log("trilha do híbrido criada");
  } else if (d.status !== "ativa") {
    await patch(`duplas?id=eq.${IDS.duplaHibEsp}`, {
      status: "ativa",
      encerrada_em: null,
      motivo_encerramento: null,
    });
    console.log("trilha do híbrido reativada");
  } else {
    console.log("trilha do híbrido já existe");
  }
}

// janela de grade do papel especialista dele (sexta 19–21 — dia distinto
// das fixtures dos esps pros slots não se confundirem). O sweep no topo já
// varreu o profile — insert seco.
await rest("especialista_grade", {
  method: "POST",
  body: JSON.stringify({
    id: IDS.gradeHib,
    profile_id: hib.id,
    dia_semana: 5,
    hora_inicio: "19:00",
    hora_fim: "21:00",
  }),
});
console.log("janela de grade do híbrido (sexta 19–21) criada");

// ---- convergência de turma das duplas fixture (REALIZA-151) ----
// Runs antigos gravaram a turma do domínio — PATCH idempotente migra as
// duplas e2e pra turma dedicada (DPP ganha o cronograma E2E; especialista
// segue sem calendário oficial). mentorados_turma casa por string de
// turma — depois daqui nenhuma fixture vaza pro diretório do jovem demo.
await patch(
  `duplas?id=in.(${IDS.dupla},${IDS.dupla2},${IDS.duplaColega},${IDS.duplaHibDpp})`,
  { turma: TURMA_E2E, cronograma_id: IDS.cronogramaE2e }
);
await patch(`duplas?id=in.(${IDS.duplaEsp},${IDS.duplaHibEsp})`, {
  turma: TURMA_E2E,
});
console.log("duplas e2e convergidas pra Turma E2E");

// ---- profile_papeis (WP0b · REALIZA-105) — bloco DEFENSIVO ----
// A tabela chega pela migration do WP0b; até lá o papel provisório segue
// sendo profiles.role e este bloco inteiro é no-op (o probe falha com
// PGRST205 e pula sem quebrar o seed).
// TODO REALIZA-105: remover fallback quando profile_papeis estiver em prod
let papeisOk = false;
try {
  await rest("profile_papeis?select=profile_id&limit=1");
  papeisOk = true;
} catch {
  console.log(
    "profile_papeis ainda não existe (WP0b pendente) — profiles.role é o primário provisório"
  );
}
if (papeisOk) {
  try {
    // uma linha por papel de cada fixture — o equivalente ao backfill da
    // migration pra essas personas (linhas de outros profiles ficam fora
    // do escopo). O híbrido é o único com duas: a segunda é o papel que o
    // backfill de profiles.role não consegue gerar.
    const PAPEIS_E2E = [
      [IDS.mentorProfile, "mentor_dpp"],
      [IDS.coordProfile, "coordenacao"],
      [IDS.mentorReserva, "mentor_dpp"],
      [IDS.mentorImport, "mentor_dpp"],
      [IDS.jovemProfile, "mentorado"],
      [IDS.espProfile, "mentor_especialista"],
      [IDS.esp2Profile, "mentor_especialista"],
      [IDS.jovem2Profile, "mentorado"],
      [IDS.mentorColega, "mentor_dpp"],
      [IDS.jovem3Profile, "mentorado"],
      [IDS.supProfile, "supervisor"],
      [IDS.hibProfile, "mentor_dpp"],
      [IDS.hibProfile, "mentor_especialista"],
    ];
    for (const [profile_id, papel] of PAPEIS_E2E) {
      // escopo Turma E2E (REALIZA-151): jovem_especialistas/jovem_contatos
      // filtram papel por has_papel(..., turma do jovem) — papel global da
      // fixture vazava pro catálogo/contatos do jovem demo. Converge a
      // linha existente (run antigo criou com escopo null) e remove a
      // duplicata global que o sync de profiles.role pode ter recriado.
      const rows = await rest(
        `profile_papeis?select=id,escopo_turma&profile_id=eq.${profile_id}&papel=eq.${papel}`
      );
      const scoped = (rows ?? []).find((r) => r.escopo_turma === TURMA_E2E);
      if (scoped) {
        for (const r of rows.filter(
          (x) => x.id !== scoped.id && x.escopo_turma !== TURMA_E2E
        )) {
          await del(`profile_papeis?id=eq.${r.id}`);
        }
        continue;
      }
      const global = (rows ?? []).find((r) => r.escopo_turma === null);
      if (global) {
        await patch(`profile_papeis?id=eq.${global.id}`, {
          escopo_turma: TURMA_E2E,
        });
        for (const r of rows.filter((x) => x.id !== global.id)) {
          await del(`profile_papeis?id=eq.${r.id}`);
        }
        continue;
      }
      // a linha que espelha profiles.role é a primária; a extra do híbrido
      // (mentor_especialista) é a secundária. Escopo Turma E2E — o papel
      // só vale na turma fixture, igual ao mundo que os specs exercem.
      const linha = {
        profile_id,
        papel,
        escopo_turma: TURMA_E2E,
        primario:
          !(profile_id === IDS.hibProfile && papel === "mentor_especialista"),
      };
      try {
        await rest("profile_papeis", {
          method: "POST",
          body: JSON.stringify(linha),
        });
      } catch {
        // escopo_turma/primario ainda não saíram na migration aplicada —
        // insere o núcleo (profile_id+papel) e segue; ajustar ao schema final
        await rest("profile_papeis", {
          method: "POST",
          body: JSON.stringify({ profile_id, papel }),
        });
        console.log(`profile_papeis: linha mínima criada pra ${papel} de ${profile_id}`);
      }
    }
    console.log("profile_papeis: papéis das fixtures e2e garantidos");
  } catch (e) {
    console.warn(`profile_papeis: fixture não aplicada — ${e.message}`);
  }
}

// ---- chamados (WP1 · REALIZA-127+) — bloco DEFENSIVO ----
// A tabela chega pela migration do WP1; até lá todo o bloco é no-op. Os
// campos seguem o plano (implementacao-telas-finais.md §WP1 + rascunho
// ux-revisao-chamados.md): autor_id, dupla_id, categoria, descricao_outro,
// assunto, status ('aberto'|'em_atendimento'|'resolvido'), atribuido_a
// (o dono), origem, numero do protocolo. AJUSTAR ao schema final de 0084 —
// coluna divergente faz o insert falhar e o retry grava só o núcleo.
let chamadosOk = false;
try {
  await rest("chamados?select=id&limit=1");
  chamadosOk = true;
} catch {
  console.log("chamados ainda não existe (WP1 pendente) — fixtures de chamado puladas");
}
if (chamadosOk) {
  try {
    const chIds = [IDS.chamadoJovem, IDS.chamadoUrgencia, IDS.chamadoAtendimento].join(",");
    // leftovers primeiro: comentários/atualizações pendurados nos fixtures e
    // chamados que specs abriram como personas e2e — filhos antes dos pais
    const extras = await rest(
      `chamados?select=id&autor_id=in.(${E2E_PROFILES})&id=not.in.(${chIds})`
    );
    const extrasIds = (extras ?? []).map((x) => x.id).join(",");
    if (extrasIds.length) {
      await del(`chamado_comentarios?chamado_id=in.(${extrasIds})`).catch(() => {});
      await del(`chamado_atualizacoes?chamado_id=in.(${extrasIds})`).catch(() => {});
      await del(`chamados?id=in.(${extrasIds})`);
      console.log(`limpeza: ${extrasIds.split(",").length} chamado(s) leftover removidos`);
    }
    await del(`chamado_comentarios?chamado_id=in.(${chIds})`).catch(() => {});
    await del(`chamado_atualizacoes?chamado_id=in.(${chIds})`).catch(() => {});

    // 3 casos do mock v4: um aberto do jovem (outro), uma urgência de mentor
    // DPP sem dono e um em atendimento assumido pelo supervisor
    const CHAMADOS = [
      {
        id: IDS.chamadoUrgencia,
        numero: 143,
        categoria: "urgencia",
        assunto:
          "Preciso de apoio — a mentorada faltou aos últimos dois encontros e a família não responde",
        descricao_outro: null,
        status: "aberto",
        origem: "manual",
        autor_id: IDS.mentorProfile,
        dupla_id: IDS.dupla,
        atribuido_a: null,
      },
      {
        id: IDS.chamadoAtendimento,
        numero: 139,
        categoria: "metodologia",
        assunto:
          "Como registrar sessão de trilha quando o jovem avisa em cima da hora?",
        descricao_outro: null,
        status: "em_atendimento",
        origem: "manual",
        autor_id: IDS.espProfile,
        dupla_id: IDS.duplaEsp,
        atribuido_a: IDS.supProfile,
      },
      {
        id: IDS.chamadoJovem,
        numero: 137,
        categoria: "outro",
        assunto: "Meu sobrenome está errado no cadastro",
        descricao_outro: "Está como “Silva Santos” e o certo é só “Silva”.",
        status: "aberto",
        origem: "manual",
        autor_id: IDS.jovemProfile,
        dupla_id: IDS.dupla,
        atribuido_a: null,
      },
    ];
    for (const c of CHAMADOS) {
      const [existe] = await rest(`chamados?select=id&id=eq.${c.id}`);
      if (!existe) {
        try {
          await rest("chamados", { method: "POST", body: JSON.stringify(c) });
          console.log(`chamado criado: ${c.assunto.slice(0, 40)}…`);
        } catch {
          // coluna divergiu do plano — grava o núcleo certeiro; ajustar ao
          // schema final de 0084
          const nucleo = {
            id: c.id,
            categoria: c.categoria,
            status: c.status,
            autor_id: c.autor_id,
            dupla_id: c.dupla_id,
          };
          await rest("chamados", { method: "POST", body: JSON.stringify(nucleo) });
          console.log(`chamado ${c.id} criado no formato mínimo (schema divergente)`);
        }
      } else {
        // spec assumiu/resolveu — devolve ao estado da fixture
        try {
          await patch(`chamados?id=eq.${c.id}`, {
            status: c.status,
            atribuido_a: c.atribuido_a,
          });
        } catch {
          /* atribuido_a ainda não existe no schema aplicado — o spec re-assume */
        }
      }
    }
    console.log("chamados e2e garantidos");
  } catch (e) {
    console.warn(`chamados: fixtures não aplicadas — ${e.message}`);
  }
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
console.log(`  E2E_ESP2_EMAIL=${ESP2_EMAIL}`);
console.log(`  E2E_JOVEM2_EMAIL=${JOVEM2_EMAIL}`);
console.log(`  E2E_JOVEM3_EMAIL=${JOVEM3_EMAIL}`);
console.log(`  E2E_SUP_EMAIL=${SUP_EMAIL}`);
console.log(`  E2E_HIB_EMAIL=${HIB_EMAIL}`);
console.log("  E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY = do staging");
