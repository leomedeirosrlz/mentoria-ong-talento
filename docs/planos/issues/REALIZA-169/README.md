# REALIZA-169 — Lembretes da trilha de especialista (prazo de 3 meses)

**Jira:** [REALIZA-169] — lembretes automáticos do prazo de 3 meses da trilha
de especialista (15d, 7d, vencida) para o especialista; coord no vencimento
**Tier:** B — README, plan, sdd, sdr (leve), acceptance. Sem design.md
(superfície = sino existente).
**Status:** ABERTO — `prazoTrilhaEspecialista` (`src/lib/encerramento.ts:237`)
já calcula o marco, `TrilhaPrazoBadge` já o exibe; **nada dispara lembretes**
e não há scheduler no ambiente.

## Resumo

A trilha de especialista dura 3 meses (`fim = iniciada_em + 3 meses`) e o
guia sugere fechar ao completar — mas **ninguém lembra ninguém**: o badge só
existe quando alguém abre a ficha. A issue cria o disparo automático, fire-once
e deduplicado, dos três marcos:

| Marco | Quando | Quem recebe |
|---|---|---|
| `15d` | `diasRestantes = 15` | especialista (mentor da dupla) |
| `7d` | `diasRestantes = 7` | especialista |
| `vencida` | `diasRestantes < 0` (1ª vez) | especialista **+ coordenação** |

**Nenhum encerramento automático** — o lembrete aponta pro rito humano:
`encerrar_trilha_especialista` (`actions-encerramento.ts:285`) + avaliação §13.

## Scheduler — mesma decisão da 182

Não existe `pg_cron`/`pg_net`/Edge Functions. **Solução: Vercel Cron → route
handler autenticado** `/api/jobs/lembretes-trilha` [NOVO], seguindo
exatamente a infra da REALIZA-182 (`CRON_SECRET`, bearer, `vercel.json`).
Se a 182 ainda não aterrissou, esta issue cria a infra (handler + secret +
crons entry) e a 182 reusa — quem chegar primeiro monta o esqueleto; os dois
handlers podem viver em `/api/jobs/` separados e compartilhar `src/lib/jobs.ts` [NOVO].

## Escopo

- **`trilha_lembretes`** [NOVO]: ledger de envio `unique(dupla_id, marco)`
  — a dedup real (marco ∈ `15d|7d|vencida`; `destino` registrado pra
  auditoria: `especialista|coordenacao`). Uma row = "este marco desta dupla
  já foi notificado".
- **RPC `processar_lembretes_trilha(p_hoje date)`** [NOVO] `security definer`:
  varre duplas `trilha='especialista' and status='ativa'` com `iniciada_em`,
  calcula o marco por `fim = iniciada_em + interval '3 months'`, insere
  notificações + ledger com advisory lock por dupla (molde `enviar_lembrete`,
  0094:88-105). Chamada pelo handler com service role — não exposta ao
  client (revoke all, grant execute apenas `service_role`… na prática o
  service role bypassa grants; manter `revoke from public, anon,
  authenticated` pra fechar REST).
- **Tipos de notificação** [NOVO]: `trilha_prazo` (especialista) e
  `trilha_prazo_coord` (coordenação) — entram no CHECK `notificacoes_tipo_check`
  (lista viva em 0103 — acrescentar os dois).
- **`href`** do ping: `/duplas/<id>` (especialista cai na ficha da dupla com
  o badge e o botão de encerrar) e `/duplas` ou `/duplas/<id>` pra coord.

## Por que ledger próprio e não dedup em `notificacoes`

`notificacoes` não tem chave de dedup (schema 0018: profile/tipo/titulo/
corpo/href — sem metadata/marco). Dedup por `(profile_id, tipo, href)`
falha: mesma dupla, marcos diferentes, href igual `/duplas/<id>` → 2º marco
morreria (ou precisaria de corpo-parseado — frágil). `trilha_lembretes` é
barato, auditável ("quando o 7d foi enviado?") e idempotente por constraint.

## Dependências

- `prazoTrilhaEspecialista` (`encerramento.ts:237`) — espelhar a regra de
  `fim` no SQL (ou chamar a lógica no TS do handler — ver decisão no sdd).
- `enviar_lembrete` (0094) — molde de RPC: permissões, advisory lock, insert
  `notificacoes` + log. **Não reusar** a RPC em si — o cap dela é 48h por
  dupla, semântica diferente; o lembrete de prazo não deve disputar o cap do
  nudge manual (e vice-versa).
- Infra de job compartilhada com 182 (`CRON_SECRET`, `vercel.json crons`).
- `has_papel`/`profile_papeis` (0085) — destinatários coord com escopo.

## Esforço: S–M

Migration (tabela + RPC + 2 tipos no CHECK) + handler ~80 linhas +
`vercel.json`. A lógica é curta; o cuidado é dedup/idempotência e o "sem
encerramento automático".

## Riscos

- **Job atrasa 1 dia** → marco `15d` dispara com `diasRestantes=14` —
  janela de disparo definida como `<=` (sdd §3), não `=`: perdeu o dia exato,
  dispara no próximo run. Idem retry.
- **Dupla encerra entre run e lembrete** → só `status='ativa'` no select; a
  trilha encerrada não notifica (e o ping existente fica como histórico).
- **Coord escopada** → `has_papel('coordenacao', dupla.turma)` decide —
  respeita o modelo de escopo do 0085 (especialista de outra turma não pinga
  coord global errada? Coord global sempre recebe — `escopo_turma null`
  casa qualquer).
- **Re-notificação após reabertura** — ledger é por `(dupla,marco)`: se a
  trilha for encerrada e uma **nova** dupla esp for criada pro mesmo par,
  `dupla_id` novo = marcos novos = lembretes novos (correto).

> DECISÃO DERIVADA: rota /api/jobs/* entra no isPublic do middleware + 401 JSON sem Bearer + vercel.json (fix sistêmico da review).
