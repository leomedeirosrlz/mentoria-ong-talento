import { headers } from "next/headers";
import { SITE_URL } from "./site";

/**
 * Base pública da requisição em curso — o host que a pessoa está usando de
 * fato (staging, preview, produção), não uma env fixa. Links que vão sair do
 * app (convite de WhatsApp) não podem depender de configuração por ambiente:
 * o Preview genérico apontava pra `localhost:3000` e o link chegava quebrado.
 * Fallback: `SITE_URL` (metadata/email), que já resolve Vercel e localhost.
 */
export async function baseUrlDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
