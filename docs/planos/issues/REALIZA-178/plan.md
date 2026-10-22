# REALIZA-178 — plan.md

Implementação em 4 PRs, cada um verde por si. Tudo em pt-BR na UI. Convenções
duras: função pura testável em `src/lib/`, fetch separado, route/action fina;
exports seguem o padrão `;`+BOM+aspas+`celula()` de `src/app/api/export/route.ts`.

---

## PR 1 — novos tipos de export (`/api/export`)

### Arquivos novos

- `src/lib/relatorios/dados.ts` — fetchers server-side (recebem o client da
  sessão — coord-only já garantido pelo gate da rota) que devolvem linhas
  prontas pro `csv*`. Um fetcher por tipo. Filtros `turma`/`cronograma_id`
  aplicados no nível `duplas`, igual `filtraCsvCiclo` (`route.ts:183-191`).
- `src/lib/relatorios/csv.ts` — funções puras `csvAderencia`,
  `csvPresencas`, `csvSupervisoes`, `csvInteracoes`, `csvSolicitacoes`,
  `csvEncerramento`, `csvFormsTaxa`, `csvAssinaturasPendentes`, cada uma
  `(linhas: T[]) => string` reexportando/reusando `celula` e o header com
  BOM (extrair `celula`/`csvResponse`/`nomeCsv*` de `route.ts` pra
  `src/lib/relatorios/csv-core.ts` e importar dos dois lados — **sem
  duplicar**).
- `tests/relatorios-csv.test.ts` — Vitest das 8 funções puras com fixtures
  de `tests/helpers.ts`.

### Tipos e fontes (todas as fontes existem — paths reais)

| `tipo=` | Fonte | Linhas por |
|---|---|---|
| `aderencia` | `duplas`+`encontros`+`registros`+`ciclo_eventos`; `encontroEsperado` (`ciclo.ts:948`), `diasAtrasoRegistro` (`:2005`), `saudadeDaDupla` (`:1245`) | dupla |
| `presencas` | `presencas`×`ciclo_eventos(tipo='formacao')`×`profiles`; `mentor_profiles.formacao_ok` | profile×evento |
| `supervisoes` | `supervisoes` + nomes (mentor, supervisor, dupla opcional) | supervisão |
| `interacoes` | `interacoes` + dupla/autor | interação |
| `solicitacoes` | `solicitacoes_especialista` (+ latência `created_at→respondida_em`) | solicitação |
| `encerramento` | `encerramentos`×`duplas` (checklist jsonb explodido em colunas bool, `tipo`, `disponivel_proximo_ciclo`) | dupla |
| `forms-taxa` | `formularios`×`formulario_links` (emitidos×`usado_em`) por formulário | formulário |
| `assinaturas-pendentes` | anti-join `profiles`/`mentorados` × `assinaturas` por `documento_templates.slug` + links `pendente`/`expirado` | pessoa×documento |

### Mudanças em `src/app/api/export/route.ts`

- Registrar os 8 ramos no dispatcher (hoje `tipo` cai no default `ciclo`,
  `:152-178`). Ordem dos `if` antes do fallback.
- Cada ramo chama `dados*` + `csv*` + `csvResponse` — a rota continua fina.
- **Paridade demo**: cada tipo novo precisa de ramo no bloco `if (demo)`
  (`:36-109`) com o dataset de `getDemoData()` — o dataset já cobre
  presenças, supervisões, interações, solicitações, encerramentos,
  formularios/links e assinaturas (`src/lib/demo/data.ts`). Tipo sem dados
  demo retorna CSV só com header (honesto, não erro).
- Nomes de arquivo: `relatorio-<tipo>-<turma|todas>-<yyyy-mm-dd>.csv`
  (padrão `nomeCsvCiclo` etc.).

### Validação PR 1

`pnpm test` (novos `relatorios-csv` verdes) + `tsc` + `eslint` + smoke
manual: `GET /api/export?tipo=aderencia&turma=T2 · 2026/2027` com sessão
coord → CSV; com mentor → 403.

---

## PR 2 — hub `/relatorios` com seções

