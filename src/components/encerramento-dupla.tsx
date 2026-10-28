import { Check, FlagCheckered, LockSimple, Minus, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { CHECKLIST_ENCERRAMENTO } from "@/lib/encerramento";
import { formatDateTime, formatDiaMes } from "@/lib/ciclo";
import { EncerrarDuplaDialog } from "@/components/encerrar-dupla-dialog";
import { EnviarFormularioDialog, type FormularioOpcao } from "@/components/enviar-formulario-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dupla, Encerramento } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Seção "Encerramento" da ficha da dupla DPP — o rito de fechamento do guia.
 *  - Coordenação: checklist + decisão (concluir a jornada ou encerrar antes).
 *  - Mentor: acompanha o que já chegou e vê o registro depois da decisão.
 *  - Supervisor: acompanha o que já foi registrado.
 *  A row nasce pendente no último encontro (0102); tipo null = rito aberto. */
export function EncerramentoDupla({
  dupla,
  encerramento,
  souMentor,
  souCoord,
  formularios,
  avaliacao360Em,
  realizadosCount,
}: {
  dupla: Pick<Dupla, "id" | "status" | "mentor" | "mentorado">;
  encerramento: Encerramento | null;
  souMentor: boolean;
  souCoord: boolean;
  /** forms ativos — alimentam o "Gerar link de avaliação" do item 360º */
  formularios: FormularioOpcao[];
  /** respondido_em da resposta 360º oficial (join resposta←link←form, 0042)
   *  — null em marcação manual antiga ou papel sem acesso aos forms */
  avaliacao360Em: string | null;
  /** encontros realizados — a régua que "abre" o rito (0097: o form
   *  aparecia em qualquer dupla nova, enc. 4/16) */
  realizadosCount: number;
}) {
  const decidido = !!encerramento?.tipo;
  const aberta = dupla.status === "ativa" || dupla.status === "pausada";
  // fechamento automático (0102): o último encontro conclui a dupla e a row
  // nasce pendente — o rito continua aberto aqui (360 tardio, checklist da
  // coordenação) até a decisão
  const ritoPendente = !aberta && encerramento != null && !decidido;
  const operavel = aberta || ritoPendente;
  // o rito é do fim da jornada — abre quando ela amadureceu (mesma janela
  // da roda formal, enc. 12) ou quando já existe row (quem abriu antes por
  // encerramento antecipado continua vendo/agindo). Abaixo disso a seção
  // se apresenta indisponível em vez de oferecer form meses adiantado.
  const madura = realizadosCount >= 12 || encerramento != null;
  // supervisor sem row ainda não tem o que ver — a seção só existe quando há
  // conteúdo ou ação pra quem olha
  if (!souMentor && !souCoord && !encerramento) return null;
  // dupla já fechada sem row de encerramento (fechamento antigo, pré-0037):
  // a seção não inventa checklist — o resumo da jornada segue visível embaixo
  if (!aberta && !encerramento) return null;

  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
          Encerramento
        </h2>
        {ritoPendente && (
          <Badge
            variant="outline"
            className="border-[var(--ok)]/60 text-[var(--ok-text)]"
          >
            <FlagCheckered size={12} aria-hidden />
            Jornada concluída · rito pendente
          </Badge>
        )}
        {decidido && (
          <Badge
            variant="outline"
            className={cn(
              encerramento!.tipo === "concluida"
                ? "border-[var(--ok)]/60 text-[var(--ok-text)]"
                : "border-[var(--warn)]/60 text-[var(--warn-text)]"
            )}
          >
            <FlagCheckered size={12} aria-hidden />
            {encerramento!.tipo === "concluida"
              ? "Jornada concluída"
              : "Jornada encerrada"}
          </Badge>
        )}
      </div>

      {aberta && !madura ? (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            <LockSimple
              size={13}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground/60"
            />
            <p>
              Encerramento do ciclo: abre na reta final da jornada (a
              partir do encontro 12). O checklist do rito aparece aqui quando
              chegar a hora.
            </p>
          </div>
          {/* encerramento antecipado é fluxo real — dupla que não vingou
              fecha antes do enc. 12; a coord mantém a saída sempre à mão */}
          {souCoord && (
            <EncerrarDuplaDialog duplaId={dupla.id} encerramento={encerramento} />
          )}
        </>
      ) : (
      <>
      {/* checklist do rito — antes da decisão mostra o que já chegou */}
      <ul className="space-y-1">
        {CHECKLIST_ENCERRAMENTO.map((item) => {
          const feito = !!encerramento?.checklist?.[item.key];
          return (
            <li
              key={item.key}
              className={cn(
                "flex items-start gap-2 text-xs",
                feito ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {feito ? (
                <Check
                  size={13}
                  weight="bold"
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[var(--ok-text)]"
                />
              ) : (
                <Minus
                  size={13}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground/50"
                />
              )}
              <span>
                {item.label}
                {/* marcação automática (0042): diz que o check veio de uma
                    resposta real do form oficial, com a data dela */}
                {item.key === "avaliacao_360_enviada" && feito && avaliacao360Em && (
                  <span className="text-muted-foreground">
                    {" "}
                    · recebida via formulário em {formatDiaMes(avaliacao360Em)}
                  </span>
                )}
              </span>
              {/* facilitador do 360º — o checklist continua marcação manual;
                  o botão só abre o envio com os forms "360" sugeridos */}
              {item.key === "avaliacao_360_enviada" &&
                !feito &&
                souCoord &&
                operavel && (
                  <span className="ml-auto shrink-0">
                    <EnviarFormularioDialog
                      formularios={formularios}
                      duplaId={dupla.id}
                      mentor={{
                        id: dupla.mentor.id,
                        nome: dupla.mentor.nome,
                        whatsapp: dupla.mentor.whatsapp,
                      }}
                      mentorado={{
                        id: dupla.mentorado.id,
                        nome: dupla.mentorado.nome,
                        whatsapp: dupla.mentorado.whatsapp,
                      }}
                      sugestao="360"
                      trigger={
                        <Button type="button" variant="outline" size="xs">
                          <PaperPlaneTilt aria-hidden />
                          Gerar link de avaliação
                        </Button>
                      }
                    />
                  </span>
                )}
            </li>
          );
        })}
      </ul>

      {decidido ? (
        <>
          <p className="text-xs text-muted-foreground">
            Registrado por {encerramento!.decidido?.nome ?? "a coordenação"} ·{" "}
            {formatDateTime(encerramento!.created_at)}
          </p>
        </>
      ) : (
        <>
          {souCoord && operavel && (
            <EncerrarDuplaDialog
              duplaId={dupla.id}
              encerramento={encerramento}
              somenteConclusao={dupla.status === "concluida"}
            />
          )}
          {!souCoord && (
            <p className="text-xs text-muted-foreground">
              A coordenação registra o fechamento no fim da jornada. O que já
              chegou aparece marcado acima.
            </p>
          )}
        </>
      )}
      </>
      )}
    </section>
  );
}
