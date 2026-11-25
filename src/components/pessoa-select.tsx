"use client";

import { useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { fuzzyMatch } from "@/lib/fuzzy";
import { HighlightText } from "@/components/highlight-text";

/** Opção do seletor de pessoas — `meta` é o sufixo discreto da linha
 *  ("DPP 1/2 · sem vaga", "em dupla DPP"), `disabled` mantém a opção
 *  visível sem deixar escolher (o "por que não" fica no meta). */
export type PessoaOpcao = {
  value: string;
  label: string;
  meta?: string | null;
  disabled?: boolean;
};

/** Seletor de pessoas com busca fuzzy (REALIZA-391): o Select de ui/
 *  filtrava por typeahead de primeira letra; com dezenas de mentorados e
 *  mentores isso virava rolagem cega. Combobox com busca embutida — o
 *  campo abre com a lista inteira, digitar filtra e marca os trechos.
 *  Mesma gramática do Select: trigger de 44/32px, popup com scroll,
 *  check na opção ativa. `name`+`required` seguem valendo pra form. */
export function PessoaSelect({
  itens,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  placeholder = "Selecione",
  id,
  "aria-labelledby": ariaLabelledby,
  vazio = "Nenhuma pessoa cadastrada",
  buscaPlaceholder = "Buscar por nome",
  className,
}: {
  itens: PessoaOpcao[];
  /** controlado — id da opção ou null */
  value?: string | null;
  /** não-controlado (form lê via FormData) — id inicial */
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  "aria-labelledby"?: string;
  /** texto quando a LISTA veio vazia (não quando a busca zera) */
  vazio?: string;
  buscaPlaceholder?: string;
  className?: string;
}) {
  const [interno, setInterno] = useState<string | null>(defaultValue ?? null);
  const selId = value !== undefined ? value : interno;
  const [q, setQ] = useState("");

  const selObj = itens.find((i) => i.value === selId) ?? null;
  // fuzzy ranqueado: score desc, empate na ordem recebida (a relevância
  // dos callers — vagas livres primeiro etc. — segura o desempate)
  const visiveis = q.trim()
    ? itens
        .map((i) => ({ i, hit: fuzzyMatch(q, i.label) }))
        .filter((x): x is { i: PessoaOpcao; hit: NonNullable<typeof x.hit> } => x.hit != null)
        .sort((a, b) => b.hit.score - a.hit.score)
        .map((x) => x.i)
    : itens;

  return (
    <Combobox.Root
      items={itens}
      filteredItems={visiveis}
      value={selObj}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(v) => {
        const id = (v as PessoaOpcao | null)?.value ?? null;
        setInterno(id);
        onValueChange?.(id);
      }}
      inputValue={q}
      onInputValueChange={(v) => setQ(v)}
      onOpenChange={(open) => {
        // reabre limpa — a lista inteira de novo, sem a busca anterior
        if (!open) setQ("");
      }}
      itemToStringValue={(i) => i.value}
      name={name}
      required={required}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        type="button"
        aria-labelledby={ariaLabelledby}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground h-11 md:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
      >
        <Combobox.Value
          placeholder={
            <span className="text-muted-foreground">{placeholder}</span>
          }
        >
          {(v: PessoaOpcao | null) =>
            v ? (
              <span className="flex flex-1 items-center gap-1.5 truncate text-left">
                {v.label}
                {v.meta && (
                  <span className="truncate text-muted-foreground">
                    · {v.meta}
                  </span>
                )}
              </span>
            ) : null
          }
        </Combobox.Value>
        <Combobox.Icon
          render={
            <CaretDown className="pointer-events-none size-4 text-muted-foreground" />
          }
        />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          side="bottom"
          sideOffset={4}
          align="center"
          className="isolate z-50"
        >
          <Combobox.Popup className="relative isolate z-50 flex max-h-(--available-height) w-(--anchor-width) min-w-(--anchor-width) max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-[var(--shadow-overlay)] duration-150 ease-[cubic-bezier(0.2,0,0,1)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="relative shrink-0 border-b border-border">
              <MagnifyingGlass
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Combobox.Input
                placeholder={buscaPlaceholder}
                className="h-9 w-full bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.List className="scroll-my-1 overflow-y-auto p-1">
              {visiveis.map((o) => (
                <Combobox.Item
                  key={o.value}
                  value={o}
                  disabled={o.disabled}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden transition-colors select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <HighlightText texto={o.label} query={q} />
                    {o.meta && (
                      <span className="text-muted-foreground"> · {o.meta}</span>
                    )}
                  </span>
                  <Combobox.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center" />
                    }
                  >
                    <Check className="pointer-events-none" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              ))}
            </Combobox.List>
            <Combobox.Empty className="px-3 py-4 text-center text-sm text-muted-foreground">
              {q.trim() ? `Nenhum resultado para “${q.trim()}”.` : vazio}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
