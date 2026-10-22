# Cluster R — planejamento concluído

Cluster R do `_clusters.md`: relatórios, exports & links públicos.
Planejado em cima do código atual (schema até `0105_review_fixes.sql`,
workflows `e2e-app`/`e2e-preview`/`e2e-nightly`, infra sem `pg_cron`/`pg_net`
e `anon` com zero grants — molde `_recon/`).

## Entregas

Todas ABERTAS (nenhuma já entregue; 56 e 68 são **parciais** — o que existe
ficou documentado como evidência e o plano cobre só o delta).

| Issue | Título | Tier | Docs | Esforço |
|---|---|---|---|---|
| REALIZA-183 | `resumo_acessos` — log append-only do `/resumo` | B | README, plan, sdd, sdr, acceptance | S |
| REALIZA-170 | Relatórios públicos com senha (`relatorio_links`) | A | README, plan, sdd, design, sdr, acceptance | M–G |
| REALIZA-182 | `dupla_saude_snapshots` (1/dupla/dia, sem pg_cron) | B | README, plan, sdd, sdr, acceptance | S–M |
| REALIZA-169 | Lembretes prazo trilha esp (15d/7d/vencida) | B | README, plan, sdd, sdr, acceptance | S–M |
| REALIZA-168 | Registro semanal → `RegistroForm` nativo + lembrete | B | README, plan, sdd, sdr, acceptance | M |
| REALIZA-166 | e2e-app no pipeline (push+PR+nightly+required) | B | README, plan, sdd, sdr, acceptance | S–M |
| REALIZA-167 | Parametrização T3 (`relatorio_links`+`turma_inscricoes`) | B | README, plan, sdd, sdr, acceptance | M |
| REALIZA-56 | Hub `/relatorios` — dashboards operacionais | parcial | README, plan, sdd, design, sdr, acceptance | M–G |
| REALIZA-68 | Exports: encontros(alias)+atividades+matching+presenças | parcial | README, plan, acceptance | S–M |
| REALIZA-52 | Score determinístico + narrativa LLM agregada | A | README, plan, sdd, sdr, acceptance | M (+S gated) |

## Decisões tomadas pelo planejador

