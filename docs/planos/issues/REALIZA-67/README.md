# REALIZA-67 — DECISÃO: devolução do mentor sobre atividade entregue entra no MVP do editor?

- **Jira:** [REALIZA-67](https://kelyng.atlassian.net/browse/REALIZA-67) (Tarefa, prioridade **Low**; migrada do Linear REALIZA-34)
- **Tier:** C — decisão (`decisao.md`)
- **Veredito de status:** **ABERTO.** A feature-mãe (editor de PDF, REALIZA-55) ainda não existe — depende da REALIZA-20 (chassis do link multi-sessão — o plano dela evolui `formulario_links`/`formulario_respostas`, não cria `atividade_links`), também não implementada. O plano `docs/planos/editor-pdf.md` já desenhou a resposta candidata: `atividades.status` já prevê `'devolvida'` no enum (`editor-pdf.md:112`), o passo 6 do fluxo é "devolver pra ajuste" (`:173`), e a pergunta 1 das "Perguntas abertas" é exatamente esta (`:236` — recomenda fase 1.5 rápida, não cortar o conceito).

## Escopo (o que a decisão precisa cobrir)

- Se "devolução" entra no MVP e em qual sabor: (a) reabrir pra ajuste — link volta a servir edição com o rascunho intacto; (b) devolver com comentário/motivo estruturado (banner no link — fase 2 do plano); (c) mentor devolve **PDF anotado** (co-edição — visão do plano, não-comprometida).
- Ciclo de estados do `atividade_links`/`atividades`: `pendente → em_edicao → entregue → devolvida → entregue…` vs. `entregue` terminal no MVP.
- Aviso ao jovem: por dentro (plataforma) ou por fora (WhatsApp do mentor — coerente com "a dupla agenda; a plataforma monitora").
- Sem devolução, o caminho do "ficou ruim" é WhatsApp + **nova atividade** (re-upload do PDF, link novo, rascunho zerado — o jovem refaz do zero).

## Dependências / bloqueios

- **Depende de:** REALIZA-55 (editor) e REALIZA-20 (chassis do link tokenizado) — a decisão só vira código quando elas andarem; registrar agora pra congelar o ciclo de estados do schema.
- Responde à pergunta aberta nº 1 de `docs/planos/editor-pdf.md` §9.
- **Convergente com a 20:** o plano dela já desenha "devolver pra correção" (`devolvida` + `devolvido_motivo`) no chassis de instrumentos e marca um BLOCKER com a mesma pergunta — esta decisão responde o mesmo "sim, reabre a mesma resposta" pro editor.

## Esforço estimado

- **PP** — a decisão em si.
- Marginal no MVP: **+~1–2 dias** sobre a 55 (RPC `devolver_atividade` já esboçada em `editor-pdf.md:147`, valor do enum já existe, botão na ficha + banner no link + chip de status).

## Riscos

- Cortar devolução do MVP deixa um valor morto no enum `'devolvida'` e o fluxo num beco: entrega ruim vira conversa morta por fora + custo de re-criar atividade (o rascunho — o grande ativo do link multi-sessão — se perde).
- Incluir devolução "completa" demais (PDF anotado pelo mentor) infla o MVP: exige superfície de edição pro mentor (co-edição) ou upload de devolução — é outro produto, fase 2.
