import { mesmasAreas, type RodaDaVida } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";
import { RodaSvg } from "./roda-svg";

// Antes × depois da Roda da Vida (REALIZA-18): o polígono formal sobre o
// ghost da leitura inicial + Δ por área + as duas médias. Os deltas são
// neutros por desenho — subir nem sempre é melhor, a copy nunca pontua
// melhoria/piora. Componente puro: serve a server e a client components
// (ficha da dupla, /jovem, retrospectiva do -359).

/** Δ formatado: "+2", "−1", "=" quando estável, "—" sem nota nos dois lados. */
function deltaTxt(a: number | null, b: number | null): string {
  if (a == null || b == null) return "—";
  const d = b - a;
  if (d === 0) return "=";
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

function Media({ rotulo, media }: { rotulo: string; media: number | null }) {
  return (
    <p className="text-sm text-muted-foreground">
      {rotulo}{" "}
      <strong className="font-semibold tabular-nums text-foreground">
        {media != null ? media.toLocaleString("pt-BR") : "—"}
      </strong>
      /10
    </p>
  );
}

export function RodaComparada({
  rodaAtual,
  rodaAnterior,
  rotuloAtual = "Aplicação formal",
  rotuloAnterior = "Leitura inicial",
  reflexao = null,
}: {
  rodaAtual: RodaDaVida;
  rodaAnterior: RodaDaVida;
  rotuloAtual?: string;
  rotuloAnterior?: string;
  /** reflexão do momento corrente (campo livre do form) */
  reflexao?: string | null;
}) {
  // defesa em profundidade: sem paridade estrutural a sobreposição
  // desalinha — o caller vê só a aplicação corrente (o RodaSvg repete o
  // guard interno; aqui ele escolhe o layout inteiro)
  if (!mesmasAreas(rodaAtual, rodaAnterior)) {
    return (
      <div className="text-center">
        <RodaSvg roda={rodaAtual} className="max-w-[280px]" />
      </div>
    );
  }

  const anteriorPorId = new Map(
    rodaAnterior.quadrantes.flatMap((q) => q.areas).map((a) => [a.id, a])
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        {/* mesma dupla de molduras do resultado simples — a coroa de
            nomes só entra em container largo */}
        <RodaSvg
          roda={rodaAtual}
          anterior={rodaAnterior}
          className="max-w-[280px] @[24rem]:max-w-[300px] @[34rem]:hidden"
        />
        <RodaSvg
          roda={rodaAtual}
          anterior={rodaAnterior}
          rotuloEixos
          className="hidden @[34rem]:block @[34rem]:max-w-[460px]"
        />
        <div
          role="group"
          aria-label="Legenda da comparação"
          className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 4"
              className="h-1 w-5 text-muted-foreground/70"
              aria-hidden
            >
              <line
                x1="0"
                y1="2"
                x2="24"
                y2="2"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeDasharray="5 3"
              />
            </svg>
            {rotuloAnterior}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-[var(--ok-text)]" />
            {rotuloAtual}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-0.5">
          <Media rotulo={`Média · ${rotuloAnterior.toLowerCase()}`} media={rodaAnterior.media} />
          <Media rotulo={`Média · ${rotuloAtual.toLowerCase()}`} media={rodaAtual.media} />
        </div>
      </div>

      {/* nota por área com Δ — o número exato ao lado da forma, agrupado
          por quadrante como no resultado simples */}
      <div className="space-y-3 @[30rem]:grid @[30rem]:grid-cols-2 @[30rem]:gap-x-6 @[30rem]:gap-y-4 @[30rem]:space-y-0 @[30rem]:self-start">
        {rodaAtual.quadrantes.map((q) => (
          <div key={q.nome || "geral"}>
            {q.nome && (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {q.nome}
              </p>
            )}
            <ul className="space-y-1">
              {q.areas.map((a) => {
                const antes = anteriorPorId.get(a.id)?.nota ?? null;
                const delta = deltaTxt(antes, a.nota);
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={a.label}>
                      {a.label}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {antes ?? "—"} → {a.nota ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "w-7 shrink-0 text-right font-semibold tabular-nums",
                        delta === "=" || delta === "—"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      )}
                    >
                      {delta}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {reflexao && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Reflexão sobre a roda
          </h4>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {reflexao}
          </p>
        </section>
      )}
    </div>
  );
}
