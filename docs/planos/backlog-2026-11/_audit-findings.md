# Achados da auditoria de bugs (staging@db72ec1, 11/nov)

Varredura em 9 classes de bug sobre `src/lib/actions*.ts`, `forms/actions.ts`, `demo/queries.ts`, componentes de escrita direta e migrations-chave. Os 8 achados ranqueados abaixo viraram o batch `thiago/audit-fixes` (spec: `audit-fixes.md`). Itens já trackeados (REALIZA-374, -351, -353, -364, -362, -372, -367, -365, -363, -368, -370, -66, -35) não foram re-reportados.

## Ranked

1. **Medium — data UTC onde a regra exige data civil de São Paulo.** `src/lib/jornada.ts:871` — `painelTurmaCtx` usa `agora.toISOString().slice(0,10)` (UTC) enquanto o resto do código usa `America/Sao_Paulo`. Entre 21:00–23:59 BRT o painel de jornada destrava/marca um dia antes (`encVigente`/`atrasadas`).
2. **Medium — `gerarLinksFormulario`: falha parcial reportada como total + N+1.** `src/lib/forms/actions.ts:301-318` — loop serial `duplaDoDestino()` + `.insert()`; erro no item k retorna `{error}` com links 0..k-1 já mintados; até 200 queries sequenciais.
3. **Medium — avatar órfão no rollback da promoção de intake.** `src/lib/forms/actions.ts:884-923` — `finalizarPromocaoIntake` copia a foto antes do carimbo `promovido_*`; falhas posteriores deixam o objeto `avatares/<id>/<uuid>.<ext>` órfão.
4. **Medium — `salvarRegistro`: reconciliação de combinados falha pós-persist.** `src/lib/actions.ts:3491-3563` — registro e `encontro.realizado` já persistidos quando o loop por-combinado roda; erro no meio retorna `{error}` com reconciliação parcial e falso negativo pro mentor.
5. **Medium — escopo de supervisão por turma ausente na réplica demo.** `src/lib/demo/queries.ts:119-125` — `duplasDoPapel` só casa `supervisor.id`; a `supervisiona_dupla` real (0125) também cobre `profile_papeis` com `escopo_supervisao='turma'`. Dataset carrega os campos mas nunca modela a concessão.
6. **Low — cleanup de órfão não verificado nos dois caminhos de anexo.** `subirAnexoFormulario` (forms/actions.ts:613) + `enviarAnexo` (anexos-registro.tsx:75) — se o delete da row de metadados falha após erro de storage, a row aponta pra objeto inexistente e trava o `path` único.
7. **Low — `salvarNotaEncontro` delete retorna ok sem verificação.** `src/lib/actions.ts:3641-3644` — `.delete()` sem `.select("id")`: no-op silencioso (row escondida por RLS) indistinguível de sucesso.
8. **Low — guards blocklist coord-only em encaminhamentos.** `editarEncaminhamento`/`excluirEncaminhamento` (actions.ts:3811, 3849) — divergem do allowlist `temPapel(mentor_dpp|mentor_especialista)` de `criarCombinadoEncontro`; qualquer não-coord passa o guard e depende de RLS.

## Incertos (não viraram fix)

- `void snapshotDuplaHoje(id).catch(...)` fire-and-forget em server actions — risco de freeze serverless; resolvido via `after()` no batch.
- `semana-do-programa.tsx` mix local-parse→UTC-stringify — só erra em UTC+13/+14, sem impacto Brasil.
- `assistente-config.tsx` probe `/api/ia/modelos` sem abort on unmount — benigno.
- `encontro_intencoes` sem referências — tabela migrada/dropada intencionalmente (0157).

## Verificado limpo

- `void`/`rpc` lazy PostgREST corretamente encadeados (`tentativa-registro.ts`, handoff).
- `subirAnexoFormulario` valida token/mime/size; service-role só no hop de storage.
- Writes state-guarded (`.in(status)`, `.is(null)`) em `salvarLinkEncontro`, `reemitirLinkFormulario`, `vincularRespostaOrfa`, `finalizarPromocaoIntake`.
- `ia_config`/`ia_mcp_tokens` writes casam com RLS (coord-only / owner-only).
- Réplicas demo de chamados (`demoChamadosFila`/`demoChamadoTimeline`) espelham o masking da view.
- `agendarEncontro` compara instantes (não strings), preserva `motivo_reagendamento`, bloqueia `realizado`.
