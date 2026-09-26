"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

/** Root já traz o próprio Provider — um tooltip solto funciona sem montar
 *  nada em volta. Agrupar vários num <TooltipProvider> compartilha o delay
 *  (passar o mouse de um botão pro vizinho mostra na hora). */
function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  )
}

function TooltipProvider({ ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 origin-(--transform-origin) rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-[var(--shadow-overlay)] duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none data-[side=bottom]:slide-in-from-top-0.5 data-[side=top]:slide-in-from-bottom-0.5 data-[side=left]:slide-in-from-right-0.5 data-[side=right]:slide-in-from-left-0.5 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent }
