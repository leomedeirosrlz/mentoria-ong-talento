# REALIZA-171 — acceptance.md

## Critérios executáveis

1. **Rematch esp exige a devolutiva**
   - `POST /rpc/rematch_dupla` (JWT coord) em dupla `trilha='especialista'`
     sem `p_devolutiva` (ou com <10 chars) → erro P0001 mencionando
     "devolutiva"; a dupla segue `ativa` e nenhuma sucessora nasce
     (`duplas?remanejada_de=eq.<id>` vazio).
   - Coberto em `scripts/_valida_0105_rest.mjs` §4 (gate negativo antes do
     caso feliz) e implícito no guard do spec app.
2. **Rematch esp com devolutiva fecha o rito na mesma transação**
   - Com `p_devolutiva` (10–4.000): dupla antiga fica `encerrada` com
     `encerrada_em`, `motivo_encerramento` sistêmico ("Remanejamento — …")
     **e** `devolutiva_pdm` = texto trimado; sucessora nasce `ativa` com
     `remanejada_de`; `formulario_links` do `avaliacao_especialista` emitido
     pro especialista que sai (§13 inalterado).
   - Coberto no spec `solicitacao-esp.spec.ts` (rematch cross-turma assere
     `encerrada_em` + `devolutiva_pdm`) e no `_valida_0105_rest.mjs` §4.
3. **Trilha DPP inalterada**
   - Rematch DPP sem `p_devolutiva` segue fechando "só de status"
     (`encerrada_em`/`motivo`/`devolutiva` nulos — reserva da esp,
     `duplas_encerramento_esp`). Com `p_devolutiva` → erro explícito, nada
     gravado. Coberto em `_valida_0105_rest.mjs` §3.
4. **Assinatura antiga morta**
   - `rematch_dupla(uuid,text,uuid,text,boolean)` não existe mais —
     `to_regprocedure` null / chamada antiga resolve na assinatura nova
     (default `null`), nunca numa variante que pula a devolutiva.
   - Grant `execute` pra `authenticated` apenas; `anon`/`public` revogados.
5. **UI**
   - Dialog "Remanejar" em dupla esp mostra "Devolutiva pro PDM" required
     com contador ×/4.000; submit sem texto → erro inline, sem chamada.
     Em dupla DPP o campo não aparece e o fluxo é idêntico ao atual.
   - Remanejo de jovem (`lado='mentorado'`) em trilha esp também exige —
     a trilha do jovem que sai fecha igual.
6. **A devolutiva chega ao PDM**
   - Na ficha da dupla DPP do jovem, o bloco "Devolutiva do especialista"
     mostra o texto gravado no rematch (view `solicitacoes_mural` —
     a solicitação continua apontando pra dupla encerrada).
   - Na ficha da dupla esp encerrada, `TrilhaFechamento` renderiza motivo +
     devolutiva (visível pra especialista e coord).
7. **Guards preservados**
   - Papel incompatível, autoatribuição do DPP, mentorado já em dupla na
     trilha, dupla não-viva e não-coord: mesmos erros de antes, disparados
     antes da checagem da devolutiva (`_valida_0101.sql` 5b/5c verdes).
8. **Gates**
   - `npx tsc --noEmit` · `npx eslint src/` limpos · e2e-app
     `solicitacao-esp.spec.ts`/`operacional.spec.ts` verdes no preview ·
     schema-contract verde **depois** de aplicar a 0117 em staging e prod ·
     diff do RPC revisado (verbatim 0105 + deltas marcados no header).

## Não-escopo

- Via autoral pós-encerramento (o especialista que sai escrever pelo app):
  follow-up se a coordenação quiser — o campo, a view e a ficha já servem.
- `duplas.dupla_dpp_id` na herdeira: é a REALIZA-98, que mergeia antes e
  carrega este delta no rewrite dela.
- Notificar solicitantes no rematch esp (o encerrar avisa; o rematch nunca
  avisou — mudar isso é decisão de produto separada).
