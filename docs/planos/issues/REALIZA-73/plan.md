# REALIZA-73 — plan.md (executável sem reler o Jira)

## Premissas verificadas

- Home coord: `src/app/(app)/(home)/page.tsx:34-84` — carrega `me,eventos,cronogramas,...`, passa `cronogramas` e `turmas` (labels derivadas) pro `DashboardCoordenacao`. `searchParams` hoje só tem `filtro` (`:32`).
- Cookies demo: `demo_role` + `demo_onboarded` (`src/lib/demo/mode.ts`) — `demo_role` continua sendo o primeiro cookie lido; `turma_foco` é independente e vale na demo também (demo tem T1+T2 — `demo/data.ts`).
- `/duplas` lê chips de turma por `d.turma` (lista já carregada); `/agenda` deriva `cronogramaVigente` (`agenda/page.tsx:78`); `/registros` usa `parseFiltros(searchParams)` (`registros/page.tsx:102`); `/pessoas` sem params (39 adiciona).
- Middleware: rotas protegidas passam por `src/lib/supabase/middleware.ts:49-84` — cookies acessíveis em Server Components via `cookies()`.

## Modelo do contexto

`src/lib/turma-contexto.ts` `[NOVO]` (puro + server helpers):

```ts
resolveTurmaFoco(searchParams.turma, cookieStore, turmas) → TurmaFoco
// "todas" | turma válida; ?turma= inválida → "todas" (falha fechada, não erro)
// precedência: param > cookie > "todas"; param != cookie → reescreve cookie
```

- Valor do cookie/param: **label `turma` hoje** (`"T1 · 2026/2027"`); pós-47 pode virar `turma_id` — `resolveTurmaFoco` aceita os dois (match por id ou rotulo) pra transição sem quebrar links.
- `?turma=todas` limpa o cookie.

## Passos por superfície (ordem)

1. **Lib + seletor** `[NOVO]` `src/components/turma-contexto-select.tsx` — `Select` Base UI: "Todas as turmas" + uma por turma; onChange → `router.replace('?turma=…')` + `document.cookie` (ou mini route handler/action pra cookie httpOnly — cookie client-side `path=/` basta; **a verificar** convenção: `demo_onboarded` é set client-side? replicar o mesmo mecanismo).
   - Montagem: dentro do header de cada página alvo quando `me.role==='coordenacao' && turmas.length>1`. Pode começar só na home e `/duplas`; demais no mesmo PR se simples.
2. **Home (hub)** — `dashboard-coordenacao.tsx`: quando >1 turma, topo vira hub: card por turma `[NOVO TurmaHubCard]` (rotulo via `partesTurma`, nº duplas ativas, status do cronograma vigente daquela turma, semáforo resumido) — clicar navega `?turma=<rotulo>`. Com contexto fixo, o dashboard mostra só aquele recorte (os resumos por cronograma já existem — filtrar por `cronogramas.filter(c => c.turma===foco)` antes de derivar).
3. **Agenda** — `agenda/page.tsx`: `searchParams` ganha `turma`; o "vigente" (`:78`) vira `cronogramaVigente(cronogramas.filter(doFoco))`; o seletor de cronograma interno já existe (a verificar componente — agenda já permite trocar cronograma? se sim, contexto só pré-seleciona; se não, contexto filtra).
4. **Duplas** — `duplas-lista.tsx`: prop `turmaInicial` → `useState(turmaSel)` inicializado do contexto (`:857`). Chips continuam (contexto é estado inicial, chips refinam).
5. **Registros** — `registros/page.tsx`: `parseFiltros` ganha `turma` (`:102`) → `getRegistros` filtra por `dupla.turma`; seletor no `registros-filtros` (a verificar componente) quando >1 turma.
6. **Pessoas** — consome via REALIZA-39 (`turmaInicial` prop já prevista no plano da 39); 73 só passa o valor.
7. **Relatórios/export** — `/api/export` ganha `?turma=` opcional (coluna já existe; filtro novo); `relatorios/page.tsx` passa contexto pro builder (a verificar componente `relatorio-builder.tsx`).

## Sequência de PRs

1. `turma-contexto.ts` + `TurmaContextoSelect` + home hub + `/duplas` inicial (PR único vertical — prova o mecanismo).
2. Agenda + registros.
3. Pessoas (após 39) + export/relatorios.

## Demo / e2e

- Demo já tem T1+T2: persona coord → home mostra hub; clicar T2 filtra dashboard; cookie persiste ao navegar `/demo`→`/agenda`.
- `demo_role` continua lido primeiro (ordem de cookies não muda); `turma_foco` é set/limpo igual aos cookies demo (a verificar se cookies demo são httpOnly ou client — replicar).
- e2e demo spec novo: contexto via URL vs cookie (precedência), "Todas" restaura, ausência com 1 turma.

## Rollback

- Esconder o seletor + ignorar `?turma=`/`turma_foco` — zero schema; cada página volta ao default atual.

## Riscos

- Contexto "invisível" (usuário esquece que filtrou): mitigar mostrando o rótulo da turma no `PageHeader`/faixa quando foco ativo.
- Cookie e URL divergindo em tabs — URL sempre vence; cookie é só conveniência de retorno.
