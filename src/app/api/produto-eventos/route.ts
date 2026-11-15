import { demoRole } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// REALIZA-417 — endpoint do beacon de adoção: recebe o lote (sendBeacon
// manda text/plain ou application/json) e grava via RPC definer — actor e
// papel saem do JWT do caller, nunca do payload. 204 sempre: telemetria
// nunca devolve erro visível nem segura a navegação.

const LOTE_MAX = 20;

export async function POST(request: Request) {
  // demo não coleta — persona fake não tem profile e a coleta dela não
  // responde pergunta de adoção (o RPC também barraria, mas nem chama)
  if (await demoRole()) return new NextResponse(null, { status: 204 });

  let lote: unknown;
  try {
    lote = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!Array.isArray(lote) || lote.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabase.rpc("registrar_produto_eventos", {
    p_eventos: lote.slice(0, LOTE_MAX),
  });
  if (error) console.error("produto-eventos:", error);
  return new NextResponse(null, { status: 204 });
}
