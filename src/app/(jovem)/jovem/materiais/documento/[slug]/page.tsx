import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { materialDocumento } from "@/lib/materiais-documentos";
import {
  carregarDocCorpus,
  corpusServeJovem,
  listarDocsCorpus,
} from "@/lib/materiais/corpus-doc";
import { MaterialDocumento } from "@/components/material-documento";
import { CorpusDocumento } from "@/components/corpus-documento";

// Documento nativo na casa do jovem — o material "doc:<slug>" da audiência
// "todos" abre aqui; a rota de /materiais vive no layout (app), que
// redireciona o papel mentorado. Corpus só entra quando a audiência do
// frontmatter cobre o jovem (todos/mentorado/ausente) — doc de
// staff/mentor cai em notFound como qualquer slug inválido.

export const dynamicParams = false;

// templates do cap. 14 que já viviam nesta rota antes do corpus (o Feedback
// Construtivo saiu: audiência de equipe desde a 0167)
const LEGADO_JOVEM = [
  "mensagem-preparacao",
  "mensagem-indicadas",
  "mensagem-encaminhamento",
];

export async function generateStaticParams() {
  const slugs = new Set<string>(LEGADO_JOVEM);
  for (const d of await listarDocsCorpus()) {
    if (corpusServeJovem(d)) slugs.add(d.slug);
  }
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const corpus = await carregarDocCorpus(slug);
  const doc = corpus ?? materialDocumento(slug);
  return doc ? { title: doc.titulo } : {};
}

export default async function DocumentoJovemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const corpus = await carregarDocCorpus(slug);
  if (corpus) {
    if (!corpusServeJovem(corpus)) notFound();
    return (
      <CorpusDocumento
        doc={corpus}
        voltar={{ href: "/jovem/materiais#acervo", rotulo: "Acervo de materiais" }}
      />
    );
  }
  if (!materialDocumento(slug)) notFound();

  return (
    <MaterialDocumento
      slug={slug}
      voltar={{ href: "/jovem/materiais#acervo", rotulo: "Acervo de materiais" }}
    />
  );
}
