"use client";

import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";

/** "Preciso de ajuda" do jovem — 0084: o canal de segurança abre um chamado
 *  (opções na linguagem dele, "É urgente" sempre à mão) em vez de uma
 *  notificação solta. O pedido fica com dono, estado e trilha de resposta —
 *  e o mentor dele NÃO vê: o canal pode ser justamente sobre a dupla. */
export function PedirAjudaDialog({
  trigger,
}: {
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
}) {
  return <NovoChamadoDialog papel="mentorado" trigger={trigger} />;
}
