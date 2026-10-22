import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { apiErro } from "@/lib/api-erro";

// Download de anexo de chamado: a RLS de chamado_anexos já corta quem não
// vê o chamado (e anexo interno some do autor); o arquivo sai do bucket
// privado chamado-anexos via signed URL de 5 min — molde /api/material/[id].

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (await demoRole()) {
    return apiErro("Anexo não disponível no modo demo.", {
      status: 404,
    });
  }
  if (!UUID_RE.test(id)) {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return apiErro("Sessão expirada. Entre de novo.", {
      status: 401,
      acao: { href: "/login", label: "Ir para o login" },
    });
  }

  const { data: anexo, error } = await supabase
    .from("chamado_anexos")
    .select("id, path, nome")
    .eq("id", id)
    .maybeSingle();
  if (error || !anexo?.path) {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }

  const { data: signed, error: errSign } = await supabase.storage
    .from("chamado-anexos")
    .createSignedUrl(anexo.path, 300);
  if (errSign || !signed?.signedUrl) {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
