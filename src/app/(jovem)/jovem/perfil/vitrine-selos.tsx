"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilSimple, Sparkle } from "@phosphor-icons/react";
import { ConquistaEmblema } from "@/components/conquista-emblema";
import { FaixaDetalhe } from "@/components/faixa-detalhe";
import { DetalheConquista } from "@/components/selos/detalhes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { salvarSelosDoPerfil } from "@/lib/actions-selos";
import type { NiveisJornada } from "@/lib/conquistas";
import { MAX_SELOS } from "@/lib/selos-perfil";
import type { OpcaoSelo, PecaSelo } from "@/lib/selos-perfil";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Os selos do perfil (REALIZA-529): só as peças, soltas ao lado da foto,
 *  sem caixa nem rótulo — o nome vive no aria-label e no detalhe. São até
 *  3, as que o jovem escolheu, e é a única parte da tela que se mexe em
 *  loop. Cada uma abre o mesmo detalhe da estante. */
export function VitrineSelos({
  pecas,
  opcoes,
  escolhidas,
  nivel,
}: {
  pecas: PecaSelo[];
  opcoes: OpcaoSelo[];
  escolhidas: string[];
  nivel: NiveisJornada | null;
}) {
  return (
    <div
      role="group"
      aria-label="Selos do perfil"
      className="ml-auto flex items-center gap-0.5"
    >
      {pecas.map((p) => (
        <Dialog key={p.chave}>
          <DialogTrigger
            aria-label={`${
              p.origem === "nivel" ? p.faixa.titulo : p.conquista.titulo
            }. Abrir detalhe`}
            className="rounded-xl p-0.5 outline-none transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <ConquistaEmblema
              glifo={p.origem === "nivel" ? p.faixa.glifo : p.conquista.glifo}
              tom={p.origem === "nivel" ? p.faixa.tom : p.conquista.tom}
              size={64}
              movimento="vivo"
            />
          </DialogTrigger>
          <DialogContent size="sm">
            {p.origem === "nivel" && nivel ? (
              <FaixaDetalhe f={p.faixa} nivel={nivel} />
            ) : p.origem === "conquista" ? (
              <DetalheConquista c={p.conquista} />
            ) : null}
          </DialogContent>
        </Dialog>
      ))}
      <EscolherSelos
        opcoes={opcoes}
        escolhidas={escolhidas}
        variante="icone"
      />
    </div>
  );
}

/** "Escolher até 3": abre a grade de tudo o que já é do jovem. Toque
 *  liga/desliga a peça e o número no canto é a ordem em que aparecem; com
 *  3 marcadas as outras ficam paradas até soltar uma. A lista rola DENTRO
 *  do dialog, nunca na página. */
export function EscolherSelos({
  opcoes,
  escolhidas,
  variante,
}: {
  opcoes: OpcaoSelo[];
  escolhidas: string[];
  variante: "icone" | "texto";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<string[]>(escolhidas);
  const [pendente, comecar] = useTransition();
  const cheio = sel.length >= MAX_SELOS;

  function alternar(chave: string) {
    setSel((atual) =>
      atual.includes(chave)
        ? atual.filter((k) => k !== chave)
        : atual.length >= MAX_SELOS
          ? atual
          : [...atual, chave]
    );
  }

  function salvar(chaves: string[] | null, aviso: string) {
    comecar(async () => {
      const res = await salvarSelosDoPerfil(chaves);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(aviso);
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        // reabrir sempre parte do que está salvo, não do rascunho anterior
        if (o) setSel(escolhidas);
        setAberto(o);
      }}
    >
      {variante === "icone" ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Escolher os selos do perfil"
              className="text-muted-foreground"
            />
          }
        >
          <PencilSimple size={16} aria-hidden />
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="-mr-2 shrink-0" />
          }
        >
          <Sparkle size={14} aria-hidden />
          Escolher selos do perfil
        </DialogTrigger>
      )}
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Selos do perfil</DialogTitle>
          <DialogDescription>
            Escolha até {MAX_SELOS}. Eles aparecem ao lado da sua foto.
          </DialogDescription>
        </DialogHeader>
        {opcoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Seus selos aparecem aqui conforme você conquista. O primeiro vem
            logo.
          </p>
        ) : (
          <ul
            aria-label="Selos que você já tem"
            className="-mx-1 grid max-h-[min(52dvh,24rem)] grid-cols-3 gap-1 overflow-y-auto px-1 py-1 sm:grid-cols-4"
          >
            {opcoes.map((o) => {
              const pos = sel.indexOf(o.chave);
              const marcado = pos >= 0;
              const travado = !marcado && cheio;
              return (
                <li key={o.chave} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={marcado}
                    aria-disabled={travado || undefined}
                    onClick={() => !travado && alternar(o.chave)}
                    className={cn(
                      "relative flex h-full w-full min-h-11 flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-center outline-none transition-[background-color,box-shadow,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                      marcado
                        ? "bg-[var(--destaque-suave)] ring-2 ring-[var(--destaque)]"
                        : "hover:bg-muted/60",
                      travado && "cursor-not-allowed opacity-45"
                    )}
                  >
                    <ConquistaEmblema
                      glifo={o.glifo}
                      tom={o.tom}
                      size={52}
                      movimento="quieto"
                    />
                    <span className="line-clamp-2 text-xs leading-tight font-medium">
                      {o.titulo}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {o.linha}
                    </span>
                    {marcado && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-[var(--brand-ink)] text-[11px] font-semibold text-white tabular-nums"
                      >
                        {pos + 1}
                      </span>
                    )}
                    {marcado && (
                      <span className="sr-only">
                        Escolhido, posição {pos + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p
            aria-live="polite"
            className="mr-auto text-xs text-muted-foreground"
          >
            {cheio
              ? `${MAX_SELOS} de ${MAX_SELOS}. Solte um para trocar.`
              : `${sel.length} de ${MAX_SELOS} escolhidos`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={pendente}
            onClick={() => salvar(null, "Voltamos à sugestão da casa.")}
          >
            Usar sugestão
          </Button>
          <Button
            size="sm"
            disabled={pendente}
            onClick={() =>
              salvar(
                sel,
                sel.length
                  ? "Selos do perfil atualizados."
                  : "Perfil sem selos por enquanto."
              )
            }
          >
            <Check size={14} aria-hidden />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
