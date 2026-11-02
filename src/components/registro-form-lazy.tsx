"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** RegistroForm (~1,1k linhas) só abre por clique (disclosure do encontro,
 *  modal do follow-up, edição do registro) — o chunk desce sob demanda,
 *  SSR mantido quando ele já nasce aberto (deep link/registro pendente). */
export const RegistroFormLazy = dynamic(
  () => import("@/components/registro-form").then((m) => m.RegistroForm),
  // o `loading` é o que dá ao dynamic um Suspense próprio (o Next 16 só cria
  // a boundary com ssr:false ou loading) — sem ele o chunk suspendia até o
  // <Suspense> da aba na ficha, que escondia a aba inteira e, ao reexibir,
  // fechava o registro que o mentor tinha acabado de abrir pra editar
  { loading: () => <Skeleton className="h-40 w-full" /> }
);
