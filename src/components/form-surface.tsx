"use client";

// "Superfície única por viewport" (spec 022 — US5/US6): form denso (3+
// campos ou select com 8+ itens) nunca abre no `md` de 448px. No desktop
// vira Dialog `lg`+; no celular vira Sheet de rodapé com a ação presa no
// pé — não some abaixo da dobra nem do teclado virtual. É o mesmo padrão
// que já vivia em combinar-plano.tsx e seletor-dia-hora.tsx, extraído
// quando virou convenção dos forms densos.
//
// O `footer` é renderizado pela superfície, fora do `children` — quando o
// corpo é um <form>, o botão de submit do rodapé se associa pelo atributo
// nativo `form={id}` (o <form> não precisa englobar o chrome inteiro).
// Quem não tem <form> segue com onClick no botão, como antes.

import type { ReactElement, ReactNode } from "react";
import { useDesktop } from "@/lib/use-desktop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Só `lg` pra cima — `sm`/`md` ficam fora do tipo de propósito: a
 *  superfície existe justamente pros forms densos, e a convenção exige
 *  respiro. Confirmação e campo único seguem no DialogContent puro. */
export type FormSurfaceSize = "lg" | "xl" | "2xl" | "3xl" | "full";

export function FormSurface({
  open,
  onOpenChange,
  trigger,
  titulo,
  descricao,
  size = "lg",
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gatilho opcional: o elemento (geralmente um Button) que abre a
   *  superfície. Renderizado no lugar da FormSurface na árvore e recebe
   *  as props de trigger do kit (aria-haspopup, foco devolvido ao
   *  fechar). Quem abre por menu/estado deixa sem. */
  trigger?: ReactElement;
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Largura do Dialog no desktop — `lg` (512px) por padrão. */
  size?: FormSurfaceSize;
  /** Ações do rodapé — sempre fixas no pé da área rolante nos dois
   *  modos. No Sheet já vem com a gramática de botões do DialogFooter
   *  (coluna invertida no estreito, fila à direita no largo). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useDesktop();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger ? <DialogTrigger render={trigger} /> : null}
        <DialogContent size={size}>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            {descricao ? (
              <DialogDescription>{descricao}</DialogDescription>
            ) : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter sticky>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="bottom"
        closeLabel="Fechar"
        // h-auto: a folha cresce com o form — a submeta de 3 campos não
        // boia numa folha de 85dvh — e capa em 85dvh pros densos; dentro,
        // o rodapé sticky cobre o resto (molde do seletor-dia-hora)
        className="h-auto max-h-[85dvh] p-4"
      >
        <div className="pr-8">
          <SheetTitle>{titulo}</SheetTitle>
          {descricao ? (
            // DialogDescription é o mesmo primitive (Dialog.Description)
            // — dentro do Sheet liga o aria-describedby do popup igual
            <DialogDescription className="mt-1">
              {descricao}
            </DialogDescription>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
        {footer ? (
          // mesma gramática do combinar-plano: faixa colada no pé do
          // scrollport sangrando o p-4 do SheetContent, com respiro pro
          // indicador do iPhone
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex flex-col-reverse gap-2 border-t bg-sidebar p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
