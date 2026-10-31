"use client";

import dynamic from "next/dynamic";

/** RegistroForm (~1,1k linhas) só abre por clique (disclosure do encontro,
 *  modal do follow-up, edição do registro) — o chunk desce sob demanda,
 *  SSR mantido quando ele já nasce aberto (deep link/registro pendente). */
export const RegistroFormLazy = dynamic(() =>
  import("@/components/registro-form").then((m) => m.RegistroForm)
);
