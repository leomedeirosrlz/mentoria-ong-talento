# REALIZA-174 — plano de execução

## Alvo

`src/components/duplas-lista.tsx` — acabamento de densidade. Sem mudança de
query/schema; os dados já chegam completos (`getDuplas` + `saudePorId`).

## Passos

1. **LinhaDupla mobile** (`:242`): `p-4` → `p-3`, `gap-3` → `gap-2`.
2. **Sinais** (`:336-365`): `line-clamp-1` + `title={texto completo}` —
   altura uniforme por linha.
3. **`VisaoSupervisor`** (`:1292-1450`): trocar o template de card pelo
   `LinhaDupla` (ou wrapper com mesmas `GRID_COLS`) — a verificar se o shape
   `Dupla`+`Saude` dela bate com o da coord (aparentemente sim — mesma fonte).
4. **`VisaoMentor`/`VisaoEspecialista`** (`:1684`, `:1888`): footer
   `border-t border-dashed` só renderiza com ≥2 filhos de ação; 1 ação →
   mover pro header do card; 0 → remover o `div` inteiro.
5. **LegendaSemaforo** (`:1283`): verificar se o bloco é só a legenda de
   dots — se tiver conteúdo "footer" redundante após a lista, fundir com a
   barra de contagem que já existe acima (`:1195-1209`).
6. **Coluna "avaliação"** (`:336-365`): pill numérica `text-xs` quando
   largo — a verificar overflow com ≥3 dígitos.

## Verificação runtime (obrigatória — o "footer morto" é relato visual)

`entrarNaDemo` nos 4 papéis → `/duplas` → screenshot + inspecionar:
(a) última célula de `LinhaDupla` (`:368-380` — só "Ver ficha"? WhatsApp
está aí?) e (b) o footer dos cards mentor/especialista. Documentar no PR.

## Risco / rollback

Visual-only; specs e2e de `/duplas` usam texto/role — `CatChip`, "Ver
ficha", nomes de dupla continuam. Rollback = revert.

## Gates

`tsc` · `eslint` · `pnpm test` · e2e demo `/duplas` em `coordenacao`,
`supervisor`, `mentor`, `especialista` + e2e app idem.
