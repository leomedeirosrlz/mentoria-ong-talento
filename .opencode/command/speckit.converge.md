---
description: Mede a implementação contra spec/plan/tasks e anexa o que falta
---

Compare a implementação atual com `specs/<NNN>-<slug>/tasks.md` (a spec ativa).

1. Liste cada task aberta e verifique contra o código real — não contra memória da sessão.
2. Para cada gap: descreva o que existe, o que a spec exige e a distância entre os dois.
3. **Anexe** as tasks que faltam no `tasks.md` (append-only, com novo ID e a origem do gap), na fase correta.
4. Rode o DoD (`pnpm exec next typegen && npx tsc --noEmit && npx eslint src/ && pnpm test`) e reporte o resultado real.
5. Só declare convergido quando: zero task aberta, DoD verde, casos de borda da spec cobertos por teste, e nenhuma violação de constituição pendente de desvio documentado no `plan.md`.

Se o gap revelar requisito que a spec não cobre, pare: volte para `/speckit-clarify` em vez de inventar.
