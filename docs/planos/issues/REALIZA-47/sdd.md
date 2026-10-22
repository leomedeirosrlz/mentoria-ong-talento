# REALIZA-47 — sdd.md (software design document)

## Modelo de dados `[NOVO]`

```
programas                turmas                        turma_inscricoes (167)
─────────                ──────                        ───────────────────
id        uuid pk        id          uuid pk            profile_id/mentorado_id
nome      text           programa_id uuid → programas   turma_id  uuid → turmas   [47]
ativo     boolean        rotulo      text unique        papel     text           (167)
created_at               ano         text               — turma texto → turma_id
                         inicio_em   date
                         fim_em      date
                         status      planejada|ativa|encerrada
                         created_at
```

### Decisões de schema

1. **`turmas.rotulo text unique`** — é a ponte: o label texto de hoje vira o identificador humano estável. Regex `partesTurma` (`src/lib/ciclo.ts:1884-1890`) continua parseando `T<n> · <ano>`; rótulos livres são preservados verbatim.
2. **`turmas` × `cronogramas`**: 1:N — uma turma pode ter mais de um cronograma (rascunho antigo + ativo). `cronogramas.turma_id not null` após backfill (todo cronograma hoje tem `turma` non-null — `0061:30`).
3. **`duplas.turma_id`**: nullable — dupla especialista sem turma continua válida (`duplas.cronograma_id` já é nullable pelo mesmo motivo). DPP sem turma é anomalia → flag de auditoria, não constraint.
4. **`profile_papeis.escopo_turma_id`**: nullable como o texto original (`0085` — null = papel global).
5. **`turma_inscricoes.turma_id` / `resumo_links.turma_id`**: `not null` após backfill. Se esta migration rodar antes da 167, a 167 já cria essas tabelas com `turma_id` — documentar no plano da 167.
6. **`programas`**: deliberadamente magro (nome+ativo). Programa único "DPP" hoje; a tabela existe pra ancora das turmas e pro futuro multi-programa, não pra features.
7. **`mentorados_turma`** (view `0076`): recriada com join `duplas.turma_id = turmas.id` — o jovem continua vendo só colegas da própria turma, agora por FK.

### Compatibilidade durante a transição

- Colunas texto ficam até o PR 4. Regra de sync no intervalo: `turma_id` é a fonte; o texto é derivado (select `turmas.rotulo`). Nenhum write novo escreve só texto.
- `getCronogramas`/`getDuplas` projetam `turma:turmas(rotulo)` — o campo `turma` no tipo TS vira `{ rotulo: string } | null` ou string projetada; escolher projeção plana (`turma_rotulo`) pra não quebrar `c.turma.localeCompare` em `cronogramasOpcoes` (`src/lib/ciclo.ts:937`).

## RLS

- `programas`, `turmas`: `select` pra `my_role() is not null` (todo papel logado pode ler metadados de turma — não é dado pessoal); `insert/update/delete` `my_role() = 'coordenacao'`. Sem grant pra `anon` (rotas públicas usam RPCs security definer — padrão da casa).
- `mentorados_turma`: mantém `security definer` atual; só muda a expressão do match.
- Jovem (`0076`) continua sem acesso direto a `turmas` — a view projeta só o necessário (nome do colega, avatar).

## RPCs / functions tocadas

- `sync_formacao_ok` (`0061:133-157`): a função hoje resolve turma via `cronogramas.turma` texto — trocar pra `cronogramas.turma_id`. A verificar assinatura exata no ambiente (pg_get_functiondef).
- `has_papel(papel, escopo_turma)` (`0085`): overload novo aceitando `turma_id`; manter a versão texto até o PR 4 (a verificar a assinatura real da função no banco).
- `aceitar_solicitacao` (`0061:182-221`): copia `d.turma` → `d.turma_id` na dupla especialista criada.

## Pontos de escrita que mudam

| Hoje escreve texto | Passa a escrever |
|---|---|
| `nova-dupla-dialog` → `createDupla` (`turma` derivada do cronograma) | `duplas.turma_id` do cronograma escolhido |
| `criarCronograma`/`atualizarCronograma` (`actions-cronogramas.ts:130,190`) campo `turma` | `turma_id` |
| `scripts/importar-turma2.ts` e `seed-*.mjs` | resolvem turma por rotulo → id |

## Testes de schema (CI/e2e)

- `scripts/check-schema-contract.mjs` pega o drift: regenerar `database.types.ts` no PR 1.
- Assertion SQL no seed-e2e: `turmas` tem ≥2 linhas (T1 demo + T2 demo) e `count(duplas where turma_id is null and trilha='dpp') = 0`.
