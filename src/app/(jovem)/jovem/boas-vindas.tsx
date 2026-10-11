"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { concluirOnboarding, signOut } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Boas-vindas do jovem (REALIZA-108) — UMA tela, não um wizard: o programa
 *  já conhece a ficha dele pelo cadastro da coordenação; o primeiro acesso é
 *  só "entrar e ver a dupla". O botão grava onboarded_em e o layout devolve
 *  o shell no refresh. */
export function BoasVindas({ nome }: { nome: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function entrar() {
    start(async () => {
      try {
        const res = await concluirOnboarding();
        if (res?.error) {
          toast.error(res.error);
        } else {
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="mx-auto h-6 w-auto" />
        {/* os dois discos da dupla — mesma marca do empty state do mentor */}
        <span aria-hidden className="mt-10 inline-flex">
          <span className="size-9 rounded-full bg-[var(--brand-lime)] ring-2 ring-background" />
          <span className="-ml-3 size-9 rounded-full bg-[var(--role-mentorado)] ring-2 ring-background" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Bem-vindo, {nome.split(" ")[0]}!
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Aqui você acompanha seus encontros, os combinados com seu mentor e
          os documentos pra assinar — e pode pedir ajuda pra equipe quando
          precisar.
        </p>
        <Button
          onClick={entrar}
          disabled={pending}
          aria-busy={pending}
          className="mt-6 min-h-11 w-full sm:w-auto sm:px-8"
          size="lg"
        >
          {pending ? (
            <CircleNotch size={18} className="animate-spin" aria-hidden />
          ) : (
            <ArrowRight size={18} aria-hidden />
          )}
          {pending ? "Entrando…" : "Entrar"}
        </Button>
        {/* conta errada acontece (e-mail da mãe, celular compartilhado) —
            a saída precisa existir, mas quieta */}
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
          >
            Não é você? Sair e voltar ao login
          </button>
        </form>
      </div>
    </div>
  );
}
