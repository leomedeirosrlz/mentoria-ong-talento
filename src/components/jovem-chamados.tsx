"use client";

import { useRouter } from "next/navigation";
import { CaretRight, Lifebuoy } from "@phosphor-icons/react";
import type { ChamadoFilaItem, ChamadoTimelineItem, Profile } from "@/lib/types";
import {
  CHAMADO_CATEGORIA_LABEL,
  formatDiaMes,
} from "@/lib/ciclo";
import {
  ChamadoDetalhe,
  ChamadoStatusBadge,
} from "@/components/chamados-app";

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
          {itens.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => router.push(`/jovem/perfil?c=${c.id}`)}
                aria-current={cSel === c.id ? "true" : undefined}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.numero}
                    </span>
                    <ChamadoStatusBadge
                      status={c.status}
                      dono={c.atribuido_nome}
                      visao="autor"
                      className="text-[10px]"
                    />
                    <span className="text-xs text-muted-foreground">
                      {CHAMADO_CATEGORIA_LABEL[c.categoria]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm">{c.assunto}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {formatDiaMes(c.created_at)}
                  <CaretRight size={13} aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
