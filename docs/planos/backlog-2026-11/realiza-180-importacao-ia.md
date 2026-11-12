# REALIZA-180 — Pipeline de importação inteligente (visão → match semântico → revisão em NL)

Issue: `importacao`,`ia`,`lgpd`,`coordenacao`. Fonte: `docs/planos/issues/REALIZA-180/{README,sdd,sdr,plan}.md` + `docs/planos/forms-google-mapeamento.md`. Status: a fazer.

## O que exige vs. o que existe

**Base determinística sólida (não reinventar):**

- `src/lib/importar-registros.ts` (1495 linhas, **puro e self-contained** — zero imports de runtime; roda igual no app, vitest e Node 22 pelos scripts): `parseCsvRegistros`→`LinhaRegCsv` (`:243,:220`), `normalizaLinhaReg` saneia datas/números (`:468`), `scoreLinha` dá `score` 0–100 + `nivel` (`auto|provavel|manual`) + `candidatos` + `evidencias` explicáveis (`:598-601` — o union de ícones já inclui `sparkle`), `processaLinhas` fixa `status` (`ok|revisar|ignorar`, `:1357`), `itemRpc` monta o payload da RPC (`:1429`), `saneiaLinhaReg` revalida (`:1443`). `'auto'` exige score ≥90 com ambos lados ≥80 sem ambiguidade; placeholders ("Mentorada") nunca auto-matcheiam.
- `src/lib/actions-importar-registros.ts`: `previewImportRegistros` (coord-only, gate demo, `MAX_IMPORT=500`) → `universoRegistros` (mentores por papel + FKs de dupla, mentorados, duplas, encontros, ciclo_eventos); `executarImportRegistros` → **só** RPC `importar_registros` (0082) — cria encontro born-realizado ou faz upsert do registro, `created_by` = mentor da dupla.
- UI: `importar-registros-dialog.tsx` (botão "Importar respostas" em `/registros`, `page.tsx:456`) — Select de dupla por linha `revisar`, `IGNORAR`, tags de confiança, `EncontroInfo` (`novo|anexa|atualiza`), `escolhas: Map<number,string>` (`:105`).
- CLI: `scripts/importar-registros.mjs` reusa a lib com `--resolve n=<uuid>` + `--apply` (dry-run default).
- Intake de turma: `scripts/transformar-intake.py` (Google Forms → CSVs canônicos + manifest de anexos + relatório de auditoria) e `importar.ts`/`importar-duplas.ts` (import de pessoas e pareamento — deterministic match por e-mail/nome, outra shape de universo).

**Camada de IA já operante (chatbot Liza):**

- `src/lib/ia/provider.ts`: cliente OpenAI-compatible por fetch (`chamarModelo` JSON `:237` + `chamarModeloStream` SSE `:355`), cadeia de fallbacks por tier (`rapido|balanceado|forte` via `ia_config`, 0148), retry transitório, `reasoning_effort`, tools filtradas por papel. **`MsgChat.content` é `string | null` — não existe suporte multimodal/visão hoje** (`:32-38`).
- `src/lib/ia/tools.ts`: registry tipado — o modelo nunca escreve direto; `executarTool` valida zod + allowlist de papel + audita (`:1575`); `argsMinimizados` ({n,hash12}) pra campos com PII (`:1504`); `CanalIa = "chat" | "mcp"` (`:61`).
- Auditoria: `ia_eventos` (0083: `profile_id, canal CHECK('chat','mcp'), tool, args, ok, erro, duracao_ms` + telemetria 0160: `modelo, tier, tokens_*, custo_usd, request_id`); escrita só via `registrar_ia_evento` (0159) / `registrar_ia_eventos_lote` (0160); policy select = próprio + coord.
- Rate limit: `consumirLimiteIa` (rate-limit.ts:21 — RPC com advisory lock, 20/60s default por profile, `request_id` correla eventos).

**O que falta (o que esta spec cobre):**

