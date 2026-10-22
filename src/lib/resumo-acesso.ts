import { createHash } from "node:crypto";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { ipCliente } from "@/lib/ip";
import { createAdminClient } from "@/lib/supabase/admin";

// Log de acesso do /resumo público (REALIZA-183). O link por obscuridade
// expõe dados de pessoas — esta é a trilha de auditoria de quem abriu.
// SERVER ONLY: usa headers(), service role e env de salt — nunca importar
// em client component.

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
 *  pequeno pra dicionário): melhor perder a linha do log do que gravar um
 *  identificador quebrável. Decisão: docs/planos/issues/_decisoes.md. */
function saltAcesso(): string | null {
  const env = process.env.RESUMO_ACESSO_SALT;
  if (env) return env;
  if (process.env.VERCEL_ENV === "production") {
    console.error(
      "[resumo_acessos] RESUMO_ACESSO_SALT não configurada em produção — acesso não registrado"
    );
    if (!saltEmFaltaAvisado) {
      saltEmFaltaAvisado = true;
      Sentry.captureException(
        new Error(
          "RESUMO_ACESSO_SALT ausente em produção — /resumo rodando sem log de acesso"
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

/** Insert append-only em resumo_acessos via service role (a tabela não tem
 *  writer com JWT — quem escreve é o servidor). Chamada fire-and-forget
 *  pelo server component: `void logAcessoResumo(slug, sp)` — o insert é
 *  awaited aqui dentro pra chegar ao banco de verdade, e qualquer falha
 *  morre no catch: auditoria nunca é gate da página. */
export async function logAcessoResumo(
  slug: string,
  sp: Record<string, string | undefined>
): Promise<void> {
  try {
    const salt = saltAcesso();
    if (!salt) return; // prod sem env: a falha já saiu — não degrada quieto
    const [h, ip] = await Promise.all([headers(), ipCliente()]);
    // allowlist {turma,gran,col}: só o recorte pedido entra no log — query
    // arbitrária não vira linha solta em jsonb
    const params: Record<string, string> = {};
    for (const k of ["turma", "gran", "col"] as const) {
      const v = sp[k];
      if (v !== undefined) params[k] = v;
    }
    await createAdminClient()
      .from("resumo_acessos")
      .insert({
        slug,
        ip_hash: ip ? hashIpAcesso(ip, salt) : null,
        user_agent: h.get("user-agent")?.slice(0, 500) ?? null,
        params,
      });
  } catch {
    // log é auditoria, não gate — engole qualquer falha de banco/rede/env
  }
}
