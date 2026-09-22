"use client";

import { useCallback, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, CheckCircle, CircleNotch, PaperPlaneRight } from "@phosphor-icons/react";
import { submeterRespostaFormulario } from "@/lib/forms/actions";
import type {
  FormularioCampo,
  FormularioSistema,
  RespostaValor,
} from "@/lib/forms/schema";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Formulário público /f/<token> — renderiza a definição vinda da RPC e
 *  envia payload tipado pra submeterRespostaFormulario (o banco revalida
 *  tudo; aqui é só UX: required nativo + espelho das regras). */
export function FormularioPublico({
  token,
  titulo,
  descricao,
  campos,
  destinatario,
  sistema,
}: {
  token: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  destinatario: string | null;
  /** 0042 — instrumento oficial ganha selo discreto (vem da RPC) */
  sistema?: FormularioSistema | null;
}) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // foco migra pro painel de sucesso quando ele monta (o form sai do DOM)
  const focoSucesso = useCallback((el: HTMLDivElement | null) => {
    el?.focus();
  }, []);

  function coleta(fd: FormData): Record<string, RespostaValor> {
    const respostas: Record<string, RespostaValor> = {};
    for (const c of campos) {
      switch (c.tipo) {
        case "multi_select": {
          const itens = fd.getAll(c.id).map(String).filter(Boolean);
          if (itens.length) respostas[c.id] = itens;
          break;
        }
        case "checkbox":
          respostas[c.id] = fd.get(c.id) === "on";
          break;
        case "escala_1_5": {
          const v = fd.get(c.id);
          if (v != null && v !== "") respostas[c.id] = Number(v);
          break;
        }
        default: {
          const v = String(fd.get(c.id) ?? "").trim();
          if (v) respostas[c.id] = v;
        }
      }
    }
    return respostas;
  }

  /** Espelho client-side das regras do servidor — resposta rápida sem
   *  round-trip; a RPC continua sendo a fronteira real. */
  function valida(respostas: Record<string, RespostaValor>): string | null {
    for (const c of campos) {
      if (!c.obrigatorio) continue;
      const v = respostas[c.id];
      if (c.tipo === "checkbox") {
        if (v !== true) return `Marque "${c.label}" pra continuar.`;
      } else if (
        v == null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0)
      ) {
        return `Responda "${c.label}" antes de enviar.`;
      }
    }
    return null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const respostas = coleta(fd);
    const falta = valida(respostas);
    if (falta) {
      setErro(falta);
      return;
    }
    setErro(null);
    start(async () => {
      try {
        const r = await submeterRespostaFormulario(
          token,
          respostas,
          String(fd.get("website") ?? "")
        );
        if (r.error) {
          setErro(r.error);
          return;
        }
        setEnviado(true);
      } catch {
        setErro("Sem conexão — confira a internet e tente de novo.");
      }
    });
  }

  const primeiroNome = destinatario?.split(" ")[0];

  return (
    <AnimatePresence mode="wait" initial={false}>
      {enviado ? (
        <motion.div
          key="ok"
          ref={focoSucesso}
          tabIndex={-1}
          {...fade}
          transition={T.enter}
          className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] outline-none sm:p-8"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
            <CheckCircle size={24} weight="bold" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Resposta enviada. Obrigado!</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Sua resposta pra “{titulo}” foi registrada e já está com a equipe
            do Realiza.vc. Pode fechar esta página.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          {...fade}
          transition={T.enter}
          className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-7"
        >
          {primeiroNome && (
            <p className="text-sm font-medium text-[var(--ok-text)]">
              Olá, {primeiroNome}!
            </p>
          )}
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{titulo}</h1>
          {sistema && (
            <p className="mt-1 text-xs text-muted-foreground">
              Instrumento oficial do Programa de Mentoria
            </p>
          )}
          {descricao && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {descricao}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {/* honeypot anti-spam: invisível pra humanos, bots preenchem —
                o servidor finge sucesso e não grava nada */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
              <label>
                Site
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            {campos.map((c) => (
              <CampoRenderer key={c.id} campo={c} />
            ))}

            {erro && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <CircleNotch size={16} className="animate-spin" aria-hidden />
              ) : (
                <PaperPlaneRight size={16} aria-hidden />
              )}
              {pending ? "Enviando…" : "Enviar resposta"}
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Rotulo({ campo, htmlFor }: { campo: FormularioCampo; htmlFor?: string }) {
  const inner = (
    <>
      {campo.label}
      {campo.obrigatorio && (
        <span aria-hidden className="ml-0.5 text-destructive">
          *
        </span>
      )}
    </>
  );
  // fora de fieldset: <label> com for; dentro de grupos o caller usa <legend>
  return htmlFor ? (
    <label htmlFor={htmlFor} className="block text-sm font-medium">
      {inner}
    </label>
  ) : (
    <span className="block text-sm font-medium">{inner}</span>
  );
}

function CampoRenderer({ campo }: { campo: FormularioCampo }) {
  const id = `f-${campo.id}`;

  switch (campo.tipo) {
    case "texto":
      return (
        <div className="space-y-1.5">
          <Rotulo campo={campo} htmlFor={id} />
          <Input id={id} name={campo.id} required={campo.obrigatorio} maxLength={500} />
        </div>
      );

    case "texto_longo":
      return (
        <div className="space-y-1.5">
          <Rotulo campo={campo} htmlFor={id} />
          <Textarea
            id={id}
            name={campo.id}
            required={campo.obrigatorio}
            rows={4}
            maxLength={5000}
          />
        </div>
      );

    case "data":
      return (
        <div className="space-y-1.5">
          <Rotulo campo={campo} htmlFor={id} />
          <Input
            id={id}
            name={campo.id}
            type="date"
            required={campo.obrigatorio}
            className="max-w-48"
          />
        </div>
      );

    case "select":
      // select nativo: picker do SO no celular (o público aqui é mentorado no
      // WhatsApp) e required/FormData de graça
      return (
        <div className="space-y-1.5">
          <Rotulo campo={campo} htmlFor={id} />
          <div className="relative">
            <select
              id={id}
              name={campo.id}
              required={campo.obrigatorio}
              defaultValue=""
              className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm"
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
        </div>
      );

    case "sim_nao":
      return (
        <fieldset>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} />
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { v: "sim", l: "Sim" },
                { v: "nao", l: "Não" },
              ] as const
            ).map((o) => (
              <label
                key={o.v}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-card has-checked:text-foreground has-checked:shadow-[var(--shadow-border)] has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={o.v}
                  required={campo.obrigatorio}
                  className="sr-only"
                />
                {o.l}
              </label>
            ))}
          </div>
        </fieldset>
      );

    case "escala_1_5":
      return (
        <fieldset>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} />
          </legend>
          <div className="mt-1.5 grid grid-cols-5 gap-1 rounded-xl bg-muted p-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground transition-colors select-none has-checked:bg-card has-checked:text-foreground has-checked:shadow-[var(--shadow-border)] has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={n}
                  required={campo.obrigatorio}
                  className="sr-only"
                  aria-label={`Nota ${n}`}
                />
                <span aria-hidden>{n}</span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Muito ruim</span>
            <span>Muito bom</span>
          </div>
        </fieldset>
      );

    case "multi_select":
      return (
        <fieldset>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} />
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Marque quantas fizerem sentido
            </span>
          </legend>
          <ul className="mt-1.5 space-y-1">
            {(campo.opcoes ?? []).map((o) => (
              <li key={o}>
                <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors select-none hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                  <input
                    type="checkbox"
                    name={campo.id}
                    value={o}
                    className="size-4 shrink-0 accent-primary"
                  />
                  {o}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      );

    case "checkbox":
      return (
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed transition-colors has-checked:border-primary/60 has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          )}
        >
          <input
            type="checkbox"
            name={campo.id}
            required={campo.obrigatorio}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            {campo.label}
            {campo.obrigatorio && (
              <span aria-hidden className="ml-0.5 text-destructive">
                *
              </span>
            )}
          </span>
        </label>
      );

    default:
      return null;
  }
}
