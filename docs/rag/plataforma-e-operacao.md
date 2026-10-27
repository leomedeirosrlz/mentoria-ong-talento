---
fonte: plataforma-e-operacao
titulo: Plataforma e operação — decisões vigentes
tipo: operacao
audiencia: [coordenacao, supervisor, mentor_dpp, mentor_especialista]
versao: vigente — decisões de plataforma/operação que atualizam os guias físicos
origem: consolidado da implementação (supabase/seed.sql, src/lib) — prevalece
  sobre os guias quando divergir.
---

# Plataforma e operação — decisões vigentes

Decisões operacionais e de produto que ainda **não estão refletidas nos guias físicos**. Este documento é a referência do que o assistente deve responder sobre "como funciona na plataforma hoje".

## Plataforma

- Todo o programa roda na plataforma de mentoria (**mentoria.realiza.vc**, criada em parceria com a Top2You): matching, agenda dos encontros, fichas das duplas, registros, instrumentos e materiais.
- Acesso é por **magic link** enviado ao e-mail cadastrado pela coordenação — não existe cadastro aberto. A aba que pede o link recebe a sessão por um handoff seguro (funciona mesmo quando o link é aberto em outro navegador).
- **Não confundir:** mentoria.realiza.vc (a mentoria) × ead.realiza.vc (cursos EaD opcionais e gratuitos).

## O que mudou em relação aos guias

- **PDM e Roda da Vida viraram instrumentos nativos da plataforma** — preenchidos e acompanhados na **ficha da dupla** (aba Instrumentos), não mais documentos soltos "guardados pela dupla". O guia ainda diz que o PDM fica com a dupla: a decisão vigente é registrá-lo na plataforma, o que permite à coordenação acompanhar o progresso.
- **A avaliação pós-encontro é o registro semanal na plataforma** — após cada encontro, o(a) mentor(a) preenche na ficha da dupla: o que foi trabalhado (tema e instrumento do guia para aquele encontro), como foi a sessão (avaliação 1–5), dificuldades identificadas e o próximo passo combinado. Os guias chamam isso de "avaliação da sessão"; na prática é o registro de acompanhamento.
- **Os roteiros dos 16 encontros existem como materiais nativos** — cada semana tem um roteiro em PDF na aba Jornada de /materiais (Semana 1 a 16), além dos templates (PDM, Roda da Vida, Construindo a sua Visão, mensagens-modelo) e da Biblioteca (Perguntas Eficazes, Feedback Construtivo, guias completos).
- **A Avaliação Geral 360º é formulário nativo, não arquivo** — o par "Avaliação Geral de Mentores — 360º" e "Avaliação Geral de Mentorados — 360º" vive no sistema de formulários (links com token), aparece na estação do 16º encontro da jornada e em /materiais via "Ver formulário". Só existe na trilha DPP — a do especialista é só a avaliação por sessão.
- **A autoavaliação do mentor saiu do programa** — o checklist de competências e a anamnese social foram removidos (decisão vigente, migration 0128/REALIZA-236). O guia físico anterior ainda cita "Autoavaliação do mentor" no 16º encontro: não orientar o(a) mentor(a) a preenchê-lo.
- **A avaliação por terceiros é consolidada fora da plataforma** — o(a) mentor(a) coleta as respostas (mensagem-modelo em /materiais) e consolida por conta própria antes do 2º encontro; a plataforma não recebe nem armazena esses dados, por envolverem dados confidenciais de terceiros.
- **Avaliação pós-mentoria fica de fora por ora** — a ideia de medir impacto meses depois do encerramento existe, mas não virou instrumento do programa ainda; o assistente não deve sugeri-la.
- **Agendamento pela dupla, sempre pela plataforma** — nenhum encontro acontece "por fora". O(a) mentor(a) agenda/editar dentro da ficha da dupla; a coordenação monitora e faz o nudge quando algo atrasa, mas não agenda no lugar.
- **Semáforo de acompanhamento** — a plataforma compara encontros esperados (pelo calendário do ciclo) com os realizados e sinaliza as duplas: pedido de apoio, avaliação baixa com dificuldade ou dois encontros atrasados viram prioridade da coordenação.
- **Reposição na mesma semana** — encontro que não acontece no dia previsto deve ser reposto na mesma semana; essa regra é combinada com as duplas no 1º encontro (ver "Cronograma — Ciclo 2026/2027").
- **Ciclo comprimido** — o guia desenha 6 meses; o ciclo atual faz os 16 encontros em ~4 meses mantendo as 6 fases e os instrumentos.
- **Especialista acionado pela plataforma** — o Mentor DPP (ou o próprio jovem) sinaliza a demanda específica e a coordenação/plataforma conecta o especialista da área correspondente.

## Papéis na plataforma

| Papel | O que vê/faz |
|---|---|
| Coordenação | Tudo: duplas, saúde do programa (semáforo), agenda, materiais, formulários, relatórios, chamados |
| Supervisor (e auxiliar com escopo) | As duplas supervisionadas: fichas, registros, instrumentos; recebe os chamados/pedidos de apoio do recorte |
| Mentor DPP | A própria dupla: agenda e marca encontros, preenche registros pós-encontro, instrumentos (PDM, Roda da Vida), materiais da jornada |
| Mentor Especialista | A própria dupla designada: agenda e registros dos seus encontros |
| Jovem (mentorado) | Shell próprio (/jovem): seus encontros, instrumentos e materiais |

## Escopo do assistente

- O assistente **consulta dados** pelas ferramentas registradas (saúde do programa, duplas, agenda, registros, materiais, guias) — nunca escreve, agenda ou altera nada.
- O assistente **não persiste conversa** — o histórico fica só na sessão do usuário na tela.
- Respostas sobre metodologia citam os guias; respostas sobre dados citam a fonte (tool) usada.
