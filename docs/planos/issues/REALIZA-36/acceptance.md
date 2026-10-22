# REALIZA-36 — acceptance.md

Critérios executáveis (given/when/then). "O servidor" = `submeter_resposta_formulario`/`formularios_limpa_respostas` no staging.

## Schema/REST

1. **GIVEN** migration `0106` aplicada **WHEN** `insert formulario_anexos`
   por role `anon`/`authenticated` direto ao PostgREST **THEN** 401/42501 —
   nenhum grant de escrita.
2. **GIVEN** link ativo com campo `arquivo` **WHEN** `POST /rpc/form_anexo_put`
   com `p_token` válido e `p_mime='image/svg+xml'` **THEN** erro — fora da
   allowlist; **WHEN** `p_tamanho` > `max_mb` **THEN** erro.
3. **GIVEN** resposta com campo `visible_if` oculto preenchido **WHEN**
   submit **THEN** resposta gravada **não contém** a chave do campo oculto.
4. **GIVEN** campo `select` com `permite_outro` **WHEN** resposta
   `"Outro: xadrez"` **THEN** gravado; **WHEN** `"Outro: "` (vazio) **THEN**
   erro de validação; **WHEN** campo sem `permite_outro` e valor fora de
   `opcoes` **THEN** dropado/erro (comportamento atual).
5. **GIVEN** campo `grid_disponibilidade` **WHEN** resposta com
   `celulas:[{dia:'seg',periodo:'19'}]` **THEN** `disponibilidade_ok`
   aceita o valor como `disponibilidade` (verificado via SQL no staging).
6. **GIVEN** `arquivo` **WHEN** resposta com `path` fora do prefixo
   `form-anexos/<link_id>/` **THEN** dropado pelo sanitizer.

## UI pública (`/f/[token]`)

7. **GIVEN** form com os 4 recursos **WHEN** respondente marca "Outro" sem
   texto e submete **THEN** erro inline "Descreva o outro.", foco no campo.
8. **GIVEN** campo oculto por `visible_if` **WHEN** a condição passa a ser
   verdade **THEN** o card entra animado e o contador de progresso re-conta.
9. **GIVEN** upload em andamento **WHEN** clica Enviar **THEN** erro
   "Aguarde o upload terminar" — submit bloqueado, não perde respostas.
10. **GIVEN** grade **WHEN** teclado (setas+espaço) **THEN** células
    alternam com `aria-pressed` e anunciáveis por leitor de tela.

## Builder

11. **GIVEN** builder **WHEN** tenta criar `visible_if` apontando pra campo
    posterior **THEN** não aparece na lista / validação rejeita com erro
    no card.
12. **GIVEN** form `sistema=true` **WHEN** abrir builder **THEN** campos
    novos não editáveis (regra existente).

## Respostas/export

13. **GIVEN** resposta com arquivo **WHEN** coord abre resumo **THEN**
    "Abrir anexo" devolve signed URL (200) — e abre o PDF/imagem.
14. **GIVEN** resposta com grid **WHEN** exporta CSV **THEN** coluna traz
    `seg 19h;qua 09h` legível — não JSON cru.

## Demo

15. **GIVEN** `/demo` **WHEN** abrir form de intake demo **THEN** os 4
    tipos renderizam; upload retorna `DEMO_MSG`; respostas demo aparecem.

## Edge cases

- Link expirado **antes** do upload → `form_anexo_put` rejeita.
- 21º anexo no mesmo link → erro "Limite de anexos atingido".
- `visible_if` cadeado (A→B→C): avaliação sequencial pela ordem dos campos.
- Respondente sobe arquivo, nunca submete → órfão em `formulario_anexos`
  (aceito, documentado — delete manual pelo link).

## Gates & rollout

`npx tsc --noEmit` ✅ · `npx eslint src/` ✅ · `pnpm test` ✅ ·
schema-contract CI ✅ · e2e-preview (spec app novo com upload real) ✅ ·
migration em staging **antes** do push, em prod **antes** do merge
(ordem AGENTS.md) · review por ≥2.
