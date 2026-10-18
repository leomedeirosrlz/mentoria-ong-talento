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
  // supabase-js no browser: REST/Auth por https, Realtime por wss.
  // e2e/app roda contra o supabase local do CI (http://127.0.0.1:54321) —
  // inclui a origem quando o projeto não é *.supabase.co (loopback é seguro).
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.endsWith(".supabase.co")
      ? ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}`
      : ""
  }`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // sem "X-Powered-By: Next.js" — banner de stack não ajuda ninguém
  poweredByHeader: false,
  // acesso ao dev server a partir de outros dispositivos (celular via LAN
  // ou Tailscale): sem a origem aqui o Next bloqueia os endpoints de dev —
  // o HMR falha, a hydration nunca roda e a página renderiza morta (SSR
  // ok, zero interatividade). Casa por hostname: IP e MagicDNS da máquina.
  allowedDevOrigins: [
    "192.168.15.6",
    "100.113.24.100",
    "thixmachine2.tailf3e87b.ts.net",
  ],
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
