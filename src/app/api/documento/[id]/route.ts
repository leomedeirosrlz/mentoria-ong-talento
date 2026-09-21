import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download de documento oficial (termo do mentor, autorização do mentorado):
// a autorização mora na policy do storage.objects — só a coordenação lê objeto
// do bucket `documentos`, então só ela consegue assinar URL (outros -> 404).
// O arquivo sai do bucket privado via signed URL de 5 min.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo !== "pessoa" && tipo !== "mentorado") {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }
  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return new NextResponse("Sessão expirada — entre de novo.", { status: 401 });
  }

  // documento_path de profiles está fora do grant de coluna (0026) — a view
  // profiles_contato só devolve o campo pra coordenação; pros demais vem
  // null (ou nem a linha) e cai no 404, como a policy do storage já faria
  const { data: pessoa, error } = await supabase
    .from(tipo === "mentorado" ? "mentorados" : "profiles_contato")
    .select("id, documento_path")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return new NextResponse("Não foi possível abrir o documento — tente de novo.", { status: 500 });
  }
  if (!pessoa?.documento_path) {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documentos")
    .createSignedUrl(pessoa.documento_path, 300);
  if (signError || !signed?.signedUrl) {
    return new NextResponse("Não foi possível abrir o documento.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
