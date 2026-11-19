// Respostas enlatadas do "Perguntar à Liza" no modo demo (REALIZA-456): a
// demo não chama o provider nem grava card — a action devolve um card
// sintético com esta resposta por aba, na mesma forma do card real.

import type { AbaLiza } from "@/lib/relatorios/contexto";

export const RESPOSTA_LIZA_DEMO: Record<AbaLiza, string> = {
  visao:
    "A saúde do recorte está estável, com a maior parte das duplas em dia. " +
    "O ponto de atenção é o bloco em risco: são poucas duplas, mas concentram a urgência.\n\n" +
    "**Sugestões:** comece pela fila de risco da aba Aderência e revise as duplas em atenção antes que virem risco.",
  aderencia:
    "A régua do calendário mostra a maior parte das duplas no ritmo esperado. " +
    "O trabalho se concentra em três frentes: duplas atrás do esperado, registros pendentes e os pedidos de apoio em aberto.\n\n" +
    "**Sugestões:** responda primeiro os pedidos de apoio, depois chame as duplas atrás do calendário com o lembrete da própria seção.",
  assinaturas:
    "Há documentos aguardando assinatura, alguns já expirados. " +
    "Pendência longa trava o andamento do vínculo e merece cobrança direta.\n\n" +
    "**Sugestões:** reenvie os links expirados e cobre as pendências mais antigas por pessoa.",
  interacoes:
    "O log mostra o volume de contato da equipe com as duplas no recorte. " +
    "Vale conferir se os tipos mais usados cobrem o acompanhamento esperado.\n\n" +
    "**Sugestões:** cruze a fila de aderência com a última interação de cada dupla para priorizar quem está sem contato recente.",
  solicitacoes:
    "O mural de especialistas tem solicitações em aberto esperando decisão. " +
    "A latência média indica quanto tempo uma demanda espera até a resposta.\n\n" +
    "**Sugestões:** decida as solicitações abertas mais antigas e confira se há especialista disponível para as demandas recorrentes.",
  encerramento:
    "Há ritos de encerramento em aberto, com itens de checklist ainda pendentes. " +
    "O rito mais antigo indica quanto tempo o caso mais atrasado espera.\n\n" +
    "**Sugestões:** feche o checklist dos ritos pendentes, começando pelo mais antigo.",
  formularios:
    "A taxa de resposta mostra quantos links emitidos já voltaram. " +
    "Links pendentes de formulários-chave seguram dados que as outras abas precisam.\n\n" +
    "**Sugestões:** reenvie os links pendentes para os destinatários e confira se algum formulário concentra a espera.",
  adocao:
    "A adoção mostra quem de fato usa o produto na janela e onde o uso concentra. " +
    "Superfícies paradas e papéis sem uso indicam onde o produto não pegou.\n\n" +
    "**Sugestões:** investigue as superfícies paradas com a equipe e veja se a taxa de resposta dos instrumentos segura a jornada.",
};
