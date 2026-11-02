import type { ReactNode } from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { AvaliacaoBadge } from "@/components/semaforo";
import {
  DIFICULDADE_LABEL,
  PROXIMO_PASSO_LABEL,
  formatDiaMes,
  formatDate,
} from "@/lib/ciclo";
import type { Encaminhamento, Registro } from "@/lib/types";

/**
 * Leitura do registro semanal — compartilhada entre a ficha da dupla, o
 * detalhe do encontro na agenda e a página /registros. Só display: quem pode
 * agir sobre o registro (editar, anexar) recebe os controles pelo slot
 * `anexos` ou renderiza ao lado.
 */
export function RegistroView({
  reg,
  tardio,
  combinados,
  anexos,
  ocultarMeta = false,
}: {
  reg: Registro;
  /** >3 dias entre encontro e registro — badge "registro tardio". */
  tardio?: boolean;
  /** Combinados gravados por este registro — quem tem a lista (ficha da
   *  dupla) filtra por registro_id e passa; sem a prop a seção não existe. */
  combinados?: Encaminhamento[];
  /** Slot de evidências (AnexosRegistro com as permissões do papel). */
  anexos?: ReactNode;
  /** o summary do card em /registros já mostra data+autor — o meta repete */
  ocultarMeta?: boolean;
}) {
  // "vencido" no fim do prazo — congela no render: um prazo virando durante
  // a leitura não troca o item sob o olhar (mesmo critério do detalhe do
  // encontro na agenda)
  const agora = new Date().getTime();
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
        <p className="break-words">
          <span className="text-muted-foreground">Realizado: </span>
          {reg.atividades.join(", ")}
        </p>
      )}
      {reg.tema && (
        <p className="break-words">
          <span className="text-muted-foreground">Tema: </span>
          {reg.tema}
          {reg.ferramenta && (
            <span className="text-muted-foreground"> · {reg.ferramenta}</span>
          )}
        </p>
      )}
      {reg.reflexoes && <p className="break-words leading-relaxed">{reg.reflexoes}</p>}
      {reg.proximo_passo && (
        <p className="break-words">
          <span className="text-muted-foreground">Próximo passo: </span>
          {reg.proximo_passo === "outro" && reg.proximo_passo_detalhe
            ? reg.proximo_passo_detalhe
            : PROXIMO_PASSO_LABEL[reg.proximo_passo]}
        </p>
      )}
      {reg.observacoes && (
        <p className="break-words text-muted-foreground leading-relaxed">
          Obs: {reg.observacoes}
        </p>
      )}
      {combinados && combinados.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Combinados
          </p>
          <ul className="mt-1 space-y-1">
            {combinados.map((c) => {
              const vencido =
                c.status !== "feito" &&
                c.prazo != null &&
                new Date(`${c.prazo}T23:59:59`).getTime() < agora;
              return (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.status === "feito" ? (
                    <CheckCircle
                      size={15}
                      className="mt-0.5 shrink-0 text-[var(--ok)]"
                    />
                  ) : (
                    <Circle
                      size={15}
                      className="mt-0.5 shrink-0 text-muted-foreground/60"
                    />
                  )}
                  <span
                    className={
                      c.status === "feito"
                        ? "text-muted-foreground line-through"
                        : undefined
                    }
                  >
                    {c.descricao}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {c.responsavel === "mentorado" ? "Mentorado" : "Mentor"}
                      {c.prazo ? ` · até ${formatDate(c.prazo)}` : ""}
                    </span>
                    {vencido && (
                      <span className="text-xs font-medium text-[var(--danger)]">
                        {" "}
                        (vencido)
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {anexos}
    </>
  );
}
