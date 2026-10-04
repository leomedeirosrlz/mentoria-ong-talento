# Execução — contrato de autonomia

Regras pra qualquer execução (Devin, outro agente, ou humano) que pega uma issue `REALIZA-*` no Jira (`kelyng.atlassian.net`, projeto REALIZA).

## Como pegar trabalho

1. Fila: Jira → projeto **REALIZA** → status **Tarefas pendentes**. Ordem: issues *sem* a label `backlog` primeiro (eram o Todo do Linear); dentro delas, labels de milestone (`turma-2-operando` → `agenda-nova-mentor` → `instrumentos-nativos`).
2. Antes de começar: ler a issue, o doc-fonte citado na descrição e `AGENTS.md`. Cada issue tem `parent` = epic do módulo e footer com a origem no Linear.
3. Issue grande demais pra uma sessão: quebrar em **Subtasks** no Jira **antes** de codar — não entregar PR gigante.
4. Marcar a issue **Em andamento** ao começar; nunca trabalhar em duas ao mesmo tempo.

## Autonomia

**Pode executar autônomo** (revisão acontece no report, não antes):

- UI, componentes, copy pt-BR
- Queries de leitura novas (seguindo `queries.ts` + `React.cache`)
- Actions novas (seguindo `actions.ts` — retornam `{error}`/`{ok}`, nunca lançam)
- Demo mode — **toda feature funciona no `/demo`** (paridade obrigatória)
- Testes vitest de funções puras

**Gate humano obrigatório** — parar e pedir aprovação *antes* de aplicar:

- Migrations que tocam **RLS**, guards (`0043` etc.) ou dados de menores
- Rotas públicas tokenizadas (`/f/[token]`, `/assinar/[token]`, futuras atividades)
- Deletes/updates em massa — o banco remoto tem dados reais
- Novas integrações com credenciais (Resend, Gemini, WhatsApp)
- Mudança de comportamento em auth/magic link
- Qualquer coisa fora da descrição da issue (descobertas viram comentário na issue, não código extra)

**Ambiguidade:** parar e comentar na issue (Jira `addCommentToJiraIssue`) — nunca escolher por conta própria. SLC: errado < incompleto < inventado.

## Done quando

1. O que a descrição pede está entregue
2. `npx tsc --noEmit` limpo, `npx eslint src/` limpo, `pnpm test` verde
3. Funciona no `/demo` (se aplicável)
4. Comentário na issue: o que mudou + como verificar + screenshots se UI
5. Estado da issue → **Em análise** (revisão de negócio). Se houver coluna **Code Review**, ela vem antes — revisão de código.

## Convenções

- Branch: `thiago/realiza-N-slug` (mesma convenção de antes)
- Commits citam `REALIZA-N`
- Nunca commitar secrets — keys moram em `.env.local` e Vercel env
- Banco remoto tem **dados reais** — não re-seedar, não resetar

## Integrações ativas

| Serviço | Estado | Onde |
|---|---|---|
| Supabase | remoto, ref `yhjzmxleotahijinjepl` | `.env.local` + MCP `supabase` |
| Resend | ativo, sender `no-reply@realiza.vc` | `.env.local` |
| Jira | MCP `jira`, site `kelyng.atlassian.net`, projeto **REALIZA** — backlog canônico | `~/.config/devin/mcp_config.json` |
| Linear | MCP `linear` — **legado**, só leitura p/ referência | `~/.config/devin/mcp_config.json` |
| Google Workspace | MCP `gworkspace`, **read-only**, `thiago@realiza.vc` | user-level config |
| Gemini API | **pendente** — precisa de key antes de REA-45 | — |
| WhatsApp | só deep link `wa.me` por ora; Cloud API é backlog | — |
