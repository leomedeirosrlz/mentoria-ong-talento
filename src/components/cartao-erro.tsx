"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { recuperarSessao } from "@/lib/actions-sessao";
import { Button } from "@/components/ui/button";

/** O card de erro das rotas, compartilhado pelos quatro boundaries.
 *
 *  "Tentar de novo" resolve falha passageira; quando o problema é a sessão
 *  (cookie de auth que o servidor não renova mais — típico depois de um
 *  deploy), tentar de novo repete o mesmo erro pra sempre. Por isso o
 *  segundo gesto: limpa os cookies de auth e cai no login. Antes a única
 *  saída era limpar cookie na mão no navegador. */
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
      <div className="max-w-sm rounded-xl bg-card shadow-[var(--shadow-border)] p-6 text-center">
        <WarningCircle size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Algo deu errado</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ocorreu um erro inesperado ao carregar esta página. Tente de novo.
          Se continuar, saia e entre de novo — é o que resolve sessão
          vencida. Se o problema persistir, fale com{" "}
          {tom === "equipe" ? "a equipe do Realiza.vc" : "a coordenação"}.
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-2">
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <form action={recuperarSessao}>
            <Button
              type="submit"
              variant="outline"
              className="w-full font-normal"
            >
              Sair e entrar de novo
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
