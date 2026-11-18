---
description: Gera o plano técnico da spec ativa em specs/NNN-slug/plan.md
---

Leia, nesta ordem: `.specify/memory/constitution.md`, `.specify/templates/plan-template.md`, a spec ativa, `docs/convencoes/architecture.md`, `docs/convencoes/conventions-ui.md` (se tocar UI) e `docs/convencoes/ci-e2e.md`.

Antes de escrever:

1. Localize o que já existe e deve ser reutilizado (não crie segundo módulo): `src/lib/actions*.ts`, `src/lib/queries*.ts`, `src/lib/escritas.ts`, `src/lib/ciclo.ts`, `src/lib/demo/`.
2. Descubra a próxima migration livre em `supabase/migrations/` (nunca reuse número; lacunas são intencionais) e confira o schema real antes de propor DDL.
3. Se a mudança toca rota pública, procure `isPublic` em `src/lib/supabase/middleware.ts` e o matcher em `src/proxy.ts`.

Escreva `plan.md` a partir do template, com:

- Constitution Check A1–A10 preenchido com evidência (path/arquivo), não com "sim";
- paths reais de cada camada;
- autorização em matriz papel × operação (incluindo o caso negado);
- ordem de migration, retroativo e rollback;
- paridade demo e plano de testes (unit, e2e demo, e2e app);
- rollout staging → produção com o gate de cada passo.

Violação consciente de artigo vai na tabela de desvios, com a alternativa simples rejeitada. Se a spec estiver ambígua, pare e volte para `/speckit.clarify` — não invente requisito no plano.
