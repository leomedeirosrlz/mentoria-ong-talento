#!/usr/bin/env node
// auditoria-identidade-mentorado — REALIZA-16
//
// Prova executável do checklist "respostas forms, instrumentos, anexos,
// assinaturas, intake": conta, por tabela da matriz de âncora
// (src/lib/identidade-ancora.ts — fonte única; este script espelha a mesma
// matriz em consultas REST), quantas linhas NÃO resolvem pra mentorados.id.
//
// Órfão, por tabela:
//   · formulario_respostas — link MANUAL sem as três âncoras
//     (dest_profile_id, dest_mentorado_id, dupla_id) e sem
//     respondido_por_profile_id que resolva pra mentorados.profile_id.
//     Respostas de link multi_uso/origem='intake' ficam FORA do denominador
//     (revisão dba §4-5): anônimas por desenho, reconciliam por
//     promovido_profile_id — reportadas à parte, nunca como órfãos.
//   · formulario_anexos — anexo em link manual órfão (mesma régua).
//   · assinaturas — template com signatario='mentorado' sem mentorado_id
//     (XOR + trigger 0058 já impedem; a contagem prova).
//   · avaliacoes_encontro / terceiros_contatos — dupla_id null (not null no
//     schema; a auditoria confirma).
//   · registro_anexos — cadeia registros→encontros→duplas sem mentorado_id.
//   · mentorados — só informativo (identidade ≠ conta: profile_id null é ok).
//
// Links manuais órfãos SEM resposta não falham (ainda não há dado solto) —
// saem como aviso com o caminho de saneamento: "Vincular a um jovem" na
// ficha do formulário ou exclusão do link.
//
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm audit:identidade
// exit 0 limpo · 1 com órfãos · 2 infra (env/rede/consulta malformada)

const URL_ =
  process.env.E2E_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error(
    "auditoria: falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ou E2E_*)"
  );
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const base = `${URL_}/rest/v1`;

async function api(path) {
  const res = await fetch(`${base}/${path}`, { headers: H });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`GET ${path.split("?")[0]} → ${res.status} ${corpo.slice(0, 200)}`);
  }
  return res.json();
}

/** count=exact via HEAD — lê o total de content-range sem baixar linhas. */
async function contar(path) {
  const res = await fetch(`${base}/${path}`, {
    method: "HEAD",
    headers: { ...H, Prefer: "count=exact" },
  });
  if (!res.ok)
    throw new Error(`HEAD ${path.split("?")[0]} → ${res.status}`);
  const range = res.headers.get("content-range") ?? "";
  const total = range.match(/\/(\d+|\*)$/)?.[1];
  if (total === "*" || total == null) return 0;
  return Number(total);
}

const relatorio = [];
const orfaosPorTabela = new Map();
let avisos = 0;

function linha(tabela, orfaos, detalhe, ids = []) {
  const ok = orfaos === 0;
  relatorio.push(
    `${ok ? "✓" : "✗"} ${tabela} — ${orfaos} órfão(s)${detalhe ? ` (${detalhe})` : ""}`
  );
  if (!ok) orfaosPorTabela.set(tabela, ids);
}
function aviso(txt) {
  avisos++;
  relatorio.push(`  ⚠ ${txt}`);
}

// ---------- formulario_links / respostas / anexos ----------
// Todos os links sem as três âncoras — daqui separam campanha (intake) de
// manual legado, e dentro do manual quem já tem resposta (dado solto) de
// quem ainda não tem (aviso).
const semAncora = await api(
  "formulario_links?select=id,multi_uso,origem,respondido_por_profile_id,usado_em," +
    "respostas:formulario_respostas(id,promovido_profile_id)" +
    "&dest_profile_id=is.null&dest_mentorado_id=is.null&dupla_id=is.null"
);

const linksIntake = semAncora.filter((l) => l.multi_uso || l.origem === "intake");
const linksManuais = semAncora.filter(
  (l) => !l.multi_uso && l.origem !== "intake"
);

// um submit autenticado num link genérico manual carimba
// respondido_por_profile_id — se esse profile já é a conta de um mentorado,
// a resposta resolve por ele (identidade ≠ âncora declarada, mas resolve)
const respondidoPor = [
  ...new Set(
    linksManuais.map((l) => l.respondido_por_profile_id).filter(Boolean)
  ),
];
const mentoradoPorProfile = new Map();
if (respondidoPor.length) {
  const rows = await api(
    `mentorados?select=id,profile_id&profile_id=in.(${respondidoPor.join(",")})`
  );
  for (const m of rows) mentoradoPorProfile.set(m.profile_id, m.id);
}

