import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { DocumentoHero, DocBlocos } from "./material-documento";
import type { DocBloco } from "@/lib/materiais-documentos";

/** Leitura de um documento do plano (roteiro semanal ou o combinado) —
 *  o mesmo corpo de doc dos materiais (DocumentoHero + DocBlocos), sem
 *  sumário lateral: os docs gerados são de uma tela só. */
export function RoteiroDoc({
  kicker,
  titulo,
  destaque,
  meta,
  blocos,
  voltar,
  children,
}: {
  kicker: string;
  titulo: string;
  destaque?: ReactNode;
  meta?: ReactNode;
  blocos: DocBloco[];
  voltar: { href: string; rotulo: string };
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <Link
        href={voltar.href}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
      >
        <ArrowLeft size={14} aria-hidden />
        {voltar.rotulo}
      </Link>
      <DocumentoHero
        kicker={kicker}
        titulo={titulo}
        destaque={destaque}
        meta={meta}
      />
      {children}
      <DocBlocos blocos={blocos} tom="lima" />
    </div>
  );
}
