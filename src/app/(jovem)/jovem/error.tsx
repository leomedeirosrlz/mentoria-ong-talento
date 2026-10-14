"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

// O mesmo card do error.tsx raiz, mas dentro do JovemShell: a falha de uma
// página não derruba header/nav do jovem — o erro mora na área de conteúdo
// e o "Tentar de novo" re-renderiza só o segmento que quebrou.
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
    <div className="grid min-h-[50dvh] place-items-center">
      <div className="max-w-sm rounded-xl bg-card shadow-[var(--shadow-border)] p-6 text-center">
        <WarningCircle size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Algo deu errado</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Ocorreu um erro inesperado ao carregar esta página. Tente de novo.
          Se continuar assim, fale com a equipe do Realiza.vc.
        </p>
        <Button onClick={() => retry()} className="mt-4">
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
