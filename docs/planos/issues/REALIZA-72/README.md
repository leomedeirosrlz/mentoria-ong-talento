# REALIZA-72 — Identidade de papel: badge no shell + onboarding por papel

[Jira REALIZA-72](https://realizavc.atlassian.net/browse/REALIZA-72)

**Status: FEITO** — evidência auditada; não replanejar.

## Escopo da auditoria

Indicação visual do papel do usuário na interface (shell) e fluxo de
onboarding diferenciado por papel no primeiro acesso.

## Evidências

- `src/components/app-shell.tsx` — badge de papel no shell: `papelCurto` na
  topbar (~linha 130) e `papelLabel` no rodapé da sidebar (~linha 209);
  navegação filtrada por papel.
- `src/components/onboarding-flow.tsx` (~linhas 65-156) — mapa `RECURSOS`
  por papel alimentando o wizard de onboarding; gateado pelo cookie/estado
  `demo_onboarded` no modo demo.
- Sprint "polish — identidade de papel" (BACKLOG): `--role-mentorado`,
  `DuplaNomes`, `Avatar papel=` — sistema visual de papéis entregue.
- Onboarding do mentorado acompanhado em `docs/planos/mentorado-na-plataforma.md`.

## Notas

- Primeiro acesso → `/auth/definir-senha` → onboarding por papel já é o fluxo
  corrente (`src/app/login/login-form.tsx` desvia quem não tem `senha_em` nem
  `senha_dispensada`).
