import { Star } from "@phosphor-icons/react/dist/ssr";
import { estrelasTexto } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

/** Estrelas de exibição (não-input) — 1-5 pintadas até `n`, com o texto
 *  acessível completo no aria-label ("4 de 5 estrelas"). Meia estrela não
 *  existe no schema (smallint); a média quantizada do DPP pode cair em
 *  X,5 — use EstrelasMedia pra ela. */
export function Estrelas({
  n,
  size = 14,
  className,
}: {
  n: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={estrelasTexto(n)}
      className={cn("inline-flex items-center gap-0.5 text-[var(--warn)]", className)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} weight={i <= n ? "fill" : "regular"} aria-hidden />
      ))}
    </span>
  );
}

/** A média do DPP é quantizada no 0,5 (0071) — a estrela quebrada vira
 *  "half" quando a fração é .5. */
export function EstrelasMedia({
  media,
  size = 14,
  className,
}: {
  media: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`média ${String(media).replace(".", ",")} de 5 estrelas`}
      className={cn("inline-flex items-center gap-0.5 text-[var(--warn)]", className)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          weight={i <= Math.floor(media) ? "fill" : i - 0.5 <= media ? "duotone" : "regular"}
          aria-hidden
        />
      ))}
    </span>
  );
}
