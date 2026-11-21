"use client";

import { useEffect, useId, useRef } from "react";

/** Um modal aberto = uma entrada empilhada no histórico. O gesto/botão de
 *  voltar fecha o topo em vez de sair da rota. Fechar pela UI desfaz a
 *  entrada empurrada (um `history.back()` silencioso, com o popstate
 *  ignorado para não fechar o modal de baixo).
 *
 *  A pilha é de módulo porque os dialogs não têm um provider comum; o
 *  listener é instalado uma vez. O token do `setTimeout` cobre o replay de
 *  efeitos do StrictMode: o cleanup agenda o back e o setup seguinte cancela
 *  antes de ele rodar. */

type Entrada = {
  id: string;
  rota: string;
  fechar: () => void;
};

const pilha: Entrada[] = [];
const pendentes = new Map<string, symbol>();
let ignorarPop = false;
let ouvindo = false;

function aoVoltar() {
  if (ignorarPop) {
    ignorarPop = false;
    return;
  }
  const topo = pilha[pilha.length - 1];
  if (!topo) return;
  pilha.pop();
  topo.fechar();
}

function garantirOuvinte() {
  if (ouvindo) return;
  ouvindo = true;
  window.addEventListener("popstate", aoVoltar);
}

/** `aberto` controla o ciclo; `fechar` deve fechar o modal (via actions do
 *  Base UI ou o setter do dono). */
export function useFecharNoVoltar(aberto: boolean, fechar: () => void) {
  const id = useId();
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  }, [fechar]);

  useEffect(() => {
    if (!aberto) return;
    const rota = window.location.pathname + window.location.search;
    pilha.push({ id, rota, fechar: () => fecharRef.current() });
    pendentes.delete(id);
    garantirOuvinte();
    // StrictMode: o cleanup do primeiro mount pode ter deixado o marker na
    // pilha sem ter voltado ainda; não empurra outro.
    if (window.history.state?.__modalVoltar !== id) {
      window.history.pushState({ __modalVoltar: id }, "");
    }

    return () => {
      const i = pilha.findIndex((e) => e.id === id);
      if (i < 0) return;
      const eraTopo = i === pilha.length - 1;
      pilha.splice(i, 1);
      if (!eraTopo) return;
      const token = Symbol();
      pendentes.set(id, token);
      setTimeout(() => {
        if (pendentes.get(id) !== token) return;
        pendentes.delete(id);
        const atual = window.location.pathname + window.location.search;
        if (window.history.state?.__modalVoltar === id && atual === rota) {
          ignorarPop = true;
          window.history.back();
        }
      }, 0);
    };
  }, [aberto, id]);
}
