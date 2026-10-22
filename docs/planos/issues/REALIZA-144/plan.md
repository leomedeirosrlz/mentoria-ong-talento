# REALIZA-144 — plan.md

Escopo do issue: **instrumentos de jornada primeiro** (`visao`, `metas`,
`pdm`, `roda_vida` — os que têm experiência sob-medida em
`src/components/instrumentos/` e já são respondidos em `/f/[token]`), e o
**renderer genérico** (`formulario-publico.tsx`) na mesma entrega porque
a mecânica é compartilhada. Os instrumentos hoje renderizam todas as
seções numa página única (`agrupaEmSecoes` → `blocos.map`, visao/metas/
pdm/roda_vida) — o wizard vira o chrome que pagina esses blocos.

## Passo 1 — derivação pura `etapas(campos)`

`src/lib/forms/instrumentos.ts` (arquivo puro já existente) ou novo
`src/lib/forms/wizard.ts`:

```ts
type Etapa = { secao: FormularioCampo | null; campos: FormularioCampo[] };
function etapas(campos: FormularioCampo[]): Etapa[] // = agrupaEmSecoes
```

Decisão de gatilho — `modoEtapa(campos)`:
- `campos` contém ≥1 `secao` **e** bloco inicial `secao:null` não vazio →
  bloco inicial vira "Etapa 1" sem título (não dropar campos órfãos).
- Form **sem** `secao` → comportamento atual (página única), zero
  regressão — wizard é opt-in pela estrutura.
- Prop opcional `wizard?: boolean` em `formularios`? **Não** — decisão:
  a presença de `secao` já é a intenção do autor (é como o GForms trata
  "adicionar seção"). Sem coluna nova, sem migração.
- Helper `etapaDoCampo(campoId, etapas)` p/ o submit com erro focar a
  etapa certa.

Testáveis (Vitest): `modoEtapa`, `etapas` (órfãos, secao no fim,
secao dupla seguida → etapa vazia é fundida ou pulada).

## Passo 2a — instrumentos: etapas dentro de cada renderer

Os renderers sob-medida já consomem `agrupaEmSecoes` (`metas.tsx:40`,
`pdm.tsx:39`, `visao.tsx:31`) e `extraiGruposMeta`/`extraiEstruturaRoda`.
Cada um ganha o conceito de etapa:

- **`visao`/`metas`/`pdm`**: `blocos` = etapas naturais (cada `secao` é
  um capítulo do guia). `pdm` tem `capitulo` explícito já calculado.
- **`roda_vida`**: `estrutura.intro` = etapa 0; cada quadrante = uma
  etapa (o desenho `RodaSvg` mini fica fixo no canto? — **decisão:
  etapa por quadrante com a roda inteira no topo do card** — manter o
  contexto visual é o valor do instrumento); `extras` = etapa final.
- `InstrumentoFlow` (casca comum) recebe o chrome do wizard: passo
  state, pill "Etapa X de N", rodapé Avançar/Voltar, `hidden` por etapa
  — os filhos (`<Visao>`, `<Metas>`…) recebem prop `etapaAtual`/`soEtapa`
  para renderizarem só o bloco ativo **visualmente** (campos continuam
  montados — ver passo 3). Caminho simples: cada renderer filtra
  `blocos[etapaAtual]` dentro de um wrapper não-desmontado. Os inputs
  são controlados por `api.valores` (use-resposta) — conferir: se
  algum input lê só do DOM (uncontrolled), `hidden` preserva; se
  desmontar perde. **a verificar**: controlled vs uncontrolled em
  `campos.tsx` dos instrumentos — se uncontrolled, `hidden` é
  obrigatório e o filtro por bloco vira `hidden={i!==etapa}` por bloco,
  não slice do array.
- CTA do instrumento (`CTA[sistema]` — "Registrar minha visão" etc.)
  aparece só na última etapa; demais etapas = "Avançar".

## Passo 2b — renderer genérico `formulario-publico.tsx`

Estrutura mínima dif:

