---
fonte: plataforma-e-operacao
titulo: "Plataforma e operação: decisões vigentes"
material: plataforma-e-operacao
tipo: operacao
natureza: consolidado
audiencia: [coordenacao, supervisor, mentor_dpp, mentor_especialista]
versao: vigente (decisões de plataforma/operação que atualizam os guias físicos)
origem: consolidado da implementação (src/lib/ciclo.ts,
  src/components/registro-form.tsx, src/components/avaliacao-jovem.tsx,
  src/app/t/[token]/terceiro-publico.tsx, supabase/seed.sql e migrations).
  Texto consolidado e sanitizado em 04/11/2026; prevalece sobre os guias
  publicados quando divergirem.
---

# Plataforma e operação: decisões vigentes

Decisões operacionais e de produto que ainda **não estão refletidas nos guias físicos**. Este documento é a referência do que o assistente deve responder sobre "como funciona na plataforma hoje".

## Plataforma

Todo o programa roda na plataforma de mentoria do Instituto Realiza.vc (**mentoria.realiza.vc**): matching, agenda dos encontros, fichas das duplas, registros, instrumentos e materiais.

- **Nomenclatura da interface**: *Material de apoio* é o acervo do programa (roteiros, modelos, guias e links), no item "Materiais de apoio" do menu (/materiais). *Instrumentos* são as ferramentas metodológicas (PDM, Roda da Vida, Perguntas Eficazes, Feedback Construtivo); os da jornada são formulários respondidos na ficha da dupla. Use sempre esses dois nomes ao orientar.
- Acesso é por **magic link** enviado ao e-mail cadastrado pela coordenação; não existe cadastro aberto. A aba que pede o link recebe a sessão por um handoff seguro (funciona mesmo quando o link é aberto em outro navegador).
- **Não confundir:** mentoria.realiza.vc (a mentoria) × ead.realiza.vc (cursos EaD opcionais e gratuitos).

## Instrumentos oficiais na plataforma

Os instrumentos vigentes do programa são todos nativos e respondidos na plataforma, na ficha da dupla ou por link próprio.

- **Na ficha da dupla:** Construindo a sua Visão, Definindo Minhas Metas, PDM (Plano de Desenvolvimento do Mentorado) e Roda da Vida, na aba Instrumentos.
- **Intakes:** intake do mentor e intake do mentorado, respondidos na entrada do programa. O intake do mentorado é o canal que levanta o perfil do(a) jovem.
- **Avaliação por terceiros:** link público por pessoa indicada, gerado na ficha da dupla.
- **Registro pós-encontro do(a) mentor(a):** na ficha da dupla, após cada encontro.
- **Avaliação rápida do(a) jovem:** respondida pelo link ou pela página do(a) jovem após cada encontro.
- **Avaliação Geral - 360º:** par de formulários (um para o(a) mentor(a), um para o(a) jovem, com perguntas distintas por lado) no 16º encontro. Existe só na trilha DPP.

## Registro do(a) mentor(a) após cada encontro

O(a) mentor(a) registra cada encontro na ficha da dupla, em três etapas: **Como foi**, **Sinais de atenção** e **Combinados**. Os guias chamam isso de "avaliação da sessão"; na prática é o registro de acompanhamento.

- **Como foi:** combinados pendentes da vez anterior, para marcar como feitos; o que foi realizado no encontro (conversa de acompanhamento, orientação individual, atividade prática, desenvolvimento de competência, acompanhamento de atividade/tarefa, identificação de dificuldades, orientação profissional ou outro); tema trabalhado; instrumento utilizado (PDM, Roda da Vida, Perguntas Eficazes, Feedback Construtivo, Escuta Ativa, Modelo SMART ou nenhum específico); duração do encontro (30 min a 2h); principais reflexões; e o desempenho e a participação do(a) mentorado(a) (Excelente, Boa, Regular ou Baixa).
- **Sinais de atenção:** dificuldade que precisa de atenção (não; sim, de aprendizagem; de participação; comportamental; de organização/rotina; ou outro, com detalhe) e a marcação "Preciso de apoio", que sinaliza a coordenação quando a situação extrapola o papel do(a) mentor(a).
- **Combinados:** próximo passo do acompanhamento (continuar normalmente, reforçar o conteúdo/atividade, realizar novo feedback, fazer um acompanhamento mais próximo, conversar individualmente com o(a) mentorado(a) ou outro); novos combinados, cada um com descrição, responsável (mentor ou mentorado) e prazo; observações do(a) mentor(a); e evidências opcionais (foto do encontro, print ou atividade feita, em PDF ou imagem de até 10 MB).

O registro não é lido pelo(a) jovem: só o(a) mentor(a) e a equipe do programa têm acesso. Na trilha de especialista, o Mentor DPP do(a) jovem também lê o registro integral.

## Avaliação rápida do(a) jovem

Após cada encontro realizado, o(a) jovem responde a própria avaliação rápida, pelo link que recebe (sem login) ou pela página dele(a) na plataforma.

