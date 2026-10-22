# REALIZA-30 — Calendário do ciclo parametrizável (eventos do cronograma)

- **Jira:** [REALIZA-30](https://kelyng.atlassian.net/browse/REALIZA-30)
- **Tier:** A (implementada)
- **Veredito da auditoria:** **FEITO** — falta só fechar o Jira.
- **Spec de referência:** `docs/planos/spec-realiza-30.md`

## Evidências de implementação

### Schema (migration aplicada)

- `supabase/migrations/0062_eventos_cronograma.sql` — `ciclo_eventos` deixa de ser "só data":
  - `tipo`: `etapa_preparacao` | `encontro` | `recesso` | `evento_encerramento` | `formacao`;
  - `ordem` — chave canônica da sequência do PDF (não a data);
  - `status`: `pendente` | `concluida` (semântica só em `etapa_preparacao`);
  - `data` nullable com CHECK — só `etapa_preparacao` concluída pode ficar sem dia;
  - `data_fim` (períodos: preparação/recesso), `observacao`, `fase`, `instrumentos`.

### Domínio puro

- `src/lib/types.ts:304-319` — `CicloEvento` com `ordem`/`status`/`observacao` e o contrato do CHECK documentado.
- `src/lib/gerador-cronograma.ts` — módulo puro do gerador:
  - `EventoRascunho` (`:17-38`), `TIPO_EVENTO_LABEL` (`:40-46`), `FASES_DPP` (`:48+`);
  - `gerarEventos()` materializa o calendário a partir de parâmetros (1º encontro, cadência, exceções, recesso) + fonte de conteúdo (guia DPP verbatim, cópia de cronograma, em branco);
  - `validaEventos()` espelha os CHECKs da 0062 antes de gravar; `totaisCronograma()` alimenta `encontros_esperados`.
- `src/lib/ciclo.ts:897-899` — `encontroDatado()` guarda o denominador do ciclo (só `tipo='encontro'` com data); `:948-953` `encontroEsperado` alimenta o semáforo.

### UI / actions

- `src/components/cronograma-builder.tsx` — wizard de `/turmas/novo` em 2 passos (parâmetros → prévia materializada editável; header do arquivo `:1-7`).
- `src/components/evento-cronograma-dialog.tsx` — edição pontual de evento.
- `src/lib/actions-cronogramas.ts` — `criarCronograma` (`:130`), `salvarEventoCronograma` (`:292`), `moverEvento` (`:363`), `excluirEvento` (`:392`) — todas `{error}`/`{ok}`.

### Demo / e2e

- `src/lib/demo/data.ts:362-484` — `buildCicloEventos()` monta preparação → 16 encontros → recesso → encerramento para T1 e T2, incluindo etapas concluídas sem data (ONG parceira) e formação por turma.
- `scripts/seed-e2e-staging.mjs:437-459` — clona o esqueleto de eventos pro cronograma E2E.

## Escopo restante (outras issues)

- Variação de dia da semana por encontro existe via `data` livre por evento; a edição em massa segue manual (builder passo 2).
- `turma` da 0062 ainda é label texto herdado da 0061 — entidade `turmas` é REALIZA-47.

## Ação

Fechar o Jira apontando `0062_eventos_cronograma.sql` + `src/lib/gerador-cronograma.ts` como entrega.
