import {
  CalendarCheck,
  Flag,
  FlagCheckered,
  ListChecks,
  Medal,
  Plant,
  Tree,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { BadgeImagem } from "@/components/badge-imagem";
import { InstrumentoIcone } from "@/components/instrumento-icone";
import { arteDoGlifo } from "@/lib/badges";
import type {
  ConquistaGlifo,
  ConquistaPhosphor,
  NivelChave,
} from "@/lib/conquistas";
import { cn } from "@/lib/utils";

/** O emblema da conquista (016): a ilustração isométrica da casa
 *  (public/badges) quando o glifo tem desenho; o squircle de antes —
 *  mesma razão do InstrumentoEmblema, glifo a ~57% do lado — quando não
 *  tem ou o arquivo não carrega. `ganho` em cor; o não ganho é apagado e
 *  NUNCA cadeado — o `proximo` (primeiro não ganho) carrega só o anel
 *  --destaque, o "próximo passo" da casa. Sem "use client": serve a
 *  estante (cliente, Dialog) e a faixa (server). `className` vai no
 *  desenho — é onde a animação do chamador pousa. */
export function ConquistaEmblema({
  glifo,
  tom,
  size = 44,
  estado = "ganho",
  className,
}: {
  glifo: ConquistaGlifo;
  /** o par da conquista — ignorado nos estados apagados */
  tom: { cor: string; tinta: string };
  size?: number;
  estado?: "ganho" | "proximo" | "futuro";
  className?: string;
}) {
  const ganho = estado === "ganho";
  const anel =
    estado === "proximo" &&
    "ring-2 ring-[var(--destaque)] ring-offset-2 ring-offset-card";
  const squircle = (
    <Squircle glifo={glifo} tom={tom} size={size} ganho={ganho} className={cn(anel, className)} />
  );
  const arte = arteDoGlifo(glifo);
  if (!arte) return squircle;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[28%]", anel)}
      style={{ width: size, height: size }}
    >
      <BadgeImagem
        src={arte}
        size={size}
        fallback={squircle}
        className={cn(!ganho && "opacity-55 grayscale", className)}
      />
    </span>
  );
}

function Squircle({
  glifo,
  tom,
  size,
  ganho,
  className,
}: {
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  size: number;
  ganho: boolean;
  className?: string;
}) {
  const glifoSize = Math.round(size * 0.575);
  const Phos =
    glifo.tipo === "phosphor"
      ? PHOSPHOR[glifo.nome]
      : glifo.tipo === "nivel"
        ? NIVEL[glifo.chave]
        : null;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-[28%]",
        !ganho && "bg-muted text-muted-foreground",
        className
      )}
      style={{
        width: size,
        height: size,
        ...(ganho ? { background: tom.tinta, color: tom.cor } : {}),
      }}
    >
      {glifo.tipo === "instrumento" ? (
        <InstrumentoIcone instrumento={glifo.chave} size={glifoSize} neutro />
      ) : (
        Phos && <Phos size={glifoSize} />
      )}
    </span>
  );
}

const PHOSPHOR: Record<ConquistaPhosphor, typeof Flag> = {
  flag: Flag,
  medal: Medal,
  flagCheckered: FlagCheckered,
  trophy: Trophy,
  listChecks: ListChecks,
  usersThree: UsersThree,
};

const NIVEL: Record<NivelChave, typeof Flag> = {
  inicio: Plant,
  constancia: CalendarCheck,
  veterania: Tree,
  completa: Trophy,
};
