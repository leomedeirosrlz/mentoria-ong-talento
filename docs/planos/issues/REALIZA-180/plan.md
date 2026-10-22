# REALIZA-180 — plan.md

4 PRs, todos atrás de flag `IA_IMPORTACAO_OK` (provider + canal
`importacao`). O fluxo CSV determinístico atual **não muda** — as camadas
novas são opt-in por arquivo/correção.

Ordem sugerida: semântico → visão → NL → (audit vem junto em cada PR).

---

## PR 1 — match semântico nas linhas `nivel='manual'`/`status='revisar'`

### `src/lib/importar/match-semantico.ts` [NOVO]

```ts
export async function matchSemantico(args: {
  linha: Pick<LinhaReg,"mentorTxt"|"mentoradoTxt">;
  candidatos: DuplaCandidata[];       // top-5 do scoreLinha — só nomes+índice
}): Promise<{ indice: number|null; confianca: number; razao: string } | { error: string }>;
```

- Provider `chamarModelo` com `tools` — tool `escolher_dupla`
  `{indice:int|null, confianca:0-100, razao:string}` (saída estruturada —
  mesmo mecanismo do chat da 179).
- Candidatos serializados **só com nomes** (`{i, mentorNome,
  mentoradoNome, trilha}`) — zero `dados_civis`, zero contatos.
- Aplicador puro `aplicarSemantico(item, res)`: `nivel==='manual'` +
  `confianca≥70` → `nivel='provavel'` + `evidencias` ganha
  `{icone:'sparkle', texto:razao, peso:0, lado:'par'}` (shape real de
  `Evidencia` — `importar-registros.ts:598`, `sparkle` já é ícone
  previsto) e `sugeridoIa: candidato` no item da prévia (`LinhaPrev`);
  `<70` ou `indice:null` → mantém `manual` com a razão registrada em
  `evidencias`. **Nunca promove a `auto`** — regra dura.
- Roda dentro de `previewImportRegistros`? **Não** — preview atual é
  síncrono e o semântico é por-chamada-LLM. Design: a action nova
  `enriquecerPrevComIa(itens)` roda como segundo passe **opcional** (o
  dialog chama depois do preview determinístico, linha a linha ou lote de
  ≤10, com `lote` uuid) — preview determinístico continua instantâneo e
  funciona sem provider.
- `ia_eventos` por chamada: `{canal:'importacao', tool:'match_semantico',
  args:{lote, n, mentorTxtLen}}` — **não** logar os nomes brutos nos args
  (tamanho/contagem basta pro audit; a linha já está na tela).

### UI (dialog existente)

- Coluna/tag extra "IA": quando `sugeridoIa` presente, `ConfTag` nova
  `ia` + tooltip com a `razao`. O `escolhas: Map<n, duplaId>` do dialog
  (`importar-registros-dialog.tsx:103`) recebe o candidato sugerido como
  valor inicial — `status` continua `revisar` até humano agir (confirmar
  ou trocar — trocar limpa `sugeridoIa`).

## PR 2 — extração por visão

### `src/lib/importar/extrair-visao.ts` [NOVO]

```ts
export async function extrairLinhasDeDocumento(file: {nome,mime,bytes}):
  Promise<{ linhas: LinhaRegCsv[]; aviso?: string } | { error: string }>;
```

- Dialog aceita `.csv,.pdf,.png,.jpg,.jpeg,.webp` (input `accept`).
  CSV → caminho atual (FileReader→texto→`parseCsvRegistros`).
- Não-CSV → server action `previewVisaoImportRegistros(formData)`:
  coord-only + DEMO_MSG + provider check + cap (≤10MB, ≤20 páginas PDF) →
  base64 → provider `chat.completions` com `messages` contendo
  `image_url`/doc (formato OpenAI vision) + **saída via tool estruturada**
  `registros_extraidos{linhas:[{mentor, mentorado, numero, data,
  duracaoMin, avaliacao, dificuldade, proximoPasso, atividades, feito,
  confianca:0-100}]}` — os campos espelham `LinhaRegCsv`/`normalizaLinhaReg`.
- **Minimização por prompt**: o model é instruído a transcrever **só as
  colunas mapeadas** — campos livres (`feito`/`reflexao`) só saem se
  estiverem em coluna própria da planilha (o papel do form semanal tem
  essas colunas — a extração cobre; ver sdr §2 sobre o documento ir ao
  provider).
