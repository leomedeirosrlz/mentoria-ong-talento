"use client";

import { useEffect } from "react";
import { Flag, FlagCheckered, Medal, Trophy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { marcosEntre, type MarcoJornada } from "@/lib/ciclo";
import { demoAtivoClient } from "@/lib/demo/shared";

const ICONE_MARCO: Record<MarcoJornada, typeof Flag> = {
  primeiro: Flag,
  metade: Medal,
  reta_final: FlagCheckered,
  completo: Trophy,
};

function textoMarco(marco: MarcoJornada, feitos: number, total: number) {
  switch (marco) {
    case "primeiro":
      return { titulo: "Primeiro encontro realizado", descricao: "A jornada de vocês começou." };
    case "metade":
      return { titulo: "Metade do caminho", descricao: `${feitos} de ${total} encontros feitos.` };
    case "reta_final": {
      const faltam = total - feitos;
      return {
        titulo: "Reta final",
        descricao: faltam === 1
          ? "Falta só 1 encontro pra fechar a jornada."
          : `Faltam só ${faltam} encontros pra fechar a jornada.`,
      };
    }
    case "completo":
      return {
        titulo: "Jornada completa",
        descricao: `${total} encontros realizados · jornada concluída.`,
      };
  }
}

/** Dispara o toast de marco quando `feitos` cruza um limiar. O baseline mora
 *  em localStorage (não em action): cobre registro retroativo, follow-up e
 *  correção feita pela coordenação — qualquer caminho que mude o número. Um
 *  toast só por visita, o mais alto da leva; storage indisponível = sem toast. */
export function MarcoNotifier({
  duplaId,
  feitos,
  total,
}: {
  duplaId: string;
  feitos: number;
  total: number;
}) {
  useEffect(() => {
    // demo: baseline em localStorage persistiria entre visitantes — e com o
    // dataset fixo `visto` seria sempre == feitos, então nada se perde
    if (demoAtivoClient() || total <= 0) return;
    const chave = `realiza:marco:${duplaId}`;
    let visto: number;
    try {
      const raw = localStorage.getItem(chave);
      visto = raw == null ? feitos : Number(raw);
      if (!Number.isFinite(visto)) visto = feitos;
      // guarda o maior visto: correção que apaga um realizado não "des-atinge"
      // o marco — o ícone no nó é o que reflete a verdade do momento
      localStorage.setItem(chave, String(Math.max(visto, feitos)));
    } catch {
      return;
    }
    const novos = marcosEntre(visto, feitos, total);
    const marco = novos[novos.length - 1];
    if (!marco) return;
    const Icone = ICONE_MARCO[marco];
    const { titulo, descricao } = textoMarco(marco, feitos, total);
    toast.success(titulo, {
      icon: <Icone size={18} weight="fill" aria-hidden />,
      description: descricao,
    });
  }, [duplaId, feitos, total]);
  return null;
}
