# REALIZA-46 — Cadastrar turma/cronograma pela UI (builder)

- **Jira:** [REALIZA-46](https://kelyng.atlassian.net/browse/REALIZA-46)
- **Tier:** A (implementada)
- **Veredito da auditoria:** **FEITO** — falta só fechar o Jira.

## Evidências de implementação

### Rota e componente

- `src/app/(app)/turmas/novo/page.tsx` — página do builder (coord-only, junto de `/turmas` em `src/app/(app)/turmas/page.tsx:28-29` que dá `redirect("/")` fora da coordenação).
- `src/components/cronograma-builder.tsx` — wizard em 2 passos (header `:1-7`):
  1. **Parâmetros:** 1º encontro, cadência, exceções (intervalos e recesso), preparação/encerramento, fonte do conteúdo (`CONTEUDO_OPCOES`: guia DPP oficial / copiar de cronograma existente / em branco, `:52-57`);
  2. **Prévia:** lista materializada com datas/títulos editáveis inline + dialog pro resto, antes de gravar cronograma + `ciclo_eventos` de uma vez.

### Domínio e gravação

- `src/lib/gerador-cronograma.ts` — `gerarEventos()` + `validaEventos()` + `totaisCronograma()` (puro, testável com Vitest).
- `src/lib/actions-cronogramas.ts:130` — `criarCronograma()` grava cronograma + eventos (status inicial `rascunho`/`ativo`, `STATUS_OPCOES` do builder `:50-52`).
- `src/app/(app)/turmas/page.tsx` — listagem por status com link "Nova turma" (`:52`,`:80`) apontando pro builder.

## Ação

Fechar o Jira apontando `/turmas/novo` + `cronograma-builder.tsx` + `criarCronograma` como entrega.
