// 027/FR-002 — mix determinístico de avaliacao_visivel_mentor por número
// do encontro: toda 3ª avaliação respondida fica fora da visão do mentor.
// Módulo separado pra o Vitest cobrir a regra sem rodar a seed.
//
// Cobertura: os encontros avaliados são i%5!==4 (−avalPendente), então a
// 3ª resposta existe em toda dupla com ≥3 avaliações — nenhum plano marca
// avalPendente=3 e o enc. 4 nunca tem avaliação pelo corte do i%5.
export const visivelMentor = (i) => i % 3 !== 0;
