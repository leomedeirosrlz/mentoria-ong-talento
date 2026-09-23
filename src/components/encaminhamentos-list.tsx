"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  editarEncaminhamento,
  excluirEncaminhamento,
  toggleEncaminhamento,
} from "@/lib/actions";
import { formatDate } from "@/lib/ciclo";
import type { Encaminhamento } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
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
  // um dialog compartilhado pros dois fluxos — o item alvo fica em estado
  const [editando, setEditando] = useState<Encaminhamento | null>(null);
  const [descLen, setDescLen] = useState(0);
  const [excluindo, setExcluindo] = useState<Encaminhamento | null>(null);
  const router = useRouter();

  if (itens.length === 0)
    // vazio explica de onde os combinados nascem (o registro do encontro) —
    // não há ação solta aqui porque criar encaminhamento é parte do follow-up
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhum combinado por aqui ainda — eles saem do registro de cada encontro.
      </p>
    );

  const ordenados = [...itens].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
  });

  return (
    <>
      <ul className="divide-y divide-border">
        {ordenados.map((t) => {
          const vencido = t.status === "pendente" && t.prazo && t.prazo < hoje;
          const criadoNo = t.registro_id ? encontroNumeroPorRegistroId?.[t.registro_id] : undefined;
          // spans com block — o mesmo conteúdo vai dentro do botão/checkbox
          // interativo (só phrasing content é válido ali) e do div read-only
          const texto = (
            <span className="block min-w-0 flex-1">
              <span className={cn("block break-words text-sm", t.status === "feito" && "line-through text-muted-foreground")}>
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
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Opções do combinado "${t.descricao}"`}
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
              >
                <DotsThree size={18} weight="bold" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => { setEditando(t); setDescLen(t.descricao.length); }}>
                  <PencilSimple aria-hidden /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(t)}>
                  <Trash aria-hidden /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );

          return (
            <li key={t.id} className="flex items-start gap-1">
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
                      start(async () => {
                        try {
                          const res = await toggleEncaminhamento(t.id, t.status !== "feito", duplaId);
                          if (res?.error) toast.error(res.error);
                          else router.refresh();
                        } catch {
                          toast.error("Sem conexão — tente de novo.");
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
                        ? "border-[var(--ok)] bg-[var(--ok)] text-white"
                        : "border-muted-foreground/40 group-hover:border-foreground"
                    )}
                  >
                    {t.status === "feito" && (
                      <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
                        <path d="M1 4l2.5 2.5L9 1" />
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
            </li>
          );
        })}
      </ul>

      {/* edição — um dialog por lista; os defaults vêm do item alvo */}
      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar combinado</DialogTitle>
          </DialogHeader>
          {editando && (
            <form
              key={editando.id}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  try {
                    const res = await editarEncaminhamento(editando.id, duplaId, fd);
                    if (res?.error) toast.error(res.error);
                    else {
                      toast.success("Combinado atualizado.");
                      setEditando(null);
                      router.refresh();
                    }
                  } catch {
                    toast.error("Sem conexão — tente de novo.");
                  }
                });
              }}
            >
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="enc-descricao">O que ficou combinado</Label>
                  <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                    {descLen}/500
                  </span>
                </div>
                <Input
                  id="enc-descricao"
                  name="descricao"
                  required
                  maxLength={500}
                  defaultValue={editando.descricao}
                  onChange={(e) => setDescLen(e.target.value.length)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label id="enc-resp-label">Quem faz</Label>
                  <Select name="responsavel" defaultValue={editando.responsavel}>
                    <SelectTrigger aria-labelledby="enc-resp-label"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mentorado">Mentorado</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="enc-prazo">Prazo</Label>
                  <Input id="enc-prazo" name="prazo" type="date" defaultValue={editando.prazo ?? ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteButton
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        titulo="Excluir combinado?"
        descricao={
          excluindo
            ? `"${excluindo.descricao}" sai da lista da dupla.`
            : ""
        }
        sucesso="Combinado excluído."
        onConfirm={() => excluindo ? excluirEncaminhamento(excluindo.id, duplaId) : Promise.resolve({})}
      />
    </>
  );
}
