# REALIZA-49 — acceptance.md

## Grade ↔ cards

1. **GIVEN** form com 3 respostas e 5 campos **WHEN** coord abre
   `?view=grade` **THEN** 3 linhas × (Respondente+Quando+5 colunas),
   valores **idênticos** aos accordions do Resumo.
2. **GIVEN** campo removido do form com resposta antiga **WHEN** grade
   **THEN** coluna extra no fim rotulada `· removido`, valor visível.
3. **GIVEN** `secao` no form **THEN** nunca aparece como coluna.

## Serialização por tipo

4. `multi_select` → "A; B" · `arquivo` → link nome → 200 na signed URL ·
   `grid_disponibilidade` → "N faixas" + detalhe · `escala_1_5` → número
   · `data` → `dd/mm/aaaa`.
5. **GIVEN** texto_longo de 500 chars **THEN** célula clampa ~80 e
   title/TSV trazem o valor inteiro.

## Toggle/URL

6. **GIVEN** `?view=grade` na URL **WHEN** reload **THEN** grade
   renderiza direto (SSR); segmento marca Grade (`aria-checked`).
7. **GIVEN** "Copiar" do canvas **THEN** clipboard TSV == colunas visíveis
   com valores completos.

## Estados/permissão

8. **GIVEN** zero respostas **THEN** "Nenhuma resposta ainda — compartilhe
   o link." no lugar da grade.
9. **GIVEN** papel não-coord **WHEN** `/formularios/[id]?view=grade`
   **THEN** bloqueio existente (redirect/404) — nada vaza.

## Edge

- Resposta sem destinatário (link genérico) → "Link genérico".
- Respondente respondeu campo hoje oculto por `visible_if` → valor
  aparece (resposta existe).
- Form com 30 campos → scroll-x com coluna Respondente sticky.

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` (`celulaResposta`/`linhasGrade`) ✅
e2e app (paridade grade↔accordion) ✅ e2e-preview ✅ review ≥2 ✅
