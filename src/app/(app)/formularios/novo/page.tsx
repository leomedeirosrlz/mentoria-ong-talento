import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/queries";
import { VoltarLink } from "@/components/voltar-link";
import { FormularioBuilder } from "../formulario-builder";

export const metadata: Metadata = { title: "Novo formulário" };

export default async function NovoFormularioPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <VoltarLink fallback="/formularios" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Novo formulário
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte as perguntas. Depois de salvar, você gera um link por pessoa
          pra enviar por WhatsApp ou e-mail.
        </p>
      </header>
      <FormularioBuilder />
    </div>
  );
}
