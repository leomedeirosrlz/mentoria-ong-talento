# REALIZA-180 — acceptance.md

Critérios executáveis por QA. "Provider mock" = stub do provider
(`IA_API_BASE` local) devolvendo tool_calls/saídas estruturadas sob
demanda. Flag `IA_IMPORTACAO_OK=1` liga as camadas; sem flag, o caminho é
o CSV atual.

## Regressão do caminho atual (sem flag)

- [ ] Importar CSV funciona idêntico a hoje: parse, confiança, select de
  dupla, `IGNORAR`, encontro `novo`/`anexa`/`atualiza`, RPC.
- [ ] Nenhuma chamada ao provider acontece sem `IA_IMPORTACAO_OK` (assert
  por network/request log em teste).
- [ ] `tests/importar-registros.test.ts` existente segue verde.

## Extração por visão

- [ ] Upload `.pdf` (planilha fixture) → "Lendo o documento…" → tabela
  povoada com linhas equivalentes ao CSV de referência (fixture: mesmo
  conteúdo nos dois formatos → mesma prévia, dentro do esperado de OCR).
- [ ] `.png/.jpg` da mesma planilha → idem.
- [ ] Campo de extração com `confianca<70` → linha `revisar` + tag
  "extração incerta".
- [ ] Documento sem tabela → "Não achei linhas de registro…".
- [ ] Arquivo >10MB ou >20 páginas → erro amigável antes de chamar
  provider.
- [ ] Provider 500/timeout → toast erro + opção "Tentar de novo"/"Enviar
  como CSV"; `ia_eventos` com `tool='extrair_visao'`, `ok=false`.
- [ ] `.csv` continua processando localmente **sem** provider.
- [ ] `ia_eventos` da extração: `canal='importacao'`, args com
  `{lote,mime,paginas,bytes}` — **sem** conteúdo do documento.

## Match semântico

- [ ] Linha `manual` com typo ("Nycolly"→"Nicolly") → mock escolhe
  candidato → select pré-selecionado + badge "Sugerido por IA" + razão;
  linha continua `revisar` até confirmar.
- [ ] Mock `indice:null` ou `confianca<70` → linha fica `manual`, razão
  visível, sem pré-seleção.
- [ ] Semântico **nunca** cria linha `auto` — mesmo com confiança 100
  (asserção de regra em teste).
- [ ] Placeholder "Mentorada" → determinístico já bloqueia; semântico não
  ressuscita (mock não deve ser chamado pra linha sem candidatos).
- [ ] `ia_eventos` `match_semantico` por chamada com `lote` correto.
- [ ] Humano troca o select depois da sugestão → `sugeridoIa` limpa, valor
  humano vale.

## Revisão NL — casos do Jira

- [ ] "é a outra Nicolly" (2 candidatas Nicolly) → `escolher_candidato`
  aplica a certa; com "…a do whatsapp 41 9xxxx" → desambigua por `wa4`.
- [ ] Ano errado narrado ("é de 2025") → `corrigir_data` → normalização
  revalida (ano futuro → flag).
- [ ] "numera a partir do 3º encontro" na caixa de lote → números das
  linhas selecionadas re-enumerados; colisão com encontro existente →
  `EncontroInfo` marca `atualiza`/`anexa` corretamente.
- [ ] "essa dupla não existe, é o mentor João com a Ana" → sinal
  `criar_dupla` → botão abre `NovaDuplaDialog` pré-preenchido; após
  criar, a linha re-avalia com a dupla nova candidata.
- [ ] "pode ignorar" → linha marcada `IGNORAR` (desfazer disponível).
- [ ] Texto sem sentido → "Não entendi — reformule ou edite na tabela."
- [ ] `ia_eventos` `interpretar_revisao` com `args` contendo `acao` +
  `texto` capado ≤300c.

## Execução e auditoria

- [ ] Executar importação continua indo só pela RPC `importar_registros`
  — nenhum insert direto novo (code review + teste de integração no
  staging: linhas chegam como antes).
- [ ] Replay do mesmo lote → dedup/unicidade existentes tratam (sem
  registro duplicado).
- [ ] Coord vê os próprios `ia_eventos` do lote filtrando por
  `args->>'lote'`.
- [ ] Mentor/supervisor chamando as actions novas → `error` (gate coord);
  `ia_eventos` não cria row pra não-autorizado nessas actions (o gate é
  antes do evento — verificar comportamento e documentar).

## Demo / gates técnicos

- [ ] Demo coord: seções IA desabilitadas com aviso; aplicar qualquer
  ação IA → `DEMO_MSG`; caminho CSV → `DEMO_MSG` (comportamento atual).
- [ ] `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` (novos suites:
  `importar-revisao`, `importar-semantico`, `extrair-visao` parsing).
- [ ] e2e app (`tests/e2e/app/importar.spec.ts` novo ou extensão do
  operacional): coord abre dialog, CSV path intacto; com flag+mock:
  visão→tabela→sugestão IA→correção NL→importar.
- [ ] e2e demo: dialog abre, seções IA presentes e desabilitadas.
- [ ] `check-schema-contract.mjs` verde após `db push` do 0108 (se vier
  por este PR).

## Fora de escopo

- Preview/render do documento (PDF viewer); OCR de documentos que não
  sejam a planilha de registros; importação de outros tipos (duplas por
  visão — a lib `importar-duplas.ts` segue CSV-only nesta issue).
- Edição do texto extraído em campos livres além dos da `LinhaRegCsv`.
