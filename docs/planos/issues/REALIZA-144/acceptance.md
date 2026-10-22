# REALIZA-144 — acceptance.md

## Núcleo wizard

1. **GIVEN** form com ≥2 `secao` **WHEN** respondente abre `/f/[token]`
   **THEN** vê só a etapa 1, pill "Etapa 1 de N", botão Avançar, sem
   submit visível.
2. **GIVEN** etapa com obrigatória em branco **WHEN** Avançar **THEN**
   erro inline no campo + foco; não muda de etapa.
3. **GIVEN** etapa válida **WHEN** Avançar **THEN** próxima etapa entra
   animada (fade+slide), heading recebe foco, pill = "Etapa 2 de N".
4. **GIVEN** etapa N preenchida **WHEN** Voltar **THEN** etapa N−1 com
   valores **preservados** (etapas montadas com `hidden`).
5. **GIVEN** qualquer etapa **WHEN** Enter num input **THEN** = Avançar;
   submit só no último passo.
6. **GIVEN** última etapa **WHEN** Enviar **THEN** payload único idêntico
   ao não-wizard (mesmas chaves `respostas`), token consumido, tela de
   sucesso padrão.

## Regressão e estrutura

7. **GIVEN** form sem `secao` **WHEN** abrir **THEN** página única atual
   (zero diferença visual).
8. **GIVEN** campos antes da primeira `secao` **THEN** etapa 1 heading
   "Suas informações" contém esses campos.
9. **GIVEN** `secao` consecutiva vazia **THEN** não vira passo em branco.

## Estado

10. **GIVEN** respostas digitadas + passo >0 **WHEN** refresh **THEN**
    form recomeça vazio (decisão — não há rascunho) e `beforeunload`
    disparou ao tentar sair.

## Erro de submit

11. **GIVEN** etapa 2 inválida, usuário na etapa 4 **WHEN** Enviar
    **THEN** salta pra etapa 2, foco no primeiro erro, `role=alert`
    anunciado.

## Preview / demo / a11y

12. **GIVEN** `FormularioPreview` **WHEN** abrir prévia de form com
    seções **THEN** Avançar/Voltar navegam; submit off.
13. **GIVEN** `/demo` **THEN** existe form demo com seções virando wizard.
14. **GIVEN** leitor de tela **WHEN** trocar de etapa **THEN** anuncia
    "Etapa X de N — <label>"; `prefers-reduced-motion` desliga slide.

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` (`modoEtapa`/`etapas`/`etapaDoCampo`) ✅
e2e app novo cobrindo 1-6 ✅ e2e-preview ✅ review ≥2 ✅
