import Link from "next/link";
import {
  ArrowUpRight,
  CaretDown,
  HandHeart,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { AvaliacaoBadge } from "@/components/semaforo";
import { RegistroView } from "@/components/registro-view";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import {
  DIFICULDADE_LABEL,
  diasAtrasoRegistro,
  formatDate,
  registroTardio,
} from "@/lib/ciclo";
import type { RegistroResumo } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Card de /registros: o <summary> inteiro é o alvo de clique (expande o
 *  registro completo inline); o link pra ficha mora no corpo expandido —
 *  uma ação por zona, sem stretched link competindo com o details. */
export function RegistroCard({
  r,
  tituloEncontro,
  souCoord,
}: {
  r: RegistroResumo;
  tituloEncontro: string | null;
  souCoord: boolean;
}) {
  const enc = r.encontro;
  const dupla = enc?.dupla ?? null;
  const aconteceuEm = enc?.realizado_em ?? enc?.data_hora ?? null;
  const tardio = registroTardio(r, enc);
  const diasAtraso = tardio ? diasAtrasoRegistro(r, enc) : 0;
  const preview =
    (r.tema
      ? `${r.tema}${r.ferramenta ? ` · ${r.ferramenta}` : ""}`
      : null) ??
    (r.atividades.length > 0 ? r.atividades.join(", ") : null) ??
    r.reflexoes;
  const href =
    dupla && enc ? `/duplas/${dupla.id}#registrar-${enc.id}` : null;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-border)] transition-shadow hover:shadow-[var(--shadow-border-hover)]",
        // apoio em aberto escala até a superfície — é o que mais pede ação
        r.precisa_apoio ? "border-[var(--danger)]/50" : "border-transparent"
      )}
    >
      <details className="group/detalhe">
        {/* summary = phrasing content: div/p dentro é inválido — tudo span
            com block/flex. O header inteiro é o alvo (hit area enorme) */}
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-snug">
                {enc?.numero != null ? `${enc.numero}º encontro` : "Encontro"}
                {tituloEncontro ? ` · ${tituloEncontro}` : ""}
              </span>
              <span className="mt-1.5 flex items-center gap-2 text-sm font-medium">
                {dupla?.mentor && dupla?.mentorado ? (
                  <>
                    <DuplaAvatares
                      mentor={dupla.mentor}
                      mentorado={dupla.mentorado}
                      size={32}
                    />
                    <DuplaNomes
                      mentor={dupla.mentor.nome}
                      mentorado={dupla.mentorado.nome}
                    />
                  </>
                ) : (
                  "Dupla removida"
                )}
                {dupla && dupla.status !== "ativa" && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (
                    {dupla.status === "pausada"
                      ? "dupla pausada"
                      : "dupla encerrada"}
                    )
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {aconteceuEm ? formatDate(aconteceuEm) : "data a definir"}
                {" · registrado "}
                {formatDate(r.created_at)}
                {r.autor?.nome ? ` por ${r.autor.nome}` : ""}
                {diasAtraso > 0 && (
                  <span className="font-medium text-[var(--warn-text)]">
                    {" · "}
                    {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"} de atraso
                  </span>
                )}
              </span>
            </span>
            <CaretDown
              size={15}
              aria-hidden
              className="mt-1.5 shrink-0 text-muted-foreground transition-transform group-open/detalhe:rotate-180"
            />
          </span>

          {preview && (
            <span className="mt-1.5 line-clamp-2 block text-sm text-muted-foreground">
              {preview}
            </span>
          )}

          {(r.precisa_apoio ||
            r.avaliacao ||
            tardio ||
            (r.dificuldade && r.dificuldade !== "nenhuma")) && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {r.precisa_apoio && (
                <Badge
                  variant="outline"
                  className="border-[var(--danger)]/60 text-xs text-[var(--danger)]"
                >
                  <HandHeart size={12} data-icon="inline-start" />
                  apoio solicitado
                </Badge>
              )}
              {r.avaliacao && <AvaliacaoBadge avaliacao={r.avaliacao} rotulo />}
              {tardio && (
                <Badge
                  variant="outline"
                  className="border-[var(--warn)]/60 text-xs font-normal text-[var(--warn-text)]"
                >
                  registro tardio
                </Badge>
              )}
              {r.dificuldade && r.dificuldade !== "nenhuma" && (
                <Badge
                  variant="outline"
                  className="border-[var(--warn)]/60 text-xs text-[var(--warn-text)]"
                >
                  dificuldade: {DIFICULDADE_LABEL[r.dificuldade]}
                </Badge>
              )}
            </span>
          )}

          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className="group-open/detalhe:hidden">Ver detalhes</span>
            <span className="hidden group-open/detalhe:inline">
              Ocultar detalhes
            </span>
          </span>
        </summary>

        <div className="space-y-2 border-t bg-muted/40 px-4 py-3.5 text-sm sm:px-5">
          <RegistroView reg={r} tardio={tardio} ocultarMeta />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {href && (
              <Link
                href={href}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-medium underline underline-offset-2 transition-colors hover:text-muted-foreground sm:min-h-0"
              >
                Abrir na ficha da dupla
                <ArrowUpRight size={12} aria-hidden />
              </Link>
            )}
            {souCoord && r.precisa_apoio && dupla && (
              <ResolverApoioButton registroId={r.id} duplaId={dupla.id} />
            )}
          </div>
        </div>
      </details>
    </article>
  );
}
