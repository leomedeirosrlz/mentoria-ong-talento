# REALIZA-26 — Software design doc

Histórico append-only de reagendamentos: `[NOVO] encontro_reagendamentos` +
trigger em `encontros` que cobre **todos** os caminhos de escrita.

## Decisão 1 — como capturar writes (a decisão central)

Caminhos atuais que mudam `encontros.data_hora` / inserem / removem:

| # | Caminho | Arquivo |
|---|---|---|
| 1 | `agendarEncontro` (mentor DPP agendar/remarcar) | `src/lib/actions.ts:2440+` |
| 2 | `registrarEncontroRetroativo` | `src/lib/actions.ts:2689+` |
| 3 | RPC `desmarcar_encontro` + agendar/remarcar do jovem | `supabase/migrations/0072_agenda_livre_dpp.sql:249-329` |
| 4 | PATCH direto no PostgREST (`encontros` tem policy update) | qualquer client autenticado |
| 5 | SQL manual / seed / futuro | console Supabase |

Alternativas avaliadas:

- **a) Inserir histórico dentro de cada action** — cobre 1 e 2, **não** cobre
  3, 4, 5. Caminho 3 mora em função plpgsql (0072) — teria que duplicar a
  lógica de histórico em TypeScript **e** em SQL, e qualquer caminho novo
  nasceria "cego". ❌
- **b) Uma RPC compartilhada `registrar_reagendamento`** chamada por todos —
  exige reescrever a 0072 pra chamar a RPC e ainda não cobre PATCH direto/SQL.
  ❌
- **c) Trigger em `encontros`** (`AFTER INSERT OR UPDATE OF data_hora OR
  DELETE`) — **único ponto que cobre todos os 5 caminhos** sem depender de
  disciplina de quem escreve. Roda na mesma transação do write → a linha de
  histórico não pode "ficar pra trás". ✅ **Escolhida.**

### Regra de ouro: só o trigger escreve

A action continua setando `encontros.motivo_reagendamento` como faz hoje; o
trigger **lê `NEW.motivo_reagendamento`** na hora do UPDATE e copia pra linha
de histórico. Nenhum código de aplicação insere em `encontro_reagendamentos` —
isso elimina a dupla-escrita (action + trigger gravariam 2 linhas).

`motivo_detalhe` (o texto livre do motivo `"outro"`): a action já grava o
detalhe em `encontros.motivo_reagendamento` quando `motivo='outro'`? — checar:
hoje o campo guarda o motivo selecionado; o detalhe vai junto ou separado
(`actions.ts:2440+`). Se o detalhe já aterrissa na coluna, o trigger copia
`NEW.motivo_reagendamento` inteiro pra `motivo` e deixa `motivo_detalhe` pra
quando a action passar a gravar as duas colunas (plano marca o detalhe como
`null` até lá — a coluna existe pra evolução).

## Decisão 2 — o que é "um evento" no histórico

Trigger `AFTER INSERT OR UPDATE OF data_hora OR DELETE ON encontros`:

| Evento | Condição | Linha gravada |
|---|---|---|
| 1º agendamento | `INSERT` com `data_hora not null` | `acao='agendado'`, `de=null`, `para=NEW.data_hora`, `motivo=null` |
| Remarcação | `UPDATE` e `OLD.data_hora IS DISTINCT FROM NEW.data_hora` | `acao='remarcado'`, `de=OLD`, `para=NEW`, `motivo=NEW.motivo_reagendamento` |
| Desmarcação | `DELETE` (0072 remove a row) **ou** `UPDATE` com `data_hora → null` | `acao='desmarcado'`, `de=OLD`, `para=null` |
| Edição que **não** muda data (link de chamada, observação) | `UPDATE OF data_hora` não dispara | **nenhuma linha** — correto: não é reagendamento |
| Marcar `realizado`/`nao_aconteceu` | muda `status`, não `data_hora` | **nenhuma linha** — o status já é rastreado em `encontros` |

Detalhes:
- `UPDATE OF data_hora` (lista de colunas) é essencial — updates de status
  não disparam.
- `IS DISTINCT FROM` trata `null ↔ valor` corretamente.
- Encontro retro-realizado inserido já com `data_hora` passada → entra como
  `agendado` (é o 1º registro daquela data; a distinção "retroativo" é do
  status `realizado`, não do histórico de datas).

## Decisão 3 — chave: `(dupla_id, numero)`, não `encontro_id`

`encontros` é `unique(dupla_id, numero)` e a 0072 **deleta** a row ao
desmarcar. Se o histórico fosse FK pra `encontros.id`, cascade apagaria o
histórico **exatamente quando ele mais importa**. `(dupla_id, numero)`:
- sobrevive a delete/desmarcação/re-agendamento;
- junta natural com `encontro_notas`/`encontro_intencoes` (mesma chave);
- `ON DELETE CASCADE` de `duplas` (a dupla morre → o histórico morre junto,
  ciclo de vida do dossiê).

## Decisão 4 — `motivo_reagendamento` fica ou sai

