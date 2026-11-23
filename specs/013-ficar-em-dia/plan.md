# Plano — Ficar em dia até o encerramento

**Spec:** `specs/013-ficar-em-dia/spec.md` · **Status:** Draft

## Resumo técnico

- Estender o planner puro existente para ritmo até 7/semana, usando o encerramento do calendário como limite duro e a cobertura passo a passo.
- Não criar um segundo motor: `montarPlanoEmDia` continua a fonte; UI (`plano-acordos`) e actions/RPCs só consomem.
- Auditar o fluxo de proposta/aceite/banner existente antes de mudar o schema; só criar migration se o aceite bilateral/versão não estiver persistido.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- Domínio puro em `src/lib/plano-em-dia.ts`; UI em `plano-acordos.tsx`; RPCs/actions em `actions-plano.ts` e migrations 0219/0170 (verificar).
- Testes Vitest com relógio fixo + Playwright app.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Projeção + proposta + banner completos | e2e |
| A2 RLS | RPCs existentes; nenhuma ampliação | testes de papel |
| A3 escritas/domínio | Action retorna `{ok}/{error}`; planner puro | tests |
| A4 rota pública | Nenhuma | — |
| A5 LGPD | Nenhum dado novo | — |
| A6 UI | Card visual no padrão da ficha | prints |
| A7 demo | 10 atrasos e em dia | demo e2e |
| A8 gates | DoD | — |
| A9 migrations | Só se aceite/versão não persistir | decisão antes de SQL |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
src/lib/plano-em-dia.ts                  # ritmo até 7, deadline, cobertura
src/lib/plano-em-dia.data.ts             # gaps/limites (sem número mágico)
src/lib/plano-combinado.ts               # sugestões de passo
src/lib/actions-plano.ts                 # propor/responder/aplicar
src/components/plano-acordos.tsx         # card/proposta/aceite
src/components/agenda-por-mentorado.tsx  # entrada na ficha
src/app/(jovem)/jovem/...                # banner/home
supabase/migrations/NNNN_...             # só se necessário
tests/plano-em-dia.test.ts               # relógio fixo
tests/e2e/{demo,app}/...                 # fluxo
```

## Dados e migrations

- Primeiro provar que `plano` já guarda lado/versão/status; se não, migration nova com `aprovado_lado`, versão e janela.
- Nenhuma alteração em migration aplicada; schema real conferido antes.
- Retroativo: planos antigos sem versão continuam legíveis como versão 1.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| propor plano | ✅ | ✅ | ✅ (própria) | ❌ | ❌ | ❌ |
| aceitar/contestar | ❌ | ❌ | ✅ (própria) | ❌ | ✅ (própria) | ❌ |
| aplicar passo | ✅ | ✅ | ✅ (própria) | ❌ | ✅ (própria) | ❌ |

Manter a matriz real; negado testado.

## Superfícies e rotas

- Sem rota nova. O banner usa as homes existentes; a ficha continua o detalhe.
- Não criar deep-link público.

## Paridade demo

- Dupla com 10 atrasos e dupla em dia; proposta/aceite no dataset demo; nenhuma escrita real.

## Testes

- **Unit (prioridade):** relógio fixo 23/11/2026; 10 atrasos; em dia; 15/01; recesso; 1/dia; gaps; passo travado.
- **E2E demo:** card nos três estados.
- **E2E app:** propor → aceitar os dois lados → banner.
- **Visual:** prints dos cards e banners.

## Observabilidade e erro

- Evento de produto para proposta/aceite (se a infra existir); erro de RPC inline.
- Estado impossível é conversa, não erro de sistema.

## Rollout

1. testes puros do planner; 2. UI do card; 3. proposta/aceite/banner; 4. gates; 5. review; 6. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| Possível migration de aceite | paridade real do fluxo | guardar estado só na UI |
