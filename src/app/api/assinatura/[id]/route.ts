import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { demoAssinatura } from "@/lib/demo/queries";
import { getAssinatura } from "@/lib/queries-assinaturas";
import { renderDocumentoAssinado } from "@/lib/documentos/pdf";
import { nomeArquivoVia } from "@/lib/documentos/texto";
import type { Assinatura } from "@/lib/types";

// Download da via assinada (termo do voluntário, autorização do responsável):
// o PDF é renderizado sob demanda a partir de dados_snapshot + versão do
// template — não guardamos bytes, guardamos a evidência (0033). A leitura da
// row passa pela RLS (dono ou coordenação); a checagem de dono abaixo é só
// defesa em profundidade dentro do handler.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pdfResponse(pdf: Uint8Array, arquivo: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: abre no navegador (o leigo confere antes de salvar)
      "Content-Disposition": `inline; filename="${arquivo}"`,
      // a via carrega dados civis (RG/CPF/endereço) + evidência — sem cache
      // de disco/heurístico; mesma régua do /api/assinar-token público
      "Cache-Control": "private, no-store",
    },
  });
}

/** O renderer lança em snapshot ausente/incompatível — aqui vira null e a
 *  rota responde 500 (uma row 'assinado' sem snapshot é bug, não 404). */
async function renderSeguro(
  a: Assinatura,
  contra: Uint8Array | null
): Promise<Uint8Array | null> {
  try {
    return await renderDocumentoAssinado(a, contra);
  } catch (e) {
    console.error("renderDocumentoAssinado:", e);
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // modo demo: sem storage — o mesmo renderer monta o PDF a partir do
  // snapshot do dataset; contra-assinatura não existe fora do bucket
  const demo = await demoRole();
  if (demo) {
    const a = demoAssinatura(demo, id);
    if (!a || a.status !== "assinado") {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }
    const pdf = await renderSeguro(a, null);
    if (!pdf) {
      return new NextResponse("Não foi possível gerar o documento.", { status: 500 });
    }
    return pdfResponse(pdf, nomeArquivoVia(a));
  }

  // id cru no eq() — string malformada vira erro PostgREST (500); uuid ruim é 404
  if (!UUID_RE.test(id)) {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout (e redirect de login pra API não ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) {
    return new NextResponse("Sessão expirada — entre de novo.", { status: 401 });
  }

  let a: Assinatura | null;
  try {
    a = await getAssinatura(id);
  } catch {
    return new NextResponse("Não foi possível abrir o documento — tente de novo.", {
      status: 500,
    });
  }
  if (!a || a.status !== "assinado") {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  // a policy assinaturas_select já só devolveu a row se eu for o dono ou a
  // coordenação — confirmamos mesmo assim antes de renderizar a via
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", sub)
    .single();
  if (!eu || (a.profile_id !== eu.id && eu.role !== "coordenacao")) {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  // contra-assinatura do presidente é opcional — sem a imagem o PDF sai só
  // com a linha de assinatura da instituição (a evidência mora na row)
  let contra: Uint8Array | null = null;
  const { data: img } = await supabase.storage
    .from("documentos")
    .download("sistema/contra-assinatura.png");
  if (img) contra = new Uint8Array(await img.arrayBuffer());

  const pdf = await renderSeguro(a, contra);
  if (!pdf) {
    return new NextResponse("Não foi possível gerar o documento.", { status: 500 });
  }
  return pdfResponse(pdf, nomeArquivoVia(a));
}
