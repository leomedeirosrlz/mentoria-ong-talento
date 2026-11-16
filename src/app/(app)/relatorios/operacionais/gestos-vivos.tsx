"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoRoleClient } from "@/lib/demo/shared";
import { tempoRelativo } from "@/lib/ciclo";
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

const MAX = 30;

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
  const [eventos, setEventos] = useState<EventoRecente[]>(inicial);
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
      {eventos.map((e, i) => (
        <li
          key={`${e.criado_em}-${i}`}
          className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            <b className="font-medium text-foreground">
              {ROTULO_PAPEL.get(e.papel) ?? e.papel}
            </b>{" "}
            {ROTULO_ACAO[e.acao] ?? e.acao}{" "}
            <b className="font-medium text-foreground">
              {ROTULO_SUPERFICIE.get(e.superficie) ?? e.superficie}
            </b>
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
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