const linksOrfaos = []; // manuais com dado solto de verdade
const linksOrfaosPendentes = [];
let respostasOrfas = [];
for (const l of linksManuais) {
  const respostas = l.respostas ?? [];
  if (mentoradoPorProfile.has(l.respondido_por_profile_id)) continue;
  if (!respostas.length) {
    linksOrfaosPendentes.push(l.id);
    continue;
  }
  linksOrfaos.push(l.id);
  respostasOrfas.push(...respostas.map((r) => r.id));
}
if (linksOrfaosPendentes.length)
  aviso(
    `${linksOrfaosPendentes.length} link(s) manual(is) órfão(s) ainda sem resposta ` +
      `(${linksOrfaosPendentes.slice(0, 10).join(", ")}${linksOrfaosPendentes.length > 10 ? " …" : ""})` +
      " — vincular a um jovem ou excluir na ficha do formulário antes do validate"
  );
linha(
  "formulario_respostas",
  respostasOrfas.length,
  "link manual sem âncora e sem autoria que resolva a mentorado",
  respostasOrfas.slice(0, 20)
);

// anexos órfãos = anexos dos links órfãos já encontrados (o upload pertence
// à resposta do link — a mesma âncora cobre os dois)
let anexosOrfaos = [];
if (linksOrfaos.length) {
  const rows = await api(
    `formulario_anexos?select=id&link_id=in.(${linksOrfaos.join(",")})`
  );
  anexosOrfaos = rows.map((r) => r.id);
}
linha(
  "formulario_anexos",
  anexosOrfaos.length,
  "metadados de upload em link manual órfão",
  anexosOrfaos.slice(0, 20)
);

// ---------- intake: informativo, nunca órfão ----------
let inscricoes = 0;
let promovidas = 0;
for (const l of linksIntake) {
  for (const r of l.respostas ?? []) {
    inscricoes++;
    if (r.promovido_profile_id) promovidas++;
  }
}
relatorio.push(
  `  ℹ intake (fora do denominador): ${inscricoes} resposta(s) em ${linksIntake.length} link(s) de campanha — ${promovidas} promovida(s) a cadastro, ${inscricoes - promovidas} aguardando revisão`
);

// ---------- demais tabelas da matriz: contagens diretas ----------
linha(
  "assinaturas",
  await contar(
    "assinaturas?select=id,documento_templates!inner(signatario)" +
      "&mentorado_id=is.null&documento_templates.signatario=eq.mentorado"
  ),
  "termo do jovem sem mentorado_id"
);
linha(
  "avaliacoes_encontro",
  await contar("avaliacoes_encontro?select=id&dupla_id=is.null"),
  "micro-avaliação sem dupla"
);
linha(
  "terceiros_contatos",
  await contar("terceiros_contatos?select=id&dupla_id=is.null"),
  "convite de terceiro sem dupla"
);
linha(
  "registro_anexos",
  await contar(
    "registro_anexos?select=id,registros!inner(encontros!inner(duplas!inner(mentorado_id)))" +
      "&registros.encontros.duplas.mentorado_id=is.null"
  ),
  "evidência sem cadeia registro→encontro→dupla→mentorado"
);

// ---------- mentorados: contexto do relatório ----------
const totalMentorados = await contar("mentorados?select=id");
const semConta = await contar("mentorados?select=id&profile_id=is.null");
relatorio.push(
  `  ℹ mentorados: ${totalMentorados} no total, ${semConta} sem conta (profile_id null — identidade ≠ login, por desenho)`
);

// ---------- relatório ----------
console.log("auditoria-identidade-mentorado (REALIZA-16)\n");
console.log(relatorio.join("\n"));

const totalOrfaos = [...orfaosPorTabela.values()].flat().length;
if (totalOrfaos > 0) {
  console.error("\nÓrfãos encontrados:");
  for (const [tabela, ids] of orfaosPorTabela) {
    console.error(`  ${tabela}: ${ids.join(", ")}${ids.length >= 20 ? " …" : ""}`);
  }
  console.error(
    "\nSaneamento: 'Vincular a um jovem' na ficha do formulário (respostas e " +
      "links) ou exclusão do link pendente. Depois de zerar, validar o check: " +
      "alter table public.formulario_links validate constraint formulario_links_tem_ancora;"
  );
  process.exit(1);
}

console.log(
  `\nórfãos=0 (${avisos} aviso(s)).` +
    (avisos
      ? ""
      : " Histórico limpo — seguro rodar: alter table public.formulario_links validate constraint formulario_links_tem_ancora;")
);
