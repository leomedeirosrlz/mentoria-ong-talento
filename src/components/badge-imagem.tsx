"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A ilustração da conquista (public/badges) com o emblema squircle de
 *  reserva: arquivo que não carrega troca pelo `fallback` no mesmo box,
 *  sem quebrar a estante. Decorativa — nome e estado moram no texto. */
export function BadgeImagem({
  src,
  size,
  fallback,
  className,
}: {
  src: string;
  size: number;
  fallback: ReactNode;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  // erro pré-hidratação não dispara onError — complete&&naturalWidth===0
  // denuncia o arquivo quebrado já montado (mesmo truque do Avatar)
  const refImg = (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setFalhou(true);
  };
  if (falhou) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={refImg}
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      onError={() => setFalhou(true)}
    />
  );
}