- **Uma tabela de links só: `relatorio_links`.** Jira 167 chama
  `resumo_links`, Jira 170 chama `relatorio_links` — mesmo artefato ("base
  da 170"). O nome canônico é o da spec mais completa (170); a 167 cria a
  versão mínima (slug+turma+revogação) e a 170 faz `alter table` com
  `senha_hash`/`config`/`expira_em`. `resumo_acessos.slug` fica text
  (sobrevive à exclusão do link — molde `emails_enviados.ref_id`).
- **Scheduler universal = Vercel Cron → `/api/jobs/*` + `CRON_SECRET`.**
  Decisão compartilhada de 182/169/168 (pg_cron não existe; portar
  `saudadeDaDupla` pra PL/pgSQL duplicaria o domínio). Quem mergear primeiro
  cria `vercel.json`+`src/lib/jobs.ts`; os outros reutilizam o esqueleto.
- **Jobs fire-once via ledger com unique natural.** `trilha_lembretes`
  (169) e `registro_lembretes` (168) — mesma forma `(ref, marco)` + advisory
  lock por ref; se mergearem juntos, uma `lembretes_enviados` genérica
  resolve as duas (escolha do implementador).
- **`respostas` não vai pro relatório público em v1 (170).** Texto livre
  sobre menores atrás de senha compartilhada — corte deliberado, reversível
  por `config.tipo` novo depois.
- **Senha mostrada uma vez, gerada no banco** (`crypt`/`gen_salt('bf')` —
  pgcrypto já habilitado 0001); legado T2 nasce `senha_hash=null` (link em
  circulação não quebra) e a UI marca "Sem senha".
- **`tipo=encontros` = alias de `ciclo`** (68) — a prestação de contas já é
  1 linha/encontro; zero código novo de CSV.
- **Score nunca vai pra superfície pública** (52) — coluna interna
  coord-only; `COLUNAS_PUBLICAS`/allowlist da 170 ficam imunes por assert
  de teste.
- **e2e-app contra staging real** (166, decisão do Jira) — modo
  `supabase start` local preservado atrás de `workflow_dispatch
  backend=local`; grupo `e2e-staging` compartilhado com e2e-preview
  serializa os dois (fixtures globais); required check nunca pode
  skipar (secrets ausentes → falha, não skip).

## Ordem de merge recomendada

1. **182** — infra de job + `vercel.json` (ou 169/168, quem sair primeiro
   monta o esqueleto; os outros entram com migration+handler só).
2. **167 → 183 → 170** — `relatorio_links` mínima → `resumo_acessos` →
   a 170 altera as duas (senha/config/`link_id`/`ok`/`motivo`). Cada uma é
   executável sozinha com fallbacks documentados (`create table if not
   exists` compatíveis entre 183↔170).
3. **169, 168** — independentes entre si; ambas sobem na infra do passo 1.
4. **56** — depois de 182 (a tendência do semáforo é o único bloco que
   depende; sem ela o card degrada gracioso) e idealmente depois de 167
   (filtro por turma).
5. **68** — independente; a coluna `fila_turmas` de `matching` espera 167.
6. **52** — metade 1 independente; metade 2 espera **178** (provider) +
   182 (tendência opcional) + decisão jurídica.
7. **166** — independente de tudo (infra de CI; quanto antes melhor —
   protege todos os merges acima).

## BLOCKERs abertos (pra Thiago)

1. **52 — jurídico do provider LLM:** o termo atual cobre envio de
   **agregados sem PII** a provider externo de IA? A proposta do plano de
   inteligência (:129) diz "agregados por default" — precisa da
   confirmação antes de ligar `IA_NARRATIVA_ENABLED` (flag existe pra isso;
   a metade 2 inteira fica off sem a resposta). Texto livre de/sobre menor
   fora desta issue em qualquer cenário.
2. **166 — required check é passo manual:** marcar `e2e-app / e2e` em
   Settings → Branches → `main` (o YAML não configura branch protection).
3. **168 — canal token-anônimo pro mentor:** só se a coord reportar que
   mentores não entram na plataforma; v1 é logado + deep-link (reabriria
   `guard_autoria` por RPC — escopo cirúrgico da 0082).
4. **167 — UI de gestão de inscrições:** v1 via SQL/coord (policies já
   permitem); se quiser UI já, avaliar no PR (ficha da pessoa é o lugar).
5. **182/169/168 — tier Vercel × nº de crons:** se o plano limitar a 1
   cron/dia e já houver outro, escolher entre consolidar num handler só
   (`/api/jobs/tick` que chama as 3 RPCs) ou subir tier — decidir quando o
   primeiro job for pro ar.

## Verificações pendentes na implementação (registradas nos planos)

- Nºs de migration: os docs usam `0106`-`0110` **indicativos** — a última é
  `0105_review_fixes.sql`; 183/170/167/182 competem por 0106-0107 — ordenar
  no merge (todos idempotentes).
- `sinais[].texto`/`detalhe` do `saudadeDaDupla` pode citar nomes?
  Verificar no PR da 182; se citar, snapshot persiste só `{tipo,tom}`.
- `ciclo_eventos.cronograma_id`/`turma` existem? (filtro do `presencas` na
  68 e escopo do digest na 56 — `information_schema` antes do PR).
- Vocabulario real de `mentorados.situacao` (filtro do `matching` na 68).
- Trilha esp no lembrete de registro (168): incluída por default — confirmar
  se `salvarRegistro`/`saudadeDaDupla` tratam o registro de esp igual.
- `href` com `#` no sino (168/169): `router.push` preserva fragmento?
  Verificar o click handler do componente de notificações.
- `resumo_acessos` + 183: o salt `RESUMO_ACESSO_SALT` precisa ir pra Vercel
  (prod+preview) antes do deploy — fallback constante funciona mas salt
  público enfraquece o pseudônimo.

## Como o conjunto se ancora no repo

- **Superfícies públicas** (`/resumo`, RPCs definer): sempre sobre o gate
  `anon` zero-grants da 0032 — nenhum plano cria grant de tabela pra anon;
  tudo passa por RPC `security definer` ou admin server-side.
- **Dado de menor:** allowlist por tipo no SQL da 170; `*_pessoal`/
  `dados_civis`/`form_bruto`/evidências de assinatura nunca saem do banco
  no público; contato opt-in (`expor_contato`) com aviso na UI.
- **Domínio puro em `src/lib/`** (score, narrativa, dash, fila) com Vitest —
  o semáforo é fonte única, nunca recopiado.
- **Auditoria append-only** (`resumo_acessos`, `ia_eventos`, `interacoes`)
  — nenhum plano cria update/delete nelas.
