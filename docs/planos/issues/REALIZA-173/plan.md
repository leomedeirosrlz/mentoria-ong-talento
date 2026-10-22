# REALIZA-173 — plano de execução

## Alvo

`src/app/(app)/materiais/page.tsx` — refatorar a renderização em hub por
encontro, **sem tocar** em `getMateriais`/`getCicloEventos`/`PainelJornada`/
`NovoMaterialDialog`/`MaterialActions` (queries e actions ficam intactas).

## Passos

1. **`materiais-cobertura.tsx` [NOVO componente]** — trilha 1-16
   (`for n = 1..16` — `maxEncontros("dpp")` se quiser respeitar o teto do
   cronograma): célula `size-7 rounded-md` numerada; estado = `coberto`
   (≥1 material com `path || url`), `parcial` (só `em breve`), `vazio`.
   Props: `materiais: Material[]`, `audiencia` atual.
2. **`page.tsx`** — trocar o `map` de grupos por:
   - `<CoberturaTrilha materiais={…} />` (só se `materiais.length > 0`);
   - lista de `<details>` por encontro (`1..16` + "Transversais");
   - dentro, as linhas de material existentes (extrair pra componente
     `LinhaMaterial` local se o JSX crescer — a linha hoje já existe inline).
3. **`novo-material-dialog.tsx`** — aceitar `defaultEncontro?: number`
   (a verificar se já existe a prop; se não, `[NOVO]` prop) pra o "adicionar
   aqui" do summary do encontro.
4. **Copy** — remover textos descritivos repetidos por grupo (ficam só o
   título + a linha de "em breve" por item quando aplicável).
5. `PainelJornada` continua onde está (só coord/supervisor) — decisão: ele
   fica **acima** do hub (é o contexto "quem precisa de quê").

## Notas

- Sem schema/RPC → `sdd.md` **não se aplica** (registrado aqui).
- Audiência: a trilha reflete o filtro ativo — trocar de audiência muda as
  células (dados já chegam filtrados; recomputar client-side é trivial).
- "Em breve" (sem `path`/`url`) é estado legítimo — não tratar como erro.
- Demo: materiais demo existem (`src/lib/demo/`) — a trilha deve acender
  no dataset demo; se não houver material por encontro no demo, seed demo
  novo (a verificar — `pnpm seed:demo` range `de*`).

## Risco / rollback

Visual-only. Rollback = revert. Cuidado com os specs e2e de materiais
(grep `materiais` em `tests/e2e/`) — selecionadores por texto do grupo
("Encontro 3") devem continuar achando o heading dentro do `<summary>`.

## Gates

`tsc --noEmit` · `eslint src/` · `pnpm test` · e2e demo `/materiais` +
app `/materiais` (coord + mentor).
