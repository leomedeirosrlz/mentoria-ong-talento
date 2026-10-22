# REALIZA-176 — plano de execução

## Alvo

`src/components/agenda-coordenacao.tsx` — reorganização visual pura;
`src/lib/agenda-coordenacao.ts` não muda (os dados já chegam prontos).

## Passos

1. **Reordenar seções** no JSX do componente (`:198-272`):
   `Para acompanhar` (`:235-256`) → 1º; `Semana no programa` (`:259-272`)
   → 2º; `Semana do encontro` (`:199-232`) → 3º.
2. **`CardResumo` → `LinhaResumo`** (mesma assinatura de props):
   `<article>` → linha `flex items-center gap-3 border-b py-2.5`;
   `PillTurma` mantém; `text-3xl font-bold` → `text-sm font-semibold
   tabular-nums`; barra 3-segmentos (`:318-405`) → barra única
   `h-1.5 bg-muted` + fill `bg-[var(--brand-lime)]` com `width: {pct}%`.
   Grid `lg:grid-cols-2` (`:226`) → coluna única `divide-y`.
3. **Tags**: `Tag` "resumo por turma — nunca global" (`:204`) →
   `<p className="text-xs text-muted-foreground">` na seção;
   `Tag` com `N` em "Para acompanhar" (`:238-241`) → `· N` no `<h2>` ou
   Tag numérica mínima (uma ou outra — não as duas).
4. **Aviso de semana**: o bloco "pedidos de apoio" (`:186-196`) — verificar
   posição relativa; se continua no topo, manter (é o alerta operacional).
5. Limpar imports mortos (`PillTurma` segue; `formatMesAbrev`/`dom`/`regua`
   states de `CardResumo` que só serviam à barra segmentada — remover o que
   ficar sem uso; `lint` pega).

## Campos a verificar

- `ResumoTurmaCard` (`src/lib/agenda-coordenacao.ts`): quais campos a barra
  nova precisa (`realizaram`, `ativas` bastam) — confirmar o tipo antes de
  deletar `regua`/`estado`.
- Os specs e2e (`tests/e2e/app/agenda-coordenacao.spec.ts` e afins) se
  penduram em texto ou em estrutura? grep por "Encontro", "realizaram",
  "Para acompanhar" antes de mover.

## Risco / rollback

Reordenação JSX — baixo. A barra 3-segmentos era a única "fora da
identidade" — removê-la é o ponto. Rollback = revert.

## Gates

`tsc` · `eslint` · `pnpm test` · e2e `agenda-coordenacao` (app) + demo
`/agenda` com `coordenacao`.
