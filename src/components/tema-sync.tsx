"use client";

import { useEffect } from "react";

/** Seguidor do tema "auto" em runtime (REALIZA-192): o script inline do
 *  <head> resolve a primeira pintura; este vigia o SO depois disso — com
 *  o SO mudando pra dark e a preferência em "auto", a página acompanha
 *  sem reload. Tema explícito (claro/escuro) ignora o SO de propósito. */
export function TemaSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const d = document.documentElement;
      if (d.getAttribute("data-tema") !== "auto") return;
      d.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return null;
}
