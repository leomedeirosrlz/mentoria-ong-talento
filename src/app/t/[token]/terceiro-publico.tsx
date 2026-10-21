"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle,
  CircleNotch,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { submeterRespostaTerceiro } from "@/lib/actions-terceiros";
import { primeiroNome } from "@/components/forms/link-shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fade, T } from "@/components/motion";
import { cn } from "@/lib/utils";

// O form do respondente externo (0103): 2 perguntas abertas do guia —
// pontos fortes / aspectos a melhorar. Sem login, um submit por link (o
// gate atômico é do banco). O jovem indicou a pessoa pelo nome — a
// saudação usa o nome do convidado, as perguntas citam o jovem.

function capNome(nome: string | null | undefined): string {
  const p = primeiroNome(nome);
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

export function TerceiroPublico({
  token,
  convidadoNome,
  jovemNome,
}: {
  token: string;
  convidadoNome: string;
  jovemNome: string;
}) {
  const [pending, start] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const convidado = capNome(convidadoNome);
  const jovem = capNome(jovemNome);

  // rascunho local — resposta longa no celular não pode morrer num reload
  // (molde rascunho:/f/<token>: inputs não-controlados, o DOM guarda o
  // valor e o rascunho restaura via ref); some quando a resposta sai
  const chaveRascunho = `rascunho:/t/${token}`;

  // foco migra pro painel de sucesso quando ele monta — molde /f
  const focoSucesso = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  }, []);

  // restaura o rascunho depois do mount — localStorage nunca é lido no
  // render (SSR/abas privadas)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chaveRascunho);
      if (!raw) return;
      const r = JSON.parse(raw) as { fortes?: string; melhorar?: string };
      const form = formRef.current;
      if (!form) return;
      if (typeof r.fortes === "string") {
        const el = form.elements.namedItem("fortes");
        if (el instanceof HTMLTextAreaElement) el.value = r.fortes;
      }
      if (typeof r.melhorar === "string") {
        const el = form.elements.namedItem("melhorar");
        if (el instanceof HTMLTextAreaElement) el.value = r.melhorar;
      }
    } catch {
      // storage indisponível ou rascunho corrompido — o form segue vazio
    }
  }, [chaveRascunho]);

  function onFormChange(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const fortes = String(fd.get("fortes") ?? "");
    const melhorar = String(fd.get("melhorar") ?? "");
    if (!fortes && !melhorar) return;
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify({ fortes, melhorar }));
    } catch {
      // conveniência, não requisito
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fortes = String(fd.get("fortes") ?? "");
    const melhorar = String(fd.get("melhorar") ?? "");
    if (!fortes.trim() || !melhorar.trim()) {
      setErro("Responda as duas perguntas antes de enviar.");
      return;
    }
    setErro(null);
    start(async () => {
      try {
        const r = await submeterRespostaTerceiro(
          token,
          fortes,
          melhorar,
          String(fd.get("website") ?? "")
        );
        if ("error" in r) {
          setErro(r.error ?? "Não foi possível enviar. Tente de novo.");
          return;
        }
        try {
          localStorage.removeItem(chaveRascunho);
        } catch {
          // idem — a resposta já foi pro servidor
        }
        setEnviado(true);
      } catch {
        setErro("Sem conexão. Confira a internet e tente de novo.");
      }
    });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {enviado ? (
        <motion.div
          key="ok"
          {...fade}
          transition={T.enter}
          ref={focoSucesso}
          tabIndex={-1}
          className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] outline-none sm:p-8"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
            <CheckCircle size={24} weight="bold" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Resposta enviada!</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Obrigado{convidado ? `, ${convidado}` : ""}. Sua percepção ajuda{" "}
            {jovem} a construir o plano de desenvolvimento — e chega ao
            mentor sem te expor.
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          {...fade}
          transition={T.enter}
          ref={formRef}
          onSubmit={submit}
          onChange={onFormChange}
          className="space-y-5 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
        >
          <div>
            <h1 className="text-lg font-semibold leading-snug">
              {convidado ? `Olá, ${convidado}!` : "Olá!"} Como você vê{" "}
              {jovem}?
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {jovem} indicou você na avaliação por terceiros do Programa de
              Mentoria — são só 2 perguntas. O mentor reúne as respostas de
              várias pessoas e entrega uma síntese anônima:{" "}
              <strong className="font-medium text-foreground">
                {jovem} nunca sabe quem disse o quê
              </strong>
              .
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fortes" className="text-sm font-medium">
              Quais são os pontos fortes de {jovem}?
            </Label>
            <p className="text-xs text-muted-foreground">
              Qualidades, talentos, jeitos de ser que fazem diferença.
            </p>
            <Textarea
              id="fortes"
              name="fortes"
              rows={4}
              maxLength={4000}
              required
              placeholder="Ex.: persistente, criativo, bom ouvinte…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="melhorar" className="text-sm font-medium">
              E o que {jovem} poderia melhorar?
            </Label>
            <p className="text-xs text-muted-foreground">
              Comportamentos ou pontos cegos que, na sua visão, atrapalham.
            </p>
            <Textarea
              id="melhorar"
              name="melhorar"
              rows={4}
              maxLength={4000}
              required
              placeholder="Ex.: às vezes some quando está ocupado…"
            />
          </div>

          {/* honeypot anti-spam — mesmo molde do /f */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label>
              Site
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <p
            role="alert"
            className={cn(
              "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
              !erro && "sr-only"
            )}
          >
            {erro}
          </p>

          <Button type="submit" className="h-11 w-full md:h-10" disabled={pending}>
            {pending ? (
              <CircleNotch size={16} className="animate-spin" aria-hidden />
            ) : (
              <PaperPlaneRight size={16} aria-hidden />
            )}
            {pending ? "Enviando…" : "Enviar resposta"}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