1. **Match semântico** — LLM decide entre os `candidatos` que o determinístico marcou `manual`/`revisar`, com confiança + razão. Nunca vira `auto`.
2. **Revisão em linguagem natural** — a coord responde em texto livre ("é a outra Nicolly, a do whatsapp 41 9xxxx", "numera a partir do 3º") e a IA traduz em ação tipada sobre a linha/lote. Semântica `interpretar_revisao` → `AcaoRevisao` union.
3. **Extração por visão** — `.pdf/.png/.jpg/.webp` além de `.csv`: documentos escaneados, foto de ficha em papel, print de planilha → linhas no formato `LinhaRegCsv`. **Exige estender o provider** (content parts `image_url`) + modelo com visão configurável — e é a superfície LGPD mais larga (o documento inteiro sai do perímetro).
4. **Auditoria por lote** — `ia_eventos.canal='importacao'` [migration 0189]; `args.lote` agrupa a importação; args = metadados + o texto da coord capado, nunca payload do documento.

**Princípio inviolável:** a IA só toca estado de linha **antes** da execução — a escrita continua exclusiva das RPCs existentes (`importar_registros`; `criar_dupla` delega ao fluxo humano `NovaDuplaDialog`; remanejo por `rematch_dupla` quando a linha indicar par errado — sempre via action humana, nunca pelo modelo — mesmo desenho das tools de escrita MCP-only de `tools.ts`).

## Decisões

1. **Entrega por fases — fase 1 = match semântico apenas** (sobre linhas `manual`/`revisar` do fluxo CSV de hoje). É a menor fatia com valor real: a fila de revisão é onde a coord gasta tempo, usa só chamada de texto que o provider já faz, e levanta TODA a infra compartilhada (canal `importacao`, `lote` id, padrão de auditoria, caps por lote) que as fases 2 e 3 reutilizam sem rework. Alternativas rejeitadas: visão primeiro (a maior superfície LGPD + provider sem multimodal — esforço M só de plumbing) e pipeline completo num PR só (difusa demais pra review).
2. **Semântico nunca promove a `auto`** — a melhor hipótese dele entra como `sugeridoIa {duplaId, confianca, razao}` com evidência `icone:'sparkle'`; `manual`→`provavel` é o teto. A decisão final fica humana sempre (a IA não aprova o que ela mesma propõe).
3. **Candidatos minimizados por construção** — o modelo recebe `{i, mentorNome, mentoradoNome, trilha, wa4}` do top-5 do `scoreLinha`; `wa4` = últimos 4 dígitos do whatsapp (desambigua "a do whatsapp 41 9…" sem o número inteiro). `dados_civis`, e-mail, `form_bruto`, reflexões, currículo **nunca** entram — `DuplaCandidata`/`UniversoReg` já são minimizados e ficam assim (regra de review: checar o shape do payload, não a boa vontade do prompt).
4. **Saída sempre por function-calling** — nunca parsear texto livre do modelo; sem `tool_call` válido → `{error}` e a linha fica como estava. Prompt-injection via conteúdo do documento vira dado, não ação (mesma defesa da tools zod + saneamento determinístico).
5. **`aplicarAcao` pura** — `interpretar_revisao` devolve `AcaoRevisao` (union tipada); uma função pura aplica no array de linhas sem I/O (testável, replayável): `escolher_candidato`, `corrigir_numero`, `corrigir_data`, `editar_campo`, `renumerar_lote`, `ignorar`, `criar_dupla`, `nada`. Nenhuma ação NL marca a linha `ok` sozinha — mantém `revisar` com marca "corrigido por texto" até o clique humano.
6. **`criar_dupla`/`rematch` delegam aos fluxos humanos** — `criar_dupla` retorna sinal pra abrir `NovaDuplaDialog` pré-preenchido (linha fica `revisar` com nota); remanejo real usa `rematch_dupla` por ação da coord fora do dialog de import. O modelo nunca toca `duplas`.
7. **`lote` = uuid gerado no client ao abrir o dialog** — vai em `args.lote` de todo evento do lote; auditoria "esta importação" = filtro por `args->>'lote'`. Sem tabela nova.
8. **Rate limit compartilhado + caps por lote** — `consumirLimiteIa` com `canal:'importacao'` (a migration cobre); caps: ≤1 chamada de visão, ≤30 `match_semantico`, ≤30 `interpretar_revisao` por lote (o `MAX_IMPORT=500` já limita linhas; o cap evita varrer lote enorme no automático — linhas além do cap caem na revisão manual de sempre). Sem auto-retry: falha de provider deixa a linha como estava + `ok=false` no evento.
9. **Provider zero-retention é gate absoluto** — `IA_IMPORTACAO_OK=1` separada de qualquer flag do chat: sem DPA + retenção zero confirmados, entrada não-CSV fica desligada e o CSV (100% local) segue pleno. O default atual do provider (mimo-v2.6-flash, retenção 0 — comentário `provider.ts:4-6`) é ponto de partida, não dispensa a confirmação contratual — principalmente pra visão, onde o documento inteiro vai.
10. **Visão roda antes do determinístico** — produz `LinhaRegCsv[]` e entra no **mesmo** `processaLinhas`: visão errada cai nas mesmas redes do CSV (data "32/13" saneada, ano absurdo → flag, placeholder não auto-matcheia). Nada entra sem a tabela de revisão.
11. **Intake de turma (`transformar-intake`, `importar.ts`, `importar-duplas.ts`) fica fora desta spec** — a arquitetura generaliza (`matchSemantico` recebe candidatos+textos), mas a shape de universo do intake é outra (pessoa, não dupla) e o ganho é menor (CSV já nasce canônico do script). É a fase natural seguinte, spec própria quando doer.

