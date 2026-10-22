# REALIZA-62 — "a partir de —": sweep de prazos vazios + placeholder padrão

- **Jira:** [REALIZA-62](https://kelyng.atlassian.net/browse/REALIZA-62)
- **Tier:** B
- **Veredito:** **ABERTO** — a string literal original (`a partir de —`) **não
  existe mais** no código; o problema real é a falta de um padrão pra quando
  um campo de prazo é exibido mas está `null`.
- **Esforço estimado:** **PP** (sweep de superfícies + 1 helper ou padrão de
  copy)
- **Docs:** [plan.md](plan.md) · [design.md](design.md) · [acceptance.md](acceptance.md)

## O que a issue reportava

Prazo de encaminhamento renderizando `a partir de —` (texto + dash vazio) —
caso do campo de data `null` interpolado numa frase que assumia valor.

## Auditoria: o literal morreu, o risco não

`rg "a partir de"` no `src/`:
- **`src/app/api/nudge/route.ts:90-96`** — `"a partir de"` + timestamp real do
  cooldown de 48h → **frase válida**, não é o bug.
- **`src/lib/ciclo.ts:1892-1947`** — `formatDate`/`formatDateTime`/
  `formatDiaHora`/`formatDiaMes` retornam **`"a definir"`** para `null`/
  inválido → o dash vazio não consegue mais nascer por esse caminho.

Restante: **onde o prazo é exibido quando `null`?** O sweep achou dois
padrões coexistindo:

| Superfície | O que faz com `prazo=null` | Arquivo |
|---|---|---|
| `encaminhamentos-list` | omite a linha de prazo (`t.prazo && …`) | `src/components/encaminhamentos-list.tsx` |
| `jovem-combinados` | omite (`t.prazo && …`) | `src/components/jovem-combinados.tsx` |
| `agenda-por-mentorado` | só renderiza `prazo era {…}` em `combinadosVencidos` (já filtrado non-null) | `src/components/agenda-por-mentorado.tsx:484-498` |
| `encontro-detalhe-dialog`, `duplas-lista`, `mentor-home`, `trilhas-coord-panel`, `registro-form` | omitem ou não têm campo de prazo | vários |

Ou seja: hoje **nenhuma superfície quebra** com `null` — mas cada componente
decide sozinho (omitir × renderizar). Sem padrão, o próximo componente novo
pode voltar a renderizar "a partir de a definir" (que é tecnicamente correto
mas lê como bug, igual ao `—` original).

## Escopo

**Não é um bug fix — é uma padronização preventiva:**

1. Documentar a regra: prazo `null` **omite a linha** quando a data não é o
   ponto (padrão atual, majoritário) — **nunca** renderiza `"a partir de
   a definir"` nem dash.
2. Onde o prazo **é o ponto** da linha (ex.: "vence em X" como informação
   primária — hoje não há caso, mas se surgir), o placeholder padrão é
   **`"sem prazo definido"`** — não `"a definir"` (que soa como "em breve vai
   ter", o que nem sempre é verdade: um encaminhamento pode nascer sem prazo
   intencionalmente).
3. Helper `prazoOu(t.prazo)` [NOVO se adotado] ou convenção de código — ver
   plan.md; a decisão é não inventar abstração se 1 linha de `&&` basta.

## Fora de escopo

- `trilha-prazo-badge` — a trilha especialista tem prazo real e próprio; não
  é a superfície da issue.
- Mudar `"a definir"` de `formatDate`/`formatDiaHora` — o fallback dos
  formatadores é pra **data de evento** (encontro ainda sem data = "a
  definir" faz sentido); a issue é sobre **prazo**, semântica diferente.

## Riscos

- Nenhum funcional — é convenção + possivelmente 1 helper. O único risco é o
  sweep perder uma superfície nova; por isso a regra fica escrita, não só
  aplicada.
