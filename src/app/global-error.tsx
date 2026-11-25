"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Último andar: o layout raiz não montou (sessão inválida, cookie velho
 *  pós-deploy). Aqui não existe Tailwind nem RSC — só HTML com estilo
 *  inline. Por isso a saída da sessão é um link GET para
 *  `/auth/sair-limpo`, que apaga os cookies de auth e volta pro login:
 *  sem isso a pessoa ficava presa no "recarregar", repetindo o mesmo
 *  erro, e só saía limpando cookie na mão. */
const cor = {
  tinta: "#1b1b18",
  suave: "#5f5f57",
  borda: "#e2e2da",
  fundo: "#f6f6f0",
  marca: "#7bbf2a",
};

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: cor.fundo,
          color: cor.tinta,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 384,
            width: "100%",
            background: "#fff",
            border: `1px solid ${cor.borda}`,
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <p style={{ margin: 0, fontSize: 28, lineHeight: 1 }}>⚠️</p>
          <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
            Algo deu errado
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: cor.suave,
            }}
          >
            A página não carregou. Tente de novo. Se continuar, saia e entre
            de novo — é o que resolve sessão vencida depois de uma
            atualização.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: cor.marca,
              color: "#10200a",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
          <a
            href="/auth/sair-limpo"
            style={{
              display: "block",
              marginTop: 8,
              width: "100%",
              padding: "10px 16px",
              borderRadius: 999,
              border: `1px solid ${cor.borda}`,
              background: "#fff",
              color: cor.tinta,
              fontSize: 14,
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Sair e entrar de novo
          </a>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 12,
              color: cor.suave,
            }}
          >
            Se o problema persistir, fale com a equipe do Realiza.vc.
          </p>
        </div>
      </body>
    </html>
  );
}