## Schema — migration `0189_ia_canal_importacao.sql`

Estende o vocabulário de `canal` da auditoria — 5 pontos a tocar, todos com a mesma lista:

1. `ia_eventos.canal` CHECK: `('chat','mcp')` → `('chat','mcp','importacao')` (0083:25 — `drop constraint if exists ia_eventos_canal_check` + `add constraint`).
2. `registrar_ia_evento` (definição vigente em 0159:64 — valida `p_canal not in ('chat','mcp')`).
3. `ia_contexto_e_limite` (0159:110 — mesmo guard).
4. `consumir_limite_ia` (0160:62 — idem).
5. `registrar_ia_eventos_lote` (0160:111 — valida `e->>'canal'`).

**Regras de escrita (binding do AGENTS):** conferir no banco o constraint name e `pg_get_functiondef` de cada função **no ambiente alvo** antes de redigir — o SQL listado é o declarado nas migrations versionadas, mas o schema real manda; recriar verbatim com só a lista mudando. `create or replace` + `begin/commit` + revokes explícitos, molde 0083/0154.

**Convergência com specs irmãs:** cada migration que mexer nesse CHECK escreve a **união dos canais conhecidos naquele momento** — se uma spec futura adicionar `narrativa`, ela escreve `('chat','mcp','importacao','narrativa')`, nunca remove (ordem de apply converge — anotado pra review cruzado).

TS: `CanalIa` (`tools.ts:61`) ganha `'importacao'` (tipo local, não gerado); `consumirLimiteIa` (`rate-limit.ts:21`) amplia o parâmetro `canal`; `EventoIa`/`EventoIa[]` seguem (canal é campo livre no lote).

Blast radius: zero pra dados (CHECK só valida insert); as funções são `security definer` internas — assinaturas não mudam.

## Domínio (`src/lib/`)

```
src/lib/importar/                    [NOVO dir — vizinho de importar-registros.ts]
  match-semantico.ts    chamada tool-call: {mentorTxt,mentoradoTxt} + top-5
                        candidatos {i,mentorNome,mentoradoNome,trilha,wa4}
                        → {indice|null, confianca 0-100, razao pt-BR}
  revisao.ts            interpretarRevisao() (chamada LLM) + aplicarAcao() (PURA)
  lote.ts               novoLoteId() + registrarEventoImportacao() (wrap da RPC,
                        monta args {lote, linha?, acao?, texto≤300c, mime?...})
  extrair-visao.ts      (fase 3) documento → LinhaRegCsv[] + confianca por linha
src/lib/actions-importar-registros.ts
  + enriquecerPrevComIa(linhas, lote)          — 2º passe, só manual/revisar
  + aplicarRevisaoTexto(texto, linhaIdx, lote) — NL por linha / em lote
  + previewVisaoImportRegistros(formData)      — (fase 3) dropzone não-CSV
src/components/importar-registros-dialog.tsx — +tag "sugerido por IA" (sparkle +
  razão), +caixa "Corrigir por texto…" por linha e em lote, +botão "Criar dupla"
  (NovaDuplaDialog existente), +(fase 3) dropzone pdf/img com aviso LGPD
```

