# REALIZA-98 — acceptance.md

## Critérios executáveis

1. **Coluna existe e é restrita**
   - `information_schema.columns` (staging): `duplas.dupla_dpp_id uuid
     nullable`, FK → `duplas(id)`, delete `set null`.
   - Insert direto (service role) com `dupla_dpp_id` em `trilha='dpp'` →
     violação de CHECK; `dupla_dpp_id = id` → violação.
2. **Backfill**
   - Staging: toda dupla esp com solicitação aceita (`status='aceita'` e
     `dupla_id` populado) tem `dupla_dpp_id = s.dupla_dpp_id` — query de
     conferência no PR.
3. **Aceite via RPC escreve a mãe**
   - e2e app (staging): jovem com DPP ativa → solicitação → aceite pela
     coordenação → `duplas.dupla_dpp_id` da nova dupla = id da DPP.
   - REST: `GET /rest/v1/duplas?id=eq.<nova>&select=dupla_dpp_id` (service
     key) retorna o id.
4. **Coord cria esp manual**
   - `createDupla` com `trilha='especialista'` pra jovem com DPP → mãe
     gravada; jovem sem DPP → `null` e a dupla funciona.
5. **Rematch preserva a mãe**
   - Remanejar mentor de uma dupla esp → herdeira com mesmo
     `dupla_dpp_id`; a ficha DPP continua listando o vínculo (regressão do
     bug atual de perda de linhagem).
6. **Solicitação inalterada**
   - `solicitacoes_especialista.dupla_dpp_id` continua populado e usado por
     `getSolicitacoesDaDupla` (ficha DPP lista pedidos — regressão e2e).
7. **Jovem não vê a coluna**
   - REST com JWT do mentorado: select na view jovem não retorna
     `dupla_dpp_id` (ou view nem projeta).
8. **UI**
   - Ficha esp mostra "Trilha a pedido da dupla de X" linkando pra mãe;
     dupla esp órfã não mostra nada; mãe encerrada segue linkando.
9. **Demo**
   - `/demo` como coord: ficha de dupla esp do fixture exibe a linha da mãe.
10. **Gates**
    - `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` ·
      schema-contract CI verde (types regen pós-staging) · e2e-app
      `especialista.spec.ts`/`operacional.spec.ts` verdes no preview ·
      diff de RPC revisado por 2 pessoas (rewrite verbatim + delta).

## Não-escopo

- Remover `solicitacoes_especialista.dupla_dpp_id` ou migrar consumidores
  do mural pra coluna nova — a relação de pedido segue na solicitação.
- Qualquer UI pro mentorado sobre a mãe.
