# REALIZA-98 — design.md (UI)

Escopo de UI mínimo — a issue é predominantemente schema/consistência.

## Superfícies tocadas

1. **Ficha da dupla esp** (`src/app/(app)/duplas/[id]/page.tsx`):
   - Hoje a seção "dados da dupla" mostra linhagem de remanejo via
     `getDuplaVinculo`/`getDuplaSucessora` ("originada de" / "substituída
     por" — `queries.ts:450-484`).
   - **Proposta:** reutilizar o mesmo padrão de linha-discreta para a mãe:
     "Trilha a pedido da dupla de {nome do mentor DPP}" com link pra
     `/duplas/<dupla_dpp_id>`. Só renderiza quando `dupla_dpp_id` presente
     e a mãe ainda existe (query tolera null → some silenciosamente).
   - Estender `getDuplaVinculo` pra um `kind` adicional `"dpp_mae"` (mesma
     query: `select ... from duplas where id = d.dupla_dpp_id`) ou query
     paralela `getDuplaMae` — preferir query paralela pra não inflar o
     vinculo union de remanejo.
   - Microcopy pt-BR: "Trilha a pedido da dupla de {nome}" / fallback nome
     indisponível: "Trilha a pedido da dupla de jornada".
2. **Ficha da dupla DPP** — nenhuma mudança necessária: os pedidos/duplas
   esp já aparecem via `getSolicitacoesDaDupla` (mural). Opcional futuro:
   badge "trilha esp ativa" derivado da coluna — fora de escopo.

## Estados

| Estado | Comportamento |
|---|---|
| `dupla_dpp_id` null (sem mãe / órfã de backfill) | Não renderiza a linha — zero ruído |
| Mãe encerrada/remanejada | Link segue válido (a mãe histórica existe); label não muda — é proveniência, não estado |
| Mentor DPP sem nome público | Fallback "dupla de jornada" |
| Demo | Fixtures esp com `dupla_dpp_id` populado → linha visível em `/demo` |

## Acessibilidade

Link é `<Link>` com texto descritivo (não "ver dupla" solto); herda padrão
das linhas de vinculo existentes (texto muted + link forte). Sem focus
trap, sem ícone decorativo sem `aria-hidden`.

## Fora de escopo

- Expor a relação pro mentorado/jovem (view omite a coluna).
- Editor de mãe (não existe fluxo que mude a mãe de uma trilha esp viva).
