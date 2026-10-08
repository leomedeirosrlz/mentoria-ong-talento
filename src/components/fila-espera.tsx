"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { ArrowsLeftRight, Student, UsersThree } from "@phosphor-icons/react";
import type { FilaItem } from "@/lib/fila";
import { textoEspera } from "@/lib/fila";
import { msgAguardandoPar } from "@/lib/whatsapp-msgs";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppRapido } from "@/components/whatsapp-rapido";

/** Seção "Aguardando par" (REALIZA-101) — a fila derivada que o board
 *  "Livres para dupla" não conta: quem se inscreveu e nunca teve par
 *  (mentorados), mais a reserva de mentores com vaga livre. Sempre visível
 *  pra coordenação — esconder atrás do chip era justamente o que deixava
 *  inscrito novo invisível. Ordenada do mais antigo pro mais novo.
 *
 *  A fila é o contexto da decisão, não a ferramenta dela: o pareamento em
 *  si segue no MatchingPanel — `onParear` liga o chip do topo. */
export function FilaEspera({
  mentorados,
  mentores,
  euNome,
  onParear,
}: {
  mentorados: FilaItem[];
  mentores: FilaItem[];
  /** Nome de quem opera — assina a mensagem pronta do WhatsApp. */
  euNome?: string | null;
  /** Liga o board "Livres para dupla"; sem callback o CTA não renderiza
   *  (board já aberto). */
  onParear?: () => void;
}) {
  const total = mentorados.length + mentores.length;
  // congelado na hidratação — o "há N dias" não pode divergir do SSR
  const [agoraMs] = useState(() => Date.now());

  return (
    <section
      aria-labelledby="fila-espera-titulo"
      className="space-y-3 rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="fila-espera-titulo"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground tabular-nums"
        >
          Aguardando par · {total}
        </h2>
        {total > 0 && onParear && (
          <Button variant="outline" size="sm" onClick={onParear}>
            <ArrowsLeftRight size={15} aria-hidden />
            Comparar afinidades
          </Button>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <UsersThree aria-hidden size={18} />
          </span>
          <p className="text-sm font-medium">Todo mundo pareado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Quando uma inscrição chegar ou um mentor abrir vaga, a espera
            aparece aqui — com quanto tempo a pessoa aguarda.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FilaColuna
            titulo="Mentorados"
            itens={mentorados}
            lado="mentorado"
            vazio="Nenhum mentorado aguardando."
            euNome={euNome}
            agoraMs={agoraMs}
          />
          <FilaColuna
            titulo="Mentores com vaga"
            itens={mentores}
            lado="mentor"
            vazio="Nenhum mentor com vaga livre."
            euNome={euNome}
            agoraMs={agoraMs}
          />
        </div>
      )}
    </section>
  );
}

function FilaColuna({
  titulo,
  itens,
  lado,
  vazio,
  euNome,
  agoraMs,
}: {
  titulo: string;
  itens: FilaItem[];
  lado: "mentor" | "mentorado";
  vazio: string;
  euNome?: string | null;
  agoraMs: number;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
        {lado === "mentorado" ? (
          <Student aria-hidden size={14} />
        ) : (
          <UsersThree aria-hidden size={14} />
        )}
        {titulo} ({itens.length})
      </p>
      {itens.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {itens.map((p, i) => (
            <FilaLinha
              key={p.id}
              p={p}
              indice={i}
              lado={lado}
              euNome={euNome}
              agoraMs={agoraMs}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Linha da fila — mesma gramática das listas abaixo: avatar+nome linkam
 *  pra ficha, meta carrega espera + origem (+ vagas do mentor) e o
 *  WhatsApp senta no canto como ação rápida. */
function FilaLinha({
  p,
  indice,
  lado,
  euNome,
  agoraMs,
}: {
  p: FilaItem;
  indice: number;
  lado: "mentor" | "mentorado";
  euNome?: string | null;
  agoraMs: number;
}) {
  const primeiroNome = p.nome.trim().split(/\s+/)[0];
  const espera = p.desde ? textoEspera(p.desde, agoraMs) : null;
  const resto = [
    p.origem,
    p.vagas != null
      ? `${p.vagas} ${p.vagas === 1 ? "vaga livre" : "vagas livres"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      className="animate-enter flex items-center gap-3 py-2"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <Link
        href={`/pessoas/${p.id}`}
        aria-label={`Abrir perfil de ${p.nome}`}
        className="group -my-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar
          nome={p.nome}
          src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
          papel={lado === "mentorado" ? "mentorado" : undefined}
          size={30}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
            {p.nome}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {espera && (
              <span className="font-medium text-foreground/70">
                {espera}
                {resto ? " · " : ""}
              </span>
            )}
            {resto || (!espera ? "cadastro sem data de inscrição" : "")}
          </span>
        </span>
      </Link>
      {p.trilha === "especialista" && (
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          especialista
        </Badge>
      )}
      <WhatsAppRapido
        icone
        destinos={[
          {
            rotulo: `Chamar ${primeiroNome} no WhatsApp`,
            telefone: p.whatsapp,
            mensagem: msgAguardandoPar(lado, p.nome, euNome ?? undefined),
            t: "contato",
          },
        ]}
      />
    </li>
  );
}