- **Nota:** de 1 a 5 estrelas.
- **Sentimento:** "Como você se sentiu no encontro?" (Muito bem, Bem, Mais ou menos, Desconfortável ou Mal).
- **Avanço:** "Você sente que avançou no que combinou?" (Sim, avancei; Um pouco; Ainda não).
- **Temas:** "Sobre o que vocês conversaram?" (projeto de vida (PDM), escola e estudos, carreira e futuro, família, amizades e relacionamentos, saúde e bem-estar, dinheiro, tempo livre e hobbies ou outro assunto).
- **Comentário** livre e a opção **"preciso de ajuda"**, que vira um pedido de apoio atendido pela coordenação (o(a) mentor(a) pode ser o motivo do pedido, por isso a resposta não passa por ele).

A visibilidade é por papel: coordenação e supervisor leem cada resposta; o(a) mentor(a) DPP vê só a média das avaliações (aberta em lotes de 3, para nenhuma ficar identificável) e a resposta inteira quando o(a) jovem libera a leitura; o(a) especialista vê apenas as estrelas de cada encontro que conduziu.

## Avaliação por terceiros

O(a) jovem indica ao(à) mentor(a) pelo menos três pessoas que o(a) conhecem bem, até nove no total (o guia sugere misturar amigos, familiares e, se estiver trabalhando, colegas de trabalho). O(a) mentor(a) cadastra essas pessoas na ficha da dupla, gera e envia o link de cada uma; o consolidado publicado aparece para o(a) jovem na área dele(a).

- As pessoas indicadas respondem pelo link na plataforma, sem login. São **duas perguntas abertas**: quais são os pontos fortes do(a) jovem e o que ele(a) poderia melhorar.
- O(a) mentor(a) lê as respostas identificadas, consolida removendo o que identifica quem respondeu e publica a síntese anônima, que o(a) jovem lê na própria home. Em nenhum momento se indica quem disse o quê.
- A devolutiva acontece no 2º encontro, com a comparação entre o consolidado e a autoavaliação do(a) jovem.
- O modelo "Mensagem às pessoas indicadas" segue em /materiais para o contato direto, no envio do link.

## Agenda, acompanhamento e situação da dupla

O agendamento é sempre da dupla, pela plataforma: nenhum encontro acontece "por fora". O(a) mentor(a) agenda e edita dentro da ficha da dupla; a coordenação monitora e chama quando algo atrasa, mas não agenda no lugar.

- **Reposição na mesma semana:** encontro que não acontece no dia previsto deve ser reposto na mesma semana. A regra é combinada com as duplas no 1º encontro.
- **Situação da dupla:** a plataforma compara os encontros esperados pelo calendário do ciclo com os realizados e sinaliza cada dupla. Pedido de apoio, avaliação baixa com dificuldade identificada ou dois encontros atrasados viram prioridade da coordenação.

## Fechamento do ciclo

No 16º encontro, cada participante responde a sua Avaliação Geral - 360º na plataforma: o(a) jovem avalia a mentoria e o(a) mentor(a) avalia o programa e a própria experiência, incluindo a disponibilidade para o próximo ciclo. Os registros de cada encontro alimentam o acompanhamento da coordenação e a Avaliação Geral - 360º do encerramento. O par existe só na trilha DPP; a trilha do especialista não tem formulário final.

## Duas turmas no mesmo ciclo

A Turma 2 (programa Gov.BR) começou em 06/10/2026 com cronograma próprio: encontros às terças, três semanas de encontro duplo na quinta e encerramento junto da Turma 1. Cada dupla carrega a turma dela e a plataforma calcula situação e agenda pelo cronograma correspondente (ver "Cronograma: Turma 2").

## Especialista na plataforma

O Mentor DPP (ou o próprio jovem) sinaliza a demanda específica e a coordenação/plataforma conecta o especialista da área correspondente. A trilha é sob demanda, com **no máximo 5 encontros** de 1 hora em até 3 meses: a quantidade é estimada no 1º encontro e acompanhada pela plataforma. O pós-encontro é o mesmo da trilha DPP (registro do(a) mentor(a) na ficha e avaliação rápida do(a) jovem) e o(a) jovem pode responder só com estrelas, preservando o que escreveu.

## Papéis na plataforma

| Papel | O que vê/faz |
|---|---|
| Coordenação | Tudo: duplas, situação das duplas, agenda, materiais, formulários, relatórios, chamados |
| Supervisor (e auxiliar com escopo) | As duplas supervisionadas: fichas, registros, instrumentos; recebe os chamados/pedidos de apoio do recorte |
| Mentor DPP | A própria dupla: agenda e marca encontros, preenche registros pós-encontro, instrumentos (PDM, Roda da Vida), materiais da jornada |
| Mentor Especialista | A própria dupla designada: agenda e registros dos seus encontros |
| Jovem (mentorado) | Área própria (/jovem): seus encontros, instrumentos e materiais |

## Onde o material publicado difere da operação vigente

Os guias e cronogramas publicados ainda descrevem a operação anterior; vale o que está neste documento e na plataforma.

- **PDM e Roda da Vida:** o guia publicado diz que ficam com a dupla, fora da plataforma; valem os instrumentos na ficha da dupla.
- **Checklist de competências do mentor:** segue como material de leitura e marcação em /materiais, não como formulário respondido.

## Escopo do assistente

- O assistente **consulta dados** pelas ferramentas registradas (situação do programa, duplas, agenda, registros, materiais, guias); nunca escreve, agenda ou altera nada.
- O assistente **não persiste conversa**; o histórico fica só na sessão do usuário na tela.
- Respostas sobre metodologia citam os guias; respostas sobre dados citam a fonte (tool) usada.
