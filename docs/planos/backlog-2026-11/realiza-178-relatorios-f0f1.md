# REALIZA-178 — Relatórios fase 0+1: exports operacionais, hub /relatorios e digest semanal

Issue: `relatorios`,`coordenacao`,`export`,`email`. Fonte: `docs/planos/relatorios-inteligencia.md` (doc-mestre — esta spec é só o recorte implementável das fases 0 e 1) + `docs/planos/issues/REALIZA-178/{README,sdd,sdr}.md`. Status: a fazer.

## O que exige vs. o que existe

**Os dois buracos de dados da doc-mestre já estão fechados no staging** — esta spec não os re-especifica, só os declara dependência satisfeita:

- **`dupla_saude_snapshots`** (REALIZA-182, migration `0107_dupla_saude_snapshots.sql`): tabela `unique(dupla_id, dia)` com `semaforo`, `motivos`/`sinais` jsonb (contagens e labels de enum, sem nome de pessoa), `esperado`, `feitos`, `registro_pendente`, `pediu_apoio`, `apoio_jovem`, `avaliacao_jovem_pendente`, `fonte` (`cron|lazy|backfill`), `computado_em`. Escrita por UMA porta: RPC `gravar_saude_snapshots` security definer (0107:74) — sem grant/policy de escrita pra authenticated; leitura coord tudo, supervisor as duplas que supervisiona (0107:58). Cálculo fica em TS: `rodarSaudeSnapshots` roda no tick diário 03h BRT (`src/lib/jobs.ts:182`, `vercel.json` cron `0 6 * * *` → `/api/jobs/tick`), `snapshotDuplaHoje` é fire-and-forget nos writes quentes (`src/lib/jobs.ts:249` — chamado em `actions.ts:3593`, `actions.ts:3888`, `actions-avaliacao.ts:305`, `actions-encerramento.ts:228,363`). Upsert idempotente — o último cálculo do dia ganha.
- **`encontro_remarcacoes`** (REALIZA-341, migration `0153_encontro_remarcacoes.sql`): trigger `encontros_remarcacao_log` AFTER UPDATE OF `data_hora` grava `data_anterior`→`data_nova` + `motivo` + `created_by` — sem escrita por usuário (histórico é fato). Leitura no escopo de `encontros`; embed na `DUPLA_SELECT` (`queries.ts:401`); helpers `contagemRemarcacoes`/`remarcacoesDoMes` (`src/lib/remarcacoes.ts:18,33`); cobertura demo (ids 70xx, `demo/data.ts:158,2261`).

**Base já paga que esta frente consome:**

- `/api/export` (`src/app/api/export/route.ts`): 4 tipos vivos — `ciclo` (default, uma linha/encontro, `:504`), `pessoas` (`:210`), `assinaturas` (`:288`), `respostas&id=<form>` (`:362`). Convenção consolidada: `;` + BOM `\uFEFF` + tudo entre aspas + `celula()` anti formula-injection (`:836`), CRLF, filename datado, gate coord-only (`:137`), paridade demo (`:36-117`), `?turma=`/`?cronograma=` via `filtraCsvCiclo` (`:193` — casa pelo rótulo vivo `turmaDaDupla`).
- `/relatorios` (`src/app/(app)/relatorios/page.tsx`): página existe, coord-only (`:27`), mas é o **builder livre** (`RelatorioBuilder` + `RelatorioCanvas` + links públicos `relatorio_links` 0110 via `RelatorioLinksMenu`) — não o hub de seções da doc-mestre.
- Jobs: **UM cron só** (plano Hobby) → `/api/jobs/tick` com registry `JOBS: Record<string, (ctx) => Promise<JobResult>>` — o comentário da route já reserva vaga ("digest 178 se registra no JOBS"). Bearer `CRON_SECRET` via `autorizarCron` (`jobs.ts:54`); `/api/jobs/*` pública no middleware (`middleware.ts:79`) — cron nunca vê redirect.
- E-mail: `enviarEmailsIndividuais`/`enviarEmailsLote` (Resend batch permissivo, `src/lib/email.ts:64,132`), log `emails_enviados` (0056; CHECK de tipo hoje com 7 valores — última escrita em 0180), `emailLayout` (`email-templates.ts:51`), kill-switch `EMAIL_ENVIO_LIBERADO` (`email.ts:58`).
- Motores: `resumoSemana`/`resumoSemanaDe` (`ciclo.ts:1163,1217`), `textoResumoSemana` (`:1338`), `saudadeDaDupla` (`:1356`), `saudeDoRecorte` (`agenda-coordenacao.ts:991`), `encontroEsperado` (`:1028`), `diasAtrasoRegistro` (`:2157`), `registroTardio` (`:2144`), `dadosResumoJornada` (`encerramento.ts:121`), `getAssinaturasResumo` (`queries-assinaturas.ts:95`), `primeiroNomeDaDupla` (`agenda-minha.ts:234`).

