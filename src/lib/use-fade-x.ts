"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type RefCallback,
} from "react";

/** Fade lateral de scrollport horizontal (extraído da TrilhaJornada): a
 *  máscara só existe quando há overflow de fato e só na ponta com conteúdo
 *  escondido — esquerda quando já rolou (scrollLeft > 1), direita quando
 *  falta rolar. Sem overflow, sem máscara: as pontas não esmaecem à toa.
 *
 *  `ref` é callback (não RefObject) pra rearmar quando o scrollport monta
 *  depois do hook — rail/tablist condicional. `maskStyle` vai no `style`
 *  dele e só troca ao cruzar uma borda — 4 estados, sem re-render a cada
 *  pixel de scroll. `el` expõe o nó pra quem já lia ref.current. */
export function useFadeX<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefCallback<T>;
  el: T | null;
  maskStyle: CSSProperties;
} {
  const [el, setEl] = useState<T | null>(null);
  const [maskStyle, setMaskStyle] = useState<CSSProperties>({});
  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const aplicar = () => {
      const rola = el.scrollWidth > el.clientWidth + 1;
      const esq = rola && el.scrollLeft > 1;
      const dir =
        rola && el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      const grad =
        esq && dir
          ? "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)"
          : esq
            ? "linear-gradient(to right, transparent, black 20px, black)"
            : dir
              ? "linear-gradient(to right, black calc(100% - 20px), transparent)"
              : null;
      setMaskStyle((prev) =>
        prev.maskImage === (grad ?? undefined)
          ? prev
          : grad
            ? { WebkitMaskImage: grad, maskImage: grad }
            : {}
      );
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(el);
    // o conteúdo muda sem o scrollport mudar de tamanho (chip que some,
    // item que chega): observa o filho que dita o scrollWidth + mutações
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const mo = new MutationObserver(aplicar);
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener("scroll", aplicar, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", aplicar);
    };
  }, [el]);

  return { ref, el, maskStyle };
}
