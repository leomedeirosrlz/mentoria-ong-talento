# Acceptance — REALIZA-181 PDM nativo

Critérios executáveis por QA. Convenção: **dado / quando / então**. "REST" =
call PostgREST/RPC direta no staging com o JWT do papel. Fixtures:
`scripts/seed-e2e-staging.mjs` (`e2e00000-*`) + `seed-demo-staging.mjs`
(`de000000-*`, contas `coord@/mentor@/jovem@realiza.test`).

## A. Modelo & RPCs (REST/DB)

1. Dado dupla DPP `ativa` sem PDM; quando `pdm_salvar_item(dupla, null, null, "Concluir o EM", …)` como mentor da dupla; então retorna uuid e `pdm` + item existem (lazy create), `status='ativa'`, `origem='manual'`, `created_by=mentor`.
2. Dado PDM com 10 metas raiz; quando insert da 11ª (RPC ou direto); então `raise exception` (cap) e nada gravado.
3. Dado PDM com 20 itens não-raiz; quando insert da 21ª submeta em qualquer nível; então `raise` no cap.
4. Dado meta A com submeta A1 e sub-sub A1a; quando `pdm_remover_item(A)`; então A, A1 e A1a somem (cascade).
5. Dado item `atingida`; quando `pdm_status_item(…, 'atingida')` → `atingida_em ≈ now()`; quando `pdm_status_item(…, 'ativa')` depois → `atingida_em = null`.
6. Dado irmãos [a,b,c]; quando `pdm_reordenar(pai_null, [c,a,b])`; então `ordem` vira 1,2,3 nessa sequência; quando a lista omite `b` ou traz id de outro pai → `raise`, nada muda.
7. Dado item em PDM X; quando `pdm_salvar_item(duplaY, …, p_parent_id=itemDeX)`; então `raise` (cross-PDM).
8. Dado dupla `concluida`; quando qualquer RPC de escrita; então `raise`; `pdm_da_dupla` segue retornando leitura.
9. Dado dupla `trilha='especialista'`; quando `pdm_salvar_item`; então `raise` (PDM é DPP).

## B. RLS / escopo

10. `select * from pdm_itens` como **mentor de outra dupla** → 0 rows; `pdm_da_dupla(outra)` → `raise 'sem permissão'`.
11. Idem como **mentorado de outra dupla** (JWT jovem) → 0 rows; write → `raise`.
12. **Supervisor da dupla**: `pdm_da_dupla` retorna conteúdo; `pdm_salvar_item` → `raise` (lê, não edita).
13. **Coordenação**: lê qualquer dupla; `pdm_salvar_item` → `raise` (lê, não edita — "coord lê").
14. **anon** → `permission denied` nas tabelas; `pdm_da_dupla` sem JWT → `raise`.
15. Mentor da dupla `pausada` → escrita **permitida** (dupla viva).

## C. Projeção forms → PDM

16. Dado link de `sistema='metas'` respondido com `meta_1`/`porque_1` e `meta_principal="Meta 2"`; quando submit via `submeter_resposta_formulario`; então `pdm` nasce com `visao` de `declaracao_visao`, item `meta_1` criado com `porque`, e o item do slot `meta_2` (se existir com texto) sobe pra `ordem` inicial.
17. Dado link `sistema='pdm'` com `meta_1`+`is_1`+`prazo_1`+`submetas_1` (3 linhas); quando submit; então o slot `meta_1` (mesmo da rodada `metas`) atualiza `indicador`/`prazo_alvo` — **sem duplicar** — e 3 filhos nascem com `origem='pdm'`, `origem_campo='submetas_1'`.
18. Re-submit da **mesma** resposta (idempotência) → zero mudança; re-emissão (link novo, resposta nova com `meta_1` alterado) → **atualiza** o slot preservando `status`/`atingida_em`/`ordem`.
19. `submetas_1` re-respondida sem uma linha anterior → o filho projetado ausente vira `descartada` (não é deletado; `atingida_em` preservado se havia).
20. Item criado manualmente (`origem_campo is null`) sob `meta_1` → projeções seguintes nunca o tocam nem removem.
21. Resposta com >20 linhas em `submetas_N` → grava as 20 primeiras, resposta não falha (warning), cap respeitado.
22. Backfill 0106: dupla com resposta `metas` antiga → após migration, `pdm_da_dupla` retorna os itens projetados; reexecutar → no-op.

