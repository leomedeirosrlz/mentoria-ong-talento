import {
  CalendarCheck,
  Checks,
  ClockCountdown,
  Flag,
  FlagCheckered,
  Handshake,
  IdentificationCard,
  Lightning,
  ListChecks,
  Medal,
  Signature,
  Sparkle,
  Star,
  Target,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { SeloCanvas } from "@/components/selos/selo-canvas";
import type { MovimentoSelo } from "@/components/selos/selo-canvas";
import { InstrumentoIcone } from "@/components/instrumento-icone";
import { arteDoGlifo } from "@/lib/badges";
import type {
  ConquistaGlifo,
  ConquistaPhosphor,
  FamiliaChave,
  NivelChave,
} from "@/lib/conquistas";
import { cn } from "@/lib/utils";

/** O emblema da conquista: o selo isométrico animado da casa
 *  (src/lib/selos, REALIZA-529) quando o glifo tem desenho; o squircle de
 *  antes — mesma razão do InstrumentoEmblema, glifo a ~57% do lado —
 *  quando não tem. `ganho` em cor; o não ganho é apagado e NUNCA cadeado,
 *  e fica parado — o `proximo` (primeiro não ganho) carrega só o anel
 *  --destaque, o "próximo passo" da casa. Sem "use client": serve a
 *  estante (cliente, Dialog) e a faixa (server); o canvas é a folha
 *  cliente. `movimento` escolhe quando a peça se mexe (ver SeloCanvas). */
export function ConquistaEmblema({
  glifo,
  tom,
  size = 44,
  estado = "ganho",
  movimento = "entra",
  className,
  sizeClassName,
}: {
  glifo: ConquistaGlifo;
  /** o par da conquista — ignorado nos estados apagados */
  tom: { cor: string; tinta: string };
  size?: number;
  estado?: "ganho" | "proximo" | "futuro";
  movimento?: MovimentoSelo;
  className?: string;
  /** caixa responsiva com !important — o canvas repinta no clientWidth,
   *  então a peça troca de medida sem redimensionar bitmap por CSS */
  sizeClassName?: string;
}) {
  const ganho = estado === "ganho";
  const anel =
    estado === "proximo" &&
    "ring-2 ring-[var(--destaque)] ring-offset-2 ring-offset-card";
  const squircle = (
    <Squircle glifo={glifo} tom={tom} size={size} ganho={ganho} className={cn(anel, sizeClassName, className)} />
  );
  const arte = arteDoGlifo(glifo);
  if (!arte) return squircle;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[28%]", anel, sizeClassName)}
      style={{ width: size, height: size }}
    >
      <SeloCanvas
        arte={arte}
        size={size}
        movimento={ganho ? movimento : "quieto"}
        className={cn(sizeClassName, !ganho && "opacity-55 grayscale", className)}
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
  const nivel = glifo.tipo === "nivel" ? NIVEL[glifo.chave] : null;
  const Phos =
    glifo.tipo === "phosphor"
      ? PHOSPHOR[glifo.nome]
      : glifo.tipo === "familia"
        ? FAMILIA[glifo.familia]
        : (nivel?.I ?? null);
  // o peso sobe com o tier — regular → bold → fill (a arte evolui igual)
  const weight =
    glifo.tipo === "familia"
      ? glifo.tier >= 3
        ? "fill"
        : glifo.tier === 2
          ? "bold"
          : "regular"
      : (nivel?.weight ?? "regular");
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
        Phos && <Phos size={glifoSize} weight={weight} />
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

/** O raio da família de nível (024) — Lightning com progressão por peso:
 *  regular → bold → fill, e o Sparkle fill na jornada completa. */
const NIVEL: Record<
  NivelChave,
  { I: typeof Lightning; weight: "regular" | "bold" | "fill" }
> = {
  inicio: { I: Lightning, weight: "regular" },
  constancia: { I: Lightning, weight: "bold" },
  veterania: { I: Lightning, weight: "fill" },
  completa: { I: Sparkle, weight: "fill" },
};

/** O Phosphor de cada família com tiers (024) — o mesmo glifo a escada
 *  inteira; o que evolui por degrau é o peso (e a arte isométrica). */
const FAMILIA: Record<FamiliaChave, typeof Handshake> = {
  combinados: Handshake,
  horas: ClockCountdown,
  metas: Target,
  submetas: Checks,
  avaliacoes: Star,
  presenca: CalendarCheck,
  perfil: IdentificationCard,
  termo: Signature,
};
