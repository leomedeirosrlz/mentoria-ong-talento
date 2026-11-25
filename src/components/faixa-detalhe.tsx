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

// O detalhe das faixas de nível, compartilhado entre o card de conquistas e
// os selos do header do perfil: a mesma peça grande, a mesma ficha e a
// mesma régua do que falta — um Dialog só.

/** A peça grande do detalhe: o selo em loop enquanto o detalhe está
 *  aberto (a cena do kit fun-isometric, no relógio da página). Peça ainda
 *  não ganha fica parada e apagada. */
export function PecaDetalhe({
  glifo,
  tom,
  estado,
}: {
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  estado: "ganho" | "proximo" | "futuro";
}) {
  return (
    <div className="relative mx-auto grid size-32 place-items-center">
      <ConquistaEmblema
        glifo={glifo}
        tom={tom}
        size={128}
        estado={estado}
        movimento="vivo"
      />
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