### Estrutura

`src/app/(app)/relatorios/page.tsx` vira o hub: `PageHeader` + barra de
filtros (turma/cronograma — `Select` existente) + nav de seções (chips —
`filterChipCls`, padrão de `/duplas`) + seção ativa.

```
/relatorios                 → saúde do ciclo (default)
/relatorios?secao=aderencia
/relatorios?secao=pendencias
/relatorios?secao=operacao
/relatorios?secao=encerramento
/relatorios?secao=grade     → o RelatorioBuilder atual, intacto
```

- `src/app/(app)/relatorios/secoes/*.tsx` — um server component por seção:
  busca os agregados (mesmos fetchers de `dados.ts` do PR 1 + semáforo
  via `saudadeDaDupla`), renderiza preview de ~8 linhas + card de
  destaques + `<a href="/api/export?tipo=…">` "Baixar CSV completo".
- Seção "Saúde do ciclo": distribuição ok/atenção/risco no recorte +
  top-N duplas por severidade (mesma ordenação de `resumo_semana` em
  `tools.ts`) + tendência **se `dupla_saude_snapshots` existir** (dep 182 —
  leitura coord via policy; enquanto não existir, a seção omite o bloco de
  tendência: feature-detect por try/catch no fetch, sem tabela declarada
  no código antes da migration — **schema-contract quebraria se
  `database.types.ts` declarar a tabela antes de aplicada**).
- Loading: `loading.tsx` da rota já existe; cada seção fetch na própria
  página (sem Suspense granular na fase 1 — ~500 encontros é trivial).
- Demo: seções leem `demoDuplas("coordenacao")` + dataset (mesma técnica
  do `page.tsx` atual); export demo já coberto no PR 1.
- Detalhe visual de cada dashboard é da **REALIZA-56** (cluster R) — aqui
  entra a espinha funcional; 56 itera o design em cima.

## PR 3 — digest semanal + tick agendado

### Infra nova (primeiro agendamento do repo — não existe cron nem vercel.json)

- `vercel.json` [NOVO — ou editar se a 182 já criou]: o `crons` é um
  array compartilhado — a 182 planeja `{path:"/api/jobs/saude-snapshots",
  schedule:"0 6 * * *"}`; a 178 adiciona
  `{ "path": "/api/jobs/digest-semanal", "schedule": "0 12 * * 1" }`
  (segunda 09:00 BRT ≈ 12:00 UTC; Vercel agenda em UTC). Confirmar o
  limite de crons do plano Vercel (Hobby restringe quantidade/frequência —
  a 182 já levantou; semanal + diário cabe no padrão).
- `CRON_SECRET` env nova (Vercel injeta `Authorization: Bearer` nas
  chamadas cron configuradas via `crons`) — a 182 usa o mesmo mecanismo;
  um único secret serve os dois jobs.
- `src/app/api/jobs/digest-semanal/route.ts` [NOVO]:
  1. `const auth = request.headers.get("authorization")` → `!== Bearer
     process.env.CRON_SECRET` → 401. Rota **precisa estar na lista
     pública do `updateSession`** (`src/lib/supabase/middleware.ts:51-74`
     — adicionar `p.startsWith("/api/jobs/")`), senão o proxy redireciona
     pra `/login`.
  2. `const supabase = createAdminClient()` (`src/lib/supabase/admin.ts`).
  3. **Snapshots ficam fora desta rota** — a escrita diária é o job
     `/api/jobs/saude-snapshots` da 182 (cron próprio `0 6 * * *`,
     upsert por `(dupla_id,dia)`). O digest lê o que existir; não
     depende.
  4. **Digest**: busca duplas vivas + ciclo_eventos → `resumoSemana` +
     `saudadeDaDupla` por dupla + `textoResumoSemana` (`ciclo.ts:1227`)
     enriquecido com: duplas em risco (nome+motivo — primeiro nome do
     mentorado, ver sdr), registros pendentes, presenças de formação da
     semana, assinaturas vencendo em ≤14d. Monta HTML via `emailLayout`
     (`src/lib/email-templates.ts`).
  5. Destinatários: profiles com papel `coordenacao` ativos (view
     `profiles_contato`); envio via `enviarEmailsIndividuais` (já respeita
     `EMAIL_ENVIO_LIBERADO`) + log em `emails_enviados` (tipo — ver
     observação abaixo).
  6. Responde `{ ok, enviados, destinatarios, skipt? }` pro log ficar
     visível no painel Cron da Vercel.
