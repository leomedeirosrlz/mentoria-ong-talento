"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** O card de erro das rotas, compartilhado pelos boundaries.
 *
 *  "Tentar de novo" resolve falha passageira; quando o problema é a sessão
 *  (cookie de auth que o servidor não renova mais — típico depois de um
 *  deploy), tentar de novo repete o mesmo erro pra sempre. Por isso o
 *  segundo gesto: um link para `/auth/sair-limpo`, que apaga os cookies de
 *  auth e cai no login. É link, não server action: o caminho onde isso é
 *  usado é o app quebrado. Antes a única saída era limpar cookie na mão no
 *  navegador. */
export function CartaoErro({
  error,
  retry,
  variante = "pagina",
  tom = "equipe",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** "pagina" = tela cheia (error raiz); "secao" = dentro do shell */
  variante?: "pagina" | "secao";
  /** "equipe" (staff) ou "coordenação" — muda só a frase de apoio */
  tom?: "equipe" | "coordenacao";
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className={
        variante === "pagina"
          ? "min-h-[100dvh] grid place-items-center px-4"
          : "grid min-h-[50dvh] place-items-center"
      }
    >
      <div className="max-w-sm rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
        <WarningCircle size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Algo deu errado</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ocorreu um erro inesperado ao carregar esta página. Tente de novo.
          Se continuar, saia e entre de novo — é o que resolve sessão
          vencida. Se o problema persistir, fale com{" "}
          {tom === "equipe" ? "a equipe do Realiza.vc" : "a coordenação"}.
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className={cn(buttonVariants(), "w-full")}
          >
            Tentar de novo
          </button>
          <a
            href="/auth/sair-limpo"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full font-normal"
            )}
          >
            Sair e entrar de novo
          </a>
        </div>
      </div>
    </div>
  );
}
