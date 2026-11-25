# Audit-fixes — batch dos 8 achados da auditoria

Issue: `bug`, `audit`. Fonte: `_contexto.md` § audit-fixes (8 achados; o `_audit-findings.md` referenciado não consta no repo — os achados aqui seguem a lista do contexto). Implementação em voo: branch `thiago/audit-fixes` — **mudanças ainda não commitadas** (working tree sobre `origin/staging`). Status: em implementação.

## O que exige vs. o que existe

Batch de correções de auditoria — cada achado vira uma seção abaixo com o antes/depois verificado no diff do worktree.

### 1. `painelTurmaCtx` contava "hoje" em UTC

`jornada.ts:871` usava `agora.toISOString().slice(0,10)` — dia civil **UTC**. Entre 21h e 23:59 BRT o "hoje" UTC já é amanhã: o painel de jornada contava o encontro do dia seguinte um dia antes (liberação precoce da estação/janela). Fix: `toDateStr(agora)` — dia civil em `America/Sao_Paulo` (mesmo helper do resto de `ciclo.ts`).

### 2. `gerarLinksFormulario` — N round-trips + estado parcial desonesto

Duas falhas no lote (`forms/actions.ts`): (a) `duplaDoDestino` rodava **uma query por destinatário** — lote de 200 virava 200 round-trips sequenciais; (b) o insert era um por destinatário — falhar no meio deixava links válidos mintados "por baixo" de um `{ error }`. Fix: `duplasDosDestinos` (duas queries `.in` por âncora — mentor_id/mentorado_id — `created_at desc` + primeiro por pessoa replica o `.limit(1)` da unitária) e **um INSERT único** pro lote: atômico, ou entra tudo ou nada — `criados = novos.length` é sempre verdade.

### 3. `finalizarPromocaoIntake` — avatar órfão no rollback

A cópia foto→avatar rodava **antes** do carimbo único (`promovido_*_id`). Perdedor da corrida (ou `markErr`) deletava a pessoa recém-criada — o objeto `<pessoaId>/<uuid>.<ext>` ficava órfão no bucket `avatares`. E no `avErr` do update de `avatar_path` o objeto recém-subido também virava lixo. Fix: carimbo **antes** da cópia (quem perde desfaz a pessoa sem ter subido nada) + `storage.from("avatares").remove([destino])` quando o update da row falha.

### 4. `salvarRegistro` — falha pós-save virava `{ error }` sobre estado parcial

O registro e o status do encontro já estavam gravados quando a reconciliação de combinados (update/insert/delete em `encaminhamentos`) rodava — um erro ali retornava `{ error }` como se "o registro falhou". Fix: reconcile roda com `Promise.all` e qualquer falha vira `aviso` no `{ ok: true }` ("O registro foi salvo, mas nem todos os combinados entraram. Confira a lista de combinados.") — mesmo padrão do bloco `concluir` (que migrou pra `aviso ??=`, a primeira falha é a do toast). O caller já mostra `toast.warning` com a description (`registro-form.tsx:556`).

### 5. Demo — supervisor sem o grant de turma da 0125

As queries demo replicavam só `duplas.supervisor_id = eu` — a RPC `supervisiona_dupla` (0125) concede também por `profile_papeis` com `papel='supervisor'` + `escopo_supervisao='turma'` + `escopo_turma` casando a turma da dupla (ou a do cronograma dela). Fix: `supervisionaDuplaDemo` (espelho da RPC, em `demo/data.ts` — mora ali e não em queries.ts pra não fechar ciclo de import com forms-data/pdm-data), tipo `ProfilePapel` ganha `escopo_supervisao`, dataset ganha o grant do Paulo em T2 (a `d-t2a` entra pelo grant — exercita o caminho escopado fora do direto). Todos os consumidores migrados: `duplasDoPapel` (inclusive `mentor_id=me`, ramo da policy que faltava), `jovemProfileVisivel`, `demoContatosMap`, `demoMinhasDuplas`, `demoTrilhasDosJovens`, `presencaVisivel`, `encerramento-data.noEscopo`, `forms-data.demoPainelInstrumentosJornada`/`demoInstrumentosDaDupla`, `pdm-data.demoPdmDaDupla`.

### 6. Limpeza de anexo órfão sem checar erro

`enviarAnexo` (`anexos-registro.tsx`) e `subirAnexoFormulario` (`forms/actions.ts`) deletavam a row de metadados após upload falho **sem checar o delete** — falha dupla deixava row órfã segurando o path pra sempre, calado. Fix: `delErr` checado + `console.error` (cliente/server conforme o módulo).

### 7. `salvarNotaEncontro` — delete silencioso

Apagar a nota (texto vazio) não verificava se alguma row saiu: row escondida pela RLS ou removida por outra sessão voltava `ok` e a tela seguia mostrando a nota como salva. Fix: `.select("id")` no delete — `!data?.length` → `{ error: "Não foi possível apagar. Recarregue a página e tente de novo." }`. O autosave só chama quando o texto difere do último salvo (`nota-encontro.tsx:58`), então campo nunca-preenchido limpo não dispara falso erro.

### 8. `editar/excluirEncaminhamento` — blocklist em vez de allowlist

`eu.role === "coordenacao"` barrava só a coord — jovem, supervisor e auxiliar passavam do guard pra morrer na RLS (ou pior, em regra futura mais branda). Fix: allowlist de mentor como em `criarCombinadoEncontro` — `!temPapel(eu,"mentor_dpp") && !temPapel(eu,"mentor_especialista")` → erro. Mesma mensagem ("O combinado é da dupla. A coordenação só pode marcar como feito."). `temPapel` cobre híbridos.

