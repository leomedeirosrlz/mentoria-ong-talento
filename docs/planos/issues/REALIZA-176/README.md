# REALIZA-176 — `/agenda` coord: sobrecarga visual, eyebrows demais, gráficos fora da identidade

**Status: aberto.** A agenda da coordenação acumulou blocos sem passar pela
pergunta operacional: "o que pede minha ação nos próximos dias?"

## O que existe hoje

`src/components/agenda-coordenacao.tsx` (485 linhas), consumido por
`src/app/(app)/agenda/page.tsx` quando `me.role` é coordenação:

- **Seção "Semana do encontro, por cronograma"** (`:199-232`) — grid
  `lg:grid-cols-2` de `CardResumo` por turma (`:279+`): `PillTurma` eyebrow +
  `Encontro N · Tx` + número gigante `realizaram/de ativas` + **barra de 3
  segmentos** (`:318+`, fez/marcou/sem-data, "tracejado danger" citado).
- **Seção "Para acompanhar"** (`:235-256`) — `FilaAcompanhar` com linhas de
  duplas sem agendamento/atrasadas + CTA "Lembrar".
- **Seção "Semana no programa"** (`:259-272`) — `LinhaPrograma` (`:449+`)
  lista de eventos oficiais.
- `Tag` chips inline com os `<h2>` (`:204`, `:238-241`) — os "eyebrows"
  multiplicam contexto em cada seção.

## Sintomas concretos (observação)

- Cada `CardResumo` carrega 2-3 sistemas de sinal: PillTurma + número grande
  + barra segmentada + datas — o olho não acha um único "o que importa".
- A fila "Para acompanhar" (a resposta operacional) vem **depois** dos
  cartões resumo — a pergunta dos 5 s não está no topo.
- `Tag`s explicativas ("resumo por turma — nunca global") são copy de
  rodapé morando ao lado do título.

## Proposta em uma linha

Reordenar pra **"fila operacional primeiro"** (Para acompanhar sobe),
compactar os `CardResumo` em **uma linha por turma** (não cards 2×n),
rebaixar `Tag`s pra nota dentro da seção, e unificar os gráficos na
linguagem já usada (barra `bg-muted` + fill `brand-lime` — padrão da barra
de progresso dos outros painéis, sem hatch/danger inventado).

## Decisão

Tier A, UI pura. `design.md` é o documento principal.
