# REALIZA-99 — Supervisão operacional: coordenação pode ser supervisor_id em duplas

**Jira:** REALIZA-99 · **Tier:** B (veredito FEITO — README de evidência) · **Status:** entregue, fechar no Jira

## Veredito

**FEITO.** `createDupla`/`updateDupla` e os dois dialogs aceitam papel
`coordenacao` como auxiliar executivo (supervisor da dupla), além de
`supervisor`. Sem migration — `duplas.supervisor_id` é FK pra `profiles` e as
policies trabalham com o vínculo, não com o papel (como a issue previa).

## Evidências

- **Régua única:** `podeSupervisionar(role)` retorna
  `role === "supervisor" || role === "coordenacao"` —
  `src/lib/ciclo.ts:2112-2118` (docstring: "na operação real os supervisores
  ativos são da equipe executiva").
- **Actions:** `createDupla` valida via `podeSupervisionar` —
  `src/lib/actions.ts:693-699`; `updateDupla` idem — `:1548` (recon).
- **Dialogs:** select de supervisão filtra por `podeSupervisionar` —
  `src/components/nova-dupla-dialog.tsx:167` (fetch `:124` inclui
  `coordenacao`), `editar-dupla-dialog.tsx:129` (fetch `:93`).
- **Outros consumidores da régua:** `src/lib/importar-duplas.ts:445` (import
  de pareamento aceita coord como supervisor), `actions-supervisao.ts:42`,
  `queries-supervisao.ts:63,74`, `pessoas/[id]/page.tsx:244,995` (visão
  "supervisor" da ficha da pessoa).
- **Sem migration:** confirmado — `duplas.supervisor_id` é uuid FK desde 0001.

## Restos conhecidos

Nenhum. Demo: o select popula supervisores em `/demo` (o stub filtra pela
mesma régua — dataset tem coordenação cadastrada).

## Esforço

N/A — encerrar.
