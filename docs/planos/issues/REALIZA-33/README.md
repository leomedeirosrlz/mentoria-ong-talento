# REALIZA-33 — Revisão LGPD estrutural: inventário de dados sensíveis + visibilidade + retenção

- **Jira:** [REALIZA-33](https://kelyng.atlassian.net/browse/REALIZA-33) (Tarefa, prioridade **High**; migrada do Linear REALIZA-51)
- **Tier:** C — decisão/escopo (`decisao.md`)
- **Veredito de status:** **ABERTO.** Não existe inventário formal nem revisão documentada. A base técnica de proteção já é forte (grants por coluna, views coord-only, RLS por papel, scrub Sentry), mas três buracos concretos existem hoje: a autorização do responsável é **rascunho sem fonte oficial** (`src/lib/documentos/texto.ts:100-103`), a Roda da Vida coleta dado Art. 11 sem base legal explícita (`0080_instrumentos_dupla.sql:639-660`), e não há **nenhum** mecanismo de retenção/anonimização pós-ciclo.

## Escopo (o que a decisão precisa cobrir)

- Inventário de dados sensíveis por tabela — **draft já entregue em `decisao.md`** (tabela completa por tabela/coluna, classificação Art. 11, quem lê, retenção atual).
- Visibilidade por papel: a regra já está **implementada e decidida** (coord vê tudo — decisão 03/out em `_contexto.md:111`; `dados_civis`/`*_pessoal` coord-only; `instrumentos_da_dupla` expõe respostas a coord+mentor+supervisor+mentorado da dupla). Resta **registrar** e revisar 2 arestas (`mentorados.notas` legível pelo mentor; `avatares` bucket público com foto de menor).
- Base legal + consentimento: o termo `autorizacao-responsavel` (única base legal do menor) é rascunho interno; cláusula 2.1 cobre "finalidades do programa" genericamente — decidir se revisa o texto para cobrir dados sensíveis, imagem e terceiros.
- Retenção/anonimização pós-ciclo: hoje **zero** — saída vira `situacao`/`saiu_em` (`0077`), delete só via cascata coord. Decidir política escrita + se implementa anonimização automática.
- Terceiros não-titulares: `terceiros_contatos` guarda nome+WhatsApp de amigos/familiares do jovem que **nunca consentiram** (`0103`) — precisa de posição.
- Parecer jurídico como gate para processamento novo: IA sobre texto livre de menores (REALIZA-178/179/180) já está condicionada a isso no `docs/planos/README.md:76` (decisão 6 da ata).
- Subprocessadores e `/privacidade`: página existe (`src/app/privacidade/page.tsx`) mas não lista operadores (Supabase/Resend/Vercel/Sentry) nem prazos de retenção concretos.

## Dependências / bloqueios

- Nenhuma dependência técnica — é trabalho de decisão + documento.
- **Alimenta:** REALIZA-178/179/180 (IA) — a ata já marcou "IA sobre texto livre de menores" como pendente de parecer jurídico.
- Relacionada: REALIZA-55/20 (editor/atividades criam mais um corpus de dados do menor — convém entrar já coberto pela revisão).

## Esforço estimado

- **P** — inventário + decisões registradas + revisão do texto da autorização (escopo B da `decisao.md`).
- **M** — se incluir implementação de retenção/anonimização automática (escopo C).

## Riscos

- **Dados Art. 11 já em produção sem base legal específica** (espiritualidade/saúde da Roda da Vida; cor/raça no matching) — quanto mais demora, maior o passivo.
- Termo do responsável é rascunho não-revisado — se questionado por responsável/ONG parceira, não há lastro.
- Terceiros (amigos/família) armazenados sem nenhum consentimento — mitigação possível barata (aviso no convite + exclusão a pedido).
- Sem retenção: dados de desistentes ficam pra sempre; crescimento contínuo do passivo por ciclo.

> DECIDIDO (Thiago): escopo B aprovado; ele revisa cláusulas com o jurídico.
