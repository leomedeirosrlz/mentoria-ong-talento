import type { NextConfig } from "next";

// Segunda barreira contra XSS (hoje não há sink de markup) + clickjacking:
// /assinar/<token> e /f/<token> são públicas por token e nunca podem virar
// iframe de phishing.
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' é exigência do hydration/RSC do Next sem nonce middleware;
  // 'unsafe-eval' só em dev — React Dev o usa pra reconstruir callstacks
  // (em produção o React nunca chama eval, então a diretiva fica fora)
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  // supabase.co = avatares (bucket público), gravatar = fallback por e-mail,
  // blob: = preview de avatar via createObjectURL, data: = ícone embutido
  "img-src 'self' data: blob: https://*.supabase.co https://*.gravatar.com",
  // supabase-js no browser: REST/Auth por https, Realtime por wss
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // sem "X-Powered-By: Next.js" — banner de stack não ajuda ninguém
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // fallback pros browsers sem CSP (frame-ancestors cobre os novos)
          { key: "X-Frame-Options", value: "DENY" },
          // a Vercel já injeta HSTS na borda — aqui cobre qualquer outro host
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
