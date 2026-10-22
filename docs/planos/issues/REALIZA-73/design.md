# REALIZA-73 — design.md

## Persona & JTBD

- **Coordenação**: "estou trabalhando na T2 hoje — quero que tudo que eu abrir seja da T2 até eu trocar" e "quero ver de relance como cada turma está".

## Hub de turmas na home (quando >1 turma)

Bloco no topo do `DashboardCoordenacao`, antes dos resumos por cronograma:

```
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Turma 1        2026/2027    │ │ Turma 2        2026/2027    │
│ Calendário oficial · ativo  │ │ Calendário oficial · ativo  │
│ 12 duplas · 2 em atenção    │ │ 14 duplas · 1 em risco      │
└─────────────────────────────┘ └─────────────────────────────┘
```

- `TurmaHubCard` `[NOVO]`: rotulo forte + ano (`partesTurma`), nome do cronograma vigente daquela turma + `StatusBadge` (componente existente, `cronograma-editor.tsx:82`), contagens derivadas de dados já carregados na home (duplas por `d.turma`, semáforo agregado). Clicável inteiro (`<a>`/Link com card — padrão casa).
- "Todas as turmas" não é card — é o estado sem filtro (hub sempre visível; contexto ativo marca o card com ring/borda — `aria-current`).

## Seletor de contexto

- Posição: à direita do `PageHeader` nas páginas-alvo (ou faixa própria abaixo do header) — `Select` com options "Todas as turmas" + rótulos. `[NOVO]`, mesma gramática do Select de ordenação (`pessoas-listas.tsx:394-415`).
- Estado ativo explícito: quando foco ≠ "todas", faixa fina `muted` sob o header: "Mostrando: Turma 2 · 2026/2027 — [ver todas]" (link limpa). Evita o "cadê a T1?".

## Estados por superfície

- **1 turma no sistema**: sem hub, sem seletor (regra de silêncio).
- **Contexto sem dados**: home filtrada mostra cards vazios do recorte ("Nenhuma dupla nesta turma ainda" — anatomia dos empty states existentes).
- **`?turma=` inválido**: cai em "Todas" silenciosamente (falha fechada; não erro).
- **Permissão**: seletor/hub só `coordenacao`; auxiliar (32) tem turma do escopo — se multi-turma, pode ver o mesmo seletor limitado às dele (decisão: sim, mesma UI, options filtradas; se mono-turma, faixa informativa sem seletor).
- **Demo**: idêntico — dataset já tem T1+T2.

## Mobile → desktop

- Hub: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (mesma base do grid de `/turmas`).
- Seletor: `w-full` no mobile dentro da faixa de contexto; à direita no desktop.

## Microcopy

- "Todas as turmas" / "Mostrando: Turma 2 · 2026/2027" / "ver todas".
- Card CTA implícito — o card inteiro navega; sem botão "Entrar".

## Acessibilidade

- Cards do hub como links nomeados (`aria-label="Turma 2 · 2026/2027 — 14 duplas"`); faixa de contexto com `role="status"`; `aria-current` no card/contexto ativo; `Select` com `aria-label="Turma em foco"`.
