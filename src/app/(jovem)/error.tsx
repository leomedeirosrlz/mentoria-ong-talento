"use client";

import { CartaoErro } from "@/components/cartao-erro";

// Boundary do grupo (jovem) inteiro — pega o que quebra no próprio
// jovem/layout (gate de papel, getMe), onde nem o JovemShell existe pra
// abrigar o erro. Falha de página cai no error.tsx de jovem/, dentro do
// shell — este aqui é o último andar antes do error global.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <CartaoErro error={error} retry={retry} variante="pagina" tom="equipe" />
  );
}
