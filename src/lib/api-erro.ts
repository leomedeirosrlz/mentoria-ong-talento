import { NextResponse } from "next/server";

// Erro de route handler que o visitante abre no navegador (material, via
// assinada, anexos): `new NextResponse("texto")` vira texto cru solto no
// canto superior, sem CSS nenhum — no celular parece página quebrada. Aqui
// vira uma página mínima na gramática do EstadoCard (card centrado, título,
// detalhe, ação de saída). Estilos inline de propósito: a resposta de erro
// não carrega o CSS da app nem o layout — o HTML precisa ser autossuficiente.
const TITULO_PADRAO: Record<number, string> = {
  400: "Pedido inválido",
  401: "Sessão expirada",
  403: "Sem acesso",
  404: "Não encontrado",
  429: "Muitas tentativas",
  500: "Algo deu errado",
};

// escape manual — mensagens aqui são strings internas, mas o helper também
// recebe URL de ação; barato demais pra abrir uma janela de XSS por reflexo
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function apiErro(
  mensagem: string,
  {
    status,
    titulo,
    acao,
  }: {
    status: number;
    /** título do card — default por status (404 → "Não encontrado") */
    titulo?: string;
    /** saída do beco — mesmo papel do `acao` do EstadoCard */
    acao?: { href: string; label: string };
  }
): NextResponse {
  const t = esc(titulo ?? TITULO_PADRAO[status] ?? "Algo deu errado");
  const m = esc(mensagem);
  const link = acao
    ? `<p style="margin:1.25rem 0 0"><a href="${esc(acao.href)}" style="display:inline-flex;min-height:2.75rem;align-items:center;justify-content:center;border:1px solid hsl(75 6% 87%);border-radius:.5rem;padding:0 1rem;font-size:.8rem;font-weight:500;color:hsl(0 0% 15%);text-decoration:none">${esc(acao.label)}</a></p>`
    : "";
  // paleta espelha globals.css (--background/--card/--muted/--border) —
  // hardcoded porque a página não herda os tokens da app
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${t} · Realiza.vc</title>
</head>
<body style="margin:0;display:grid;min-height:100dvh;place-items:center;background:hsl(75 10% 95%);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:1rem;padding-left:max(1rem,env(safe-area-inset-left));padding-right:max(1rem,env(safe-area-inset-right))">
<main style="width:100%;max-width:24rem;border-radius:.75rem;background:#fff;padding:2rem 1.5rem;text-align:center;box-shadow:0 0 0 1px hsl(75 6% 87%)">
<img src="/logo-realiza.png" alt="Realiza.vc" style="display:block;height:1.5rem;width:auto;margin:0 auto">
<div aria-hidden="true" style="margin:1.5rem auto 0;display:grid;height:3rem;width:3rem;place-items:center;border-radius:9999px;background:hsl(75 7% 93%);color:hsl(75 4% 40%)">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><circle cx="128" cy="128" r="96"/><line x1="128" y1="80" x2="128" y2="140"/><circle cx="128" cy="176" r="12" fill="currentColor" stroke="none"/></svg>
</div>
<h1 style="margin:1rem 0 0;font-size:1.125rem;line-height:1.4;font-weight:600;color:hsl(0 0% 15%)">${t}</h1>
<p style="margin:.5rem auto 0;max-width:20rem;font-size:.875rem;line-height:1.65;color:hsl(75 4% 40%)">${m}</p>
${link}
</main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
