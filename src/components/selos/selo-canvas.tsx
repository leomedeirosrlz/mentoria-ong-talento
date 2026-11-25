"use client";

import { useEffect, useRef } from "react";
import { paint, play } from "@/lib/selos/fun";
import type { Player } from "@/lib/selos/fun";
import { PALETA_REALIZA } from "@/lib/selos/base";
import { ARTE } from "@/lib/selos";
import { cn } from "@/lib/utils";

/** Quando a peça se mexe:
 *  - `vivo`: em loop (as peças que o jovem escolheu pro perfil e o detalhe
 *    aberto) — o relógio é um só pra página, todas respiram juntas;
 *  - `entra` (padrão): faz a ação UMA vez ao aparecer na tela e de novo no
 *    hover/foco do gatilho, depois repousa no quadro final — a estante
 *    nunca vira um painel de coisas girando;
 *  - `quieto`: só o quadro de repouso (peça ainda não ganha).
 *  prefers-reduced-motion cai no quadro de repouso em qualquer modo (o
 *  kit já honra a media query). */
export type MovimentoSelo = "vivo" | "entra" | "quieto";

/** O canvas do selo. Decorativo: nome e estado moram no texto ao lado. A
 *  caixa tem o tamanho final desde o primeiro paint, então nada pula. */
export function SeloCanvas({
  arte,
  size,
  movimento = "entra",
  className,
}: {
  arte: string;
  size: number;
  movimento?: MovimentoSelo;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const icon = ARTE[arte];
    if (!canvas || !icon) return;
    if (movimento === "quieto") {
      paint(canvas, icon, icon.still ?? 0, 1, PALETA_REALIZA);
      // o canvas ainda sem tamanho (aba em segundo plano) repinta quando mede
      const ro = new ResizeObserver(() =>
        paint(canvas, icon, icon.still ?? 0, 1, PALETA_REALIZA)
      );
      ro.observe(canvas);
      return () => ro.disconnect();
    }
    const player: Player = play(canvas, icon, {
      palette: PALETA_REALIZA,
      loop: movimento === "vivo",
    });
    // hover/foco do gatilho (o botão ou link que envolve o selo) repete a ação
    const gatilho = canvas.closest("button, a, [role=button]");
    const repete = () => player.replay();
    if (movimento === "entra" && gatilho) {
      gatilho.addEventListener("pointerenter", repete);
      gatilho.addEventListener("focus", repete);
    }
    return () => {
      gatilho?.removeEventListener("pointerenter", repete);
      gatilho?.removeEventListener("focus", repete);
      player.stop();
    };
  }, [arte, movimento]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}
