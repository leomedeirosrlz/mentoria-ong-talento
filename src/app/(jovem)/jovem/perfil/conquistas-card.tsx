"use client";

import type { CSSProperties, ReactNode } from "react";
import { ConquistaEmblema } from "@/components/conquista-emblema";
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
  ConquistaFutura,
  ConquistaGlifo,
  NiveisJornada,
  NivelJornada,
} from "@/lib/conquistas";
import { cn } from "@/lib/utils";

/** "Suas conquistas" v3 (016) — três andares no mesmo card: o nível por
 *  tempo de programa (a peça da faixa atual + a régua das 4 faixas + o
 *  que falta pra próxima), a estante earned-only em ordem cronológica e,
 *  separada dela, a área "Ainda por vir" com as peças apagadas e o
 *  critério em texto — nunca cadeado. Toda peça abre o detalhe (critério,
 *  data, estado). As ilustrações são public/badges; a animação é o salto
 *  do globals.css, no hover/foco e ao abrir o detalhe. Cliente: as peças
 *  são triggers de Dialog. */

/** O brilho do kit (spark de 4 pontas) — estoura na batida do salto. */
function Brilho({ className }: { className?: string }) {
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

/** A peça grande do detalhe: salta ao abrir; o que já é dela estoura
 *  dois brilhos na batida. */
function PecaDetalhe({
  glifo,
  tom,
  estado,
}: {
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  estado: "ganho" | "proximo" | "futuro";
}) {
  return (
    <div className="relative mx-auto grid size-28 place-items-center">
      <ConquistaEmblema
        glifo={glifo}
        tom={tom}
        size={112}
        estado={estado}
        className="badge-salta"
      />
      {estado === "ganho" && (
        <>
          <Brilho className="badge-brilho -top-1 right-0 size-6" />
          <Brilho className="badge-brilho bottom-4 -left-1 size-4 [animation-delay:980ms]" />
        </>
      )}
    </div>
  );
}

/** Ficha do detalhe — "rótulo sobre valor" (dt da convenção). */
function Ficha({ itens }: { itens: [string, ReactNode][] }) {
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

function Barra({
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

/** O tile da peça na grade — o tile inteiro é o gatilho do detalhe (UM
 *  gesto por peça, a régua do card de instrumento da /materiais). */
function Tile({
  glifo,
  tom,
  estado,
  titulo,
  linha,
  children,
}: {
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  estado: "ganho" | "proximo" | "futuro";
  titulo: string;
  /** a segunda linha (data ou o que falta), com o estado pro leitor */
  linha: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger className="group flex h-full w-full flex-col items-center gap-1.5 rounded-lg px-1.5 py-3 text-center outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
        <ConquistaEmblema
          glifo={glifo}
          tom={tom}
          size={56}
          estado={estado}
          className="group-hover:badge-salta group-focus-visible:badge-salta"
        />
        <span className="text-xs font-medium leading-tight">{titulo}</span>
        {linha}
      </DialogTrigger>
      <DialogContent size="sm">{children}</DialogContent>
    </Dialog>
  );
}

function ConquistaItem({ c }: { c: Conquista }) {
  return (
    <Tile
      glifo={c.glifo}
      tom={c.tom}
      estado="ganho"
      titulo={c.titulo}
      linha={
        <span className="text-xs text-muted-foreground sm:text-[11px]">
          <span className="sr-only">Conquistada{c.data ? " em " : ""}</span>
          {c.data ? formatDate(c.data) : null}
        </span>
      }
    >
      <DialogHeader className="items-center px-8 text-center">
        <PecaDetalhe glifo={c.glifo} tom={c.tom} estado="ganho" />
        <DialogTitle>{c.titulo}</DialogTitle>
        <DialogDescription>
          {c.data ? `Conquistada em ${formatDate(c.data)}` : "Conquistada"}
        </DialogDescription>
      </DialogHeader>
      <Ficha
        itens={[
          ["O que ela marca", c.detalhe],
          ["Como se conquista", c.criterio],
        ]}
      />
    </Tile>
  );
}

function FuturaItem({ f }: { f: ConquistaFutura }) {
  const estado = f.proximo ? "proximo" : "futuro";
  return (
    <Tile
      glifo={f.glifo}
      tom={f.tom}
      estado={estado}
      titulo={f.titulo}
      linha={
        <span className="line-clamp-2 text-xs text-muted-foreground sm:text-[11px]">
          <span className="sr-only">Ainda por vir. </span>
          {f.linha ?? f.criterio}
        </span>
      }
    >
      <DialogHeader className="items-center px-8 text-center">
        <PecaDetalhe glifo={f.glifo} tom={f.tom} estado={estado} />
        <DialogTitle>{f.titulo}</DialogTitle>
        <DialogDescription>
          {f.proximo ? "A próxima da sua jornada" : "Ainda por vir"}
        </DialogDescription>
      </DialogHeader>
      <Ficha
        itens={[
          ["Como se conquista", f.criterio],
          ...(f.linha
            ? ([
                [
                  "O que falta",
                  <>
                    {f.linha}
                    {f.progresso && (
                      <div className="mt-2">
                        <Barra
                          rotulo="Progresso"
                          atual={f.progresso.atual}
                          alvo={f.progresso.alvo}
                        />
                      </div>
                    )}
                  </>,
                ],
              ] as [string, ReactNode][])
            : []),
        ]}
      />
    </Tile>
  );
}

const PARADA = {
  pausada: "Sua dupla está pausada: a contagem volta com os encontros.",
  encerrada: "Sua dupla foi encerrada: o nível alcançado fica com você.",
} as const;

/** O que falta pra próxima faixa: critério, barras e a contagem — nunca
 *  uma data projetada. */
function ProximoNivel({
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
function estadoFaixa(f: NivelJornada, nivel: NiveisJornada): string {
  if (f.chave === nivel.atual) return "Seu nível";
  if (f.estado === "ganho") return "Alcançada";
  if (f.estado === "superado") return "Superada";
  return f.chave === nivel.proximo?.chave ? "Próxima" : "Ainda por vir";
}

function FaixaDetalhe({
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

function NivelBloco({ nivel }: { nivel: NiveisJornada }) {
  const atual = nivel.faixas.find((f) => f.chave === nivel.atual) ?? null;
  // antes de a jornada começar, a peça em destaque é o Início, apagado
  const vitrine = atual ?? nivel.faixas[0];
  const iAtual = atual ? nivel.faixas.indexOf(atual) : -1;
  const proxFaixa = nivel.proximo
    ? (nivel.faixas.find((f) => f.chave === nivel.proximo!.chave) ?? null)
    : null;
  const meta = atual
    ? [
        `Desde ${formatDate(atual.data)}`,
        nivel.diasDePrograma != null
          ? `${nivel.diasDePrograma} ${nivel.diasDePrograma === 1 ? "dia" : "dias"} de programa`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : (nivel.proximo?.falta ?? vitrine.criterio);

  return (
    <div className="mt-4 rounded-lg border border-border/60 p-4 sm:p-5">
      <Dialog>
        <DialogTrigger className="group flex w-full items-center gap-4 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ConquistaEmblema
            glifo={vitrine.glifo}
            tom={vitrine.tom}
            size={80}
            estado={atual ? "ganho" : "futuro"}
            className="group-hover:badge-salta group-focus-visible:badge-salta"
          />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {atual ? "Seu nível" : "Primeiro nível"}
            </span>
            <span className="mt-0.5 block text-lg font-semibold tracking-tight">
              {vitrine.titulo}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {meta}
            </span>
          </span>
        </DialogTrigger>
        <DialogContent size="sm">
          <FaixaDetalhe f={vitrine} nivel={nivel} />
        </DialogContent>
      </Dialog>

      {/* a régua inteira, sempre: as 4 faixas ligadas por uma linha que
          acende até a atual — estado em texto embaixo de cada peça */}
      <ol aria-label="Faixas de nível" className="relative mt-5 grid grid-cols-4">
        <span
          aria-hidden
          className="absolute top-5 right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-border"
        />
        {iAtual > 0 && (
          <span
            aria-hidden
            className="absolute top-5 left-[12.5%] h-0.5 rounded-full bg-[var(--destaque)]"
            style={{ width: `${(iAtual / 3) * 75}%` }}
          />
        )}
        {nivel.faixas.map((f) => {
          const eAtual = f.chave === nivel.atual;
          return (
            <li key={f.chave} className="relative min-w-0">
              <Dialog>
                <DialogTrigger className="group flex w-full flex-col items-center gap-1.5 rounded-lg px-1 pb-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span
                    className={cn(
                      "rounded-[28%]",
                      eAtual &&
                        "ring-2 ring-[var(--destaque)] ring-offset-2 ring-offset-card"
                    )}
                  >
                    <ConquistaEmblema
                      glifo={f.glifo}
                      tom={f.tom}
                      size={40}
                      estado={f.estado === "futuro" ? "futuro" : "ganho"}
                      className="group-hover:badge-salta group-focus-visible:badge-salta"
                    />
                  </span>
                  <span className="text-xs leading-tight font-medium">
                    {f.titulo}
                  </span>
                  <span
                    className={cn(
                      "text-xs sm:text-[11px]",
                      eAtual ? "font-medium" : "text-muted-foreground"
                    )}
                  >
                    {estadoFaixa(f, nivel)}
                  </span>
                </DialogTrigger>
                <DialogContent size="sm">
                  <FaixaDetalhe f={f} nivel={nivel} />
                </DialogContent>
              </Dialog>
            </li>
          );
        })}
      </ol>

      {proxFaixa ? (
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">
            Próximo nível: {proxFaixa.titulo}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proxFaixa.criterio}
          </p>
          <ProximoNivel nivel={nivel} faixa={proxFaixa} />
        </div>
      ) : (
        <p className="mt-4 border-t border-border/60 pt-4 text-sm font-medium">
          Você chegou à última faixa: a jornada está completa.
        </p>
      )}
    </div>
  );
}

export function ConquistasCard({
  conquistas,
  futuras,
  nivel,
}: {
  conquistas: Conquista[];
  /** a área das que vêm — vazia quando tudo foi conquistado */
  futuras: ConquistaFutura[];
  nivel: NiveisJornada | null;
}) {
  return (
    <section
      id="conquistas"
      className="scroll-mt-20 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Suas conquistas</h2>
        {conquistas.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {conquistas.length}{" "}
            {conquistas.length === 1 ? "conquista" : "conquistas"}
          </span>
        )}
      </div>

      {nivel && <NivelBloco nivel={nivel} />}

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Estante</h3>
        {conquistas.length > 0 ? (
          <ul
            aria-label="Estante"
            className="mt-2 grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-4 lg:grid-cols-5"
          >
            {conquistas.map((c, i) => (
              <li
                key={c.chave}
                className="animate-enter min-w-0"
                style={{ "--i": Math.min(i, 10) } as CSSProperties}
              >
                <ConquistaItem c={c} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhuma conquista ainda. A primeira está logo abaixo, em Ainda
            por vir.
          </p>
        )}
      </div>

      {futuras.length > 0 ? (
        <div className="mt-6 border-t border-border/60 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Ainda por vir</h3>
            <span className="text-xs text-muted-foreground">
              {futuras.length}
            </span>
          </div>
          <ul
            aria-label="Ainda por vir"
            className="mt-2 grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-4 lg:grid-cols-5"
          >
            {futuras.map((f) => (
              <li key={f.chave} className="min-w-0">
                <FuturaItem f={f} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        conquistas.length > 0 && (
          <div className="relative mt-6 flex items-center gap-3 rounded-lg bg-[var(--destaque-suave)] px-4 py-3.5">
            <span className="relative size-6 shrink-0">
              <Brilho className="inset-0 size-6" />
            </span>
            <p className="text-sm font-medium">
              Estante completa: todas as conquistas da jornada são suas.
            </p>
          </div>
        )
      )}
    </section>
  );
}
