# REALIZA-62 — Design / UX

Padronização de placeholder de prazo nulo. Não há componente novo — é a regra
de microcopy pra um estado que hoje é decidido caso a caso.

## O princípio

Um campo de prazo `null` diz uma de duas coisas:
- **"não se aplica aqui"** — o prazo não é o ponto da linha (encaminhamento
  listado com outros metadados): **omitir a linha**. Renderizar `"sem prazo
  definido"` nesse caso é ruído — o usuário não perguntou pelo prazo.
- **"não tem prazo"** — o prazo é a informação primária e está vazio
  intencionalmente: **`"sem prazo definido"`**. É afirmação de estado, não
  placeholder de loading.

O que **nunca** renderiza:
- `—` (dash solto lê como dado faltando/bug);
- `"a partir de a definir"` (frase gramatical com placeholder dentro —
  exatamente o bug original com roupagem nova);
- `"a definir"` num campo de **prazo** (soa "em breve vai ter prazo" — falso:
  encaminhamento sem prazo é estado legítimo, pode nunca ter).

## Distinção semântica que a regra protege

`formatDate`/`formatDiaHora` retornam `"a definir"` pra `null`
(`ciclo.ts:1892-1947`) — **correto pra data de evento**: um encontro ainda
sem data é "data a definir" (vai existir, só não foi marcada). **Prazo** é
diferente: "sem prazo definido" afirma que não há um, não que um virá. A
issue é sobre prazo — não tocar o fallback dos formatadores de data de
evento.

## Matriz por superfície atual

| Superfície | `prazo=null` hoje | Regra | Mudança |
|---|---|---|---|
| `encaminhamentos-list` | omite linha | correto | nenhuma |
| `jovem-combinados` | omite | correto | nenhuma |
| `agenda-por-mentorado` (`combinadosVencidos`) | só mostra quando non-null | correto (a linha só existe pra vencidos) | nenhuma |
| demais (`duplas-lista`, `mentor-home`, `encontro-detalhe-dialog`, `trilhas-coord-panel`, `registro-form`) | omitem ou não têm campo | correto | nenhuma |
| **futura superfície** onde prazo é o ponto | — | `"sem prazo definido"` | convenção a aplicar |

## Microcopy (pt-BR)

- Prazo nulo, informação primária: `sem prazo definido`.
- Prazo vencido (já existe): `venceu em {formatDate}` / `prazo era
  {formatDate}` — inalterado.
- Prazo no futuro: `até {formatDate}` / `vence em {formatDate}` — inalterado.

## A11y

- O placeholder é texto — sem depender de cor/posição.
- `"sem prazo definido"` não deve ser muted a ponto de sumir se é a
  informação primária da linha — mesma cor do texto secundário normal.

## O que NÃO fazer

- Não trocar `"a definir"` dos formatadores de data de evento.
- Não criar componente `PrazoBadge` — não há variação visual suficiente pra
  justificar.
- Não mexer em `trilha-prazo-badge` (prazo real de trilha, superfície
  diferente).
