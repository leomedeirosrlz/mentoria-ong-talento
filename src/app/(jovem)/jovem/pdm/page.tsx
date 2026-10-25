import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "@phosphor-icons/react/dist/ssr";
import { PdmDupla } from "@/components/pdm-dupla";
import { buttonVariants } from "@/components/ui/button";
import { getMe } from "@/lib/queries";
import { getJovemDuplas } from "@/lib/queries-jovem";
import { getPdmDaDupla } from "@/lib/queries-pdm";

export const metadata: Metadata = { title: "Meu plano de desenvolvimento" };

// /jovem/pdm (REALIZA-181) — o PDM vivo na mão do jovem. Não é um link de
// formulário: é o próprio documento, co-editado por ele e pelo mentor —
// a mesma árvore que a ficha mostra, com os mesmos gestos. A dupla DPP
// viva é a âncora (mesma regra da jornada); sem ela, o caminho é a página
// da jornada, onde as estações explicam o que falta chegar.

export default async function JovemPdm() {
  const [me, duplas] = await Promise.all([getMe(), getJovemDuplas()]);
  if (!me) return null; // o layout já barra — convenção das páginas

  const dupla =
    duplas.find(
      (d) =>
        d.id != null &&
        (d.trilha ?? "dpp") !== "especialista" &&
        (d.status === "ativa" || d.status === "pausada")
    ) ?? null;

  const pdm = dupla?.id ? await getPdmDaDupla(dupla.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/jovem/materiais"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={16} aria-hidden />
          Minha jornada
        </Link>
      </div>

      {dupla?.id && pdm ? (
        <PdmDupla
          duplaId={dupla.id}
          doc={pdm}
          mentoradoNome={me.nome_social || me.nome}
          podeEditar
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Compass size={22} aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">
            Seu plano de desenvolvimento
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            O PDM nasce na jornada com a sua mentora: Declaração de Visão,
            metas e os passos até elas. Quando vocês começarem a construir,
            ele aparece aqui pra vocês editarem juntos.
          </p>
          <Link href="/jovem/materiais" className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-2"}>
            Ver minha jornada
          </Link>
        </div>
      )}
    </div>
  );
}
