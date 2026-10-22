# REALIZA-36 — Forms engine: novos tipos de campo (arquivo, grade de disponibilidade, visibilidade condicional, "Outro" livre)

[Jira REALIZA-36](https://realizavc.atlassian.net/browse/REALIZA-36)

**Status: PARCIAL** — a engine existe e está em produção; este plano cobre
apenas o restante: 4 capacidades de campo que os formulários de intake
(REALIZA-69/70) exigem.

## O que já existe (não refazer)

- Engine completa `0036` + extensões `0042`/`0080`/`0104`: `formularios`
  (campos JSONB), `formulario_links` (token, destinatário, uso único),
  `formulario_respostas` (respostas JSONB sanitizadas), RPCs definer
  `formulario_por_token` / `submeter_resposta_formulario` /
  `formularios_limpa_respostas`. Anon tem **zero** grant direto — tudo passa
  pelas RPCs.
- 10 tipos em `src/lib/forms/schema.ts`: `texto`, `texto_longo`, `select`,
  `multi_select`, `escala_1_5`, `escala_1_10`, `data`, `checkbox`, `sim_nao`,
  `secao` (divisor estrutural, ignorado nas respostas).
- Builder Google-Forms-like `src/app/(app)/formularios/formulario-builder.tsx`, preview
  real via `FormularioPublico`, links em massa, resumo por pergunta e export
  CSV (`/api/export?tipo=respostas`) — sprints forms UX v1/v2 no BACKLOG.
- `secao` já particiona campos (`agrupaEmSecoes` em
  `src/lib/forms/instrumentos.ts`) — base do wizard REALIZA-144.
- Uploads existentes fora da engine: `documentos` (20MB, coord-only),
  `registro-anexos` (10MB), `chamado-anexos` (10MB), `avatares` (2MB),
  `materiais` (20MB) — padrão row→upload + signed URL em `/api/*/​[id]`.
- Grade de disponibilidade **já existe como dado canônico**:
  `profiles`/`mentorados` têm `disponibilidade` jsonb (check
  `disponibilidade_ok`, migrations `0034`/`0100`) consumido por
  `AfinidadePar`/matching board. O que falta é capturá-la **via formulário**.

## Restante a entregar (este plano)

1. Tipo `arquivo` — upload seguro de anexo no form público.
2. Tipo `grid_disponibilidade` — grade dia×período cuja resposta gera o
   formato canônico `disponibilidade`.
3. `visible_if` — visibilidade condicional por resposta anterior.
4. "Outro" livre — opção `Outro` com texto livre em `select`/`multi_select`.

## Dependências

- **Desbloqueia**: REALIZA-69/70 (intake exige grade + arquivo + outro +
  condicional), REALIZA-49 (grade de respostas precisa renderizar os novos
  tipos), REALIZA-144 (wizard pisa nas mesmas áreas do renderer).
- Nenhuma dependência dura de código fora da engine.

## Esforço estimado: **G**

Frontend público (4 tipos novos de input), builder (4 editores), sanitizer
SQL (4 branches novos), storage [NOVO], validação de schema, demo e testes.
É a fundação do intake — vale a profundidade.

## Riscos

- **Anon sem grants**: upload exige server action com service client —
  validação de token antes de qualquer I/O (ver sdr.md).
- **Formato canônico da disponibilidade**: a resposta do grid precisa
  confluir com `disponibilidade_ok` (0034/0100) — verificar a shape exata
  antes de fixar o payload.
- **Superfície pública**: `arquivo` abre ingestão de binários de estranhos —
  allowlist de MIME, caps, antivírus fora de escopo (storage limpa é aceita
  como mitigação documentada, bucket privado).
- **Ordem com 144**: implementar tipos primeiro; wizard depois pisa no mesmo
  arquivo (`formulario-publico.tsx`) — sequenciar PRs.

## Documentos

- `plan.md` — implementação passo a passo.
- `sdd.md` — decisões de schema/RPC/storage.
- `design.md` — UX dos novos campos (respondente + builder).
- `sdr.md` — superfície de ataque pública e LGPD.
- `acceptance.md` — critérios executáveis.
