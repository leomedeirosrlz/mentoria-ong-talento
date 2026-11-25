/** Rótulos de intervenção — puros, seguros para server e client. */
const ROTULO: Record<string, string> = {
  troca_mentor: "trocar o mentor",
  troca_mentorado: "trocar o mentorado",
  pausa: "pausar a dupla",
  dpp_para_esp: "encerrar a trilha DPP e seguir com especialista",
  encerramento: "encerrar a dupla",
};

export function rotuloIntervencao(tipo: string): string {
  return ROTULO[tipo] ?? tipo;
}
