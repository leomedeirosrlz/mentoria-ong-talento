// DELETE /api/ia/eventos — zera os indicadores do painel /ia (ia_eventos
// inteiro: mensagens, tools e respostas de todos os canais). Coord-only
// igual à página; a escrita em si é a RPC definer ia_eventos_limpar (0166)
// porque a tabela é select-only pra authenticated.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  return NextResponse.json({ ok: true, apagados: apagados ?? 0 });
}
