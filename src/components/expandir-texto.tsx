"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** "Ler tudo" decidido por linhas renderizadas, nunca por contagem de
 *  caracteres (REALIZA-438): o gate antigo (`texto.length > N`) ignorava a
 *  largura — em container largo a prévia de 3 linhas já mostrava o texto
 *  inteiro e abrir só deslocava o bloco. Aqui a medida real
 *  (scrollHeight × clientHeight com o clamp ativo) decide se o controle
 *  existe; aberto, o mesmo <p> solta as linhas restantes e o controle fica
 *  no fim do bloco. SSR renderiza clampado e sem botão — nunca um controle
 *  que não funciona (spec 007, D1). */
export function ExpandirTexto({
  children,
  className,
  rotuloMais = "Ler tudo",
  rotuloMenos = "Mostrar menos",
  classNameBotao,
}: {
  children: ReactNode;
  className?: string;
  rotuloMais?: string;
  rotuloMenos?: string;
  classNameBotao?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [transborda, setTransborda] = useState(false);
  const [aberto, setAberto] = useState(false);
  const id = useId();

  useEffect(() => {
    // a medida só vale com o clamp ativo — aberto, scrollHeight === clientHeight
    if (aberto) return;
    const el = ref.current;
    if (!el) return;
    let viva = true;
    const medir = () => {
      if (viva) setTransborda(el.scrollHeight > el.clientHeight + 1);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    // o border-box clampado não muda quando o conteúdo cresce (webfont que
    // chega depois, filho que monta): mutação + fonts.ready cobrem o que a
    // ResizeObserver não enxerga
    const mo = new MutationObserver(medir);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    void document.fonts?.ready.then(medir);
    return () => {
      viva = false;
      ro.disconnect();
      mo.disconnect();
    };
  }, [aberto]);

  return (
    <>
      <p
        ref={ref}
        id={id}
        className={cn(className, !aberto && "line-clamp-3")}
      >
        {children}
      </p>
      {(transborda || aberto) && (
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={id}
          onClick={() => setAberto((v) => !v)}
          className={cn(
            "mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            classNameBotao
          )}
        >
          {aberto ? rotuloMenos : rotuloMais}
          <CaretDown
            size={12}
            aria-hidden
            className={cn("transition-transform", aberto && "rotate-180")}
          />
        </button>
      )}
    </>
  );
}
