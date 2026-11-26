import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { carregarRoteirosDaDupla } from "@/lib/plano-roteiros-servico";
import { slugRoteiro } from "@/lib/plano-roteiros";
import { carregarDocCorpus } from "@/lib/materiais/corpus-doc";
import { getJovemDuplas } from "@/lib/queries-jovem";
import { RoteiroSemana } from "@/components/roteiro-semana";

/** Roteiro de uma semana do combinado do jovem (020) — a dupla vem da
 *  view jovem_duplas; a RLS e o contextoPlano cortam qualquer outra. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Roteiro do ${numero}º encontro` };
}

export default async function JovemRoteiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { numero: numeroStr } = await params;
  const { v } = await searchParams;
  const numero = Number(numeroStr);
  if (!Number.isInteger(numero) || numero < 1) notFound();

  const duplas = await getJovemDuplas();
  const duplaDpp =
    duplas.find((d) => d.status === "ativa" && d.trilha !== "especialista") ??
    duplas[0] ??
    null;
  if (!duplaDpp?.id) notFound();

  // a rota é do jovem: o lado não se adivinha pelo contexto (na demo ele
  // voltava null e o guia saía com preparação e nota ao mentor)
  const r = await carregarRoteirosDaDupla({
    duplaId: duplaDpp.id,
    lado: "mentorado",
  });
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
      voltarHref="/jovem/agenda#plano"
      tituloDoc={
        (await carregarDocCorpus(slugRoteiro(numero)))?.titulo ??
        `Roteiro do ${numero}º encontro`
      }
    />
  );
}
