# REALIZA-180 — sdd.md

Pipeline em anel: **extração (CSV ou visão) → determinístico (sempre) →
semântico (opcional, LLM) → revisão humana (tabela + NL) → RPC existente**.
A IA só toca estado de linha antes da execução — nunca o banco.

## 1. Módulos

```
src/lib/importar/              [NOVO dir — vizinho de importar-registros.ts]
  extrair-visao.ts     provider visão → LinhaRegCsv[] (+confianca/linha)
  match-semantico.ts   LLM pick entre candidatos do determinístico
  revisao.ts           interpretarRevisao() + aplicarAcao() (pura)
  lote.ts              novoLoteId(), helpers de audit (registrar via RPC)
src/lib/actions-importar-registros.ts
  + previewVisaoImportRegistros(formData)      — server action, coord-only
  + enriquecerPrevComIa(itens, lote)           — segundo passe semântico
  + aplicarRevisaoTexto(texto, linhaIdx, lote) — NL por linha / em lote
src/components/importar-registros-dialog.tsx   — +dropzone, +tag IA,
  +caixas NL, +botão "Criar dupla" (NovaDuplaDialog existente)
```

`executarImportRegistros` **não muda** — recebe `itens` validados e chama
`importar_registros` RPC como hoje (`actions-importar-registros.ts`).
`importar-registros.ts` (a lib determinística) também não muda — as
camadas novas consomem `LinhaRegCsv`/`DuplaCandidata`/`processaLinhas`.

## 2. Contrato de dados entre camadas

```
arquivo ─┬─ .csv → FileReader → parseCsvRegistros ──────────┐
         └─ pdf/img → previewVisao (LLM visão) → saneia+normaliza ┤
                                                                 ▼
                                              processaLinhas (determinístico)
                                                                 ▼
                                            item.nivel==='manual' ||
                                            item.status==='revisar'?
                                            └─ sim → enriquecerPrevComIa
                                                     (match_semantico →
                                                      sugeridoIa + razao)
                                                                 ▼
                                          tabela de revisão (humana):
                                          select dupla · IGNORAR ·
                                          "Corrigir por texto…" (NL)
                                                                 ▼
                                          executarImportRegistros → RPC
```

- `sugeridoIa: {duplaId, confianca, razao}` é campo novo na `LinhaPrev`
  (client-side; não vai pra RPC — `itemRpc` ignora campos extras).
  `evidencias` ganha `{icone:'sparkle', texto:razao, peso:0,
  lado:'par'}` — shape real de `Evidencia` (`importar-registros.ts:598`;
  `sparkle` já está no union de ícones).
- `LinhaRegCsv` é o contrato de saída da visão — a lib já saneia:
  `saneiaLinhaReg`/`normalizaLinhaReg` tratam datas "32/13", ano futuro,
  placeholders — visão errada cai nas mesmas redes de segurança do CSV.
- Lote `uuid` gerado no client ao abrir o dialog → vai em todo
  `ia_eventos` do lote (`args.lote`) — agrupa "esta importação".

## 3. Chamadas LLM — shapes estritos

| `tool` | Entrada ao provider | Saída estruturada | Cap |
|---|---|---|---|
| `extrair_visao` | imagem/pdf page(s) + schema | `linhas[]` (campos `LinhaRegCsv` + `confianca`) | ≤20 págs/lote |
| `match_semantico` | `{mentorTxt,mentoradoTxt}` + top-5 `{i, mentorNome, mentoradoNome, trilha}` | `{indice\|null, confianca, razao}` | ≤30 chamadas/lote |
| `interpretar_revisao` | `{texto, linha:{rotulos da linha}, candidatos:[{i, mentorNome, mentoradoNome, wa4}]}` | `AcaoRevisao` (union tipada) | ≤30/lote |

- `wa4` = últimos 4 dígitos do whatsapp do candidato — desambigua "a do
  whatsapp 41 9xxxx" **sem o model ver o número inteiro** (minimização).
- Nomes vão ao provider porque são o objeto do match — `dados_civis`,
  e-mail, reflexões e currículo **nunca** entram nos candidatos (os
  candidatos vêm de `UniversoReg`/`DuplaCandidata` que já são só
  nome+id+trilha — manter assim).
- Saída estruturada via `tools` (function calling) — **nunca** parsear
  texto livre do model; se vier sem tool_call → `{error}` e a linha fica
  como estava.

## 4. `aplicarAcao` — pureza e regras duras

