# REALIZA-39 — design.md

## Persona & JTBD

- **Coordenação**: "quem são as pessoas da T2?" — resposta em 1 clique, sem exportar CSV.
- **Auxiliar executivo** (pós-32): a lista já chega escopada — os chips refletem só a(s) turma(s) dele.

## Proposta

### Chips de turma na barra de filtros

Mesma linha dos chips "Livres para dupla"/"Fora do programa" (`pessoas-listas.tsx:355-417`) — antes do `Select` de ordenação:

```
[🔍 Buscar por nome ou e-mail]  [Livres para dupla 4] [Fora do programa 2] | [Todas] [T1 · 2026/2027 18] [T2 · 2026/2027 9] [Sem turma 6] | [Ordenar ▾]
```

- "Todas" (default, `turmaSel=null`) replica o comportamento `turmaSel` de `duplas-lista.tsx:1097-1108` — `aria-pressed`, `filterChipCls`, contador `tabular-nums`.
- Rótulo do chip: `partesTurma` → "Turma 2 · 2026/2027" (curto) — ou rótulo verbatim; usar `partesTurma().nome` + ano pequeno pra consistência com `fila-acompanhar`.
- Visível **só quando >1 turma** (uma turma não ganha chrome novo — regra de silêncio do codebase).

### Efeito nos dados

- Filtra `pessoasExibidas` **e** `mentoradosExibidos` (e "Fora"/"Inativos" continuam arquivos — chip de turma aplica-se a eles também, mantendo consistência).
- `FilaEspera` + `MatchingPanel`: respeitam o chip (fila da T2 ≠ fila da T1 — decisão de produto: **sim**, a fila é por turma operacionalmente; documentar no cabeçalho da fila quando filtrada).
- Contadores de seção ("Com acesso (n)") refletem o filtro — mesmo padrão de `filtrando` já existente (`:450`,`:534`).

### `PillTurma` nas linhas (opcional, recomendado só na visão "Todas")

`PillTurma` (`agenda-partes.tsx:54-64`) ao lado do nome nas `PessoaRow`/`MentoradoRow` quando `turmaSel===null && turmas>1` — contexto passivo sem clicar em nada. Avaliar densidade; se poluir, só nos mentorados.

## Estados

- **Vazio filtrado**: "Ninguém na Turma 2" + "Limpar filtro" (mesma anatomia dos empty states `:453-506` — ícone + título + sub + botão ghost).
- **Busca + turma**: chips e busca combinam (`filtrando` já contempla).
- **Sem turma** como chip: agrupa quem nunca pareou / staff global — sub-copy "Sem vínculo com turma" implícito pelo rótulo.
- **Permissão**: chips são `souCoord`-only inicialmente (barra inteira já é `:355`); pra mentor/supervisor avaliar expor depois — **não** expor contagem de outras turmas ao auxiliar mono-turma (sdr).
- Loading/erro: server-side, herda do padrão atual (nenhum skeleton novo).

## Mobile → desktop

Chips wrap em 2 linhas no mobile (`flex flex-wrap` existente); Select de ordenação vai pra linha 2 com `w-full` se preciso. Nenhum layout novo.

## Acessibilidade

`aria-pressed` nos chips (padrão existente); `aria-label="Filtrar por turma"` no grupo; ordem de tab natural após a busca.
