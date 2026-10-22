"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { postarDevolutiva } from "@/lib/actions-especialista";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Composer de devolutiva da trilha esp (WP6) — só o especialista daquela
 *  dupla aberta escreve (a RPC confere o vínculo); a coordenação lê o feed
 *  mas não posta por ele. */
export function DevolutivaComposer({ duplaId }: { duplaId: string }) {
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await postarDevolutiva({ duplaId, texto });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Devolutiva registrada — o jovem já vê na trilha dele.");
        setTexto("");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        minLength={10}
        maxLength={4000}
        rows={3}
        placeholder="Como a trilha está indo? O que avançou, o que pede atenção…"
        aria-label="Nova devolutiva"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          O jovem lê a devolutiva na página de especialistas dele.
        </p>
        <Button
          type="submit"
          size="sm"
          disabled={pending || texto.trim().length < 10}
        >
          <PaperPlaneRight size={15} aria-hidden />
          {pending ? "Enviando…" : "Postar devolutiva"}
        </Button>
      </div>
    </form>
  );
}
