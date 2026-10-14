"use client";

import { CaretDown } from "@phosphor-icons/react";
import {
  campoFormato,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RespostaApi } from "./use-resposta";

// Controles de campo dos instrumentos sob medida — o "átomo" controlado
// (value + onChange → definir) com o a11y do renderer genérico: id
// estável, aria-invalid/describedby apontando pro erro inline. Sem card
// nem rótulo próprio: quem renderiza decide a moldura.

export function campoDomId(campo: FormularioCampo): string {
  return `f-${campo.id}`;
}

export function campoErroId(campo: FormularioCampo): string {
  return `f-${campo.id}-erro`;
}

/** Mensagem inline sob o campo — montada só quando há erro; o id é o
 *  alvo do aria-describedby do controle. */
export function ErroCampo({
  campo,
  msg,
}: {
  campo: FormularioCampo;
  msg: string | undefined;
}) {
  if (!msg) return null;
  return (
    <p
      id={campoErroId(campo)}
      className="mt-1.5 text-sm leading-snug text-destructive"
    >
      {msg}
    </p>
  );
}

export function EntradaTexto({
  campo,
  valor,
  definir,
  erro,
  enterKeyHint = "next",
  placeholder = "Escreva aqui…",
  className,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  enterKeyHint?: "next" | "send" | "enter" | "done" | "go";
  placeholder?: string;
  className?: string;
}) {
  const formato = campoFormato(campo);
  const dicas =
    formato === "email"
      ? {
          type: "email",
          inputMode: "email" as const,
          autoComplete: "email",
          placeholder: "nome@exemplo.com",
        }
      : formato === "telefone"
        ? {
            type: "tel",
            inputMode: "tel" as const,
            autoComplete: "tel",
            placeholder: "(11) 99999-8888",
          }
        : formato === "url"
          ? {
              type: "url",
              inputMode: "url" as const,
              placeholder: "linkedin.com/in/voce",
            }
          : { placeholder };
  return (
    <Input
      id={campoDomId(campo)}
      name={campo.id}
      required={campo.obrigatorio}
      maxLength={500}
      enterKeyHint={enterKeyHint}
      value={String(valor ?? "")}
      onChange={(e) => definir(campo.id, e.target.value)}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? campoErroId(campo) : undefined}
      className={className}
      {...dicas}
    />
  );
}

export function EntradaTextoLongo({
  campo,
  valor,
  definir,
  erro,
  enterKeyHint = "next",
  rows = 4,
  placeholder = "Escreva com suas palavras…",
  className,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  enterKeyHint?: "next" | "send" | "enter" | "done" | "go";
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Textarea
      id={campoDomId(campo)}
      name={campo.id}
      required={campo.obrigatorio}
      rows={rows}
      maxLength={5000}
      enterKeyHint={enterKeyHint}
      value={String(valor ?? "")}
      onChange={(e) => definir(campo.id, e.target.value)}
      placeholder={placeholder}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? campoErroId(campo) : undefined}
      className={className}
    />
  );
}

export function EntradaData({
  campo,
  valor,
  definir,
  erro,
  className,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  className?: string;
}) {
  return (
    <Input
      id={campoDomId(campo)}
      name={campo.id}
      type="date"
      required={campo.obrigatorio}
      value={String(valor ?? "")}
      onChange={(e) => definir(campo.id, e.target.value)}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? campoErroId(campo) : undefined}
      className={cn("max-w-48", className)}
    />
  );
}

export type OpcaoSegmento = { v: string; l: string };

/** Controle segmentado — radios nativos (um tab stop, setas movem) com a
 *  cara da barra conectada do renderer genérico. serve pra sim_nao,
 *  select de poucas opções e a escolha da meta principal. */
