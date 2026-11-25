// Impersonation pra execução de tools (sdd D1, liza-pacote-2026-11): o canal
// MCP não pode rodar com service-role — bypassa RLS e um PAT de supervisor
// virava leitura de coordenador. Aqui a PAT do dono vira um JWT real dele:
// generateLink (admin) minta magic link → verifyOtp troca por sessão → o
// client resultante roda as queries com a RLS do usuário, idêntico ao chat.
//
// Cache em memória por user_id guarda o client + o refresh_token da sessão.
// Perto de expirar (~1min de margem) renova com auth.refreshSession num
// client anon em vez de mintar de novo: cada generateLink cria uma sessão
// nova em auth.sessions e podia invalidar o magic link que a pessoa acabou
// de pedir pra entrar no app (o login dela é por e-mail). O mint por link
// fica só pra cache vazio ou refresh falhando (token revogado/expirado de
// vez); falhando tudo, null — o caller decide o erro (fail-closed).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Entrada = {
  client: SupabaseClient;
  /** refresh da sessão mintada — o GoTrue rotaciona a cada refreshSession,
   *  então o cache sempre guarda o mais recente */
  refreshToken: string;
  /** expiração do access token em ms epoch (session.expires_at * 1000) */
  expiraEm: number;
};

const cache = new Map<string, Entrada>();

// sessões efêmeras de auth: nada de persist nem auto-refresh — o refresh
// é manual e explícito, no ponto em que o cache manda
const AUTH_OPTS = { persistSession: false, autoRefreshToken: false } as const;

function clientAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: AUTH_OPTS }
  );
}

function clientAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: AUTH_OPTS }
  );
}

/** Client que roda as queries com a RLS do usuário — o Bearer vai no header
 *  global porque o client não tem sessão própria (persist desligado). */
function clientComJwt(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: AUTH_OPTS,
    }
  );
}

/** Sessão → entrada de cache + client pronto. Devolve null se a sessão
 *  veio sem access token — entrada sem JWT não serve pra nada. O
 *  `refreshAnterior` cobre resposta de refreshSession sem refresh_token
 *  novo (o GoTrue rotaciona, mas o campo não é garantido no payload). */
function entradaDaSessao(
  sessao: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  },
  refreshAnterior?: string
): Entrada | null {
  if (!sessao.access_token) return null;
  return {
    client: clientComJwt(sessao.access_token),
    refreshToken: sessao.refresh_token ?? refreshAnterior ?? "",
    expiraEm: (sessao.expires_at ?? 0) * 1000,
  };
}

/** Mint pelo magic link: caminho frio (cache vazio ou refresh morto). */
async function mintar(userId: string): Promise<Entrada | null> {
  const admin = clientAdmin();
  const { data: alvo, error: eUser } = await admin.auth.admin.getUserById(userId);
  if (eUser || !alvo.user?.email) {
    console.error("clientImpersonado getUserById:", eUser);
    return null;
  }
  const { data: link, error: eLink } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: alvo.user.email,
  });
  const hashed = link?.properties?.hashed_token;
  if (eLink || !hashed) {
    console.error("clientImpersonado generateLink:", eLink);
    return null;
  }
  const { data: verif, error: eOtp } = await clientAnon().auth.verifyOtp({
    token_hash: hashed,
    // type casa com o do generateLink — GoTrue rejeita token de magiclink
    // verificado como 'email' (tipos de OTP distintos)
    type: "magiclink",
  });
  if (eOtp || !verif.session) {
    console.error("clientImpersonado verifyOtp:", eOtp);
    return null;
  }
  return entradaDaSessao(verif.session);
}

/** Client Supabase com o JWT do usuário `userId` (auth.users.id). null quando
 *  a sessão não pode ser mintada nem renovada — o caller decide o erro
 *  (fail-closed). */
export async function clientImpersonado(
  userId: string
): Promise<SupabaseClient | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiraEm > Date.now() + 60_000) return hit.client;

  // access token vencendo/vencido: renova com o refresh guardado antes de
  // apelar pro mint — não cria sessão nova em auth.sessions nem queima um
  // possível magic link de login pendente na caixa da pessoa
  if (hit?.refreshToken) {
    const { data, error } = await clientAnon().auth.refreshSession({
      refresh_token: hit.refreshToken,
    });
    const entrada = data?.session
      ? entradaDaSessao(data.session, hit.refreshToken)
      : null;
    if (entrada) {
      cache.set(userId, entrada);
      return entrada.client;
    }
    console.error("clientImpersonado refreshSession:", error);
  }

  const entrada = await mintar(userId);
  if (!entrada) return null;
  cache.set(userId, entrada);
  return entrada.client;
}
