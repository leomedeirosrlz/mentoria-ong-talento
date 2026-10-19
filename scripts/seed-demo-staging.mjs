#!/usr/bin/env node
// seed-demo-staging — popula o staging (ou o stack local) com dados de
// demonstração realistas: pessoas com nome de verdade, duplas em fases e
// semáforos variados, histórico de encontros/registros, instrumentos
// respondidos, mural, assinaturas, avisos. É o "programa em andamento"
// que o /demo estático não consegue ser — pra mostrar a plataforma de
// verdade num preview.
//
// Idempotente: tudo que este script cria usa ids no range de000000-*;
// rodar de novo apaga o range e reinsere. Não toca em nada do seed e2e
// (e2e00000-*) nem em dados manuais.
//
// Uso:
//   E2E_SUPABASE_URL=https://<staging>.supabase.co \
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   node scripts/seed-demo-staging.mjs
//
// Senha das contas de login: DEMO_PASSWORD (default de staging, ver código).

import { createHash } from "node:crypto";

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
// ggignore — senha de demo do staging, não é segredo
const SENHA = process.env.DEMO_PASSWORD || "realiza123";

if (!URL_ || !KEY) {
  console.error("uso: E2E_SUPABASE_URL + E2E_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
if (URL_.includes("yhjzmxleotahijinjepl")) {
  console.error("E2E_SUPABASE_URL aponta pra produção — abortado");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, "Content-Type": "application/json", Prefer: "return=representation" };
const HM = { ...H, "Content-Type": "application/json", Prefer: "return=minimal" };

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...HJ, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
const del = (path) => rest(path, { method: "DELETE" });
const post = (path, rows) => {
  // PostgREST exige chaves uniformes no bulk — normaliza com null; chave
  // toda nula sai fora (deixa o default/NOT NULL do banco resolver)
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
    .filter((k) => rows.some((r) => r[k] != null));
  const full = rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
  return rest(path, { method: "POST", body: JSON.stringify(full), headers: { Prefer: "return=minimal" } });
};
const patch = (path, body) =>
  rest(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });

// ids estáveis do demo — range de000000-*, disjoint do e2e (e2e00000-*)
const uid = (n) => `de000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const DIA = 864e5;
const iso = (d) => d.toISOString();
const dateOf = (d) => iso(d).slice(0, 10);
// encontros do ciclo são terças — evergreen: a T1 demo tem cronograma
// próprio (CRON1, mais abaixo) com o 6º encontro oficial na terça da semana
// corrente, como a T2 e o dataset em memória. dataT1/t2Semanas são
// declaradas depois, mas dataEncontro só é chamada dentro de main() — TDZ ok.
const dataEncontro = (numero, hora = "19:00") =>
  new Date(`${dataT1(numero)}T${hora}:00-03:00`).getTime();
const encontroISO = (numero, hora = "19:00") => iso(new Date(dataEncontro(numero, hora)));
const encontroDate = (numero) => dataT1(numero);

// Âncoras relativas ao run (WP4) — exceções e sessões "sempre futuras" não
// podem ficar presas ao epoch do cronograma, senão expiram e somem da UI.
// Tudo em America/Sao_Paulo (o fuso do app e da RPC de slots); `|| 7`
// empurra pra semana seguinte quando hoje já é o dow alvo — mesma regra
// que src/lib/demo/data.ts usa pras âncoras evergreen.
const TZ_SP = "America/Sao_Paulo";
const diaBrt = (dias = 0) =>
  new Date(Date.now() + dias * DIA).toLocaleDateString("en-CA", { timeZone: TZ_SP });
// dow do Postgres (0=dom … 6=sáb) de uma data ISO — meio-dia UTC tira o
// getDay da borda de fuso
const dowDe = (isoDate) => new Date(`${isoDate}T12:00:00Z`).getUTCDay();
/** "YYYY-MM-DD" da 1ª data > hoje (BRT) com o dow pedido. */
const proximoDow = (dow) =>
  diaBrt(((dow - dowDe(diaBrt())) + 7) % 7 || 7);
/** "YYYY-MM-DD" de `ymd` + n dias — âncora no meio-dia UTC, mesma régua. */
const somaDia = (ymd, n) =>
  new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
/** Terça-feira da semana seg–dom deslocada `sem` semanas da corrente. */
const tercaDaSemana = (sem) =>
  somaDia(diaBrt(), -((dowDe(diaBrt()) + 6) % 7) + 1 + sem * 7);

// ---------- 2º cronograma (T2 demo) — relativo ao run, como as âncoras WP4 ----------
// A turma que entrou ~3 semanas depois da T1: o 1º encontro oficial dela é a
// terça de 3 semanas atrás, então o vigente da semana corrente é SEMPRE o
// enc 4 — é ele que separa a dupla agendada da sem_data do "Para acompanhar"
// no backend real, evergreen pra qualquer data de execução. Mesmo esqueleto
// da T1 (seed.sql/0062): preparação → 16 encontros de terça com o gap de
// prática 8º→9º → recesso entre o 14º e o 15º → encerramento +3d do 16º.
const CRON2 = uid(0x500);
const T2_TURMA = "T2 · 2026/2027";
const T2E1 = tercaDaSemana(-3); // 1º encontro oficial da T2
// deslocamento em semanas vs o enc 1: 15d entre 8º e 9º; ~3 semanas de
// recesso entre 14º e 15º (mesma régua da T1 e da demo em memória)
const t2Semanas = (n) => (n <= 8 ? n - 1 : n <= 14 ? n : n + 2);
const dataT2 = (n) => somaDia(T2E1, t2Semanas(n) * 7); // YYYY-MM-DD
const encontroISOT2 = (numero, hora = "19:00") =>
  iso(new Date(`${dataT2(numero)}T${hora}:00-03:00`));

// ---------- T1 evergreen — cronograma demo espelho do oficial ----------
// Antes a T1 apontava pro cronograma REAL do staging (2026-09-08 fixo):
// cada semana que passava empurrava o vigente e as duplas demo iam
// acumulando atrasos falsos. Agora a T1 tem cronograma próprio, ancorado
// pra que o 6º encontro oficial caia na terça da semana corrente — então
// os encontros 1–5 são SEMPRE passados e o vigente é 6 (terça em diante)
// ou 5 (dom/seg, quando a terça ainda não virou data <= hoje).
const CRON1 = uid(0x4f0);
const T1E1 = tercaDaSemana(-5); // enc 6 = terça desta semana
const dataT1 = (n) => somaDia(T1E1, t2Semanas(n) * 7); // mesma régua da T2
// o enc 6 "realizado" só é verdade depois das 19h da terça — antes disso a
// row sai agendada (vigente coberto, sem fake-futuro)
const T1E6_PASSOU =
  Date.now() > new Date(`${dataT1(6)}T19:00:00-03:00`).getTime();
const T1_TURMA = "T1 · 2026/2027";

// ---------- 0. limpeza idempotente do range de000000-* ----------
async function limpar() {
  console.log("limpando range de000000-* …");
  // filhos primeiro — os filtros por FK usam o prefixo do uuid também
  const porFk = [
    ["notificacoes", "profile_id"], ["notificacoes", "created_by"],
    ["presencas", "profile_id"], ["presencas", "marcado_por"],
    ["supervisoes", "supervisor_id"], ["supervisoes", "mentor_id"], ["supervisoes", "dupla_id"], ["supervisoes", "created_by"],
    ["interacoes", "dupla_id"], ["interacoes", "autor_id"],
    ["encaminhamentos", "dupla_id"],
    ["avaliacoes_encontro", "dupla_id"], ["avaliacoes_encontro", "encontro_id"], ["avaliacoes_encontro", "respondido_por_profile_id"],
    ["avaliacao_links", "dupla_id"], ["avaliacao_links", "respondido_por_profile_id"],
    ["formulario_links", "respondido_por_profile_id"],
    ["ia_eventos", "profile_id"],
    ["emails_enviados", "autor_id"],
    ["encontro_notas", "created_by"],
    ["registro_anexos", "created_by"],
    ["registros", "created_by"], ["registros", "encontro_id"],
    ["pessoa_notas", "profile_id"], ["pessoa_notas", "mentorado_id"], ["pessoa_notas", "created_by"],
    ["solicitacao_propostas", "solicitacao_id"], ["solicitacao_propostas", "autor_id"],
    // solicitacoes_mural é VIEW — a tabela real é solicitacoes_especialista
    ["solicitacoes_especialista", "id"], ["solicitacoes_especialista", "mentorado_id"],
    ["solicitacoes_especialista", "dupla_id"], ["solicitacoes_especialista", "created_by"],
    // devolutivas (WP6) — filho de duplas × profiles, antes deles
    ["devolutivas", "dupla_id"], ["devolutivas", "autor_id"],
    ["especialista_grade", "profile_id"], ["especialista_excecoes", "profile_id"],
    ["encerramentos", "dupla_id"],
    ["formulario_links", "dupla_id"], ["formulario_links", "dest_profile_id"], ["formulario_links", "dest_mentorado_id"],
    ["assinaturas", "profile_id"], ["assinaturas", "mentorado_id"],
    ["encontros", "dupla_id"], ["encontros", "created_by"],
    ["duplas", "id"],
    // 2º cronograma demo (de000000-…0500) — eventos antes do pai
    ["ciclo_eventos", "cronograma_id"], ["ciclo_eventos", "id"],
    ["cronogramas", "created_by"], ["cronogramas", "id"],
    ["mentor_profiles", "profile_id"],
    ["comunicados", "created_by"],
    ["mentorados", "id"],
    ["profiles", "id"],
  ];
  // uuid não aceita LIKE no PostgREST — range scan no prefixo de000000-…-8000-*
  const LO = "de000000-0000-4000-8000-000000000000", HI = "de000000-0000-4000-8001-000000000000";
  const emRange = (col) => `${col}=gte.${LO}&${col}=lt.${HI}`;
  // chamados abertos pela UI/demo nascem com id randômico (o range de000000-*
  // só cobre o que este script semeia) — apaga por FK de range e em cascata
  // pros filhos, que penduram em chamado_id fora do range
  const chIds = new Set();
  for (const col of ["autor_id", "autor_mentorado_id", "dupla_id", "atribuido_a", "resolvido_por", "registro_id", "avaliacao_id"]) {
    try {
      const rows = await rest(`chamados?select=id&${emRange(col)}`);
      for (const r of rows ?? []) chIds.add(r.id);
    } catch (e) { console.log(`  skip chamados.${col}: ${e.message.slice(0, 80)}`); }
  }
  if (chIds.size) {
    const csv = [...chIds].join(",");
    for (const filho of ["chamado_comentarios", "chamado_atualizacoes", "chamado_anexos"]) {
      try { await del(`${filho}?chamado_id=in.(${csv})`); } catch (e) { console.log(`  skip ${filho}: ${e.message.slice(0, 80)}`); }
    }
    await del(`chamados?id=in.(${csv})`);
  }
  for (const [tabela, col] of porFk) {
    try { await del(`${tabela}?${emRange(col)}`); } catch (e) { console.log(`  skip ${tabela}.${col}: ${e.message.slice(0, 80)}`); }
  }
  // respostas órfãs (link de000000-*)
  try { await del(`formulario_respostas?${emRange("link_id")}`); } catch {}
  // auth users das contas de login demo
  // auth admin vive em /auth/v1 (não /rest/v1) — fetch direto
  const emails = ["coord@realiza.test", "supervisora@realiza.test", "mentor@realiza.test",
    "especialista@realiza.test", "jovem@realiza.test", "e2e-supervisor@realiza.test"];
  // supervisor avulso criado à mão antes deste seed existir — desvincula a
  // dupla e remove o profile (auth user sai no loop abaixo)
  try { await patch("duplas?supervisor_id=eq.f00dd000-0000-4000-8000-000000000001", { supervisor_id: null }); } catch {}
  try { await del("profiles?id=eq.f00dd000-0000-4000-8000-000000000001"); } catch {}
  for (const email of emails) {
    const r = await fetch(`${URL_}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: H });
    if (!r.ok) { console.log(`  auth ${email}: ${r.status} — seguindo`); continue; }
    const body = await r.json();
    const u = (body?.users ?? body ?? []).find?.((x) => x.email?.toLowerCase() === email);
    if (u) {
      const d = await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: H });
      if (!d.ok) console.log(`  auth ${email}: ${d.status} (perfil fica sem login)`);
    }
  }
}

