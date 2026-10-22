# REALIZA-20 — SDD

## A decisão central: não criar `atividade_links`

A issue nomeia uma tabela `atividade_links` com colunas
`token, dupla_id, encontro_num?, instrumento, tipo, rascunho, status, expiração`.
**Tudo isso já existe ou pertence a `formulario_links`**:

| pedido da issue | realidade |
|---|---|
| `token` | `formulario_links.token` (192 bits) |
| `dupla_id` | `formulario_links.dupla_id` |
| `instrumento` | `formularios.sistema` (visao/roda_vida/pdm/metas) |
| `tipo` | hoje só 'form'; 'pdf' é REALIZA-55 e herda daqui |
| `rascunho` | **o delta real — server-side** |
| `status` rico | **o delta real** |
| `expiração` | `expira_em` (null nos instrumentos) |
| `encontro_num?` | `contexto` jsonb já carrega `{encontro, momento}` |

Criar `atividade_links` duplicaria token/dest/dupla/RPC/policies — a issue
mesma proíbe tabela paralela. **Convergência: estender.**

## Alternativas pro rascunho

**A. `formulario_respostas.status='rascunho'`** (escolhida) — a linha única
por link (`link_id unique`) já é o envelope natural: rascunho = a resposta em
gestação; submit = flip de status. Sem tabela, sem FK nova, sem policy nova
(herda RLS coord-only + RPC definer). Custo: `respostas jsonb` passa a poder
estar parcial — a RPC valida por `status` (rascunho tolera vazio; submit
exige completo).

**B. Tabela `formulario_rascunhos`** separada — isola "lixo" de respostas
reais. Contra: mais uma fronteira RLS+RPC+sync pra convergir no submit;
mover a linha no submit é um delete+insert. Rejeitada.

**C. Só localStorage (status quo)** — já existe; não atende multi-device nem
visibilidade do mentor. Rejeitada.

## Status: na resposta ou no link?

`status` mora em **resposta** (rascunho/devolvida são estados do conteúdo),
`visto_em` mora em **link** (fato de acesso). `usado_em` segue = "houve
envio". Consumidores que leem `usado_em is not null` como "respondido"
(`jornada_autoemit`, `instrumentos_da_dupla`, `jovem_jornada`) continuam
corretos — devolvida mantém `usado_em` (já houve envio; a devolução é
qualidade, não desfeita). **A verificar**: painel/jovem mostrando "feito" pra
devolvida — a projeção deve expor `status` pra UI pintar "devolvida p/
revisão" (PR3 do plano).

## RPCs definer (anon-safe, padrão da casa)

- `salvar_rascunho_formulario(token, respostas)` — valida link vigente
  (existe ∧ ¬expirado ∧ ¬(enviada ∧ ¬devolvida)); coage/normaliza payload com
  o MESMO normalizador do submit (`src/lib/forms/normaliza.ts` portado na
  RPC — **a verificar** se a coerção hoje é SQL ou TS; se TS, a RPC aceita e
  o TS saneia antes de chamar); upsert `on conflict (link_id) do update set
  respostas, salvo_em, status` — atômico contra corrida com submit.
- `marcar_link_visto(token)` — `update … set visto_em=now() where token=…
  and visto_em is null`; idempotente, fire-and-forget.
- `devolver_resposta_formulario(link_id, motivo)` — autorização: coord ou
  mentor DPP da `dupla_id` do link (mesmo predicado de
  `emitir_link_instrumento`); seta status='devolvida' + metadados; notificação
  pro jovem se `dest_mentorado.profile_id` existir (`notificacoes`, padrão
  0069) — **a verificar** tipo de notificação disponível.

## Contratos TS

```ts
// src/lib/forms/queries.ts — formularioPorToken passa a devolver
{ kind:'ok', info:{ formulario, link, rascunho?: Record<string,RespostaValor> } }

// src/lib/forms/actions.ts
salvarRascunho(token, respostas) → {error} | {ok:true}
devolverResposta(linkId, motivo) → {error} | {ok:true}
```

## Invariantes

1. Um link = uma resposta (linha única) em qualquer status — rascunho não
   multiplica rows.
2. `usado_em` nunca é des-setado; "re-aberto" se lê por `status='devolvida'`.
3. Payload de rascunho segue os mesmos caps do submit (tamanho máx, só
   `campo_id` declarados) — o banco saneia, não o client.
4. Identidade: rascunho herda `dest_mentorado_id`/`dupla_id` do link —
   alinhado a REALIZA-16.

## Performance

Upsert por `link_id` único = O(1). `salvar_rascunho` no debounce do client
(≥800ms) — carga trivial. `visto_em` index desnecessário (lookup sempre por
`token`, já unique-indexed).
