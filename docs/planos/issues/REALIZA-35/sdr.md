# REALIZA-35 — sdr.md

## Superfície

| Vetor | Risco | Mitigação |
|---|---|---|
| `registrar_login_handoff` devolve nome/papel | identidade a quem tem o link | o link **já é a credencial** (bearer) — revelar nome de quem entra não eleva privilégio; mitiga alternativa seria URL, que vaza em referrer — por isso sessionStorage |
| `solicitar_acesso(p_email)` anon | enumeração de e-mails cadastrados | resposta **sempre** `{ok}` pro chamador quando formato válido — o "já cadastrado" não vaza (branch interno só); dedup 24h corta spam |
| `solicitar_acesso` flood de notificações | coordenacao spammeada | dedup por `tipo+email` em 24h no definer; máx 1 pedido/email/dia; sem retry UI |
| Identidade na URL (`?nome=`) | referrer/history leak | **sessionStorage** na aba do e-mail — escolhido e documentado |
| E-mail template "entra como {{.Email}}" | — | já é o e-mail do destinatário — zero vazamento novo |

## RLS

- `solicitar_acesso` é definer — anon sem grant em `notificacoes`
  (modelo atual preservado: RPC é a única porta).
- Identidade lida por definer dentro da RPC — nenhum grant novo de
  `profiles` pra anon.

## Rate limits

- `solicitar_acesso`: dedup `tipo='pedido_acesso' AND payload->>email
  = p_email AND created_at > now() - interval '24 hours'` → `{ok:true}`
  idempotente.
- Reenvio de magic link: janela GoTrue existente (429 → cooldown real
  já parseado).

## Auditoria

- `notificacoes` row = registro do pedido (quem/e-quando) — suficiente
  pro volume real; sem tabela extra.
- Handoff já tem trilha (`login_handoffs` timestamps) — inalterado.

## Retenção

- Notificação de pedido segue o ciclo de vida de `notificacoes`
  (lida/arquivável pela coordenação — a verificar UI atual de sino).
