// Catálogo de modelos do provider pra aba de ajustes da bolha
// (REALIZA-328): GET /models do endpoint OpenAI-compatible, server-side
// — a chave nunca sai do servidor. Só coordenação lê: a lista informa
// preços/linhagem do provider e a aba que a consome já é coord-only.
// Cache curto em memória: a aba pode abrir várias vezes seguidas e a
// lista do provider não muda por minuto.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

let cache: { slugs: string[]; ate: number } | null = null;
const CACHE_MS = 5 * 60_000;

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  }
  const { data: papeis } = await supabase.rpc("my_papeis");
  if (!papeis?.includes("coordenacao")) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  if (cache && cache.ate > Date.now()) {
    return NextResponse.json({ modelos: cache.slugs });
  }
  try {
    const res = await fetch(`${process.env.IA_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${process.env.IA_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { id?: string }[] };
    const slugs = (json.data ?? [])
      .map((m) => m.id)
      .filter((s): s is string => Boolean(s))
      .sort();
    cache = { slugs, ate: Date.now() + CACHE_MS };
    return NextResponse.json({ modelos: slugs });
  } catch {
    // catálogo vazio não quebra a aba — os selects ficam com os valores
    // atuais e texto livre segue possível
    return NextResponse.json({ modelos: [] });
  }
}

/** POST {slugs: string[]} → {saude: {slug: {ok, ms}}} — reconhecimento
 *  automático: um slug no catálogo não garante que ele responde (o Zen
 *  rota por upstream e modelos somem/ciclam). Ping de 1 token em
 *  paralelo, cap 8 slugs e 10s por probe — custo irrisório por modelo,
 *  resposta em ~o ttft do mais lento. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  }
  const { data: papeis } = await supabase.rpc("my_papeis");
  if (!papeis?.includes("coordenacao")) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    slugs?: unknown;
  } | null;
  const slugs = [...new Set((body?.slugs ?? []) as unknown[])]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 8);
  if (!slugs.length) return NextResponse.json({ saude: {} });

  const provar = async (slug: string) => {
    const t0 = Date.now();
    try {
      const res = await fetch(
        `${process.env.IA_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.IA_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "realiza-app/1.0",
            "x-opencode-session": "probe-config",
          },
          body: JSON.stringify({
            model: slug,
            messages: [{ role: "user", content: "ok" }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(10_000),
        }
      );
      return [slug, { ok: res.ok, ms: Date.now() - t0, status: res.status }] as const;
    } catch {
      return [slug, { ok: false, ms: Date.now() - t0, status: 0 }] as const;
    }
  };

  const pares = await Promise.all(slugs.map(provar));
  return NextResponse.json({ saude: Object.fromEntries(pares) });
}
