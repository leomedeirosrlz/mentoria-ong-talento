# _done-U — Cluster U (UX das telas da coord — feedback direto do Thiago): 173, 174, 175, 176, 177, 153, 154, 157, 162, 172

## Produzido

### READMEs de evidência (veredito **FEITO** — só fechar Jira)

- `REALIZA-153/README.md` — sugestão de remanejo já é `Collapsible.Root`
  recolhido por padrão em `src/components/remanejo-sugerido.tsx:74-91`
  (comentário cita a issue); e2e `tests/e2e/demo/remanejo-capacidade.spec.ts:26-31`
  assegura `aria-expanded="false"`. Falta só marcar Done.
- `REALIZA-154/README.md` — seção "Combinados" gateada por
  `(dupla.encaminhamentos?.length ?? 0) > 0` em
  `src/app/(app)/duplas/[id]/page.tsx:1004-1049`. Resíduo opcional
  documentado: `EstadoVazio` de `encaminhamentos-list.tsx:61-70` ficou
  inalcançável (componente só é usado ali).
- `REALIZA-162/README.md` — jornada do jovem já tem os 3 pedidos
  implementados e citando a issue: "A fazer agora" (`page.tsx:429-454`),
  trilha compacta rail único (`:529-576`, comentário `:532`), acervo
  `grid sm:grid-cols-2 xl:grid-cols-3` (`:1091`). Resíduo a verificar:
  fallback `BibliotecaJovem` (`:1228`) pode ainda ser coluna única.

### Planos completos (veredito **ABERTO**)

- `REALIZA-173/` — `/materiais` vira hub por encontro: trilha de cobertura
  1-16 (lime/tracejado/amarelo) + `<details>` por encontro +
  `MaterialActions`/`NovoMaterialDialog`/`PainelJornada` preservados.
  Sem schema → sem `sdd.md` (registrado no plan).
- `REALIZA-174/` — `/duplas` **parcialmente entregue**: visão coord já é
  tabela densa (`GRID_COLS`, `LinhaDupla`, `LinhaMini`, massa em
  `<details>`). Plano cobre o resto: footers mortos em VisaoMentor/
  VisaoEspecialista (`:1684`,`:1888`), densidade na VisaoSupervisor,
  sinais truncados em 1 linha, tabela "dado → visualização" explícita.
- `REALIZA-175/` — `/registros` desktop: `?grupo=dupla|semana|avaliacao`
  (server-side sobre `itens`, função pura nova), `max-w-3xl`→`max-w-5xl`,
  grupos em `xl:grid-cols-2` no modo dupla, dialog de filtros
  `sm:max-w-lg`→`sm:max-w-md`. Busca já existe (`filtros.q`) — registrado.
- `REALIZA-176/` — `/agenda` coord: reordena seções (fila operacional 1ª),
  `CardResumo`→linha única por turma, barra 3-segmentos `danger` tracejado
  (fora da identidade) → barra lime padrão, `Tag`s-eyebrow viram nota
  `text-xs`. Sem dado novo.
- `REALIZA-177/` — sweep dos ~51 `DialogContent`: escala semântica
  sm/md/lg/xl/2xl/6xl, remoção de `max-h`/`overflow-y-auto` redundantes
  (`evento-cronograma:72`, `jornada-rever:54`, `instrumentos-dupla:213`),
  reclassificação com tabela no PR, auditoria `DialogTitle`/`Description`.
- `REALIZA-157/` — menu "Mais": fix robusto = dialogs fora do popup
  (`DropdownMenuItem` + `onClick` controlado na página), popup volta a ser
  `DropdownMenuContent` — elimina o `keepMounted` hand-rolled e a
  composição `Dialog.Trigger render={Menu.Item}`.
- `REALIZA-172/` — **PARCIAL confirmado**: 7 débitos. `atribuido_nome`
  populado mas não renderizado em `JovemChamados` (decisão: mostrar
  "Responsável: nome" ou parar de buscar); `getCicloEventos` morto na
  agenda jovem (remover — RLS zera); agenda sem CTA de encerramento
  (motivo novo "encerramento pendente" em `agenda-coordenacao`);
  `/assinar/[token]` sem faixa demo; demo sem `outra_pessoa`
  (`demo/queries.ts:1938`); **2 "a verificar"**: edição evento esp ×
  `cronograma_id` (caminho principal confirmado-OK em
  `cronograma-editor.tsx:704-715` — suspeita documentada) e card
  "expirado" de terceiros (existe em `t/[token]/page.tsx:100-115` —
  alcance depende da RPC `terceiro_por_token`, verificar
  `pg_get_functiondef` no staging).

## Vereditos × auditoria

| Issue | Veredito | Entrega |
|---|---|---|
| 153, 154, 162 | FEITO | README evidência + acceptance — fechar Jira |
| 173, 174, 175, 176 | ABERTO | README + plan + design + acceptance (+sdr em 175/176) |
| 177 | ABERTO | README + plan + design + acceptance |
| 157 | ABERTO | README + plan + design + acceptance |
| 172 | PARCIAL | README + plan + sdr + acceptance (7 itens, 2 "a verificar") |

## Ressalvas

- **174 e 175 já parcialmente entregues**: `/duplas` coord já é denso e a
  busca de `/registros` já existe — os planos cobrem só o que falta, com a
  parte entregue evidenciada na README.
- **162 parece 100% entregue** — os comentários citam a issue; acceptance
  marca 1 verificação pendente (fallback `BibliotecaJovem`).
- **172 itens 6 e 7 ficaram "a verificar"** por dependerem de inspeção de
  RPC/DDL no staging — o plano diz exatamente onde olhar.
- Nenhum schema/RPC `[NOVO]` proposto — cluster todo é UI/débito; o único
  SQL possível seria o flip lazy na RPC `terceiro_por_token` (172.7), se o
  bug for confirmado — marcado `[NOVO]` no plan.
- Sem Blocker — nenhuma decisão depende do Thiago pra avançar.
