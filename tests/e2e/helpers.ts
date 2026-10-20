import { test as base, expect, type Page } from "@playwright/test";

// --- test fixture: bypass do Vercel escopado à origem sob teste ---
// extraHTTPHeaders mandaria o token em TODA request — inclusive chamadas
// browser→supabase do login, vazando o bypass pra edge logs. A route só
// injeta o header quando a origem bate a do baseURL.
export const test = base.extend({
  // (provide = `use` do playwright renomeado — eslint lê `use(` como hook React)
  page: async ({ page }, provide) => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
    if (bypass) {
      const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000")
        .origin;
      await page.route(`${origin}/**`, (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass": bypass,
          },
        })
      );
    }
    await provide(page);
  },
});
export { expect };

// --- helpers compartilhados ---

/** GET na origem do app fora do browser (api/documento e afins). O bypass do
 *  Vercel entra via page.route — o APIRequestContext NÃO passa por ele e no
 *  preview recebe a página de SSO (200 text/html) em vez da rota. O header
 *  explícito cobre o gap; sem bypass (local/prod) segue limpo. */
export function apiGetApp(page: Page, url: string) {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
  return page.request.get(url, {
    headers: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  });
}

/** Wizard de primeiro acesso: "Pular tudo e começar" só renderiza em passos
 *  com formulário (step>=2) — o(s) primeiro(s) são só "Continuar".
 *  Clique pré-hidratação é no-op silencioso (RSC demora a ligar handlers em
 *  dev/preview frio), então cada clique confirma o avanço no progressbar. */
export async function pularOnboarding(page: Page) {
  const pular = page.getByRole("button", { name: /Pular tudo e começar/ });
  const progress = page.getByRole("progressbar");
  for (let i = 0; i < 12; i++) {
    if (await pular.isVisible().catch(() => false)) break;
    if (!(await progress.isVisible().catch(() => false))) return; // wizard concluiu sozinho
    const label = await progress.getAttribute("aria-label");
    const passoAtual = Number(label?.match(/Passo (\d+)/)?.[1] ?? 0);
    const primario = page.getByRole("button", { name: /^(Continuar|Começar)$/ });
    if (!(await primario.isVisible().catch(() => false))) break;
    await primario.click();
    // se o clique caiu pré-hidratação o passo não avança — o loop clica de
    // novo; avanço real = aria-label do progressbar muda pra Passo N+1
    if (passoAtual > 0) {
      await page
        .getByRole("progressbar", {
          name: new RegExp(`Passo ${passoAtual + 1} `),
        })
        .waitFor({ state: "attached", timeout: 1500 })
        .catch(() => {});
    }
  }
  await pular.click();
}

/** Sessão demo direta por cookie — o que importa pros specs de feature é a
 *  sessão, não o clique. O fluxo de entrada pela UI é testado à parte
 *  (smoke.spec "seleção de papel → onboarding"). `context().addCookies`
 *  precisa da url base da page já carregada — goto("/") antes. */
export async function entrarNaDemo(
  page: Page,
  papel:
    | "coordenacao"
    | "supervisor"
    | "mentor_dpp"
    | "mentor_especialista"
    | "mentorado"
) {
  await page.goto("/demo"); // estabelece a origem pros cookies
  await page.context().addCookies([
    { name: "demo_role", value: papel, url: page.url() },
    {
      name: `demo_onboarded_${papel}`,
      value: "1",
      url: page.url(),
    },
  ]);
}

// --- helpers compartilhados dos specs "app" (backend real) ---

/** Login real por senha (o modo existe só pra teste — magic link não é
 *  automatizável sem ler e-mail). Depois do submit o app decide o destino:
 *  fixture vem com `senha_em` em user_metadata → cai direto no `next`. */
export async function loginComSenha(
  page: Page,
  email: string,
  senha: string
) {
  await page.goto("/login");
  // o input radio é sr-only — clicar nele falha (span do pill intercepta).
  // O label pai é clicável e ativa o input nativamente.
  await page
    .locator("label", { has: page.locator('input[name="modo-login"][value="senha"]') })
    .click();
  // #email, não getByLabel — a página tem mais de um controle com label
  // "E-mail" (strict mode violation)
  await page.locator("#email").fill(email);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    // login + redirect do middleware em preview frio passa dos 15s às vezes
    timeout: 30_000,
  });
}

