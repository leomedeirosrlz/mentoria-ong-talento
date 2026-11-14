import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  MATERIAIS_DOCUMENTOS,
  materialDocumento,
} from "@/lib/materiais-documentos";
import {
  carregarDocCorpus,
  corpusServePapel,
  listarDocsCorpus,
} from "@/lib/materiais/corpus-doc";
import { getMe } from "@/lib/queries";
import { MaterialDocumento } from "@/components/material-documento";
import { CorpusDocumento } from "@/components/corpus-documento";

// Documento nativo de /materiais — casa do staff e do mentor; o jovem tem a
// rota própria em /jovem/materiais/documento (o layout (app) o redireciona
// pra /jovem). Slug de corpus (docs/rag/*.md, material do frontmatter)
// renderiza o guia nativo com âncoras por seção (CorpusDocumento); slug dos
// templates do cap. 14 segue no renderer original (MaterialDocumento).
// dynamicParams=false: slug fora dos dois conjuntos 404 sem tocar o fs.
// A audiência do frontmatter vale aqui também (corpusServePapel = mesma
// regra do catálogo): doc de coordenação não abre pra mentor.

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = new Set<string>(Object.keys(MATERIAIS_DOCUMENTOS));
  for (const d of await listarDocsCorpus()) slugs.add(d.slug);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = (await carregarDocCorpus(slug)) ?? materialDocumento(slug);
  return doc ? { title: doc.titulo } : {};
}

export default async function DocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dupla?: string }>;
}) {
  const [{ slug }, { dupla: duplaParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  // ?dupla=<id> vem dos links da ficha — o "Abrir instrumento" volta pra
  // ela; sem contexto (biblioteca, catálogo) aponta a régua de /materiais
  const duplaId =
    duplaParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      duplaParam
    )
      ? duplaParam
      : null;
  const corpus = await carregarDocCorpus(slug);
  if (corpus) {
    // getMe é React.cache — o layout já a chamou neste request (cache hit)
    if (!corpusServePapel(corpus, await getMe())) notFound();
    return (
      <CorpusDocumento
        doc={corpus}
        voltar={{ href: "/materiais?aba=biblioteca", rotulo: "Materiais de apoio" }}
        ponte={
          duplaId
            ? {
                href: `/duplas/${duplaId}?aba=instrumentos#instrumentos`,
                rotulo: "Abrir instrumento",
                dica: "Este guia acompanha o instrumento ao vivo, emitido e acompanhado na ficha da dupla.",
              }
            : {
                href: "/materiais?aba=instrumentos",
                rotulo: "Ver instrumentos",
                dica: "Instrumento oficial do programa. O mentor emite o link na ficha da dupla e o resultado volta estruturado.",
              }
        }
      />
    );
  }
  if (!materialDocumento(slug)) notFound();

  return (
    <MaterialDocumento
      slug={slug}
      voltar={{ href: "/materiais?aba=biblioteca", rotulo: "Materiais de apoio" }}
    />
  );
}
