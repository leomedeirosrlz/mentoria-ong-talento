"use client";

import { CartaoErro } from "@/components/cartao-erro";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <CartaoErro error={error} retry={retry} variante="pagina" />;
}
