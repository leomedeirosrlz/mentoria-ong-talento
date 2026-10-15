import type { Metadata } from "next";

/** Open Graph compartilhado — espalhar (`{ ...sharedOg, title, url }`) nos
 *  generateMetadata das rotas. O merge do Next é raso: uma rota que define
 *  `openGraph` substitui o objeto inteiro herdado do layout, então cada
 *  rota pública redeclara tudo através desta constante. */
export const sharedOg = {
  siteName: "Realiza.vc",
  locale: "pt_BR",
  type: "website",
  // card de marca 1200×630 (public/og-cover.png) — o formato universal que
  // WhatsApp/X/Slack/iMessage leem; PNG <300KB e absoluto via metadataBase
  images: [
    {
      url: "/og-cover.png",
      width: 1200,
      height: 630,
      alt: "Realiza.vc · Programa de Mentoria Social",
    },
  ],
} satisfies NonNullable<Metadata["openGraph"]>;
