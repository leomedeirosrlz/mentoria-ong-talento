"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useFadeX } from "@/lib/use-fade-x";

const TAGS = {
  div: "div",
  nav: "nav",
  ul: "ul",
  ol: "ol",
} as const;

/** Scrollport horizontal com a máscara do useFadeX num boundary client
 *  mínimo — server components entregam os filhos prontos e só este
 *  invólucro hidrata (mesmo desenho do ExitList/RevelarApos). Barra à
 *  parte: quem usa escolhe entre `scroll-fina` (regions focáveis) e
 *  `[scrollbar-width:none]` (trilhas/pills, onde o fade é a affordance). */
export function FadeX({
  tag = "div",
  className,
  style,
  children,
  ...rest
}: {
  tag?: keyof typeof TAGS;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const { ref, maskStyle } = useFadeX<HTMLElement>();
  const Comp = TAGS[tag] as "div";
  return (
    <Comp
      ref={ref}
      className={className}
      style={{ ...maskStyle, ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
