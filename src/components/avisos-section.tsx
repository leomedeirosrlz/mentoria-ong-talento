"use client";

import { useState, useTransition } from "react";
import { DotsThreeVertical, Flag, Megaphone, Siren, Trash, CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ExitItem, ExitList } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { excluirComunicado } from "@/lib/actions";
import { reenviarComunicadoEmail } from "@/lib/actions-email";
import { formatDiaMes } from "@/lib/ciclo";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NovoComunicadoDialog } from "@/components/novo-comunicado-dialog";
import { cn } from "@/lib/utils";
import type { Comunicado } from "@/lib/types";

const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  equipe: "Equipe",
  coordenacao: "Só a coordenação",
} as const;

/** Três canais pra urgência, cor nunca sozinha: superfície tingida do
 *  article + badge com ícone e rótulo — 'normal' é null e fica linha
 *  plana de texto (a diferença é estrutural, não só hue). Lime fica fora
 *  da escala: é marca/navegação, não urgência. */
const PRIORIDADE = {
  urgente: {
    tinte: "bg-[var(--danger)]/8",
    icone: Siren,
    texto: "Urgente",
    cls: "border-[var(--danger)]/50 text-[var(--danger)]",
  },
  importante: {
    tinte: "bg-[var(--warn)]/10",
    icone: Flag,
    texto: "Importante",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  normal: null,
} as const;

/** Avisos gerais da coordenação — seção compartilhada da home, recolhida por
 *  padrão com o contador no título. O sino aponta pra `/#avisos`: o `details`
 *  com esse id abre sozinho no navegador (fragmento revela o conteúdo). A
 *  ordem vem do servidor (prioridade + recência) — não reordenar aqui. Sem
 *  avisos: só a coord vê o convite; demais papéis não pagam custo de layout.
 *  Ações da coordenação (reenviar e-mail, excluir) moram no ⋯ de cada aviso. */
export function AvisosSection({
  avisos,
  souCoord,
  className,
}: {
  avisos: Comunicado[];
  souCoord: boolean;
  /** placement no grid da home — merge no <details> raiz */
  className?: string;
}) {
  if (!avisos.length && !souCoord) return null;

  return (
    <details id="avisos" className={cn("group scroll-mt-20", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg py-2 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <h2 className="flex items-baseline gap-1.5 text-base font-semibold">
          <Megaphone size={16} className="self-center text-muted-foreground" aria-hidden />
          Avisos
          <span className="text-sm font-normal tabular-nums text-muted-foreground">
            ({avisos.length})
          </span>
        </h2>
        <CaretDown
          size={14}
          aria-hidden
          className="ms-auto shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="mt-2 space-y-3">
        {souCoord && (
          <div className="flex justify-end">
            <NovoComunicadoDialog variant="outline" />
          </div>
        )}

        {avisos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2.5 py-6 text-center text-sm text-muted-foreground">
              <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Megaphone size={18} aria-hidden />
              </span>
              <p>
                Nenhum aviso publicado. O primeiro chega a quem você escolher no
                campo Quem recebe.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y divide-border/60 p-0">
              {/* saída animada por props (refresh-puro): a remoção chega via
                  router.refresh() do ConfirmDeleteButton e o AnimatePresence
                  segura o exit. Último item é a exceção: esvaziar troca o Card
                  pelo estado vazio e corta o exit, que é honesto pra 220ms */}
              <ExitList>
                {avisos.map((a) => {
                  const prio = PRIORIDADE[a.prioridade];
                  const Icone = prio?.icone;
                  return (
                    <ExitItem
                      tag="article"
                      key={a.id}
                      className={cn("px-4 py-3 sm:px-5", prio?.tinte)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {prio && Icone && (
                              <Badge variant="outline" className={prio.cls}>
                                <Icone data-icon="inline-start" aria-hidden />
                                {prio.texto}
                              </Badge>
                            )}
                            {/* o título nunca trunca: quebra linha */}
                            <p className="min-w-0 text-sm font-medium">{a.titulo}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDiaMes(a.created_at)} · {AUDIENCIA_LABEL[a.audiencia]}
                          </p>
                        </div>
                        {souCoord && <AvisoAcoes aviso={a} />}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {a.corpo}
                      </p>
                    </ExitItem>
                  );
                })}
              </ExitList>
            </CardContent>
          </Card>
        )}
      </div>
    </details>
  );
}

/** ⋯ do aviso: reenviar por e-mail (quem entrou depois, caixa perdida) e
 *  excluir. O diálogo de exclusão é controlado pelo menu, como no documento
 *  de pessoa. */
function AvisoAcoes({ aviso }: { aviso: Comunicado }) {
  const [excluindo, setExcluindo] = useState(false);
  const [enviando, startEnvio] = useTransition();

  function reenviar() {
    startEnvio(async () => {
      try {
        const fd = new FormData();
        fd.set("comunicado_id", aviso.id);
        const r = await reenviarComunicadoEmail(fd);
        if ("error" in r && r.error) {
          toast.error(r.error);
          return;
        }
        const ok = r as { enviados?: number; destinatarios?: number; falhas?: string[] };
        const enviados = ok.enviados ?? 0;
        const falhas = ok.falhas?.length ?? 0;
        const total = ok.destinatarios ?? enviados + falhas;
        if (falhas) {
          toast.warning(
            `E-mail enviado para ${enviados} de ${total}: ${falhas} ${falhas === 1 ? "falhou" : "falharam"}.`
          );
        } else {
          toast.success(
            `E-mail enviado para ${enviados} ${enviados === 1 ? "pessoa" : "pessoas"}.`
          );
        }
      } catch {
        toast.error("Não consegui reenviar agora. Tente de novo.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Ações do aviso "${aviso.titulo}"`}
          aria-busy={enviando || undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-11 shrink-0 sm:size-8"
          )}
        >
          <DotsThreeVertical size={18} weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={enviando} onClick={reenviar}>
            Reenviar por e-mail
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
            <Trash size={16} data-icon="inline-start" aria-hidden />
            Excluir aviso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteButton
        open={excluindo}
        onOpenChange={setExcluindo}
        titulo={`Excluir "${aviso.titulo}"?`}
        descricao="O aviso sai da home de todo mundo e as notificações dele são removidas. Para corrigir, publique um novo."
        sucesso="Aviso excluído."
        onConfirm={() => excluirComunicado(aviso.id)}
      />
    </>
  );
}
