"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { X } from "@phosphor-icons/react"

/* Painel lateral (menu do celular): o mesmo Dialog do Base UI — foco preso,
 * Esc fecha, backdrop fecha, scroll da página travado — ancorado numa borda
 * em vez de centralizado. Desliza da borda; o guard global de
 * prefers-reduced-motion zera a animação. */

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

const LADO = {
  left: "inset-y-0 left-0 h-dvh w-[min(20rem,85vw)] border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
  right: "inset-y-0 right-0 h-dvh w-[min(20rem,85vw)] border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
  // painel de rodapé (assistente no mobile): altura alvo do design, arredonda
  // só em cima e desliza da borda inferior — cobre nav+FAB pelo z-50
  bottom: "inset-x-0 bottom-0 h-[min(70dvh,640px)] rounded-t-2xl border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
} as const

function SheetContent({
  className,
  children,
  side = "left",
  showCloseButton = true,
  keepMounted,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: keyof typeof LADO
  showCloseButton?: boolean
} & Pick<DialogPrimitive.Portal.Props, "keepMounted">) {
  return (
    <DialogPrimitive.Portal keepMounted={keepMounted}>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-[var(--overlay-forte)] duration-200 ease-[cubic-bezier(0.2,0,0,1)] supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--shadow-modal)] outline-none duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-open:animate-in data-closed:animate-out",
          LADO[side],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2"
              />
            }
          >
            <X />
            <span className="sr-only">Fechar menu</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger }
