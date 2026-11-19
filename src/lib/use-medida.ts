"use client";

import { useCallback, useEffect, useState, type RefCallback } from "react";

/** Mede a largura de layout do slot (offsetWidth — o transform da
 *  animação de entrada não contamina a medida) e devolve o px inteiro.
 *  `fallback` renderiza no primeiro frame/SSR, antes do ResizeObserver
 *  medir; se o nó some do layout (display:none) o último px conhecido
 *  fica, não volta pro fallback. `ref` é callback pra rearmar quando o
 *  nó remonta (mesmo padrão do useFadeX). */
export function useMedida<T extends HTMLElement = HTMLSpanElement>(
  fallback: number
): { ref: RefCallback<T>; px: number } {
  const [el, setEl] = useState<T | null>(null);
  const [px, setPx] = useState(fallback);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.offsetWidth);
      if (w > 0) setPx((p) => (p === w ? p : w));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return { ref, px };
}
