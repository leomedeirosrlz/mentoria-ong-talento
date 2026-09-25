import { Check, CheckCircle, FlagCheckered, Minus, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { CHECKLIST_ENCERRAMENTO } from "@/lib/encerramento";
import { formatDateTime, formatDiaMes } from "@/lib/ciclo";
import { AutoavaliacaoMentorForm } from "@/components/autoavaliacao-mentor-form";
import { EncerrarDuplaDialog } from "@/components/encerrar-dupla-dialog";
import { EnviarFormularioDialog, type FormularioOpcao } from "@/components/enviar-formulario-dialog";
import { Badge } from "@/components/ui/badge";
import type { Dupla, Encerramento } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Seção "Encerramento" da ficha da dupla DPP — o rito de fechamento do guia.
 *  - Coordenação: checklist + decisão (concluir a jornada ou encerrar antes).
 *  - Mentor: a autoavaliação é a parte dele — form até a decisão, leitura depois.
 *  - Supervisor: acompanha o que já foi registrado.
 *  A row pode nascer só com a autoavaliação (tipo null = decisão pendente). */
export function EncerramentoDupla({
  dupla,
  encerramento,
  souMentor,
  souCoord,
  formularios,
  avaliacao360Em,
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
}) {
  const decidido = !!encerramento?.tipo;
  const aberta = dupla.status === "ativa" || dupla.status === "pausada";
  // supervisor sem row ainda não tem o que ver — a seção só existe quando há
  // conteúdo ou ação pra quem olha
  if (!souMentor && !souCoord && !encerramento) return null;
  // dupla já fechada sem row de encerramento (fechamento antigo, pré-0037):
  // a seção não inventa checklist — o resumo da jornada segue visível embaixo
  if (!aberta && !encerramento) return null;

  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Encerramento
        </h2>
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

      {/* checklist do rito — antes da decisão mostra o que já chegou
          (a autoavaliação é a única peça que não é clique da coordenação) */}
      <ul className="space-y-1">
        {CHECKLIST_ENCERRAMENTO.map((item) => {
          const feito =
            item.key === "autoavaliacao"
              ? !!encerramento?.autoavaliacao_mentor
              : !!encerramento?.checklist?.[item.key];
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
                aberta && (
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
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <PaperPlaneTilt size={12} aria-hidden />
                          Gerar link de avaliação
                        </button>
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
          {encerramento!.autoavaliacao_mentor && (
            <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">
                Autoavaliação de {dupla.mentor.nome.split(" ")[0]}
              </p>
              <p className="whitespace-pre-line">
                {encerramento!.autoavaliacao_mentor}
              </p>
              {encerramento!.disponivel_proximo_ciclo != null && (
                <p className="mt-1.5 flex items-center gap-1.5">
                  <CheckCircle
                    size={13}
                    aria-hidden
                    className={
                      encerramento!.disponivel_proximo_ciclo
                        ? "text-[var(--ok-text)]"
                        : "text-muted-foreground"
                    }
                  />
                  {encerramento!.disponivel_proximo_ciclo
                    ? "Disponível pro próximo ciclo"
                    : "Não segue no próximo ciclo"}
                </p>
              )}
            </blockquote>
          )}
          <p className="text-xs text-muted-foreground">
            Registrado por {encerramento!.decidido?.nome ?? "a coordenação"} ·{" "}
            {formatDateTime(encerramento!.created_at)}
          </p>
        </>
      ) : (
        <>
          {/* a parte do mentor no rito — ele preenche aqui, antes da decisão */}
          {souMentor && aberta && (
            <AutoavaliacaoMentorForm
              duplaId={dupla.id}
              inicial={
                encerramento?.autoavaliacao_mentor
                  ? {
                      texto: encerramento.autoavaliacao_mentor,
                      disponivel: encerramento.disponivel_proximo_ciclo ?? true,
                    }
                  : null
              }
            />
          )}
          {souCoord && aberta && (
            <>
              {encerramento?.autoavaliacao_mentor ? (
                <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">
                    Autoavaliação de {dupla.mentor.nome.split(" ")[0]}
                  </p>
                  <p className="whitespace-pre-line line-clamp-4">
                    {encerramento.autoavaliacao_mentor}
                  </p>
                  <p className="mt-1">
                    {encerramento.disponivel_proximo_ciclo
                      ? "Disponível pro próximo ciclo."
                      : "Não segue no próximo ciclo."}
                  </p>
                </blockquote>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A autoavaliação do mentor ainda não chegou. Ele preenche
                  aqui na ficha.
                </p>
              )}
              <EncerrarDuplaDialog duplaId={dupla.id} encerramento={encerramento} />
            </>
          )}
          {!souMentor && !souCoord && (
            <p className="text-xs text-muted-foreground">
              A coordenação registra o fechamento no fim da jornada. O que já
              chegou aparece marcado acima.
            </p>
          )}
        </>
      )}
    </section>
  );
}
