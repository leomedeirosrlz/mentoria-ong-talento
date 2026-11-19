# Plano — Produto e IA, rodada nov/2026

**Spec:** `specs/009-ia-produto-nov/spec.md` · **Status:** Draft

## Resumo técnico

- Sete histórias independentes; a maioria **conecta peças que já existem**
  (planner determinístico, tiers de modelo, tools em 2 fases, links por
  token) em vez de criar módulos novos.
- Três migrações pequenas (`dupla_recessos`, colunas em
  `terceiros_respostas` + RPC, `retrospectivas` + link), uma
  materialização de contexto (`dupla_resumo_ia` ou expansão de
  snapshots) e um punhado de tools novas no registry — tudo seguindo os
  moldes já provados (`importacao`, `jovem_*`, `rematch_dupla`,
  `relatorio_links`).
- O que **não** será criado: provider novo de IA (o OpenAI-compatible do
  Go serve), transcript de chat no servidor, transporte WhatsApp,
  segunda régua de recesso/encerramento.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 ·
  Base UI · Phosphor. Supabase (Postgres + Auth + RPC); local só p/ e2e.
- IA: provider OpenAI-compatible (`src/lib/ia/provider.ts`), 3 tiers
  (`config.ts`, `ia_config` quente), roteador determinístico
  (`roteador.ts`), registry `IA_TOOLS` com `roles` + `escreve` +
  confirmação em 2 fases (`ia_confirmacoes`, 0163), GenUI por projetores
  (`ui.ts`) + blocos markdown (`render.ts`), auditoria `ia_eventos`
  (canal `importacao` já existe, 0193), rate limit
  `consumir_limite_ia` (fail-closed).
- Domínio puro: `ciclo.ts` (semáforo/jornada), `plano-em-dia.ts`
  (`montarPlanoEmDia` já parametrizado por `ritmo`), `remanejo.ts`
  (ranking `afinidadeScore`), `retrospectiva.ts` (payload determinístico
  por audiência), `terceiros/` (link público + consolidado).
- Testes: Vitest puro · Playwright `demo`/`app` · schema-contract no CI.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Cada US é fatia vertical própria; spec-only nesta PR, implementação por história | cenários independentes por US |
| A2 RLS | Escritas sensíveis por RPC definer ou núcleo `escritas.ts`; remanejo/encerrar coord-only; jovem só via RPCs definer existentes | matriz abaixo |
| A3 escritas/domínio | planner/recess/níveis ficam em `plano-em-dia.ts`/`ciclo.ts` puros; tools delegam aos mesmos cores | FR-010/012/028 |
| A4 rota pública | retrospectiva segue o molde token+RPC de `/resumo` e `/t`; entrada em `isPublic` + e2e | FR-008 |
| A5 LGPD | card público = allowlist; consentimento declarado no feedback manual; inventário `docs/lgpd/` na PR de implementação | FR-007/025, NFR |
| A6 UI | GenUI pelo kit de cards existente; copy pt-BR; selo de origem textual (nunca só cor) | FR-014/027 |
| A7 demo | dataset demo precisa cobrir dupla encerrada (retro), terceiros e as tools novas pelos mesmos projetores | seção Paridade |
| A8 gates | spec + plano primeiro; implementação por US com DoD completo | — |
| A9 migrations | 3–4 arquivos novos, números livres seguintes; `rematch_dupla` re-apply verbatim do corpo vigente | seção Dados |
| A10 spec | esta pasta | — |

## Arquitetura da mudança (paths reais)

