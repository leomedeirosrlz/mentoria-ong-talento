"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "cn";
import {
  COR_RACA_LABELS,
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
import { Button } from "@/components/ui/button";
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

export function CampoCorRaca(props: Omit<Parameters<typeof SelectOpcional>[0], "name" | "label" | "opcoes">) {
  return <SelectOpcional {...props} name="cor_raca" label="Cor/raça (autodeclaração)" opcoes={COR_RACA_LABELS} />;
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
      {/* o TagInput já tem aria-label próprio — Label solta criaria label
          órfão na árvore de acessibilidade */}
      <p className="text-sm font-medium">Interesses</p>
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
        // ≥44px de alvo no mobile; desktop volta à densidade compacta
        "min-h-11 rounded-full border px-3 text-sm transition-all outline-none active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0 md:py-1.5",
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
        A pessoa consentiu com o uso dos dados do cadastro no programa (LGPD):
        o carimbo registra a data de hoje.
      </span>
    </label>
  );
}

/** Um passo do wizard de ficha — `conteudo` fica montado o tempo todo (o
 *  passo inativo leva `hidden`, então os inputs seguem no FormData e nos
 *  defaults; desmontar perderia os valores não-controlados). */
export type PassoFicha = {
  /** título da seção — o mesmo que a SecaoFicha exibia dentro do form */
  titulo: string;
  conteudo: React.ReactNode;
};

/** Wizard de etapas pros dialogs de cadastro/edição de pessoa — o mesmo
 *  padrão do registro-form: cabeçalho "Passo N de M · título", barras de
 *  progresso, todos os passos montados (`hidden` nos inativos) e rodapé
 *  sticky com Voltar/Avançar/Salvar. O form fica aqui dentro: `onSubmit` só
 *  é chamado no último passo — Enter antes dele avança, não salva. */
export function WizardFicha({
  passos,
  pending,
  submitLabel,
  pendingLabel = "Salvando…",
  onSubmit,
}: {
  passos: PassoFicha[];
  pending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [etapa, setEtapa] = useState(0);
  // direção da última troca de etapa — alimenta o --dir do .animate-enter-x
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const tituloEtapaRef = useRef<HTMLHeadingElement>(null);
  const passosRef = useRef<(HTMLDivElement | null)[]>([]);
  // foco pedido junto com a troca de etapa — o efeito roda depois do commit,
  // quando o `hidden` da seção alvo já saiu da árvore renderizada
  const focoPendente = useRef(false);
  const ultima = passos.length - 1;

  // passo condicional pode sumir (papel trocado, ficha async ainda não
  // chegou) — o índice nunca aponta pra fora da lista; o Math.min cobre o
  // render em que o clamp ainda não foi commitado
  if (etapa > ultima) setEtapa(ultima);
  const etapaAtual = Math.min(etapa, ultima);

  // o heading novo anuncia onde a pessoa está — mesmo padrão do registro-form
  useEffect(() => {
    if (!focoPendente.current) return;
    focoPendente.current = false;
    tituloEtapaRef.current?.focus();
  });

  function irPara(proxima: number) {
    focoPendente.current = true;
    setDirecao(proxima > etapa ? 1 : -1);
    setEtapa(proxima);
  }

  /** Os campos do passo visível precisam valer antes de avançar. Input
   *  `required` num passo `hidden` falha calado no Chrome (controle
   *  infocável), então a checagem roda aqui com o campo ainda visível —
   *  assim o reportValidity tem onde aparecer. */
  function passoValido(): boolean {
    const passo = passosRef.current[etapa];
    if (!passo) return true;
    for (const c of passo.querySelectorAll("input, select, textarea")) {
      if (
        (c instanceof HTMLInputElement ||
          c instanceof HTMLSelectElement ||
          c instanceof HTMLTextAreaElement) &&
        !c.checkValidity()
      ) {
        c.reportValidity();
        return false;
      }
    }
    return true;
  }

  function avancar() {
    if (!passoValido()) return;
    irPara(etapa + 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Enter/submit antes do último passo avança, não salva — o submit
    // implícito do browser chega aqui por qualquer campo de texto
    if (etapa < ultima) {
      e.preventDefault();
      avancar();
      return;
    }
    onSubmit(e);
  }

  function onEnterKey(e: React.KeyboardEvent<HTMLFormElement>) {
    // Enter num input avança etapa; botões/links/textareas não entram e o
    // Enter próprio do TagInput já vem preventDefault — respeitar
    if (
      e.key !== "Enter" ||
      e.defaultPrevented ||
      etapa >= ultima ||
      !(e.target instanceof HTMLInputElement) ||
      e.target.type === "hidden" ||
      e.target.type === "file"
    ) {
      return;
    }
    e.preventDefault();
    avancar();
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={onEnterKey} className="space-y-4">
      {/* cabeçalho do wizard — barras finas, uma por seção (SecaoFicha vira
          passo); os nomes ficam no sr-only e no título falado */}
      <div className="space-y-2">
        <h3 ref={tituloEtapaRef} tabIndex={-1} className="text-sm font-medium outline-none">
          Passo {etapaAtual + 1} de {passos.length} · {passos[etapaAtual].titulo}
        </h3>
        <ol className="flex gap-1" aria-label="Etapas">
          {passos.map((p, i) => (
            <li
              key={p.titulo}
              aria-current={i === etapa ? "step" : undefined}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= etapa ? "bg-primary" : "bg-muted"
              )}
            >
              <span className="sr-only">{p.titulo}</span>
            </li>
          ))}
        </ol>
      </div>

      {passos.map((p, i) => (
        <div
          key={p.titulo}
          ref={(el) => {
            passosRef.current[i] = el;
          }}
          hidden={i !== etapa}
          className="animate-enter-x"
          style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
        >
          <div className="space-y-4">{p.conteudo}</div>
        </div>
      ))}

      {/* rodapé do wizard — sticky pra Avançar/Salvar ficarem à mão com o
          form rolado ao meio (o DialogContent é o scrollport) */}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-2 border-t bg-popover px-4 py-3">
        {etapa > 0 && (
          <Button type="button" variant="ghost" onClick={() => irPara(etapa - 1)}>
            <CaretLeft size={14} /> Voltar
          </Button>
        )}
        {etapa < ultima ? (
          <Button type="button" className="flex-1" onClick={avancar}>
            Avançar <CaretRight size={14} />
          </Button>
        ) : (
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
