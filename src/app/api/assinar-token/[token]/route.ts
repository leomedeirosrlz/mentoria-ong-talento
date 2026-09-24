import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { demoAssinaturaCompletaPorToken } from "@/lib/demo/queries";
import { renderDocumentoAssinado } from "@/lib/documentos/pdf";
import { nomeArquivoVia } from "@/lib/documentos/texto";
import type { Assinatura } from "@/lib/types";

// Via assinada do documento, por token — o "download" do fluxo sem login.
// Depois de assinada, a própria URL /assinar/<token> aponta pra cá; o token é
// o fator de posse (o RPC só devolve a row com status='assinado', então uma
// pendência nunca vaza dados civis por aqui).

const TOKEN_RE = /^[0-9a-f-]{36}$/;

function pdfResponse(pdf: Uint8Array, arquivo: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: abre no navegador (o leigo confere antes de salvar)
      "Content-Disposition": `inline; filename="${arquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) {
    return new NextResponse("Link inválido.", { status: 400 });
  }

  // modo demo: mesmo contrato da RPC — a via só existe depois de assinada
  if (await demoRole()) {
    const a = demoAssinaturaCompletaPorToken(token);
    if (!a) {
      return new NextResponse("Documento não encontrado — a assinatura ainda não foi concluída.", {
        status: 404,
      });
    }
    return pdfResponse(await renderDocumentoAssinado(a, null), nomeArquivoVia(a));
  }

  const supabase = await createClient();
  // RPC security definer executável por anon — sem sessão mesmo
  const { data, error } = await supabase.rpc("assinatura_completa_por_token", {
    p_token: token,
  });
  if (error) {
    return new NextResponse("Não foi possível abrir o documento — tente de novo.", {
      status: 500,
    });
  }
  // 0051: a RPC devolve o objeto único (row + template embutido) ou null
  const assinatura = (data ?? null) as Assinatura | null;
  if (!assinatura) {
    return new NextResponse("Documento não encontrado — a assinatura ainda não foi concluída.", {
      status: 404,
    });
  }

  // contra-assinatura do presidente (bucket `documentos`, prefixo sistema/) —
  // a autorização não usa a imagem, mas o parâmetro é do contrato do render;
  // se o storage falhar, o PDF sai sem ela em vez de derrubar o download
  const { data: png } = await supabase.storage
    .from("documentos")
    .download("sistema/contra-assinatura.png");
  const contra = png ? new Uint8Array(await png.arrayBuffer()) : null;

  return pdfResponse(
    await renderDocumentoAssinado(assinatura, contra),
    nomeArquivoVia(assinatura)
  );
}
