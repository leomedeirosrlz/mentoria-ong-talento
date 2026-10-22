# REALIZA-174 — `/duplas` overview: densidade, footers mortos, viz por tipo de dado

**Status: parcialmente entregue — a visão coordenação já é densa; faltam as
outras visões e o acabamento.** A issue pede "linhas densas, sem footer
quase vazio, altura compacta, gráficos por tipo de dado".

## O que já existe

`src/components/duplas-lista.tsx` (visão coordenação):

- `LinhaDupla` (`:195-380`) — linha `lg:grid` de 6 colunas
  (`LAYOUT_COLS`/`GRID_COLS` `:193`) com `px-5 py-3`, sem espaço entre
  linhas (`divide-y`) — **densidade tabela já entregue pra coord**.
- `LinhaMini` (`:382-430`) — variação ainda mais compacta pra "massa".
- `<details>` "Mostrar as outras N duplas" (`:1253-1278`) — a massa cinza
  já não polui a lista.
- Header de coluna `lg:grid` (`:1231-1243`) — Status/Dupla/Feito×esperado/
  Sinais/Avaliação — a "tabela" existe.
- Viz por tipo já parcial: progresso de encontros = barra com ticks
  (`:307-330`), semáforo = dots cor-de-papel (`:248-258`), sinais = texto
  (`:336-365`), distribuição = `CatChip` com contagens (`:453-490`).

## O que ainda falta (a verificar vs. confirmado)

- **Footer morto perto do WhatsApp** — a confirmar em runtime: `LinhaDupla`
  tem um card-only mobile `border-t` implícito? Os cards de
  `VisaoMentor`/`VisaoEspecialista` (`:1684`, `:1888`) têm `border-t
  border-dashed` com poucas ações — provável alvo do "footer quase vazio".
- **Altura por dupla** — `LinhaDupla` usa `py-3` em lg mas `p-4` + gaps em
  mobile; revisar se o card mobile pode perder altura.
- **Outras visões** — `VisaoSupervisor` (`:1292-`) e `VisaoMentor`/
  `VisaoEspecialista` ainda são cards `sm:grid-cols-2` — densidade não
  chegou nelas.
- **"Gráficos otimizados por tipo"** — semáforo/distribuição OK; encontros
  já têm timeline de ticks; o que falta é revisar se "sinais" e "avaliação"
  usam a representação certa (texto vs. dot vs. mini-barra).

## Decisão

Tier A, UI pura. Escopo = acabar a densidade onde ela não chegou + cortar os
footers mortos + confirmar a escolha de representação por coluna.
`design.md` é o doc principal.
