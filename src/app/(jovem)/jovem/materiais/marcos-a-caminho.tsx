import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import type { MarcoAcao } from "@/lib/conquistas";

/** "Próximo marco" no topo da jornada (REALIZA-485/515) — SÓ o primeiro
 *  marco de ação ainda não ganho (1º encontro, avaliação, PDM, jornada
 *  completa), com o que falta em texto e a barra quando conta. Os já
 *  conquistados moram na estante do perfil ("Ver conquistas"), nunca
 *  repetidos aqui — a faixa deixou de listar todos porque lia como
 *  "conquistas a caminho" o que já era dela. Com tudo ganho, vira o
 *  estado de conclusão. Server: sem gesto próprio — não compete com
 *  agendar/registrar. */
export function MarcosACaminho({ marcos }: { marcos: MarcoAcao[] }) {
  if (!marcos.length) return null;
  const proximo = marcos.find((m) => m.proximo) ?? null;
  return (
    <section
      aria-labelledby="proximo-marco-titulo"
      className="animate-enter rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="proximo-marco-titulo" className="text-base font-semibold">
          {proximo ? "Próximo marco" : "Jornada completa"}
        </h2>
        <Link
          href="/jovem/perfil#conquistas"
          className="inline-flex items-center gap-1 rounded-md px-1 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver conquistas
          <CaretRight size={14} aria-hidden />
        </Link>
      </div>
      {proximo ? (
        <div className="mt-4 flex min-w-0 items-start gap-3">
          <ConquistaEmblema
            glifo={proximo.glifo}
            tom={proximo.tom}
            size={40}
            estado="proximo"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">
              {proximo.titulo}
            </p>
            {proximo.linha && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {proximo.linha}
              </p>
            )}
            {proximo.progresso && (
              <div
                role="progressbar"
                aria-label={`${proximo.progresso.atual} de ${proximo.progresso.alvo} · ${proximo.titulo}`}
                aria-valuemin={0}
                aria-valuemax={proximo.progresso.alvo}
                aria-valuenow={proximo.progresso.atual}
                className="mt-1.5 h-1 max-w-56 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="fill-grow h-full rounded-full bg-[var(--destaque)]"
                  style={{
                    width: `${Math.min(100, (proximo.progresso.atual / proximo.progresso.alvo) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Você fez todos os marcos da jornada. Suas conquistas estão no
          perfil.
        </p>
      )}
    </section>
  );
}
