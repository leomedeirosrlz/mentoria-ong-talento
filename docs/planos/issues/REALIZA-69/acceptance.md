# REALIZA-69 — acceptance.md

## Seed

1. **GIVEN** `0108` aplicada **THEN** form "Matching de Mentorados"
   existe com `sistema=true`, ~17 campos, 4 seções, verbatim do
   mapeamento — builder bloqueia edição.
2. **GIVEN** `cor_raca` **THEN** "Outro" livre funciona (36); `curriculo`
   é `arquivo` 10MB obrigatório; **não** há grid/foto/documentos.

## Link multi-uso (herdado do 70)

3. **GIVEN** `gerarLinkIntake` no form mentorados **THEN** `/f/[token]`
   aceita N respostas anônimas; link manual continua uso-único (trigger).

## Promoção

4. **GIVEN** resposta de intake_mentorado **WHEN** "Cadastrar a partir da
   resposta" **THEN** abre o **dialog de mentorado** (não NovaPessoa)
   com prefill dos campos que `mentorados` suporta.
5. **GIVEN** confirmação **THEN** `mentorados` row criada +
   `promovido_mentorado_id` na resposta; grade mostra "Promovido ✓".
6. **GIVEN** resposta de intake_mentor **THEN** promoção continua indo
   pra `profiles` (regressão do 70).

## LGPD/estados

7. Respostas coord-only (RLS); anexo via signed URL; card de sucesso com
   copy de intake ("Inscrição recebida…").
8. Link desativado → estado de link inválido; rate cap do 70 vale aqui.

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` ✅ schema-contract ✅ e2e-preview
(submit anon→grade→promover mentorado) ✅ review ≥2 ✅ · ordem
staging/prod de migration conforme AGENTS.
