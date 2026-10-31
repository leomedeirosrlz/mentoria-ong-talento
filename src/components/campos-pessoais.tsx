"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CaretLeft, CaretRight, Check } from "@phosphor-icons/react";
import { cn } from "cn";
import {
  celulasDe,
  COR_RACA_LABELS,
  DIAS_SEMANA,
  DIAS_SEMANA_CURTOS,
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
import { DialogFooter } from "@/components/ui/dialog";
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

/** Chave da célula — "dia:periodo", o id estável nos sets da grade. */
const chaveCelula = (dia: DiaSemana, periodo: Periodo) =>
  `${dia}:${periodo}`;

/** Preposição do período nos aria-labels: "Segunda de manhã". */
const PERIODO_DE: Record<Periodo, string> = {
  manha: "de manhã",
  tarde: "de tarde",
  noite: "de noite",
};

/** Colunas da grade: rótulo de período + 7 dias — a mesma largura no
 *  cabeçalho e nas 3 linhas pra matriz alinhar. */
const GRADE_COLS =
  "grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] items-stretch gap-1";

/** Grade semanal — matriz 7 dias × 3 períodos, uma célula por encaixe
 *  (0100): "ter de manhã e qui à noite" era impossível de dizer com o
 *  produto de conjuntos. Clique alterna, arrastar pinta (o gesto fixa o
 *  modo da célula âncora e repete nas vizinhas), cabeçalhos alternam a
 *  coluna/linha inteira, setas navegam e Espaço/Enter alternam. Emite
 *  JSON {"celulas":[...]} no hidden `disponibilidade`, ou null quando
 *  nada ficou marcado. */
export function CampoDisponibilidade({
  value,
  onChange,
}: {
  value: Disponibilidade | null;
  onChange: (v: Disponibilidade | null) => void;
}) {
  // celulasDe tolera a forma legada — na janela de deploy uma grade velha
  // vinda do banco não pode renderizar vazia e ser salva por cima
  const marcadas = new Set(
    celulasDe(value).map((c) => chaveCelula(c.dia, c.periodo))
  );

  // roving tabindex: só uma célula entra no Tab; as setas movem o foco
  const [foco, setFoco] = useState(0);
  const celulasRef = useRef<(HTMLButtonElement | null)[]>([]);

  // gesto de pintura: null fora de arraste; dentro carrega o modo (ligar
  // ou apagar, fixado pela célula âncora) e o conjunto de trabalho —
  // pointerenter sucessivos não podem esperar o re-render entre eventos
  const pintura = useRef<{ alvo: boolean; set: Set<string> } | null>(null);

  useEffect(() => {
    const fim = () => {
      pintura.current = null;
    };
    // pointerup fora da grade também encerra o gesto — sem listener de
    // janela o arrasto ficava preso quando o dedo soltava noutra área
    window.addEventListener("pointerup", fim);
    window.addEventListener("pointercancel", fim);
    return () => {
      window.removeEventListener("pointerup", fim);
      window.removeEventListener("pointercancel", fim);
    };
  }, []);

  const emitir = (set: Set<string>) => {
    const celulas = DIAS_SEMANA.flatMap((dia) =>
      PERIODOS.flatMap((periodo) =>
        set.has(chaveCelula(dia, periodo)) ? [{ dia, periodo }] : []
      )
    );
    onChange(celulas.length ? { celulas } : null);
  };

  const comCelula = (
    base: Set<string>,
    dia: DiaSemana,
    periodo: Periodo,
    ligado: boolean
  ) => {
    const n = new Set(base);
    const k = chaveCelula(dia, periodo);
    if (ligado) n.add(k);
    else n.delete(k);
    return n;
  };

  const down =
    (dia: DiaSemana, periodo: Periodo, idx: number) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // botão secundário não pinta (e o menu de contexto segue vivo); um
      // segundo dedo no meio do gesto não reinicia a pintura
      if (e.button !== 0 || !e.isPrimary) return;
      // sem seleção de texto nem scroll durante o arraste; o click
      // sintético do pointer morre aqui — teclado alterna via onClick
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        // a captura implícita do touch prenderia o gesto na célula âncora
        // e o pointerenter das vizinhas nunca disparava
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.currentTarget.focus();
      setFoco(idx);
      const alvo = !marcadas.has(chaveCelula(dia, periodo));
      const set = comCelula(marcadas, dia, periodo, alvo);
      pintura.current = { alvo, set };
      emitir(set);
    };

  const enter = (dia: DiaSemana, periodo: Periodo) => () => {
    const p = pintura.current;
    if (!p) return;
    if (p.set.has(chaveCelula(dia, periodo)) === p.alvo) return;
    p.set = comCelula(p.set, dia, periodo, p.alvo);
    emitir(p.set);
  };

  // só o click de teclado/AT (detail 0) alterna aqui — o click de pointer
  // (detail ≥1) já foi pintado no pointerdown e voltaria a desfazer a
  // célula: preventDefault NÃO suprime o click do tap, sem o guard todo
  // toque dupla-alternava e apagava a marca
  const alternar =
    (dia: DiaSemana, periodo: Periodo) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail !== 0) return;
      emitir(
        comCelula(
          marcadas,
          dia,
          periodo,
          !marcadas.has(chaveCelula(dia, periodo))
        )
      );
    };

  const alternarColuna = (dia: DiaSemana) => {
    // coluna cheia apaga inteira; qualquer buraco marca inteira
    const ligado = !PERIODOS.every((p) => marcadas.has(chaveCelula(dia, p)));
    const set = new Set(marcadas);
    for (const p of PERIODOS) {
      if (ligado) set.add(chaveCelula(dia, p));
      else set.delete(chaveCelula(dia, p));
    }
    emitir(set);
  };

  const alternarLinha = (periodo: Periodo) => {
    const ligado = !DIAS_SEMANA.every((d) =>
      marcadas.has(chaveCelula(d, periodo))
    );
    const set = new Set(marcadas);
    for (const d of DIAS_SEMANA) {
      if (ligado) set.add(chaveCelula(d, periodo));
      else set.delete(chaveCelula(d, periodo));
    }
    emitir(set);
  };

  const setas = (di: number, pi: number) => (e: React.KeyboardEvent) => {
    const passo: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const d = passo[e.key];
    if (!d) return;
    e.preventDefault();
    // as bordas dão a volta — ninguém fica preso no canto da grade
    const idx =
      ((pi + d[0] + PERIODOS.length) % PERIODOS.length) * DIAS_SEMANA.length +
      ((di + d[1] + DIAS_SEMANA.length) % DIAS_SEMANA.length);
    setFoco(idx);
    celulasRef.current[idx]?.focus();
  };

  return (
    <fieldset className="space-y-2">
      <input
        type="hidden"
        name="disponibilidade"
        value={JSON.stringify(value ?? { celulas: [] })}
      />
      <legend className="sr-only">Disponibilidade semanal</legend>
      <div
        role="grid"
        aria-label="Dias e períodos livres na semana"
        className="touch-none select-none space-y-1"
      >
        {/* cabeçalho de dias — cada um alterna a coluna inteira */}
        <div role="row" className={GRADE_COLS}>
          <span role="columnheader" aria-hidden />
          {DIAS_SEMANA.map((d) => (
            <span role="columnheader" key={d} className="min-w-0">
              <button
                type="button"
                onClick={() => alternarColuna(d)}
                aria-label={`Alternar ${DIAS_SEMANA_LABELS[d]} ${d === "sab" || d === "dom" ? "inteiro" : "inteira"}`}
                className="min-h-11 w-full rounded-md px-1 py-1 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-8"
              >
                {DIAS_SEMANA_CURTOS[d]}
              </button>
            </span>
          ))}
        </div>
        {PERIODOS.map((p, pi) => (
          <div role="row" key={p} className={GRADE_COLS}>
            <span role="rowheader" className="min-w-0">
              <button
                type="button"
                onClick={() => alternarLinha(p)}
                aria-label={`Alternar ${PERIODOS_LABELS[p]} inteira`}
                className="flex h-full min-h-11 w-full items-center rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-0"
              >
                {PERIODOS_LABELS[p]}
              </button>
            </span>
            {DIAS_SEMANA.map((d, di) => {
              const idx = pi * DIAS_SEMANA.length + di;
              const ativo = marcadas.has(chaveCelula(d, p));
              return (
                <span role="gridcell" key={d} className="min-w-0">
                  <button
                    ref={(el) => {
                      celulasRef.current[idx] = el;
                    }}
                    type="button"
                    tabIndex={idx === foco ? 0 : -1}
                    aria-pressed={ativo}
                    aria-label={`${DIAS_SEMANA_LABELS[d]} ${PERIODO_DE[p]}`}
                    onPointerDown={down(d, p, idx)}
                    onPointerEnter={enter(d, p)}
                    onClick={alternar(d, p)}
                    onKeyDown={setas(di, pi)}
                    onFocus={() => setFoco(idx)}
                    className={cn(
                      "grid h-11 w-full place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-10",
                      ativo
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {ativo ? <Check size={13} weight="bold" aria-hidden /> : null}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Arraste pra marcar ou desmarcar vários de uma vez; os cabeçalhos
        alternam o dia ou o período inteiro.
      </p>
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

      {/* rodapé do wizard — o DialogFooter compartilhado no modo sticky
          (o DialogContent é o scrollport): Voltar é nav de etapa, fica à
          esquerda; Avançar/Salvar ocupa o resto da linha */}
      <DialogFooter sticky>
        {etapa > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="sm:me-auto"
            onClick={() => irPara(etapa - 1)}
          >
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
      </DialogFooter>
    </form>
  );
}
