import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ArrowRight, ListChecks, Plus } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import { getFormularios } from "@/lib/forms/queries";
import { SISTEMA_LABEL } from "@/lib/forms/schema";
import { formatDate } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

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
        <ul className="space-y-3">
          {formularios.map((f, i) => (
            <li
              key={f.id}
              className="animate-enter"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <Link
                href={`/formularios/${f.id}`}
                className={cn(
                  "group block rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)] sm:px-5",
                  // encerrado é histórico — sai do foco visual sem sumir
                  !f.ativo && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium leading-snug">{f.titulo}</h2>
                      {f.sistema && (
                        <Badge
                          variant="outline"
                          className="border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
                        >
                          oficial · {SISTEMA_LABEL[f.sistema]}
                        </Badge>
                      )}
                      {!f.ativo && (
                        <Badge variant="secondary">Encerrado</Badge>
                      )}
                    </div>
                    {f.descricao && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {f.descricao}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    size={16}
                    aria-hidden
                    className="mt-1 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                {/* meta sem contagens zeradas — zero não informa nada e
                    "nenhum link" ganha warn porque é o próximo passo */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {f.campos.length}{" "}
                  {f.campos.length === 1 ? "pergunta" : "perguntas"}
                  {" · "}
                  {f.linksTotal === 0 ? (
                    <span className="font-medium text-[var(--warn-text)]">
                      nenhum link gerado ainda
                    </span>
                  ) : (
                    <>
                      {f.linksTotal} {f.linksTotal === 1 ? "link" : "links"}
                    </>
                  )}
                  {/* encerrado torna o pendente inacionável — sem warn */}
                  {f.pendentes > 0 && (
                    <>
                      {" · "}
                      <span
                        className={
                          f.ativo
                            ? "font-medium text-[var(--warn-text)]"
                            : undefined
                        }
                      >
                        {f.pendentes}{" "}
                        {f.pendentes === 1 ? "pendente" : "pendentes"}
                      </span>
                    </>
                  )}
                  {f.respondidos > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-[var(--ok-text)]">
                        {f.respondidos}{" "}
                        {f.respondidos === 1 ? "resposta" : "respostas"}
                      </span>
                    </>
                  )}
                  {" · "}
                  {f.ultimaResposta
                    ? `última resposta em ${formatDate(f.ultimaResposta)}`
                    : `criado em ${formatDate(f.created_at)}`}
                  {f.versao > 1 && ` · v${f.versao}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
