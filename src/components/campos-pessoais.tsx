"use client";

import { useId } from "react";
import { cn } from "cn";
import {
  DIAS_SEMANA,
  DIAS_SEMANA_LABELS,
  ESCOLARIDADE_LABELS,
  GENERO_LABELS,
  INTERESSES_SUGESTOES,
  PERIODOS,
  PERIODOS_LABELS,
  PREF_GENERO_LABELS,
  UFS,
} from "@/lib/ciclo";
import type { DiaSemana, Disponibilidade, Periodo } from "@/lib/types";
import { TagInput } from "@/components/tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Sentinela dos Selects opcionais ("Não informado") — o action trata como
 *  vazio (mesmo contrato do `__nenhum` de supervisor nos dialogs de dupla). */
export const SENTINEL_VAZIO = "__nenhum";

/** Título de bloco dentro de dialog/form — mesma gramática dos uppercase
 *  de /pessoas/[id]: ficha longa vira seções em vez de parede de campos. */
export function SecaoFicha({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:border-t-0 first:pt-0">
      {children}
    </h3>
  );
}

/** Select de enum opcional — emite `name` com o valor cru ou a sentinela;
 *  controlado quando `value`/`onChange` vêm do caller (wizard remonta o
 *  passo, então lá o estado mora fora do input). */
export function SelectOpcional({
  id,
  name,
  label,
  opcoes,
  value,
  onChange,
  defaultValue,
  vazioLabel = "Não informado",
}: {
  id?: string;
  name: string;
  label: string;
  opcoes: Record<string, string>;
  value?: string | null;
  onChange?: (v: string) => void;
  defaultValue?: string | null;
  vazioLabel?: string;
}) {
  const autoId = useId();
  const labelId = `${autoId}-label`;
  const triggerId = id ?? `${autoId}-select`;
  const items = { [SENTINEL_VAZIO]: vazioLabel, ...opcoes };
  return (
    <div className="space-y-2">
      <Label id={labelId}>{label}</Label>
      <Select
        name={name}
        items={items}
        {...(value !== undefined
          ? {
              value: value || SENTINEL_VAZIO,
              // fora do JSX inline o genérico do Select cai pro default —
              // o cast é o mesmo do "v as Tipo" do importar-csv
              onValueChange: (v) => onChange?.((v as string | null) ?? SENTINEL_VAZIO),
            }
          : { defaultValue: defaultValue || SENTINEL_VAZIO })}
      >
        <SelectTrigger id={triggerId} aria-labelledby={`${labelId} ${triggerId}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Data de nascimento — `type="date"` já emite ISO; o action rejeita futura. */
export function CampoNascimento({
  id,
  value,
  onChange,
  defaultValue,
}: {
  id?: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Data de nascimento</Label>
      <Input
        id={id}
        name="data_nascimento"
        type="date"
        max="9999-12-31"
        {...(value !== undefined
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      />
    </div>
  );
}

/** Selects da ficha pessoal — atalhos sobre SelectOpcional com as opções do
 *  banco (CHECKs da 0034). */
export function CampoGenero(props: Omit<Parameters<typeof SelectOpcional>[0], "name" | "label" | "opcoes">) {
  return <SelectOpcional {...props} name="genero" label="Gênero" opcoes={GENERO_LABELS} />;
}

export function CampoPrefGenero(props: Omit<Parameters<typeof SelectOpcional>[0], "name" | "label" | "opcoes" | "vazioLabel">) {
  return (
    <SelectOpcional
      {...props}
      name="pref_genero_par"
      label="Preferência de gênero do par"
      opcoes={PREF_GENERO_LABELS}
      vazioLabel="Sem preferência informada"
    />
  );
}

export function CampoEscolaridade(props: Omit<Parameters<typeof SelectOpcional>[0], "name" | "label" | "opcoes">) {
  return <SelectOpcional {...props} name="escolaridade" label="Escolaridade" opcoes={ESCOLARIDADE_LABELS} />;
}

export function CampoUf(props: Omit<Parameters<typeof SelectOpcional>[0], "name" | "label" | "opcoes" | "vazioLabel">) {
  return (
    <SelectOpcional
      {...props}
      name="uf"
      label="UF"
      opcoes={Object.fromEntries(UFS.map((u) => [u, u]))}
      vazioLabel="—"
    />
  );
}

/** Interesses — TagInput com as sugestões do programa; teto/cap do CHECK
 *  interesses_ok (20 × 60 chars). Sempre controlado (value/onChange). */
export function CampoInteresses({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Interesses</Label>
      <TagInput
        name="interesses"
        sugestoes={INTERESSES_SUGESTOES}
        value={value}
        onChange={onChange}
        max={20}
        maxChars={60}
        placeholder="Outro interesse…"
        inputLabel="Digite um interesse e pressione Enter"
      />
    </div>
  );
}

/** Grade semanal do mentor — chips de dia × período; emite JSON no hidden
 *  `disponibilidade` ({"dias":[...],"periodos":[...]}) que o action valida
 *  contra o vocabulário do CHECK disponibilidade_ok. */
export function CampoDisponibilidade({
  value,
  onChange,
}: {
  value: Disponibilidade | null;
  onChange: (v: Disponibilidade | null) => void;
}) {
  const dias = new Set<DiaSemana>(value?.dias ?? []);
  const periodos = new Set<Periodo>(value?.periodos ?? []);

  const emitir = (d: Set<DiaSemana>, p: Set<Periodo>) =>
    onChange(d.size || p.size ? { dias: [...d], periodos: [...p] } : null);

  const toggle = <T,>(set: Set<T>, v: T): Set<T> => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  const chip = (ativo: boolean, rotulo: string, aoClicar: () => void) => (
    <button
      key={rotulo}
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-all outline-none active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {rotulo}
    </button>
  );

  return (
    <fieldset className="space-y-3">
      <input
        type="hidden"
        name="disponibilidade"
        value={JSON.stringify(value ?? { dias: [], periodos: [] })}
      />
      <legend className="sr-only">Disponibilidade semanal</legend>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Dias da semana</p>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((d) =>
            chip(dias.has(d), DIAS_SEMANA_LABELS[d], () => emitir(toggle(dias, d), periodos))
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Períodos</p>
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) =>
            chip(periodos.has(p), PERIODOS_LABELS[p], () => emitir(dias, toggle(periodos, p)))
          )}
        </div>
      </div>
    </fieldset>
  );
}

/** Consentimento LGPD — já carimbado vira texto com a data; senão, checkbox
 *  `consent_lgpd` cujo check grava o carimbo (o action nunca desmarca). */
export function CampoConsentimento({
  carimbadoEm,
  defaultChecked = false,
}: {
  /** ISO do carimbo existente — quando presente, o checkbox nem renderiza. */
  carimbadoEm?: string | null;
  defaultChecked?: boolean;
}) {
  if (carimbadoEm) {
    return (
      <p className="text-xs text-muted-foreground">
        Consentimento LGPD registrado em{" "}
        {new Date(carimbadoEm).toLocaleDateString("pt-BR")}.
      </p>
    );
  }
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        name="consent_lgpd"
        defaultChecked={defaultChecked}
        className="mt-0.5 accent-primary"
      />
      <span>
        A pessoa consentiu com o uso dos dados do cadastro no programa (LGPD) —
        o carimbo registra a data de hoje.
      </span>
    </label>
  );
}
