# REALIZA-26 — Critérios de aceite

Formato: **dado** → **quando** → **esperado**.
Papéis: mentor (M), coord (C), supervisor (S), mentorado (J).

## Schema & trigger

1. **Dado** migration `0107` aplicada → **quando** `\d
   encontro_reagendamentos` → **esperado** colunas `id, dupla_id, numero,
   de_data_hora, para_data_hora, motivo, motivo_detalhe, acao, ator_id,
   ator_papel, origem, created_at`; CHECK `acao in
   ('agendado','remarcado','desmarcado')`; `on delete cascade` de `duplas`;
   índice `(dupla_id, numero, created_at)`.
2. **Dado** a tabela existe → **quando** `select * from pg_policies where
   tablename='encontro_reagendamentos'` → **esperado** exatamente 1 policy
   (`select`), nenhuma insert/update/delete, sem ramo mentorado.
3. **Dado** trigger `trg_encontro_reagendamentos` em `encontros` →
   **quando** `INSERT` com `data_hora` → **esperado** 1 linha `acao='agendado'`,
   `de=null`, `para=NEW.data_hora`, `ator_id=my_profile_id()`.

## Cobertura de caminhos (o ponto central)

4. **Dado** encontro agendado por M → **quando** M remarca via
   `agendarEncontro` com motivo `conflito_agenda` → **esperado** linha
   `acao='remarcado'`, `de`=data antiga, `para`=data nova,
   `motivo='conflito_agenda'`, `origem='acao_mentor'`.
5. **Dado** o mesmo → **quando** M remarca de novo → **esperado** 2ª linha
   `remarcado` — a 1ª **permanece** (append-only: `motivo_reagendamento` em
   `encontros` atualiza, o histórico acumula).
6. **Dado** J na agenda livre → **quando** remarca via RPC 0072 →
   **esperado** linha `remarcado` com `origem='rpc_jovem'`,
   `ator_papel='mentorado'` — **caminho RPC coberto**, sem código da action.
7. **Dado** encontro agendado → **quando** J desmarca via
   `desmarcar_encontro` (0072, DELETE da row) → **esperado** linha
   `acao='desmarcado'`, `de`=data que era, `para=null` — a linha **sobrevive**
   à row deletada (a chave é `(dupla_id,numero)`, não `encontro_id`).
8. **Dado** write direto `update encontros set data_hora=…` via
   SQL/PATCH sem sessão → **esperado** linha `remarcado` com
   `origem='sql_direto'`, `ator_id=null`, `ator_papel=null` — sem fingir
   ator.
9. **Dado** update em `encontros` que **não** toca `data_hora` (só `status`
   → `realizado`) → **esperado** **nenhuma** linha nova (trigger `UPDATE OF
   data_hora` não dispara).

## Não-duplicação

10. **Dado** remarcação via action → **quando** conta linhas do evento →
    **esperado** **exatamente 1** linha (o trigger escreve; a action não
    insere nada em `encontro_reagendamentos` — grep no código pra confirmar).
11. **Dado** remarcação via RPC 0072 → **esperado** exatamente 1 linha.

## Queries & UI

12. **Dado** encontro com 3 linhas de histórico → **quando** C abre o
    `EncontroDetalheDialog` → **esperado** bloco "Histórico de agendamento"
    com 3 linhas cronológicas reversas, cada uma com ação/data/motivo/ator.
13. **Dado** encontro sem histórico extra (só `agendado`) → **esperado**
    bloco renderiza com a linha única "Agendado pra {data}" — ou omite se a
    decisão for esconder <2 linhas (design decide; assert o combinado).
14. **Dado** encontro remarcado 3× → **quando** C vê a linha em
    `agenda-por-mentorado` → **esperado** chip `· 3 remarcações` ao lado do nº.
15. **Dado** encontro remarcado 1× → **esperado** sem chip (sinal é a
    repetição, não a exceção).

## RLS

16. **Dado** M autenticado → **quando** `select encontro_reagendamentos` da
    própria dupla → **esperado** retorna; da dupla de outro → 0 rows.
17. **Dado** S → **esperado** lê histórico das duplas supervisionadas, não
    das outras.
18. **Dado** J → **quando** qualquer select na tabela → **esperado** 0 rows
    (sem policy pra mentorado).
19. **Dado** M autenticado → **quando** tenta `insert`/
    `update`/`delete` em `encontro_reagendamentos` via client → **esperado**
    erro de permissão (sem grant) — o histórico não é editável.

## Demo

20. **Dado** `/demo` papel mentor/coord → **quando** abre detalhe de encontro
    com fixture de histórico → **esperado** o bloco renderiza com as linhas
    do fixture (`de000000-*`), sem chamada real.
21. **Dado** `/demo` → **quando** tenta remarcar → **esperado** a action
    retorna `DEMO_MSG` (como hoje) — o demo não escreve histórico real (o
    fixture é estático).

## Gates

22. `npx tsc --noEmit` limpo; `npx eslint src/` limpo; `pnpm test` verde.
23. `schema-contract` CI verde com `database.types.ts` regenerado **após**
    aplicar a migration no staging remoto.
24. e2e app: spec remarca via UI → assert linha `remarcado` no dialog;
    spec desmarca (se coberto) → assert `desmarcado`. e2e demo: assert
    critério 20.
