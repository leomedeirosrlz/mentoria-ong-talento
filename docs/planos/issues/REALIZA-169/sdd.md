# REALIZA-169 — software design

## 1. Modelo — `trilha_lembretes` [NOVO]

```sql
create table public.trilha_lembretes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  marco text not null check (marco in ('15d','7d','vencida')),
  destino text not null check (destino in ('especialista','coordenacao')),
  notificacao_id uuid references public.notificacoes(id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (dupla_id, marco, destino)
);
```

- `unique(dupla_id, marco, destino)` = dedup estrutural. `vencida` dispara
  duas rows (especialista + coordenacao) no mesmo run.
- Sem grant de escrita pra `authenticated`; `select` = coord ∪ mentor da
  dupla? **Coord ∪ supervisor** basta — o lembrete do especialista já é a
  notificação dele; o ledger é auditoria. Manter escopo estreito: coord-only
  select (supervisor vê a ficha da dupla, não precisa do ledger — revisar se
  UI mostrar "último lembrete" na ficha — v1 não mostra).

## 2. Marcos — semântica exata

`fim = (iniciada_em::date + interval '3 months')::date` — espelha
`prazoTrilhaEspecialista` (`fimData.setMonth(+3)`). `diasRestantes = fim -
hoje`.

| marco | condição de disparo | repete? |
|---|---|---|
| `15d` | `diasRestantes <= 15 and diasRestantes > 7` | não — fire-once via unique |
| `7d` | `diasRestantes <= 7 and diasRestantes >= 0` | não |
| `vencida` | `diasRestantes < 0` | não — uma vez ao cruzar; follow-up humano |

Janelas `<=` absorvem job atrasado: rodou a cada dia → cada marco dispara
exatamente na primeira run dentro da janela. Rodou 1× por semana → 15d e 7d
podem cair na mesma run (disparam os dois — cada um uma row+notificação).
Trilha criada já vencida (migração legado) → só `vencida` dispara (marcos
passados não retroativam? **Decisão: retroativam não** — a janela `<= 15 and
> 7` impede `15d` quando já faltam 3 dias; `vencida` quando `diasRestantes<0`
é o único sempre disparável. Correto: não bombardear legado com 3 pings).

Marco extra futuro (`vencida_30d` pra coord) = adicionar ao CHECK + um
`elsif` — barato, registrado como extensão não-escopo.

## 3. RPC `processar_lembretes_trilha(p_hoje date default null)` [NOVO]

`security definer set search_path to 'public'` — chamada pelo handler
(service role). `p_hoje null → current_date` (testável com data fake).

```text
for each dupla in (
  select d.id, d.mentor_id, d.turma, d.iniciada_em,
         (d.iniciada_em + interval '3 months')::date - coalesce(p_hoje, current_date)
           as dias_restantes
  from duplas d
  where d.trilha = 'especialista' and d.status = 'ativa' and d.iniciada_em is not null
):
  v_marco := case
    when dias_restantes < 0                 then 'vencida'
    when dias_restantes <= 7                then '7d'
    when dias_restantes <= 15               then '15d'
  end;
  -- note: na mesma run, uma dupla com 5d ganha '7d' mesmo que '15d' nunca
  -- tenha saído (job parado 10 dias) — decidir: enviar os marcos PULADOS
  -- também? Ver §3a.
  if v_marco is null then continue;
  perform pg_advisory_xact_lock(hashtextextended(dupla.id::text, 169));
  for each destino in (case v_marco when 'vencida'
      then array['especialista','coordenacao'] else array['especialista'] end):
    insert trilha_lembretes (...) on conflict do nothing;
    if not inserted → já enviado → skip notificação
    else → insert notificacoes (tipo, titulo, corpo, href, created_by=null? ver §3b)
```

### 3a. Marcos pulados

