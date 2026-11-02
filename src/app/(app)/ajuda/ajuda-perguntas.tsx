"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CaretDown,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { buscarPerguntas } from "@/lib/ajuda/filtrar";
import { TEMAS_AJUDA, type PerguntaAjuda } from "@/lib/ajuda/conteudo";
import { normaliza } from "@/lib/utils";

/** FAQ da Ajuda: busca client-side sobre pergunta+resposta (acentos e caixa
 *  fora do caminho via normaliza) e agrupamento por tema. Cada item é um
 *  <details> nativo, a gramática do "Como conduzir" da agenda. Com busca
 *  ativa os disclosures já nascem abertos — a resposta é o que costuma
 *  carregar o termo. */
export function AjudaPerguntas({ perguntas }: { perguntas: PerguntaAjuda[] }) {
  const [busca, setBusca] = useState("");
  const q = normaliza(busca.trim());
  const visiveis = useMemo(
    () => buscarPerguntas(perguntas, busca),
    [perguntas, busca]
  );

  return (
    <section className="space-y-4">
      <label className="relative block w-full sm:max-w-sm">
        <span className="sr-only">Buscar nas perguntas</span>
        <MagnifyingGlass
          size={15}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nas perguntas"
          className="pl-8"
        />
      </label>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma pergunta com “{busca.trim()}”.
        </p>
      ) : (
        // re-key na busca: as seções remontam e a entrada anima (convenção
        // de movimento — troca de filtro nunca é repaint seco)
        <div key={q} className="space-y-5">
          {TEMAS_AJUDA.map(({ id, rotulo }) => {
            const itens = visiveis.filter((p) => p.tema === id);
            if (itens.length === 0) return null;
            return (
              <section key={id} aria-labelledby={`ajuda-tema-${id}`}>
                <h2
                  id={`ajuda-tema-${id}`}
                  className="mb-2 text-base font-semibold"
                >
                  {rotulo}
                  <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                    {itens.length}
                  </span>
                </h2>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-border)]">
                  {itens.map((p, i) => (
                    <li
                      key={p.id}
                      className="animate-enter"
                      style={{ "--i": Math.min(i, 10) } as CSSProperties}
                    >
                      <details
                        className="group rounded-lg transition-colors hover:bg-muted/40"
                        open={q !== ""}
                      >
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                          <CaretDown
                            aria-hidden
                            size={14}
                            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                          />
                          {p.pergunta}
                        </summary>
                        <div className="px-3 pb-3 pl-9">
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {p.resposta}
                          </p>
                          {p.links && p.links.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                              {p.links.map((l) => (
                                <li key={`${l.rotulo}-${l.href}`}>
                                  <Link
                                    href={l.href}
                                    className="group inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {l.rotulo}
                                    <ArrowRight
                                      aria-hidden
                                      size={12}
                                      className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                    />
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