```tsx
const E = useMemo(() => etapas(campos), [campos]);
const wizard = E.length > 1;
const [passo, setPasso] = useState(0);
```

- **Etapas montadas sempre**: cada `Etapa` renderiza dentro de
  `<div hidden={i!==passo}>` — padrão `RegistroForm` (BACKLOG "wizard 3
  etapas — etapas montadas com `hidden`, FormData/rascunho intactos").
  Nada de `AnimatePresence` desmontando campos (perderia valores).
- `use-resposta.ts`: `validaResposta` ganha modo por-etapa —
  `camposDaEtapa = E[passo].campos` visíveis (aplica `visible_if` do 36);
  `Avançar` valida só a etapa e rola/foca no heading do próximo passo;
  `Voltar` nunca valida; submit final valida **todas** as etapas e salta
  pra primeira com erro (`setPasso(idx)` + scroll + foco + `role=alert`).
- Enter dentro de input de etapa → "Avançar", não submit (só o botão
  final submete — `type="submit"` explícito só no último passo; Enter em
  etapa intermediária previne default).

## Passo 3 — chrome do wizard

- Pill sticky evolui: `{wizard ? `Etapa {passo+1} de ${E.length}` :
  "N de M respondidos"}` — quando wizard, a barra mede
  `(passo+1)/E.length`; dentro da etapa, sub-contagem "x de y nesta
  etapa" vira caption discreto (design.md).
- Rodapé sticky: `Voltar` (ghost, some no passo 0) | `Avançar`/`Enviar
  resposta` (lime, último passo). 44px, safe-area — mesma régua do pill.
- Transição: wrapper `motion.div` por etapa com `fade`+slide leve
  (`x: ±12`) e `T.micro`; respeita `MotionConfig reducedMotion="user"`
  já no root. As etapas continuam montadas (`hidden`) — a animação é do
  container visual, não do form.
- Foco: heading `h2` da etapa recebe `tabIndex={-1}` + foco no mount do
  passo (padrão `focoEnviado` ref-callback; `mode="wait"` atrasa alvo —
  focar via ref callback como no sucesso).
- Heading da etapa = `secao.label`; etapa `secao:null` usa "Suas
  informações" (fallback pt-BR documentado).

## Passo 4 — rascunho & refresh (decisão explícita)

- Link público é **uso único** (`formulario_links.usado_em`) e submit é
  atômico — não existe resposta parcial no servidor. Wizard **não** cria
  rascunho remoto.
- Refresh/F5 = começa do zero (estado em memória). Honeypot intacto.
- `beforeunload` quando `valores` não-vazio e >passo 0 — mesmo aviso do
  builder ("beforeunload quando dirty", sprint v2). Nada de localStorage
  (privacidade — decisão registrada no BACKLOG forms v1: "rascunho
  localStorage do form público (privacidade — avaliar)" ficou de fora;
  wizard mantém a decisão).

## Passo 5 — preview, demo, resumo

- `FormularioPreview` (ficha coord): wizard funciona na prévia
  (`preview` já desliga submit — Avançar/Voltar continuam vivos pra
  avaliar a navegação).
- Demo `src/lib/demo/`: form demo ganha `secao`s (editar dataset —
  verificar se já há; se não, adicionar "Cadastro demo" com 3 seções).
- `respostas-section`/export: **zero mudança** (secao já é ignorada nas
  respostas).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/forms/wizard.ts` [NOVO] ou `instrumentos.ts` | `etapas`, `modoEtapa`, `etapaDoCampo` — puro |
| `src/app/f/[token]/formulario-publico.tsx` | passo, rodapé, chrome, validação por etapa, beforeunload |
| `src/components/instrumentos/use-resposta.ts` | `validaResposta(camposSubset)` por etapa |
| `src/app/(app)/formularios/formulario-preview.tsx` | nada (herda) |
| `src/lib/demo/*` | form demo com seções |
| `tests/e2e/app` | spec wizard |

## Ordem de PR & rollback

Um PR após 36 mergear (mesmo renderer). Rollback = revert: sem schema,
sem dados — forms com `secao` voltam a página única.