`executarImportRegistros` e a lib determinística **não mudam** — as camadas novas consomem `LinhaReg`/`DuplaCandidata`/`processaLinhas` e produzem estado de linha antes da RPC.

**Contrato das chamadas (fase 1):**

- `match_semantico`: input `{mentorTxt, mentoradoTxt}` + top-5 `{i, mentorNome, mentoradoNome, trilha, wa4}` → tool-call `{indice: number|null, confianca: number, razao: string}`. Aplica: `confianca >= 70 && indice ∈ range` → `sugeridoIa` preenchido + linha sobe a `provavel` na UI (sugestão pré-selecionada, **não** confirmada); abaixo → fica `manual`. `indice` fora do range/ausente → nada muda.
- Tier de modelo: `balanceado` (default da `ia_config`) com a cadeia de fallbacks de sempre — match é classificação estruturada, não prosa; configurável sem redeploy pelo painel `/ia` (`ia_config.modelos`).

**Audit args por tool** (metadados, nunca conteúdo):

| `tool` | args |
|---|---|
| `match_semantico` | `{lote, n, txtLen}` |
| `interpretar_revisao` | `{lote, linha:n, acao:'…', texto:'≤300c'}` — o texto é a resposta humana (registro "pediu X, aplicou Y"); capado como `ARGS_MINIMIZADOS` já faz com PII opcional |
| `extrair_visao` (fase 3) | `{lote, mime, paginas, bytes}` — nunca imagem nem conteúdo extraído |

## UI

- O dialog ganha as camadas **sem mudar a tabela de revisão**: linha `revisar` com `sugeridoIa` mostra tag `sparkle` "sugerido por IA · <razão>" + pré-seleciona a sugestão; caixa "Corrigir por texto…" por linha (e uma instrução em lote no topo) chama `aplicarRevisaoTexto` — a linha afetada marca "corrigido por texto" e segue `revisar` até o clique.
- `sem-par` (linha cujo par não existe) → botão "Criar dupla" abre `NovaDuplaDialog`; após criar, re-roda a prévia.
- Estado desligado honesto: sem provider configurado (`providerConfigurado()`), a segunda passada não roda e a caixa NL fica desabilitada com aviso — CSV puro segue funcionando.
- Copy pt-BR, sem travessão; tags no padrão `Tag`/`TomTag` do dialog.
- Demo: `enriquecerPrevComIa`/`aplicarRevisaoTexto`/`previewVisao*` retornam `DEMO_MSG` (gate `demoAtivo()` primeiro, padrão das actions); o dialog em demo mostra as seções novas desabilitadas — paridade visual honesta.

## Seed + demo

- `tests/importar-registros.test.ts` segue verde sem flag (determinístico intocado).
- Sem dataset novo pra fase 1 (a camada é provider-gated; o demo mostra desabilitado). Fixture de linhas `revisar`/`manual` pra testar o dialog já existe no fluxo.

## Testes (vitest puro — provider mockado, nunca real)

- `aplicarAcao`: cada `AcaoRevisao` × estados de linha — inclui `renumerar_lote` com colisão (`EncontroInfo` recalcula), `corrigir_data` ano futuro → flag `revisar` (re-usa `normalizaLinhaReg`), `escolher_candidato` → `escolhas.set(n, id)` sem virar `ok`, `nada` → motivo pro toast.
- `aplicarSemantico`: confiança 69 não promove; `indice` fora do range → `manual` inalterado; `razao` vira `Evidencia{icone:'sparkle'}`; sugestão nunca vira `auto`.
- Parse de saída LLM: tool_call ausente → `{error}`; schema zod inválido → `{error}`; confiança string → coerção.
- Provider mock: timeout → `{ok:false}` (linha fica como estava); evento gravado com `ok:false` + `erro`.
- Auditoria: args não carregam payload do documento nem resposta do modelo — assert do shape `{lote, n, txtLen}`.

## Critérios de aceite

### Fase 1 — match semântico (a fatia que esta spec entrega)

