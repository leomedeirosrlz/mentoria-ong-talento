"use client";

import { CartaoErro } from "@/components/cartao-erro";

// O card do error.tsx raiz, mas dentro do JovemShell: a falha de uma página
// não derruba header/nav do jovem — o erro mora na área de conteúdo.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <CartaoErro error={error} retry={retry} variante="secao" tom="coordenacao" />
  );
}
