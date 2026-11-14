import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  carregarDocCorpus,
  corpusServeJovem,
  listarDocsCorpus,
} from "@/lib/materiais/corpus-doc";
import { CorpusDocumento } from "@/components/corpus-documento";

// Documento do corpus na casa do jovem — só entra quando a audiência do
// frontmatter cobre o jovem (todos/mentorado/ausente). Doc de staff/mentor
// cai em notFound como qualquer slug inválido: é o caso dos templates do
// cap. 14 (audiência de equipe) e do Feedback Construtivo (0167), que já
// viveram aqui como documentos nativos antes do corpus.

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = new Set<string>();
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
  return corpus && corpusServeJovem(corpus) ? { title: corpus.titulo } : {};
}

export default async function DocumentoJovemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const corpus = await carregarDocCorpus(slug);
  if (!corpus || !corpusServeJovem(corpus)) notFound();

  return (
    <CorpusDocumento
      doc={corpus}
      voltar={{ href: "/jovem/materiais#acervo", rotulo: "Acervo de materiais" }}
      // ponte doc → instrumento (REALIZA-386): nos docs de instrumento
      // que servem o jovem, o destino ao vivo dele é a estante da jornada
      ponte={{
        href: "/jovem/materiais#jornada",
        rotulo: "Abrir na jornada",
        dica: "O instrumento mora na sua jornada e abre no encontro certo.",
      }}
    />
  );
}
