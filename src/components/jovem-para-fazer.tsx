"use client";

import Link from "next/link";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  ListChecks,
  Star,
} from "@phosphor-icons/react";
import { formatDiaMes } from "@/lib/ciclo";
import {
  AvaliarPendenteButton,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** "Para fazer agora" do jovem: no máximo dois itens. O primeiro junta as
 *  avaliações pendentes num só (a mais recente aparece; as outras abrem em
 *  "e mais N"). O segundo é o combinado aberto com o prazo mais próximo. */
export function JovemParaFazer({
  pendentes,
  combinado,
  hoje,
  primeiroNome,
}: {
  pendentes: AvaliacaoPendente[];
  combinado: { id: string; descricao: string; prazo: string | null } | null;
  /** "YYYY-MM-DD" no fuso do programa, vindo do server. */
  hoje: string;
  primeiroNome: string;
}) {
  const ordenadas = [...pendentes].sort(
    (a, b) =>
      (Date.parse(b.realizado_em ?? "") || 0) -
      (Date.parse(a.realizado_em ?? "") || 0)
  );
  const [maisRecente, ...outras] = ordenadas;
  const vazio = !maisRecente && !combinado;

  return (
    <section aria-labelledby="fazer-titulo" className="space-y-3">
      <h2 id="fazer-titulo" className="font-semibold">
        Para fazer agora
      </h2>
      <Card className="animate-enter" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {maisRecente && (
              <li className="px-5 py-2.5">
                <Collapsible.Root>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/20 text-foreground">
                      <Star size={16} aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      Avaliar {artigo(maisRecente.trilha)} {maisRecente.rotulo ?? `${maisRecente.numero}º encontro`}
                    </p>
                    <AvaliarPendenteButton
                      pendente={maisRecente}
                      primeiroNome={primeiroNome}
                      variant="outline"
                    />
                  </div>
                  {outras.length > 0 && (
                    <Collapsible.Trigger className="group ml-12 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                      e mais {outras.length}
                      <CaretDown
                        size={14}
                        aria-hidden
                        className="transition-transform group-aria-expanded:rotate-180"
                      />
                    </Collapsible.Trigger>
                  )}
                  {outras.length > 0 && (
                    <Collapsible.Panel>
                      <ul className="ml-12 mt-1 divide-y divide-border/60 border-t border-border/60">
                        {outras.map((p) => (
                          <li
                            key={p.encontroId}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                {p.rotulo ?? `${p.numero}º encontro`}
                              </p>
                              {p.realizado_em && (
                                <p className="text-xs text-muted-foreground">
                                  {formatDiaMes(p.realizado_em)}
                                </p>
                              )}
                            </div>
                            <AvaliarPendenteButton
                              pendente={p}
                              primeiroNome={primeiroNome}
                              variant="outline"
                            />
                          </li>
                        ))}
                      </ul>
                    </Collapsible.Panel>
                  )}
                </Collapsible.Root>
              </li>
            )}

            {combinado && (
              <li className="px-5 py-2.5">
                <CombinadoLinha combinado={combinado} hoje={hoje} />
              </li>
            )}

            {vazio && (
              <li className="flex items-center gap-3 px-5 py-3.5 text-sm text-muted-foreground">
                <CheckCircle
                  size={18}
                  weight="fill"
                  className="shrink-0 text-[var(--ok-text)]"
                  aria-hidden
                />
                Nada pendente por agora. Bom trabalho!
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function artigo(trilha: string): string {
  return trilha === "especialista" ? "a" : "o";
}

function CombinadoLinha({
  combinado,
  hoje,
}: {
  combinado: { descricao: string; prazo: string | null };
  hoje: string;
}) {
  const vencido = combinado.prazo != null && combinado.prazo < hoje;
  return (
    <Link
      href="#combinados-titulo"
      className="group flex min-h-11 items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <ListChecks size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium">
          Combinado: {combinado.descricao}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-xs",
            vencido
              ? "font-medium text-[var(--warn-text)]"
              : "text-muted-foreground"
          )}
        >
          {combinado.prazo
            ? `até ${formatDiaMes(combinado.prazo).slice(0, 5)}${vencido ? " · passou do prazo, vale fazer mesmo assim" : ""}`
            : "sem prazo"}
        </span>
      </span>
      <ArrowRight
        size={16}
        aria-hidden
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
