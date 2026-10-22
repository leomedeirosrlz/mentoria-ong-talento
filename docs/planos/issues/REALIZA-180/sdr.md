# REALIZA-180 — sdr.md

## 1. Superfícies novas

| Superfície | Acesso | Auth |
|---|---|---|
| `previewVisaoImportRegistros` | coord | action server-side (sessão) + `demoAtivo` gate |
| `enriquecerPrevComIa` | coord | idem |
| `aplicarRevisaoTexto` | coord | idem |
| `ia_eventos.canal='importacao'` | — | migration 0108 (CHECK superset) |
| Provider LLM (visão+texto) | server-only | `IA_API_KEY` + `IA_IMPORTACAO_OK` |

Nenhuma rota pública nova: tudo é server action com sessão. `anon` segue
zero-grant; nada aqui é acessível a mentorado.

## 2. O risco real — o documento vai ao provider

**A planilha/foto inteira é enviada ao provider** (pixels/bytes — não dá
pra redigir imagem antes de OCR). O documento contém nomes de mentores e
**mentorados menores** + possivelmente texto livre de registro
(`feito`/`reflexao`).

Mitigações (todas necessárias, juntas):

- **BLOCKER absoluto**: DPA + retenção zero do provider confirmado antes
  de `IA_IMPORTACAO_OK` — mais crítico que chat/narrativa porque aqui
  vai documento completo. Sem confirmação, a entrada não-CSV fica
  desligada e o caminho CSV (100% local, zero provider) continua pleno.
- Minimização **por saída**: o model é instruído a devolver só as colunas
  mapeadas — mas a entrada (a página) já foi. Não dá pra reduzir a
  entrada; a proteção é contratual.
- Aviso explícito na UI (design §1) antes do upload — a coord sabe que o
  documento sai da máquina dela.
- Caps: ≤10 MB, ≤20 páginas, `MAX_IMPORT=500` linhas — limita exposição
  por lote e custo.
- `ia_eventos` guarda **metadados** (mime/páginas/bytes/lote), nunca o
  conteúdo extraído nem a imagem.
- Alternativa sem provider sempre disponível: converter pra CSV — a UI
  diz isso no estado desligado.

### Match semântico / NL — o que vaza

- Candidatos ao provider: **nome + trilha + últimos-4 do whatsapp**
  (`wa4`) — necessários pro match. `dados_civis`, e-mail, endereço,
  reflexões, currículo: **nunca** (vêm de `DuplaCandidata`/`UniversoReg`
  que já são minimizados — manter o shape).
- `interpretar_revisao`: o `texto` da coord pode conter PII ("a do
  whatsapp 41 9…") — vai ao provider na chamada (inevitável — é o objeto
  da interpretação) e fica capado em `ia_eventos.args` (DB próprio;
  decisão registrada sdd §5 — é o registro "pediu X, aplicou Y").

## 3. Integridade — IA não pode escrever errado

- **Nenhum caminho de escrita novo**: `executarImportRegistros` +
  `importar_registros` RPC intocados; IA só altera `itens` de prévia.
- Nada entra sem revisão humana: visão força tabela; semântico nunca
  promove a `auto`; NL pré-aplica e marca "corrigido por texto" — o
  botão Importar continua manual.
- **Guard anti auto-aprovação**: ação NL não marca linha `ok` sozinha —
  mantém `revisar` até confirmação humana (a IA não aprova o que ela
  mesma propôs).
- Guards do domínio herdados: ano futuro → flag; `realizado` imutável;
  unicidade `encontros(dupla_id,numero)`; placeholders não auto-matcheiam.
  Tudo isso é da lib/RPC existente — IA passa pelo mesmo funil.
- `criar_dupla` vira botão pro fluxo humano (`NovaDuplaDialog`) — IA
  não escreve `duplas`.
- Prompt-injection via conteúdo do documento (alguém escreve "ignore as
  regras" na planilha): saída estruturada por tool_call + validação Zod +
  saneamento determinístico — instruções em texto viram dado, não ação.
- Idempotência: replay do lote cai nas unicidades existentes; o lote id
  em `ia_eventos` permite auditar o que cada chamada decidiu.

## 4. Rate limit / custo

- `checarLimiteIa` compartilhado + cap por lote (≤1 visão, ≤30 semântico,
  ≤30 revisões por lote) — documentado no plan.
- Sem auto-retry: falha de provider deixa a linha como estava e registra
  `ok=false`.

## 5. Checklist LGPD

- [x] Mínimo necessário: candidatos só com campos de match; `wa4`; metas
  nos args.
- [x] Transparência: aviso de envio ao provider no dropzone.
- [x] Revisão humana obrigatória antes de qualquer escrita.
- [x] Auditoria por lote (`args.lote`) de cada decisão IA.
- [x] Operador gated (BLOCKER DPA/retention).
- [ ] `a verificar`: formato PDF com foto/scan de ficha assinada — se
  vierem documentos com `dados_civis`, o aviso precisa dizer
  explicitamente que o conteúdo inteiro é processado por IA (ajustar
  microcopy na implementação).
