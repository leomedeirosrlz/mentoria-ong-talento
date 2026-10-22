# REALIZA-49 — sdr.md

## Superfície

- Nenhuma rota/RPC nova; a grade consome a query já existente da ficha
  (`/formularios/[id]` é coord-only via layout/RLS `my_role()`).
- `/api/form-anexo/[id]` (36) é a única saída nova de dados — signed URL
  coord-only 300s, `attachment`.

## LGPD

- A grade **concentra** dados pessoais (inclusive de menores em intake):
  mesma exposição que o CSV export já permite — não é superfície nova,
  é outra forma da mesma. Mitigação: `?view=grade` não é compartilhável
  fora da coordenação (a rota 403/404 pra outros papéis), e cópia TSV é
  ação consciente do operador (mesmo modelo do `/api/export`).
- Minimização: nenhum campo sensível extra entra na grade — ela mostra
  exatamente o que o form pediu; o builder é que deve orientar "só peça
  o necessário".

## Auditoria

- Leitura não-auditada hoje (mesma régua de toda leitura coord). Se
  acesso a respostas de menores virar trilha formal, é trabalho
  transversal (não desta issue).
