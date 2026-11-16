"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoRoleClient } from "@/lib/demo/shared";
import { tempoRelativo } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import {
  ROTULO_PAPEL,
  ROTULO_SUPERFICIE,
  type EventoRecente,
} from "@/lib/adocao";

// REALIZA-417 — feed L3 "gestos recentes": carga inicial vem de
// dadosAdocaoRecentes (RPC) e o canal postgres_changes vai prependando
// os eventos novos em tempo real (tabela na publication — 0198). Se o
// canal falhar o feed fica estático com a carga inicial, sem ruído de
// erro — é superfície de confiança, não de alerta.

// feed de relance, não arquivo: uma dúzia de linhas cobre o "agora" sem
// empurrar o fim da página (o mesmo teto da carga inicial da seção)
const MAX = 12;

/** `novo` marca o que chegou pelo canal (vs. a carga inicial) — só ele
 *  ganha o flash de entrada. */
type EventoVivo = EventoRecente & { novo?: boolean };

const ROTULO_ACAO: Record<string, string> = {
  pageview: "visitou",
  busca: "buscou",
  sort: "ordenou",
  dialog: "abriu a Liza em",
  nudge: "enviou lembrete em",
  form_emitido: "emitiu formulário em",
  material_aberto: "abriu material em",
  lembrete_whatsapp: "lembrete WhatsApp em",
};

export function GestosVivos({ inicial }: { inicial: EventoRecente[] }) {
  const [eventos, setEventos] = useState<EventoVivo[]>(inicial);
  // agora congelado no mount — tempoRelativo pede um relógio só, senão
  // SSR e hidratação divergem no "há N min"
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    // demo não assina: o canal traria eventos REAIS pra dentro do feed
    // sintético da persona — a demo recebe só a carga inicial fabricada
    if (demoRoleClient()) return;
    const supabase = createClient();
    const canal = supabase
      .channel("adocao-gestos")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "produto_eventos",
        },
        (payload) => {
          const r = payload.new as {
            superficie?: string;
            acao?: string;
            papel?: string;
            created_at?: string;
          };
          if (!r.superficie || !r.acao) return;
          setEventos((atual) =>
            [
              {
                superficie: r.superficie!,
                acao: r.acao!,
                papel: r.papel ?? "desconhecido",
                criado_em: r.created_at ?? new Date().toISOString(),
                novo: true,
              },
              ...atual,
            ].slice(0, MAX)
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  return (
    <ul className="divide-y divide-border/60" aria-live="off">
      {eventos.map((e) => (
        <li
          // chave composta e estável — com o índice na chave o prepend do
          // canal remontava a lista inteira a cada evento novo. O papel
          // entra porque um lote batelado pode empatar ts+superfície+ação
          // (o flush grava vários gestos num statement só)
          key={`${e.criado_em}-${e.superficie}-${e.acao}-${e.papel}`}
          className={cn(
            "flex items-baseline gap-2 py-1.5 text-xs",
            e.novo && "animate-flash-ok"
          )}
        >
          <span className="min-w-0 truncate text-muted-foreground">
            <b className="font-medium text-foreground">
              {ROTULO_PAPEL.get(e.papel) ?? e.papel}
            </b>{" "}
            {ROTULO_ACAO[e.acao] ?? e.acao}{" "}
            <b
              className="font-medium text-foreground"
              // a linha corta no fim — a superfície é quem some; o title
              // devolve o nome íntegro
              title={ROTULO_SUPERFICIE.get(e.superficie) ?? e.superficie}
            >
              {ROTULO_SUPERFICIE.get(e.superficie) ?? e.superficie}
            </b>
          </span>
          {/* o "há N min" cola no conteúdo (justify-between afastava ele
              ~1000px do texto); a coluna fixa alinha o bloco à direita */}
          <span className="w-16 shrink-0 whitespace-nowrap text-right tabular-nums text-muted-foreground">
            {tempoRelativo(e.criado_em, agora)}
          </span>
        </li>
      ))}
      {eventos.length === 0 && (
        <li className="py-2 text-xs text-muted-foreground">
          Nenhum gesto coletado ainda. A coleta começou agora.
        </li>
      )}
    </ul>
  );
}
