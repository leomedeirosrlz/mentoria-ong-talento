# REALIZA-98 — sdr.md (segurança, dados, riscos)

## Classificação

- Dado novo: `duplas.dupla_dpp_id` uuid — **metadado estrutural, sem dado
  pessoal**. LGPD: neutro; o grafo de relações que ele materializa já é
  inferível hoje via `solicitacoes_especialista` (mesmo escopo de leitura).

## Superfícies e controles

| Superfície | Controle |
|---|---|
| Tabela `duplas` | RLS existente inalterada — nenhuma policy nova |
| RPCs reescritos (`sol_efetivar`, `rematch_dupla`, `aceitar_solicitacao`?) | `security definer` + `set search_path = ''` verbatim; grants/revokes repetidos no rodapé da migration (padrão 0101/0105) |
| View `jovem_duplas` | Omitir a coluna — jovem não precisa conhecer a dupla-mãe (minimização) |
| `database.types.ts` | Regen pós-staging — coluna vira parte do contrato PostgREST |
| Demo | Fixture esp com mãe — dado sintético, sem risco |

## Riscos

1. **Rewrite de RPC gordo** (`sol_efetivar`, 524 linhas em 0101) —
   mitigação: copiar o corpo verbatim do arquivo mais recente
   (`pg_get_functiondef` no staging como fonte se houver dúvida), diff
   mínimo, e2e do fluxo de aceite obrigatório antes do merge.
2. **Backfill errado em base com inconsistência histórica** — mitigação:
   `distinct on (dupla_id)` + `dupla_dpp_id is null`; rodar `select
   count(*)` de candidatos no staging antes do update e anotar no PR.
3. **Divergência entre `duplas.dupla_dpp_id` e
   `solicitacoes_especialista.dupla_dpp_id`** (ex.: solicitação cancelada
   depois) — semântica desejada é "a dupla esp nasceu daquela mãe": a
   coluna congela o valor do aceite. Se Thiago quiser "mãe viva atual" é
   outro modelo (derivado) — **não é blocker**: a issue pede a FK gravada.
4. **Rematch de esp antes do backfill** — herdeira herda null: aceitável,
   backfill cobre as vivas no momento da migration.

## Auditoria / operação

- Sem `audit_log` novo (padrão do schema: linhagem via colunas, não trilha
  de auditoria de leitura).
- Release note: "duplas esp agora carregam a dupla de origem; fichas antigas
  sem solicitação ficam sem mãe conhecida".
