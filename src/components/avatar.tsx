"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { iniciais } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** Papel grosso pra identidade visual — o anel 2px marca a cor com ou sem
 *  foto; o disco de iniciais segue a mesma cor como fallback. */
export type PapelVisual = "mentor" | "mentorado" | "equipe";

// offset na cor do card: gap entre foto e anel — o anel lê mesmo quando a
// borda da foto é da mesma família da cor do papel
const ANEL_BASE = "ring-2 ring-offset-2 ring-offset-[var(--card)]";
const ANEL: Record<PapelVisual, string> = {
  mentor: `${ANEL_BASE} ring-[var(--role-mentor)]`,
  mentorado: `${ANEL_BASE} ring-[var(--role-mentorado)]`,
  equipe: `${ANEL_BASE} ring-[var(--role-equipe)]`,
};

const DISCO: Record<PapelVisual, string> = {
  // disco claro + anel saturado — mesmo contraste do mentorado: anel
  // saturado sobre disco saturado sumia (lime em lime)
  mentor:
    "bg-[color-mix(in_oklch,var(--role-mentor)_72%,white)] text-[var(--brand-ink)]",
  mentorado:
    "bg-[color-mix(in_oklch,var(--role-mentorado)_72%,white)] text-[var(--brand-ink)]",
  equipe: "bg-muted text-muted-foreground",
};

/** Foto de perfil com cadeia de fallback: upload → Gravatar → iniciais.
 *  Cada src que falha (rede ou 404 do Gravatar) desce um degrau.
 *  `papel` dá anel + disco na cor do papel (anel sobrevive à foto); sem
 *  papel, o fallback é o disco lime de sempre e nenhum anel. */
export function Avatar({
  nome,
  src,
  fallbackSrc,
  papel,
  size = 32,
  className,
}: {
  nome: string;
  src?: string | null;
  fallbackSrc?: string | null;
  papel?: PapelVisual;
  size?: number;
  className?: string;
}) {
  const fontes = [src, fallbackSrc].filter((s): s is string => !!s);
  const [idx, setIdx] = useState(0);
  // src novo (upload/remoção) reinicia a cadeia do zero — ajuste durante o
  // render, o padrão que o React recomenda pra estado derivado de props
  const chave = `${src}|${fallbackSrc}`;
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setIdx(0);
  }

  // <img> que falha ANTES da hidratação nunca dispara onError — o evento já
  // passou quando o React liga o handler e a imagem quebrada ficaria presa.
  // Na montagem, complete && naturalWidth===0 denuncia o erro já acontecido.
  const refImg = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setIdx((i) => i + 1);
  }, []);

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold",
        papel ? cn(ANEL[papel], DISCO[papel]) : "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {idx < fontes.length ? (
        // width/height = o tamanho do box (18–96px): srcset 1x/2x serve
        // webp pequeno em vez do upload original de até 10MB
        <Image
          ref={refImg}
          src={fontes[idx]}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}