## D. Unit (Vitest — `src/lib/pdm.ts`, `tests/pdm.test.ts`)

23. `montaArvore(flat)`: ordena irmãos por `ordem`; filho órfão (parent ausente) não quebra e vai pra raiz-virtual ou é descartado consistentemente; profundidade arbitrária preservada.
24. `progresso(no)`: subárvore conta `status='atingida'`/`total` excluindo `descartada`.
25. `resumoPdm(itens)`: metas = raízes ≠ descartada; `atingidas`; submetas total/atingidas — casos: vazio, só raízes, aninhado.
26. Parse de linhas `submetas_N` (espelho da regra SQL): ignora vazias, strip `1.`/`2)`/`-`, cap 20.

## E. E2E (`tests/e2e/app/pdm.spec.ts`, staging/preview)

27. **Ficha mentor**: login `mentor@` → ficha da dupla → seção "Plano de desenvolvimento" → adicionar meta → aparece na árvore; refresh → persiste.
28. **Co-edição**: mentor cria "Meta 1"; jovem loga (`jovem@`) → `/jovem/pdm` → edita o título → mentor recarrega a ficha → vê a edição do jovem.
29. **Prioridade**: jovem move Meta 2 pra cima (↑) → vira primeira → label "a mais importante" migra → persiste entre sessões (141).
30. **Atingida**: jovem marca submeta → carimbo de hoje aparece → desmarca → carimbo some (142).
31. **Recursão**: jovem cria submeta dentro de submeta dentro de submeta → indentação/breadcrumb legível no mobile (142).
32. **Resumo**: coord abre ficha com itens atingidos → card "PDM" no Resumo da jornada mostra "X de Y" + lista com datas; `salvarEncerramento` grava a linha no `resumo_jornada`.
33. **Cap UI**: 10 metas → botão desabilitado + copy do limite (não erro solto).
34. **Rodada→vivo**: emitir link `metas` pela ficha → responder em `/f/[token]` → ficha mostra as metas na árvore (origem visível ou não — basta existirem).
35. **Leitura staff**: `coord@` abre ficha → árvore completa visível, **sem** checkboxes/menus de edição.

## F. Demo (`tests/e2e/demo`, qualquer ambiente)

36. `/demo` como mentor → ficha da dupla com PDM fixture → árvore com metas/submetas/atingidas renderiza; `podeEditar` mostra controles mas ação → toast demo (convenção `DEMO_MSG`).
37. `/demo` como mentorado → `/jovem/pdm` → o PDM do persona renderiza.

## G. Regressão — respostas antigas

38. Resposta `metas` de antes da 0106 (com `meta_principal`+`rev_*`) → `InstrumentoResultado` renderiza sem crash, metas + revisão legíveis (141 aceite).
39. Resposta `pdm` antiga com `submetas_N` texto → segue renderizando o bloco "Desdobramento da meta N" no snapshot **e** a projeção/backfill mostra os filhos na árvore viva.
40. `jornada_autoemit`/`jovem_jornada`/`instrumentos_da_dupla`/`painel_instrumentos_jornada` — suites existentes (`tests/instrumentos.test.ts`, e2e jornada) seguem verdes: a seção nova não quebra as entregas.

## Gates

- `npx tsc --noEmit` ✓ · `npx eslint src/` ✓ · `pnpm test` ✓
- `schema-contract` verde (types regen × remoto com 0106 aplicada)
- Validador REST staging (padrão `scripts/_valida_*.mjs`): matriz papel×ação dos §A–B
- `e2e-preview` verde no preview da branch (demo + app)
- Migration: staging → prod **antes** do merge; backfill verificado (`select count(*) from pdm` > 0 onde havia resposta; spot-check de 2 duplas reais comparando resposta × árvore)
