"use client";

import {
  Flag,
  FlagCheckered,
  ListChecks,
  Medal,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { InstrumentoIcone } from "@/components/instrumento-icone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import type {
  Conquista,
  ConquistaPhosphor,
  ProximoMarco,
} from "@/lib/conquistas";

/** "Suas conquistas" v2 (REALIZA-427) — estante estilo GitHub: só o que foi
 *  conquistado, em ordem cronológica, cada peça num emblema squircle (a
 *  gramática do InstrumentoEmblema: rounded-[28%], tinta de fundo, glifo
 *  na cor). Toque abre o detalhe de uma linha. O que ainda falta NUNCA
 *  vira cadeado na estante — mora só na faixa "a caminho" embaixo, com a
 *  barra do próximo marco e o que falta pra chegar lá. Cliente: os
 *  emblemas são triggers de Dialog. */

const PHOSPHOR: Record<
  ConquistaPhosphor,
  typeof Flag
> = {
  flag: Flag,
  medal: Medal,
  flagCheckered: FlagCheckered,
  trophy: Trophy,
  listChecks: ListChecks,
  usersThree: UsersThree,
};

/** O squircle do emblema — mesma razão do InstrumentoEmblema (glifo a
 *  ~57% do lado); o glifo de instrumento vem `neutro` pra herdar a cor do
 *  par (é o mesmo cor/tinta de INSTRUMENTO_TOM, só que generalizado pros
 *  Phosphor dos marcos e contagens). */
function Emblema({ c, size = 44 }: { c: Conquista; size?: number }) {
  const glifo = Math.round(size * 0.575);
  const Phos = c.glifo.tipo === "phosphor" ? PHOSPHOR[c.glifo.nome] : null;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[28%]"
      style={{
        width: size,
        height: size,
        background: c.tom.tinta,
        color: c.tom.cor,
      }}
    >
      {c.glifo.tipo === "instrumento" ? (
        <InstrumentoIcone
          instrumento={c.glifo.chave}
          size={glifo}
          neutro
        />
      ) : (
        Phos && <Phos size={glifo} />
      )}
    </span>
  );
}

/** Uma peça da estante — o tile inteiro é o gatilho do detalhe (mesma
 *  régua do card de instrumento da /materiais: UM gesto por peça). */
function ConquistaItem({ c }: { c: Conquista }) {
  return (
    <Dialog>
      <DialogTrigger className="flex h-full w-full flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
        <Emblema c={c} />
        <span className="text-xs font-medium leading-tight">{c.titulo}</span>
        {c.data && (
          <span className="text-xs text-muted-foreground sm:text-[11px]">
            {formatDate(c.data)}
          </span>
        )}
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <Emblema c={c} size={48} />
          <DialogTitle>{c.titulo}</DialogTitle>
          <DialogDescription>
            {c.data ? `${formatDate(c.data)} · ` : ""}
            {c.detalhe}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function ConquistasCard({
  conquistas,
  proximoMarco,
}: {
  conquistas: Conquista[];
  /** o próximo limiar — null quando a jornada completou */
  proximoMarco: ProximoMarco | null;
}) {
  const pct = proximoMarco
    ? Math.min(100, (proximoMarco.atual / proximoMarco.alvo) * 100)
    : 0;
  return (
    <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Suas conquistas</h2>
        {conquistas.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {conquistas.length}{" "}
            {conquistas.length === 1 ? "conquista" : "conquistas"}
          </span>
        )}
      </div>
      {conquistas.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 lg:grid-cols-5">
          {conquistas.map((c) => (
            <li key={c.chave} className="min-w-0">
              <ConquistaItem c={c} />
            </li>
          ))}
        </ul>
      )}

      {/* faixa "a caminho" — o futuro da jornada vive aqui, nunca como
          cadeado na estante: próximo marco + barra + o que falta */}
      {proximoMarco && (
        <div className="mt-4 rounded-lg border border-border/60 p-3.5 sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              A caminho: {proximoMarco.rotulo}
            </p>
            <span className="text-xs text-muted-foreground">
              {proximoMarco.atual} de {proximoMarco.alvo}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${proximoMarco.atual} de ${proximoMarco.alvo} · ${proximoMarco.rotulo}`}
            aria-valuemin={0}
            aria-valuemax={proximoMarco.alvo}
            aria-valuenow={proximoMarco.atual}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="fill-grow h-full rounded-full bg-[var(--destaque)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {proximoMarco.texto}
          </p>
        </div>
      )}
    </section>
  );
}
