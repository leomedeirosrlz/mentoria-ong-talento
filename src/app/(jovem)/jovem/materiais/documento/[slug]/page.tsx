import { notFound } from "next/navigation";
import { materialDocumento } from "@/lib/materiais-documentos";
import { MaterialDocumento } from "@/components/material-documento";

// Documento nativo na casa do jovem — o material "doc:<slug>" da audiência
// "todos" abre aqui; a rota de /materiais vive no layout (app), que
// redireciona o papel mentorado.

export function generateStaticParams() {
  return [
    { slug: "feedback-construtivo" },
    { slug: "mensagem-preparacao" },
    { slug: "mensagem-indicadas" },
    { slug: "mensagem-encaminhamento" },
  ];
}

export default async function DocumentoJovemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!materialDocumento(slug)) notFound();

  return (
    <MaterialDocumento
      slug={slug}
      voltar={{ href: "/jovem/materiais#acervo", rotulo: "Acervo de materiais" }}
    />
  );
}
