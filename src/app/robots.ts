import type { MetadataRoute } from "next";

// /api/ e /auth/ não têm conteúdo indexável — disallow corta crawl inútil.
// /assinar/<token>, /f/<token> e /demo ficam FORA de propósito: eles levam
// `noindex` no metadata, e o crawler só honra noindex se puder baixar a
// página — bloquear aqui impediria o Google de ver o noindex e um link
// tokenizado vazado ainda poderia entrar no índice como URL nua.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/api/", "/auth/"],
    },
  };
}
