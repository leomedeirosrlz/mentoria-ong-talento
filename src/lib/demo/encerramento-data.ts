import { getDemoData } from "./data";
import type { AppRole, Encerramento } from "../types";

// Dados do fechamento de ciclo no modo demo — arquivo próprio pra não tocar
// em data.ts. Dois encerramentos: o da d-fim (Luiza × Isabela, ciclo anterior
// completo) mostra o estado final — checklist cheio, autoavaliação recebida,
// resumo gerado; o da d-ok (Ricardo × Ana) está em andamento — rito aberto
// com checklist parcial. A row da d-fim diz 'concluida' mesmo com a dupla
// 'encerrada' no dataset: a 0037 ainda não rodou no banco da demo e a fixture
// conta a história do estado final.

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const D_FIM = uid(0x0605);
const D_OK = uid(0x0601);
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

// um encerramento por dupla (unique(dupla_id)): a d-fim mostra o rito
// completo e decidido; a d-ok está em andamento — checklist parcial (360º
// carimbada pela resposta do Ricardo, revisão do PDM marcada), autoavaliação
// do mentor e decisão ainda pendentes — a ficha mostra o rito vivo
const ENCERRAMENTOS: Record<string, Encerramento> = {
  [D_FIM]: {
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
      "Resumo da jornada · Luiza Campos e Isabela Freitas",
      "Trilha DPP · 16 encontros realizados de 16",
      "Avaliação média do jovem: 3,4/4 (boa)",
      "Combinados cumpridos: 3 de 3",
    ].join("\n"),
    decidido_por: uid(0x0001),
    created_at: haDias(233),
    decidido: { nome: "Marina Duarte" },
  },
  [D_OK]: {
    id: uid(0x4801),
    dupla_id: D_OK,
    tipo: null, // decisão pendente
    checklist: {
      revisao_pdm: true,
      avaliacao_360_enviada: true,
    },
    autoavaliacao_mentor: null,
    disponivel_proximo_ciclo: null,
    resumo_jornada: null,
    decidido_por: null,
    created_at: haDias(6),
    decidido: null,
  },
};

export function demoEncerramentoDaDupla(
  role: AppRole,
  duplaId: string
): Encerramento | null {
  if (!noEscopo(role, duplaId)) return null;
  return ENCERRAMENTOS[duplaId] ?? null;
}

/** Fechamento da trilha de especialista atrelada a uma solicitação — a
 *  devolutiva chega ao mentor DPP pela view do mural (0037). Caminho comum:
 *  solicitação → dupla de especialista → devolutiva gravada no encerramento.
 *  A esp1 é exceção narrativa: no dataset ela segue 'ativa' (data.ts é
 *  estável) enquanto a devolutiva já aparece pra quem pediu — o caso que a
 *  feature precisa demonstrar. */
export function demoTrilhaFechamento(
  solicitacaoId: string
): { devolutiva_pdm: string; trilha_encerrada_em: string } | null {
  if (solicitacaoId === S_ACEITA1) {
    return {
      devolutiva_pdm:
        "Base de frações e funções destravada — a Bia fecha exercícios sozinha quando começa pelo gráfico. Pro PDM: manter a lista semanal de 10 exercícios e partir pra geometria básica no próximo ciclo; ela responde melhor a metas curtas do que a revisões longas.",
      trilha_encerrada_em: haDias(3),
    };
  }
  const sol = getDemoData().solicitacoes.find((s) => s.id === solicitacaoId);
  const dupla = sol?.dupla_id
    ? getDemoData().duplas.find((d) => d.id === sol.dupla_id)
    : null;
  if (!dupla?.devolutiva_pdm || !dupla.encerrada_em) return null;
  return {
    devolutiva_pdm: dupla.devolutiva_pdm,
    trilha_encerrada_em: dupla.encerrada_em,
  };
}
