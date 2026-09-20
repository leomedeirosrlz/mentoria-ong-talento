"use client";

import { useEffect, useState } from "react";

/** Revela o conteúdo quando o instante `from` chega — pra UI que vira válida
 *  durante a sessão (ex.: encontro agendado que acabou de passar e agora
 *  aceita registro), sem depender de um novo render do servidor. */
export function RevelarApos({
  from,
  children,
}: {
  /** ISO timestamp — conteúdo aparece a partir dele. */
  from: string;
  children: React.ReactNode;
}) {
  // estado inicial calculado na pintura (server e client avaliam o mesmo
  // instante ~igual); o intervalo re-verifica a cada 30s pra quem deixou a
  // aba aberta atravessando o horário
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (new Date(from).getTime() > agora) return null;
  return <>{children}</>;
}
