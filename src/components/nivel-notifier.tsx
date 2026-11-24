"use client";

import { useEffect } from "react";
import { Lightning } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { demoAtivoClient } from "@/lib/demo/shared";
import type { NivelChave } from "@/lib/conquistas";

const ORDEM: NivelChave[] = ["inicio", "constancia", "veterania", "completa"];

/** Dispara o toast de faixa quando o nível sobe (024). O baseline mora em
 *  localStorage (`realiza:nivel:<mentoradoId>`, o padrão do MarcoNotifier):
 *  cobre encontro retroativo e correção da coordenação — qualquer caminho
 *  que mude a faixa. Guarda o maior visto: faixa perdida não "des-avisa".
 *  Um toast por visita; storage indisponível = silêncio. */
export function NivelNotifier({
  mentoradoId,
  atual,
  titulo,
  criterio,
}: {
  mentoradoId: string;
  /** a faixa atual — null antes do Início (nível nenhum = sem toast) */
  atual: NivelChave | null;
  /** o nome da faixa ("Constância") — já vem resolvido da régua */
  titulo: string | null;
  /** o critério dela já cumprido ("1 mês de programa e 4 encontros com seu
   *  mentor") — a descrição do toast */
  criterio: string | null;
}) {
  useEffect(() => {
    // demo: baseline em localStorage persistiria entre visitantes — e com o
    // dataset fixo `visto` seria sempre == agora, então nada se perde
    if (demoAtivoClient()) return;
    const agora = atual ? ORDEM.indexOf(atual) : -1;
    const chave = `realiza:nivel:${mentoradoId}`;
    let visto: number;
    try {
      const raw = localStorage.getItem(chave);
      visto = raw == null ? agora : Number(raw);
      if (!Number.isFinite(visto)) visto = agora;
      localStorage.setItem(chave, String(Math.max(visto, agora)));
    } catch {
      return;
    }
    if (agora <= visto || !atual || !titulo) return;
    toast.success(`Subiu de nível: ${titulo}`, {
      icon: <Lightning size={18} weight="fill" aria-hidden />,
      description: criterio ? `${criterio}. Segue firme.` : "Segue firme.",
    });
  }, [mentoradoId, atual, titulo, criterio]);
  return null;
}
