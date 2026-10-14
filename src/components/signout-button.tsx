"use client";

import { useFormStatus } from "react-dom";
import { CircleNotch, SignOut } from "@phosphor-icons/react";
import { signOut } from "@/lib/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  /** texto do botão — vira aria-label quando `somenteIcone` */
  label?: string;
  /** texto durante o envio */
  pendingLabel?: string;
  /** glyph SignOut antes do rótulo — desligar nos links de texto puro */
  icone?: boolean;
  /** esconde o texto — o botão fica só com o ícone */
  somenteIcone?: boolean;
  iconSize?: number;
  variant?: "default" | "outline" | "ghost" | "destructive" | "link";
  size?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";
  className?: string;
  /** classes do <form> — ex.: "contents" dentro de um flex (o form some do
   *  layout e o botão ocupa o slot direto) ou "mt-4" pra respiro */
  formClassName?: string;
};

/** O botão de sair com feedback — o `<form action={signOut}>` solto não dava
 *  sinal nenhum entre o clique e o redirect (em rede fraca parecia clique
 *  morto). O submit mora dentro do form que ele mesmo renderiza, então o
 *  `useFormStatus` enxerga o envio: vira spinner + "Saindo…" e desabilita
 *  contra o duplo clique. O `pending` do form cobre a action inteira — o
 *  estado só desarma quando a navegação acontece.
 *
 *  Três aparências, um componente só:
 *  - item de menu (padrão): glyph SignOut + `label` — shells e perfis;
 *  - `somenteIcone`: só o glyph, `label` vira aria-label (header mobile do
 *    /jovem);
 *  - `icone={false}`: link de texto puro — o spinner entra na frente do
 *    rótulo no pending (telas de conta bloqueada, boas-vindas).
 *  `variant`/`size` aplicam o buttonVariants pra quando o Sair é um botão
 *  de verdade (linha "Sessão" dos perfis — `formClassName="contents"` faz
 *  o form sumir do layout e o botão herdar o slot do flex). */
export function SignOutButton({
  label = "Sair",
  pendingLabel = "Saindo…",
  icone = true,
  somenteIcone = false,
  iconSize = 18,
  variant,
  size,
  className,
  formClassName,
}: SignOutButtonProps) {
  return (
    <form action={signOut} className={formClassName}>
      <Submit
        label={label}
        pendingLabel={pendingLabel}
        icone={icone}
        somenteIcone={somenteIcone}
        iconSize={iconSize}
        variant={variant}
        size={size}
        className={className}
      />
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  icone,
  somenteIcone,
  iconSize,
  variant,
  size,
  className,
}: Required<
  Pick<
    SignOutButtonProps,
    "label" | "pendingLabel" | "icone" | "somenteIcone" | "iconSize"
  >
> &
  Pick<SignOutButtonProps, "variant" | "size" | "className">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={somenteIcone ? (pending ? pendingLabel : label) : undefined}
      className={
        variant != null || size != null
          ? cn(buttonVariants({ variant, size }), className)
          : cn("disabled:opacity-60", className)
      }
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <CircleNotch size={iconSize} className="animate-spin" aria-hidden />
          {!somenteIcone && pendingLabel}
        </span>
      ) : (
        <>
          {icone && <SignOut size={iconSize} aria-hidden />}
          {!somenteIcone && label}
        </>
      )}
    </button>
  );
}
