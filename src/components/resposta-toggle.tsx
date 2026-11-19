"use client";

import { useId, useState, type ReactNode } from "react";
import { CircleNotch, Eye, EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "Ver resposta" ↔ "Fechar resposta" (REALIZA-441): o gatilho é um Button
// de verdade com ícone — não o <summary> miúdo — e o painel expande com
// animação de altura (grid 0fr→1fr, o mesmo desenho do SumarioPill). O
// conteúdo chega pronto do server via children; o guard global de
// reduced-motion cobre a transição (nada de media query local).

/** O gatilho do par — exposto pra quem monta o próprio fluxo (o detalhe
 *  lazy do staff baixa a resposta no primeiro clique) dividir o mesmo
 *  chrome: ícone Eye/EyeSlash, variant outline e aria-expanded. */
export function RespostaGatilho({
  aberto,
  onClick,
  carregando = false,
  rotulo = "Ver resposta",
  rotuloAberto = "Fechar resposta",
  controls,
  className,
}: {
  aberto: boolean;
  onClick: () => void;
  carregando?: boolean;
  rotulo?: string;
  rotuloAberto?: string;
  controls?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-expanded={aberto}
      aria-controls={controls}
      className={className}
    >
      {carregando ? (
        <CircleNotch aria-hidden className="animate-spin" />
      ) : aberto ? (
        <EyeSlash aria-hidden />
      ) : (
        <Eye aria-hidden />
      )}
      {aberto ? rotuloAberto : rotulo}
    </Button>
  );
}

/** O painel animado — grid-rows 0fr→1fr + fade; `visibility` tira o
 *  conteúdo fechado da árvore de foco/leitura. */
export function RespostaPainel({
  aberto,
  id,
  children,
  className,
}: {
  aberto: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
        aberto
          ? "visible grid-rows-[1fr] opacity-100"
          : "invisible grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/** O bloco completo — os <details> "Ver respostas" viram isto, com o
 *  payload server-rendered como children do painel. */
export function RespostaToggle({
  children,
  rotulo,
  rotuloAberto,
  className,
}: {
  children: ReactNode;
  rotulo?: string;
  rotuloAberto?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  return (
    <div className={className}>
      <RespostaGatilho
        aberto={aberto}
        onClick={() => setAberto((v) => !v)}
        rotulo={rotulo}
        rotuloAberto={rotuloAberto}
        controls={painelId}
      />
      <RespostaPainel aberto={aberto} id={painelId}>
        {children}
      </RespostaPainel>
    </div>
  );
}
