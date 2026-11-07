"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Lifebuoy } from "@phosphor-icons/react";
import type { ChamadoFilaItem, ChamadoTimelineItem, Profile } from "@/lib/types";
import { CHAMADO_CATEGORIA_LABEL } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { ChamadoDetalhe } from "@/components/chamado-detalhe";
import { ChamadoStatusBadge, UrgenciaMarca, relTempo } from "@/components/chamados-shared";

/** "Meus pedidos" do jovem dentro do perfil (0084): os chamados dele com a
 *  conversa pública — sem comentário interno, sem nome de quem respondeu,
 *  sem existir na fila do mentor. A ação de abrir fica na home dele. */
export function JovemChamados({
  itens,
  detalhe,
  meuId,
  meuNome,
  cSel,
}: {
  itens: ChamadoFilaItem[];
  detalhe: {
    chamado: ChamadoFilaItem;
    timeline: ChamadoTimelineItem[];
    equipe: Pick<Profile, "id" | "nome" | "nome_social" | "role">[];
  } | null;
  meuId: string;
  meuNome: string;
  cSel: string | null;
}) {
  const router = useRouter();
  return (
    <section
      aria-labelledby="jovem-chamados-titulo"
      className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)]/30 text-foreground">
          <Lifebuoy size={17} aria-hidden />
        </span>
        <div>
          <h2 id="jovem-chamados-titulo" className="text-sm font-semibold">
            Meus pedidos de ajuda
          </h2>
          <p className="text-xs text-muted-foreground">
            O que você pediu e o que a equipe respondeu. Só você e a equipe veem.
          </p>
        </div>
      </div>

      {detalhe && cSel === detalhe.chamado.id ? (
        <div className="mt-4">
          <ChamadoDetalhe
            key={detalhe.chamado.id}
            papel="mentorado"
            meuId={meuId}
            meuNome={meuNome}
            chamado={detalhe.chamado}
            timeline={detalhe.timeline}
            equipe={detalhe.equipe}
            onVoltar={() => router.push("/jovem/perfil")}
            // aqui o detalhe substitui a lista — o voltar precisa existir
            // no desktop também, senão não há caminho de volta
            voltarDesktop
          />
        </div>
      ) : itens.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Você ainda não pediu ajuda por aqui. Quando precisar, é o botão
          “Pedir ajuda” da sua home.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {itens.map((c, i) => (
            <li
              key={c.id}
              className="animate-enter min-w-0"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              {/* mesma linha de duas linhas da fila: assunto em cima,
                  contexto+tempo e o status embaixo. O contexto do jovem é
                  a categoria — o "dupla de" da fila repetiria o nome dele.
                  O número CHA não aparece: é ruído de protocolo */}
              <Link
                href={`/jovem/perfil?c=${c.id}`}
                aria-current={cSel === c.id ? "true" : undefined}
                className={cn(
                  "block min-h-11 rounded-xl border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  cSel === c.id
                    ? "border-foreground/25 bg-muted/70"
                    : "border-transparent bg-card shadow-[var(--shadow-border)] hover:bg-muted/40"
                )}
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                    {c.assunto}
                  </p>
                  {c.categoria === "urgencia" && (
                    <UrgenciaMarca className="mt-px" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {[CHAMADO_CATEGORIA_LABEL[c.categoria], relTempo(c.updated_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <ChamadoStatusBadge
                    status={c.status}
                    dono={c.atribuido_nome}
                    visao="autor"
                    className="shrink-0"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
