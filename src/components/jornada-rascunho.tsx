"use client";

import { useSyncExternalStore } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

/** WP7 — "Em andamento" é conhecimento local: o rascunho do /f/<token> mora
 *  no localStorage DESTE aparelho (mesma chave do form, `rascunho:/f/<token>`
 *  — ver formulario-publico.tsx e use-resposta.ts). useSyncExternalStore é
 *  o padrão da base pra divergência SSR↔client (ver use-origem.ts): SSR e
 *  hidratação renderizam o pill padrão (children, "A fazer") via
 *  getServerSnapshot; a re-render pós-hidratação lê o storage e troca —
 *  sem setState em effect, sem mismatch. E honesto por construção: o
 *  rascunho não viaja entre devices, e o texto diz isso. */
export function JornadaRascunho({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const temRascunho = useSyncExternalStore(
    // o rascunho só muda na página do form (outra rota) — leitura única
    // no mount basta; storage events não disparam na mesma aba de qq jeito
    () => () => {},
    () => {
      try {
        const raw = localStorage.getItem(`rascunho:/f/${token}`);
        if (!raw) return false;
        const obj = JSON.parse(raw) as Record<string, unknown>;
        // resposta parcial de verdade: qualquer campo com valor preenchido
        // (o form limpa a chave no submit — achar a chave já é quase tudo)
        return Object.values(obj).some(
          (v) =>
            v != null &&
            v !== "" &&
            v !== false &&
            !(Array.isArray(v) && v.length === 0)
        );
      } catch {
        // storage negado (modo privado) ou JSON corrompido — o estado
        // verdadeiro do servidor é "a fazer", e é o que fica na tela
        return false;
      }
    },
    () => false
  );

  if (!temRascunho) return <>{children}</>;

  return (
    <>
      <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
        <PencilSimple data-icon="inline-start" aria-hidden />
        Em andamento
      </Badge>
      <span className="text-xs text-muted-foreground">
        rascunho salvo neste aparelho
      </span>
    </>
  );
}
