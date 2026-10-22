# REALIZA-15 — Cronogramas por turma (entidade + FKs)

- **Jira:** [REALIZA-15](https://kelyng.atlassian.net/browse/REALIZA-15)
- **Tier:** A (implementada)
- **Veredito da auditoria:** **FEITO** — falta só fechar o Jira.
- **Spec de referência:** `docs/planos/spec-realiza-15.md`

## Evidências de implementação

### Schema (migration aplicada)

- `supabase/migrations/0061_cronogramas.sql` — entrega completa da issue:
  - tabela `cronogramas` (`:30` — `turma text not null check (char_length <= 80)`, `status` rascunho/ativo/encerrado, `inicio_em`/`fim_em`/`encontros_esperados`);
  - backfill da T1 e união dos domínios `duplas.ciclo` ∪ `ciclo_eventos.ciclo` (`:55-78`);
  - `ciclo_eventos.cronograma_id` FK + `duplas.cronograma_id` FK nullable;
  - rename `duplas.ciclo` → `duplas.turma` (label texto, `:110`);
  - `sync_formacao_ok` reescrito pra formacao por turma via join em cronogramas (`:133-157`);
  - rollback documentado no rodapé (`:252+`), no padrão das migrations.

### Domínio e tipos

- `src/lib/types.ts:285-297` — tipo `Cronograma` (`turma` ainda é label texto "até a entidade turma chegar na F3" — ponte documentada para REALIZA-47).
- `src/lib/types.ts:304-319` — `CicloEvento` carrega `cronograma_id` (0062).
- `src/lib/ciclo.ts:878-886` — `eventosDoCronograma(eventos, cronogramaId)`: recorte por `cronograma_id`, ordenado por `ordem`; sem cronograma (especialista/histórica) devolve `[]` por desenho.
- `src/lib/ciclo.ts:905-931` — `cronogramaVigente()`: ativo cobrindo hoje → próximo a começar → encerrado mais recente (determinístico).
- `src/lib/ciclo.ts:934-945` — `cronogramasOpcoes()` + `rotuloCronograma()` ("2026/2027 · Calendário oficial") para selects.
- `src/lib/queries.ts:335+` — `getCronogramas()` (ordena por `turma`,`nome`) e `getCicloEventos()` com `React.cache`.

### UI consumindo cronograma (não mais texto solto)

- `src/components/nova-dupla-dialog.tsx:656-680` — select "Cronograma" (só trilha DPP) com `defaultValue = cronogramaVigente()`.
- `src/app/(app)/agenda/page.tsx:74-82` — semana do encontro é do cronograma vigente; a união dos calendários T1+T2 é explicitamente evitada no comentário.
- `src/components/dashboard-coordenacao.tsx` — resumo por cronograma ativo; prop `turmas` derivada de `cronogramas.map(c => c.turma)` em `src/app/(app)/(home)/page.tsx:84`.
- `src/app/(app)/turmas/page.tsx` — lista de cronogramas por status (ativo→rascunho→encerrado), links `/turmas/novo` e `/turmas/[id]`.
- `src/app/api/export/route.ts` — export inclui colunas `turma` e `cronograma` (desambiguação já presente).

### Demo / e2e

- `src/lib/demo/data.ts:2061+` — dois cronogramas no dataset demo (T1 e T2, `:2100`); eventos montados por cronograma (`:365+`, comentário ":406-412" — formação é por turma).
- `scripts/seed-demo-staging.mjs:94-125` — cronograma T2 demo ancorado em datas relativas; `scripts/seed-e2e-staging.mjs:437-459` — cronograma E2E dedicado com eventos clonados.

## Escopo restante (outras issues)

- `cronogramas.turma` continua **texto** — a entidade `turmas` é REALIZA-47 (e o degrau mínimo é REALIZA-167).
- `turma_inscricoes` (pertencimento) e `resumo_links` (slug por turma) não existem — REALIZA-167.
- `/resumo/[slug]` usa slug fixo `RESUMO_SLUG_T2` (`src/app/resumo/[slug]/page.tsx:15-19`) — fora do escopo da 15.

## Ação

Fechar o Jira apontando `0061_cronogramas.sql` + `src/lib/ciclo.ts` como entrega. Nada a replanejar.
