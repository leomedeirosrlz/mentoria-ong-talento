# REALIZA-168 — plano de implementação

Descrição essencial: a entrada nativa do registro semanal já existe
(`RegistroForm` + deep-link `#registrar-{id}`); a issue adiciona o lembrete
automático de registro pendente (job diário → notificação pro mentor com
deep-link), endurece `importar_registros` com modo `p_somente_ausentes` pra
transição, e entrega o runbook de fechamento do Google Form.

## Passo 0 — referências

- `src/lib/actions.ts` — `salvarRegistro` (autoridade do write nativo).
- `src/components/registro-form.tsx` + `registro-inline.tsx` — superfície
  existente (3 etapas, rascunho localStorage, hash abre o card).
- `src/lib/agenda-minha.ts:324`, `agenda-calendario.tsx:3378` — deep-links
  `#registrar-{id}` já gerados pra pendências.
- `supabase/migrations/0082_importar_registros.sql` — RPC de import
  (idempotente; update mapeado no re-import — ver §5 do sdd).
- `src/components/importar-registros-dialog.tsx` + `src/lib/importar-
  registros.ts` — fluxo CSV atual da coord.
- `0094_lembrete.sql` — molde RPC/notificação; `0103` — CHECK de tipos.
- `src/lib/email.ts:60` — `EMAIL_ENVIO_LIBERADO=false` (sino, não e-mail).
- `docs/planos/issues/REALIZA-169/` — mesma infra (job + ledger + RPC).

## Passo 1 — migration `0109_registro_lembretes.sql` (número indicativo)

1. `create table public.registro_lembretes` (sdd §1) + grants + policy
   coord-only select.
2. CHECK `notificacoes_tipo_check` + `registro_pendente` (copiar lista de
   0103 + adicionar; rollback block no rodapé).
3. `create or replace function processar_lembretes_registro(p_hoje date
   default null) returns jsonb` — sdd §3 (varredura realizado-sem-registro,
   advisory lock por encontro, ledger `on conflict do nothing`, insert
   notificação com href deep-link).
4. `alter function importar_registros` → novo parâmetro
   `p_somente_ausentes boolean default false`: quando true e o encontro já
   tem registro, conta `skip` no relatório em vez de update mapeado
   (revisar o corpo da 0082 e inserir o `if exists(registro) and
   p_somente_ausentes then skip` antes do bloco de update). Manter assinatura
   compatível (default false = comportamento atual).
5. `revoke all on function processar_lembretes_registro(date) from public,
   anon, authenticated` — só service role chama.

## Passo 2 — handler + cron

`src/app/api/jobs/lembretes-registro/route.ts` [NOVO] — esqueleto idêntico
aos jobs 182/169 (bearer `CRON_SECRET` → `admin.rpc`, retorna o jsonb).
`vercel.json`: adicionar `{"path":"/api/jobs/lembretes-registro","schedule":
"30 7 * * *"}` (04:30 BRT). Se `vercel.json` ainda não existe (nem 182 nem
169 mergeadas), este PR cria com as três entradas já desenhadas — entries
sem rota dão 401/404 inofensivos; ou só a desta issue (decisão do PR).

## Passo 3 — sino

- Tipo `registro_pendente` entra no mapa de ícone/label do componente do
  sino (verificar onde o mapa vive — grep `tipo ===` em components de
  notificação; se for genérico, nada a fazer).
- Confirmar que o click do sino preserva `#` no `router.push` — se perder,
  ajustar pra `window.location.assign(href)` ou `router.push(href)` que o
  Next preserva fragmento em push (verificar comportamento real no PR).

## Passo 4 — demo

- `registro_lembretes` e notificações demo: o modo demo já emula sino?
  Se `notificacoes` têm dataset demo em `src/lib/demo/data.ts`, adicionar 1
  notificação `registro_pendente` canned pro mentor demo (consistência do
  papel). Sem handler em demo (jobs não rodam em demo).

## Passo 5 — testes / validação

- Validador REST `_valida_0109_rest.mjs` [NOVO]: RPC não-executável por
  authenticated; service role executa; dedup por `(encontro, marco)`;
  encontro `nao_aconteceu`/dupla encerrada/registro existente → sem ping;
  `p_somente_ausentes` → registro existente é skip.
- E2E `tests/e2e/app/lembrete-registro.spec.ts` [NOVO] (opcional mas útil):
  mentor com encontro realizado s/ registro → sino tem o ping → clica →
  cai na ficha com o form aberto (âncora `#registrar-*` já é o comportamento
  — o spec prova a jornada inteira).

## Passo 6 — rollout operacional (runbook no sdd §6)

1. Migration → staging → validador → prod → merge (ordem dura).
2. `CRON_SECRET` ok (mesma da 182/169); `vercel.json` merged.
3. Piloto 2–3 mentores (semana) → anúncio → cutover → último import com
   `p_somente_ausentes=true` → desativa coleta no Google Form → arquiva CSV.
4. Duas semanas depois: comparar completude de registros vs. era do Form.

## Rollback

Remover o cron → para de pingar; tabelas/tipo ficam inertes. O canal nativo
permanece (já existia). `importar_registros` com `p_somente_ausentes` default
false = comportamento anterior.

## Questões em aberto

- Trilha especialista entra no lembrete? Plano: sim (mesma regra —
  `salvarRegistro` aceita esp). Se a coord quiser só DPP, filtrar
  `d.trilha='dpp'` — linha no WHERE.
- Canal token-anônimo pro mentor — fora de v1 (BLOCKER: só se a coord
  reportar que mentores não logam; exigiria RPC definer escrevendo
  `registros` com bypass de `guard_autoria` — escopo cirúrgico do 0082).
- Marcos adicionais (D+14 coord?) — extensão trivial (CHECK + case);
  documentado como fora de v1.