**Duas mudanças de contexto desde a doc-mestre (corrigem o catálogo):**

- `supervisoes` foi **dropada** (0155, REALIZA-313) — o tipo `supervisoes` sai do catálogo; o sinal "a coordenação agiu/cobriu" é coberto por `interacoes`.
- `presencas` entra no catálogo da **REALIZA-68** (spec irmã `realiza-68-exports-csv.md`) — dono único do tipo; aqui só o botão/preview quando ela existir.

**Falta neste recorte:** 6 `tipo=` novos, as seções do hub e o digest semanal.

## Decisões

1. **Ordem de entrega: exports → digest → seções do hub.** Exports são P por tipo num padrão já pago (gate + demo + CSV helpers) e destravam a planilha de prestação de contas na hora. O digest é o primeiro valor "automático" e não depende de UI. O hub fica por último de propósito: a tendência do semáforo só fica útil com ~2+ semanas de `dupla_saude_snapshots` acumulados — esperar fecha o ciclo de valor em vez de estrear seção vazia. (Diverge da ordem do sdd antigo, que punha o hub antes do digest — o argumento da tendência inverte.)
2. **`presencas` é da REALIZA-68** — mesmo padrão, spec única; o hub referencia o tipo quando existir, sem implementá-lo aqui.
3. **Digest roda dentro do tick diário** — `JOBS["digest_semanal"] = rodarDigestSemanal`, com guard de dia-da-semana **dentro** do job (segunda = envia; outros dias `{ ok: true, pulado: true }`). Não abre cron próprio nem rota nova — a convenção consolidada de `jobs.ts`/tick manda; o sdd antigo previa `/api/jobs/digest-semanal` + 2º cron no `vercel.json`, padrão que o repo já superou (custo: Hobby permite poucos schedules).
4. **Dedup do digest via `emails_enviados`** — `tipo='digest'` exige migration do CHECK (0188). A trava conta só rows com `enviados > 0` na semana corrente: tick que rodou com o envio desligado (`EMAIL_ENVIO_LIBERADO=false` ou sem `RESEND_API_KEY`) não bloqueia o envio real quando a flag ligar. `autor_id` é nullable (0056:9) → `null` no cron.
5. **Estrutura `src/lib/relatorios/`** [NOVO dir]: `dados.ts` (fetchers server-side por tipo — servem a rota de export E os previews do hub) + `csv.ts` (funções `csvX` puras) + `digest.ts` (`montarDigestSemanal`). Os helpers `celula`/`csvResponse`/`dataHora`/`dia`/`nomeCsv*` saem de `route.ts` pra `csv-core.ts` compartilhado — a -68 segue o mesmo padrão se aterrissar depois; se ela já tiver mergeado, seus `csvX` migram junto (consolidação única, não dois padrões).
6. **Hub com abas por URL** — `?aba=` (convenção do repo: `/agenda`, `/materiais`), não `?secao=` como o sdd antigo dizia. O builder atual vira a aba "Grade livre" **inalterado**; seções novas são server components com preview read-only (~8 linhas) + "Baixar CSV completo" apontando pro `tipo=`.
7. **Conteúdo do digest: primeiro nome só** — mentorado como `primeiroNomeDaDupla` + motivo do semáforo (labels de enum/contagens), nunca texto livre, contato ou `dados_civis`. Detalhe completo fica no link autenticado `/relatorios`. Destinatários: coordenação (papel efetivo via `profile_papeis`, e-mail via `profiles_contato` — mesmo molde do `dispararParaRoles`, `actions-email.ts:87-108`). Supervisor com recorte próprio fica pra spec futura.
8. **`montarDigestSemanal` é função única** compartilhada pelo job do tick e pela action manual `enviarDigestSemanal()` (botão na tela — o coord dispara na hora; `autor_id` = o coord quando manual).
9. **LGPD do e-mail digest** — nomes de menores na caixa de entrada é o trade-off aceito na doc-mestre: corpo leva primeiro nome + motivo agregado; nunca sobrenome, nunca texto livre. Alternativa rejeitada: só números + link (perde "quem precisa de você", que é o valor do digest).
10. **Fase 2 (narrativa LLM, NLP sobre texto livre, score composto, matching LLM) não entra** — são specs próprias futuras; a única preparação aqui é não fechar portas (ver Fora de escopo).

