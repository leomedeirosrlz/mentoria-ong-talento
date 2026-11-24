import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { contextoPlano } from "@/lib/plano-servico";
import { getCicloEventos } from "@/lib/queries";
import { getJovemDuplas } from "@/lib/queries-jovem";
import { demoRole } from "@/lib/demo/mode";
import { demoDupla, demoDuplaJovem } from "@/lib/demo/queries";
import { docCombinadoProps } from "@/lib/plano-roteiros-servico";
import { RoteiroDoc } from "@/components/roteiro-doc";
import type { CicloEvento, Dupla } from "@/lib/types";

/** O combinado da dupla do jovem (020) — o mesmo documento da ficha; a
 *  dupla vem da view jovem_duplas (a RLS corta qualquer outra). */

export async function generateMetadata(): Promise<Metadata> {
  return { title: "O combinado" };
}

export default async function JovemCombinadoPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const versao = v != null && /^\d+$/.test(v) ? Number(v) : undefined;

  const duplas = await getJovemDuplas();
  const duplaDpp =
    duplas.find((d) => d.status === "ativa" && d.trilha !== "especialista") ??
    duplas[0] ??
    null;
  if (!duplaDpp?.id) notFound();

  const papelDemo = await demoRole();
  let dupla: Dupla;
  if (papelDemo) {
    const d =
      demoDupla(papelDemo, duplaDpp.id) ??
      demoDuplaJovem(papelDemo, duplaDpp.id);
    if (!d) notFound();
    dupla = d;
  } else {
    const ctx = await contextoPlano(duplaDpp.id, []);
    if ("error" in ctx) notFound();
    dupla = ctx.dupla;
  }

  const eventos = await getCicloEventos().catch(() => [] as CicloEvento[]);
  const doc = await docCombinadoProps(dupla, versao, eventos);
  if (!doc) notFound();

  return (
    <RoteiroDoc
      kicker="Combinado da dupla"
      titulo={doc.titulo}
      destaque="O que vocês combinaram, por escrito. Muda quando a versão muda."
      meta={doc.meta}
      blocos={doc.blocos}
      voltar={{ href: "/jovem/agenda#plano", rotulo: "Voltar pra agenda" }}
    />
  );
}
