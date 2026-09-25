import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoPdf } from "@/lib/demo/pdf";

// Download de documento: oficial (tipo=pessoa|mentorado — termo do mentor,
// autorização do mentorado) ou do intake (tipo=doc — row de documentos_pessoa,
// 0054). A autorização mora na policy do storage.objects + RLS da tabela —
// só a coordenação lê objeto do bucket `documentos`, então só ela consegue
// assinar URL (outros -> 404). O arquivo sai do bucket privado via signed
// URL de 5 min.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo !== "pessoa" && tipo !== "mentorado" && tipo !== "doc") {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  // modo demo: documento oficial é restrito — só a coordenação baixa (a policy
  // do bucket garante isso no real; aqui o 404 reproduz pros demais papéis)
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }
    const d = getDemoData();
    const doc =
      tipo === "mentorado"
        ? d.mentorados.find((x) => x.id === id)?.documento_path
        : d.profiles.find((x) => x.id === id)?.documento_path;
    if (!doc) {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }
    const pdf = demoPdf(
      `Documento oficial · ${
        tipo === "mentorado" ? "autorização do mentorado" : "termo do mentor"
      }`
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="demo-documento.pdf"',
      },
    });
  }

  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return new NextResponse("Sessão expirada. Entre de novo.", { status: 401 });
  }

  // tipo=doc: documento do intake — documentos_pessoa é coord-only pela RLS,
  // então a row só volta pra coordenação; pros demais cai no 404. O storage
  // repete o gate (a policy do bucket exige o path registrado em alguém).
  const { data: doc, error } = tipo === "doc"
    ? await supabase
        .from("documentos_pessoa")
        .select("id, path")
        .eq("id", id)
        .maybeSingle()
    // documento_path de profiles está fora do grant de coluna (0026) — a view
    // profiles_contato só devolve o campo pra coordenação; pros demais vem
    // null (ou nem a linha) e cai no 404, como a policy do storage já faria
    : await supabase
        .from(tipo === "mentorado" ? "mentorados" : "profiles_contato")
        .select("id, documento_path")
        .eq("id", id)
        .maybeSingle();
  if (error) {
    return new NextResponse("Não foi possível abrir o documento. Tente de novo.", { status: 500 });
  }
  const path = doc == null ? null : "path" in doc ? doc.path : doc.documento_path;
  if (!path) {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 300);
  if (signError || !signed?.signedUrl) {
    return new NextResponse("Não foi possível abrir o documento.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
