# REALIZA-20 — Plano de implementação

## Contexto embutido

A issue quer o link multi-sessão unificado das atividades. O codebase já
entrega a espinha em `formulario_links` (0036) + `emitir_link_instrumento`
(0099): token + dupla + dest_mentorado + sem expiração + reuso de pendente.
**Faltam três deltas**: rascunho que vive no servidor (cross-device + visível
pro mentor), status `aberto`/`iniciado`, e devolução pra correção. Nada de
tabela `atividade_links` — a convergência real é estender o que existe.

## Schema — `supabase/migrations/010x_atividade_rascunho.sql` `[NOVO]`

```sql
-- header padrão 010x (issue, motivo, rollback) — idempotente.

-- 1) status na resposta: hoje a linha só existe quando enviada. Vira o
--    envelope do ciclo: rascunho (autosave server-side) → enviada →
--    devolvida (reabre pra correção) → enviada.
alter table public.formulario_respostas
  add column if not exists status text not null default 'enviada'
    check (status in ('rascunho','enviada','devolvida')),
  add column if not exists salvo_em timestamptz not null default now(),
  add column if not exists devolvido_em timestamptz,
  add column if not exists devolvido_por uuid references public.profiles(id),
  add column if not exists devolvido_motivo text;
-- respostas antigas ficam 'enviada' pelo default — backfill desnecessário.

-- 2) "aberto": primeira vez que o token foi lido (barato, semântica limpa —
--    separa "nunca abriu" de "abriu e não começou").
alter table public.formulario_links
  add column if not exists visto_em timestamptz;

-- 3) RPC definer: salvar rascunho. anon (o público do /f) — valida token
--    vigente (mesma checagem do submit: existe, não expirou, não usado_em,
--    não devolvido_em nulo → regras abaixo), saneia payload com a mesma
--    coerção do submit, upsert na linha única do link.
create or replace function public.salvar_rascunho_formulario(
  p_token text, p_respostas jsonb
) returns jsonb language plpgsql security definer
set search_path = public as $$ … $$;
grant execute … to anon, authenticated;

-- 4) RPC definer: marcar visto — chamada uma vez na abertura da página
--    (barata, idempotente, só seta se null).
create or replace function public.marcar_link_visto(p_token text) …

-- 5) RPC definer: devolver resposta — coord ou mentor DPP da dupla dona do
--    link; seta status='devolvida', devolvido_em/por/motivo e limpa usado_em?
--    NÃO: manter usado_em como "houve envio" e adicionar leitura: link
--    "aberto pra correção" = resposta.status='devolvida'. O jovem re-submete
--    pela mesma RPC de submit com p_rascunho→enviada.
create or replace function public.devolver_resposta_formulario(
  p_link_id uuid, p_motivo text
) returns jsonb … grant to authenticated;

-- 6) A RPC de submit (`submeter_resposta_formulario` — a verificar o nome
--    exato na migration 0036/0042) passa a aceitar resposta em 'rascunho'/
--    'devolvida' e a fazer flip atômico pra 'enviada' + usado_em.
```

**Pontos `a verificar` na implementação**: nome/assinatura exata da RPC de
submit atual (0036 cria `submeter_resposta_formulario` — conferir em
`supabase/migrations/0036_formularios.sql` a seção pública), e se
`formulario_respostas.link_id unique` já existe (sim — uma linha por link,
perfeita pro upsert do rascunho).

## Código

1. `src/lib/forms/actions.ts` — action `salvarRascunho(token, respostas)`
   [NOVO] chamando a RPC; action `devolverResposta(linkId, motivo)` [NOVO].
2. `src/components/instrumentos/use-resposta.ts` — autosave: debounce ~800ms
   após mudança → `salvarRascunho`; manter localStorage como cache imediato;
   no mount, hidratar **servidor primeiro**, local como fallback; submit limpa
   ambos. Flag `rascunhoDirty` pra não sobrescrever digitação em curso.
3. `src/app/f/[token]/formulario-publico.tsx` — no carregamento, chamar
   `marcar_link_visto` (fire-and-forget `.then()`); se o servidor devolveu
   rascunho na leitura do form (estender `formularioPorToken` em
   `src/lib/forms/queries.ts` pra incluir `rascunho`), pré-popular e mostrar
   "Continuando de onde você parou".
4. `src/lib/jornada.ts` — estação "em andamento" passa a derivar do status do
   servidor quando disponível (o payload `jovem_jornada` precisa expor
   `rascunho:boolean` — migration da RPC 0099/0096 ajusta projeção; **a
   verificar** o shape exato de `instrumentos` no payload).
5. `src/components/jornada-rascunho.tsx` — hoje lê localStorage; com rascunho
   server-side passa a receber `emAndamento` por prop do servidor (o pill
   "rascunho salvo neste aparelho" morre — vira verdade global). Manter o
   componente como fallback quando RPC não expõe o flag.
6. `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx` — célula pendente passa
   a mostrar "em andamento" quando `resposta.status='rascunho'`; botão
   "Devolver para correção" no resultado enviado (confirmação + motivo
   opcional → `devolverResposta`). Ações via `src/lib/actions-formularios.ts`.
7. `src/lib/demo/` — `forms-data.ts`/`queries.ts`: fixtures com
   `status:'rascunho'` e uma resposta `devolvida` pra demo cobrir o fluxo.
8. `src/lib/forms/` testes Vitest — coerção de rascunho parcial (campos
   obrigatórios ausentes são OK em rascunho, bloqueados só no submit).

## Semântica de status resultante

| sinal | significado | fonte |
|---|---|---|
| — | enviado (link criado) | `formulario_links` existe, `visto_em` null, sem resposta |
| aberto | viu o link | `visto_em` setado |
| em andamento | rascunho no server | resposta `status='rascunho'` |
| enviada | resposta final | resposta `status='enviada'` (`usado_em` setado) |
| devolvida | voltou pra correção | `status='devolvida'` — link continua respondível |
| expirado | — | `expira_em` passado (instrumentos: nunca) |

## Ordem de PRs (quebrável)

- **PR1 (banco+público)**: migration + `salvar_rascunho`/`marcar_visto` +
  autosave/restore no `/f`. Valor imediato sem UI interna.
- **PR2 (superfícies)**: status "em andamento" na ficha/jornada + devolução
  completa (RPC + action + botão + demo fixture).
- **PR3 (jornada/painel)**: projeção `rascunho` na `jovem_jornada`/
  `painel_instrumentos_jornada` e leitura nas UIs.

## Rollback

- Feature-flag leve: actions novas são aditivas; se a RPC falhar o cliente
  cai pro localStorage (comportamento atual) — `catch` silencioso no autosave
  com log Sentry (token scrubbed).
- Migration reversível: `alter … drop column` — rascunhos server-side se
  perdem, mas localStorage segue funcional (o submit não depende das colunas
  novas pra ler resposta enviada).
