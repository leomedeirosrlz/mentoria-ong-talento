"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="max-w-sm rounded-xl bg-card shadow-[var(--shadow-border)] p-6 text-center">
        <WarningCircle size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Algo deu errado</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Ocorreu um erro inesperado ao carregar esta página. Tente de novo —
          se o problema continuar, fale com a coordenação.
        </p>
        <Button onClick={() => retry()} className="mt-4">
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
