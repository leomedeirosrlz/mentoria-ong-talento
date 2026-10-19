import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ROLE_COOKIE, papelDemoValido } from "@/lib/demo/shared";
import { LEMBRETE_INTERVALO_MS } from "@/lib/ciclo";
import type { InteracaoTipo } from "@/lib/interacoes";

const TIPOS: ReadonlySet<string> = new Set<InteracaoTipo>(["nudge", "contato", "apoio"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// destino obrigatoriamente wa.me/<dígitos> — qualquer outra URL seria open
// redirect. Parse de URL (não regex): `waLink()` sempre manda `?text=` e um
// regex com âncora de fim rejeitaria todo destino real; "https://wa.me/
// 1@evil.com" precisa continuar falhando (userinfo × host).
function waMeValido(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "wa.me" &&
      /^\/\d+$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

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
    if (!waMeValido(to)) {
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
  if (!waMeValido(to)) {
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
      // D5 — cap de 48h por dupla pros pings de lembrete (tipo 'nudge'),
      // valendo também pra esse WhatsApp manual; 'contato'/'apoio' são
      // conversa normal e não entram no cap. O check aqui é a régua da UX
      // (mostrar "já foi lembrada" antes do redirect): a garantia dura do
      // cap mora na RPC `enviar_lembrete`, que serializa por dupla com
      // advisory lock — aqui dois GETs paralelos no máximo duplicam uma
      // linha de log, nunca mandam notificação a mais.
      if (tipo === "nudge") {
        const { data: nudges } = await supabase
          .from("interacoes")
          .select("created_at")
          .eq("dupla_id", duplaId)
          .eq("tipo", "nudge")
          // "<= now" junto com o >=: timestamp futuro forjado trancaria o cap
          .lte("created_at", new Date().toISOString())
          .gte("created_at", new Date(Date.now() - LEMBRETE_INTERVALO_MS).toISOString())
          .order("created_at", { ascending: false })
          .limit(1);
        if (nudges?.length) {
          const ate = new Date(
            new Date(nudges[0].created_at).getTime() + LEMBRETE_INTERVALO_MS
          );
          return new NextResponse(
            `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;display:grid;place-items:center;min-height:80vh;text-align:center"><main><h1>Lembrete já enviado</h1><p>Essa dupla já foi lembrada. Vale outro a partir de <b>${ate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.</p><p><a href="/agenda">Voltar pra agenda</a></p></main></body>`,
            { headers: { "content-type": "text/html; charset=utf-8" } }
          );
        }
      }
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
