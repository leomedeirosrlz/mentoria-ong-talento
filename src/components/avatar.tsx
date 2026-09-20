"use client";

import { useCallback, useState } from "react";
import { iniciais } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** Foto de perfil com cadeia de fallback: upload → Gravatar → iniciais.
 *  Cada src que falha (rede ou 404 do Gravatar) desce um degrau.
 *  papel="mentorado" usa disco amarelo + iniciais tinta como fallback — se
 *  houver `src` (foto cadastrada pela coordenação), a foto aparece normal. */
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
  papel?: "mentorado";
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
        papel === "mentorado"
          ? "bg-[var(--role-mentorado)]/30 text-[var(--brand-ink)]"
          : "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {idx < fontes.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={refImg}
          src={fontes[idx]}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}