### Extra no diff — `after()` no lugar de `void` fire-and-forget

`void snapshotDuplaHoje(...)` podia morrer no flush da resposta serverless — a RPC é idempotente (unique dupla_id+dia), então rodar pós-resposta é seguro. Migrado pra `after()` em 5 sítios: `salvarRegistro`, `resolverApoio` (actions.ts), `resolverApoioJovem` (actions-avaliacao.ts), `registrarEncerramento` e `encerrarTrilhaEspecialista` (actions-encerramento.ts).

## Schema

Nenhuma — batch 100% código.

## Domínio (`src/lib/`)

- `jornada.ts:874` — `toDateStr(agora)`.
- `forms/actions.ts` — `duplasDosDestinos` nova (:190-220), insert único em `gerarLinksFormulario` (:335-356), `delErr` em `subirAnexoFormulario` (:651-657), carimbo antes da cópia + `remove(destino)` em `finalizarPromocaoIntake` (:903-968).
- `actions.ts` — reconcile com `Promise.all` + `aviso ??=` em `salvarRegistro` (:3532-3608); `.select("id")` em `salvarNotaEncontro` (:3656-3665); allowlist em `editarEncaminhamento` (:3834) e `excluirEncaminhamento` (:3873); `after()` ×2.
- `actions-avaliacao.ts`, `actions-encerramento.ts` — `after()` ×3.
- `demo/data.ts` — `ProfilePapel.escopo_supervisao`, grant do Paulo T2, `supervisionaDuplaDemo`; `demo/queries.ts` + `encerramento-data.ts` + `forms-data.ts` + `pdm-data.ts` — todos os filtros de supervisor migrados.
- `components/anexos-registro.tsx` — `delErr` checado.

## UI

Copy nova em 2 lugares: aviso de reconciliação de combinados ("O registro foi salvo, mas nem todos os combinados entraram. Confira a lista de combinados.") e erro de delete de nota ("Não foi possível apagar. Recarregue a página e tente de novo.") — ambas sem travessão, tom de copy da casa.

## Seed + demo

O grant de turma do supervisor demo é o seed change do batch (item 5) — dataset + spec e2e `agenda-auxiliar.spec.ts` atualizados (7→8 duplas visíveis, `d-t2a` do Kauã entra pelo grant; contagens 5→6 ajustadas nos asserts; checagem negativa mantida pras T1 da Beatriz).

## Testes

- `src/lib/jornada-painel.test.ts` — `describe("painelTurmaCtx")` novo: 01:30Z do dia 06 (= 22:30 BRT do 05) com encontros nos dias 05 e 06 → `encVigente === 5`.
- `tests/e2e/demo/agenda-auxiliar.spec.ts` — asserts atualizados pro grant (6 cards, `Kauã` sai da lista negativa).
- ⚠ gap: achados 2–4 e 6–8 sem cobertura nova — só #1 (vitest) e #5 (e2e demo) têm teste. O resto é inspeção.

## Critérios de aceite

- [ ] `painelTurmaCtx` com `agora` entre 21h–23:59 BRT devolve `encVigente` do dia civil SP (teste trava o caso).
- [ ] `gerarLinksFormulario` resolve as duplas do lote em 2 queries `.in` (uma por âncora) + 1 insert único; erro no insert não deixa link mintado.
- [ ] `{ ok: true, criados, reutilizados, links }` do lote reflete exatamente o que existe no banco.
- [ ] `finalizarPromocaoIntake`: perdedor do carimbo não deixa objeto em `avatares/`; `avErr` no `avatar_path` remove o objeto subido.
- [ ] `salvarRegistro`: falha só na reconciliação de combinados retorna `{ ok: true, aviso }` — nunca `{ error }` com registro já gravado; o toast mostra o aviso.
- [ ] Supervisor demo vê as duplas da turma do grant (d-t2a) além das supervisionadas diretas; escopo negativo fora da turma segue valendo.
- [ ] Upload de anexo falho + delete da row falho loga `console.error` (não some calado).
- [ ] `salvarNotaEncontro` com texto vazio e row inexistente/inescondida retorna erro honesto.
- [ ] `editarEncaminhamento`/`excluirEncaminhamento` negam jovem/supervisor/auxiliar **antes** do banco; mentor da dupla segue editando.
- [ ] `snapshotDuplaHoje` não roda mais em `void` solto — os 5 sítios usam `after()`.
- [ ] `npx vitest run` e a spec `agenda-auxiliar.spec.ts` verdes; `tsc`/`eslint` limpos.

## Fora de escopo

- Os demais achados de auditoria fora dos 8 (o batch é fechado).
- Refactor de `duplaDoDestino` unitária — ficou pra compat (usada por fluxos unitários); a batch é a nova.
- Commit das mudanças — o diff está no working tree da branch; commit/push seguem o fluxo normal da casa.

## Notas de review (gaps conhecidos)

- ⚠ gap: `next-env.d.ts` modificado no diff (`.next/dev/types` → `.next/types`) — churn de build local, não é do batch; reverter antes do commit.
- ⚠ gap: mudanças ainda não commitadas na branch `thiago/audit-fixes` — a spec descreve o working tree.
- ⚠ gap: achados 2–4 e 6–8 sem teste automatizado novo — critérios acima são verificáveis por inspeção do diff + teste manual, mas nada trava regressão.
