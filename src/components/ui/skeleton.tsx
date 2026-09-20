import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // shimmer real: sheen varre muted→muted-foreground/5→muted (loading é transitório, loop justificado)
        "animate-shimmer rounded-md bg-muted bg-linear-to-r from-muted via-muted-foreground/5 to-muted bg-size-[200%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
