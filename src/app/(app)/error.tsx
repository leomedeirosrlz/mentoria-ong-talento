"use client";

import { CartaoErro } from "@/components/cartao-erro";

// O card do error raiz, mas dentro do AppShell: a falha de uma página não
// derruba sidebar/nav — o erro mora na área de conteúdo.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <CartaoErro error={error} retry={retry} variante="secao" />;
}