- Retorno alimenta `saneiaLinhaReg`+`normalizaLinhaReg`+`processaLinhas`
  — **o pipeline determinístico valida tudo de novo** (datas absurdas,
  ano errado, placeholders caem nas mesmas regras).
- `confianca<70` por linha → `status='revisar'` forçado + aviso "extração
  incerta — confira os campos".
- `ia_eventos` `{tool:'extrair_visao', args:{lote, mime, paginas, bytes}}`
  — metadados, não conteúdo.

## PR 3 — revisão em linguagem natural

### `src/lib/importar/revisao.ts` [NOVO]

```ts
export type AcaoRevisao =
  | {acao:'escolher_candidato', indice:number}
  | {acao:'corrigir_numero', numero:number}
  | {acao:'corrigir_data', data:string}
  | {acao:'ignorar'}
  | {acao:'editar_campo', campo:'mentor'|'mentorado'|'duracaoMin'|..., valor:string}
  | {acao:'renumerar_lote', aPartirDe:number}      // "numera a partir do 3º"
  | {acao:'criar_dupla', mentorNome:string, mentoradoNome:string}
  | {acao:'nada', motivo:string};
export async function interpretarRevisao(texto:string, ctx:{linha, candidatos, lote}):
  Promise<AcaoRevisao | {error:string}>;
```

- Tool-call estruturada no provider; aplicação é **função pura**
  `aplicarAcao(itens, idx, acao)` — testável em Vitest sem provider.
- Casos do Jira mapeados:
  - typo → `escolher_candidato` ("é a Nicolly Silva, não a Souza");
  - "Mentorada" genérico → `editar_campo` ou `escolher_candidato` com
    candidato da lista (placeholder nunca vira auto — regra já existe);
  - ano errado → `corrigir_data` (hoje já corrige+flag; NL pode fixar
    outro ano/mês);
  - **renumeração narrativa** → `renumerar_lote` aplica `numero =
    aPartirDe + i` nas linhas selecionadas — pura;
  - **par sem dupla** → `criar_dupla` não cria direto: retorna ação que a
    UI traduz em botão "Criar dupla" → `NovaDuplaDialog` com nomes
    pré-preenchidos (fluxo humano existente — IA não escreve `duplas`);
  - "é a outra Nicolly, a do whatsapp 41 9xxxx" → `escolher_candidato`
    desambiguado pelo sufixo do contato **nos candidatos da tela** (a tool
    recebe só `ultimos4` do whatsapp de cada candidato — minimização: o
    model nunca vê o número inteiro).
- `ia_eventos` `{tool:'interpretar_revisao', args:{lote, linha, acao}}` —
  **o `texto` bruto também vai em `args.texto`** (capado a 300 chars): é
  a instrução da humana — necessária pra auditar "pediu X, aplicou Y".
  Fica no nosso DB, não vai a terceiro além da chamada em si.
- UI: por linha um `Textarea`/`Input` "Corrigir por texto…" + botão
  "Aplicar" → mostra "entendi: ação X" → confirma. Caixa de instrução em
  lote acima da tabela pra `renumerar_lote`.

## PR 4 — canal `importacao` + endurecer

- Migration `0108_ia_canais.sql` — se a 178 ainda não mergeou, este PR a
  carrega (mesmo arquivo/superset — convergência documentada no sdd da
  178 §5/0108).
- Rate-limit compartilhado (`checarLimiteIa` da 179) com cap de lote
  (≤30 chamadas LLM por lote — visão 1 + semântico ≤N linhas + revisões).
- Testes de regressão do determinístico (nada no caminho CSV muda sem
  flag).

## Questões em aberto

- `a verificar`: provider suporta visão (doc/pdf input) no plano contratado
  — se só imagem, PDF vira `pdf-lib` render→png por página server-side
  (já é dep) ou instrui coord a converter. Fallback documentado.
- `a verificar`: `importar_registros` RPC aceita `atualiza` de encontro
  existente (EncontroInfo `atualiza`) — confirmar se a linha via visão
  pode cair no mesmo caminho (deve — mesma RPC).
- Dialog novo vs. estender o atual: **decisão** = estender o
  `importar-registros-dialog.tsx` (já é a superfície de revisão; evita
  duplicar a tabela) — adicionar seção "IA" dentro.

## Rollback

`IA_IMPORTACAO_OK` unset → dialog mostra só o caminho CSV atual; nenhuma
chamada LLM; migrations são additive (canal CHECK mais largo não quebra
nada).
