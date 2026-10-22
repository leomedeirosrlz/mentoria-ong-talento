# REALIZA-56 — design/UX

## Persona + JTBD

Coordenação (Léo/Kelyng) abre `/relatorios` segunda de manhã: "como o
programa está, quem precisa de mim, o que conto pra diretoria?". Hoje ela
monta a grade e lê linha a linha. O hub responde **por blocos**: quantos
em risco e por quê, quem faltou, o que venceu, quantos docs pendentes —
e cada bloco leva ao caso (link pra ficha), não é relatório de ler e fechar.

5 segundos: "programa está bem?" (semáforo + aderência no topo); 30s: "quem
precisa de ação?" (listas de atenção); 2min: "o que reporto?" (digest
copiável).

## Hierarquia (desktop — uso primário da coord)

```
┌─ /relatorios ────────────────────────────────────────────┐
│ Relatórios                                    [filtros ▸] │
│ T2 · 2026/2027 · todas as duplas · ativas+pausadas        │
│                                                           │
│ ┌─ semáforo ─┐ ┌─ aderência ─┐ ┌─ apoio ───┐ ┌─ docs ────┐│
│ │ ●●○ 24 ok  │ │ 87% esperado│ │ 3 abertos │ │ 6 pendent.││
│ │ 6 atenção  │ │ atraso 2,1d │ │ mais velho│ │ 2 vencendo││
│ │ 2 risco    │ │             │ │ 9 dias    │ │           ││
│ │ mini-série │ │             │ │           │ │           ││
│ └────────────┘ └─────────────┘ └───────────┘ └───────────┘│
│                                                           │
│ ┌─ precisam de atenção ─────────────────────────────────┐│
│ │ Maria & João — 2 atrasos, registro pendente → /duplas/x ││
│ │ …(max ~6 itens, "ver todas" → builder filtrado)         ││
│ └───────────────────────────────────────────────────────┘│
│                                                           │
│ [engajamento] [remarcações] [presenças] [instrumentos]    │
│                                                           │
│ ┌─ digest da semana ─┐  texto copiável                    │
│ └────────────────────┘                                    │
│                                                           │
│ ─── Grade personalizada (builder atual, inalterado) ───   │
└───────────────────────────────────────────────────────────┘
```

- **Topo = saúde:** 4 cards grandes (semáforo com mini-série, aderência,
  apoio, documentos) — os números de "tudo bem?" num relance.
- **Segundo = ação:** uma lista consolidada "precisam de atenção" — o merge
  dos motivos dos blocos (risco, apoio aberto, doc vencendo, falta) —
  deduplicada por dupla, cada item com link.
- **Terceiro = contexto:** engajamento, remarcações, presenças, instrumentos
  em cards médios (grid 2 col).
- **Digest** — texto da semana pronto pra colar no WhatsApp/relatório.
- **Builder** desce pra baixo com título "Grade personalizada" — o usuário
  atual encontra onde sempre esteve.

## Filtros — barra de chips/select

`filterChipCls` + `Select` do ui/: `Turma` (default: todas ou a atual),
`Cronograma` (popula quando turma escolhida), `Dupla` (search picker — se
houver combobox; senão select com nomes), `Status` (chips multi
ativa/pausada/concluída/encerrada). Mudança → `router.push` com
searchParams (compartilhável). Reset: "Limpar filtros" quando algum ativo.

## Mobile

Cards empilham 1 col; lista de atenção vira acordeão? Não — lista plana
mesmo (coord em mobile consulta rápido: scroll). Filtros viram 2 linhas de
chips horizontais com scroll. Mini-série mantém 100% width.

## Estados (por bloco)

| Estado | Render |
|---|---|
| Loading | `Skeleton` do ui/ no shape do card (nº + 3 linhas) |
| Sem dados no recorte | "Nenhuma dupla neste recorte" — card inteiro |
| Sem problema | verde feliz? Não — "0 em risco" neutro, sem festa (métrica operacional) |
| Dado parcial | nota discreta no rodapé ("remarcações conta encontros, não vezes") |
| Stale (snapshots) | badge `--warn` "dados até 12/10" no card do semáforo |
| Permissão | página já gateia coord — sem estado novo |

## Microcopy real

- Semáforo: "Em dia · Atenção · Risco" + tooltip "Semáforo computado agora;
  série desde <dia>".
- Aderência: "X% dos encontros esperados aconteceram".
- Apoio: "pedidos de ajuda em aberto" + item "há N dias — mentor/jovem".
- Documentos: "assinaturas pendentes" + "vencem em ≤7d".
- Digest: "Resumo da semana — pronto pra enviar" + botão "Copiar texto".
- Lista de atenção: "Precisam de atenção (N duplas)" + "ver todas →".

## Componentes reutilizados

`Card`, `Select`, `Badge`, `Button`, `Skeleton`, `Tooltip` (ui/), `sonner`
toast, `filterChipCls`. **Nenhum** componente novo de UI kit — só
`DashCard`/`DashFiltros`/`SparkSemaforo`/`DigestCard` compostos dos acima.
Sem chart lib (sparkline SVG inline; se o PR quiser lib, registrar decisão).

## a11y

- Cards = `section` com `h2` visível (ordem lê: semáforo → ação → contexto).
- Números de status com `aria-label` ("2 duplas em risco").
- Lista de atenção = `ul` com links nomeados ("Maria & João — motivo").
- Mini-série `role="img"` + `aria-label` resumindo a tendência; texto alt.
- Filtros com `Label`/`aria-label`; chips de status `aria-pressed`.
- Contraste: tons `--ok`/`--warn`/`--danger` já usados no semáforo/badge.
