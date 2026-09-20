import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download de evidência: a RLS de registro_anexos já faz a autorização —
// quem não pode ler o registro nem vê a row (404). O arquivo sai do bucket
// privado via signed URL de 5 min.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return new NextResponse("Sessão expirada — entre de novo.", { status: 401 });
  }

  const { data: anexo, error } = await supabase
    .from("registro_anexos")
    .select("id, path")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return new NextResponse("Não foi possível abrir o anexo — tente de novo.", { status: 500 });
  }
  if (!anexo) {
    return new NextResponse("Anexo não encontrado.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("registro-anexos")
    .createSignedUrl(anexo.path, 300);
  if (signError || !signed?.signedUrl) {
    return new NextResponse("Não foi possível abrir o anexo.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
