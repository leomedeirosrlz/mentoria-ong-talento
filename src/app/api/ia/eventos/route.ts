// DELETE /api/ia/eventos — wipes the /ia panel indicators (all of
// ia_eventos: messages, tools and answers from every channel). Coord-only
// like the page; the write itself is the definer RPC ia_eventos_limpar
// (0166) because the table is select-only for authenticated.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limparCachePainelIa } from "@/lib/ia/queries";

export async function DELETE() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub)
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { data: papeis } = await supabase.rpc("my_papeis");
  if (!((papeis as string[] | null) ?? []).includes("coordenacao"))
    return NextResponse.json({ error: "Área da coordenação." }, { status: 403 });

  const { data: apagados, error } = await supabase.rpc("ia_eventos_limpar");
  if (error)
    return NextResponse.json(
      { error: "Não consegui limpar os indicadores — tente de novo." },
      { status: 500 }
    );
  // sem isso o refresh relia até 60s de eventos já apagados e o painel
  // parecia não limpar
  limparCachePainelIa();
  return NextResponse.json({ ok: true, apagados: apagados ?? 0 });
}
