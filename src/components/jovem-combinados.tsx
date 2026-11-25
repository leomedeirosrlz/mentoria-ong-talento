"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown, ListChecks, Plus, X } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { criarCombinadoJovem, marcarCombinadoFeito } from "@/lib/actions";
import { formatDate } from "@/lib/ciclo";
import { demoAtivoClient } from "@/lib/demo/shared";
import { novoUuid } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { JovemEncaminhamento } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Combinados do jovem (REALIZA-108, criação na 526): os abertos ficam à
 *  vista, os feitos recolhem em "Ver N feitos". Dois gestos: marcar feito
 *  (checkbox → RPC marcar_combinado, transição pendente↔feito) e criar —
 *  "+ Adicionar combinado" grava um combinado "livre" dele (sem âncora de
 *  encontro, sempre responsavel='mentorado'). Editar/excluir segue fora:
 *  quem criou no encontro foi o mentor; o que o jovem cria é dele e só ele
 *  marca. "Vencido" deriva de prazo na UI — 'atrasado' é valor-fantasma do
 *  enum, não se grava. Na demo a mutação é estado local, como na lista do
 *  staff (CombinadosEncontro). */
export function JovemCombinados({
  itens,
  hoje,
  duplaId,
}: {
  itens: JovemEncaminhamento[];
  /** "YYYY-MM-DD" no fuso do programa — vem do server pra hidratar igual. */
  hoje: string;
  /** Dupla em curso (ativa|pausada) — null esconde o "+ Adicionar". */
  duplaId: string | null;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const [prazo, setPrazo] = useState("");
  const router = useRouter();
  // demo: criar/marcar mexem em estado local — nenhuma action roda (o
  // stub recusa escrita com DEMO_MSG; o gesto segue funcionando)
  const [demo] = useState(demoAtivoClient);
  const [itensLoc, setItensLoc] = useState<JovemEncaminhamento[]>(itens);

  const lista = demo ? itensLoc : itens;

  function marcar(t: JovemEncaminhamento & { id: string }, feito: boolean) {
    if (demo) {
      setItensLoc((l) =>
        l.map((x) =>
          x.id === t.id
            ? { ...x, status: feito ? "feito" : "pendente" }
            : x
        )
      );
      if (feito) toast.success("Combinado marcado como feito.");
      return;
    }
    setPendingId(t.id);
    start(async () => {
      try {
        const res = await marcarCombinadoFeito(t.id, feito);
        if (res?.error) toast.error(res.error);
        else {
          if (feito) toast.success("Combinado marcado como feito.");
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function adicionar() {
    const limpo = novo.trim();
    if (limpo.length < 2 || !duplaId) return;
    const prazoLimpo = prazo.trim();
    setNovo("");
    setPrazo("");
    if (demo) {
      setItensLoc((l) => [
        ...l,
        {
          id: novoUuid(),
          dupla_id: duplaId,
          descricao: limpo,
          prazo: prazoLimpo || null,
          status: "pendente",
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }
    start(async () => {
      try {
        const res = await criarCombinadoJovem(duplaId, limpo, prazoLimpo || null);
        if (res?.error) {
          toast.error(res.error);
          setNovo(limpo);
          setPrazo(prazoLimpo);
        } else {
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        setNovo(limpo);
        setPrazo(prazoLimpo);
      }
    });
  }

  const formNovo = duplaId && (
    formAberto ? (
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFormAberto(false);
            setNovo("");
            setPrazo("");
          }
        }}
      >
        <Input
          autoFocus
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={500}
          placeholder="O que você combinou de fazer…"
          aria-label="Novo combinado"
          disabled={pending}
          className="h-9 min-w-0 flex-1 basis-48 border-0 bg-muted/40 px-3 shadow-none focus-visible:ring-1"
        />
        <Input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          aria-label="Prazo (opcional)"
          disabled={pending}
          className="h-9 w-40 shrink-0 border-0 bg-muted/40 px-3 shadow-none focus-visible:ring-1"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending || novo.trim().length < 2}
        >
          Adicionar
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Fechar"
          onClick={() => {
            setFormAberto(false);
            setNovo("");
            setPrazo("");
          }}
          className="text-muted-foreground"
        >
          <X aria-hidden />
        </Button>
      </form>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setFormAberto(true)}
        className="mt-1 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <Plus aria-hidden />
        Adicionar combinado
      </Button>
    )
  );

  // views geradas são all-nullable — encaminhamentos.id é NOT NULL no
  // banco; o filter estreita o tipo sem esconder rows inesperadas
  const ordenados = lista
    .filter((t): t is JovemEncaminhamento & { id: string } => t.id != null)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
      return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
    });
  const abertos = ordenados.filter((t) => t.status !== "feito");
  const feitos = ordenados.filter((t) => t.status === "feito");

  function renderItem(t: JovemEncaminhamento & { id: string }) {
    const feito = t.status === "feito";
    const vencido = !feito && t.prazo != null && t.prazo < hoje;
    return (
      <li key={t.id} className="flex items-start gap-1">
        <label
          className={cn(
            "group flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3 transition-colors",
            pending && pendingId === t.id && "opacity-60"
          )}
          onClick={(e) => {
            // o Checkbox do kit é span role=checkbox — <label> não encaminha
            // clique pra ele como fazia com o input nativo. Sem isto, tocar
            // no texto do combinado não marcava nada.
            if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
            e.preventDefault();
            e.currentTarget
              .querySelector<HTMLElement>('[role="checkbox"]')
              ?.click();
          }}
        >
          {/* checkbox do kit dentro da label — teclado e clique no texto de
              graça (mesmo padrão da lista de staff) */}
          <Checkbox
            checked={feito}
            disabled={pending && pendingId === t.id}
            onCheckedChange={(marcado) => marcar(t, !!marcado)}
            className="mt-0.5 group-hover:border-foreground"
          />
          <span className="block min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-sm",
                feito && "text-muted-foreground line-through"
              )}
            >
              {t.descricao}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {feito ? (
                "Feito"
              ) : t.prazo ? (
                <span className={vencido ? "font-medium text-[var(--warn-text)]" : ""}>
                  até {formatDate(t.prazo)}
                  {vencido ? ", passou do prazo, vale fazer mesmo assim" : ""}
                </span>
              ) : (
                "Sem prazo"
              )}
            </span>
          </span>
        </label>
      </li>
    );
  }

  if (ordenados.length === 0 && !duplaId) {
    return (
      <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <ListChecks size={18} aria-hidden />
        </span>
        Nenhum combinado por aqui ainda: eles saem do papo com seu mentor em
        cada encontro.
      </p>
    );
  }

  return (
    <div>
      {abertos.length > 0 ? (
        <ul className="divide-y divide-border/60">{abertos.map(renderItem)}</ul>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">
          {duplaId
            ? "Nenhum combinado aberto. Anote o que você combinar de fazer."
            : "Tudo em dia. Nenhum combinado aberto."}
        </p>
      )}
      {formNovo}

      {feitos.length > 0 && (
        <Collapsible.Root
          className={cn(
            (abertos.length > 0 || duplaId) && "border-t border-border/60"
          )}
        >
          <Collapsible.Trigger className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&[aria-expanded=true]>svg]:rotate-180">
            Ver {feitos.length} {feitos.length === 1 ? "feito" : "feitos"}
            <CaretDown size={16} aria-hidden className="shrink-0 transition-transform" />
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <ul className="divide-y divide-border/60">{feitos.map(renderItem)}</ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </div>
  );
}
