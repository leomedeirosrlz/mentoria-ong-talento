import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoPdf } from "@/lib/demo/pdf";
import { DOCUMENTO_PESSOA_TIPO_LABELS } from "@/lib/ciclo";

// Download de documento: oficial (tipo=pessoa|mentorado — termo do mentor,
// autorização do mentorado), do intake (tipo=doc — row de documentos_pessoa,
// 0054) ou o currículo do mentorado (tipo=curriculo — curriculo_path, 0081).
// A autorização mora na policy do storage.objects + RLS da tabela — só quem
// alcança o path consegue assinar URL (demais -> 404). O arquivo sai do
// bucket privado via signed URL de 5 min.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo !== "pessoa" && tipo !== "mentorado" && tipo !== "doc" && tipo !== "curriculo") {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  // modo demo: documento oficial é restrito — só a coordenação baixa (a policy
  // do bucket garante isso no real; aqui o 404 reproduz pros demais papéis).
  // O currículo é a exceção: o auxiliar executivo também baixa — mas só de
  // mentorado que ele supervisiona, como a policy documentos_storage_select_curriculo
  const demo = await demoRole();
  if (demo) {
    const d = getDemoData();
    const auxSupervisiona =
      demo === "supervisor" &&
      d.duplas.some(
        (x) => x.mentorado?.id === id && x.supervisor?.id === d.personas.supervisor.id
      );
    const podeBaixar =
      demo === "coordenacao" || (tipo === "curriculo" && auxSupervisiona);
    if (!podeBaixar) {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }
    // tipo=doc olha documentos_pessoa; curriculo lê o curriculo_path; os
    // demais apontam pro documento_path oficial (termo / autorização)
    const intake =
      tipo === "doc"
        ? d.documentosPessoa.find((x) => x.id === id) ?? null
        : null;
    const doc =
      tipo === "doc"
        ? intake?.path
        : tipo === "curriculo"
          ? d.mentorados.find((x) => x.id === id)?.curriculo_path
          : tipo === "mentorado"
            ? d.mentorados.find((x) => x.id === id)?.documento_path
            : d.profiles.find((x) => x.id === id)?.documento_path;
    if (!doc) {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }
    const pdf = intake
      ? demoPdf(
          `Documento do intake · ${DOCUMENTO_PESSOA_TIPO_LABELS[intake.tipo]}`,
          `Arquivo ${intake.nome ?? "anexado"} — o oficial sai do bucket privado documentos.`
        )
      : demoPdf(
          tipo === "curriculo"
            ? "Currículo do mentorado"
            : `Documento oficial · ${
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
  // tipo=curriculo: a view mentorados_curriculo (0081) só devolve linha pra
  // coordenação e pro auxiliar executivo que supervisiona uma dupla do
  // jovem — o gate do papel mora no banco, aqui é só o repasse pro signer.
  const { data: doc, error } = tipo === "doc"
    ? await supabase
        .from("documentos_pessoa")
        .select("id, path")
        .eq("id", id)
        .maybeSingle()
    : tipo === "curriculo"
      ? await supabase
          .from("mentorados_curriculo")
          .select("id, curriculo_path")
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
  const path = doc == null
    ? null
    : "path" in doc
      ? doc.path
      : "curriculo_path" in doc
        ? doc.curriculo_path
        : doc.documento_path;
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
