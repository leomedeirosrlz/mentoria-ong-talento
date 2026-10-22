# REALIZA-169 — security & data review (leve)

## Superfície

- `trilha_lembretes`: ledger de automação — dupla_id + marco + destino +
  timestamp. Sem texto livre, sem PII além da referência à dupla.
- `processar_lembretes_trilha`: RPC definer executada só por service role
  (handler). Não recebe input de usuário além de `p_hoje` (data).
- `/api/jobs/lembretes-trilha`: mesmo desenho da 182 (`CRON_SECRET` bearer).
- Notificações: visíveis só ao destinatário (RLS existente do sino).

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Qualquer um dispara o job e floda o sino | Bearer `CRON_SECRET`; sem env → 503. Mesmo disparado, `on conflict do nothing` no ledger impede re-envio — pior caso zero efeito. |
| RPC executável via REST por authenticated | `revoke all ... from public, anon, authenticated` (molde 0094). Só service role chama — e service role já é confiada. |
| `p_hoje` forjado pra enviar lembretes retroativos | A RPC só é chamável por service role — quem tem service role já faz tudo; parâmetro existe pra testabilidade, não é vetor. |
| Notificação entrega nome de menor a quem não devia | Destinatários = mentor da própria dupla e coord (com escopo de turma via `profile_papeis`) — mesmo escopo que já lê a ficha. Sem cópia pra terceiros. |
| Falha de insert deixa ledger sem notificação (ou vice-versa) | Tudo numa transaction da RPC: insert ledger + insert notificacao juntos; lock por dupla serializa retries concorrentes (TOCTOU — molde 0094). |
| Flood por retry do cron | Idempotente por constraint — N chamadas no mesmo dia = 1 conjunto de rows. |
| `created_by` nulo quebra render do sino | `created_by` é nullable no schema (0018:24-31); verificar no PR que o componente do sino trata null (provável — usos automáticos anteriores idem). |

## LGPD

- Nenhum dado novo: notificação = lembrete operacional no canal já existente;
  corpo cita nomes das partes da própria dupla (mesmo escopo da ficha).
- Retenção: `on delete cascade` com a dupla; notificações seguem a retenção
  existente do sino.
- Sem canal externo (e-mail/WA) — nada sai da plataforma.

## Checklist

- Grants/revokes explícitos; RPC `security definer set search_path`
- Lock por dupla + `on conflict do nothing` (dedup estrutural)
- href interno validado pelo CHECK existente (`^/[^/\\]`)
- Sem bypass de RLS pra leitores: ledger select coord-only
- `CRON_SECRET` sem fallback aberto
