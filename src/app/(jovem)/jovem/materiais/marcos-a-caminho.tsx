import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import { formatDate } from "@/lib/ciclo";
import type { MarcoAcao } from "@/lib/conquistas";

/** "A caminho" no topo da jornada (REALIZA-485) — o resumo dos marcos de
 *  AÇÃO dela (1º encontro, avaliação, PDM, jornada completa), não níveis
 *  por tempo. Ganho diz "Feito · data" ou a contagem ("Avaliou 4
 *  encontros"); o que falta vem em texto ("Faltam 12 encontros", "Libera
 *  no encontro 6") — marco futuro nunca vira cadeado. O próximo (o
 *  primeiro não ganho) carrega o anel --destaque e, quando conta, a
 *  barra. Resumo aqui, estante completa no perfil ("Ver conquistas").
 *  Server: sem gesto próprio — não compete com agendar/registrar. */
export function MarcosACaminho({ marcos }: { marcos: MarcoAcao[] }) {
  if (!marcos.length) return null;
  return (
    <section
      aria-labelledby="a-caminho-titulo"
      className="animate-enter rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="a-caminho-titulo" className="text-base font-semibold">
          A caminho
        </h2>
        <Link
          href="/jovem/perfil#conquistas"
          className="inline-flex items-center gap-1 rounded-md px-1 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver conquistas
          <CaretRight size={14} aria-hidden />
        </Link>
      </div>
      <ol className="mt-4 grid gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {marcos.map((m) => (
          <li key={m.chave} className="flex min-w-0 items-start gap-3">
            <ConquistaEmblema
              glifo={m.glifo}
              tom={m.tom}
              size={40}
              estado={m.ganho ? "ganho" : m.proximo ? "proximo" : "futuro"}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{m.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {m.linha ?? (m.data ? `Feito · ${formatDate(m.data)}` : "Feito")}
              </p>
              {m.progresso && !m.ganho && (
                <div
                  role="progressbar"
                  aria-label={`${m.progresso.atual} de ${m.progresso.alvo} · ${m.titulo}`}
                  aria-valuemin={0}
                  aria-valuemax={m.progresso.alvo}
                  aria-valuenow={m.progresso.atual}
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="fill-grow h-full rounded-full bg-[var(--destaque)]"
                    style={{
                      width: `${Math.min(100, (m.progresso.atual / m.progresso.alvo) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