- **`emails_enviados.tipo`** é CHECK fechado
  `('comunicado','material','assinatura','apoio_jovem','chamado')`
  (0084:1054). Digest precisa de tipo novo → **migration [NOVO]
  `0107_emails_digest.sql`**: `alter table emails_enviados drop constraint
  … check … add check (tipo in (…, 'digest'))`. Sem migration, usar
  `tipo='comunicado'` como fallback anotado — **decisão**: prefira a
  migration (1 linha de CHECK, baixo risco).
- Dedup/idempotência: sem coluna nova — o log `emails_enviados` é a
  fonte: o job retorna `skipt` se já existe row `tipo='digest'` com
  **`enviados > 0`** e `created_at >=` início da semana corrente (row com
  `enviados=0` = tick rodou com envio desligado, não conta — ver sdd §4).
- **`IA_*`/env:** `CRON_SECRET` (prod+preview), sem segredos novos além
  disso.

### UI mínima do digest no app (mesma PR)

- Botão "Enviar resumo da semana agora" na seção Saúde (coord): server
  action `enviarDigestSemanal()` em `src/lib/actions-email.ts` que reusa o
  mesmo builder do tick (extrair `montarDigestSemanal(supabase)` em
  `src/lib/relatorios/digest.ts` — o cron e a action chamam a mesma
  função). Retorna `{ok, enviados}`/`{error}` no padrão.

## PR 4 — narrativa LLM em agregados (gated)

- `src/lib/relatorios/narrativa.ts`: `agregadosDoCiclo(supabase)` → objeto
  com contagens/percentuais (duplas por status/trilha/turma, aderência
  média, avaliações médias por enum, distribuição de dificuldade, presença
  %, solicitações por status, encerramentos). **Nenhum nome, nenhum texto
  livre — revisão por type-level: o tipo `AgregadosCiclo` não tem campo
  `string` livre que receba dado pessoal.**
- Botão "Gerar narrativa do ciclo" (seção Saúde) → server action
  `gerarNarrativaCiclo()` (coord-only, retorna `{error}`/`{ok, texto}`):
  gate `process.env.IA_NARRATIVA_OK === "1"` + provider configurado;
  chama `chamarModelo` de `src/lib/ia/provider.ts` (entrega da 179 —
  contrato definido no sdd da 179); grava `ia_eventos` via
  `registrar_ia_evento` (`tool='narrativa_ciclo'`, `canal='narrativa'`);
  exibe prosa + rodapé "gerado por IA sobre números agregados — confira".
- **Migration [NOVO] `0108_ia_canais.sql`**: estende `ia_eventos.canal` e
  a validação de `registrar_ia_evento` pro superset
  `('chat','mcp','narrativa','importacao')` — idempotente
  (`drop constraint if exists` + `create or replace`), igual ao que a
  REALIZA-180 carrega; convergem pro mesmo conjunto final independente da
  ordem de apply.

## Questões em aberto

- `BLOCKER`: provider com DPA/retenção zero (compartilhado com 179/180).
- `a verificar`: Ignored Build Step do projeto Vercel convive com
  `vercel.json` no repo (o `crons` não é afetado, mas confirmar).
- Se 182 atrasar: nada muda no digest — a única peça afetada é o bloco
  "Tendência" do hub (feature-detect).

## Rollback

- PRs isolados por rota: exports são `tipo=` novos (desligar = remover o
  botão da UI; a rota fica), hub é página, cron desliga removendo o
  `crons` do `vercel.json` ou a env `CRON_SECRET`, narrativa desliga com
  `IA_NARRATIVA_OK` unset. Nada aqui reverte migration — 0107/0108 são
  additive-only (CHECK mais largo).