export function Segmentos({
  campo,
  valor,
  definir,
  erro,
  opcoes,
  colunas,
  ariaLabel,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  opcoes: readonly OpcaoSegmento[];
  /** grade fixa (default: uma coluna por opção) */
  colunas?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? campo.label}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? campoErroId(campo) : undefined}
      className={cn("grid gap-1 rounded-xl bg-muted p-1", colunas)}
      // repeat() inline — o número de opções vem da definição, não dá pra
      // contar com grid-cols-N compiladas
      style={
        colunas
          ? undefined
          : {
              gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))`,
            }
      }
    >
      {opcoes.map((o) => (
        <label
          key={o.v}
          className="flex h-11 cursor-pointer items-center justify-center rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
        >
          <input
            type="radio"
            name={campo.id}
            value={o.v}
            required={campo.obrigatorio}
            // escala grava número, sim_não/select gravam string — a
            // comparação em string cobre os dois mundos
            checked={String(valor ?? "") === o.v}
            onChange={() => definir(campo.id, o.v)}
            className="sr-only"
            aria-label={`${campo.label}: ${o.l}`}
          />
          {o.l}
        </label>
      ))}
    </div>
  );
}

/** Sim/não na barra segmentada — os valores são "sim"/"nao" (contrato da
 *  RPC), os rótulos Sim/Não. */
export function SimNao({
  campo,
  valor,
  definir,
  erro,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
}) {
  return (
    <Segmentos
      campo={campo}
      valor={valor}
      definir={definir}
      erro={erro}
      opcoes={
        [
          { v: "sim", l: "Sim" },
          { v: "nao", l: "Não" },
        ] as const
      }
    />
  );
}

/** Escala em segmentos conectados — a peça genérica de 1–5/1–10 dos
 *  instrumentos que não têm controle próprio (a roda usa os eixos). */
export function SegmentosEscala({
  campo,
  valor,
  definir,
  erro,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
}) {
  const teto = campo.tipo === "escala_1_5" ? 5 : 10;
  return (
    <Segmentos
      campo={campo}
      valor={valor}
      // a escala grava número (contrato da RPC e dos extratores), não a
      // string do radio
      definir={(id, v) => definir(id, v == null ? v : Number(v))}
      erro={erro}
      colunas="grid-cols-5 sm:grid-cols-10"
      opcoes={Array.from({ length: teto }, (_, i) => ({
        v: String(i + 1),
        l: String(i + 1),
      }))}
    />
  );
}

/** Rótulo compartilhado — pergunta + (opcional), com ou sem htmlFor. */
export function RotuloCampo({
  campo,
  htmlFor,
  className,
}: {
  campo: FormularioCampo;
  htmlFor?: string;
  className?: string;
}) {
  const inner = (
    <>
      {campo.label}
      {!campo.obrigatorio && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          (opcional)
        </span>
      )}
    </>
  );
  return htmlFor ? (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-[15px] font-medium leading-snug sm:text-base",
        className
      )}
    >
      {inner}
    </label>
  ) : (
    <span
      className={cn(
        "block text-[15px] font-medium leading-snug sm:text-base",
        className
      )}
    >
      {inner}
    </span>
  );
}

/** Fallback completo por tipo — o instrumento sob medida nunca deixa um
 *  campo fora da convenção sem renderizar (form editado, campo novo).
 *  `sombra={false}` devolve a versão sem cartão — pra uso dentro de uma
 *  ficha que já tem moldura própria. */
export function CampoGenerico({
  campo,
  api,
  sombra = true,
}: {
  campo: FormularioCampo;
  api: RespostaApi;
  sombra?: boolean;
}) {
  const valor = api.valores[campo.id];
  const erro = api.erros[campo.id];
  const id = campoDomId(campo);
  const cartao = cn(
    sombra
      ? "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
      : "min-w-0",
    erro && "rounded-xl ring-2 ring-destructive/60"
  );

  switch (campo.tipo) {
    case "texto":
    case "texto_longo":
    case "data":
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <RotuloCampo campo={campo} htmlFor={id} />
          {campo.tipo === "texto" ? (
            <EntradaTexto
              campo={campo}
              valor={valor}
              definir={api.definir}
              erro={erro}
            />
          ) : campo.tipo === "data" ? (
            <EntradaData
              campo={campo}
              valor={valor}
              definir={api.definir}
              erro={erro}
            />
          ) : (
            <EntradaTextoLongo
              campo={campo}
              valor={valor}
              definir={api.definir}
              erro={erro}
            />
          )}
          <ErroCampo campo={campo} msg={erro} />
        </div>
      );
    case "select":
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <RotuloCampo campo={campo} htmlFor={id} />
          <EntradaSelect
            campo={campo}
            valor={valor}
            definir={api.definir}
            erro={erro}
          />
          <ErroCampo campo={campo} msg={erro} />
        </div>
      );
    case "sim_nao":
    case "escala_1_5":
    case "escala_1_10":
      return (
        <fieldset className={cartao} data-campo={campo.id}>
          <legend>
            <RotuloCampo campo={campo} />
          </legend>
          <div className="mt-1.5">
            {campo.tipo === "sim_nao" ? (
              <SimNao
                campo={campo}
                valor={valor}
                definir={api.definir}
                erro={erro}
              />
            ) : (
              <SegmentosEscala
                campo={campo}
                valor={valor}
                definir={api.definir}
                erro={erro}
              />
            )}
          </div>
          <ErroCampo campo={campo} msg={erro} />
        </fieldset>
      );
    case "multi_select":
      return (
        <fieldset className={cartao} data-campo={campo.id}>
          <legend>
            <RotuloCampo campo={campo} />
          </legend>
          <ul className="mt-1.5 space-y-1">
            {(campo.opcoes ?? []).map((o) => {
              const marcado = Array.isArray(valor) && valor.includes(o);
              return (
                <li key={o}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors select-none hover:bg-muted active:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={(e) => {
                        const atual = Array.isArray(valor) ? valor : [];
                        api.definir(
                          campo.id,
                          e.target.checked
                            ? [...atual, o]
                            : atual.filter((x) => x !== o)
                        );
                      }}
                      className="size-5 shrink-0 rounded accent-primary"
                    />
                    {o}
                  </label>
                </li>
              );
            })}
          </ul>
          <ErroCampo campo={campo} msg={erro} />
        </fieldset>
      );
    case "checkbox":
      return (
        <div className={cartao} data-campo={campo.id}>
          <label className="-m-4 flex cursor-pointer items-start gap-3 rounded-xl p-4 text-[15px] leading-relaxed transition-colors select-none has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:-m-5 sm:p-5 sm:text-base">
            <input
              type="checkbox"
              checked={valor === true}
              onChange={(e) => api.definir(campo.id, e.target.checked)}
              required={campo.obrigatorio}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? campoErroId(campo) : undefined}
            />
            <span>
              {campo.label}
              {!campo.obrigatorio && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (opcional)
                </span>
              )}
            </span>
          </label>
          <ErroCampo campo={campo} msg={erro} />
        </div>
      );
    default:
      return null;
  }
}

export function EntradaSelect({
  campo,
  valor,
  definir,
  erro,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
}) {
  return (
    <div className="relative">
      <select
        id={campoDomId(campo)}
        name={campo.id}
        required={campo.obrigatorio}
        value={String(valor ?? "")}
        onChange={(e) => definir(campo.id, e.target.value || undefined)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? campoErroId(campo) : undefined}
        className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-8 md:text-sm"
      >
        <option value="" disabled>
          Escolha…
        </option>
        {(campo.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <CaretDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
