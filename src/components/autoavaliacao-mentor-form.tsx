"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarAutoavaliacao } from "@/lib/actions-encerramento";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Autoavaliação do mentor — a parte dele no fechamento do ciclo (guia: o que
 *  funcionou, o que faria diferente, o que aprendeu com o jovem e se segue no
 *  próximo ciclo). Salva direto na row de encerramento via RPC de escopo
 *  fino; depois da decisão da coordenação a row trava e isto vira leitura. */
export function AutoavaliacaoMentorForm({
  duplaId,
  inicial,
  travada,
}: {
  duplaId: string;
  /** Autoavaliação já salva — null = ainda não enviada. */
  inicial: { texto: string; disponivel: boolean } | null;
  /** true depois do encerramento registrado — o texto vira leitura. */
  travada?: boolean;
}) {
  const [editando, setEditando] = useState(!inicial);
  const [textoLen, setTextoLen] = useState(inicial?.texto.length ?? 0);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await salvarAutoavaliacao(duplaId, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Autoavaliação registrada. A coordenação já vê.");
        setEditando(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // estado salvo e sem edição aberta: lê-se o texto; "Atualizar" reabre o form
  // (só enquanto o encerramento não foi registrado)
  if (inicial && !editando) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--ok-text)]">
          <CheckCircle size={14} aria-hidden />
          Autoavaliação enviada
        </p>
        <p className="whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          {inicial.texto}
        </p>
        <p className="text-xs text-muted-foreground">
          {inicial.disponivel
            ? "Você marcou disponibilidade pro próximo ciclo."
            : "Você não segue no próximo ciclo."}
        </p>
        {!travada && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            onClick={() => setEditando(true)}
          >
            <PencilSimple size={14} />
            Atualizar autoavaliação
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="autoavaliacao">Sua autoavaliação</Label>
          <span
            aria-hidden
            className="text-xs tabular-nums text-muted-foreground"
          >
            {textoLen}/4.000
          </span>
        </div>
        <Textarea
          id="autoavaliacao"
          name="autoavaliacao"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          defaultValue={inicial?.texto ?? ""}
          onChange={(e) => setTextoLen(e.target.value.length)}
          placeholder="O que funcionou e o que você faria diferente? O que aprendeu com o jovem?"
        />
        <p className="text-xs text-muted-foreground">
          Vale o que funcionou, o que você mudaria e o que o jovem te ensinou.
          Entra no fechamento do ciclo junto da avaliação 360º.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/70">
        <input
          type="checkbox"
          name="disponivel_proximo_ciclo"
          defaultChecked={inicial?.disponivel ?? true}
          className="mt-0.5 accent-primary"
        />
        <span>
          Estou disponível pra mentorar no próximo ciclo
          <span className="block text-xs text-muted-foreground">
            A coordenação usa isso pra montar as próximas duplas.
          </span>
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Enviando…"
          : inicial
            ? "Atualizar autoavaliação"
            : "Enviar autoavaliação"}
      </Button>
    </form>
  );
}
