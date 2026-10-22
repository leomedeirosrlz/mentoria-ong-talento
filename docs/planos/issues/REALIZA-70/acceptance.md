# REALIZA-70 — acceptance.md

## Seed fiel

1. **GIVEN** migration aplicada **WHEN** coord abre o form no builder
   **THEN** 5 seções, ~26 campos, labels verbatim do mapeamento —
   `sistema=true` bloqueia edição.
2. **GIVEN** o campo `experiencia_descricao` **WHEN** responde "Não" em
   `experiencia_previa` **THEN** o campo não aparece (visible_if).
3. **GIVEN** `cor_raca` **THEN** opção "Outro" revela texto livre;
   serializa `Outro: <texto>`.

## Link multi-uso

4. **GIVEN** link intake ativo **WHEN** 2 respondentes diferentes abrem
   `/f/[token]` e submetem **THEN** 2 respostas gravadas (unique manual
   preservado via trigger — link manual continua uso-único, verificar
   resposta 2→erro).
5. **GIVEN** link desativado **THEN** `/f/[token]` cai no estado de link
   inválido padrão.
6. **GIVEN** 51ª resposta no dia **THEN** erro "Recebemos muitas
   inscrições hoje…".

## Uploads

7. **GIVEN** os 4 uploads **WHEN** candidato anexa 4 arquivos e submete
   **THEN** resposta traz 4 paths `form-anexos/` e coord abre cada um
   via signed URL.
8. **GIVEN** anexo >10MB ou .exe/.svg **THEN** rejeitado pelo helper/
   sanitizer.

## Grade + promoção

9. **GIVEN** 3 respostas **WHEN** `?view=grade` **THEN** linha por
   candidato, coluna disponibilidade = "N faixas", arquivos linkáveis.
10. **GIVEN** "Cadastrar a partir da resposta" **WHEN** confirmar no
    `NovaPessoaDialog` **THEN** `profiles` criado com nome/e-mail/
    whatsapp/disponibilidade/gênero/cor preenchidos e `disponibilidade_ok`
    passa na grade mapeada.
11. **GIVEN** resposta promovida **THEN** grade mostra "Promovido ✓"
    (`promovido_profile_id` setado); e-mail duplicado → dialog valida
    (regra existente).

## Demo / e2e

12. `/demo`: link intake demo + respostas demo visíveis na grade;
    promoção → `DEMO_MSG`.
13. e2e app: fluxo completo (gerar link → submit anon → segunda
    resposta → grade → promover) no staging.

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` ✅ schema-contract ✅ e2e-preview ✅
review ≥2 ✅ · migration staging-antes-do-push, prod-antes-do-merge ✅
