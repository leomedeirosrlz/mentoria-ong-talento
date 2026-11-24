import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { carregarRoteirosDaDupla } from "@/lib/plano-roteiros-servico";
import { slugRoteiro } from "@/lib/plano-roteiros";
import { carregarDocCorpus } from "@/lib/materiais/corpus-doc";
import { RoteiroSemana } from "@/components/roteiro-semana";

/** Roteiro de uma semana do combinado (020) — casa do staff e do mentor;
 *  o jovem lê o dele em /jovem/roteiro (a RLS corta a dupla errada). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Roteiro do ${numero}º encontro` };
}

export default async function RoteiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; numero: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id, numero: numeroStr } = await params;
  const { v } = await searchParams;
  const numero = Number(numeroStr);
  if (!Number.isInteger(numero) || numero < 1) notFound();

  const r = await carregarRoteirosDaDupla({ duplaId: id });
  if ("error" in r) notFound();

  return (
    <RoteiroSemana
      numero={numero}
      versaoPedida={v}
      dupla={r.dupla}
      plano={r.plano}
      roteiros={r.roteiros}
      autores={r.autores}
      eventos={r.eventos}
      lado={r.lado}
      voltarHref={`/duplas/${id}#acordos`}
      tituloDoc={
        (await carregarDocCorpus(slugRoteiro(numero)))?.titulo ??
        `Roteiro do ${numero}º encontro`
      }
    />
  );
}
