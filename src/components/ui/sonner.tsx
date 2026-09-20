"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, Warning, XCircle, SpinnerGap } from "@phosphor-icons/react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      /* sonner 2.x não tem duração por tipo no toastOptions — 8s global pra dar
         tempo de ler erro com copy longa; um erro específico ainda pode pedir
         mais via toast.error(msg, { duration }) */
      duration={8000}
      icons={{
        success: (
          <CheckCircle className="size-4" />
        ),
        info: (
          <Info className="size-4" />
        ),
        warning: (
          <Warning className="size-4" />
        ),
        error: (
          <XCircle className="size-4" />
        ),
        loading: (
          <SpinnerGap className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          /* richColors (ativado no layout) tingido pelos tokens do tema */
          "--success-bg": "color-mix(in oklab, var(--ok) 12%, var(--popover))",
          "--success-border": "color-mix(in oklab, var(--ok) 35%, var(--border))",
          "--success-text": "var(--ok-text)",
          "--error-bg": "color-mix(in oklab, var(--danger) 8%, var(--popover))",
          "--error-border": "color-mix(in oklab, var(--danger) 30%, var(--border))",
          "--error-text": "var(--danger)",
          "--warning-bg": "color-mix(in oklab, var(--warn) 15%, var(--popover))",
          "--warning-border": "color-mix(in oklab, var(--warn) 40%, var(--border))",
          "--warning-text": "var(--warn-text)",
          "--info-bg": "var(--muted)",
          "--info-border": "var(--border)",
          "--info-text": "var(--foreground)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
