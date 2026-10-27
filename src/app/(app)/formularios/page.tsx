import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ListChecks, Plus } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import { getFormularios } from "@/lib/forms/queries";
import {
  SISTEMAS_BORDO,
  SISTEMAS_REGUA,
  type FormularioSistema,
} from "@/lib/forms/schema";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FormulariosLista } from "./formularios-lista";
import { InstrumentosSistemaLista } from "./instrumentos-sistema";

export const metadata: Metadata = { title: "Formulários" };

/** Posição do sistema na régua de bordo — os que não estiverem mapeados
 *  (sistema novo) vão pro fim, ordenados entre si pelo título. */
const ordemBordo = (s: FormularioSistema) => {
  const i = SISTEMAS_BORDO.indexOf(s);
  return i === -1 ? SISTEMAS_BORDO.length : i;
};

export default async function FormulariosPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const formularios = await getFormularios();
  // REALIZA-199 — a lista é só dos forms da coordenação. Os oficiais
  // (`sistema`) saíram daqui: os 5 da régua DPP viraram cards em
  // /materiais ("Instrumentos do programa") e os de bordo — inscrições,
  // avaliação da trilha, desfecho — moram na seção read-only "Instrumentos
  // do sistema" no fim da página.
  const customs = formularios.filter((f) => !f.sistema);
  const bordo = formularios
    .filter((f) => f.sistema && !SISTEMAS_REGUA.includes(f.sistema))
    .sort(
      (a, b) =>
        ordemBordo(a.sistema!) - ordemBordo(b.sistema!) ||
        a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" })
    );

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

      {customs.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <ListChecks size={18} aria-hidden />
          </div>
          <p className="mt-3 font-medium">Nenhum formulário ainda.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie avaliações de encontro, pesquisas ou inscrições. Cada pessoa
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
        <FormulariosLista formularios={customs} />
      )}

      {bordo.length > 0 && <InstrumentosSistemaLista formularios={bordo} />}
    </div>
  );
}