## Schema — migration `0188_emails_digest.sql`

- `drop constraint emails_enviados_tipo_check` + `add constraint` com o conjunto vivo **+ `'digest'`**. Conjunto declarado por último em `0180_convite_tipo_email.sql:16` (`comunicado, material, assinatura, apoio_jovem, chamado, instrumento, convite`) — **conferir `pg_get_constraintdef` no alvo antes de redigir** (regra do repo: nunca DDL de memória; se um oitavo tipo entrou depois, ele fica na lista).
- Sem tabela nova, sem RLS nova (policies coord-only da 0056 cobrem), `autor_id` segue nullable.
- Blast radius: zero — CHECK só valida insert; o job grava via admin client (RLS-bypass), a action manual via JWT do coord (policy `emails_enviados_insert` já permite).

## Domínio (`src/lib/`)

- `src/lib/relatorios/csv-core.ts` [NOVO] — extrai de `route.ts`: `celula`, `csvResponse`, `dataHora`, `dia`, `fmtData/fmtHora`, `nomeCsv*` e o `filtraCsvCiclo` (renomeado `filtraPorRecorte`, mesma assinatura: `?turma=`/`?cronograma=`). `route.ts` importa — os 4 tipos atuais não mudam de comportamento.
- `src/lib/relatorios/dados.ts` [NOVO] — um fetcher por tipo, assinatura `{ turma?: string; cronogramaId?: string }` aplicada no filtro por `duplas`/`cronogramas`. Client da sessão (RLS escopa; coord lê tudo).
- `src/lib/relatorios/csv.ts` [NOVO] — `csvAderencia`, `csvAssinaturasPendentes`, `csvInteracoes`, `csvSolicitacoes`, `csvEncerramento`, `csvFormsTaxa` — puras, recebem as linhas resolvidas, devolvem o CSV completo (BOM+header+linhas).
- `src/app/api/export/route.ts` — +6 ramos no dispatch real e +6 no ramo demo; header comment da rota atualizado com o catálogo.

**Contrato por tipo** (grão + fonte verificada):

| `tipo=` | Grão | Colunas-chave | Fonte |
|---|---|---|---|
| `aderencia` | 1 linha/dupla | turma, cronograma, trilha, mentor, mentorado, esperados, realizados, aderência %, atraso médio de registro (dias), avaliação média, remarcações (n), semáforo, motivos | `encontroEsperado` (ciclo.ts:1028), `diasAtrasoRegistro` (:2157), `PESO_AVALIACAO` (encerramento.ts:57), `saudadeDaDupla` (:1356), `contagemRemarcacoes` (remarcacoes.ts:18), `encontros.origem` |
| `assinaturas-pendentes` | 1 linha/(pessoa × documento pendente) — anti-join | nome, papel, documento, status (pendente/expirado), emitido_em, expira_em | `getAssinaturasResumo` (queries-assinaturas.ts:95) × `documento_templates`; expirado = `token_expira_em < hoje` + status pendente |
| `interacoes` | 1 linha/interação | dupla (mentor×mentorado), tipo, canal, autor, data, nota | `interacoes` (0008; tipos `nudge|contato|apoio|vinculo_resposta`, canais incl. `in_app` 0094 — ler CHECK vivo) |
| `solicitacoes` | 1 linha/solicitação de especialista | mentorado, demanda, origem, status, criada_em, respondida_em, latência (dias), especialista | `solicitacoes_especialista` (0027/0074 — `respondida_em` é a medida de latência) |
| `encerramento` | 1 linha/dupla com encerramento | mentor, mentorado, tipo, checklist feito/total, decidido_por, resumo_jornada (sim/não), created_at | `encerramentos` (0037; `checklist` jsonb, `tipo` com 'pendente' da 0156) |
| `forms-taxa` | 1 linha/link de formulário | formulário, destinatário, papel, dupla, origem, emitido_em, respondido (sim/não), respondido_em | `formulario_links` (`usado_em`, `multi_uso`, `origem`) + `formularios.titulo`; a taxa é derivável do respondido |

