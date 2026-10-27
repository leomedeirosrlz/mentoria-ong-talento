"use client";

import Link from "next/link";
import { CaretDown, Check } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GRUPOS_REGISTROS,
  GRUPO_REGISTROS_OPCAO,
  type GrupoRegistros,
} from "@/lib/registros";
import { cn } from "@/lib/utils";

const PILULA =
  "inline-flex min-h-11 items-center rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7";

/** Controle de visualização da lista (não é filtro): no desktop um segmented
 *  compacto de links `?grupo=`; no celular um botão + popover — o segmented
 *  com rótulo não cabe à direita do contador em ~360px. */
export function RegistrosAgrupar({
  grupo,
  hrefs,
}: {
  grupo: GrupoRegistros;
  /** href por eixo — o server preserva todos os params (inclusive ?pagina=):
   *  trocar o agrupamento reorganiza os MESMOS itens, não é um novo filtro. */
  hrefs: Record<GrupoRegistros, string>;
}) {
  return (
    <>
      {/* mobile: botão + popover */}
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "sm:hidden"
          )}
        >
          Agrupar {GRUPO_REGISTROS_OPCAO[grupo]}
          <CaretDown size={14} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <ul aria-label="Agrupar registros">
            {GRUPOS_REGISTROS.map((g) => (
              <li key={g}>
                <Link
                  href={hrefs[g]}
                  scroll={false}
                  aria-current={grupo === g ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    grupo === g
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {GRUPO_REGISTROS_OPCAO[g]}
                  {grupo === g && <Check size={14} aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {/* desktop: segmented — mesma gramática das pills do panorama */}
      <div
        role="group"
        aria-label="Agrupar registros"
        className="hidden items-center gap-x-2.5 sm:flex"
      >
        <span className="text-xs text-muted-foreground">Agrupar:</span>
        <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5">
          {GRUPOS_REGISTROS.map((g) => (
            <Link
              key={g}
              href={hrefs[g]}
              scroll={false}
              aria-current={grupo === g ? "page" : undefined}
              className={cn(
                PILULA,
                grupo === g
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {GRUPO_REGISTROS_OPCAO[g]}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