Se o job ficou parado 10 dias e a dupla pulou de 16d → 5d: `15d` nunca caiu
na janela. Decisão: **disparar os marcos pendentes também** — para cada dupla,
iterar `['15d','7d','vencida']` filtrando `condição_atual permite` +
`não enviado`: com 5d restantes, `15d` (cond `<=15 and >7`) e `7d` (`<=7`)
disparam ambos. Dois pings no mesmo dia é correto — o 15d era devido. A
janela superior (`>7` no 15d) evita o inverso (dupla com 5d não recebe 15d
"atrasado" — recebe só 7d). **Revisão:** então 15d com janela `>7` não
dispara quando pulada pra 5d — marco perdido de fato. Alternativa: disparar
sempre o marco mais vencido não enviado… Simples e justo: `for marco in
(15d,7d,vencida) if condição(marco) and not exists(ledger)` — com `15d:
dias<=15`, `7d: dias<=7`, `vencida: dias<0`. Uma run com 5d envia 15d e 7d
juntos — aceitável e documentado. **Adotar isso** (remove a janela superior).

### 3b. `created_by` da notificação

`notificacoes.created_by` referencia profiles — para lembrete automático não
há autor humano: deixar `null` (a coluna é nullable) + o `tipo` novo
`trilha_prazo` já diz a origem. O insert via RPC definer (dono da função) —
a policy `notificacoes_insert` de 0019 exige coord **ou** pedido_apoio
self-authorized; RPC definer roda acima da policy? **RLS se aplica a
security definer como o DONO da função** — o dono é quem criou a migration
(postgres/dono) e bypassa? Não: `security definer` muda o *executor*; se o
dono tem role que bypassa RLS (postgres é BYPASSRLS por padrão no Supabase),
funciona. Todas as RPCs do repo seguem esse padrão (0094 insere notificacoes
como definer) — o mesmo vale aqui. Confirmar no PR que o insert passa (teste
do validador cobre).

### Destinatários

- `especialista` = `duplas.mentor_id` (trilha esp: o mentor É o especialista).
- `coordenacao` = `select id from profiles p join profile_papeis pp on
  pp.profile_id=p.id and pp.papel='coordenacao' and (pp.escopo_turma is null
  or pp.escopo_turma = dupla.turma)` — mesma régua `has_papel` (0085).

### Textos (pt-BR, ≤200 chars título / ≤1000 corpo)

- `15d`: título "Trilha de especialista: faltam ~15 dias" · corpo "A trilha
  com <nome do mentorado> completa 3 meses em <dd/mm>. Se já cumpriu os 5
  encontros e a devolutiva, é hora de preparar o fechamento com a
  coordenação." · href `/duplas/<id>`
- `7d`: "faltam ~7 dias" · corpo idem mais curto.
- `vencida` (esp): "Trilha completou 3 meses" · "O guia sugere fechar. Fale
  com a coordenação pra combinar o encerramento e a avaliação final."
- `vencida` (coord): "Trilha de especialista venceu o prazo" · "<esp> ×
  <mentorado> completou 3 meses — agendar encerramento/avaliação §13." ·
  href `/duplas/<id>`

Nomes: o corpo cita mentor/mentorado — a notificação vai pro próprio
especialista/coord (mesmo escopo que já vê a ficha) — sem ampliação.

## 4. Handler `/api/jobs/lembretes-trilha` [NOVO]

Igual ao da 182: `GET` + bearer `CRON_SECRET` → `admin.rpc('processar_lembretes_trilha')`
→ retorna `{ok, avaliadas, enviados}` (a RPC devolve contadores via jsonb).
`vercel.json`: `"schedule": "0 7 * * *"` (07:00 UTC = 04:00 BRT — após o job
de snapshots das 03h, sem colisão).

## 5. O que NÃO faz

- Não encerra trilha (`encerrar_trilha_especialista` continua humano).
- Não envia e-mail/WhatsApp (sino in-app só — `EMAIL_ENVIO_LIBERADO=false`
  hoje; e-mail transacional existe mas lembrete por e-mail é follow-up).
- Não mexe no cap 48h de `enviar_lembrete` (nudge manual independente).

## 6. Alternativas consideradas

- **Dedup em `interacoes`** (tipo `nudge`+marco): mistura log de contato com
  estado de automação — o ledger próprio é mais claro.
- **RPC por-dupla vs varredura única**: varredura única (1 call/dia) —
  atomicidade natural, lock por dupla dentro.
- **Reusar `notificacoes` pra dedup** (href `/duplas/x?m=15d`): href aceitaria
  query (`^/[^/\\]` passa) mas corpo/href hack é pior que tabela explícita.
