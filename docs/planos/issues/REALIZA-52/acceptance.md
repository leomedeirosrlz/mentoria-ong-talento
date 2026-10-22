# REALIZA-52 — critérios de aceite

## Score determinístico (metade 1)

1. Mesma dupla + mesmos dados + mesmo `hoje` → mesmo `score` byte-a-byte
   (função pura — o invariante fundamental; teste cobre 3 fixtures).
2. Dupla com 2 sinais `risco` → `score` cai pelo esperado dos pesos e
   `componentes` lista os 2 sinais com `detalhe` ("2 encontros atrasados").
3. Dupla sem avaliações → componente `avaliações` **sai** e o score é o
   total renormalizado dos demais (nunca punido por falta de dado).
4. Pausada/concluída/encerrada → `score=null` (ou equivalente decidido) —
   não pontua congelado.
5. Com snapshots (182) → componente `tendência` entra; sem → sai e os
   pesos renormalizam (assert nos dois modos).
6. `/relatorios`: coluna `score` aparece pro coord com o número + tooltip
   decompondo (`componentes` legíveis); ordenar pela coluna funciona se o
   canvas suportar sort custom (se não, documentado).
7. **`score` não existe em `COLUNAS_PUBLICAS`** nem no allowlist da 170 —
   assert no teste do catálogo (o índice interno não vai pra público).
8. Mentor/supervisor nunca veem o score (não entra em nenhuma view deles).

## Narrativa — template (sempre on)

9. Coord clica "Gerar resumo do período" → recebe texto pt-BR com os
   agregados corretos (conferir nºs contra os cards); sem flag/provider,
   funciona igual (é o caminho default).
10. Texto não contém nomes de pessoas/duplas (só agregados) — grep no
    output por um nome de fixture não casa.

## Narrativa — LLM (gated)

11. Sem `IA_NARRATIVA_ENABLED` → a action cai no template (200, badge
    "resumo automático"); nunca 500 por falta de provider.
12. Com flag + `callModel` stub injetado (teste): a chamada recebe o
    payload e **`montarPayloadTurma` produz exatamente as keys da
    allowlist do sdr** — teste strict: dados de input com PII → output
    sem nenhuma delas (assert por key + por valor).
13. Cada chamada grava `ia_eventos` com `canal='relatorio'`,
    `tool='narrativa_turma'`, `args={turma,periodo}` (metadado só),
    `ok`, `duracao_ms` — o payload agregado **não** vai pro `args` do log
    (a ação é auditada, o conteúdo não).
14. Output exibido como "rascunho gerado por IA — revisar"; não é salvo,
    não é exportado, não sai da página sozinho.
15. Falha do provider → `{error}` amigável + `ia_eventos.ok=false` +
    fallback pro template na mesma resposta (a coord sempre sai com um
    texto).
16. CHECK do `ia_eventos.canal` aceita `'relatorio'` pós-migration
    (validador REST: RPC com canal novo → uuid; com canal inválido →
    exception).

## Gates

17. `tsc`/`eslint`/`vitest` limpos; `score` com cobertura de borda (sem
    dados, todos os sinais, hoje fake).
18. Migration 0110 em staging → validador → prod → merge (schema-contract).
19. **Antes de ligar em qualquer ambiente:** a resposta do BLOCKER
    jurídico documentada no PR/decisao (sdr §gate) — sem ela a flag fica
    off e isso é um critério, não sugestão.
