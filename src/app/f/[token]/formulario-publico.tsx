"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
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

/** Tipos com teclado de texto — recebem enterKeyHint; o último deles leva
 *  "send" (fecha o teclado e envia em vez de saltar pra lugar nenhum). */
const TIPOS_COM_ENTER: readonly FormularioCampo["tipo"][] = [
  "texto",
  "texto_longo",
  "data",
];

/** Formulário público /f/<token> — renderiza a definição vinda da RPC e
 *  envia payload tipado pra submeterRespostaFormulario (o banco revalida
 *  tudo; aqui é só UX: validação por campo + espelho das regras). */
export function FormularioPublico({
  token,
  titulo,
  descricao,
  campos,
  destinatario,
  sistema,
  preview = false,
}: {
  token: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  destinatario: string | null;
  /** 0042 — instrumento oficial ganha selo discreto (vem da RPC) */
  sistema?: FormularioSistema | null;
  /** prévia na ficha da coordenação — campos vivos, envio desligado */
  preview?: boolean;
}) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [respondidos, setRespondidos] = useState(0);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // foco migra pro painel de sucesso quando ele monta (o form sai do DOM)
  const focoSucesso = useCallback((el: HTMLDivElement | null) => {
    el?.focus();
  }, []);

  /** O campo tem valor no form — usado pelo progresso e pra limpar erro
   *  assim que a pessoa corrige (sem esperar novo submit). */
  function respondido(c: FormularioCampo, fd: FormData): boolean {
    if (c.tipo === "multi_select") return fd.getAll(c.id).length > 0;
    if (c.tipo === "checkbox") return fd.get(c.id) === "on";
    const v = fd.get(c.id);
    return v != null && String(v).trim() !== "";
  }

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

  /** Espelho client-side das regras do servidor, um erro por campo — a RPC
   *  continua sendo a fronteira real, aqui a resposta é imediata. */
  function valida(respostas: Record<string, RespostaValor>) {
    const mapa: Record<string, string> = {};
    for (const c of campos) {
      if (!c.obrigatorio) continue;
      const v = respostas[c.id];
      if (c.tipo === "checkbox") {
        if (v !== true) mapa[c.id] = "Marque a caixa pra continuar.";
      } else if (v == null || v === "" || (Array.isArray(v) && !v.length)) {
        mapa[c.id] =
          c.tipo === "multi_select"
            ? "Marque ao menos uma opção."
            : TIPOS_COM_ENTER.includes(c.tipo)
              ? "Responda esta pergunta."
              : "Escolha uma opção.";
      }
    }
    return mapa;
  }

  function onFormChange(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    setRespondidos(
      campos.reduce((n, c) => n + (respondido(c, fd) ? 1 : 0), 0)
    );
    setErros((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      for (const c of campos)
        if (next[c.id] && respondido(c, fd)) delete next[c.id];
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    const fd = new FormData(e.currentTarget);
    const respostas = coleta(fd);
    const mapa = valida(respostas);
    if (Object.keys(mapa).length) {
      setErros(mapa);
      setErro("Revise os campos marcados antes de enviar.");
      const primeiro = campos.find((c) => mapa[c.id]);
      const alvo =
        primeiro &&
        formRef.current?.querySelector(
          `[data-campo="${CSS.escape(primeiro.id)}"]`
        );
      if (alvo) {
        alvo.scrollIntoView({ block: "center" });
        alvo
          .querySelector<HTMLElement>("input, select, textarea")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    setErros({});
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

  // "Olá, thiago" passa a "Olá, Thiago" — o nome vem do cadastro, nem sempre
  // capitalizado
  const primeiroNome = (() => {
    const p = destinatario?.trim().split(/\s+/)[0];
    if (!p) return null;
    const base = p.toLocaleLowerCase("pt-BR");
    return base.charAt(0).toLocaleUpperCase("pt-BR") + base.slice(1);
  })();

  const total = campos.length;
  const minutos = Math.max(1, Math.round((total * 15) / 60));
  const ultimoComEnter = [...campos]
    .reverse()
    .find((c) => TIPOS_COM_ENTER.includes(c.tipo))?.id;

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
          <h1 className="mt-4 text-lg font-semibold">Resposta enviada!</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Obrigado{primeiroNome ? `, ${primeiroNome}` : ""} — sua resposta
            pra “{titulo}” foi registrada e já está com a equipe do
            Realiza.vc. Pode fechar esta página.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          {...fade}
          transition={T.enter}
          className="rounded-xl bg-card shadow-[var(--shadow-border)]"
        >
          {/* progresso fino e sticky (padrão do onboarding): acompanha o
              scroll de forms longos sem disputar atenção */}
          <div className="sticky top-0 z-10 rounded-t-xl bg-card/90 px-5 pt-4 pb-2.5 backdrop-blur-sm sm:px-7">
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-valuenow={respondidos}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label="Progresso do formulário"
                aria-valuetext={`${respondidos} de ${total} perguntas respondidas`}
                className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-500"
                  style={{
                    width: `${(respondidos / Math.max(total, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {respondidos} de {total}
              </span>
            </div>
          </div>

          <div className="px-5 pt-3 pb-5 sm:px-7 sm:pb-7">
            {primeiroNome && (
              <p className="text-sm font-medium text-[var(--ok-text)]">
                Olá, {primeiroNome}!
              </p>
            )}
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {titulo}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {total} {total === 1 ? "pergunta" : "perguntas"} · leva ~{minutos}{" "}
              min
              {sistema && " · Instrumento oficial do Programa de Mentoria"}
            </p>
            {descricao && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {descricao}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Suas respostas são lidas apenas pela equipe do Realiza.vc —{" "}
              <Link
                href="/privacidade"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                privacidade
              </Link>
              .
            </p>

            <form
              ref={formRef}
              onSubmit={onSubmit}
              onChange={onFormChange}
              noValidate
              className="mt-6 space-y-6"
            >
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

              {campos.map((c, i) => (
                <CampoRenderer
                  key={c.id}
                  campo={c}
                  n={i + 1}
                  erro={erros[c.id]}
                  enterKeyHint={c.id === ultimoComEnter ? "send" : "next"}
                />
              ))}

              {/* região estável no DOM: o texto entra e sai sem remontar, pro
                  leitor de tela anunciar sempre */}
              <p
                role="alert"
                className={cn(
                  "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
                  !erro && "sr-only"
                )}
              >
                {erro}
              </p>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <CircleNotch size={16} className="animate-spin" aria-hidden />
                ) : (
                  <PaperPlaneRight size={16} aria-hidden />
                )}
                {pending ? "Enviando…" : "Enviar resposta"}
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Rotulo({
  campo,
  n,
  htmlFor,
}: {
  campo: FormularioCampo;
  n: number;
  htmlFor?: string;
}) {
  const inner = (
    <>
      <span className="mr-1 text-muted-foreground tabular-nums">{n}.</span>
      {campo.label}
      {!campo.obrigatorio && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          (opcional)
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

/** Mensagem inline sob o campo — montada só quando há erro; o id é o
 *  alvo do aria-describedby do controle. */
function ErroCampo({ id, msg }: { id: string; msg: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-sm leading-snug text-destructive">
      {msg}
    </p>
  );
}

function CampoRenderer({
  campo,
  n,
  erro,
  enterKeyHint,
}: {
  campo: FormularioCampo;
  n: number;
  erro: string | undefined;
  enterKeyHint: "next" | "send";
}) {
  const id = `f-${campo.id}`;
  const erroId = `${id}-erro`;
  const a11y = {
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? erroId : undefined,
  };

  switch (campo.tipo) {
    case "texto":
      return (
        <div className="space-y-1.5" data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Input
            id={id}
            name={campo.id}
            required={campo.obrigatorio}
            maxLength={500}
            enterKeyHint={enterKeyHint}
            {...a11y}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "texto_longo":
      return (
        <div className="space-y-1.5" data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Textarea
            id={id}
            name={campo.id}
            required={campo.obrigatorio}
            rows={4}
            maxLength={5000}
            enterKeyHint={enterKeyHint}
            {...a11y}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "data":
      return (
        <div className="space-y-1.5" data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Input
            id={id}
            name={campo.id}
            type="date"
            required={campo.obrigatorio}
            enterKeyHint={enterKeyHint}
            className="max-w-48"
            {...a11y}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "select":
      // select nativo: picker do SO no celular (o público aqui é mentorado no
      // WhatsApp) e required/FormData de graça
      return (
        <div className="space-y-1.5" data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <div className="relative">
            <select
              id={id}
              name={campo.id}
              required={campo.obrigatorio}
              defaultValue=""
              className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-8 md:text-sm"
              {...a11y}
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
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "sim_nao":
      return (
        <fieldset data-campo={campo.id}>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} n={n} />
          </legend>
          <div
            className={cn(
              "mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1",
              erro && "ring-2 ring-destructive/40"
            )}
          >
            {(
              [
                { v: "sim", l: "Sim" },
                { v: "nao", l: "Não" },
              ] as const
            ).map((o) => (
              <label
                key={o.v}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-card has-checked:text-foreground has-checked:shadow-[var(--shadow-border)] has-checked:ring-2 has-checked:ring-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={o.v}
                  required={campo.obrigatorio}
                  className="sr-only"
                  {...a11y}
                />
                {o.l}
              </label>
            ))}
          </div>
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "escala_1_5":
      return (
        <fieldset data-campo={campo.id}>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} n={n} />
          </legend>
          <div
            className={cn(
              "mt-1.5 grid grid-cols-5 gap-1 rounded-xl bg-muted p-1",
              erro && "ring-2 ring-destructive/40"
            )}
          >
            {[1, 2, 3, 4, 5].map((num) => (
              <label
                key={num}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground transition-colors select-none has-checked:bg-card has-checked:text-foreground has-checked:shadow-[var(--shadow-border)] has-checked:ring-2 has-checked:ring-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={num}
                  required={campo.obrigatorio}
                  className="sr-only"
                  aria-label={`Nota ${num}`}
                  {...a11y}
                />
                <span aria-hidden>{num}</span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Muito ruim</span>
            <span>Muito bom</span>
          </div>
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "multi_select":
      return (
        <fieldset data-campo={campo.id}>
          <legend className="block text-sm font-medium">
            <Rotulo campo={campo} n={n} />
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {campo.obrigatorio
                ? "Marque ao menos uma"
                : "Marque quantas fizerem sentido"}
            </span>
          </legend>
          <ul
            className={cn(
              "mt-1.5 space-y-1",
              erro && "rounded-xl p-2 ring-2 ring-destructive/40"
            )}
          >
            {(campo.opcoes ?? []).map((o) => (
              <li key={o}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors select-none hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                  <input
                    type="checkbox"
                    name={campo.id}
                    value={o}
                    className="size-4 shrink-0 accent-primary"
                    {...a11y}
                  />
                  {o}
                </label>
              </li>
            ))}
          </ul>
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "checkbox":
      return (
        <div data-campo={campo.id}>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-input bg-muted/40 p-4 text-sm leading-relaxed transition-colors has-checked:border-primary/60 has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              erro && "border-destructive/60"
            )}
          >
            <input
              type="checkbox"
              name={campo.id}
              required={campo.obrigatorio}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              {...a11y}
            />
            <span>
              <span className="mr-1 text-muted-foreground tabular-nums">
                {n}.
              </span>
              {campo.label}
              {!campo.obrigatorio && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (opcional)
                </span>
              )}
            </span>
          </label>
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    default:
      return null;
  }
}
