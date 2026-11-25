"use client";

import { ConquistaEmblema } from "@/components/conquista-emblema";
import { FaixaDetalhe } from "@/components/faixa-detalhe";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import type { NiveisJornada } from "@/lib/conquistas";

/** O selo "Seu nível" do header do perfil (024): a peça da faixa atual ao
 *  lado direito do avatar — o raio que já diz quanta energia a jornada
 *  acumulou — mais a micro-linha (desde quando, há quantos dias). Abre o
 *  mesmo FaixaDetalhe do bloco do card. O `nivel-chega` é o settle curto:
 *  sobe 5px uma vez só no paint, sem loop. Fecha a linha com ml-auto: o
 *  "Remover foto" fantasma fica colado no avatar e o selo na ponta. */
export function SeloNivel({ nivel }: { nivel: NiveisJornada }) {
  const atual = nivel.faixas.find((f) => f.chave === nivel.atual) ?? null;
  // antes da primeira faixa o selo vitrina o Início apagado — a régua
  // inteira já fala da jornada que vem
  const vitrine = atual ?? nivel.faixas[0];
  const meta = atual
    ? [
        `Desde ${formatDate(atual.data)}`,
        nivel.diasDePrograma != null
          ? `${nivel.diasDePrograma} ${nivel.diasDePrograma === 1 ? "dia" : "dias"} de programa`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : vitrine.criterio;
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`${atual ? "Seu nível" : "Primeiro nível"}: ${vitrine.titulo}${
          atual?.data ? `, desde ${formatDate(atual.data)}` : ""
        }. Abrir detalhe da faixa`}
        className="nivel-chega group mb-0.5 ml-auto flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card py-2 pr-4 pl-2 text-left shadow-[var(--shadow-border)] outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ConquistaEmblema
          glifo={vitrine.glifo}
          tom={vitrine.tom}
          size={44}
          estado={atual ? "ganho" : "futuro"}
        />
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {atual ? "Seu nível" : "Primeiro nível"}
          </span>
          <span className="block truncate text-sm leading-tight font-semibold">
            {vitrine.titulo}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {meta}
          </span>
        </span>
      </DialogTrigger>
      <DialogContent size="sm">
        <FaixaDetalhe f={vitrine} nivel={nivel} />
      </DialogContent>
    </Dialog>
  );
}
