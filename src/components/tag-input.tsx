"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { cn } from "cn";

/** Teto default = CHECK profiles_areas_ok (0030). Interesses (0034,
 *  interesses_ok) permite 60 por tag — o caller passa `maxChars=60`. */
const TAG_MAX_CHARS = 40;

/** chave de dedupe — case-insensitive: "Finanças" e "finanças" são a mesma tag */
const chave = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** Chips clicáveis + input livre (Enter ou botão "+") — padrão do onboarding.
 *  Tags digitadas entram na MESMA lista de chips das sugestões: clicar faz
 *  toggle (seleciona/remove) e o dedupe é case-insensitive. O valor viaja no
 *  FormData como JSON (`["a","b"]`) no campo oculto `name` — a action faz
 *  JSON.parse (camposApresentacao aceita JSON ou CSV). */
export function TagInput({
  name,
  sugestoes,
  value,
  onChange,
  max = 10,
  maxChars = TAG_MAX_CHARS,
  placeholder = "Outra área…",
  inputLabel,
}: {
  /** campo oculto que vai pro FormData — JSON array, o caller parseia */
  name: string;
  /** chips predefinidos */
  sugestoes: string[];
  /** tags selecionadas (controlado) */
  value: string[];
  onChange: (areas: string[]) => void;
  /** teto de tags — profiles_areas_ok fecha em 10 no banco (interesses: 20) */
  max?: number;
  /** teto de caracteres por tag — CHECK interesses_ok permite 60 */
  maxChars?: number;
  placeholder?: string;
  /** o label externo cobre o grupo, não este campo — nome acessível do input livre */
  inputLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const cheio = value.length >= max;

  // lista única de chips: sugestões primeiro, digitadas entram no fim — a
  // primeira ocorrência (case-insensitive) define o rótulo exibido
  const chips: string[] = [];
  const vistos = new Set<string>();
  for (const t of [...sugestoes, ...value]) {
    const k = chave(t);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    chips.push(t);
  }
  const selecionadas = new Set(value.map(chave));

  function alternar(tag: string) {
    const k = chave(tag);
    if (selecionadas.has(k)) {
      onChange(value.filter((v) => chave(v) !== k));
    } else if (!cheio) {
      onChange([...value, tag]);
    }
  }

  function adicionar() {
    const tag = draft.trim();
    setDraft("");
    // maxLength já impede digitar além do teto — o guard cobre colagem e afins
    if (!tag || tag.length > maxChars || cheio) return;
    if (selecionadas.has(chave(tag))) return;
    // digitou uma sugestão com outra caixa? grava o rótulo canônico dela
    const canonica = sugestoes.find((s) => chave(s) === chave(tag));
    onChange([...value, canonica ?? tag]);
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <div className="flex flex-wrap gap-2">
        {chips.map((tag) => {
          const ativa = selecionadas.has(chave(tag));
          return (
            <button
              key={chave(tag)}
              type="button"
              aria-pressed={ativa}
              // no teto só dá pra remover — selecionar chip novo fica off
              disabled={cheio && !ativa}
              onClick={() => alternar(tag)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-all outline-none active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
                ativa
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // dentro de form, Enter submeteria o wizard
              adicionar();
            }
          }}
          maxLength={maxChars}
          disabled={cheio}
          placeholder={placeholder}
          aria-label={inputLabel ?? placeholder}
          className="min-w-0 flex-1 rounded-full border border-input bg-transparent px-4 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-snappy placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={cheio || !draft.trim()}
          aria-label="Adicionar"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-all outline-none hover:bg-primary/80 active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <Plus size={16} weight="bold" aria-hidden />
        </button>
      </div>
      {/* contador vira o aviso de teto — aria-live anuncia a virada */}
      <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
        {cheio
          ? `Máximo de ${max} — remova uma para trocar.`
          : `${value.length}/${max}`}
      </p>
    </div>
  );
}
