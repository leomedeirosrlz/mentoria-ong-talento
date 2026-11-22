import {
  Flag,
  FlagCheckered,
  ListChecks,
  Medal,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { InstrumentoIcone } from "@/components/instrumento-icone";
import type { ConquistaGlifo, ConquistaPhosphor } from "@/lib/conquistas";
import { cn } from "@/lib/utils";

/** O squircle do emblema de conquista — mesma razão do InstrumentoEmblema
 *  (glifo a ~57% do lado). `ganho` veste o par cor/tinta do feito; o não
 *  ganho é apagado e NUNCA cadeado — o `proximo` (primeiro não ganho)
 *  carrega só o anel --destaque, o "próximo passo" da casa. Sem
 *  "use client": serve a estante (cliente, Dialog) e à faixa (server). */
export function ConquistaEmblema({
  glifo,
  tom,
  size = 44,
  estado = "ganho",
}: {
  glifo: ConquistaGlifo;
  /** o par da conquista — ignorado nos estados apagados */
  tom: { cor: string; tinta: string };
  size?: number;
  estado?: "ganho" | "proximo" | "futuro";
}) {
  const glifoSize = Math.round(size * 0.575);
  const Phos = glifo.tipo === "phosphor" ? PHOSPHOR[glifo.nome] : null;
  const ganho = estado === "ganho";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-[28%]",
        !ganho && "bg-muted text-muted-foreground",
        estado === "proximo" &&
          "ring-2 ring-[var(--destaque)] ring-offset-2 ring-offset-card"
      )}
      style={{
        width: size,
        height: size,
        ...(ganho ? { background: tom.tinta, color: tom.cor } : {}),
      }}
    >
      {glifo.tipo === "instrumento" ? (
        <InstrumentoIcone
          instrumento={glifo.chave}
          size={glifoSize}
          neutro
        />
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
