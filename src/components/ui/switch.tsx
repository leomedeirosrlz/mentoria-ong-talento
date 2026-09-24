"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// Root renderiza um <span role="switch"> + <input> oculto — o a11y vem do
// primitive; aqui é só a casca (trilha input→primary, thumb branco).
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-input transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary dark:bg-input/30",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-150 ease-snappy data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
