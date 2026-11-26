/** Base pública absoluta do app — usada por metadataBase (og:url,
 *  canonical, og:image) e pelos CTAs de e-mail. Módulo neutro de propósito:
 *  o layout importa daqui pra não arrastar o Resend (email.ts) pro bundle
 *  de metadados de toda rota. Em preview do Vercel, VERCEL_URL/… cobrem a
 *  base; em prod exige NEXT_PUBLIC_SITE_URL configurada. */
const semBarra = (u: string) => u.replace(/\/$/, "");

/** Ordem: env explícita → domínio de produção do projeto → URL do próprio
 *  deployment (todo deploy do Vercel recebe VERCEL_URL) → localhost. O
 *  penúltimo degrau existe porque preview/staging sem NEXT_PUBLIC_SITE_URL
 *  caía em `localhost:3000` e mandava link quebrado no WhatsApp. */
export const SITE_URL = (() => {
  const bruto =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;
  if (!bruto) return "http://localhost:3000";
  return semBarra(/^https?:\/\//.test(bruto) ? bruto : `https://${bruto}`);
})();
