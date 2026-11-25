import type { ReactNode } from "react";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import { Barra, Ficha, PecaDetalhe } from "@/components/faixa-detalhe";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import type {
  Conquista,
  ConquistaFutura,
  FamiliaChave,
  RaridadeConquista,
  TierConquista,
} from "@/lib/conquistas";

// O conteúdo do detalhe de uma conquista, compartilhado entre a estante do
// card e os selos do header: um texto só por peça, onde quer que ela abra.

/** O rótulo da raridade no detalhe — a posição do degrau na escada. */
const ROTULO_RARIDADE: Record<RaridadeConquista, string> = {
  inicial: "Degrau inicial",
  constancia: "Degrau de constância",
  marco_grande: "Marco grande",
  lendaria: "Lendária",
};

/** A escada da família no detalhe: todos os degraus em ordem, cada um com
 *  a arte do próprio tier e o estado em texto — ganho com a data, o
 *  próximo com a linha honesta do que falta e os futuros com o critério.
 *  Regressão honesta: a contagem caiu, o degrau apaga junto. */
function EscadaFamilia({
  familia,
  tom,
  tiers,
  linhaProximo,
}: {
  familia: FamiliaChave;
  tom: { cor: string; tinta: string };
  tiers: TierConquista[];
  linhaProximo: string | null;
}) {
  const nProx = tiers.find((t) => !t.ganho)?.n ?? null;
  return (
    <ol
      aria-label="Degraus da conquista"
      className="space-y-1.5 rounded-lg bg-muted/50 p-2"
    >
      {tiers.map((t) => (
        <li key={t.n} className="flex items-center gap-3 px-1.5 py-1">
          <ConquistaEmblema
            glifo={{ tipo: "familia", familia, tier: t.n }}
            tom={tom}
            size={36}
            estado={t.ganho ? "ganho" : "futuro"}
            movimento="quieto"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-tight font-medium">
              {t.titulo}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t.ganho
                ? t.data
                  ? `Conquistado em ${formatDate(t.data)}`
                  : "Conquistado"
                : t.n === nProx && linhaProximo
                  ? linhaProximo
                  : t.criterio}
            </span>
          </span>
          {t.ganho && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {ROTULO_RARIDADE[t.raridade]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const TITULO_ESCADA =
  "mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground";

/** O detalhe de uma conquista ganha (o corpo do Dialog). */
export function DetalheConquista({ c }: { c: Conquista }) {
  return (
    <>
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
          ...(c.raridade
            ? ([["Raridade", ROTULO_RARIDADE[c.raridade]]] as [
                string,
                ReactNode,
              ][])
            : []),
        ]}
      />
      {c.familia && c.tiers && (
        <div>
          <p className={TITULO_ESCADA}>A escada desta conquista</p>
          <EscadaFamilia
            familia={c.familia}
            tom={c.tom}
            tiers={c.tiers}
            linhaProximo={c.proximo?.linha ?? null}
          />
          {c.proximo?.progresso && (
            <div className="mt-3">
              <Barra
                rotulo="Progresso para o próximo degrau"
                atual={c.proximo.progresso.atual}
                alvo={c.proximo.progresso.alvo}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** O detalhe de uma conquista que ainda vem. */
export function DetalheFutura({ f }: { f: ConquistaFutura }) {
  const estado = f.proximo ? "proximo" : "futuro";
  return (
    <>
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
      {f.familia && f.tiers && (
        <div>
          <p className={TITULO_ESCADA}>A escada desta conquista</p>
          <EscadaFamilia
            familia={f.familia}
            tom={f.tom}
            tiers={f.tiers}
            linhaProximo={f.linha}
          />
        </div>
      )}
    </>
  );
}
