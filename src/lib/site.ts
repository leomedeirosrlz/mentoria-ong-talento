/** Base pública absoluta do app — usada por metadataBase (og:url,
 *  canonical, og:image) e pelos CTAs de e-mail. Módulo neutro de propósito:
 *  o layout importa daqui pra não arrastar o Resend (email.ts) pro bundle
 *  de metadados de toda rota. Em preview do Vercel, VERCEL_URL/… cobrem a
 *  base; em prod exige NEXT_PUBLIC_SITE_URL configurada. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
  "http://localhost:3000"
).replace(/\/$/, "");
