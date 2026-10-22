import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoFormularios } from "@/lib/demo/forms-data";
import { demoPdf } from "@/lib/demo/pdf";
import { apiErro } from "@/lib/api-erro";

// Download de anexo de inscrição (REALIZA-70): currículo, RG, comprovante
// e foto vivem no bucket privado `form-anexos`. A row de metadados só é
// legível pela coordenação (RLS, 0115) — quem não é coord nem descobre o
// path. O objeto sai por signed URL de 5 min, mesmo padrão dos anexos de
// registro e dos materiais.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // modo demo: os anexos do fixture são fictícios — PDF placeholder com o
  // nome do arquivo, igual /api/anexo
  const demo = await demoRole();
  if (demo) {
    const a = (getDemoFormularios().anexos ?? []).find((x) => x.id === id);
    if (!a) {
      return apiErro("Anexo não encontrado.", { status: 404 });
    }
    const pdf = demoPdf(
      a.nome,
      "Documento de exemplo · formulário de inscrição (dados fictícios)."
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="demo-form-anexo.pdf"',
      },
    });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }
  const supabase = await createClient();

  // middleware já protege /api/*; checagem extra porque route handler não
  // passa pelo layout — e aqui explicitamos o papel: documento de intake
  // é coord-only por definição (LGPD), não "quem está logado"
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return apiErro("Sessão expirada. Entre de novo.", {
      status: 401,
      acao: { href: "/login", label: "Ir para o login" },
    });
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .maybeSingle();
  if (me?.role !== "coordenacao") {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }

  const { data: anexo, error } = await supabase
    .from("formulario_anexos")
    .select("id, path")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return apiErro("Não foi possível abrir o anexo. Tente de novo.", {
      status: 500,
      acao: { href: `/api/form-anexo/${id}`, label: "Tentar de novo" },
    });
  }
  if (!anexo) {
    return apiErro("Anexo não encontrado.", { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("form-anexos")
    .createSignedUrl(anexo.path, 300);
  if (signError || !signed?.signedUrl) {
    return apiErro("Não foi possível abrir o anexo.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
