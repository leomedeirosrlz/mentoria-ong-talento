"use client";

import { CaretDown } from "@phosphor-icons/react";
import {
  campoFormato,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { CampoArquivo } from "@/components/forms/campo-arquivo";
import { GridDisponibilidade } from "@/components/forms/grid-disponibilidade";
import {
  NumeroPergunta,
  RotuloPergunta,
} from "@/components/forms/pergunta";
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
          : {
              placeholder,
              // autofill honesto nos nomes do intake — o civil completa
              // como "name" e o social como o apelido de cadastro
              autoComplete:
                campo.id === "nome_civil" || campo.id === "nome_completo"
                  ? "name"
                  : campo.id === "nome_social"
                    ? "nickname"
                    : undefined,
            };
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
  rows = 4,
  placeholder = "Escreva com suas palavras…",
  className,
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const restante = 5000 - String(valor ?? "").length;
  return (
    <>
      <Textarea
        id={campoDomId(campo)}
        name={campo.id}
        required={campo.obrigatorio}
        rows={rows}
        maxLength={5000}
        value={String(valor ?? "")}
        onChange={(e) => definir(campo.id, e.target.value)}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? campoErroId(campo) : undefined}
        className={className}
      />
      {restante <= 500 && (
        <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
          {restante === 1
            ? "1 caractere restante"
            : `${restante} caracteres restantes`}
        </p>
      )}
    </>
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
      autoComplete={campo.id === "nascimento" ? "bday" : undefined}
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
}: {
  campo: FormularioCampo;
  valor: RespostaValor | undefined;
  definir: (id: string, v: RespostaValor | undefined) => void;
  erro: string | undefined;
  opcoes: readonly OpcaoSegmento[];
  /** grade fixa (default: uma coluna por opção) */
  colunas?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={campo.label}
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
          className="flex h-11 cursor-pointer items-center justify-center rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 @xl:h-10"
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
            aria-label={o.l}
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
      colunas={teto === 5 ? "grid-cols-5" : "grid-cols-5 @xl:grid-cols-10"}
      opcoes={Array.from({ length: teto }, (_, i) => ({
        v: String(i + 1),
        l: String(i + 1),
      }))}
    />
  );
}

/** Fallback completo por tipo — o instrumento sob medida nunca deixa um
 *  campo fora da convenção sem renderizar (form editado, campo novo).
 *  `sombra={false}` devolve a versão sem cartão — pra uso dentro de uma
 *  ficha que já tem moldura própria. `n` é a posição da pergunta na
 *  régua: com ela o rótulo ganha o disco destaque da gramática (442). */
export function CampoGenerico({
  campo,
  api,
  sombra = true,
  n,
}: {
  campo: FormularioCampo;
  api: RespostaApi;
  sombra?: boolean;
  n?: number;
}) {
  const valor = api.valores[campo.id];
  const erro = api.erros[campo.id];
  const id = campoDomId(campo);
  const cartao = cn(
    sombra
      ? "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] @xl:p-5"
      : "min-w-0",
    erro && "rounded-xl ring-2 ring-destructive/60"
  );

  switch (campo.tipo) {
    case "texto":
    case "texto_longo":
    case "data":
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <RotuloPergunta campo={campo} n={n} htmlFor={id} />
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
          <RotuloPergunta campo={campo} n={n} htmlFor={id} />
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
        <fieldset
          className={cartao}
          data-campo={campo.id}
          // focável só por script: o submit com erro mira o grupo, e a
          // dupla invalid+describedby faz o leitor anunciar a falha
          tabIndex={-1}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? campoErroId(campo) : undefined}
        >
          <legend>
            <RotuloPergunta campo={campo} n={n} />
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
        <fieldset
          className={cartao}
          data-campo={campo.id}
          tabIndex={-1}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? campoErroId(campo) : undefined}
        >
          <legend>
            <RotuloPergunta campo={campo} n={n} />
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
          <label className="-m-4 flex cursor-pointer items-start gap-3 rounded-xl p-4 text-[15px] leading-relaxed transition-colors select-none has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 @xl:-m-5 @xl:p-5 @xl:text-base">
            {n != null && n > 0 && <NumeroPergunta n={n} />}
            <input
              type="checkbox"
              checked={valor === true}
              onChange={(e) => api.definir(campo.id, e.target.checked)}
              required={campo.obrigatorio}
              className={cn(
                "size-4 shrink-0 accent-primary",
                n != null && n > 0 ? "mt-2" : "mt-0.5"
              )}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? campoErroId(campo) : undefined}
            />
            <span
              className={cn(
                "min-w-0 flex-1 font-semibold text-[var(--ok-text)]",
                n != null && n > 0 && "pt-0.5"
              )}
            >
              {campo.label}
              {!campo.obrigatorio && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </span>
          </label>
          <ErroCampo campo={campo} msg={erro} />
        </div>
      );
    case "arquivo":
      // form editado pode pendurar upload num instrumento — sem o
      // componente o campo saía invisível e travava o submit
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <RotuloPergunta campo={campo} n={n} />
          <CampoArquivo
            campo={campo}
            token={api.token}
            valor={valor}
            onValor={(id, v) => api.definir(id, v ?? undefined)}
            preview={api.preview}
          />
          <ErroCampo campo={campo} msg={erro} />
        </div>
      );
    case "grid_disponibilidade":
      return (
        <fieldset
          className={cn(cartao, "space-y-1.5")}
          data-campo={campo.id}
          tabIndex={-1}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? campoErroId(campo) : undefined}
        >
          <legend>
            <RotuloPergunta campo={campo} n={n} />
          </legend>
          <GridDisponibilidade
            name={campo.id}
            value={valor ?? null}
            onChange={(v) => api.definir(campo.id, v ?? undefined)}
          />
          <ErroCampo campo={campo} msg={erro} />
        </fieldset>
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
        className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 @xl:h-8 @xl:text-sm"
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