**Fica.** É o resumo denormalizado ("último motivo") lido por
`encontro-detalhe-dialog.tsx:116-129` e `jovem/agenda/page.tsx:533-535` sem
join extra. A tabela nova é a fonte do histórico; a coluna é a fonte do
"estado atual". Remover seria migração destrutiva sem ganho e quebraria os 2
consumidores. O trigger só lê a coluna — não depende dela continuar sendo
setada pra sempre (se um dia sair, `motivo` passa a vir de `NEW` quando o
chamador a setar; sem ela, `motivo` fica null).

## Decisão 5 — ator e origem

- `ator_id = my_profile_id()`, `ator_papel = my_role()` — os helpers
  security-definer existentes; funcionam dentro de função `security definer`
  (leem o JWT do request). Em SQL manual/seed não há JWT → ambos null +
  `origem='sql_direto'`. Honesto, não finge.
- `origem`: a trigger não sabe quem a chamou — deriva do contexto:
  - `my_role()='mentorado'` → `rpc_jovem`;
  - `my_role() in ('mentor_dpp','mentor_especialista','coordenacao',
    'supervisor')` → `acao_mentor` (simplificação: staff=acao_mentor; se
    quisermos distinguir, `acao_admin`);
  - `my_role() is null` → `sql_direto`.
  Basta distinguir jovem×staff×manual — granularidade extra não agrega.

## Concorrência

- `unique(dupla_id, numero)` em `encontros` já serializa writes concorrentes
  no mesmo encontro (o 2º UPDATE espera o lock da row).
- O trigger roda `FOR EACH ROW` na mesma transação — a linha de histórico
  commita ou aborta **com** o write; impossível "encontro mudou sem histórico"
  ou "histórico órfão".
- Ordem cronológica: `created_at` + `id` (ou `order by de_data_hora,
  created_at`) — `now()` dentro da transação é o início dela, suficiente.

## RLS e visibilidade

Policies espelham o escopo de `encontros` select (0098:40-49), **exceto
mentorado** nesta versão (decisão de privacidade — ver sdr):

- `select`: `my_role()='coordenacao'` tudo; `my_role()='mentor_dpp'` própria
  dupla; `my_role()='supervisor'` duplas supervisionadas; **`mentorado`
  sem policy** (não lê o histórico — continua vendo só o motivo atual via
  `encontros`/`jovem_duplas` como hoje).
- `insert/update/delete`: **nenhuma policy** — a tabela é append-only por
  definição; só o trigger (security definer, bypass RLS) escreve. Sem caminho
  de escrita pra aplicação = impossível falsificar histórico.
- `mentor_especialista`: sem select (não é a trilha dele; se surgir caso, a
  policy amplia igual às outras tabelas).

## Função do trigger

```sql
create or replace function registrar_reagendamento_encontro()  -- [NOVO]
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.data_hora is not null then
    insert into encontro_reagendamentos
      (dupla_id, numero, para_data_hora, acao, motivo, ator_id, ator_papel, origem)
    values
      (new.dupla_id, new.numero, new.data_hora, 'agendado',
       null, my_profile_id(), my_role(), origem_reagendamento());
  elsif tg_op = 'UPDATE' and old.data_hora is distinct from new.data_hora then
    insert into encontro_reagendamentos
      (dupla_id, numero, de_data_hora, para_data_hora, acao, motivo, ator_id, ator_papel, origem)
    values
      (new.dupla_id, new.numero, old.data_hora, new.data_hora,
       case when new.data_hora is null then 'desmarcado' else 'remarcado' end,
       new.motivo_reagendamento, my_profile_id(), my_role(), origem_reagendamento());
  elsif tg_op = 'DELETE' then
    insert into encontro_reagendamentos
      (dupla_id, numero, de_data_hora, acao, ator_id, ator_papel, origem)
    values
      (old.dupla_id, old.numero, old.data_hora, 'desmarcado',
       my_profile_id(), my_role(), origem_reagendamento());
    return old;
  end if;
  return coalesce(new, old);
end $$;
```

`origem_reagendamento()` [NOVO] — helper `stable` que traduz `my_role()` no
enum de origem (jovem→`rpc_jovem`, staff→`acao_mentor`, null→`sql_direto`).

## Queries que mudam

- `EncontroDetalheDialog`: fetch do histórico por `(dupla_id, numero)` quando
  o dialog abre (client query ou prop do parent — o dialog já recebe dados
  via props/server query; seguir o padrão do restante do dialog).
- `agenda-por-mentorado` / `duplas-lista`: `count` por `(dupla_id, numero)`
  pra mostrar "N remarcações" quando >1 — uma query grouped, sem join por
  linha.

## Índices

- `primary key (id)`
- `(dupla_id, numero, created_at)` — lookup do histórico de um encontro
- `(dupla_id, numero) where acao='remarcado'` — contagem de remarcações

## Não fazer

- **Não** inserir histórico na action — só o trigger escreve.
- **Não** FK pra `encontros.id` (a row pode ser deletada; a chave é o nº).
- **Não** dar policy de insert/update/delete (append-only por omissão).
- **Não** backfill (o passado não existe — a tabela nasce no dia do deploy).
