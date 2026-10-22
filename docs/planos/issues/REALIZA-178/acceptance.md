# REALIZA-178 — acceptance.md

Critérios executáveis por QA. "Logado" = sessão real (staging); "demo" =
cookie `demo_role=coordenacao`.

## Exports (`/api/export`)

- [ ] `GET /api/export?tipo=aderencia` (coord) → 200 `text/csv`, filename
  `relatorio-aderencia-<turma|todas>-<data>.csv`, BOM, `;`, células com
  aspas; colunas: turma, trilha, mentor, mentorado, esperados, realizados,
  atraso médio registro, avaliação média, semáforo, motivos.
- [ ] Idem `presencas`, `supervisoes`, `interacoes`, `solicitacoes`,
  `encerramento`, `forms-taxa`, `assinaturas-pendentes`.
- [ ] `?turma=T2 · 2026/2027` filtra as linhas de todos os tipos novos
  (mesmo recorte do `ciclo`).
- [ ] Mentor/supervisor/mentorado → **403**; sem sessão → **401** (gate
  existente — conferir que os ramos novos passam pelo mesmo guard).
- [ ] Célula começando com `=`/`+`/`-`/`@` sai com prefixo `'` (anti
  formula-injection) — cobertura de teste em `relatorios-csv.test.ts`.
- [ ] Demo (cookie coord): cada tipo novo devolve CSV com dados do dataset
  demo ou header-only — nunca 500.

## Hub `/relatorios`

- [ ] `/relatorios` (coord) abre na seção "Saúde do ciclo" com chips de
  seção linkáveis (`?secao=aderencia` carrega direto).
- [ ] Filtro turma/cronograma no topo altera cards+preview e é repassado
  ao link de CSV.
- [ ] Seção Saúde: cards (ativas/em risco/aderência/registros pendentes),
  lista ordenada por severidade com badge+motivo+link pra `/duplas/[id]`.
- [ ] Bloco "Tendência" aparece **somente** com snapshots presentes; sem
  a tabela aplicada a seção não quebra (feature-detect).
- [ ] Seção "Grade livre" renderiza o `RelatorioBuilder` atual sem
  regressão (edição inline continua).
- [ ] Mobile: chips scrollam, cards 2-col, preview scrolla horizontal.
- [ ] Demo coord: todas as seções populam com dataset demo.
- [ ] Mentor: `/relatorios` redireciona (comportamento atual preservado).

## Digest

- [ ] `GET /api/jobs/digest-semanal` sem Bearer → 401 (não redirect pra
  `/login` — middleware libera `/api/jobs/`).
- [ ] Com `CRON_SECRET` válido (staging) → `{ok:true}` e log em
  `emails_enviados` com `tipo='digest'`, `autor_id=null`,
  `audiencia={coordenacao}`.
- [ ] Segunda execução na mesma semana → `{skipt:...}` sem novo e-mail
  (dedup funciona).
- [ ] Com `EMAIL_ENVIO_LIBERADO=false`: o envio retorna
  `{error:"Envio de e-mail desativado…"}` — o tick responde `{ok:true,
  enviados:0}` (sem 500) e grava `emails_enviados` com `enviados:0` +
  `falhas`; o dedup (que conta `enviados>0`) **não** bloqueia envio real
  posterior na mesma semana.
- [ ] Botão "Enviar resumo da semana agora" (hub, coord) envia o mesmo
  digest com `autor_id=<coord>`; toast de sucesso/erro.
- [ ] Corpo do e-mail: só primeiro nome de mentorado; CTA → `/relatorios`;
  sem telefone/sobrenome/dados_civis.
- [ ] Migration 0107 aplicada: `insert tipo='digest'` aceito; tipo fora do
  CHECK segue rejeitado.

## Narrativa LLM

- [ ] Sem `IA_API_KEY`/`IA_NARRATIVA_OK`: botão "Gerar narrativa" **não
  renderiza**.
- [ ] Com flags (staging + provider de teste): clique → prosa pt-BR ~150
  palavras + rodapé "gerado por IA… confira"; `ia_eventos` tem row
  `{canal:'narrativa', tool:'narrativa_ciclo', ok:true, duracao_ms>0}`.
- [ ] Provider fora do ar (mock 500) → toast de erro + `ia_eventos` com
  `ok=false`, `erro` preenchido.
- [ ] Payload ao provider contém **somente** números/agregados — inspeção
  do `JSON.stringify(ag)` em teste: nenhum campo string com dado pessoal
  (asserção por tipo + teste de contrato).
- [ ] Canal `narrativa` aceito por `registrar_ia_evento` (migration 0108);
  `importacao` também presente no CHECK (superset).

## Regressão / gates técnicos

- [ ] `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` (inclui novos
  `relatorios-csv`).
- [ ] `scripts/check-schema-contract.mjs` verde (types só depois de
  aplicar migrations no remoto — ordem CI do AGENTS).
- [ ] e2e: `tests/e2e/app` — novo spec `relatorios.spec.ts` cobrindo:
  coord abre hub, navega seções, dispara download de CSV tipo novo
  (`download` event), botão de digest aparece e retorna toast; mentor não
  vê item Relatórios na nav.
- [ ] e2e demo: `tests/e2e/demo/relatorios.spec.ts` — seções populam,
  digest retorna DEMO_MSG.
- [ ] `vercel.json` sobe o cron (visível no painel Cron do preview Vercel).

## Fora de escopo (não cobrar no QA desta issue)

- Visual refinado dos dashboards (REALIZA-56).
- Retenção/expurgo de snapshots (fase posterior).
- Envio real em prod com `EMAIL_ENVIO_LIBERADO=true` (decisão de
  operação separada — critério é o tick funcionar com o kill switch).
