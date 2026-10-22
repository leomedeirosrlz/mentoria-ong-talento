# REALIZA-26 — Histórico append-only de reagendamentos

- **Jira:** [REALIZA-26](https://kelyng.atlassian.net/browse/REALIZA-26)
- **Tier:** B (schema + UI)
- **Veredito:** **ABERTO** — só existe o campo mutável `encontros.motivo_reagendamento`; toda remarcação sobrescreve a anterior e a trilha de auditoria se perde.
- **Esforço estimado:** **M** (migration com trigger + consumo na UI)
- **Docs:** [plan.md](plan.md) · [sdd.md](sdd.md) · [design.md](design.md) · [sdr.md](sdr.md) · [acceptance.md](acceptance.md)

## Problema

`encontros.motivo_reagendamento` (0011) guarda **apenas o último** motivo —
cada update sobrescreve. Quem acompanha a dupla (mentor, supervisor, coord)
não consegue responder perguntas operacionais básicas: "quantas vezes esse
encontro foi remarcado?", "quem remarcou?", "de que data pra que data?",
"os motivos estão se repetindo?".

O painel da coordenação e o detalhe do encontro mostram um motivo solto sem
contexto (`encontro-detalhe-dialog.tsx:116-129`,
`jovem/agenda/page.tsx:533-535`).

## Escopo

**[NOVO] `encontro_reagendamentos`** — tabela append-only chaveada por
`(dupla_id, numero)` (mesma filosofia de `encontro_notas`/`encontro_intencoes`:
o evento pertence ao **nº do guia**, sobrevive a delete/desmarcação da row):

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `dupla_id` | uuid → duplas, **on delete cascade** | |
| `numero` | smallint not null | nº do guia, não FK pra encontros |
| `de_data_hora` | timestamptz | data anterior (`null` no 1º agendamento) |
| `para_data_hora` | timestamptz | nova data (`null` em desmarcação) |
| `motivo` | text null | o que o ator selecionou/digitou |
| `motivo_detalhe` | text null | texto livre do `"outro"` |
| `acao` | text not null | `agendado` \| `remarcado` \| `desmarcado` |
| `ator_id` | uuid → profiles, null | `my_profile_id()` quando há sessão |
| `ator_papel` | text null | `my_role()` na hora do write |
| `origem` | text not null | `acao_mentor` \| `rpc_jovem` \| `sql_direto` |
| `created_at` | timestamptz default now() | |

Mecanismo de escrita: **trigger em `encontros`** (`AFTER INSERT OR UPDATE OF
data_hora OR DELETE`) — a única forma de cobrir **todos** os caminhos de
escrita de uma vez: action do mentor, RPC do mentorado (0072), PATCH direto
no PostgREST e SQL manual no console. Detalhes e alternativas avaliadas no
[sdd.md](sdd.md).

`encontros.motivo_reagendamento` **permanece** como campo-resumo (o último
motivo, denormalizado) — os consumidores atuais continuam funcionando e a
tabela vira a fonte de verdade do histórico completo.

## Superfícies que leem o histórico

- `EncontroDetalheDialog` — bloco "Histórico de agendamento" cronológico
  (remarcações com de→para + motivo + quem).
- `agenda-por-mentorado` / painel coord — contagem `N remarcações` por
  encontro quando >1 (o detalhe continua no dialog — sem coluna nova na tabela).
- `jovem/agenda` — **sem mudança**: o jovem já vê o motivo atual
  (`page.tsx:533-535`); mostrar o histórico completo pro jovem é decisão
  posterior — o escopo mentor/staff sai primeiro (ver sdd/sdr).

## Fora de escopo

- Não remove `motivo_reagendamento` (migração destrutiva sem ganho).
- Não edita histórico retroativamente (não há como reconstruir o passado —
  a tabela nasce vazia e cresce daqui pra frente).
- Não expõe histórico ao mentorado nesta versão.

## Dependências

- Nenhuma outra issue do cluster. A decisão trigger-vs-action está
  documentada no sdd (trigger vence: é o único ponto que cobre RPC do jovem +
  PATCH direto + SQL manual sem duplicar lógica).

## Riscos

- **Dupla-escrita** se a action **também** inserir na tabela — a regra é:
  **só o trigger escreve**; a action só seta `motivo_reagendamento` como hoje
  e o trigger o copia pra linha de histórico.
- **`ator_id` nulo em writes sem sessão** (SQL manual) — aceito: `origem =
  'sql_direto'` + ator null é honesto; melhor que fingir.
