"use client";

import dynamic from "next/dynamic";

// Painéis pesados da ficha da dupla — cada um vira chunk sob demanda:
// a negociação só aparece com pedido aberto, os três da aba Instrumentos
// só quando ela está ativa. SSR mantido.

export const SolicitacaoNegociacao = dynamic(() =>
  import("@/components/solicitacao-negociacao").then(
    (m) => m.SolicitacaoNegociacao
  )
);

export const InstrumentosDupla = dynamic(() =>
  import("./instrumentos-dupla").then((m) => m.InstrumentosDupla)
);

export const PdmDupla = dynamic(() =>
  import("@/components/pdm-dupla").then((m) => m.PdmDupla)
);

export const TerceirosDupla = dynamic(() =>
  import("./terceiros-dupla").then((m) => m.TerceirosDupla)
);