/** Troca de papel dentro do mesmo teste: a sessão mora em cookie — limpa e
 *  loga de novo (sem clearCookies o /login desvia pra home da sessão viva). */
export async function relogar(page: Page, email: string, senha: string) {
  await page.context().clearCookies();
  await loginComSenha(page, email, senha);
}

/** Clique + confirmação: se o primeiro clique caiu pré-hidratação (RSC
 *  demora a ligar handlers em dev/preview frio), o laço repete o gesto até
 *  o estado confirmar — o mesmo padrão do pularOnboarding acima. `agir` é
 *  seguro de repetir (o botão desabilita enquanto a action roda e some
 *  depois do sucesso; um locator morto é engolido). */
export async function agirComConfirma(
  agir: () => Promise<void>,
  confirmou: () => Promise<boolean>,
  timeoutMs = 20_000
) {
  const t0 = Date.now();
  for (;;) {
    await agir().catch(() => {});
    for (let i = 0; i < 10; i++) {
      if (await confirmou()) return;
      if (Date.now() - t0 > timeoutMs) {
        throw new Error("ação não confirmou no tempo — estado não mudou");
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

const TZ = "America/Sao_Paulo"; // fuso do app e das RPCs de slot

/** "terça 14/10 às 19:30" (o texto do option/chip da agenda) → ISO do slot.
 *  O ano não viaja no rótulo — o slot é sempre futuro, então a data montada
 *  no ano corrente serve; se já passou (cruzar dezembro→janeiro), +1 ano. */
export function isoDoRotulo(rotulo: string): string {
  const m = rotulo.match(/(\d{2})\/(\d{2}) às (\d{2}):(\d{2})/);
  if (!m) throw new Error(`rótulo de slot inesperado: ${rotulo}`);
  const [, dd, mm, hh, mi] = m;
  const ano = Number(
    new Date().toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" })
  );
  let iso = `${ano}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  if (new Date(iso).getTime() <= Date.now()) {
    iso = `${ano + 1}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  }
  return iso;
}

// Hard-stop: specs "app" escrevem — E2E_* apontando pra prod é config
// errada, não ambiente válido. appEnvOk recusa e o spec pula; o cleanup
// confere de novo (belt & suspenders: service role nunca encosta em prod).
const PROD_REF = "yhjzmxleotahijinjepl";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";

/** Envs do backend real (staging ou supabase local do CI). Sem credenciais
 *  o spec inteiro pula, não falha — o CI de preview pode existir sem staging. */
export function appEnvOk() {
  return !!(
    process.env.E2E_MENTOR_EMAIL &&
    process.env.E2E_MENTOR_PASSWORD &&
    supabaseUrl &&
    !supabaseUrl.includes(PROD_REF) &&
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  );
}

/** DELETE via service role — limpeza do que o spec criou no backend de teste.
 *  `filtro` é a query do PostgREST (ex.: "dupla_id=eq.X&numero=eq.1"). */
export async function limparViaServiceRole(
  tabela: string,
  filtro: string
): Promise<void> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — cleanup abortado");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`cleanup ${tabela} falhou: ${res.status}`);
}

/** DELETE de encontros de uma dupla com os filhos da 0071 antes do pai —
 *  encontro 'realizado' minta avaliacao_links (e pode ter avaliacoes_encontro),
 *  ambos com FK NO ACTION: apagar o encontro direto dá 409. */
export async function limparEncontrosDaDupla(duplaId: string): Promise<void> {
  const encs = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&dupla_id=eq.${duplaId}`
  );
  if (encs.length === 0) return;
  const lista = encs.map((e) => e.id).join(",");
  // 0084: chamados apontam pra registro/avaliação com SET NULL — saem
  // antes dos filhos pra não sobrar chamado órfão no staging
  const regs = await buscarViaServiceRole<{ id: string }[]>(
    "registros",
    `select=id&encontro_id=in.(${lista})`
  );
  if (regs.length) {
    await limparViaServiceRole(
      "chamados",
      `registro_id=in.(${regs.map((r) => r.id).join(",")})`
    );
  }
  const avals = await buscarViaServiceRole<{ id: string }[]>(
    "avaliacoes_encontro",
    `select=id&encontro_id=in.(${lista})`
  );
  if (avals.length) {
    await limparViaServiceRole(
      "chamados",
      `avaliacao_id=in.(${avals.map((a) => a.id).join(",")})`
    );
  }
  await limparViaServiceRole(
    "avaliacoes_encontro",
    `encontro_id=in.(${lista})`
  );
  await limparViaServiceRole(
    "avaliacao_links",
    `encontro_id=in.(${lista})`
  );
  await limparViaServiceRole("encontros", `id=in.(${lista})`);
}

/** GET via service role — leitura auxiliar pra cleanup/verificação que a UI
 *  não expõe diretamente (ex.: id da row criada, turma da dupla fixture).
 *  Mesmo hard-stop do delete: spec app nunca fala com prod. */
export async function buscarViaServiceRole<T = Record<string, unknown>[]>(
  tabela: string,
  filtro: string
): Promise<T> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — leitura abortada");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`read ${tabela} falhou: ${res.status}`);
  return (await res.json()) as T;
}

/** POST via service role — cria estado que o spec precisa existir (ex.: um
 *  encontro já 'realizado' pra exercitar a avaliação do jovem — o trigger
 *  minta o avaliacao_links no insert). Devolve a row criada. Mesmo
 *  hard-stop: spec app nunca fala com prod. */
export async function inserirViaServiceRole(
  tabela: string,
  corpo: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — insert abortado");
  const url = `${supabaseUrl}/rest/v1/${tabela}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(corpo),
  });
  if (!res.ok)
    throw new Error(`insert ${tabela} falhou: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0];
}

/** PATCH via service role — restaura fixture que o spec alterou de propósito
 *  (ex.: a dupla que o remanejo encerrou volta a "ativa"). `filtro` é a query
 *  do PostgREST; `patch` é o corpo do update. */
export async function atualizarViaServiceRole(
  tabela: string,
  filtro: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — cleanup abortado");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${tabela} falhou: ${res.status}`);
}

