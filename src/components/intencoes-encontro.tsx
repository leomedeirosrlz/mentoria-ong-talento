"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  criarIntencao,
  marcarIntencao,
  removerIntencao,
} from "@/lib/actions";
import { demoAtivoClient } from "@/lib/demo/shared";
import type { EncontroIntencao } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Checklist de intenções do mentor por encontro (REALIZA-21) — itens
 *  acionáveis que vivem sob a nota livre: a nota responde "como quero
 *  conduzir", as intenções respondem "o que não posso esquecer". Chave
 *  (dupla_id, numero) como a nota: precede o agendamento e segue o nº do
 *  guia. Pendentes de nº anteriores reaparecem aqui taggeados "do Nº
 *  encontro" — a origem evita ler pendência antiga como item novo. */
export function IntencoesEncontro({
  duplaId,
  numero,
  itens,
  pendentesAnteriores = [],
  somenteLeitura,
}: {
  duplaId: string;
  /** nº do passo do guia — a âncora da checklist (não o encontro físico). */
  numero: number;
  /** Itens deste nº (feitos e pendentes). */
  itens: EncontroIntencao[];
  /** Pendentes de nºs anteriores — carry-over marcável aqui mesmo. */
  pendentesAnteriores?: EncontroIntencao[];
  /** coord/sup, dupla inativa: lista pra ler, sem inputs; null quando vazia. */
  somenteLeitura?: boolean;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const router = useRouter();
  // demo: criar/marcar/remover funcionam em estado local — nenhuma action
  // dispara (seria toast DEMO_MSG por gesto) e nada sobra pro próximo visitante
  const [demo] = useState(demoAtivoClient);
  const [itensLoc, setItensLoc] = useState(itens);
  const [antLoc, setAntLoc] = useState(pendentesAnteriores);
  const lista = (demo ? itensLoc : itens)
    .slice()
    .sort((a, b) =>
      a.feito !== b.feito
        ? a.feito
          ? 1
          : -1
        : a.created_at.localeCompare(b.created_at)
    );
  const anteriores = (demo ? antLoc : pendentesAnteriores)
    .slice()
    .sort((a, b) => a.numero - b.numero || a.created_at.localeCompare(b.created_at));

  function toggle(t: EncontroIntencao, carryOver: boolean) {
    if (demo) {
      // item feito sai do "De antes" (o recorte é !feito); item próprio fica
      // na lista, riscado — mesmo resultado do refresh contra o banco
      if (carryOver && !t.feito) {
        setAntLoc((l) => l.filter((x) => x.id !== t.id));
      } else {
        (carryOver ? setAntLoc : setItensLoc)((l) =>
          l.map((x) =>
            x.id === t.id
              ? {
                  ...x,
                  feito: !t.feito,
                  feito_em: !t.feito ? new Date().toISOString() : null,
                }
              : x
          )
        );
      }
      return;
    }
    setPendingId(t.id);
    start(async () => {
      try {
        const res = await marcarIntencao(t.id, !t.feito);
        if (res?.error) toast.error(res.error);
        else router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function remover(t: EncontroIntencao, carryOver: boolean) {
    if (demo) {
      (carryOver ? setAntLoc : setItensLoc)((l) =>
        l.filter((x) => x.id !== t.id)
      );
      return;
    }
    setPendingId(t.id);
    start(async () => {
      try {
        const res = await removerIntencao(t.id);
        if (res?.error) toast.error(res.error);
        else router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function adicionar() {
    const limpo = novo.trim();
    if (!limpo || pending) return;
    setNovo("");
    if (demo) {
      const agora = new Date().toISOString();
      setItensLoc((l) => [
        ...l,
        {
          id: crypto.randomUUID(),
          dupla_id: duplaId,
          numero,
          texto: limpo,
          feito: false,
          feito_em: null,
          created_by: null,
          created_at: agora,
          updated_at: agora,
        },
      ]);
      return;
    }
    start(async () => {
      try {
        const res = await criarIntencao(duplaId, numero, limpo);
        if (res?.error) {
          toast.error(res.error);
          setNovo(limpo); // devolve o texto — a digitação não se perde
        } else {
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        setNovo(limpo);
      }
    });
  }

  const pendentes = lista.filter((i) => !i.feito).length + anteriores.length;
  const total = lista.length + anteriores.length;
  const sufixo =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}`
      : total > 0
        ? "tudo feito"
        : null;

  const texto = (t: EncontroIntencao, carryOver: boolean) => (
    <span className="block min-w-0 flex-1">
      {/* o riscado é binário como nos combinados — text-decoration não
          anima e um line-through sempre ativo entregaria "texto suprimido"
          pra leitor de tela */}
      <span
        className={cn(
          "block break-words text-sm transition-colors",
          t.feito && "text-muted-foreground line-through"
        )}
      >
        {carryOver && (
          <span className="text-muted-foreground">
            do {t.numero}º encontro ·{" "}
          </span>
        )}
        {t.texto}
      </span>
    </span>
  );

  // checkbox nativo + label — teclado e clique no texto de graça; o quadrado
  // estilizado é só a representação (mesmo padrão das listas de combinados)
  const itemEditavel = (t: EncontroIntencao, carryOver: boolean) => (
    <li key={t.id} className="flex items-start gap-1">
      <label
        className={cn(
          "group flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-2 transition-colors",
          pending && pendingId === t.id && "opacity-60"
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={t.feito}
          disabled={pending && pendingId === t.id}
          onChange={() => toggle(t, carryOver)}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
            t.feito
              ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]"
              : "border-muted-foreground/40 group-hover:border-foreground"
          )}
        >
          {t.feito && (
            <svg
              viewBox="0 0 10 8"
              className="size-2.5 fill-none stroke-current stroke-2"
            >
              <path d="M1 4l2.5 2.5L9 1" />
            </svg>
          )}
        </span>
        {texto(t, carryOver)}
      </label>
      {/* × sempre visível em opacity-60 — "só no hover" não existe no touch;
          sobe pra 100 no hover/focus do grupo */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remover afazer"
        disabled={pending && pendingId === t.id}
        onClick={() => remover(t, carryOver)}
        className="mt-1.5 size-8 shrink-0 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={14} aria-hidden />
      </Button>
    </li>
  );

  // leitura: anel fino é gramática de status, não de controle — um quadrado
  // pareceria checkbox desabilitado (mesma leitura da lista de combinados)
  const itemLeitura = (t: EncontroIntencao, carryOver: boolean) => (
    <li key={t.id} className="flex items-start gap-3 py-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2.5 shrink-0 rounded-full border-2",
          t.feito ? "border-[var(--ok)]" : "border-muted-foreground/50"
        )}
      />
      {texto(t, carryOver)}
    </li>
  );

  if (somenteLeitura) {
    if (total === 0) return null;
    return (
      <div id={`intencoes-${numero}`} className="scroll-mt-20">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
          Afazeres
        </p>
        {lista.length > 0 && (
          <ul>{lista.map((t) => itemLeitura(t, false))}</ul>
        )}
        {anteriores.length > 0 && (
          <>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              De antes
            </p>
            <ul>{anteriores.map((t) => itemLeitura(t, true))}</ul>
          </>
        )}
      </div>
    );
  }

  return (
    <div id={`intencoes-${numero}`} className="scroll-mt-20">
      <Collapsible.Root>
        <Collapsible.Trigger className="group grid min-h-11 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9">
          <span className="font-medium text-foreground/80">Afazeres</span>
          {sufixo && (
            <span className="min-w-0 truncate text-muted-foreground">
              · {sufixo}
            </span>
          )}
          <CaretDown
            size={14}
            aria-hidden
            className="col-start-3 justify-self-end text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </Collapsible.Trigger>
        {/* itens e o rascunho moram no estado acima — fechar desmonta o painel
            sem perder o que estava sendo digitado */}
        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <div className="pb-1 pl-0.5">
            {total === 0 && (
              <p className="py-1 text-sm text-muted-foreground">
                Coisas que precisam acontecer neste encontro, ex.: enviar
                material depois.
              </p>
            )}
            {lista.length > 0 && (
              <ul className="divide-y divide-border/60">
                {lista.map((t) => itemEditavel(t, false))}
              </ul>
            )}
            {anteriores.length > 0 && (
              <div className={cn(lista.length > 0 && "border-t border-border/60")}>
                <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  De antes
                </p>
                <ul className="divide-y divide-border/60">
                  {anteriores.map((t) => itemEditavel(t, true))}
                </ul>
              </div>
            )}
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                adicionar();
              }}
            >
              <Input
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onBlur={() => novo.trim() && adicionar()}
                maxLength={280}
                placeholder="Adicionar afazer…"
                aria-label={`Novo afazer do ${numero}º encontro`}
                disabled={pending}
                className="h-9 border-0 bg-muted/40 px-3 shadow-none focus-visible:ring-1"
              />
              {/* contador do maxLength — some quando o campo está vazio pra
                  não pesar a linha (a régua 1-280 é do CHECK da tabela) */}
              {novo.length > 0 && (
                <span
                  aria-hidden
                  className="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {novo.length}/280
                </span>
              )}
            </form>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
