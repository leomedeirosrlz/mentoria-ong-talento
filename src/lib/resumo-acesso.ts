import { createHash } from "node:crypto";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { ipCliente } from "@/lib/ip";

// Pseudônimo de acesso do /resumo público (REALIZA-170). Quem grava a
// auditoria é a RPC abrir_relatorio (0110) — aqui só sai o rastro que ela
// recebe: SHA-256(salt:ip) + user-agent truncado. O ip_hash é repassado
// como argumento — forjável via REST direto, por isso o rate-limit tem o
// cap global por slug como bound de verdade (o hash serve ao por-IP e à
// leitura da trilha, não à decisão de segurança).
// SERVER ONLY: usa headers() e env de salt — nunca importar em client
// component.

/** Salt fixo fora de produção — dev, preview e o stack local de e2e ficam
 *  funcionais sem env. Menos seguro (salt "público" permite dicionário de
 *  IPs), aceitável fora de prod — sdr.md §IP. Em produção não há fallback:
 *  a env RESUMO_ACESSO_SALT é obrigatória e a falta dela falha VISÍVEL. */
const DEV_SALT = "realiza-resumo-acesso-dev";

/** Uma captura por instância: o console.error sai a cada acesso (visível no
 *  log da Vercel), mas o evento Sentry não pode inundar a cada request. */
let saltEmFaltaAvisado = false;

/** Resolve o salt do pseudônimo de IP. Em produção sem a env devolve null —
 *  hash com salt público seria pseudônimo previsível (o espaço de IPv4 é
 *  pequeno pra dicionário): melhor a linha de auditoria ir com ip_hash
 *  null do que gravar um identificador quebrável.
 *  Decisão: docs/planos/issues/_decisoes.md. */
function saltAcesso(): string | null {
  const env = process.env.RESUMO_ACESSO_SALT;
  if (env) return env;
  if ((process.env.APP_ENV ?? process.env.VERCEL_ENV) === "production") {
    console.error(
      "[resumo_acessos] RESUMO_ACESSO_SALT não configurada em produção — ip_hash da auditoria vai nulo"
    );
    if (!saltEmFaltaAvisado) {
      saltEmFaltaAvisado = true;
      Sentry.captureException(
        new Error(
          "RESUMO_ACESSO_SALT ausente em produção — auditoria do /resumo sem ip_hash"
        )
      );
    }
    return null;
  }
  return DEV_SALT;
}

/** SHA-256(salt:ip) — pseudônimo determinístico: mesmo IP → mesmo hash, sem
 *  o IP em claro em lugar nenhum (LGPD — minimização em repouso). */
export function hashIpAcesso(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Cookie de desbloqueio do link com senha — o nome é por slug porque um
 *  visitante pode guardar senhas de links diferentes. O valor é a própria
 *  senha: não há sessão pra derrubar, o cookie é revalidado no bcrypt a
 *  cada render (revogação/rotação do link quebram na hora). Mora aqui e
 *  não em actions-resumo.ts porque arquivo "use server" só exporta async. */
const COOKIE_PREFIX = "resumo_";

export function resumoCookie(slug: string): string {
  return COOKIE_PREFIX + slug;
}

/** O rastro que a RPC abrir_relatorio grava em resumo_acessos: ip_hash
 *  pseudônimo (null quando o IP não é derivável ou o salt falta em prod —
 *  a falha já saiu visível) e user-agent truncado no tamanho da coluna. */
export async function rastroAcesso(): Promise<{
  ipHash: string | null;
  ua: string | null;
}> {
  const salt = saltAcesso();
  const [h, ip] = await Promise.all([headers(), ipCliente()]);
  return {
    ipHash: salt && ip ? hashIpAcesso(ip, salt) : null,
    ua: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}
