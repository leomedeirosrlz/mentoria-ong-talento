import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download de material oficial: a RLS de materiais deixa qualquer papel ler a
// row — a autorização de audiência mora na policy do storage.objects, que só
// assina URL de arquivo cujo material o usuário pode ver (invisível -> 404).
// O arquivo sai do bucket privado via signed URL de 5 min.
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

  const { data: material, error } = await supabase
    .from("materiais")
    .select("id, path")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return new NextResponse("Não foi possível abrir o material — tente de novo.", { status: 500 });
  }
  if (!material?.path) {
    return new NextResponse("Material não encontrado.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("materiais")
    .createSignedUrl(material.path, 300);
  if (signError || !signed?.signedUrl) {
    return new NextResponse("Não foi possível abrir o material.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
