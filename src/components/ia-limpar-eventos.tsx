"use client";

// Header button of /ia: wipes ia_eventos (every chart's indicators) via
// DELETE /api/ia/eventos. The panel is server-rendered, so success calls
// router.refresh() to recompose from zero. Separate from the evals
// history wipe by decision — deleting runs doesn't touch this, and this
// button doesn't touch runs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function IaLimparEventos() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limpar = async () => {
    setLimpando(true);
    setErro(null);
    try {
      const r = await fetch("/api/ia/eventos", { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setErro(j?.error ?? "Não consegui limpar os indicadores.");
        return;
      }
      setAberto(false);
      router.refresh();
    } finally {
      setLimpando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "min-h-11 text-xs font-semibold text-foreground/80 sm:min-h-8"
        )}
      >
        <Trash size={14} aria-hidden />
        Limpar indicadores
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limpar indicadores do painel?</DialogTitle>
          <DialogDescription>
            Zera consumo, tokens, custo, ferramentas e erros de todos os
            gráficos e listas do Uso da Liza — inclusive o que veio de
            rodadas de eval. O histórico de runs não é afetado. Não dá pra
            desfazer.
          </DialogDescription>
        </DialogHeader>
        {erro && (
          <p role="alert" className="text-sm text-[var(--danger-text)]">
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={limpando} onClick={() => void limpar()}>
            {limpando ? (
              <>
                <CircleNotch size={14} aria-hidden className="animate-spin" />
                Limpando…
              </>
            ) : (
              "Limpar tudo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
