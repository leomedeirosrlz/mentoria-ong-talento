"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ListChecks } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  editarEncaminhamento,
  excluirEncaminhamento,
  toggleEncaminhamento,
} from "@/lib/actions";
import { formatDate } from "@/lib/ciclo";
import type { Encaminhamento } from "@/lib/types";
import {
  CombinadoMenu,
  EditarCombinadoDialog,
  ExcluirCombinadoConfirm,
} from "@/components/combinado-acoes";
import { T } from "@/components/motion";
import { cn } from "@/lib/utils";

export function EncaminhamentosList({
  itens,
  duplaId,
  podeEditar,
  podeMarcar,
  hoje,
  encontroNumeroPorRegistroId,
}: {
  itens: Encaminhamento[];
  duplaId: string;
  /** editar/excluir o texto do acordo — só o mentor da dupla */
  podeEditar: boolean;
  /** marcar como feito — a coord pode marcar como correção operacional */
  podeMarcar?: boolean;
  /** "YYYY-MM-DD" no fuso do programa — vem do server pra hidratar igual. */
  hoje: string;
  /** registro_id → número do encontro; itens criados à mão não têm registro_id. */
  encontroNumeroPorRegistroId?: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // ids marcados "feito" nesta sessão — só eles ganham o check animado;
  // itens que já chegam feitos do server não celebram de novo a cada mount
  const [feitosAgora, setFeitosAgora] = useState<ReadonlySet<string>>(new Set());
  // um dialog compartilhado pros dois fluxos — o item alvo fica em estado
  const [editando, setEditando] = useState<Encaminhamento | null>(null);
  const [excluindo, setExcluindo] = useState<Encaminhamento | null>(null);
  const router = useRouter();

  if (itens.length === 0)
    // vazio explica de onde os combinados nascem (o registro do encontro) —
    // não há ação solta aqui porque criar encaminhamento é parte do follow-up
    return (
      <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <ListChecks size={18} aria-hidden />
        </span>
        Nenhum combinado por aqui ainda: eles saem do registro de cada encontro.
      </p>
    );

  const ordenados = [...itens].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
  });

  return (
    <>
      <ul className="divide-y divide-border/60">
        {ordenados.map((t) => {
          const vencido = t.status === "pendente" && t.prazo && t.prazo < hoje;
          const criadoNo = t.registro_id ? encontroNumeroPorRegistroId?.[t.registro_id] : undefined;
          // spans com block — o mesmo conteúdo vai dentro do botão/checkbox
          // interativo (só phrasing content é válido ali) e do div read-only
          const texto = (
            <span className="block min-w-0 flex-1">
              {/* a cor transiciona (transition-colors); o riscado é binário —
                  text-decoration não anima e manter o line-through sempre
                  ativo com cor transparente entregaria "texto suprimido"
                  pra leitor de tela */}
              <span className={cn("block break-words text-sm transition-colors", t.status === "feito" && "line-through text-muted-foreground")}>
                {t.descricao}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {/* dot de papel só no mentorado (§1); mentor fica só no texto */}
                {t.responsavel === "mentor" ? (
                  "Mentor"
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                    Mentorado
                  </span>
                )}
                {t.prazo && (
                  <span className={vencido ? "text-[var(--danger)] font-medium" : ""}>
                    {" "}· até {formatDate(t.prazo)}{vencido ? " (vencido)" : ""}
                  </span>
                )}
                {criadoNo != null && (
                  <span className="text-[11px] text-muted-foreground"> · criado no {criadoNo}º encontro</span>
                )}
              </span>
            </span>
          );

          const menu = podeEditar && (
            <CombinadoMenu
              descricao={t.descricao}
              onEditar={() => setEditando(t)}
              onExcluir={() => setExcluindo(t)}
              className="mt-0.5 size-11 shrink-0 sm:size-8"
            />
          );

          return (
            // layout: marcar "feito" reordena (pendentes primeiro) — a linha
            // desliza pro novo lugar em vez de teleportar; reduced-motion
            // desliga via MotionConfig global
            <motion.li
              key={t.id}
              // #combinado-<id>: os CTAs de "combinado vencido" (home, agenda)
              // pousam no item exato — lá o checkbox marca na hora
              id={`combinado-${t.id}`}
              layout
              transition={T.panel}
              className="flex scroll-mt-20 items-start gap-1"
            >
              {podeEditar || podeMarcar ? (
                // checkbox nativo + label: teclado, estado e o clique no texto
                // funcionam sem ARIA manual; o quadrado é só a representação
                <label
                  className={cn(
                    "group flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3 transition-colors",
                    pending && pendingId === t.id && "opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={t.status === "feito"}
                    disabled={pending && pendingId === t.id}
                    onChange={() => {
                      setPendingId(t.id);
                      if (t.status !== "feito")
                        setFeitosAgora((s) => new Set(s).add(t.id));
                      start(async () => {
                        try {
                          const res = await toggleEncaminhamento(t.id, t.status !== "feito", duplaId);
                          if (res?.error) toast.error(res.error);
                          else router.refresh();
                        } catch {
                          toast.error("Sem conexão. Tente de novo.");
                        } finally {
                          setPendingId(null);
                        }
                      });
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
                      t.status === "feito"
                        ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]"
                        : "border-muted-foreground/40 group-hover:border-foreground"
                    )}
                  >
                    {t.status === "feito" && (
                      // mesma coreografia do /auth/confirmado: o check entra
                      // com pop (svg) e se desenha (path) — keyframes
                      // confirm-pop/confirm-draw do globals, só no clique
                      // desta sessão (feitosAgora)
                      <svg
                        viewBox="0 0 10 8"
                        className={cn(
                          "size-2.5 fill-none stroke-current stroke-2",
                          feitosAgora.has(t.id) && "confirm-pop"
                        )}
                      >
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          className={cn(feitosAgora.has(t.id) && "confirm-draw")}
                        />
                      </svg>
                    )}
                  </span>
                  {texto}
                </label>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3 py-3">
                  {/* anel fino = gramática de leitura, não de controle — o dot
                      cheio redondo parecia o checkbox interativo desabilitado */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 size-2.5 rounded-full border-2 shrink-0",
                      t.status === "feito"
                        ? "border-[var(--ok)]"
                        : vencido
                          ? "border-[var(--danger)]"
                          : "border-[var(--warn)]"
                    )}
                  />
                  {texto}
                </div>
              )}
              {menu}
            </motion.li>
          );
        })}
      </ul>

      {/* edição e exclusão — um dialog por lista; os defaults vêm do item
          alvo (componentes compartilhados com o card do encontro) */}
      <EditarCombinadoDialog
        editando={editando}
        onOpenChange={(o) => !o && setEditando(null)}
        onSalvar={(fd) =>
          editando
            ? editarEncaminhamento(editando.id, duplaId, fd)
            : Promise.resolve({})
        }
      />

      <ExcluirCombinadoConfirm
        excluindo={excluindo}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => excluindo ? excluirEncaminhamento(excluindo.id, duplaId) : Promise.resolve({})}
      />
    </>
  );
}
