# REALIZA-182 — security & data review (leve — dado interno)

## Superfície

- `dupla_saude_snapshots`: saúde/semaforo histórico das duplas — é exatamente
  o que a UI viva já mostra pra coordenação e supervisores (`/duplas`, radar
  `agenda-coordenacao`). Não cria categoria nova de dado, **cria histórico**:
  "a dupla X passou 3 semanas em risco" é agregado novo.
- `/api/jobs/saude-snapshots`: route handler novo executável via HTTP —
  superfície de escrita.

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Qualquer um chama o job e popula/apaga snapshots | Bearer `CRON_SECRET` obrigatório; sem env → 503 (não roda aberto). O handler só **upserta** — não deleta; pior caso ele recalcula o dia (inócuo). |
| `CRON_SECRET` vaza | Segredo de deploy — está em Vercel env + `.env.staging` gitignored; nunca serializado ao client (handler é server-only; `env` lida só no servidor). Rotate = trocar env. |
| Forjar `?desde=2020-01-01` e forçar varredura | Limite 60d sem `confirm=1` + custo é só compute — e mesmo varrendo, o conteúdo escrito é a saída determinística de `saudadeDaDupla` (não há payload arbitrário). |
| Escopo de leitura abre histórico de saúde pra mentor | RLS coord ∪ supervisor-da-dupla — mesmo escopo das telas vivas. Mentor/jovem/anon não leem. |
| `sinais`/`motivos` com PII de menor | Os textos do semáforo são gerados de contagens ("2 encontros atrasados") — **verificar no PR** se algum `detalhe` cita nome; se citar, persistir só `{tipo,tom}`. Sem texto livre em nenhum caso — `motivos` vêm das strings fixas de `saudadeDaDupla`. |
| Replay/histórico falso | `fonte` marca `cron`/`lazy`/`backfill`; `computado_em` ≠ `dia` deixa claro quando a row foi escrita. Consumidor não deve tratar backfill como "estava assim naquele dia". |
| RLS: insert via REST por authenticated | Sem policy de insert + sem grant insert → negado. Escrita só service role (admin client no handler). |

## LGPD

- Base: interesse legítimo operacional da ONG (acompanhamento pedagógico) —
  o dado já era calculado e exibido; persistir é o que muda. Retenção: segue
  o ciclo da dupla (quando a dupla for apagada/anonimizada, `on delete
  cascade` leva os snapshots — verificar política de retenção de `duplas` na
  implementação; não criar retenção separada).
- Minimização: só métricas derivadas — sem nome de pessoas, sem textos
  livres, sem contato.
- Compartilhamento: nenhum novo — coord/supervisor como hoje.

## Checklist

- `revoke all`/`grant select` explícitos, RLS espelhando `duplas`
- Sem policies de escrita; handler é a única porta (service role)
- `CRON_SECRET` sem fallback inseguro; rota `dynamic`, GET 401 sem header
- Idempotente (unique natural + upsert) — retry do cron não duplica
- Sem dados novos de menor; sem texto livre; `fonte` auditável
