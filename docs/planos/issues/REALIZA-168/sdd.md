# REALIZA-168 — software design

## 1. Modelo — `registro_lembretes` [NOVO]

```sql
create table public.registro_lembretes (
  id uuid primary key default gen_random_uuid(),
  encontro_id uuid not null references public.encontros(id) on delete cascade,
  marco text not null check (marco in ('d2','d7')),
  notificacao_id uuid references public.notificacoes(id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (encontro_id, marco)
);
```

Select coord-only; sem grants de escrita pra `authenticated`. Mesmo desenho
do `trilha_lembretes` (169). **Convergência:** se 169 e 168 aterrissarem no
mesmo PR, uma `lembretes_enviados (ref_id uuid, marco text, destino text,
unique(ref_id, marco, destino))` única resolve as duas — escolha do
implementador; os dois planos funcionam standalone.

## 2. Marcos e varredura

```text
encontro e join duplas d:
  e.status = 'realizado'
  and e.realizado_em <= hoje - 2 dias        -- D+2
  and not exists (registros r where r.encontro_id = e.id)
  and d.status = 'ativa'
  and (e.realizado_em) >= hoje - 30 dias     -- janela: encontro velho já é
                                            -- trabalho humano da coord, não ping
marco := case
  when hoje - e.realizado_em::date >= 7 then 'd7'
  when hoje - e.realizado_em::date >= 2 then 'd2' end
```

- `d2` e `d7` independentes (cada um uma row): com job diário, `d2` sai no
  D+2 e `d7` no D+7. Job parado 6 dias → disparam juntos (mesmo desenho da
  janela `<=` da 169).
- **Por que não "toda semana até preencher":** o semáforo já carrega
  `registro_pendente` como sinal pra coord (agenda-coordenacao) — depois de
  2 pings a dupla vira caso humano, não mais automação.
- Encontro `nao_aconteceu`/`cancelado`/`agendado` → fora (sem "realizado",
  sem follow-up; `agendado` futuro não é pendência).
- `realizado_em` null com `status='realizado'` → usar `data_hora::date` como
  referência (coalesce) — borda coberta.
- Trilha: incluir `especialista` também — registro de follow-up vale igual
  (salvarRegistro atende as duas trilhas).

## 3. RPC `processar_lembretes_registro(p_hoje date default null)` [NOVO]

Molde `enviar_lembrete` (0094) + `processar_lembretes_trilha` (169):

```text
for each (encontro, dupla) do bloco do §2:
  v_marco := ...
  perform pg_advisory_xact_lock(hashtextextended(encontro_id::text, 168));
  insert registro_lembretes(encontro_id, marco) on conflict do nothing;
  if not inserted → continue (já enviado)
  insert notificacoes (
    profile_id = dupla.mentor_id,
    tipo = 'registro_pendente',
    titulo, corpo, href = '/duplas/'||dupla_id||'#registrar-'||encontro_id,
    created_by = null
  ) returning id → notificacao_id
retorna {ok, avaliados, enviados:[{d2:n, d7:n}]}
```

**href com `#`:** o CHECK `notificacoes_href_check` exige `^/[^/\\]` —
`/duplas/x#registrar-y` casa (o `#` é dentro da string, não no início). O
router do sino trata como navegação interna? `router.push` com hash funciona
— o `RegistroInline` escuta o hash e abre o form (registro-inline.tsx).
Verificar no PR que o click do sino preserva o fragmento.

**Tipo novo no CHECK:** `registro_pendente` entra no `notificacoes_tipo_check`
(lista viva em 0103). **Conflito de nome:** `SinalTipo` já tem
`registro_pendente` (ciclo.ts:790) — homônimo semântico proposital (o ping
informa o mesmo sinal). Se o sino já mapeia ícone por tipo, verificar.

### Copy (pt-BR)

- `d2` — título "Como foi o encontro com <mentorado>?" · corpo "O encontro
  nº <N> já aconteceu — conta rapidinho como foi (avaliação, dificuldades e
  próximo passo). Leva menos de 2 minutos." · href deep-link.
- `d7` — título "Registro do encontro nº <N> ainda pendente" · corpo
  "Sem o registro a coordenação não vê como a dupla está — valeu!"

## 4. Canal do mentor — o que já existe (sem código novo)

| Peça | Hoje |
|---|---|
| Form nativo | `RegistroForm` (3 etapas, rascunho localStorage) |
| Entrada | `RegistroInline` por card + deep-link `#registrar-{id}` |
| Nudge manual | `enviar_lembrete` (botão da coord/supervisor) |
| Falta | **disparo automático** — esta issue |

"Link" do Jira = deep-link do ping. Canal anônimo por token: **fora de v1**
— mentor tem conta; a RPC definer que escreveria `registros` como o mentor
reabriria a discussão de autoria que `guard_autoria` (0023/0082) protege.

## 5. Import histórico + reconciliação

`importar_registros` (0082) permanece a ponte do backlog e da transição:

- Idempotente por resposta; encontro novo vira `'externo'` born-realizado.
- **Risco conhecido:** o re-import faz UPDATE dos campos mapeados mesmo em
  registro que o mentor criou nativo — durante a janela de transição, uma
  resposta tardia do Google pode pisar no nativo. Mitigação recomendada no
  plano: `p_somente_ausentes boolean default false` [NOVO param] — quando
  true, encontro com registro existente vira `skip` em vez de update.
  Aplicar no último import pré-cutover. (Barato: 4 linhas na RPC.)
- Reconciliação do que não casar: a RPC já devolve `{i, erro}` por linha —
  o runbook inclui revisar `nao_encontrado`/`sem_dupla` e resolver manual
  (a coord vê o relatório jsonb do dialog).

## 6. Runbook de fechamento do Google Form

1. Piloto: 2–3 mentores param de receber o link do Form e passam a usar o
   nativo por 1 semana (coord acompanha completude).
2. Anúncio geral (comunicado/WhatsApp): "o follow-up semanal agora é na
   plataforma — você recebe um lembrete e clica direto no encontro".
3. Cutover (data): último `importar_registros` com `p_somente_ausentes=true`
   captura respostas tardias.
4. Google Form: desativa coleta ("não aceitando mais respostas"), mantém
   leitura pra consulta histórica; export final arquivado em Drive da ONG.
5. Pós 2 semanas: checar completude de registros vs. período do Form — se
   cair muito, revisar copy/frequência do lembrete.

## 7. Handler + cron

`/api/jobs/lembretes-registro` [NOVO] — esqueleto da 182/169 (bearer
`CRON_SECRET` → `admin.rpc`). `vercel.json`: `0 10 30 * * *`? — **07:30 UTC
= 04:30 BRT** (`"30 7 * * *"`). Diário (pendência é por encontro, não
semana calendário — "semanal" era o ritual do Form, não a regra).

## 8. Invariantes

- `registros`/`encontros` **não são escritos** pelo job — só lê. O lembrete
  não cria registro vazio nem muda status (o mentor escreve via
  `salvarRegistro` como sempre).
- Ping vai pro **mentor da dupla**, nunca pro jovem/coord — follow-up é
  responsabilidade dele (0094 já modela isso: `destino='mentor'`).
- Ledger fire-once — re-run não repete marco.
