"use client";

import dynamic from "next/dynamic";

/** AgendaCalendario (~5,1k linhas) fora do chunk de /agenda: a aba inicial
 *  de cada papel (monitoramento/turma/minha/especialista) não o usa — só
 *  quem abre "Calendário" (ou cai via ?dia=/?jw=) baixa. SSR mantido. */
export const AgendaCalendarioLazy = dynamic(() =>
  import("@/components/agenda-calendario").then((m) => m.AgendaCalendario)
);
