<!--
PR de agente: os checks verdes não dispensam o preenchimento. Itens
marcados sem evidência são rejeitados na revisão.
-->

## O quê e por quê

<!-- 2-4 linhas. Se a mudança exige spec (schema/RLS, auth, rota pública,
     integração externa, >1 superfície): link da spec é obrigatório. -->

- Spec: `specs/NNN-<slug>/spec.md` _(ou "não se aplica porque …")_

## Como foi verificado

<!-- Cole a saída dos comandos que rodou; não descreva de memória. -->

- [ ] `pnpm exec next typegen && npx tsc --noEmit`
- [ ] `npx eslint src/`
- [ ] `pnpm test`
- [ ] `pnpm guard`
- [ ] Tocou rota/fluxo? e2e local conforme `docs/convencoes/ci-e2e.md`

## Mudanças estruturais

- [ ] Migration **nova** (número livre; nenhuma existente editada — o `repo-guard` bloqueia)
- [ ] Migration aplicada no **staging** antes do push (`pnpm schema:check` verde)
- [ ] Policy/RPC nova tem caso de papel **negado** no e2e
- [ ] Rota pública nova? Entrou em `isPublic` + e2e de token inválido + revisão LGPD
- [ ] Dado pessoal novo? `docs/lgpd/inventario-dados.md` atualizado na mesma PR

## Produto

- [ ] Copy pt-BR, sem travessão em texto exibido, sem jargão interno
- [ ] Estados vazio/erro/carregando resolvidos; sem placeholder
- [ ] Paridade `/demo` mantida (`DEMO_MSG` nas mutações)

## Deploy

- [ ] Sem `[deploy]` e sem `[e2e-preview]` nesta mensagem (só com autorização do Thiago)
