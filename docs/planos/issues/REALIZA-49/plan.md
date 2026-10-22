# REALIZA-49 — plan.md

## Passo 1 — serializadores por tipo (puro, Vitest)

`src/lib/forms/respostas-grade.ts` [NOVO]:

```ts
type CelulaGrade = { texto: string; longo?: string; anexoId?: string };
function celulaResposta(campo: FormularioCampo, v: RespostaValor): CelulaGrade
```

Regras (espelham o resumo existente + export CSV):
- `select`/`sim_nao`/`escala_*`/`data`/`checkbox`/`sim_nao`: valor direto;
  "Outro: x" mostra `Outro: x` (texto completo em `longo`).
- `multi_select`: `;`-join.
- `texto_longo`/`texto`: clamp — `texto` primeiras ~80 chars, `longo`
  completo (tooltip/expande).
- `arquivo` (36): `nome` + `anexoId` → célula vira link pro handler.
- `grid_disponibilidade` (36): "N faixas" + `longo` = `seg 19h; qua 09h`.
- Campo oculto por `visible_if` quando respondeu → badge sr `·` +
  `title` "oculta quando respondeu" (decisão: mostra normal — a resposta
  existe; ocultação é coisa do respondente).

`linhasGrade(campos, respostas)` → `{linhas: LinhaRelatorio-like,
colunas}` compatível com `RelatorioCanvas`. Campos `secao` nunca viram
coluna.

## Passo 2 — dados (query)

`src/lib/queries.ts` — `a verificar`: a query que alimenta
`RespostasSection` (page.tsx passa `respostas`/`links` — provável
`getRespostasFormulario` ou inline). Confirmar e estender: garantir que
cada linha traz `respondido_em`, `link.destinatario`/`contexto` (quem
respondeu) — se já vem, zero mudança; senão `React.cache` query nova
`getRespostasGrade(formId)` selecionando só o necessário.

## Passo 3 — componente grade

Opção A (preferida): **`respostas-grade.tsx`** [NOVO] em
`src/app/(app)/formularios/` — wrapper fino que monta `colunas` (campo →
`{id,label}`) e `linhas` pro **`RelatorioCanvas`** existente
(`colunas redimensionáveis`, copiar TSV, animações de coluna).
- `RelatorioCanvas` hoje é genérico sobre `ColunaRelatorio`/`LinhaRelatorio`
  — conferir assinatura (props `colunas`, `linhas`, `storageKey`,
  `editavel`, `colunasEntrando/Saindo`) e reusar sem fork. Se engessado
  pro relatório de pessoas, extrair o miolo pra `ui/` compartilhado —
  decisão no PR, sem inventar.
- Coluna fixa esquerda: **Respondente** (nome do destinatário do link —
  "link genérico" quando anônimo) + **Respondido em** (`dd/mm HH:mm`).
- Largura inicial por tipo (escala=estreita, texto_longo=larga);
  `storageKey` = `grade-respostas:<formId>` (mesma convenção do canvas).
- Botão "Copiar" já vem de graça (TSV) — mantém paridade com export CSV.

## Passo 4 — toggle Grade ↔ Resumo

`respostas-section.tsx`:
- Segmento `Resumo | Grade` no header da seção (padrão radio-group como o
  segmento do login — escolha excludente, a11y de graça). Estado em
  `?view=` (searchParam — deep-linkável, SSR seguro: ler no server
  component da ficha e passar prop) ou `useState` simples —
  **decisão: `?view=`** (a página já usa âncoras; param não quebra nada).
- Persistência leve via URL é suficiente — sem localStorage.
- Empty state grade: "Nenhuma resposta ainda" (mesmo tom do resumo).

## Passo 5 — mobile

- `< lg`: grade vira scroll horizontal com coluna Respondente sticky —
  testar; se ficar ruim, fallback = cards (Resumo) com hint "Grade
  disponível em tela maior". Decisão final no design review com
  screenshot.

## Passo 6 — testes

- Vitest: `celulaResposta` por tipo (incluindo 36), `linhasGrade` com
  resposta órfã de campo removido (campo deletado do form → coluna some,
  valor vai pra coluna "fora do form" no fim? — **decisão: órfãs
  aparecem como colunas extras no fim**, paridade com o CSV "órfãs
  preservadas").
- e2e app: coord abre ficha de form com respostas → alterna pra Grade →
  células batem com os accordions (paridade grade↔cards).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/forms/respostas-grade.ts` [NOVO] | serializadores |
| `src/lib/queries.ts` | `a verificar`/estender fetch de respostas |
| `src/app/(app)/formularios/respostas-grade.tsx` [NOVO] | wrapper RelatorioCanvas |
| `src/app/(app)/formularios/respostas-section.tsx` | toggle + integração |
| `src/app/(app)/formularios/[id]/page.tsx` | prop `view` |
| `src/components/relatorio-canvas.tsx` | possível extração de miolo |

Sem migration, sem RPC, sem action.
