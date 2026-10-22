# _done-fixer — correções de citações de paths (check-planos)

Rodado `node scripts/check-planos.mjs`: **9 pastas com FALHA → 0 com problemas**
(exit 0; avisos remanescentes são paths propostos/`[NOVO]` legítimos e falsos
positivos de tabela — sem ação).

## Correções aplicadas

### (a) Path com diretório errado → citação corrigida pro arquivo real

| Issue | Arquivo:linha | Antes | Depois |
|---|---|---|---|
| REALIZA-147 | `README.md:22` | `src/components/formulario-links.tsx` | `src/app/(app)/formularios/formulario-links.tsx` |
| REALIZA-36 | `README.md:20` | `src/components/formulario-builder.tsx` | `src/app/(app)/formularios/formulario-builder.tsx` |
| REALIZA-36 | `plan.md:126` (aviso) | `src/components/formulario-builder.tsx` | `src/app/(app)/formularios/formulario-builder.tsx` |
| REALIZA-144 | `plan.md:132` (aviso) | `src/components/formulario-preview.tsx` | `src/app/(app)/formularios/formulario-preview.tsx` |

### (b) Nome de migration errado → citação corrigida

| Issue | Arquivo:linha | Antes | Depois |
|---|---|---|---|
| REALIZA-170 | `plan.md:22` (aviso) | `supabase/migrations/0049_login_handoffs.sql` | `supabase/migrations/0049_login_handoff.sql` |

### (c) Arquivo NOVO citado como existente → marcador ` [NOVO]` adicionado

| Issue | Arquivo:linha | Path citado | Contexto |
|---|---|---|---|
| REALIZA-126 | `README.md:12` | `src/lib/escritas.ts` | arquivo a criar na 179 (PR 5, sdd §6) |
| REALIZA-179 | `README.md:70` | `src/lib/escritas.ts` | extração do core dos writes — previsto, não existe |
| REALIZA-137 | `README.md:46` | `src/lib/demo/mockups.ts` | registry "previsto… mas nunca criado" (WP9) |
| REALIZA-138 | `README.md:33` | `src/lib/demo/mockups.ts` | idem — entrega deste plano |
| REALIZA-169 | `README.md:34` | `src/lib/jobs.ts` | helper compartilhado da infra de cron (182/169) |
| REALIZA-178 | `README.md:49` e `:60` | `src/lib/ia/provider.ts` | provider LLM entregue na 179 — não existe ainda |
| REALIZA-180 | `README.md:69` | `src/lib/ia/provider.ts` | idem — dep dura da 179 |

### (d) `falta plan.md`/`acceptance.md` em pasta de evidência/tier C

Nenhuma ocorrência na saída do checker — todas as pastas de evidência já são
reconhecidas (README com FEITO/entregue/absorvida/decisão nos primeiros 1500
chars). Nada a fazer.

## Verificação

- Arquivos reais confirmados via `find`/`ls` antes de cada correção
  (`src/app/(app)/formularios/formulario-{links,builder,preview}.tsx`,
  `supabase/migrations/0049_login_handoff.sql`).
- `src/lib/escritas.ts`, `src/lib/jobs.ts`, `src/lib/ia/provider.ts`,
  `src/lib/demo/mockups.ts` confirmados **inexistentes** (propostas) → `[NOVO]`.
- Re-run final: `CHECK-PLANOS — 86 pastas, 0 com problemas`, exit 0.
- Nenhum conteúdo reescrito — só citações corrigidas/marcadas.
