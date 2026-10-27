import { notFound } from "next/navigation";
import { materialDocumento } from "@/lib/materiais-documentos";
import { MaterialDocumento } from "@/components/material-documento";

// Documento nativo de /materiais — casa do staff e do mentor; o jovem tem a
// rota própria em /jovem/materiais/documento (o layout (app) o redireciona
// pra /jovem). O renderer é compartilhado (MaterialDocumento).

export function generateStaticParams() {
  return [
    { slug: "feedback-construtivo" },
    { slug: "mensagem-preparacao" },
    { slug: "mensagem-indicadas" },
    { slug: "mensagem-encaminhamento" },
  ];
}

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!materialDocumento(slug)) notFound();

  return (
    <MaterialDocumento
      slug={slug}
      voltar={{ href: "/materiais?aba=biblioteca", rotulo: "Biblioteca de materiais" }}
    />
  );
}
