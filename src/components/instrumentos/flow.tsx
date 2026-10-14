"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ChartPolar,
  CheckCircle,
  CircleNotch,
  MapTrifold,
  PaperPlaneRight,
  ShootingStar,
  Target,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  extraiRodaDaVida,
  SISTEMA_LABEL,
  type FormularioCampo,
  type InstrumentoSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import { fade, T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResposta } from "./use-resposta";
import { RodaSvg } from "./roda-svg";
import { RodaVida } from "./roda-vida";
import { Metas } from "./metas";
import { Pdm } from "./pdm";
import { Visao } from "./visao";

// Casca comum dos instrumentos oficiais no /f/<token>: progresso sticky,
// cartão de título com a marca do instrumento, corpo sob medida por
// sistema, honeypot, erro global, envio e a tela de sucesso (a roda
// devolve o próprio desenho preenchido). O contrato de submissão é o
// mesmo do form genérico — muda só a experiência.

const INSTRUMENTO_ICON: Record<InstrumentoSistema, Icon> = {
  visao: ShootingStar,
  metas: Target,
  pdm: MapTrifold,
  roda_vida: ChartPolar,
};

/** CTA do envio por instrumento — a ação fecha com o nome do exercício,
 *  não com "formulário". */
const CTA: Record<InstrumentoSistema, string> = {
  visao: "Registrar minha visão",
  metas: "Salvar minhas metas",
  pdm: "Salvar meu PDM",
  roda_vida: "Registrar minha roda",
};

export function InstrumentoFlow({
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
  sistema: InstrumentoSistema;
  /** prévia na ficha da coordenação — campos vivos, envio desligado */
  preview?: boolean;
}) {
  // o <form> vive num state local (ref={setFormEl}) — o hook lê o
  // honeypot e rola até o primeiro erro através dele; o elemento não
  // entra na bag do api (isso a faria virar "ref" pro lint do Compiler)
  const [formEl, bindForm] = useState<HTMLFormElement | null>(null);
  const api = useResposta({ token, campos, preview, formEl });

  const primeiroNome = (() => {
    const p = destinatario?.trim().split(/\s+/)[0];
    if (!p) return null;
    const base = p.toLocaleLowerCase("pt-BR");
    return base.charAt(0).toLocaleUpperCase("pt-BR") + base.slice(1);
  })();

  const Icone = INSTRUMENTO_ICON[sistema];
  const minutos = Math.max(1, Math.round((api.total * 20) / 60));

  return (
    <AnimatePresence mode="wait" initial={false}>
      {api.enviado ? (
        <PainelSucesso
          key="ok"
          sistema={sistema}
          titulo={titulo}
          primeiroNome={primeiroNome}
          campos={campos}
          valores={api.valores}
        />
      ) : (
        <motion.div
          key="form"
          {...fade}
          transition={T.enter}
          className="space-y-3"
        >
          {/* progresso fora dos cards: pill sticky que acompanha o scroll */}
          <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex items-center gap-3 rounded-full bg-card/90 px-4 py-2.5 shadow-[var(--shadow-border)] backdrop-blur">
            <div
              role="progressbar"
              aria-valuenow={api.respondidos}
              aria-valuemin={0}
              aria-valuemax={api.total}
              aria-label="Progresso do instrumento"
              aria-valuetext={`${api.respondidos} de ${api.total} perguntas respondidas`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-500"
                style={{
                  width: `${(api.respondidos / Math.max(api.total, 1)) * 100}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {api.respondidos} de {api.total}
            </span>
          </div>

          {/* cartão de título — faixa lime + selo do instrumento */}
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
            <div className="p-5 sm:p-7">
              {primeiroNome && (
                <p className="text-sm font-medium text-[var(--ok-text)]">
                  Olá, {primeiroNome}!
                </p>
              )}
              <div className="mt-1 flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
                >
                  <Icone size={24} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {titulo}
                  </h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {api.total}{" "}
                    {api.total === 1 ? "pergunta" : "perguntas"} · leva ~
                    {minutos} min
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="mt-3 border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
              >
                Instrumento oficial · {SISTEMA_LABEL[sistema]}
              </Badge>
              {descricao && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {descricao}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Suas respostas são lidas apenas pela equipe do Realiza.vc.{" "}
                <Link
                  href="/privacidade"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  privacidade
                </Link>
                .
              </p>
            </div>
          </div>

          <form
            ref={bindForm}
            onSubmit={api.onSubmit}
            noValidate
            className="space-y-3"
          >
            {sistema === "roda_vida" ? (
              <RodaVida campos={campos} api={api} />
            ) : sistema === "metas" ? (
              <Metas campos={campos} api={api} />
            ) : sistema === "pdm" ? (
              <Pdm campos={campos} api={api} />
            ) : (
              <Visao campos={campos} api={api} />
            )}

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

            {/* região estável no DOM: o texto entra e sai sem remontar, pro
                leitor de tela anunciar sempre */}
            <p
              role="alert"
              className={cn(
                "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
                !api.erro && "sr-only"
              )}
            >
              {api.erro}
            </p>

            <div title={preview ? "Envio desligado na prévia" : undefined}>
              <Button
                type="submit"
                className="h-11 w-full md:h-10"
                disabled={api.pending || preview}
              >
                {api.pending ? (
                  <CircleNotch size={16} className="animate-spin" aria-hidden />
                ) : (
                  <PaperPlaneRight size={16} aria-hidden />
                )}
                {api.pending ? "Enviando…" : CTA[sistema]}
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Tela final: a roda devolve o próprio desenho preenchido; os demais
 *  instrumentos ganham o check lime padrão. */
function PainelSucesso({
  sistema,
  titulo,
  primeiroNome,
  campos,
  valores,
}: {
  sistema: InstrumentoSistema;
  titulo: string;
  primeiroNome: string | null;
  campos: FormularioCampo[];
  valores: Record<string, RespostaValor>;
}) {
  const roda =
    sistema === "roda_vida" ? extraiRodaDaVida(campos, valores) : null;

  return (
    <motion.div
      ref={(el) => {
        if (!el) return;
        el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: true });
      }}
      tabIndex={-1}
      {...fade}
      transition={T.enter}
      className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] outline-none sm:p-8"
    >
      {roda ? (
        <>
          <div className="mx-auto max-w-[280px]">
            <RodaSvg roda={roda} />
          </div>
          <h1 className="mt-4 text-lg font-semibold">
            Sua roda ficou registrada!
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Obrigado{primeiroNome ? `, ${primeiroNome}` : ""}. É com esse
            retrato que você e seu(sua) mentor(a) vão escolher as áreas
            prioritárias da jornada. Pode fechar esta página.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
            <CheckCircle size={24} weight="bold" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Resposta enviada!</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Obrigado{primeiroNome ? `, ${primeiroNome}` : ""}. Sua resposta
            pra “{titulo}” foi registrada e já está com a equipe do
            Realiza.vc. Pode fechar esta página.
          </p>
        </>
      )}
    </motion.div>
  );
}