- `src/lib/relatorios/digest.ts` [NOVO] — `montarDigestSemanal(supabaseAdmin, semana)`: `resumoSemana`/`resumoSemanaDe` por cronograma + `saudadeDaDupla` por dupla ativa (risco+motivo) + pendentes (registros em limbo via `emLimbo`, assinaturas vencendo ≤14d, presenças de formação da semana) → `{ assunto, mensagens: [{to,subject,html}], nRisco, nPendentes }`. HTML via `emailLayout`; CTA `${SITE_URL}/relatorios`.
- `src/lib/jobs-digest.ts` [NOVO, ao lado de `jobs-lembretes-*`] — `rodarDigestSemanal(ctx: JobContext): Promise<JobResult>`: guard `diaDaSemana(ctx.hoje) === segunda` → senão `{ok:true, pulado:true}`; dedup `emails_enviados tipo='digest' AND enviados>0 AND created_at >= início da semana` → `{ok:true, pulado:"já enviado"}`; monta, envia via `enviarEmailsIndividuais`, **sempre** grava a row de log (com `enviados:0`+`falhas` quando desligado — é a auditoria de que o tick rodou); `JOBS["digest_semanal"]` registrado no tick.
- `src/lib/actions-email.ts` — `enviarDigestSemanal()`: action coord-only que chama a mesma `montarDigestSemanal`, grava log com `autor_id` do coord, devolve `{ok}`/`{error}` (nunca lança). Não respeita dedup — disparo manual é intencional e o log deixa claro.
- Sem `dispararParaRoles`: o `tipo` dele é fechado em `"comunicado"|"material"` e o digest precisa de mensagens individuais (o corpo pode variar por papel no futuro) — chama `enviarEmailsIndividuais` + insert direto, mesmo padrão dos envios de instrumento (`actions-email.ts:557`).

## UI

- **`/relatorios` vira hub por abas** (`?aba=`, `Link` + `role=tablist` + setas/Home/End, rolagem horizontal no mobile — padrão AGENTS). Abas: `saude` (default), `aderencia`, `pendencias`, `operacao`, `encerramento`, `grade` (builder atual inalterado). Deep-link `?aba=` inválido cai no default sem quebrar (mesma regra do `?turma=` da página).
- Cada aba nova = server component: cards de destaque + preview `RelatorioCanvas` read-only com `linhas.slice(0,8)` + contador "+N linhas no CSV" + `Button` "Baixar CSV completo" (`<a href>` pro `/api/export?tipo=` com o recorte atual).
- **Saúde do ciclo**: `SaudePrograma`/`saudeDoRecorte` do recorte + tendência dos `dupla_saude_snapshots` agregados por dia (mini-tabela/bars em CSS — sem lib de charts, padrão do app). Feature-detect honesta não é mais necessária (tabela existe desde 0107); estado vazio ("histórico ainda acumulando") quando <7 dias de rows.
- Filtro turma/cronograma do hub: chips `filterChipCls` por turma (mesma barra de /duplas) — um recorte vale pra todas as abas e vai na URL (`?turma=` já existente).
- Copy pt-BR, hierarquia do AGENTS (`PageHeader` já ok), sem travessão, "já realizaram/aguardando" nos números.
- `/demo`: a página já é demo-aware; as abas novas leem o dataset demo (interacoes 28xx, solicitacoes 24xx, assinaturas 32xx, encerramentos em `demo/encerramento-data.ts`, forms via `getDemoFormularios`). O digest não roda em demo (é job, não UI) — sem paridade necessária; a action manual responde `DEMO_MSG` como as demais.

## Seed + demo

- Ramo demo por tipo novo no `route.ts` — dataset já cobre as entidades (`demo/data.ts`: interacoes :3188, solicitacoes :1725, assinaturas :3520, remarcacoes :2261; `demo/encerramento-data.ts`; `demo/forms-data.ts` links+respostas).
- Sem seed novo: nada de dado de domínio precisa mudar (snapshots/remarcações já semeiam sozinhos no uso real).

## Testes

- **vitest**: `csvX` puras (molde dos tests de `relatorio.test.ts`/`importar-registros.test.ts` — BOM, `;`, quoting, anti-fórmula em `motivo`/`nota`, datas dd/mm/aaaa, ordenação pt-BR); `filtraPorRecorte` por turma/cronograma; `montarDigestSemanal` com universo fake (dedup `enviados>0` vs row `enviados:0`, guard de segunda, conteúdo sem texto livre — assert que `reflexoes`/`observacoes` não aparecem no HTML); `csvFormsTaxa` com link multi_uso (N respostas por link).
- **e2e** (`tests/e2e/app`): spec `export` — cada tipo novo → 200 `text/csv` + BOM + header esperado + `?turma=` recorta; mentor/supervisor → 403; hub renderiza abas e preview; botão CSV aponta pro tipo certo. Digest: cobrir por vitest (cron sem sessão não é exercitável no e2e; disparo manual da action sim — spec mínimo de happy path + gate demo).

