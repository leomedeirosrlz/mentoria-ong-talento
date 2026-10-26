"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Monitor, Moon, Sun, type Icon } from "@phosphor-icons/react";
import {
  aplicarTemaDom,
  gravarTemaClient,
  type Tema,
} from "@/lib/tema";
import { cn } from "@/lib/utils";

const OPCOES: { valor: Tema; label: string; Icone: Icon }[] = [
  { valor: "auto", label: "Sistema", Icone: Monitor },
  { valor: "claro", label: "Claro", Icone: Sun },
  { valor: "escuro", label: "Escuro", Icone: Moon },
];

/** Controle segmentado de tema (REALIZA-192) — mora numa ContaLinha do
 *  /perfil (staff e jovem). Escreve o cookie `tema`, aplica a classe no
 *  <html> na hora e pede router.refresh() pro server re-renderizar com a
 *  preferência nova (o próximo carregamento já nasce resolvido).
 *  `tema` vem da página (server leu o cookie) — o controle nasce marcado
 *  certo sem flash de "Sistema". */
export function TemaToggle({ tema }: { tema: Tema }) {
  const router = useRouter();
  const [atual, setAtual] = useState<Tema>(tema);

  function escolher(v: Tema) {
    if (v === atual) return;
    setAtual(v);
    gravarTemaClient(v);
    aplicarTemaDom(v);
    router.refresh();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Aparência"
      className="inline-flex shrink-0 items-center rounded-full bg-muted p-0.5"
    >
      {OPCOES.map(({ valor, label, Icone }) => {
        const ativo = atual === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => escolher(valor)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              ativo
                ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icone size={14} weight={ativo ? "fill" : "regular"} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