```text
src/lib/importar-cronograma/ia.ts        # US1: tier forte via getIaConfig
src/lib/actions-importar-cronograma.ts   # US1: rate limit + ia_eventos + auto-rota
src/lib/importar-cronograma/extrair.ts   # US1: sinais de complexidade (chars/pág, colunas)
src/components/nova-turma-flow.tsx       # US1: disparo quando complexo + aviso honesto

src/lib/retrospectiva.ts                 # US2: payload por audiência (já existe)
src/lib/retrospectiva-narrativa.ts       # US2 NOVO: monta prompt ancorado + valida
src/lib/actions-retrospectiva.ts         # US2 NOVO: gerar/regerar/compartilhar
src/lib/jobs-retrospectivas.ts           # US2 NOVO: geração no encerramento (tick)
src/app/retro/[token]/page.tsx           # US2 NOVO: card público (+opengraph-image)
src/lib/whatsapp-msgs.ts                 # US2: contexto "celebração"

src/lib/ia/tools.ts                      # US3/4/5/6: tools novas no registry
src/lib/ia/ui.ts                         # US3: kind "disponibilidade" + "plano" com ritmo
src/lib/plano-em-dia.ts                  # US3/6: ritmo exposto + recesso por dupla
src/lib/dupla-resumo.ts                  # US3 NOVO: monta resumo consolidado (domínio)
src/lib/jobs-resumo-dupla.ts             # US3 NOVO: materialização (molde snapshots)

src/lib/remanejo.ts                      # US4: projetor compartilhado ficha×tool
supabase/migrations/0210_*.sql           # rematch grava desfecho; recessos; terceiros
src/lib/escritas.ts                      # US6: declararRecesso no núcleo de escrita

src/app/(jovem)/jovem/...                # US3: plano no recorte do jovem; US6: copy
src/lib/terceiros/queries.ts             # US7: leitores devolvem origem/registrado_por
```

## Dados e migrations

Números como `021N` = próximos livres (última aplicada: `0209`).

- **`021N_recesso_dupla.sql` (US6):** `dupla_recessos` — `id`, `dupla_id`
  FK cascade, `ciclo_evento_id` FK (só `tipo='recesso'`), `usa bool`,
  `declarado_em`, `declarado_por` (default `my_profile_id()`), unique
  `(dupla_id, ciclo_evento_id)`. RLS: select por escopo da dupla (mesmo
  padrão `encontros_select`); escrita só via RPC definer
  `declarar_recesso(dupla, evento, usa)` — guard mentor da dupla ou
  coord, dupla ativa — pra trilha de auditoria e tool.
- **`021N_terceiros_resposta_manual.sql` (US7):** `alter table
  terceiros_respostas add origem text not null default 'link' check
  (origem in ('link','manual'))`, `registrado_por uuid references
  profiles(id)`, `coletado_via text check (in
  ('telefone','presencial','papel','outro'))`,
  `consentimento_declarado boolean not null default false`; RPC definer
  `registrar_resposta_terceiro_manual(p_contato, p_fortes, p_melhorar,
  p_via, p_consentimento)` — mesmo desenho de
  `salvar_consolidado_terceiros` (0105:131-175): autorização mentor da
  dupla | coord + `trilha='dpp'` + status vivo; UPDATE do contato
  `pendente|expirado → 'respondido'` no WHERE (imutável); notifica só a
  coordenação (não o autor).
- **`021N_rematch_desfecho.sql` (US4):** `create or replace
  rematch_dupla` reaplicando o corpo vigente da 0205 + grava
  `dupla_desfecho='remanejada'`, motivo e `dupla_eventos` no fechamento
  DPP. Verificar antes de escrever se o CHECK `duplas_encerramento_esp`
  permite `dupla_desfecho` em DPP (`pg_constraint`/`pg_get_functiondef`
  no ambiente alvo — mesmo cuidado da spec 005).
- **`021N_retrospectivas.sql` (US2):** `retrospectivas` — `id`,
  `dupla_id`, `audiencia` (`'mentorado'|'mentor'|'coordenacao'`),
  `payload jsonb` (retrato determinístico usado), `narrativa jsonb`
  (seções geradas), `modelo`, `versao int`, `gerado_em`,
  `fontes_hash` (invalidação); links compartilháveis estendendo
  `relatorio_links.config.tipo` com `'retro'` + row `retro_id` (ou
  tabela irmã no mesmo padrão — decisão no implemento pelo encaixe mais
  simples na RPC `abrir_relatorio`).
- **`021N_dupla_resumo.sql` (US3):** `dupla_resumo_ia` — `dupla_id` PK,
  `resumo jsonb` (seções curtas: trajetória, próximos, pendências,
  perfil), `gerado_em`, `fontes_hash`. Escrita só por service role (job).
  Alternativa aceitável: coluna jsonb em tabela de snapshots existente —
  decidir pelo menor delta de schema.
- **Sem migration de canal:** `ia_eventos.canal='importacao'` já cobre o
  import (0193); retrospectiva/resumo não precisam de canal novo se
  rodarem como job fora do chat — decidir `'job'` só se o CHECK exigir
  discriminante próprio.

