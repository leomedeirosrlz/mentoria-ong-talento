// Copy de privacidade da avaliação estrela do jovem, por trilha. Fonte única:
// a lista de avaliações, o diálogo, o formulário (logado e público) e a
// confirmação leem daqui. O texto segue o corte real do banco:
//   · DPP: o mentor vê só a média (avaliacao_media_dpp, lotes de 3) e a
//     resposta inteira só quando o jovem liga o toggle (0071).
//   · Especialista: o especialista (view especialista_avaliacoes, 0090) e o
//     mentor DPP (trilha_do_jovem, 0092) veem só a nota da sessão.

export type TrilhaAvaliacao = "dpp" | "especialista";

/** "ambas" é a frase única da lista quando o jovem tem as duas trilhas: junta
 *  o que vale pras duas sem repetir a mesma explicação. */
export const PRIVACIDADE_AVALIACAO: Record<TrilhaAvaliacao | "ambas", string> = {
  dpp: "Suas respostas ficam entre você e a equipe da Realiza.vc. Seu mentor vê só a média das notas, e você escolhe se ele lê esta.",
  especialista:
    "Suas respostas ficam entre você e a equipe da Realiza.vc. Seu mentor e seu especialista veem só a nota desta sessão.",
  ambas:
    "Suas respostas ficam entre você e a equipe da Realiza.vc. Seu mentor vê só a média das notas e lê uma resposta só se você liberar. Nas sessões com especialista, seu mentor e seu especialista veem só a nota da sessão.",
};

/** Trilha que não é especialista cai na DPP, o mesmo default da página. */
export function privacidadeAvaliacao(trilha: string | null | undefined): string {
  return trilha === "especialista"
    ? PRIVACIDADE_AVALIACAO.especialista
    : PRIVACIDADE_AVALIACAO.dpp;
}

/** Uma frase só para a lista de avaliações: a da trilha, ou a combinada quando
 *  as trilhas do jovem são duas. */
export function privacidadeAvaliacoes(trilhas: readonly (string | null | undefined)[]): string {
  const tipos = new Set(trilhas.map((t) => (t === "especialista" ? "especialista" : "dpp")));
  return tipos.size > 1 ? PRIVACIDADE_AVALIACAO.ambas : privacidadeAvaliacao(trilhas[0]);
}