## Critérios de aceite

- [ ] `GET /api/export?tipo=<aderencia|assinaturas-pendentes|interacoes|solicitacoes|encerramento|forms-taxa>` → 200 `text/csv`, BOM, `;`, CRLF, filename `<tipo>-AAAA-MM-DD.csv`, todas as células por `celula()`.
- [ ] `?turma=`/`?cronograma=` recortam os 6 tipos (mesma regra `turmaDaDupla` do `ciclo`).
- [ ] `tipo=aderencia`: esperados/realizados batem com `encontroEsperado` e o semáforo+motivo com `saudadeDaDupla` ao vivo (zero lógica nova de semáforo — reusa, não reimplementa).
- [ ] `tipo=interacoes`: `nota` com `=`/`+`/`-`/`@` inicial sai escapada (anti-fórmula); tipos do CHECK vivo cobertos (`vinculo_resposta` incluso).
- [ ] `tipo=forms-taxa`: link `multi_uso` conta N respostas; link não respondido sai com `respondido=não` (a taxa é derivável).
- [ ] `tipo=assinaturas-pendentes`: anti-join devolve só pendências (documento × pessoa sem `assinado_em`), incluindo expirados (`token_expira_em < hoje` + status pendente).
- [ ] Coord-only inalterado nos 6 tipos (mesmo gate `:137`); paridade demo: `/demo` como coord devolve CSV real por tipo.
- [ ] `/relatorios` tem navegação por abas `?aba=`; aba inválida cai no default; a aba "Grade livre" é o builder atual sem mudança de comportamento (link público `relatorio_links` segue funcionando).
- [ ] Cada aba nova mostra preview ≤8 linhas + "Baixar CSV completo" que baixa o mesmo recorte (turma) exibido.
- [ ] Seção Saúde mostra tendência dos snapshots quando ≥7 dias de `dupla_saude_snapshots`; com menos, mostra o estado "acumulando" sem erro.
- [ ] `rodarDigestSemanal`: em não-segunda → `{ok:true, pulado:true}` sem envio nem log de disparo; em segunda → envia e grava `emails_enviados tipo='digest'`; rerun na mesma semana com `enviados>0` → dedup `{pulado}`; com `enviados=0` (envio desligado) → nova tentativa legítima.
- [ ] Digest por e-mail: corpo com primeiro nome de mentorado + motivo do semáforo; assert automatizado de ausência de `reflexoes`/`observacoes`/whatsapp/sobrenome no HTML; CTA autenticado pra `/relatorios`.
- [ ] `enviarDigestSemanal()` manual: coord dispara, grava `autor_id`, ignora dedup; não-coord → `{error}`; demo → `DEMO_MSG`.
- [ ] Migration 0188 aplicada em staging antes do e2e-preview (ordem do AGENTS); `database.types.ts` regen não muda (CHECK não vira type).
- [ ] `JOBS["digest_semanal"]` registrado; `/api/jobs/tick` responde com o resultado do job; `?job=digest_semanal` dispara só ele.
- [ ] `tsc --noEmit` + `eslint src/` limpos.

## Fora de escopo

- **Fase 2 da doc-mestre (specs futuras próprias):** narrativa LLM do ciclo sobre agregados (precisa de `ia_eventos.canal` estendido + provider — a spec -180 cobre a extensão de canal pra `importacao`; `narrativa` entra quando essa fase virar spec), resumo de jornada em prosa, score de risco composto, assistente de matching LLM.
- **Fase 3:** NLP sobre texto livre de registros (gate legal LGPD), análise cross-ciclo de coortes, perguntas em NL.
- `tipo=presencas` (dono: REALIZA-68), `tipo=supervisoes` (morto — 0155), `tipo=encontros/atividades/matching` (idem -68).
- Snapshots e histórico de remarcações — **já entregues** (0107/REALIZA-182, 0153/REALIZA-341); aqui só consumo (tendência no hub, contagem em `aderencia`).
- PDF oficial de relatório de ciclo / ficha arquivada (renderer `Fluxo` existe mas é fase posterior), materialized views/agregação no Postgres (prematuro — doc-mestre §d), digest com recorte de supervisor, arquivamento no Drive.
