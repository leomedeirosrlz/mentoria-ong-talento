import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { contextoPlano } from "@/lib/plano-servico";
import { getCicloEventos } from "@/lib/queries";
import { demoRole } from "@/lib/demo/mode";
import { demoDupla } from "@/lib/demo/queries";
import { docCombinadoProps } from "@/lib/plano-roteiros-servico";
import { RoteiroDoc } from "@/components/roteiro-doc";
import type { CicloEvento, Dupla } from "@/lib/types";

/** O documento do combinado (020, FR-001): render determinístico do
 *  escopo persistido — muda quando a versão muda, mesmo antes do aceite.
 *  `?v=N` lê uma versão fechada; sem parâmetro vale o plano em aberto. */

export async function generateMetadata(): Promise<Metadata> {
  return { title: "O combinado" };
}

export default async function CombinadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  const versao = v != null && /^\d+$/.test(v) ? Number(v) : undefined;

  const papelDemo = await demoRole();
  let dupla: Dupla;
  if (papelDemo) {
    const d = demoDupla(papelDemo, id);
    if (!d) notFound();
    dupla = d;
  } else {
    const ctx = await contextoPlano(id, []);
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
      destaque="O que a dupla combinou, por escrito. Muda quando a versão muda."
      meta={doc.meta}
      blocos={doc.blocos}
      voltar={{ href: `/duplas/${id}#acordos`, rotulo: "Voltar pra ficha" }}
    />
  );
}