/** POST /rest/v1/rpc/<fn> via service role — leituras/validações que a UI
 *  não expõe (ex.: especialista_slots_livres pra escolher um slot real da
 *  grade de um especialista antes de semear uma contra-proposta). Mesmo
 *  hard-stop: spec app nunca fala com prod. */
export async function rpcViaServiceRole<T = unknown>(
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — RPC abortada");
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok)
    throw new Error(`rpc ${fn} falhou: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Access token de um usuário de teste (grant password do GoTrue) — pra
 *  assert de RLS "com o token dele": o que o PostgREST devolve/faz na pele
 *  do papel, não via service role (que ignora policy). O apikey só precisa
 *  ser uma chave válida do projeto — a service serve; o papel resolvido vem
 *  do Bearer nos calls seguintes. Mesmo hard-stop: spec app nunca fala com
 *  prod. */
export async function jwtDoUsuario(
  email: string,
  senha: string
): Promise<string> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — login abortado");
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha }),
    }
  );
  if (!res.ok)
    throw new Error(`login ${email} → ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`login ${email} sem access_token`);
  return body.access_token;
}

/** REST autenticado como o usuário do JWT — apikey service + Bearer dele:
 *  o gateway valida a key e o PostgREST resolve a role pelo Bearer (é o
 *  mesmo par que o supabase-js manda, só que com a key elevada). Devolve a
 *  Response crua — assert de RLS quer o status (200 vazio × 4xx), não um
 *  throw cedo. Mesmo hard-stop: spec app nunca fala com prod. */
export async function restComoUsuario(
  path: string,
  jwt: string,
  init: { method?: string; body?: unknown } = {}
): Promise<Response> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — request abortado");
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${jwt}`,
      ...(init.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}
