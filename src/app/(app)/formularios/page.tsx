import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ListChecks, Plus } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import { getFormularios } from "@/lib/forms/queries";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FormulariosLista } from "./formularios-lista";

export const metadata: Metadata = { title: "Formulários" };

export default async function FormulariosPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const formularios = await getFormularios();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Instrumentos"
        title="Formulários"
        meta="Avaliações, pesquisas e fichas respondidas por link, sem login"
        actions={
          <Link
            href="/formularios/novo"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Plus aria-hidden />
            Novo formulário
          </Link>
        }
      />

      {formularios.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <ListChecks size={18} aria-hidden />
          </div>
          <p className="mt-3 font-medium">Nenhum formulário ainda.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie avaliações de encontro, anamneses ou inscrições. Cada pessoa
            responde por um link próprio, sem precisar de conta.
          </p>
          <Link
            href="/formularios/novo"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-4"}
          >
            <Plus aria-hidden />
            Criar o primeiro
          </Link>
        </div>
      ) : (
        // filtro e ordenação são client-side — a lista inteira já está aqui
        <FormulariosLista formularios={formularios} />
      )}
    </div>
  );
}