// ---- auth user com senha (senha_em → pula /auth/definir-senha) ----
async function garantirAuthUser(email, profileId) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST", headers: HJ,
    body: JSON.stringify({ email, password: SENHA, email_confirm: true,
      user_metadata: { senha_em: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error(`admin createUser ${email} → ${res.status}: ${await res.text()}`);
  const user = await res.json();
  await patch(`profiles?id=eq.${profileId}`, { user_id: user.id });
  console.log(`  login ${email} → ${user.id}`);
}

// ================= dados =================

const WA = (ddd, n) => `55${ddd}9${String(n).padStart(8, "0")}`;

// ---- equipe ----
const P = {
  coord: uid(0x100), coord2: uid(0x101), sup1: uid(0x102), sup2: uid(0x103),
  // mentores DPP
  andre: uid(0x110), beatriz: uid(0x111), fernando: uid(0x112), juliana: uid(0x113),
  ricardo: uid(0x114), camila: uid(0x115), tiago: uid(0x116), renata: uid(0x117),
  gustavo: uid(0x118), patricia: uid(0x119), leonardo: uid(0x11a), vanessa: uid(0x11b),
  eduardo: uid(0x11c), monica: uid(0x11d), daniel: uid(0x11e),
  elisa: uid(0x11f), // mentora nova da T2
  // especialistas
  luisa: uid(0x130), marcos: uid(0x131), sofia: uid(0x132), pedroH: uid(0x133),
};

const profiles = [
  // equipe
  { id: P.coord, nome: "Marina Duarte", email: "coord@realiza.test", whatsapp: WA(11, 81010001), role: "coordenacao", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-07-15T10:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Coordenadora de programas", empresa: "Instituto Realiza", bio: "Pedagoga, 12 anos em educação não-formal. Cuida do ciclo inteiro." },
  { id: P.coord2, nome: "Rafael Antunes", email: "rafael.antunes@realiza.test", whatsapp: WA(11, 81010002), role: "coordenacao", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-07-20T10:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Assistente de coordenação", empresa: "Instituto Realiza" },
  { id: P.sup1, nome: "Paula Vieira", email: "supervisora@realiza.test", whatsapp: WA(11, 81010003), role: "supervisor", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-08-10T10:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Psicóloga organizacional", empresa: "Autônoma", bio: "Acompanha metade das duplas do ciclo." },
  { id: P.sup2, nome: "Carlos Nogueira", email: "carlos.nogueira@realiza.test", whatsapp: WA(11, 81010004), role: "supervisor", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-08-10T10:00:00-03:00")), cidade: "Campinas", uf: "SP", cargo: "Professor universitário", empresa: "Unicamp" },
  // mentores DPP
  { id: P.andre, nome: "Otávio Martins", email: "mentor@realiza.test", whatsapp: WA(11, 82010001), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Engenheiro de software sênior", empresa: "Nubank", areas: ["Carreiras em tecnologia", "Primeiro emprego"], interesses: ["Basquete", "Cinema"], bio: "Segundo ciclo como mentor. Engenheiro de software, saiu da periferia e gosta de abrir portas.", motivacao: "Alguém acreditou em mim aos 18. Quero ser essa pessoa pra outro jovem.", pref_genero_par: "indiferente", origem: "Indicação interna" },
  { id: P.beatriz, nome: "Sabrina Salles", email: "sabrina.salles@realiza.test", whatsapp: WA(11, 82010002), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Médica residente", empresa: "USP", areas: ["Saúde", "Estudos e vestibular"], interesses: ["Corrida", "Literatura"], motivacao: "Quero ajudar jovens que sonham com medicina e não sabem por onde começar.", origem: "Google Forms 2026" },
  { id: P.fernando, nome: "Sérgio Costa", email: "sergio.costa@realiza.test", whatsapp: WA(11, 82010003), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "Guarulhos", uf: "SP", cargo: "Advogado tributarista", empresa: "Tozzini Freire", areas: ["Direito", "Concursos"], motivacao: "Mentoria mudou a minha trajetória no ensino médio.", origem: "Google Forms 2026" },
  { id: P.juliana, nome: "Tatiana Paiva", email: "tatiana.paiva@realiza.test", whatsapp: WA(11, 82010004), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Professora de inglês", empresa: "Cultura Inglesa", areas: ["Idiomas", "Intercâmbio"], motivacao: "Quero mostrar que inglês é ferramenta de mobilidade.", origem: "Indicação de mentor 2025" },
  { id: P.ricardo, nome: "Ricardo Almeida", email: "ricardo.almeida@realiza.test", whatsapp: WA(11, 82010005), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Desenvolvedor mobile", empresa: "PicPay", areas: ["Tecnologia", "Freelance"], motivacao: "Aprendi a programar sozinho; ninguém merece passar por isso sem guia.", origem: "Google Forms 2026" },
  { id: P.camila, nome: "Viviane Ribeiro", email: "viviane.ribeiro@realiza.test", whatsapp: WA(11, 82010006), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Psicóloga clínica", empresa: "Autônoma", areas: ["Autoconhecimento", "Saúde mental"], motivacao: "A escuta que recebi aos 17 anos me formou.", origem: "Google Forms 2026" },
  { id: P.tiago, nome: "Tiago Fonseca", email: "tiago.fonseca@realiza.test", whatsapp: WA(11, 82010007), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "Osasco", uf: "SP", cargo: "Empreendedor", empresa: "Próprio negócio", areas: ["Empreendedorismo", "Finanças"], motivacao: "Empreender me tirou da vulnerabilidade. Quero mostrar o caminho.", origem: "Parceria Sebrae" },
  { id: P.renata, nome: "Renata Lima", email: "renata.lima@realiza.test", whatsapp: WA(11, 82010008), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Product designer", empresa: "iFood", areas: ["Design", "Criatividade"], motivacao: "Design mudou a minha vida. Tem muito talento invisível por aí.", origem: "Google Forms 2026" },
  { id: P.gustavo, nome: "Vitor Rocha", email: "vitor.rocha@realiza.test", whatsapp: WA(11, 82010009), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2025-09-01T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Analista financeiro", empresa: "Itaú", areas: ["Finanças pessoais", "Mercado financeiro"], motivacao: "Veterano do ciclo anterior — voltou porque viu o resultado.", origem: "Mentor 2025" },
  { id: P.patricia, nome: "Patrícia Moura", email: "patricia.moura@realiza.test", whatsapp: WA(11, 82010010), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Gerente de RH", empresa: "Ambev", areas: ["Carreiras corporativas", "Entrevistas"], motivacao: "Contrato gente todo dia — sei o que o mercado procura.", origem: "Google Forms 2026" },
  { id: P.leonardo, nome: "Rodrigo Brito", email: "rodrigo.brito@realiza.test", whatsapp: WA(11, 82010011), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Cientista de dados", empresa: "Mercado Livre", areas: ["Dados", "Matemática aplicada"], motivacao: "Quero desmistificar matemática pra quem acha que não é pra eles.", origem: "Google Forms 2026" },
  { id: P.vanessa, nome: "Vanessa Cardoso", email: "vanessa.cardoso@realiza.test", whatsapp: WA(11, 82010012), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "Santos", uf: "SP", cargo: "Jornalista", empresa: "Globo", areas: ["Comunicação", "Escrita"], motivacao: "Contar histórias é o meu ofício; quero ajudar jovens a contar a deles.", origem: "Indicação interna" },
  { id: P.eduardo, nome: "Wagner Sales", email: "wagner.sales@realiza.test", whatsapp: WA(11, 82010013), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Engenheiro civil", empresa: "MRV", areas: ["Engenharia", "Gestão de projetos"], motivacao: "Construo prédios; quero ajudar a construir futuros.", origem: "Google Forms 2026" },
  { id: P.monica, nome: "Mônica Freitas", email: "monica.freitas@realiza.test", whatsapp: WA(11, 82010014), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-10-01T14:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Nutricionista", empresa: "Hospital Sírio-Libanês", areas: ["Saúde", "Rotina e hábitos"], motivacao: "Entrei no meio do ciclo — assumi o par na turma nova (T2).", origem: "Google Forms 2026" },
  { id: P.daniel, nome: "Natan Peixoto", email: "natan.peixoto@realiza.test", whatsapp: WA(11, 82010015), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date("2026-10-05T14:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Chef de cozinha", empresa: "Restaurante próprio", areas: ["Gastronomia", "Empreendedorismo"], motivacao: "A cozinha me salvou. Quero mostrar que profissão braçal também é carreira.", origem: "Parceria Sebrae" },
  // mentora nova da T2 — onboarded na semana do onboarding da turma dela
  { id: P.elisa, nome: "Elisa Prado", email: "elisa.prado@realiza.test", whatsapp: WA(11, 82010016), role: "mentor_dpp", ativo: true, onboarded_em: iso(new Date(`${somaDia(T2E1, -5)}T20:00:00-03:00`)), cidade: "São Paulo", uf: "SP", cargo: "Veterinária", empresa: "Clínica própria", areas: ["Saúde", "Ciências"], interesses: ["Corrida de rua", "Fotografia"], motivacao: "Mentoria me tirou de um curso errado aos 17 — quero retribuir.", origem: "Indicação interna" },
  // especialistas
  { id: P.luisa, nome: "Luísa Camargo", email: "especialista@realiza.test", whatsapp: WA(11, 83010001), role: "mentor_especialista", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Psicóloga — orientação vocacional", empresa: "Autônoma", areas: ["Escolha de carreira", "Ansiedade de desempenho"], bio: "Especialista em transição escola-trabalho." },
  { id: P.marcos, nome: "Marcos Vinícius", email: "marcos.vinicius@realiza.test", whatsapp: WA(11, 83010002), role: "mentor_especialista", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Headhunter executivo", empresa: "Robert Half", areas: ["Currículo", "Entrevistas", "LinkedIn"] },
  { id: P.sofia, nome: "Sofia Andrade", email: "sofia.andrade@realiza.test", whatsapp: WA(11, 83010003), role: "mentor_especialista", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Educadora financeira", empresa: "Autônoma", areas: ["Finanças pessoais", "Primeiro salário"] },
  { id: P.pedroH, nome: "Pedro Henrique Sales", email: "pedro.sales@realiza.test", whatsapp: WA(11, 83010004), role: "mentor_especialista", ativo: true, interesses: [], onboarded_em: iso(new Date("2026-09-03T20:00:00-03:00")), cidade: "São Paulo", uf: "SP", cargo: "Médico do esporte", empresa: "COB", areas: ["Rotina de estudos", "Disciplina"] },
];

// mentor_profiles: capacidade/teto + formação + disponibilidade
const mentorProfiles = [
  { profile_id: P.andre, tipo: "dpp", capacidade: 3, termo_ok: true, formacao_ok: true, areas: ["Tecnologia", "Primeiro emprego"], experiencia_previa: "Mentor no ciclo 2025.", disponibilidade: { seg: ["19:00-21:00"], ter: ["19:00-21:00"], qua: [], qui: ["19:00-21:00"], sex: [], sab: ["10:00-12:00"], dom: [] } },
  { profile_id: P.beatriz, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Saúde", "Vestibular"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["09:00-11:00"], dom: [] } },
  { profile_id: P.fernando, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Direito"], disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: ["10:00-12:00"] } },
  { profile_id: P.juliana, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Idiomas"], disponibilidade: { seg: [], ter: ["18:00-20:00"], qua: [], qui: [], sex: ["18:00-20:00"], sab: [], dom: [] } },
  { profile_id: P.ricardo, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Tecnologia"], disponibilidade: { seg: ["19:00-21:00"], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["14:00-16:00"], dom: [] } },
  { profile_id: P.camila, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Autoconhecimento"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: ["19:00-21:00"], qui: [], sex: [], sab: [], dom: ["15:00-17:00"] } },
  { profile_id: P.tiago, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Empreendedorismo"], disponibilidade: { seg: [], ter: [], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["08:00-10:00"], dom: [] } },
  { profile_id: P.renata, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: false, areas: ["Design"], disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { profile_id: P.gustavo, tipo: "dpp", capacidade: 1, termo_ok: true, formacao_ok: true, areas: ["Finanças"], disponibilidade: { seg: ["19:00-21:00"], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: [], dom: [] } },
  { profile_id: P.patricia, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["RH"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: ["19:00-21:00"], sab: [], dom: [] } },
  { profile_id: P.leonardo, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Dados"], disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["10:00-12:00"], dom: [] } },
  { profile_id: P.vanessa, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Comunicação"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["11:00-13:00"], dom: [] } },
  { profile_id: P.eduardo, tipo: "dpp", capacidade: 2, termo_ok: true, formacao_ok: true, areas: ["Engenharia"], disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { profile_id: P.monica, tipo: "dpp", capacidade: 1, termo_ok: true, formacao_ok: true, areas: ["Saúde"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["09:00-12:00"], dom: [] } },
  { profile_id: P.daniel, tipo: "dpp", capacidade: 1, termo_ok: true, formacao_ok: false, areas: ["Gastronomia"], disponibilidade: { seg: ["15:00-17:00"], ter: [], qua: ["15:00-17:00"], qui: [], sex: [], sab: [], dom: [] } },
  // mentora nova da T2 — formada no onboarding da turma dela
  { profile_id: P.elisa, tipo: "dpp", capacidade: 1, termo_ok: true, formacao_ok: true, areas: ["Saúde", "Ciências"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: ["19:00-21:00"], sex: [], sab: ["09:00-11:00"], dom: [] } },
  { profile_id: P.luisa, tipo: "especialista", capacidade_especialista: 2, termo_ok: true, formacao_ok: true, areas: ["Escolha de carreira"], disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { profile_id: P.marcos, tipo: "especialista", capacidade_especialista: 2, termo_ok: true, formacao_ok: true, areas: ["Currículo", "Entrevistas"], disponibilidade: { seg: [], ter: [], qua: ["18:00-20:00"], qui: [], sex: [], sab: ["10:00-12:00"], dom: [] } },
  { profile_id: P.sofia, tipo: "especialista", capacidade_especialista: 1, termo_ok: true, formacao_ok: true, areas: ["Finanças pessoais"], disponibilidade: { seg: [], ter: [], qua: [], qui: [], sex: [], sab: ["09:00-11:00"], dom: ["10:00-12:00"] } },
  { profile_id: P.pedroH, tipo: "especialista", capacidade_especialista: 1, termo_ok: true, formacao_ok: true, areas: ["Disciplina"], disponibilidade: { seg: ["18:00-20:00"], ter: [], qua: [], qui: ["18:00-20:00"], sex: [], sab: [], dom: [] } },
];

// ---- mentorados ----
const M = {
  ana: uid(0x200), pedroLucas: uid(0x201), mariaFer: uid(0x202), joaoPedro: uid(0x203),
  gabriela: uid(0x204), rafaela: uid(0x205), lucasG: uid(0x206), isabela: uid(0x207),
  enzo: uid(0x208), yasmin: uid(0x209), kaique: uid(0x20a), manuela: uid(0x20b),
  larissa: uid(0x20c), beatrizN: uid(0x20d), matheus: uid(0x20e),
  // T2 demo — a turma nova trouxe os dois pela ONG parceira dela
  davi: uid(0x215), luna: uid(0x216),
  // fila + saídas
  vanessaR: uid(0x210), igor: uid(0x211), helena: uid(0x212),
  bruno: uid(0x213), carla: uid(0x214),
};

const jovemProfile = uid(0x140); // profile de login da Ana
// profile da Larissa — a devolutiva da trilha1 notifica o jovem por
// profile_id; ela ainda não tem conta (user_id null = convite pendente)
const larissaProfile = uid(0x141);

const mentorados = [
  { id: M.ana, nome: "Ana Beatriz Souza", email: "jovem@realiza.test", whatsapp: WA(11, 91010001), ong_origem: "ONG Futuro Agora", data_nascimento: "2007-03-14", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Medicina", "Vôlei", "Desenho"], objetivos: "Passar no vestibular de Medicina e ser a primeira médica da família.", motivacao: "Quero provar pra mim mesma que dá.", origem: "ONG Futuro Agora", situacao: "ativo", profile_id: jovemProfile, contato_compartilhado: true, disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["14:00-16:00"], dom: [] } },
  { id: M.pedroLucas, nome: "Pedro Lucas Silva", whatsapp: WA(11, 91010002), ong_origem: "Instituto Ponte", data_nascimento: "2009-06-22", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Futebol", "Games"], objetivos: "Descobrir uma profissão que eu goste.", origem: "Instituto Ponte", situacao: "ativo", responsavel: { nome: "Márcia Silva", parentesco: "Mãe", whatsapp: WA(11, 91010002) }, disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["09:00-11:00"], dom: [] } },
  { id: M.mariaFer, nome: "Maria Fernanda Costa", whatsapp: WA(11, 91010003), ong_origem: "ONG Futuro Agora", data_nascimento: "2006-01-30", genero: "feminino", cidade: "Guarulhos", uf: "SP", escolaridade: "medio", interesses: ["Direito", "Leitura", "Debate"], objetivos: "Passar em Direito na USP ou numa pública.", origem: "ONG Futuro Agora", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: ["10:00-12:00"] } },
  { id: M.joaoPedro, nome: "João Pedro Santos", whatsapp: WA(11, 91010004), ong_origem: "Escola Estadual Prof. Ramos", data_nascimento: "2008-08-11", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Inglês", "Música", "Viagem"], objetivos: "Fazer intercâmbio e trabalhar fora do país.", origem: "Escola parceira", situacao: "ativo", disponibilidade: { seg: [], ter: ["18:00-20:00"], qua: [], qui: [], sex: ["18:00-20:00"], sab: [], dom: [] } },
  { id: M.gabriela, nome: "Gabriela Oliveira", whatsapp: WA(11, 91010005), ong_origem: "Instituto Ponte", data_nascimento: "2010-02-19", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "fundamental", interesses: ["Computação", "Robótica"], objetivos: "Aprender programação e montar meu primeiro projeto.", origem: "Instituto Ponte", situacao: "ativo", responsavel: { nome: "Sônia Oliveira", parentesco: "Mãe", whatsapp: WA(11, 91010005) }, disponibilidade: { seg: ["19:00-21:00"], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["14:00-16:00"], dom: [] } },
  { id: M.rafaela, nome: "Rafaela Mendes", whatsapp: WA(11, 91010006), ong_origem: "ONG Futuro Agora", data_nascimento: "2005-11-05", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "superior_incompleto", interesses: ["Psicologia", "Escrita", "Podcasts"], objetivos: "Entrar na faculdade de Psicologia e trabalhar com jovens.", origem: "ONG Futuro Agora", situacao: "ativo", disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: ["19:00-21:00"], qui: [], sex: [], sab: [], dom: ["15:00-17:00"] } },
  { id: M.lucasG, nome: "Lucas Gabriel Rocha", whatsapp: WA(11, 91010007), ong_origem: "Programa Jovem Aprendiz", data_nascimento: "2007-04-27", genero: "masculino", cidade: "Osasco", uf: "SP", escolaridade: "medio", interesses: ["Empreendedorismo", "Sneakers"], objetivos: "Montar meu próprio negócio até os 25.", origem: "Programa Jovem Aprendiz", situacao: "ativo", disponibilidade: { seg: [], ter: [], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["08:00-10:00"], dom: [] } },
  { id: M.isabela, nome: "Isabela Ferreira", whatsapp: WA(11, 91010008), ong_origem: "Escola Estadual Prof. Ramos", data_nascimento: "2008-05-15", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Design", "Arte", "Fotografia"], objetivos: "Virar designer e trabalhar com marcas grandes.", origem: "Escola parceira", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { id: M.enzo, nome: "Enzo Carvalho", whatsapp: WA(11, 91010009), ong_origem: "Instituto Ponte", data_nascimento: "2009-12-03", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Finanças", "Investimento"], objetivos: "Entender de dinheiro pra ajudar minha família.", origem: "Instituto Ponte", situacao: "ativo", responsavel: { nome: "Rogério Carvalho", parentesco: "Pai", whatsapp: WA(11, 91010009) }, disponibilidade: { seg: ["19:00-21:00"], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: [], dom: [] } },
  { id: M.yasmin, nome: "Yasmin Barbosa", whatsapp: WA(11, 91010010), ong_origem: "ONG Futuro Agora", data_nascimento: "2007-07-08", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["RH", "Liderança", "Dança"], objetivos: "Primeiro emprego em escritório e faculdade de Administração.", origem: "ONG Futuro Agora", situacao: "ativo", disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: ["19:00-21:00"], sab: [], dom: [] } },
  { id: M.kaique, nome: "Kaique dos Santos", whatsapp: WA(11, 91010011), ong_origem: "Programa Jovem Aprendiz", data_nascimento: "2005-09-21", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "superior_incompleto", interesses: ["Dados", "Excel", "Futebol"], objetivos: "Trabalhar com análise de dados.", origem: "Programa Jovem Aprendiz", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["10:00-12:00"], dom: [] } },
  { id: M.manuela, nome: "Manuela Rodrigues", whatsapp: WA(11, 91010012), ong_origem: "ONG Futuro Agora", data_nascimento: "2008-10-17", genero: "feminino", cidade: "Santos", uf: "SP", escolaridade: "medio", interesses: ["Escrita", "Jornalismo"], objetivos: "Escrever pra um jornal um dia.", origem: "ONG Futuro Agora", situacao: "ativo", disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: [], sex: [], sab: ["11:00-13:00"], dom: [] } },
  { id: M.larissa, nome: "Larissa Campos", whatsapp: WA(11, 91010013), ong_origem: "Instituto Ponte", data_nascimento: "2009-03-25", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Vestibular", "Ansiedade", "Biologia"], objetivos: "Controlar a ansiedade e escolher entre Biologia e Psicologia.", origem: "Instituto Ponte", situacao: "ativo", responsavel: { nome: "Denise Campos", parentesco: "Mãe", whatsapp: WA(11, 91010013) }, profile_id: larissaProfile, disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { id: M.beatrizN, nome: "Beatriz Nogueira", whatsapp: WA(11, 91010014), ong_origem: "Escola Estadual Prof. Ramos", data_nascimento: "2007-12-01", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Engenharia", "Desenho técnico"], objetivos: "Engenharia civil ou arquitetura.", origem: "Escola parceira", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { id: M.matheus, nome: "Matheus Henrique Lima", whatsapp: WA(11, 91010015), ong_origem: "Instituto Ponte", data_nascimento: "2004-02-14", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "superior_incompleto", interesses: ["Concurso público", "Rotina de estudos"], objetivos: "Passar num concurso e ter estabilidade.", origem: "Instituto Ponte", situacao: "desistente", saiu_em: iso(new Date("2026-10-06T10:00:00-03:00")), motivo_saida: "Foi chamado num concurso do município e saiu do estado." },
  // fila aguardando par — UMA pessoa demo só: o card "Sugerir
  // remanejamento" fatia a fila em 4 e o spec e2e precisa que a fixture
  // "Mentorada E2E Livre" caiba no corte (desempate é por espera, e os
  // carimbos demo são sempre mais antigos que o reseed e2e)
  { id: M.igor, nome: "Igor Batista", whatsapp: WA(11, 91010017), ong_origem: "Instituto Ponte", data_nascimento: "2007-09-09", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Eletrônica", "Mecânica"], objetivos: "Curso técnico e primeiro emprego.", origem: "Instituto Ponte", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: ["19:00-21:00"], qui: [], sex: [], sab: ["14:00-16:00"], dom: [] } },
  { id: M.vanessaR, nome: "Vanessa Ribeiro", whatsapp: WA(11, 91010016), ong_origem: "ONG Futuro Agora", data_nascimento: "2008-06-30", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Enfermagem", "Cuidar de pessoas"], objetivos: "Ser enfermeira.", origem: "ONG Futuro Agora", situacao: "desistente", saiu_em: iso(new Date("2026-09-28T10:00:00-03:00")), motivo_saida: "Família se mudou pra outra cidade no meio do ciclo." },
  { id: M.helena, nome: "Helena Castro", whatsapp: WA(11, 91010018), ong_origem: "Escola Estadual Prof. Ramos", data_nascimento: "2008-04-19", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Publicidade", "Redes sociais"], objetivos: "Trabalhar com marketing.", origem: "Escola parceira", situacao: "desistente", saiu_em: iso(new Date("2026-10-08T10:00:00-03:00")), motivo_saida: "Entrou no Jovem Aprendiz e ficou sem horário compatível." },
  // saídas
  { id: M.bruno, nome: "Bruno Almeida", whatsapp: WA(11, 91010019), ong_origem: "Instituto Ponte", data_nascimento: "2006-08-20", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Música"], objetivos: "Ser músico profissional.", origem: "Instituto Ponte", situacao: "desistente", saiu_em: iso(new Date("2026-09-25T10:00:00-03:00")), motivo_saida: "Começou a trabalhar em período integral e não tinha mais horário." },
  { id: M.carla, nome: "Carla Teixeira", whatsapp: WA(11, 91010020), ong_origem: "Escola Estadual Prof. Ramos", data_nascimento: "2007-11-11", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Gastronomia"], objetivos: "Curso de gastronomia.", origem: "Escola parceira", situacao: "desistente", saiu_em: iso(new Date("2026-10-02T10:00:00-03:00")), motivo_saida: "Sem resposta aos contatos por 3 semanas." },
  // T2 demo — entraram com a turma nova pela ONG parceira dela
  { id: M.davi, nome: "Davi Santos", whatsapp: WA(11, 91010021), ong_origem: "Cidadão Pró-Mundo", data_nascimento: "2009-01-17", genero: "masculino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Tecnologia", "Skate"], objetivos: "Curso técnico de informática e o primeiro emprego.", origem: "Cidadão Pró-Mundo", situacao: "ativo", responsavel: { nome: "Sandra Santos", parentesco: "Mãe", whatsapp: WA(11, 91010021) }, disponibilidade: { seg: [], ter: ["19:00-21:00"], qua: [], qui: ["19:00-21:00"], sex: [], sab: [], dom: [] } },
  { id: M.luna, nome: "Luna Ferreira", whatsapp: WA(11, 91010022), ong_origem: "Cidadão Pró-Mundo", data_nascimento: "2008-04-02", genero: "feminino", cidade: "São Paulo", uf: "SP", escolaridade: "medio", interesses: ["Biologia", "Voluntariado"], objetivos: "Vestibular de Biologia e projetos de extensão.", origem: "Cidadão Pró-Mundo", situacao: "ativo", disponibilidade: { seg: ["19:00-21:00"], ter: [], qua: [], qui: [], sex: [], sab: ["14:00-16:00"], dom: [] } },
];

// profiles extras (login da jovem + staff sem conta já cobertos)
profiles.push({
  id: jovemProfile, nome: "Ana Beatriz Souza", email: "jovem@realiza.test",
  whatsapp: WA(11, 91010001), role: "mentorado", ativo: true,
  onboarded_em: iso(new Date("2026-09-04T19:00:00-03:00")),
  cidade: "São Paulo", uf: "SP", interesses: ["Medicina", "Vôlei", "Desenho"],
  data_nascimento: "2007-03-14", genero: "feminino",
});
// a Larissa só tem profile porque a devolutiva da trilha dela notifica por
// profile_id — sem user_id e sem onboarded_em: o convite segue pendente
profiles.push({
  id: larissaProfile, nome: "Larissa Campos", email: "larissa.campos@realiza.test",
  whatsapp: WA(11, 91010013), role: "mentorado", ativo: true,
  cidade: "São Paulo", uf: "SP", interesses: ["Vestibular", "Ansiedade", "Biologia"],
  data_nascimento: "2009-03-25", genero: "feminino",
});


// ---------- esqueleto oficial do ciclo (compartilhado T1 × T2) ----------
// [tipo, numero, data, titulo, fase, instrumentos, data_fim, status, observacao]
// — mesma sequência explícita do PDF oficial que a T1 espelha no seed.sql.
const F1 = "Criar vínculo e construir o PDM";
const F2 = "Colocar o plano em prática";
const F3 = "Consolidar a autonomia";
const F4 = "Aprofundar o vínculo e o aprendizado";
const F5 = "Roda da Vida";
const F6 = "Encerrar e celebrar";
const montaEventosDpp = (E1, dataE, cronId, idBase) =>
  [
    ["etapa_preparacao", null, null, "Inscrições", null, [], null, "concluida", "Inscrição e indicação pela ONG parceira Cidadão Pró-Mundo"],
    ["etapa_preparacao", null, null, "Triagem e matching", null, [], null, "concluida", "Entregue concluída pela ONG parceira Cidadão Pró-Mundo"],
    ["etapa_preparacao", null, somaDia(E1, -5), "Onboarding de mentores", null, [], somaDia(E1, -4), "concluida", null],
    ["formacao", null, somaDia(E1, -5), "Encontro inicial de formação de mentores", null, [], null, "pendente", null],
    ["formacao", null, somaDia(E1, -4), "Encontro final de formação de mentores", null, [], null, "pendente", null],
    ["etapa_preparacao", null, somaDia(E1, -4), "Onboarding de mentorados", null, [], null, "concluida", "Encontro de abertura com a coordenação"],
    ["etapa_preparacao", null, E1, "Início", null, [], null, "concluida", null],
    ["encontro", 1, dataE(1), "Boas-vindas, histórias de vida e abertura", F1, ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"], null, "pendente", "Reposição na mesma semana"],
    ["encontro", 2, dataE(2), "Avaliação por terceiros e visão de futuro", F1, ["PDM", "Construindo a sua Visão"], null, "pendente", null],
    ["encontro", 3, dataE(3), "Declaração de Visão e metas SMART", F1, ["PDM", "Modelo SMART"], null, "pendente", null],
    ["encontro", 4, dataE(4), "Fechamento da construção do PDM", F1, ["PDM", "Perguntas Eficazes"], null, "pendente", null],
    ["encontro", 5, dataE(5), "Acompanhamento das primeiras submetas", F2, ["PDM", "Feedback Construtivo"], null, "pendente", null],
    ["encontro", 6, dataE(6), "Superação de obstáculos", F2, ["PDM", "Feedback Construtivo"], null, "pendente", null],
    ["encontro", 7, dataE(7), "Ajustes de prazos e desdobramentos", F2, ["PDM", "Feedback Construtivo"], null, "pendente", null],
    ["encontro", 8, dataE(8), "Monitoramento e responsabilidade", F3, ["PDM", "Escuta Ativa"], null, "pendente", null],
    ["encontro", 9, dataE(9), "Revisão de meio de percurso", F3, ["PDM", "Escuta Ativa"], null, "pendente", "15 dias desde o 8º encontro — tempo de prática das submetas"],
    ["encontro", 10, dataE(10), "O mentor como espelho", F4, ["Papel de modelo", "Escuta Ativa"], null, "pendente", null],
    ["encontro", 11, dataE(11), "Rede de apoio e novos espaços", F4, ["Papel de modelo", "Escuta Ativa"], null, "pendente", null],
    ["encontro", 12, dataE(12), "Aplicação e leitura da Roda da Vida", F5, ["Roda da Vida", "Modelo SMART"], null, "pendente", null],
    ["encontro", 13, dataE(13), "Metas das áreas prioritárias", F5, ["Roda da Vida", "Modelo SMART"], null, "pendente", null],
    ["encontro", 14, dataE(14), "Desdobramento e plano de continuidade", F5, ["Roda da Vida", "Modelo SMART"], null, "pendente", null],
    ["recesso", null, somaDia(dataE(14), 1), "Recesso de fim de ano", null, [], somaDia(dataE(14), 18), "pendente", "Sem encontros — retomada na semana seguinte"],
    ["encontro", 15, dataE(15), "Reflexão e reconhecimento", F6, ["PDM", "Roda da Vida"], null, "pendente", null],
    ["encontro", 16, dataE(16), "Encerramento e celebração", F6, ["Avaliação 360º", "Autoavaliação do mentor"], null, "pendente", null],
    ["evento_encerramento", null, somaDia(dataE(16), 3), "Evento de encerramento do programa", null, [], null, "pendente", null],
  ].map((v, i) => ({
    id: uid(idBase + i),
    cronograma_id: cronId,
    tipo: v[0], numero: v[1], data: v[2], titulo: v[3], fase: v[4],
    instrumentos: v[5], data_fim: v[6], status: v[7], observacao: v[8],
    ordem: i + 1,
  }));
// início/fim derivam dos eventos — a mesma conta do backfill da 0061
const montaCronograma = (id, nome, turma, eventos, e1) => ({
  id,
  nome,
  turma,
  trilha: "dpp",
  inicio_em: eventos.flatMap((e) => (e.data ? [e.data] : [])).sort()[0] ?? null,
  fim_em:
    eventos
      .flatMap((e) => {
        const f = e.data_fim ?? e.data;
        return f ? [f] : [];
      })
      .sort()
      .at(-1) ?? null,
  encontros_esperados: eventos.filter((e) => e.tipo === "encontro").length,
  status: "ativo",
  created_by: P.coord,
  created_at: iso(new Date(`${somaDia(e1, -45)}T10:00:00-03:00`)),
});

const eventosT1 = montaEventosDpp(T1E1, dataT1, CRON1, 0x4f0);
const cronogramaT1 = montaCronograma(
  CRON1, "Calendário oficial · T1", T1_TURMA, eventosT1, T1E1);

const eventosT2 = montaEventosDpp(T2E1, dataT2, CRON2, 0x510);
const cronogramaT2 = montaCronograma(
  CRON2, "Calendário oficial · T2", T2_TURMA, eventosT2, T2E1);

// ---- duplas ----
// 10 DPP ativas em semáforos variados + pausada/concluida/encerrada + trilhas
// + 2 DPP da T2 demo (o 2º cronograma) — "Para acompanhar" sem misturar
// denominadores: a coorte T2 corre contra o calendário dela
const D = {
  d1: uid(0x300), d2: uid(0x301), d3: uid(0x302), d4: uid(0x303), d5: uid(0x304),
  d6: uid(0x305), d7: uid(0x306), d8: uid(0x307), d9: uid(0x308), d10: uid(0x309),
  d11: uid(0x30a), d12: uid(0x30b), d13: uid(0x30c), d14: uid(0x30d),
  trilha1: uid(0x320), trilha2: uid(0x321),
  dT2a: uid(0x150), dT2b: uid(0x151), // T2 demo — …0150 e …0151
};

const duplas = [
  { id: D.d1, mentor_id: P.andre, mentorado_id: M.ana, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d2, mentor_id: P.beatriz, mentorado_id: M.pedroLucas, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d3, mentor_id: P.fernando, mentorado_id: M.mariaFer, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d4, mentor_id: P.juliana, mentorado_id: M.joaoPedro, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d5, mentor_id: P.ricardo, mentorado_id: M.gabriela, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d6, mentor_id: P.camila, mentorado_id: M.rafaela, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d7, mentor_id: P.tiago, mentorado_id: M.lucasG, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d8, mentor_id: P.renata, mentorado_id: M.isabela, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "pausada", iniciada_em: encontroDate(1) },
  // concluída/encerrada em DPP: o fechamento mora na tabela `encerramentos`
  // (duplas_encerramento_esp só deixa esses campos em trilha especialista)
  { id: D.d9, mentor_id: P.gustavo, mentorado_id: M.enzo, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "concluida", iniciada_em: encontroDate(1) },
  { id: D.d10, mentor_id: P.patricia, mentorado_id: M.yasmin, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d11, mentor_id: P.leonardo, mentorado_id: M.kaique, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d12, mentor_id: P.vanessa, mentorado_id: M.manuela, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "encerrada", iniciada_em: encontroDate(1) },
  { id: D.d13, mentor_id: P.andre, mentorado_id: M.larissa, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  { id: D.d14, mentor_id: P.eduardo, mentorado_id: M.beatrizN, supervisor_id: P.sup2, turma: T1_TURMA, cronograma_id: CRON1, trilha: "dpp", status: "ativa", iniciada_em: encontroDate(1) },
  // trilhas especialista
  { id: D.trilha1, mentor_id: P.luisa, mentorado_id: M.larissa, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "especialista", status: "ativa", iniciada_em: encontroDate(3), demanda: "Escolha de carreira + ansiedade de desempenho" },
  { id: D.trilha2, mentor_id: P.sofia, mentorado_id: M.enzo, supervisor_id: P.sup1, turma: T1_TURMA, cronograma_id: CRON1, trilha: "especialista", status: "concluida", iniciada_em: encontroDate(1), encerrada_em: iso(new Date("2026-10-10T19:00:00-03:00")), motivo_encerramento: "Trilha concluída nos 5 encontros.", demanda: "Finanças pessoais e primeiro salário", devolutiva_pdm: "Trilha de finanças fechada: o Enzo saiu do zero pra uma planilha própria e conta aberta." },
  // T2 demo — supervisão do Carlos Nogueira (sup2); a lista da Paula segue
  // intacta. A da Mônica tem o vigente (enc 4) agendado e o 5 já marcado; a
  // da Elisa não tem row do vigente — é o sem_data real do "Para acompanhar"
  { id: D.dT2a, mentor_id: P.monica, mentorado_id: M.davi, supervisor_id: P.sup2, turma: T2_TURMA, cronograma_id: CRON2, trilha: "dpp", status: "ativa", iniciada_em: T2E1 },
  { id: D.dT2b, mentor_id: P.elisa, mentorado_id: M.luna, supervisor_id: P.sup2, turma: T2_TURMA, cronograma_id: CRON2, trilha: "dpp", status: "ativa", iniciada_em: T2E1 },
];

// ---- plano de encontros por dupla: quantos já aconteceram ----
// Evergreen (enc 6 oficial = terça da semana corrente): os enc 1–5 são
// sempre passados; o 6º sai "realizado" quando a terça-19h já passou e
// "agendado" antes disso — o gerador trata a borda. Semáforo: 6=ok,
// 5 sem vigente=atenção/atraso, ≤4=risco (≥2 atrasos em qualquer weekday).
const PLANO_ENCONTROS = {
  [D.d1]: { feitos: 6, hora: "19:00", proximo: true, duracao: 90, avalPendente: 6 },
  [D.d2]: { feitos: 5, hora: "19:00", proximo: false, duracao: 60 },         // atraso/sem data: faltou o 6º e não marcou
  [D.d3]: { feitos: 6, hora: "19:30", proximo: true, duracao: 60, apoio: true }, // apoio aberto → risco
  [D.d4]: { feitos: 6, hora: "18:00", proximo: true, duracao: 60 },
  [D.d5]: { feitos: 6, hora: "19:00", proximo: true, duracao: 90, regular: true }, // avaliação regular + dificuldade → atenção
  [D.d6]: { feitos: 6, hora: "19:00", proximo: true, duracao: 60 },
  [D.d7]: { feitos: 3, hora: "19:00", proximo: false, duracao: 60 },         // ≥2 atrasos → risco
  [D.d8]: { feitos: 3, hora: "19:00", proximo: false, duracao: 60 },         // pausada desde encontro 4
  [D.d9]: { feitos: 5, hora: "19:00", proximo: false, duracao: 60 },         // concluída
  [D.d10]: { feitos: 6, hora: "19:00", proximo: true, duracao: 90 },
  [D.d11]: { feitos: 6, hora: "19:00", proximo: true, duracao: 60, pendente: 6 },  // registro do 6º pendente → atenção
  [D.d12]: { feitos: 3, hora: "19:00", proximo: false, duracao: 60 },        // encerrada
  [D.d13]: { feitos: 6, hora: "19:00", proximo: true, duracao: 90 },         // 2ª dupla do Otávio
  [D.d14]: { feitos: 6, hora: "19:00", proximo: true, duracao: 60 },
  // a sessão agendada ancora em HOJE: a grade visual só desenha a semana
  // corrente (seg–dom) e "próximo dia X" foge dela na maior parte da semana
  [D.trilha1]: { feitos: 3, hora: "19:30", proximo: true, duracao: 45, trilha: true, hoje: true },
  [D.trilha2]: { feitos: 5, hora: "10:00", proximo: false, duracao: 45, trilha: true }, // trilha completa (5 passos)
  // T2 demo — o vigente da semana corrente é sempre o enc 4 (o enc 1 da T2 é
  // a terça de 3 semanas atrás). A dupla da Mônica fez 1–3 e já marcou o 4
  // pro sábado — o mentor agenda quando funciona pra dupla, a data oficial é
  // a terça — e o 5 na terça oficial seguinte. A da Elisa fez 1–2, furou o
  // 3 e não marcou o vigente: é o sem_data real do "Para acompanhar" no
  // backend, não no stub (e o 3 passado sem sessão já dá o atraso dela)
  [D.dT2a]: { feitos: 3, hora: "19:00", duracao: 60, t2: true,
              proximos: [{ num: 4, quando: `${proximoDow(6)}T19:00:00-03:00` }, { num: 5 }] },
  [D.dT2b]: { feitos: 2, hora: "19:00", duracao: 60, t2: true },
};

// conteúdo dos registros — roteiro com variação por índice
const TEMAS = [
  "Boas-vindas, histórias de vida e abertura",
  "Conhecendo o outro: valores e referências",
  "Construindo o PDM juntos",
  "Visão de futuro e metas de curto prazo",
  "Revisão de metas e Roda da Vida",
  "Plano de ação e compromissos",
];
const REFLEXOES = [
  "O encontro fluiu bem — a jovem chegou com dúvidas concretas sobre a rotina de estudos e saiu com um plano simples pra semana.",
  "Conversamos sobre a família e sobre o que ela espera do programa. Bastante abertura, valeu a escuta ativa do guia.",
  "Revisamos as metas do PDM. Uma precisou ser quebrada em passos menores — ela se assustou com o tamanho da meta original.",
  "Sessão mais leve, falamos de hobbies e do que ela faz no tempo livre. Importante pra construir o vínculo.",
  "Tema pesado: dificuldade de concentração nos estudos. Mapeamos gatilhos e combinamos uma técnica de Pomodoro.",
  "Fechamos o ciclo de instrumentos. Ela conseguiu verbalizar a visão de futuro pela primeira vez — momento forte.",
];
const OBS = [
  null,
  "Jovem chegou 10 min atrasada mas engajada.",
  null,
  "Encontro online — conexão caiu uma vez, retomamos pelo WhatsApp.",
  "Pedi material de apoio da coordenação pro próximo encontro.",
  null,
];

function registrosDaDupla(duplaId, mentorId, plano,
                          cal = { iso: encontroISO, date: encontroDate }) {
  const out = { encontros: [], registros: [], avaliacoes: [], encaminhamentos: [] };
  const ehT1 = cal.iso === encontroISO; // só a T1 tem borda de vigente (enc 6)
  for (let i = 1; i <= plano.feitos; i++) {
    const eid = uid((parseInt(duplaId.slice(-4), 16) << 8) + i); // determinístico por dupla
    // enc 6 da T1 = terça desta semana: "realizado" antes das 19h de terça
    // seria um futuro forjado — sai agendado (vigente coberto) até passar
    const enc6Futuro = ehT1 && i === 6 && !T1E6_PASSOU;
    out.encontros.push({
      id: eid, dupla_id: duplaId, numero: i,
      data_hora: cal.iso(i, plano.hora), duracao_min: plano.duracao,
      status: enc6Futuro ? "agendado" : "realizado", origem: null,
      created_by: mentorId,
      realizado_em: enc6Futuro ? null : cal.iso(i, plano.hora),
      ...(enc6Futuro
        ? { link: "https://meet.google.com/demo-" + duplaId.slice(-8) }
        : {}),
    });
    if (enc6Futuro) continue; // agendado não minta link nem gera registro
    // link /avaliar é mintado por trigger no insert realizado — depois do
    // insert eu faço PATCH de status por encontro (respondido/expirado/
    // pendente-vivo pra Ana). O encontro avaliado é i%5!==4, salvo avalPendente.
    const temAval = i % 5 !== 4 && plano.avalPendente !== i;
    if (i !== plano.pendente) {
      const baixa = plano.regular && i === plano.feitos;
      out.registros.push({
        id: uid((parseInt(duplaId.slice(-4), 16) << 8) + 0x40 + i),
        encontro_id: eid, created_by: mentorId,
        tema: TEMAS[i - 1], ferramenta: i === 1 ? "Perguntas Eficazes" : i === 5 ? "Roda da Vida" : "PDM",
        reflexoes: REFLEXOES[(i - 1 + parseInt(duplaId.slice(-2), 16)) % REFLEXOES.length],
        observacoes: OBS[(i + parseInt(duplaId.slice(-2), 16)) % OBS.length],
        atividades: ["Conversa de acompanhamento", i % 2 ? "Atividade prática" : "Orientação individual"],
        avaliacao: baixa ? "regular" : i % 3 === 0 ? "boa" : "excelente",
        dificuldade: baixa ? "organizacao" : i === 4 && plano.feitos < 6 ? "participacao" : "nenhuma",
        dificuldade_detalhe: baixa ? "A rotina dela mudou com o novo curso — ajustamos o horário dos encontros." : null,
        proximo_passo: i === plano.feitos ? "acompanhar_de_perto" : "continuar",
        proximo_passo_detalhe: null,
        precisa_apoio: !!(plano.apoio && i === plano.feitos),
        created_at: cal.iso(i, "21:00"), updated_at: cal.iso(i, "21:00"),
      });
      // avaliação estrela do jovem em ~80% dos encontros
      if (temAval) {
        out.avaliacoes.push({
          id: uid((parseInt(duplaId.slice(-4), 16) << 8) + 0x80 + i),
          dupla_id: duplaId, encontro_id: eid,
          estrelas: baixa ? 3 : i === plano.feitos ? 5 : 4 + (i % 2),
          sentimento: baixa ? "mais_ou_menos" : i % 2 ? "muito_bem" : "bem",
          avancei: "sim", temas: ["vinculo", "clareza"],
          comentario: i === 1 ? "Primeira vez que contei minha história toda pra alguém de fora." : null,
          avaliacao_visivel_mentor: true,
          created_at: cal.iso(i, "22:30"),
        });
      }
      // encaminhamento ocasional
      if (i === 3 || (plano.regular && i === plano.feitos)) {
        out.encaminhamentos.push({
          id: uid((parseInt(duplaId.slice(-4), 16) << 8) + 0xc0 + i),
          dupla_id: duplaId, registro_id: out.registros.at(-1).id,
          descricao: i === 3 ? "Jovem envia a lista de 3 cursos de interesse pro mentor" : "Ajustar a rotina de estudos e revisar no próximo encontro",
          responsavel: "mentorado", prazo: cal.date(i + 1),
          status: plano.regular && i === plano.feitos ? "pendente" : "feito",
          created_at: cal.iso(i, "21:05"),
        });
      }
    }
  }
  // próximo(s) agendado(s): `proximo` = o 7 da T1 (ou feitos+1 de trilha);
  // `proximos` lista numerada — a T2 agenda o vigente (e o seguinte) no
  // calendário dela, e `quando` sobrescreve a data (a dupla agenda quando
  // funciona; o oficial é sempre terça)
  const proximos =
    plano.proximos ?? (plano.proximo ? [plano.trilha ? plano.feitos + 1 : 7] : []);
  for (const p of proximos) {
    const num = typeof p === "number" ? p : p.num;
    out.encontros.push({
      id: uid((parseInt(duplaId.slice(-4), 16) << 8) + 0xe0 + num), dupla_id: duplaId,
      numero: num,
      // WP4: trilhas não seguem o cronograma — o agendado ancora em hoje
      // (a grade visual só desenha a semana corrente); quando hoje é qui
      // cai dentro da janela 19–21 da Luísa, senão fica "fora da grade"
      data_hora: plano.trilha
        ? iso(new Date(`${diaBrt()}T${plano.hora}:00-03:00`))
        : p.quando ? iso(new Date(p.quando)) : cal.iso(num, plano.hora),
      duracao_min: plano.duracao, status: "agendado", origem: null,
      link: "https://meet.google.com/demo-" + duplaId.slice(-8), created_by: mentorId,
    });
  }
  return out;
}

// instrumentos: roda completa pra alguns, metas/visão pra outros
const RODA = (over = {}) => ({
  p_saude: 6, p_intelecto: 7, p_equilibrio: 5, p_independencia: 6,
  pr_carreira: 4, pr_financas: 3, pr_escola: 7, pr_contribuicao: 8,
  r_familia: 8, r_amigos: 7, r_amoroso: 5, r_social: 6,
  q_hobbies: 7, q_atividade: 4, q_realizacao: 6, q_espiritualidade: 5,
  reflexao: "Quero melhorar finanças e atividade física — são as notas mais baixas e dependem só de mim.",
  ...over,
});
const VISAO = {
  filme: "Eu me vejo formada, trabalhando num lugar que eu goste, ajudando minha mãe com as contas de casa.",
  aspectos: "Independência financeira, um trabalho com propósito e continuar perto da minha família.",
  ser_fazer: "Estou sendo alguém que cumpre o que promete — estudo todo dia, mesmo pouco.",
  deixou: "Deixei de procrastinar com celular antes de dormir.",
  valoriza: "A sensação de estar construindo algo meu.",
  declaracao_visao: "Ser a primeira da família a ter uma profissão que eu escolhi por amor, não por falta de opção.",
};
const METAS = {
  declaracao_visao: "Ser a primeira da família a ter uma profissão que eu escolhi por amor.",
  preciso_criar: "Uma rotina de estudos fixa", preciso_aprender: "Inglês básico e biologia",
  preciso_melhorar: "Minha disciplina de sono", preciso_eliminar: "Distração com redes sociais",
  meta_1: "Estudar 2h por dia até o vestibular", porque_1: "É o que falta pra chegar preparada.",
  meta_2: "Ler 1 livro por mês", porque_2: "Melhora meu vocabulário e meu foco.",
  meta_3: "Fazer 30 min de exercício 3x por semana", porque_3: "Corpo são ajuda a mente.",
  meta_4: "Falar com o mentor toda semana", porque_4: "Ele me mantém no trilho.",
  meta_5: "Guardar R$50 por mês", porque_5: "Quero uma reserva pra faculdade.",
  rev_ajudam: "sim", rev_importantes: "sim", rev_claras: "sim", meta_principal: "Meta 1",
};
const PDM = {
  declaracao_visao: "Ser a primeira da família a ter uma profissão que eu escolhi por amor.",
  meta_1: "Estudar 2h por dia até o vestibular", is_1: "Simulados acima de 700", prazo_1: "2026-12-20",
  meta_2: "Ler 1 livro por mês", is_2: "12 livros no ano", prazo_2: "2027-01-15",
  meta_3: "Guardar R$50 por mês", is_3: "R$600 na poupança", prazo_3: "2027-02-28",
  submetas_1: "Seg a sex, 19h-21h; sáb simulado; dom revisão.",
  submetas_2: "Sempre um livro do clube de leitura da escola.",
  submetas_3: "Pix automático no dia 5.",
};

// ---------- execução ----------
await limpar();

console.log("inserindo profiles, mentor_profiles, mentorados…");
await post("profiles", profiles.map((p) => ({ interesses: [], ...p })));
// disponibilidade_ok exige {dias:[seg|ter|…], periodos:[manha|tarde|noite]} —
// converte a grade por-dia ("19:00-21:00") pro formato do banco
const paraDisponibilidade = (grade) => {
  if (!grade) return null;
  const dias = Object.keys(grade).filter((d) => grade[d]?.length);
  const periodos = new Set();
  for (const d of dias)
    for (const janela of grade[d]) {
      const h = parseInt(janela, 10);
      periodos.add(h < 12 ? "manha" : h < 18 ? "tarde" : "noite");
    }
  return { dias, periodos: [...periodos] };
};
await post("mentor_profiles", mentorProfiles.map((m) => ({
  capacidade: 1, capacidade_especialista: 1, ...m,
  disponibilidade: paraDisponibilidade(m.disponibilidade),
})));
await post("mentorados", mentorados.map((m) => ({
  contato_compartilhado: false, ...m, disponibilidade: paraDisponibilidade(m.disponibilidade),
})));

// cronogramas demo (T1 evergreen + T2) antes das duplas — FK cronograma_id
console.log("inserindo os cronogramas demo (T1/T2) e os eventos deles…");
await post("cronogramas", [cronogramaT1, cronogramaT2]);
await post("ciclo_eventos", [...eventosT1, ...eventosT2]);

console.log("inserindo duplas…");
await post("duplas", duplas);

console.log("gerando encontros + registros + avaliações + encaminhamentos…");
const enc = [], reg = [], avl = [], encam = [];
for (const d of duplas) {
  const plano = PLANO_ENCONTROS[d.id];
  if (!plano) continue;
  // duplas da T2 correm contra o calendário dela — mesma função, outra régua
  const calT2 = plano.t2 ? { iso: encontroISOT2, date: dataT2 } : undefined;
  const r = registrosDaDupla(d.id, d.mentor_id, plano, calT2);
  enc.push(...r.encontros); reg.push(...r.registros); avl.push(...r.avaliacoes);
  encam.push(...r.encaminhamentos);
}
await post("encontros", enc);
await post("registros", reg);
await post("avaliacoes_encontro", avl);
await post("encaminhamentos", encam);

// o trigger minta avaliacao_links nos encontros realizado — ajusta o status
// conforme a avaliação existe ou não
const avaliados = avl.map((a) => a.encontro_id);
if (avaliados.length)
  await patch(`avaliacao_links?encontro_id=in.(${avaliados.join(",")})`,
    { status: "respondido", respondido_em: iso(new Date(Date.now() - 12 * 36e5)) });
// Ana (jovem com login): encontro 6 fica pendente e válido — aparece nas
// "Suas avaliações" do /jovem. Só existe link quando o enc 6 saiu
// "realizado" (terça 19h passada); antes disso o patch é no-op e a Ana
// simplesmente não tem avaliação pendente na semana
const encAna6 = uid((0x300 << 8) + 6);
await patch(`avaliacao_links?encontro_id=eq.${encAna6}`,
  { status: "pendente", expira_em: iso(new Date(Date.now() + 14 * DIA)) });
// links mintados sem avaliação nos encontros passados → expirado
await patch(`avaliacao_links?status=eq.pendente&dupla_id=gte.de000000-0000-4000-8000-000000000000&dupla_id=lt.de000000-0000-4000-8001-000000000000&encontro_id=not.eq.${encAna6}`,
  { status: "expirado" });

console.log("instrumentos (links + respostas)…");
const FORM = {
  visao: "5eed0001-0000-4000-8000-000000000004",
  metas: "5eed0001-0000-4000-8000-000000000005",
  pdm: "5eed0001-0000-4000-8000-000000000006",
  roda: "5eed0001-0000-4000-8000-000000000007",
  anamnese: "5eed0001-0000-4000-8000-000000000001",
};
const links = [], resps = [];
let li = 0;
function linkComResposta(duplaId, mentoradoId, formId, respostas, respondidoNumero) {
  const lid = uid(0x700 + li), rid = uid(0x800 + li); li++;
  links.push({
    id: lid, formulario_id: formId, token: `demo-${lid}-t`,
    dest_mentorado_id: mentoradoId, dupla_id: duplaId,
    usado_em: encontroISO(respondidoNumero, "21:00"), created_by: P.coord,
    respondido_por_profile_id: jovemProfile,
  });
  resps.push({ id: rid, link_id: lid, respostas, respondido_em: encontroISO(respondidoNumero, "21:00") });
}
// dupla 1 (Ana × Otávio) — jornada completa
linkComResposta(D.d1, M.ana, FORM.roda, RODA(), 5);
linkComResposta(D.d1, M.ana, FORM.visao, VISAO, 3);
linkComResposta(D.d1, M.ana, FORM.metas, METAS, 4);
linkComResposta(D.d1, M.ana, FORM.pdm, PDM, 4);
linkComResposta(D.d1, M.ana, FORM.anamnese, {
  quem_mora: "Moro com a minha mãe e meu irmão mais novo.",
  territorio: "Vila Esperança, zona leste.",
  estuda: "sim", trabalha: "nao",
  onde_estuda_trabalha: "Escola Estadual Dom Paulo — 3º ano.",
  rotina: "Aula de manhã, tarde estudo e ajudo meu irmão.",
  rede_apoio: ["Família", "Professores", "ONG Futuro Agora"],
  gosta: "Desenhar e jogar vôlei.",
  te_descreveriam: "Quieta no começo, falante depois que pega confiança.",
  expectativas: "Passar em Medicina e ser a primeira médica da família.",
  pref_genero_mentor: "Indiferente",
}, 0);
// parciais em outras duplas
linkComResposta(D.d4, M.joaoPedro, FORM.roda, RODA({ pr_financas: 5, p_saude: 8, r_familia: 9 }), 4);
linkComResposta(D.d4, M.joaoPedro, FORM.metas, METAS, 3);
linkComResposta(D.d6, M.rafaela, FORM.roda, RODA({ p_equilibrio: 7, pr_escola: 5 }), 5);
linkComResposta(D.d10, M.yasmin, FORM.roda, RODA({ pr_carreira: 6, q_realizacao: 8 }), 5);
linkComResposta(D.d13, M.larissa, FORM.roda, RODA({ p_equilibrio: 3, pr_escola: 6 }), 4);
linkComResposta(D.d13, M.larissa, FORM.visao, { ...VISAO, filme: "Me vejo calma na hora da prova, segura da minha escolha.", declaracao_visao: "Escolher minha carreira com clareza e chegar no vestibular sem pavor." }, 3);
// uma roda pendente (link emitido, não respondido) pra mostrar o estado
links.push({
  id: uid(0x7f0), formulario_id: FORM.roda, token: "demo-roda-pendente-00000000000001",
  dest_mentorado_id: M.gabriela, dupla_id: D.d5, expira_em: iso(new Date(Date.now() + 30 * DIA)),
  created_by: P.ricardo,
});
await post("formulario_links", links);
await post("formulario_respostas", resps);

console.log("avisos, mural, supervisões, presenças, interações, notificações…");
await post("comunicados", [
  { id: uid(0x900), titulo: "Prazo dos instrumentos", corpo: "Lembrando que a Roda da Vida deve ser aplicada até o 5º encontro. Quem ainda não emitiu o link, aproveita a semana.", audiencia: "dpp", prioridade: "importante", created_by: P.coord, created_at: iso(new Date("2026-10-10T09:00:00-03:00")) },
  { id: uid(0x901), titulo: "Encontro de formação — gravação disponível", corpo: "A gravação do encontro final de formação já está em Materiais pra quem não conseguiu participar ao vivo.", audiencia: "todos", prioridade: "normal", created_by: P.coord, created_at: iso(new Date("2026-09-05T09:00:00-03:00")) },
  { id: uid(0x902), titulo: "Bem-vindos à plataforma", corpo: "Esta é a casa nova do programa. Qualquer dúvida ou erro, fala com a coordenação no WhatsApp.", audiencia: "todos", prioridade: "normal", created_by: P.coord, created_at: iso(new Date("2026-09-04T09:00:00-03:00")) },
]);

// mural de especialistas: 1 aberta (genérica), 1 aguardando triagem, 2
// aceitas→trilhas (a view solicitacoes_mural projeta esta tabela e junta
// nomes/devolutiva — *_nome e status_efetivo não são colunas reais)
// + 1 sugerida (WP6): a sugestão do mentor nasce fora dos tetos e do mural,
// esperando a confirmação da Ana em /jovem/especialistas. O Otávio aponta
// a Luísa — a área dela é exatamente a demanda — e o texto da demanda é
// compartilhado com o corpo da notificação (mesmo evento, dois destinos)
const SUG_ANA_DEMANDA = "A Ana mira Medicina e a ansiedade de prova derruba o simulado — uma trilha curta de ansiedade de desempenho destrava.";
const SUG_ANA_QUANDO = iso(new Date(Date.now() - DIA)); // ~1 dia atrás
await post("solicitacoes_especialista", [
  { id: uid(0x1000), mentorado_id: M.gabriela, dupla_dpp_id: D.d5, demanda: "Carreiras em tecnologia", motivo: "A Gabriela quer entender qual área de tech combina com ela antes de escolher o curso técnico.", turma: T1_TURMA, status: "aberta", origem: "staff", created_by: P.ricardo, created_at: iso(new Date("2026-10-08T10:00:00-03:00")) },
  { id: uid(0x1001), mentorado_id: M.igor, demanda: "Orientação vocacional", motivo: "O Igor está dividido entre técnico em eletrônica e mecânica — pediu direto pelo mural do jovem.", turma: null, status: "aguardando_coord", origem: "jovem", created_by: jovemProfile, created_at: iso(new Date("2026-10-12T10:00:00-03:00")) },
  { id: uid(0x1002), mentorado_id: M.larissa, dupla_dpp_id: D.d13, demanda: "Ansiedade de desempenho", motivo: "A Larissa trava em prova — o mentor pediu apoio de especialista.", turma: T1_TURMA, status: "aceita", origem: "staff", especialista_id: P.luisa, dupla_id: D.trilha1, created_by: P.andre, created_at: iso(new Date("2026-09-20T10:00:00-03:00")), respondida_em: iso(new Date("2026-09-22T10:00:00-03:00")) },
  { id: uid(0x1003), mentorado_id: M.enzo, dupla_dpp_id: D.d9, demanda: "Finanças pessoais", motivo: "Enzo queria aprender a cuidar do primeiro salário.", turma: T1_TURMA, status: "aceita", origem: "staff", especialista_id: P.sofia, dupla_id: D.trilha2, created_by: P.gustavo, created_at: iso(new Date("2026-09-05T10:00:00-03:00")), respondida_em: iso(new Date("2026-09-08T10:00:00-03:00")) },
  { id: uid(0x1004), mentorado_id: M.ana, dupla_dpp_id: D.d1, demanda: SUG_ANA_DEMANDA, motivo: "Quero controlar a ansiedade pra render nos simulados.", turma: T1_TURMA, status: "sugerida", origem: "mentor", especialista_desejado_id: P.luisa, created_by: P.andre, created_at: SUG_ANA_QUANDO },
]);

// devolutivas (WP6) — o feed datado da trilha Luísa × Larissa: uma de meio
// de percurso e uma recente (datas relativas ao run, evergreen)
await post("devolutivas", [
  { id: uid(0x1400), dupla_id: D.trilha1, autor_id: P.luisa,
    texto: "Meio do caminho: a Larissa já separa prova de julgamento — o gatilho dela é a sala cheia, não a matéria. Próximas sessões ensaiam simulado curto.",
    created_at: iso(new Date(Date.now() - 17 * DIA)) },
  { id: uid(0x1401), dupla_id: D.trilha1, autor_id: P.luisa,
    texto: "Simulado de 20 questões sem travar — ela saiu do blank com respiração e rascunho. Reta final: consolidar o ritual pré-prova.",
    created_at: iso(new Date(Date.now() - 3 * DIA)) },
]);

await post("supervisoes", [
  { id: uid(0xb00), supervisor_id: P.sup1, mentor_id: P.andre, dupla_id: D.d1, data: "2026-09-25", resumo: "Otávio trouxe a dificuldade de a Ana não falar da família. Trabalhamos escuta ativa e perguntas abertas — saiu com plano.", created_by: P.sup1, created_at: iso(new Date("2026-09-25T20:00:00-03:00")) },
  { id: uid(0xb01), supervisor_id: P.sup1, mentor_id: P.fernando, dupla_id: D.d3, data: "2026-10-09", resumo: "Conversa sobre o pedido de apoio da Maria Fernanda. Orientei o Sérgio a escutar sem resolver — ele segue com acompanhamento próximo.", created_by: P.sup1, created_at: iso(new Date("2026-10-09T20:00:00-03:00")) },
  { id: uid(0xb02), supervisor_id: P.sup2, mentor_id: P.tiago, dupla_id: D.d7, data: "2026-10-07", resumo: "Tiago está com a agenda apertada — combinado horário fixo de sábado de manhã e compromisso de resposta em 24h.", created_by: P.sup2, created_at: iso(new Date("2026-10-07T20:00:00-03:00")) },
  // T2 demo — supervisão corrente da dupla nova (data relativa ao run)
  { id: uid(0xb10), supervisor_id: P.sup2, mentor_id: P.monica, dupla_id: D.dT2a, data: diaBrt(), resumo: "Primeira supervisão da Mônica com a turma nova — a T2 engatou: o Davi chegou com a meta do curso técnico meio formada. Combinado: ela segura o ritmo semanal e eu reviso os registros dela a cada quinzena.", created_by: P.sup2, created_at: iso(new Date()) },
]);

// presenças nos dois encontros de formação (03 e 04/set)
const eventoForm1 = "f10e9ec6-8ee0-49a4-b7a4-516b2526fd2b";
const eventoForm2 = "709a7c38-14b3-4cc1-ad36-b3a21f846cad";
const presencas = [];
let pi = 0;
const mentorIds = [P.andre, P.beatriz, P.fernando, P.juliana, P.ricardo, P.camila, P.tiago, P.gustavo, P.patricia, P.leonardo, P.vanessa, P.eduardo, P.luisa, P.marcos, P.sofia, P.pedroH];
for (const pid of mentorIds) {
  presencas.push({ id: uid(0xa00 + pi++), ciclo_evento_id: eventoForm1, profile_id: pid, presente: true, marcado_por: P.coord, marcado_em: iso(new Date("2026-09-03T21:00:00-03:00")) });
  // renata e daniel faltaram o 2º dia (formacao_ok false bate com isso)
  presencas.push({ id: uid(0xa00 + pi++), ciclo_evento_id: eventoForm2, profile_id: pid, presente: pid !== P.renata && pid !== P.daniel, marcado_por: P.coord, marcado_em: iso(new Date("2026-09-04T21:00:00-03:00")) });
}
// T2 demo: a Mônica e a Elisa formaram no onboarding da turma nova —
// presença registrada nos dois encontros de formação da T2 (sync_formacao_ok
// mantém o formacao_ok delas, que já nasce true)
for (const evf of eventosT2.filter((e) => e.tipo === "formacao"))
  for (const pid of [P.monica, P.elisa])
    presencas.push({ id: uid(0xa00 + pi++), ciclo_evento_id: evf.id, profile_id: pid, presente: true, marcado_por: P.coord, marcado_em: iso(new Date(`${evf.data}T21:00:00-03:00`)) });
await post("presencas", presencas);

await post("interacoes", [
  // evergreen: datas relativas ao run — fixas de out/2026 envelheceriam e
  // o cap de 48h do "Lembrar" perderia o caso bloqueado em staging
  { id: uid(0xc00), dupla_id: D.d7, autor_id: P.coord, canal: "whatsapp", tipo: "nudge", nota: "Tiago, faltam 2 encontros do ciclo — consegue encaixar o Lucas no sábado?", created_at: iso(new Date(Date.now() - 4 * DIA)) },
  { id: uid(0xc01), dupla_id: D.d7, autor_id: P.coord, canal: "whatsapp", tipo: "contato", nota: "Confirmei com o Lucas que sábado de manhã funciona pra ele.", created_at: iso(new Date(Date.now() - 3 * DIA - 14 * 36e5)) },
  { id: uid(0xc02), dupla_id: D.d2, autor_id: P.sup1, canal: "in_app", tipo: "nudge", nota: "lembrete → mentor", created_at: iso(new Date(Date.now() - 26 * 36e5)) },
  { id: uid(0xc03), dupla_id: D.d3, autor_id: P.coord, canal: "outro", tipo: "apoio", nota: "Pedido de apoio da Maria Fernanda recebido — supervisão já acionada, retorno ao mentor em 48h.", created_at: iso(new Date(Date.now() - DIA)) },
  // T2 demo — o nudge do sem_data da Elisa, evergreen (>48h → lembrete livre)
  { id: uid(0xc10), dupla_id: D.dT2b, autor_id: P.coord, canal: "whatsapp", tipo: "nudge", nota: "Elisa, o encontro 4 da T2 tá sem data — bora combinar com a Luna?", created_at: iso(new Date(Date.now() - 3 * DIA)) },
]);

await post("notificacoes", [
  { id: uid(0xf00), profile_id: P.coord, tipo: "apoio_jovem", titulo: "Pedido de apoio — Maria Fernanda", corpo: "A avaliação do encontro 6 marcou \"Preciso de ajuda\".", href: `/duplas/${D.d3}`, created_by: P.coord2, created_at: iso(new Date("2026-10-14T08:00:00-03:00")) },
  { id: uid(0xf01), profile_id: P.coord, tipo: "solicitacao_triagem", titulo: "Nova solicitação aguardando triagem", corpo: "Igor Batista pediu orientação vocacional (sem dupla DPP).", href: "/especialistas", created_at: iso(new Date("2026-10-12T10:05:00-03:00")) },
  { id: uid(0xf02), profile_id: P.sup1, tipo: "comunicado", titulo: "Dupla em risco — Tiago × Lucas", corpo: "2 encontros atrasados no ciclo.", href: `/duplas/${D.d7}`, created_at: iso(new Date("2026-10-14T07:00:00-03:00")) },
  { id: uid(0xf03), profile_id: P.andre, tipo: "supervisao_registrada", titulo: "Sessão de supervisão registrada", corpo: "Paula registrou a supervisão de 25/set — confira o resumo na sua página.", href: "/perfil", lida_em: iso(new Date("2026-09-26T08:00:00-03:00")), created_at: iso(new Date("2026-09-25T20:05:00-03:00")) },
  // WP6 — sol_notificar da sugerir_especialista_mentor / postar_devolutiva:
  // a Ana recebe a sugestão do Otávio (mesmo carimbo da row 'sugerida') e a
  // Larissa é avisada da devolutiva mais recente da trilha dela
  { id: uid(0xf10), profile_id: jovemProfile, tipo: "sugestao_especialista", titulo: "Seu mentor sugeriu um especialista", corpo: "Ele registrou um tema pra você — confirme ou ajuste na página de especialistas.", href: "/jovem/especialistas", created_at: SUG_ANA_QUANDO },
  { id: uid(0xf11), profile_id: larissaProfile, tipo: "devolutiva_especialista", titulo: "Nova devolutiva da trilha", corpo: "Luísa Camargo registrou uma devolutiva pra você.", href: "/jovem/especialistas", created_at: iso(new Date(Date.now() - 3 * DIA)) },
]);

// especialista_grade: agendas dos especialistas pra projeção de slots
await post("especialista_grade", [
  { id: uid(0x1100), profile_id: P.luisa, dia_semana: 2, hora_inicio: "19:00", hora_fim: "21:00" },
  { id: uid(0x1101), profile_id: P.luisa, dia_semana: 4, hora_inicio: "19:00", hora_fim: "21:00" },
  { id: uid(0x1102), profile_id: P.marcos, dia_semana: 3, hora_inicio: "18:00", hora_fim: "20:00" },
  { id: uid(0x1103), profile_id: P.marcos, dia_semana: 6, hora_inicio: "10:00", hora_fim: "12:00" },
  { id: uid(0x1104), profile_id: P.sofia, dia_semana: 6, hora_inicio: "09:00", hora_fim: "11:00" },
  { id: uid(0x1105), profile_id: P.pedroH, dia_semana: 1, hora_inicio: "18:00", hora_fim: "20:00" },
]);

// especialista_excecoes (WP4): a grade visual da Luísa precisa de exceções
// datadas vivas — um bloqueio na próxima terça cobrindo a janela dela
// (19:00–21:00) e um horário extra no próximo domingo (fora da grade),
// MAIS um par ancorado em hoje: a grade só desenha a semana corrente
// (seg–dom) e "próximo dia X" foge dela na maior parte dos dias. O bloqueio
// de hoje rasga a janela quando hoje é ter/qui; o extra de 7h–9h clipa no
// eixo 8h. Datas relativas ao run — exceção no passado o select filtra
// (data >= hoje). O cleanup é o porFK `profile_id` do range de*, já coberto.
await post("especialista_excecoes", [
  { id: uid(0x1110), profile_id: P.luisa, data: proximoDow(2), hora_inicio: "19:00", hora_fim: "21:00", tipo: "bloqueio" },
  { id: uid(0x1111), profile_id: P.luisa, data: proximoDow(0), hora_inicio: "10:00", hora_fim: "12:00", tipo: "extra" },
  { id: uid(0x1112), profile_id: P.luisa, data: diaBrt(), hora_inicio: "07:00", hora_fim: "09:00", tipo: "extra" },
  { id: uid(0x1113), profile_id: P.luisa, data: diaBrt(), hora_inicio: "12:00", hora_fim: "14:00", tipo: "bloqueio" },
]);

// assinaturas: termo do voluntário pra maioria dos mentores, mentorando e
// responsável pra jovens (esp. menores)
const TPL_VOL = "1725587d-ac54-4bf2-8341-aee025a5208f";
const TPL_RESP = "77218b10-948c-449b-8362-70c9053b6989";
const TPL_MENT = "bd803b04-a480-47ac-9f64-a186a46881f8";
const assinaturas = [];
let ai = 0;
const assinado = (tpl, profileId, mentoradoId, quem, quando) => ({
  id: uid(0xe00 + ai), template_id: tpl, profile_id: profileId ?? null,
  mentorado_id: mentoradoId ?? null, status: "assinado",
  token: uid(0xe50 + ai++), token_expira_em: quando,
  dados_snapshot: { nome: quem, documento: "123.456.789-00" },
  assinatura_texto: quem, assinado_em: quando, ip: "177.32.100.42",
  user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15",
  hash_documento: createHash("sha256").update(`${quem}|${quando}`).digest("hex"),
  created_by: P.coord, created_at: quando,
});
for (const pid of [P.andre, P.beatriz, P.fernando, P.juliana, P.ricardo, P.camila, P.tiago, P.gustavo, P.patricia, P.leonardo, P.eduardo, P.luisa, P.marcos, P.sofia, P.pedroH]) {
  const nome = profiles.find((p) => p.id === pid)?.nome ?? "Mentor";
  assinaturas.push(assinado(TPL_VOL, pid, null, nome, iso(new Date("2026-09-03T20:30:00-03:00"))));
}
for (const [mid, nome, quando] of [
  [M.ana, "Ana Beatriz Souza", "2026-09-04T19:30:00-03:00"], [M.mariaFer, "Maria Fernanda Costa", "2026-09-04T19:32:00-03:00"],
  [M.joaoPedro, "João Pedro Santos", "2026-09-04T19:35:00-03:00"], [M.rafaela, "Rafaela Mendes", "2026-09-04T19:40:00-03:00"],
  [M.yasmin, "Yasmin Barbosa", "2026-09-04T19:42:00-03:00"], [M.kaique, "Kaique dos Santos", "2026-09-04T19:45:00-03:00"],
]) {
  assinaturas.push(assinado(TPL_MENT, null, mid, nome, iso(new Date(quando))));
}
for (const [mid, resp] of [[M.pedroLucas, "Márcia Silva"], [M.gabriela, "Sônia Oliveira"], [M.enzo, "Rogério Carvalho"], [M.larissa, "Denise Campos"]]) {
  assinaturas.push(assinado(TPL_RESP, null, mid, resp, iso(new Date("2026-09-05T10:00:00-03:00"))));
}
// T2 demo — termos do onboarding da turma nova (datas relativas ao run)
assinaturas.push(assinado(TPL_VOL, P.elisa, null, "Elisa Prado", iso(new Date(`${somaDia(T2E1, -5)}T20:40:00-03:00`))));
assinaturas.push(assinado(TPL_MENT, null, M.davi, "Davi Santos", iso(new Date(`${somaDia(T2E1, -4)}T19:30:00-03:00`))));
assinaturas.push(assinado(TPL_MENT, null, M.luna, "Luna Ferreira", iso(new Date(`${somaDia(T2E1, -4)}T19:32:00-03:00`))));
assinaturas.push(assinado(TPL_RESP, null, M.davi, "Sandra Santos", iso(new Date(`${somaDia(T2E1, -4)}T19:35:00-03:00`))));
// um termo pendente (Natan ainda não assinou)
assinaturas.push({
  id: uid(0xe00 + ai++), template_id: TPL_VOL, profile_id: P.daniel, status: "pendente",
  dados_snapshot: { nome: "Natan Peixoto" }, token: uid(0xe80),
  token_expira_em: iso(new Date(Date.now() + 15 * DIA)), created_by: P.coord,
  created_at: iso(new Date("2026-10-05T14:30:00-03:00")),
});
await post("assinaturas", assinaturas);

// notas internas
await post("pessoa_notas", [
  { id: uid(0x1200), mentorado_id: M.larissa, texto: "Mãe muito participativa — avisar ela quando a trilha terminar.", created_by: P.coord, created_at: iso(new Date("2026-09-22T11:00:00-03:00")) },
  { id: uid(0x1201), profile_id: P.tiago, texto: "Agenda apertada por causa do restaurante — preferir sábado de manhã.", created_by: P.sup2, created_at: iso(new Date("2026-10-07T20:10:00-03:00")) },
]);

// encerramentos das duplas fechadas (checklist validado por encerramento_checklist_ok)
try {
  await post("encerramentos", [
    { id: uid(0x1300), dupla_id: D.d9, tipo: "concluida",
      checklist: { feedback_final: true, feedback_mutuo: true, revisao_pdm: true, avaliacao_360_enviada: true, autoavaliacao: true },
      autoavaliacao_mentor: "Cresci como ouvinte. O Enzo me ensinou que consistência pequena vence plano grande.",
      disponivel_proximo_ciclo: true,
      resumo_jornada: "6 encontros realizados, 3 metas fechadas, trilha de finanças concluída com a Sofia.",
      decidido_por: P.coord, created_at: iso(new Date("2026-10-10T20:10:00-03:00")) },
    { id: uid(0x1301), dupla_id: D.d12, tipo: "encerrada",
      checklist: { feedback_final: false, feedback_mutuo: false, revisao_pdm: false, avaliacao_360_enviada: true, autoavaliacao: false },
      resumo_jornada: "3 encontros realizados. A família da Manuela se mudou pra Santos — encerramento antecipado sem conflito.",
      decidido_por: P.coord, created_at: iso(new Date("2026-09-30T20:10:00-03:00")) },
  ]);
} catch (e) { console.log("  encerramentos skip:", e.message.slice(0, 100)); }

// ---------- contas de login ----------
console.log("criando logins demo…");
await garantirAuthUser("coord@realiza.test", P.coord);
await garantirAuthUser("supervisora@realiza.test", P.sup1);
await garantirAuthUser("mentor@realiza.test", P.andre);
await garantirAuthUser("especialista@realiza.test", P.luisa);
await garantirAuthUser("jovem@realiza.test", jovemProfile);

console.log(`
Pronto. Login no preview com senha "${SENHA}":
  coord@realiza.test         → coordenação (Marina)
  supervisora@realiza.test   → supervisão (Paula — 6 duplas)
  mentor@realiza.test        → mentor DPP (Otávio — 2 duplas, capacidade 3)
  especialista@realiza.test  → especialista (Luísa — trilha ativa)
  jovem@realiza.test         → mentorado (Ana — dupla com Otávio)`);