## Autorização (matriz)

| Operação | coord | supervisor | mentor_dpp | mentor_esp | mentorado | anon |
|---|---|---|---|---|---|---|
| import cronograma (IA) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ler retrospectiva própria | ✅ (todas) | ✅ (escopo) | ✅ (sua dupla) | ✅ (sua dupla) | ✅ (só a dela) | token |
| remanejo_opcoes / remanejar | ✅ | leitura ✅ / escrita ❌ | ❌ | ❌ | ❌ | ❌ |
| registrar_retroativo (Liza) | n/a | n/a | n/a | n/a | ✅ própria dupla | ❌ |
| declarar_recesso | ✅ | ❌ | ✅ sua dupla | ❌ | leitura | ❌ |
| resposta manual de terceiro | ✅ | ❌ | ✅ sua dupla | ❌ | ❌ | ❌ |
| resumo_dupla (tool) | ✅ | ✅ | ✅ sua dupla | ✅ sua dupla | recorte próprio | ❌ |

## Superfícies e rotas

- **`/retro/[token]`** (ou config `retro` dentro de `/resumo/[slug]`) —
  pública: `isPublic` + e2e feliz/inválido + `robots noindex` + aviso
  "link não listado" (molde `resumo/[slug]/page.tsx`).
- **GenUI novo:** kind `disponibilidade` (grade dia × período de
  `disponibilidade`/`celulasComuns`, `ciclo.ts:429-769`) e evolução do
  kind `plano` com ritmo + CTA por passo; bloco `escolha` já resolve
  "1× ou 2× por semana?".
- **Tools novas** entram na allowlist por papel e nos testes de papel
  do registry (`tests` existentes cobrem a matriz).
- **Nenhum canal novo** de IA; WhatsApp segue `wa.me` + `/api/nudge`.

## Paridade demo

- `src/lib/demo/ia.ts`: projetores das tools novas (plano com ritmo,
  remanejo_opcoes, resumo_dupla) + respostas enlatadas coerentes.
- Dataset: dupla encerrada com retrospectiva, dupla com recesso opt-out,
  contatos de terceiros com resposta manual, dupla em atraso p/ plano.
- `/demo` nunca chama provider (decisão vigente) — retrospectiva demo usa
  narrativa fixture do dataset.

## Testes

- **Unit:** sinais de complexidade do import; `montarPlanoEmDia` com
  `ritmo` e `dupla_recessos`; níveis de flexibilização; projetor de
  remanejo compartilhado; recorte de privacidade da retrospectiva por
  audiência (regra de ouro: notas internas nunca no payload do jovem).
- **E2E demo:** retrospectiva pública; plano pela Liza; declaração de
  recesso.
- **E2E app:** RPC `registrar_resposta_terceiro_manual` (papel permitido
  + negado + imutabilidade); rematch pela tool com confirmação;
  retroativo do jovem pela Liza; `/retro/[token]` inválido.
- **Schema:** `pnpm schema:check` em staging antes do merge.

## Observabilidade e erro

- `ia_eventos` em todo caminho de LLM (import `lote`, retrospectiva
  `dupla_id`+audiência, resumo `dupla_id`) com args minimizados — nunca
  conteúdo de documento nem texto livre de registro.
- Falha de provider: import cai no rascunho determinístico com aviso;
  retrospectiva fica sem narrativa (payload determinístico continua
  servindo) — nunca bloqueio fatal.
- Mensagens pt-BR e estados vazios honestos; Sentry nas falhas de RPC.

## Rollout

1. Migrations por história no staging conforme cada implementação.
2. Ordem sugerida: US7 → US1 → US3 → US6 → US4 → US5 → US2 (menor risco
   primeiro; US2 fecha por depender de OG/rota nova).
3. `IA_*` nenhuma env nova; tier `forte` do `ia_config` resolve "modelo
   forte" sem deploy.
4. `[deploy]` só com autorização do Thiago; produção na janela
   `staging → main`.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| Rota pública nova para retrospectiva | card compartilhável sem login é o próprio requisito | publicar dentro de `/resumo` grade — o agregado de ciclo não é por pessoa nem celebrável |
| Materialização de resumo por dupla | Liza hoje recalcula tudo a cada mensagem; contexto consolidado curto é o requisito | resumo sob demanda por tool — custo/latência por mensagem |
