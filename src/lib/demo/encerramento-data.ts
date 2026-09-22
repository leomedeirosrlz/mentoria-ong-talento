import { getDemoData } from "./data";
import type { AppRole, Encerramento } from "../types";

// Dados do fechamento de ciclo no modo demo — arquivo próprio pra não tocar
// em data.ts. O encerramento vive na dupla d-fim (Luiza × Isabela, ciclo
// anterior completo): mostra o estado final da ficha — checklist cheio,
// autoavaliação recebida, resumo gerado. A row diz 'concluida' mesmo com a
// dupla 'encerrada' no dataset: a 0037 ainda não rodou no banco da demo e a
// fixture conta a história do estado final.

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const D_FIM = uid(0x0605);
const S_ACEITA1 = uid(0x2401); // Sofia × Bia — a solicitacao aceita da d-ok

const haDias = (n: number) =>
  new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

/** Escopo da policy encerramentos_select: coord tudo; mentor e supervisor da
 *  própria dupla. */
function noEscopo(role: AppRole, duplaId: string): boolean {
  const data = getDemoData();
  const dupla = data.duplas.find((d) => d.id === duplaId);
  if (!dupla) return false;
  const eu = data.personas[role];
  return (
    role === "coordenacao" ||
    dupla.mentor?.id === eu.id ||
    dupla.supervisor?.id === eu.id
  );
}

export function demoEncerramentoDaDupla(
  role: AppRole,
  duplaId: string
): Encerramento | null {
  if (!noEscopo(role, duplaId) || duplaId !== D_FIM) return null;
  return {
    id: uid(0x3201),
    dupla_id: D_FIM,
    tipo: "concluida",
    checklist: {
      feedback_final: true,
      feedback_mutuo: true,
      revisao_pdm: true,
      avaliacao_360_enviada: true,
      autoavaliacao: true,
    },
    autoavaliacao_mentor:
      "O que funcionou: as metas pequenas da Isabela — cada semana com uma vitória visível manteve o ritmo. Eu falei demais nos primeiros encontros; quando passei a perguntar antes de sugerir, ela se abriu. Competência que evoluiu: escuta ativa. A desenvolver: pedir feedback do jovem com mais frequência. O que aprendi com a Isa: persistência silenciosa vence talento com pressa.",
    disponivel_proximo_ciclo: true,
    resumo_jornada: [
      "Resumo da jornada — Luiza Campos e Isabela Freitas",
      "Trilha DPP · 16 encontros realizados de 16",
      "Avaliação média do jovem: 3,4/4 (boa)",
      "Combinados cumpridos: 3 de 3",
    ].join("\n"),
    decidido_por: uid(0x0001),
    created_at: haDias(233),
    decidido: { nome: "Marina Duarte" },
  };
}

/** Fechamento da trilha de especialista na solicitação aceita da d-ok — a
 *  devolutiva chega ao mentor DPP pela view do mural (0037). No dataset a
 *  dupla esp1 segue 'ativa' (data.ts é estável): a ficha dela continua
 *  mostrando a trilha aberta — a demo conta a devolutiva do lado de quem
 *  pediu, que é onde a feature mora. */
export function demoTrilhaFechamento(
  solicitacaoId: string
): { devolutiva_pdm: string; trilha_encerrada_em: string } | null {
  if (solicitacaoId !== S_ACEITA1) return null;
  return {
    devolutiva_pdm:
      "Base de frações e funções destravada — a Bia fecha exercícios sozinha quando começa pelo gráfico. Pro PDM: manter a lista semanal de 10 exercícios e partir pra geometria básica no próximo ciclo; ela responde melhor a metas curtas do que a revisões longas.",
    trilha_encerrada_em: haDias(3),
  };
}
