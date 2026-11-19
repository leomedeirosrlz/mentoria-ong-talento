# Plano — Importar cronograma de turma (REALIZA-34)

## Arquitetura

```
arquivo ──► extrair.ts (server) ──► { text } ou { linhas[][] }
   ├─ .csv/.tsv/.txt → texto direto (BOM/encoding)
   ├─ .xlsx/.xls      → xlsx.read → sheet_to_json(header:1)
   ├─ .docx           → mammoth.extractRawText
   └─ .pdf            → pdfjs-dist/legacy → textContent por página (≤40 pág)
        │
        ▼
normalizar.ts (puro) ──► RascunhoImportacao { turma?, nome?, eventos, avisos, confianca }
   heurísticas: tabela (planilha) ou texto linha-a-linha;
   "Encontro N", datas dd/mm(/aaaa), intervalos, recesso, formação,
   encerramento, etapas de preparação, fases DPP por título conhecido
        │
        ▼ (confianca < 0.6 ou pedido do usuário)
ia.ts — chamarModelo + toolChoice obrigatório → mesmo schema → validaEventos
        │
        ▼
CronogramaBuilder (importado) → revisão/edição → criarCronograma → /turmas/<id>
```

## Arquivos

- `src/lib/importar-cronograma/extrair.ts` — extrai por extensão; limites de tamanho/páginas; erros pt-BR.
- `src/lib/importar-cronograma/normalizar.ts` — puro, sem Next/Supabase; caminho tabela (linhas[][]) e caminho texto; datas pt-BR (`dd/mm`, `dd/mm/aa`, `dd/mm/aaaa`, nomes de mês); deduz `turma` ("Turma 3", "2026/2027") e `nome` quando achar no cabeçalho.
- `src/lib/importar-cronograma/ia.ts` — schema da tool `entregar_cronograma`, monta prompt com as regras do schema + chamada `chamarModelo` (`toolChoice` forçado); parse defensivo do JSON (o provider pode variar no `arguments`).
- `src/lib/actions-importar-cronograma.ts` — `importarCronogramaRascunho(formData)` e `importarCronogramaComIa(payload)`; `meCoord()`; nunca grava.
- `src/components/importar-cronograma-card.tsx` — upload + status + botão IA condicional; devolve `RascunhoImportacao` pro pai.
- `src/components/nova-turma-flow.tsx` — escolha de modo ("Montar" / "Importar"); importado → `<CronogramaBuilder importado=…>`; página `/turmas/novo` passa a renderizá-lo.
- `src/components/cronograma-builder.tsx` — prop opcional `importado`: inicia em `etapa="previa"` com `linhas` + identidade pré-preenchidas e banner de avisos/origem.
- `src/lib/importar-cronograma/normalizar.test.ts` — fixtures dos 4 formatos + casos fracos.
- `tests/e2e/app/turmas-importar.spec.ts` — CSV → prévia → salvar → `/turmas` mostra card (labels `E2E Import`, sweep próprio).

## Dependências novas (pinned, >7d)

`pdfjs-dist` (legacy build, extração de texto em Node), `mammoth`, `xlsx@0.18.5` (community, também lê CSV/XLS).

## Riscos

- PDF de cronograma real pode divergir das heurísticas → a revisão humana + fallback IA são o amortecedor; parser fraco ainda entrega rascunho com avisos.
- `chamarModelo` não-streaming + toolChoice: o provider (OpenAI-compatible) deve honrar; tratado com erro limpo se vier vazio.
