"use client";

import Link from "next/link";
import { Lifebuoy } from "@phosphor-icons/react";
import type { ChamadoFilaItem } from "@/lib/types";
import { CHAMADO_CATEGORIA_LABEL } from "@/lib/ciclo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ChamadoStatusBadge } from "@/components/chamados-app";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "@phosphor-icons/react";

/** Card "Meus chamados" na home do mentor (DPP e especialista) — resumo dos
 *  pedidos abertos + atalhos pra fila completa e pra abrir um novo. */
export function MeusChamadosCard({
  chamados,
  duplas,
  papel,
}: {
  chamados: ChamadoFilaItem[];
  duplas: { id: string; label: string }[];
  papel: string;
}) {
  const abertos = chamados.filter((c) => c.status !== "resolvido");
  return (
    <section aria-labelledby="meus-chamados-titulo">
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/25 text-foreground">
              <Lifebuoy size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <h2 id="meus-chamados-titulo" className="font-semibold">
                Meus chamados
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {abertos.length
                  ? `${abertos.length} em andamento. A equipe responde por lá.`
                  : "Nenhum pedido em andamento."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <NovoChamadoDialog
                papel={papel}
                duplas={duplas}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus size={15} aria-hidden />
                    Novo pedido
                  </Button>
                }
              />
              {chamados.length > 0 && (
                <Link
                  href="/chamados"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Ver todos
                </Link>
              )}
            </div>
          </div>
          {abertos.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
              {abertos.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/chamados?c=${c.id}`}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.numero}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.assunto}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {CHAMADO_CATEGORIA_LABEL[c.categoria]}
                    </Badge>
                    <ChamadoStatusBadge
                      status={c.status}
                      dono={c.atribuido_nome}
                      visao="autor"
                      className="shrink-0 text-[10px]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
