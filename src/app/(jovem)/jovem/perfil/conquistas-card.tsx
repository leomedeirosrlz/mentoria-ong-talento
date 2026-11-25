"use client";

import type { CSSProperties, ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import {
  estadoFaixa,
  FaixaDetalhe,
  ProximoNivel,
} from "@/components/faixa-detalhe";
import { DetalheConquista, DetalheFutura } from "@/components/selos/detalhes";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import type {
  Conquista,
  ConquistaFutura,
  ConquistaGlifo,
  NiveisJornada,
} from "@/lib/conquistas";
import type { OpcaoSelo } from "@/lib/selos-perfil";
import { cn } from "@/lib/utils";
import { EscolherSelos } from "./vitrine-selos";

/** "Suas conquistas" (REALIZA-529): o card fala primeiro do nível e deixa
 *  o resto atrás de expansões — faixas, estante e "Ainda por vir" abrem sob
 *  demanda, então a página não cresce com a coleção. Sem caixa dentro de
 *  caixa: o nível é uma linha com o selo em loop. Toda peça abre o
 *  detalhe (critério, data, estado); nas famílias com tiers o detalhe
 *  mostra a escada inteira. Cliente: as peças são triggers de Dialog. */

/** O tile da peça na grade — o tile inteiro é o gatilho do detalhe (UM
 *  gesto por peça, a régua do card de instrumento da /materiais). A peça
 *  faz a ação uma vez ao aparecer e de novo no hover/foco. */
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
        <ConquistaEmblema glifo={glifo} tom={tom} size={56} estado={estado} />
        <span className="text-xs leading-tight font-medium">{titulo}</span>
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
      <DetalheConquista c={c} />
    </Tile>
  );
}

function FuturaItem({ f }: { f: ConquistaFutura }) {
  return (
    <Tile
      glifo={f.glifo}
      tom={f.tom}
      estado={f.proximo ? "proximo" : "futuro"}
      titulo={f.titulo}
      linha={
        <span className="line-clamp-2 text-xs text-muted-foreground sm:text-[11px]">
          <span className="sr-only">Ainda por vir. </span>
          {f.linha ?? f.criterio}
        </span>
      }
    >
      <DetalheFutura f={f} />
    </Tile>
  );
}

/** Uma expansão do card: a linha-título com a contagem é o gatilho (44px
 *  de alto) e o painel desliza a altura. Fechada por padrão. */
function Secao({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem: number | string;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {contagem}
        </span>
        <CaretDown
          size={14}
          aria-hidden
          className="ml-auto text-muted-foreground transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
        <div className="pb-2">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function NivelResumo({ nivel }: { nivel: NiveisJornada }) {
  const atual = nivel.faixas.find((f) => f.chave === nivel.atual) ?? null;
  // antes de a jornada começar, a peça em destaque é o Início, apagado
  const vitrine = atual ?? nivel.faixas[0];
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
    <div className="mt-3">
      <Dialog>
        <DialogTrigger className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-xl p-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
          <ConquistaEmblema
            glifo={vitrine.glifo}
            tom={vitrine.tom}
            size={88}
            estado={atual ? "ganho" : "futuro"}
            movimento="vivo"
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

      {proxFaixa ? (
        <div className="mt-3">
          <p className="text-sm font-medium">
            Próximo nível: {proxFaixa.titulo}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proxFaixa.criterio}
          </p>
          <ProximoNivel nivel={nivel} faixa={proxFaixa} />
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium">
          Você chegou à última faixa: a jornada está completa.
        </p>
      )}
    </div>
  );
}

/** A régua das 4 faixas: quatro peças em fila, a atual com o anel de
 *  destaque, o estado sempre em texto embaixo. */
function ReguaFaixas({ nivel }: { nivel: NiveisJornada }) {
  return (
    <ol aria-label="Faixas de nível" className="grid grid-cols-4 gap-1">
      {nivel.faixas.map((f) => {
        const eAtual = f.chave === nivel.atual;
        return (
          <li key={f.chave} className="min-w-0">
            <Dialog>
              <DialogTrigger className="group flex h-full w-full flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
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
                    size={48}
                    estado={f.estado === "futuro" ? "futuro" : "ganho"}
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
  );
}

const GRADE =
  "grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-4 lg:grid-cols-5";

export function ConquistasCard({
  conquistas,
  futuras,
  nivel,
  opcoes,
  escolhidas,
}: {
  conquistas: Conquista[];
  /** a área das que vêm — vazia quando tudo foi conquistado */
  futuras: ConquistaFutura[];
  nivel: NiveisJornada | null;
  /** o que o jovem pode pôr no perfil, e o que já está lá */
  opcoes: OpcaoSelo[];
  escolhidas: string[];
}) {
  return (
    <section
      id="conquistas"
      className="scroll-mt-20 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 className="text-base font-semibold">Suas conquistas</h2>
        <EscolherSelos
          opcoes={opcoes}
          escolhidas={escolhidas}
          variante="texto"
        />
      </div>

      {nivel && <NivelResumo nivel={nivel} />}

      <div className="mt-3 divide-y divide-border/60 border-t border-border/60 pt-1">
        {nivel && (
          <Secao titulo="Faixas de nível" contagem={nivel.faixas.length}>
            <ReguaFaixas nivel={nivel} />
          </Secao>
        )}

        <Secao titulo="Estante" contagem={conquistas.length}>
          {conquistas.length > 0 ? (
            <ul aria-label="Estante" className={GRADE}>
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
            <p className="px-1 pb-1 text-sm text-muted-foreground">
              Nenhuma conquista ainda. A primeira está logo abaixo, em Ainda
              por vir.
            </p>
          )}
        </Secao>

        {futuras.length > 0 ? (
          <Secao titulo="Ainda por vir" contagem={futuras.length}>
            <ul aria-label="Ainda por vir" className={GRADE}>
              {futuras.map((f) => (
                <li key={f.chave} className="min-w-0">
                  <FuturaItem f={f} />
                </li>
              ))}
            </ul>
          </Secao>
        ) : (
          conquistas.length > 0 && (
            <p className="px-1 py-3 text-sm font-medium">
              Estante completa: todas as conquistas da jornada são suas.
            </p>
          )
        )}
      </div>
    </section>
  );
}