- [ ] Migration 0189 aplicada: `ia_eventos.canal` aceita `'importacao'`; `registrar_ia_evento`, `registrar_ia_eventos_lote`, `consumir_limite_ia`, `ia_contexto_e_limite` validam o novo valor (verificado contra `pg_get_functiondef` do alvo, não de memória).
- [ ] `enriquecerPrevComIa` só roda em linhas `manual`/`revisar`, cap ≤30 chamadas/lote, devolve `sugeridoIa` por linha (não altera `LinhaReg` original).
- [ ] Sugestão semântica nunca marca `status='ok'` nem `nivel='auto'` — a confirmação é sempre o clique humano no Select.
- [ ] Payload do match contém **somente** `{mentorTxt,mentoradoTxt}` + candidatos `{i,mentorNome,mentoradoNome,trilha,wa4}` — assert de teste que `dados_civis`, e-mail, `form_bruto`, reflexões, whatsapp completo não aparecem.
- [ ] Cada chamada grava `ia_eventos` `canal='importacao'`, `tool='match_semantico'`, `args={lote,n,txtLen}`, `ok`/`erro`/`duracao_ms`/`modelo`.
- [ ] Falha de provider (timeout/4xx/tool_call ausente) deixa a linha **exatamente** como o determinístico a deixou + evento `ok:false` — nenhuma linha piora por causa da IA.
- [ ] Dialog mostra "sugerido por IA · <razão>" nas linhas enriquecidas e pré-seleciona a sugestão; sem provider → camadas desabilitadas com aviso, CSV puro inalterado.
- [ ] `consumirLimiteIa` respeitado (429 bloqueia a 2ª passada); gate coord + `DEMO_MSG` em demo.
- [ ] `executarImportRegistros` e `importar-registros.ts` sem diffs funcionais — a suite `importar-registros.test.ts` passa intocada.

### Fase 2 — revisão em NL

- [ ] `interpretar_revisao` devolve `AcaoRevisao` tipada por tool-call; texto livre que não parseia → `nada` + toast honesto, linha intocada.
- [ ] `aplicarAcao` aplica cada ação nas regras duras da §Domínio; `criar_dupla` abre `NovaDuplaDialog` pré-preenchido (não cria via IA); `corrigir_data` re-saneia com as mesmas flags do determinístico.
- [ ] Nenhuma linha sai de `revisar` por ação NL — marca "corrigido por texto", confirmação segue humana.
- [ ] `args` do evento carrega `{lote, linha, acao, texto≤300c}` — "pediu X, aplicou Y" auditável por lote.

### Fase 3 — visão

- [ ] `MsgChat.content` estendido a `string | ContentPart[]` (`{type:'text'}|{type:'image_url'}`) — compatível com o provider atual; callers de texto não mudam.
- [ ] `previewVisaoImportRegistros` aceita `.pdf/.png/.jpg/.webp` (≤10MB, ≤20 páginas); PDF rasterizado **no browser** (pdfjs lazy — o servidor nunca recebe o PDF cru) e as páginas vão como `image_url` data-URI; CSV continua o caminho default.
- [ ] Saída da visão = `LinhaRegCsv[]` + `confianca`/linha → **mesmo** `processaLinhas` (saneamento determinístico intacto); nenhum campo entra sem a tabela de revisão.
- [ ] `IA_IMPORTACAO_OK=1` + provider configurado + DPA/zero-retention confirmado = pré-condição de enable; desligado → dropzone não-CSV desabilitada com aviso + alternativa "converta pra CSV".
- [ ] `ia_eventos` `{lote, mime, paginas, bytes}` por chamada — nunca imagem nem texto extraído; aviso na UI de que o documento é processado por IA externa.

## Fora de escopo

- Importação de intake de turma (`transformar-intake`/`importar.ts`/`importar-duplas.ts`) com as mesmas camadas — spec própria quando a dor aparecer; a arquitetura já generaliza.
- `criar_dupla`/`rematch` executados pela IA — sempre via fluxo humano existente (`NovaDuplaDialog`, action de remanejo/`rematch_dupla`).
- NLP sobre `reflexoes`/`observacoes` importadas (capacidade 5 da doc-mestre — gate legal próprio).
- `canal='narrativa'` e demais canais futuros — a migration escreve só `importacao`; quem precisar depois estende pela mesma régua de união.
- RAG/embeddings sobre os registros — match é por candidatos resolvidos, não por busca vetorial.
