import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ROLE_COOKIE, papelDemoValido } from "@/lib/demo/shared";
import type { InteracaoTipo } from "@/lib/interacoes";

const TIPOS: ReadonlySet<string> = new Set<InteracaoTipo>(["nudge", "contato", "apoio"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// destino obrigatoriamente wa.me/<dígitos> — qualquer outra URL seria open
// redirect; wa.me/ sem número abre a página de erro do WhatsApp. A âncora de
// fim importa: sem ela "https://wa.me/1@evil.com" casa o regex mas o URL
// parser lê "wa.me" como userinfo e "evil.com" como host → open redirect
const WA_ME_RE = /^https:\/\/wa\.me\/\d+$/;

// GET /api/nudge?d=<dupla_id>&to=<wa.me url>&t=<tipo>
// Loga o contato em `interacoes` e redireciona pro WhatsApp — o botão de nudge
// aponta pra cá em vez do wa.me direto. O log é secundário: se falhar,
// o redirect acontece mesmo assim (o nudge não pode depender do banco).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // modo demo: sem sessão nem banco — valida o destino com a mesma regra e
  // redireciona direto; nada de logar interação em dupla fictícia
  const demo = papelDemoValido(request.cookies.get(DEMO_ROLE_COOKIE)?.value);
  if (demo) {
    const to = searchParams.get("to") ?? "";
    if (!WA_ME_RE.test(to)) {
      return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
    }
    return NextResponse.redirect(new URL(to), 302);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (!sub) {
    // parity com o middleware: volta pra cá depois do login
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(destino)}`, request.url)
    );
  }

  const to = searchParams.get("to") ?? "";
  if (!WA_ME_RE.test(to)) {
    return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
  }

  const duplaId = searchParams.get("d") ?? "";
  const t = searchParams.get("t") ?? "nudge";
  const tipo: InteracaoTipo = TIPOS.has(t) ? (t as InteracaoTipo) : "nudge";

  if (UUID_RE.test(duplaId)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", sub)
      .maybeSingle();
    if (profile) {
      // dedup de 60s — double-tap no celular dispara dois GETs e inflaria o log
      const { data: recente } = await supabase
        .from("interacoes")
        .select("id")
        .eq("dupla_id", duplaId)
        .eq("autor_id", profile.id)
        .eq("tipo", tipo)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .limit(1)
        .maybeSingle();
      if (!recente) {
        const { error } = await supabase.from("interacoes").insert({
          dupla_id: duplaId,
          autor_id: profile.id,
          canal: "whatsapp",
          tipo,
        });
        if (error) console.error("nudge: falha ao registrar interação", error);
      }
    }
  }

  return NextResponse.redirect(new URL(to), 302);
}