```ts
export function aplicarAcao(itens: LinhaPrev[], idx: number, a: AcaoRevisao,
  escolhas: Map<number,string>): { itens: LinhaPrev[]; escolhas: Map<number,string> };
```

- `escolher_candidato` → `escolhas.set(l.n, candidato.dupla_id)` (o mapa
  do dialog, `importar-registros-dialog.tsx:103`) — **não** muda
  `status` pra `ok`: mantém `revisar` até o humano clicar; a ação NL
  pré-aplica e marca "corrigido por texto" — o humano revisa o resultado.
  (Auto-confirmar NL seria a IA aprovando a si mesma.)
- `renumerar_lote` → recalcula `numero` das linhas marcadas — pode gerar
  colisão com `encontros` existentes → `EncontroInfo` recalcula pra
  `atualiza`/`anexa` normalmente (o determinístico resolve).
- `corrigir_data` → passa por `normalizaLinhaReg` de novo (ano futuro →
  flag de revisão, igual hoje).
- `criar_dupla` → não toca `itens`: retorna sinal pra UI abrir
  `NovaDuplaDialog` pré-preenchido; linha fica `revisar` com nota "aguarda
  dupla — após criar, re-rode a prévia".
- `nada` → devolve `motivo` pro toast ("Não entendi — reformule ou edite
  na tabela").

## 5. Auditoria

- `canal='importacao'` via migration `0108_ia_canais.sql` (superset da
  178 — ver sdd 178 §5). `registrar_ia_evento` já valida canal — a
  versão nova inclui `importacao`. TS: a union `CanalIa` (`tools.ts:36`)
  ganha `'importacao'` (1 linha — tipo local, não gerado do banco).
- `args`: `{lote, linha:n, acao:'…', texto:'≤300c'}` pra revisão;
  `{lote, mime, paginas, bytes}` pra visão; `{lote, n, txtLen}` pra
  semântico. **Sem payload do documento, sem resposta do model.**
- `ok=false` + `erro` em provider failure/parse/schema inválido.
- Leitura dos eventos: o próprio coord vê os dele (policy própria) — ok;
  auditoria do lote = filtro por `args->>'lote'`.

## 6. Execução/idempotência

- `executarImportRegistros` já deduplica e a RPC `importar_registros` é
  o único caminho de escrita — replay da mesma linha cai nas mesmas
  regras de unicidade de `encontros(dupla_id,numero)`/`registros`.
- Lote não cria tabela nova — `ia_eventos.args.lote` basta.
- Demo: `previewVisao*`/`enriquecer*`/`aplicarRevisaoTexto` retornam
  `DEMO_MSG` (gate `demoAtivo()` primeiro — padrão das actions) e o
  dialog em demo mostra as seções novas desabilitadas com o aviso —
  paridade visual, honesto.

## 7. Decisões registradas

| # | Decisão | Alternativa rejeitada |
|---|---|---|
| 1 | Visão entra **antes** do determinístico (produz `LinhaRegCsv`) | visão matchando direto — pularia a rede de segurança da lib |
| 2 | Semântico só em `manual`/`revisar`, nunca vira `auto` | semântico em tudo / auto-promoção — risco de falso positivo |
| 3 | `criar_dupla` delega ao `NovaDuplaDialog` humano | IA criar `duplas` via RPC — write de domínio pesado demais pra agente |
| 4 | `wa4` (4 dígitos) no match por contato | whatsapp inteiro ao provider — desnecessário |
| 5 | `texto` da revisão no `ia_eventos.args` (capado) | não gravar — perde "pediu X, aplicou Y" da auditoria |
| 6 | Estender o dialog atual | dialog novo — duplicaria a tabela de revisão |
| 7 | Segundo passe `enriquecerPrevComIa` separado do preview | dentro de `previewImportRegistros` — deixaria preview lento/dependente de provider |

## 8. Testes (Vitest puro — sem provider real)

- `aplicarAcao`: cada `AcaoRevisao` × estados de linha (inclui
  renumeração com colisão, `corrigir_data` ano futuro→flag).
- `aplicarSemantico`: confiança 69 não promove; `indice` fora do range →
  `manual`; razão vira evidência.
- Parsing da saída da visão → `LinhaRegCsv` (campos faltantes → saneia).
- Provider mock: timeout → `{error}`; tool_call ausente → `{error}`;
  confiança string→coerção number.
- Determinístico intocado: suite `importar-registros.test.ts` segue
  verde sem flag.
