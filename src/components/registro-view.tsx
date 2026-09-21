import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { AvaliacaoBadge } from "@/components/semaforo";
import {
  DIFICULDADE_LABEL,
  PROXIMO_PASSO_LABEL,
  formatDiaMes,
} from "@/lib/ciclo";
import type { Registro } from "@/lib/types";

/**
 * Leitura do registro semanal — compartilhada entre a ficha da dupla, o
 * detalhe do encontro na agenda e a página /registros. Só display: quem pode
 * agir sobre o registro (editar, anexar) recebe os controles pelo slot
 * `anexos` ou renderiza ao lado.
 */
export function RegistroView({
  reg,
  tardio,
  anexos,
  ocultarMeta = false,
}: {
  reg: Registro;
  /** >3 dias entre encontro e registro — badge "registro tardio". */
  tardio?: boolean;
  /** Slot de evidências (AnexosRegistro com as permissões do papel). */
  anexos?: ReactNode;
  /** o summary do card em /registros já mostra data+autor — o meta repete */
  ocultarMeta?: boolean;
}) {
  return (
    <>
      {!ocultarMeta && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            Registrado em {formatDiaMes(reg.created_at)}
            {reg.autor?.nome ? ` por ${reg.autor.nome}` : ""}
          </span>
          {tardio && (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 px-1.5 py-0 text-[11px] font-normal text-[var(--warn-text)]"
            >
              registro tardio
            </Badge>
          )}
        </p>
      )}
      {(reg.avaliacao || (reg.dificuldade && reg.dificuldade !== "nenhuma")) && (
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          {reg.avaliacao && <AvaliacaoBadge avaliacao={reg.avaliacao} />}
          {reg.dificuldade && reg.dificuldade !== "nenhuma" && (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 text-[var(--warn-text)] text-xs"
            >
              dificuldade: {DIFICULDADE_LABEL[reg.dificuldade]}
              {reg.dificuldade === "outro" && reg.dificuldade_detalhe
                ? ` (${reg.dificuldade_detalhe})`
                : ""}
            </Badge>
          )}
        </div>
      )}
      {reg.atividades.length > 0 && (
        <p>
          <span className="text-muted-foreground">Realizado: </span>
          {reg.atividades.join(", ")}
        </p>
      )}
      {reg.tema && (
        <p>
          <span className="text-muted-foreground">Tema: </span>
          {reg.tema}
          {reg.ferramenta && (
            <span className="text-muted-foreground"> · {reg.ferramenta}</span>
          )}
        </p>
      )}
      {reg.reflexoes && <p className="leading-relaxed">{reg.reflexoes}</p>}
      {reg.proximo_passo && (
        <p>
          <span className="text-muted-foreground">Próximo passo: </span>
          {reg.proximo_passo === "outro" && reg.proximo_passo_detalhe
            ? reg.proximo_passo_detalhe
            : PROXIMO_PASSO_LABEL[reg.proximo_passo]}
        </p>
      )}
      {reg.observacoes && (
        <p className="text-muted-foreground leading-relaxed">
          Obs: {reg.observacoes}
        </p>
      )}
      {anexos}
    </>
  );
}
