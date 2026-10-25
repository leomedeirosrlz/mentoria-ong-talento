import { Check } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime, formatDiaHora, passoEsp } from "@/lib/ciclo";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { cn } from "@/lib/utils";

export type EstadoPasso = "feito" | "marcado" | "a_confirmar" | "furou" | "futuro";

/** Estado do passo pro jovem — sem o conceito de registro (o registro é do
 *  mentor). O nº gravado é a tentativa: o passo é o rank entre realizados
 *  (passoEsp, 0074) e o nó mostra a última cartada. */
export function estadoPasso(
  encontros: JovemEncontro[],
  passo: number,
  agoraMs: number
): { estado: EstadoPasso; encontro: JovemEncontro | null } {
  let alvo: JovemEncontro | null = null;
  for (const e of encontros) {
    if (passoEsp(e, encontros) !== passo) continue;
    if (
      !alvo ||
      e.status === "realizado" ||
      (alvo.status !== "realizado" && e.numero > alvo.numero)
    ) {
      alvo = e;
    }
  }
  if (!alvo) return { estado: "futuro", encontro: null };
  if (alvo.status === "realizado") return { estado: "feito", encontro: alvo };
  if (
    alvo.status === "agendado" &&
    alvo.data_hora != null &&
    new Date(alvo.data_hora).getTime() < agoraMs
  ) {
    return { estado: "a_confirmar", encontro: alvo };
  }
  if (alvo.status === "agendado" || alvo.status === "remarcado") {
    return { estado: "marcado", encontro: alvo };
  }
  return { estado: "furou", encontro: alvo };
}

const DOT: Record<EstadoPasso, string> = {
  feito: "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
  marcado: "ring-1 ring-inset ring-muted-foreground/60 text-muted-foreground",
  a_confirmar: "ring-2 ring-inset ring-[var(--warn)]/70 text-[var(--warn-text)]",
  furou: "bg-muted text-muted-foreground/50 line-through",
  futuro: "bg-muted text-muted-foreground",
};

const SR_ESTADO: Record<EstadoPasso, string> = {
  feito: "aconteceu",
  marcado: "marcada",
  a_confirmar: "a confirmar",
  furou: "não aconteceu",
  futuro: "a caminho",
};

/** Linha do tempo das sessões da trilha (mesma gramática dos dots da
 *  TrilhaJornada, sem o estado "registro pendente" — o registro é interno
 *  do especialista). No celular é uma lista vertical: marcador + nome da
 *  etapa + data um por linha, sem sobreposição. A partir de sm vira a
 *  régua horizontal de 5 colunas com o nome curto da etapa (o completo
 *  fica em title) e a data compacta. */
export function JovemTrilhaStepper({
  passos,
  encontros,
  agoraMs,
  proximoPasso,
}: {
  passos: { numero: number; titulo: string; foco: string | null }[];
  /** Encontros DA TRILHA (a página filtra por dupla_id antes de passar). */
  encontros: JovemEncontro[];
  agoraMs: number;
  /** Passo vivo da trilha — o anel lima marca onde ela está. Null quando a
   *  trilha fechou (nada mais "está por vir"). */
  proximoPasso: number | null;
}) {
  return (
    <ol
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      aria-label="Passos da trilha"
    >
      {passos.map((p, i) => {
        const { estado, encontro } = estadoPasso(encontros, p.numero, agoraMs);
        const atual = proximoPasso != null && p.numero === proximoPasso;
        return (
          <li
            key={p.numero}
            className={cn(
              "relative flex items-start gap-2.5 sm:flex-col sm:items-center sm:gap-1.5",
              i < passos.length - 1 && "sm:flex-1"
            )}
          >
            {i < passos.length - 1 && (
              <span
                aria-hidden
                className="absolute top-7 -bottom-3 left-[13px] w-px bg-border sm:top-[13px] sm:bottom-auto sm:left-1/2 sm:h-px sm:w-full"
              />
            )}
            <span
              title={`${p.titulo}: ${SR_ESTADO[estado]}`}
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                DOT[estado],
                atual &&
                  "ring-2 ring-[var(--brand-lime)] ring-offset-2 ring-offset-background"
              )}
            >
              {estado === "feito" ? (
                <Check size={13} weight="bold" aria-hidden />
              ) : (
                <span aria-hidden>{i + 1}</span>
              )}
              <span className="sr-only">
                {p.titulo}: {SR_ESTADO[estado]}
              </span>
            </span>
            <div className="min-w-0 sm:text-center">
              <span
                className={cn(
                  "block text-sm leading-snug sm:text-[11px] sm:leading-tight",
                  estado === "futuro"
                    ? "text-muted-foreground/60"
                    : "text-foreground sm:text-muted-foreground"
                )}
              >
                <span className="sm:hidden">{p.titulo}</span>
                <span className="hidden sm:inline" title={p.titulo}>
                  {p.titulo.split(",")[0]}
                </span>
              </span>
              {encontro?.data_hora && estado !== "futuro" && (
                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:text-[11px]">
                  <span className="sm:hidden">
                    {formatDateTime(encontro.data_hora)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatDiaHora(encontro.data_hora)}
                  </span>
                  {(estado === "furou" || estado === "a_confirmar") &&
                    ` · ${SR_ESTADO[estado]}`}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
