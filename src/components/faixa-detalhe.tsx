"use client";

import type { ReactNode } from "react";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import type {
  ConquistaGlifo,
  NiveisJornada,
  NivelJornada,
} from "@/lib/conquistas";
import { cn } from "@/lib/utils";

// O detalhe das faixas de nível, compartilhado entre o bloco "Seu nível"
// do card de conquistas e o selo do header do perfil (024): a mesma peça
// grande, a mesma ficha e a mesma régua do que falta — um Dialog só.

/** As assinaturas de faixa (024) em literais — o scanner do Tailwind só
 *  emite o que lê no fonte, nada de `nivel-${chave}` dinâmico. */
const MOTION_NIVEL: Record<string, string> = {
  inicio: "nivel-inicio",
  constancia: "nivel-constancia",
  veterania: "nivel-veterania",
  completa: "nivel-completa",
};

/** A classe de motion da peça: a faixa de nível tem assinatura própria
 *  (nivel-<faixa>-*, 024 — pop, pulso duplo, flicker elétrico e burst) e
 *  ela dispara UMA vez por gatilho — `abre` no mount da vitrine e na
 *  abertura do detalhe ganho. A faixa não ganha entra com o fade simples
 *  (nivel-fade), sem celebração emprestada; selo e régua ficam no settle
 *  curto (nivel-chega, `passa`) e o hover/foco do tile é o feedback da
 *  casa, nunca a assinatura. O resto da estante segue o salto de sempre. */
export function classeMotionPeca(
  glifo: ConquistaGlifo,
  gatilho: "abre" | "passa",
  estado: "ganho" | "proximo" | "futuro" = "ganho"
): string {
  if (glifo.tipo !== "nivel")
    return gatilho === "abre"
      ? "badge-salta"
      : "group-hover:badge-salta group-focus-visible:badge-salta";
  if (gatilho === "passa") return "nivel-chega";
  return estado === "ganho" ? MOTION_NIVEL[glifo.chave] : "nivel-fade";
}

/** O brilho do kit (spark de 4 pontas) — estoura na batida do salto. */
export function Brilho({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-12 -12 24 24"
      aria-hidden
      className={cn("pointer-events-none absolute overflow-visible", className)}
    >
      <path
        d="M0 -10Q2.8 -2.8 10 0Q2.8 2.8 0 10Q-2.8 2.8 -10 0Q-2.8 -2.8 0 -10Z"
        fill="white"
        stroke="var(--brand-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A peça grande do detalhe: a faixa de nível entra com a assinatura dela
 *  quando ganha — a completa é a única cuja assinatura inclui os brilhos
 *  (o burst dela) — e com fade simples quando ainda não; as demais peças
 *  saltam como na estante. */
export function PecaDetalhe({
  glifo,
  tom,
  estado,
}: {
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  estado: "ganho" | "proximo" | "futuro";
}) {
  const brilho =
    estado === "ganho" &&
    (glifo.tipo !== "nivel" || glifo.chave === "completa");
  return (
    <div className="relative mx-auto grid size-28 place-items-center">
      <ConquistaEmblema
        glifo={glifo}
        tom={tom}
        size={112}
        estado={estado}
        className={classeMotionPeca(glifo, "abre", estado)}
      />
      {brilho && (
        <>
          <Brilho className="badge-brilho -top-1 right-0 size-6" />
          <Brilho className="badge-brilho bottom-4 -left-1 size-4 [animation-delay:980ms]" />
        </>
      )}
    </div>
  );
}

/** Ficha do detalhe — "rótulo sobre valor" (dt da convenção). */
export function Ficha({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="space-y-3 rounded-lg bg-muted/50 p-3.5">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {rotulo}
          </dt>
          <dd className="mt-0.5 text-sm text-pretty">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Barra({
  rotulo,
  atual,
  alvo,
  unidade,
}: {
  rotulo: string;
  atual: number;
  alvo: number;
  /** "4 de 8" vira "4 de 8 dias" quando a unidade não está no rótulo */
  unidade?: string;
}) {
  const valor = `${atual} de ${alvo}${unidade ? ` ${unidade}` : ""}`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-medium tabular-nums">{valor}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${rotulo}: ${valor}`}
        aria-valuemin={0}
        aria-valuemax={alvo}
        aria-valuenow={atual}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="fill-grow h-full rounded-full bg-[var(--destaque)]"
          style={{ width: `${Math.min(100, (atual / Math.max(1, alvo)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

const PARADA = {
  pausada: "Sua dupla está pausada: a contagem volta com os encontros.",
  encerrada: "Sua dupla foi encerrada: o nível alcançado fica com você.",
} as const;

/** O que falta pra próxima faixa: critério, barras e a contagem — nunca
 *  uma data projetada. */
export function ProximoNivel({
  nivel,
  faixa,
}: {
  nivel: NiveisJornada;
  faixa: NivelJornada;
}) {
  const p = nivel.proximo!;
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Barra
          rotulo={nivel.sessao ? "Sessões" : "Encontros"}
          atual={p.encontros.atual}
          alvo={p.encontros.alvo}
        />
        {p.dias && (
          <Barra
            rotulo="Tempo de programa"
            atual={p.dias.atual}
            alvo={p.dias.alvo}
            unidade="dias"
          />
        )}
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        {p.falta ?? (nivel.parada ? PARADA[nivel.parada] : faixa.criterio)}
      </p>
    </>
  );
}

/** Estado da faixa em texto — a régua nunca diz só por cor. */
export function estadoFaixa(f: NivelJornada, nivel: NiveisJornada): string {
  if (f.chave === nivel.atual) return "Seu nível";
  if (f.estado === "ganho") return "Alcançada";
  if (f.estado === "superado") return "Superada";
  return f.chave === nivel.proximo?.chave ? "Próxima" : "Ainda por vir";
}

/** O detalhe de uma faixa de nível — o que ela reconhece, o critério e,
 *  quando é a próxima, as barras do que falta. */
export function FaixaDetalhe({
  f,
  nivel,
}: {
  f: NivelJornada;
  nivel: NiveisJornada;
}) {
  const atual = nivel.faixas.find((x) => x.chave === nivel.atual);
  const descricao =
    f.estado === "ganho"
      ? `${f.chave === nivel.atual ? "Seu nível desde" : "Alcançada em"} ${formatDate(f.data)}`
      : f.estado === "superado"
        ? `Superada: você chegou a ${atual?.titulo ?? "uma faixa acima"} antes do tempo desta`
        : f.chave === nivel.proximo?.chave
          ? "O seu próximo nível"
          : "Ainda por vir";
  return (
    <>
      <DialogHeader className="items-center px-8 text-center">
        <PecaDetalhe
          glifo={f.glifo}
          tom={f.tom}
          estado={f.estado === "futuro" ? "futuro" : "ganho"}
        />
        <DialogTitle>{f.titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
      </DialogHeader>
      <Ficha
        itens={[
          ["O que reconhece", f.detalhe],
          ["Critério", f.criterio],
        ]}
      />
      {f.chave === nivel.proximo?.chave && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            O que falta
          </p>
          <ProximoNivel nivel={nivel} faixa={f} />
        </div>
      )}
    </>
  );
}
