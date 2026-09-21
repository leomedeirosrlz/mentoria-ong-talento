import Link from "next/link";
import { HandHeart, Paperclip } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { DuplaNomes } from "@/components/dupla-nomes";
import { AvaliacaoBadge } from "@/components/semaforo";
import { RegistroView } from "@/components/registro-view";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { DIFICULDADE_LABEL, formatDate, formatDiaMes } from "@/lib/ciclo";
import type { RegistroResumo } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TRES_DIAS = 3 * 86400000;

/** Linha do /registros: resumo clicável (stretched link → ficha#encontro) +
 *  <details> com o registro completo sem sair da lista. */
export function RegistroRow({
  r,
  souCoord,
}: {
  r: RegistroResumo;
  souCoord: boolean;
}) {
  const enc = r.encontro;
  const dupla = enc?.dupla ?? null;
  const aconteceuEm = enc?.realizado_em ?? enc?.data_hora ?? null;
  const tardio =
    aconteceuEm != null &&
    new Date(r.created_at).getTime() - new Date(aconteceuEm).getTime() >
      TRES_DIAS;
  const preview =
    (r.tema
      ? `${r.tema}${r.ferramenta ? ` · ${r.ferramenta}` : ""}`
      : null) ??
    (r.atividades.length > 0 ? r.atividades.join(", ") : null) ??
    r.reflexoes;
  const href =
    dupla && enc ? `/duplas/${dupla.id}#registrar-${enc.id}` : null;

  return (
    <div className="relative px-4 py-3">
      {href && (
        <Link
          href={href}
          className="absolute inset-0 rounded-none"
          aria-label={`Abrir na ficha — ${dupla?.mentor?.nome ?? ""} e ${dupla?.mentorado?.nome ?? ""}`}
        />
      )}
      <div className="pointer-events-none space-y-1.5">
        <p className="text-sm font-medium">
          {dupla ? (
            <DuplaNomes
              mentor={dupla.mentor?.nome ?? "—"}
              mentorado={dupla.mentorado?.nome ?? "—"}
            />
          ) : (
            "Dupla removida"
          )}
          {dupla && dupla.status !== "ativa" && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({dupla.status === "pausada" ? "dupla pausada" : "dupla encerrada"})
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {aconteceuEm && `realizado ${formatDate(aconteceuEm)} · `}
          registrado {formatDiaMes(r.created_at)}
          {r.autor?.nome ? ` por ${r.autor.nome}` : ""}
        </p>
        {preview && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{preview}</p>
        )}
        {(r.avaliacao ||
          (r.dificuldade && r.dificuldade !== "nenhuma") ||
          r.precisa_apoio ||
          tardio ||
          r.encaminhamentos.length > 0 ||
          r.anexos.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {r.precisa_apoio && (
              <Badge
                variant="outline"
                className="border-[var(--danger)]/60 text-[var(--danger)] text-xs"
              >
                <HandHeart size={12} data-icon="inline-start" />
                apoio solicitado
              </Badge>
            )}
            {r.avaliacao && <AvaliacaoBadge avaliacao={r.avaliacao} />}
            {r.dificuldade && r.dificuldade !== "nenhuma" && (
              <Badge
                variant="outline"
                className="border-[var(--warn)]/60 text-[var(--warn-text)] text-xs"
              >
                dificuldade: {DIFICULDADE_LABEL[r.dificuldade]}
              </Badge>
            )}
            {tardio && (
              <Badge
                variant="outline"
                className="border-[var(--warn)]/60 px-1.5 py-0 text-[11px] font-normal text-[var(--warn-text)]"
              >
                registro tardio
              </Badge>
            )}
            {r.encaminhamentos.length > 0 && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                {r.encaminhamentos.length}{" "}
                {r.encaminhamentos.length === 1 ? "combinado" : "combinados"}
              </Badge>
            )}
            {r.anexos.length > 0 && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                <Paperclip size={11} data-icon="inline-start" />
                {r.anexos.length}
              </Badge>
            )}
          </div>
        )}
      </div>
      {/* acima do stretched link: o summary precisa ser clicável por cima */}
      <details className={cn("group relative mt-1")}>
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
          Ver registro completo
        </summary>
        <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3.5 text-sm">
          <RegistroView reg={r} tardio={tardio} />
          {souCoord && r.precisa_apoio && dupla && (
            <div className="pt-1">
              <ResolverApoioButton registroId={r.id} duplaId={dupla.id} />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
