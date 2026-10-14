"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Quotes, Wind } from "@phosphor-icons/react";
import { agrupaEmSecoes } from "@/lib/forms/instrumentos";
import { type FormularioCampo } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";
import type { RespostaApi } from "./use-resposta";
import {
  CampoGenerico,
  campoDomId,
  EntradaTextoLongo,
  ErroCampo,
} from "./campos";

// Construindo a sua Visão — narrativa guiada: a instrução inicial vira um
// "momento" (respirar, imaginar o filme), as cinco perguntas chegam como
// prompts editoriais generosos — tipografia grande, textarea ampla,
// entrada escalonada — e a Declaração fecha como o bloco hero. Tudo
// visível de uma vez (nada de wizard trancado): o ritmo vem do design,
// não de passos travados.

export function Visao({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const blocos = useMemo(() => agrupaEmSecoes(campos), [campos]);
  // numeração dos prompts acumulada por bloco — a pergunta 3 da seção 2
  // continua 6, não volta a 1 (a numeração é do instrumento inteiro)
  const ordens = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const b of blocos)
      for (const c of b.campos)
        if (c.tipo === "texto_longo") m.set(c.id, ++n);
    return m;
  }, [blocos]);

  return (
    <>
      {blocos.map((b, bi) => (
        <section key={b.secao?.id ?? `bloco-${bi}`}>
          {/* a 'secao' de abertura (instrução longa) vira o momento
              guiado; as demais viram divider editorial do capítulo */}
          {b.secao &&
            (bi === 0 && b.secao.descricao ? (
              <div className="flex gap-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
                >
                  <Wind size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight">
                    {b.secao.label}
                  </h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {b.secao.descricao}
                  </p>
                </div>
              </div>
            ) : (
              <header className="px-1 pb-3 pt-2">
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  {b.secao.label}
                </h2>
                {b.secao.descricao && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {b.secao.descricao}
                  </p>
                )}
                <div aria-hidden className="mt-3 h-px bg-border" />
              </header>
            ))}

          <div className="space-y-3">
            {b.campos.map((c) => {
              if (c.tipo !== "texto_longo")
                return <CampoGenerico key={c.id} campo={c} api={api} />;
              const nPrompt = ordens.get(c.id) ?? 0;
              const ehDeclaracao = c.id === "declaracao_visao";
              return (
                <div
                  key={c.id}
                  data-campo={c.id}
                  className={cn(
                    "animate-enter rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6",
                    ehDeclaracao &&
                      "border-l-2 border-[var(--brand-lime)]",
                    api.erros[c.id] && "ring-2 ring-destructive/60"
                  )}
                  style={{ "--i": Math.min(nPrompt, 8) } as CSSProperties}
                >
                  <div className="flex items-start gap-3">
                    {ehDeclaracao ? (
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/20 text-[var(--ok-text)]"
                      >
                        <Quotes size={17} weight="fill" />
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold tabular-nums text-muted-foreground"
                      >
                        {nPrompt}
                      </span>
                    )}
                    <label
                      htmlFor={campoDomId(c)}
                      className="text-lg font-semibold leading-snug tracking-tight sm:text-xl"
                    >
                      {c.label}
                      {!c.obrigatorio && (
                        <span className="ml-1.5 align-middle text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      )}
                    </label>
                  </div>
                  <div className="mt-3">
                    <EntradaTextoLongo
                      campo={c}
                      valor={api.valores[c.id]}
                      definir={api.definir}
                      erro={api.erros[c.id]}
                      rows={ehDeclaracao ? 3 : 5}
                      placeholder={
                        ehDeclaracao
                          ? "Serei… Alcançarei… Conquistarei… (com um prazo)"
                          : "Descreva com suas palavras, sem pressa…"
                      }
                    />
                  </div>
                  <ErroCampo campo={c} msg={api.erros[c.id]} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
