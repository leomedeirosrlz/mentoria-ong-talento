# REALIZA-32 — sdd.md

## Decisão pendente (registrar resposta aqui antes de implementar a etapa 3)

> **BLOCKER:** o auxiliar designado a uma turma vê **TODAS as duplas da turma** ou **só as duplas que a coordenação designar** explicitamente?
>
> - **Opção A — turma inteira:** designação auxiliar↔turma basta; `duplas.supervisor_id` vira atributo de "responsável indicado" (quem conduz a sessão de supervisão), não de escopo. Mais simples; casa com "auxiliar é por turma".
> - **Opção B — por dupla designada:** mantém `supervisor_id` como escopo e **soma** leitura da turma só onde não houver designação (ou só onde houver). Mais granular, mais uma superfície de configuração.
> - **Recomendação do planejamento:** Opção A — a frase decisória ("enxerga as duplas da turma") sugere turma inteira; B pode nascer depois sem mudar schema (a designação já existe, só o predicado da policy muda).

## Modelo de designação `[NOVO]` — escolha de implementação

Candidatos no Jira: `turma_membros` ou `turmas.auxiliar_id`. Recomendação:

**Reusar `profile_papeis`** (`0085`): a linha `(profile_id, papel='supervisor', escopo_turma=<label|id>)` **já é** a designação auxiliar↔turma — sem tabela nova no degrau mínimo. Justificativas:

- `escopo_turma` já existe pra exatamente isso ("null = papel vale pro programa todo; preenchido = só naquela turma" — `src/lib/demo/data.ts:77` documenta a semântica);
- `has_papel(papel, escopo)` já suporta checagem com escopo (a verificar assinatura exata — `0085`);
- write path já é coord-only pela RLS da tabela.

Fallbacks: se a 47 aterrissar primeiro, `escopo_turma_id` substitui o texto. Se a decisão for Opção B com "designadas explicitamente", aí sim `duplas.supervisor_id` continua sendo o escopo e nenhuma tabela nasce — a diferença é só a policy de leitura complementar (ver abaixo).

## RLS — desenho das policies

Helper novo `[NOVO]` (security definer, padrão `my_role()`/`my_profile_id()` de `0001_init.sql`):

```sql
create or replace function public.minhas_turmas_supervisionadas()
returns setof text  -- label até a 47; depois setof uuid
language sql stable security definer set search_path = public as $$
  select escopo_turma from public.profile_papeis
  where profile_id = public.my_profile_id()
    and papel = 'supervisor' and escopo_turma is not null
$$;
```

- `stable` + security definer (sem RLS recursiva — `profile_papeis` se lê como owner).
- Grants: `execute` pra `authenticated` (mesmo padrão dos helpers existentes).

### Policies que mudam (Opção A)

| Tabela | Hoje (`0001_init.sql`) | Nova regra (aditiva, `or`) |
|---|---|---|
| `duplas` select | `mentor_id=me or supervisor_id=me or coord` | `+ turma in (select minhas_turmas_supervisionadas())` — pós-47: `turma_id in (...)` |
| `encontros` select | mentor/supervisor da dupla (`:187`) | `+ dupla.turma in (escopo)` |
| `registros`/`encontro_notas`/`encaminhamentos`/`avaliacoes` select | idem embutido (`:213,240…`) | `+ dupla.turma in (escopo)` — a verificar lista exata de policies que embutem `supervisor_id` no banco |
| `profiles`/`mentorados` select | mentorados das próprias duplas | `+ mentorados com dupla na turma do escopo` (auxiliar precisa ver o jovem da turma) — cuidado: `profiles` de mentores/colegas da turma idem |
| writes (`duplas_supervisor_update` `:177`) | `supervisor_id=me` | manter: **edição segue por dupla designada** (a menos que a decisão diga o contrário) |

Se Opção B: policies de leitura ficam como estão; a designação continua sendo `supervisor_id` — a issue vira só a **agregação/atribuição em massa por turma** (UI atribui supervisor a todas as duplas da turma). Documentar a divergência quando a resposta chegar.

### Compatibilidade

- `duplas.supervisor_id` **permanece** — marca o responsável pela supervisão daquela dupla (quem conduz sessões, recebe notificações). A diferença: deixa de ser a única chave de leitura.
- `getMinhasDuplas`/`getDuplas` (`queries.ts:415`) — o `.or(mentor_id,supervisor_id)` do client pode continuar (RLS alarga atrás); mas as queries de leitura-ampla (agenda auxiliar, home) passam a receber mais linhas — revisar `src/lib/agenda-auxiliar.ts` pra garantir que nada assume "só supervisionadas".
- `getSupervisaoAlvos` (`queries-supervisao.ts:83`): filtra `supervisor_id=me` — correto manter (alvos de sessão = duplas que ele conduz).

## Semáforo/agenda do auxiliar

`agenda-auxiliar.ts` e home do supervisor agrupam por turma já hoje (`duplas-lista.tsx:1330+`). Com escopo por turma, o conjunto cresce: validar que contadores/cards degradam bem com 15+ duplas (paginação/colapso — design.md).

## Testes

- Vitest: helper puro `escopoTurmasDe(profilePapeis)` (se houver derivação no client).
- RLS e2e (suite app): usuário supervisor com `profile_papeis(escopo_turma='T1…')` vê duplas T1 sem `supervisor_id`, **não vê** T2, não edita dupla sem `supervisor_id`.
