import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Só entram as páginas realmente indexáveis — o app inteiro fica atrás de
// login e as rotas tokenizadas (/f, /avaliar, /assinar, /resumo) são
// noindex por desenho. `/` redireciona a /login pra anônimo, então a
// entrada canônica de busca é ela.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${SITE_URL}/privacidade`,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
