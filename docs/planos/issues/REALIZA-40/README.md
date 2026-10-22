# REALIZA-40 — /duplas para não-coordenação (visões por papel)

[Jira REALIZA-40](https://realizavc.atlassian.net/browse/REALIZA-40)

**Status: FEITO** — evidência auditada; não replanejar.

## Escopo da auditoria

A rota `/duplas` servir todos os papéis com a visão correta: coordenação vê
tudo, supervisor vê supervisionadas, mentor vê a própria dupla, especialista
ganha a trilha — sem dados fora do escopo.

## Evidências

- `src/app/(app)/duplas/page.tsx` (~linhas 20-55) — deriva `visao` por papel
  efetivo (`temPapel`): `coordenacao` | `supervisor` | `mentor` |
  `especialista` | `hibrido` (DPP+especialista com as duas seções); quem não
  tem papel em dupla é redirecionado.
- Queries escopadas no banco, não filtro JS: `getMinhasDuplas()`
  (RLS limita a lista às próprias duplas — confirmado no BACKLOG "Supervisor
  em /duplas usa getMinhasDuplas()"), `getSupervisaoAlvos()` só para
  supervisor, `getEspecialistaEventos()` só para especialista/híbrido.
- `VisaoDuplas` e seções por visão renderizadas na mesma página — cada card
  na régua da própria trilha.

## Notas

- 40 não aparece como objeto próprio no `_issues.json`; o escopo foi
  recuperado do manifest + recon + a evidência de código acima.
