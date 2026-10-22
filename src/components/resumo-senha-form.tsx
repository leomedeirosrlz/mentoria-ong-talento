"use client";

import { useState, useTransition } from "react";
import { LockKey } from "@phosphor-icons/react";
import { desbloquearResumo } from "@/lib/actions-resumo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/** Gate de senha do /resumo/<slug> (REALIZA-170). A verificação mora na
 *  RPC via server action — aqui é só o form. No sucesso a página recarrega
 *  inteira: o cookie httpOnly que a action gravou abre o relatório. */
export function ResumoSenhaForm({ slug }: { slug: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const senha = new FormData(e.currentTarget).get("senha");
    if (typeof senha !== "string" || !senha.trim()) {
      setErro("Digite a senha recebida da coordenação.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await desbloquearResumo(slug, senha.trim());
      if (r.ok) {
        // recarrega a rota: o server component re-renderiza já com o
        // cookie e mostra o relatório (o form nunca recebe os dados)
        window.location.reload();
        return;
      }
      setErro(r.erro);
    });
  }

  return (
    <div className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] sm:p-8">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <LockKey size={24} aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Relatório protegido</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Este resumo é compartilhado com uma senha. Digite a senha que a
        coordenação enviou junto com o link.
      </p>
      <form onSubmit={enviar} className="mx-auto mt-5 max-w-xs space-y-3 text-left">
        <div className="space-y-1.5">
          <Label htmlFor="resumo-senha">Senha do relatório</Label>
          <PasswordInput
            id="resumo-senha"
            name="senha"
            autoComplete="off"
            autoFocus
            required
            placeholder="xxxx-xxxx"
            aria-invalid={!!erro}
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pendente}>
          {pendente ? "Verificando…" : "Abrir relatório"}
        </Button>
      </form>
    </div>
  );
}
