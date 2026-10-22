# Review consolidada — persona DBA (22 issues com superfície de banco)

Agente fae65046. Base: `_recon/schema-mapa.md` + migrations reais conferidas
(0015, 0042, 0043, 0083, 0085, 0099, 0103, 0104). Última migration real: `0105`
(`0039` não existe).

**Vereditos: 5 REPROVADO (51, 70, 159, 167, 171) · 12 COM-AJUSTES · 5 APROVADO (21, 98, 169, 180, 182).**

## Sistêmicos

1. **Migrations 0106–0110 colidem** entre clusters — número trava na ordem de
   merge. Ordens já documentadas: **167 → 183 → 170** (cluster R), **36 → 70 → 69**.
2. **CHECKs fechados divergentes**: `emails_enviados.tipo` (5 valores; 51 +'instrumento', 178 +'digest' — quem mergear 2º relê `pg_get_constraintdef` e leva superset); `notificacoes.tipo` (lista viva = **0103**, 31 valores c/ `terceiro_respondeu`; 35 +'pedido_acesso', 168 +'registro_pendente', 169 +'trilha_prazo'+'_coord'); `formularios.sistema` = CHECK+trigger (0042; insert em migration passa, UPDATE campos é incondicional → `disable trigger` da 181 correto); `ia_eventos.canal` = CHECK **e** corpo de `registrar_ia_evento` (0083:73) — mudam juntos (0108 da 178 cobre os dois, superset narrativa+importacao).
3. **`submeter_resposta_formulario` reescrita por 3 planos** (20 rascunho, 70 multi_uso, 181 wiring PDM): o último merge carrega TODOS os branches + wiring 360 + gate 0070. Idem `formularios_limpa_respostas`, `rematch_dupla` (98 dupla_dpp_id × 171 devolutiva).
4. **Conflito 16 × 70**: âncora `num_nonnulls(...)>=1` rejeita links intake (3 nulls por desenho) — BLOCKER da 16 respondido: genéricos SÃO necessários. Check nasce com exceção `or multi_uso or origem='intake'` (ordem de merge obrigatória).
5. **Dep 20 × 70**: rascunho usa `on conflict (link_id)`; 70 dropa a unique — 20 mergeia antes, ou 70 re-faz o mecanismo (índice parcial não resolve; guarda+lock manual).
6. **FKs não auto-indexam** — omissões: 36 `formulario_anexos.link_id`; 70 dropa unique SEM índice substituto em `formulario_respostas.link_id`; 47 `duplas.turma_id`/`cronogramas.turma_id`/`profile_papeis.escopo_turma_id`; 179 `ia_chunks` sem `unique (guia,secao,pagina) nulls not distinct` (upsert sem alvo).
7. **Revokes de anon** (default privileges dão ALL): faltou em 21, 36, 179. Correto em 183 (exemplar), 167, 169, 170, 182.
8. **pg_cron**: nenhum plano assume. ✅ 169/182 = Vercel Cron correto.
9. **RLS com subquery em `duplas` não alcança mentorado** (jovem não tem select em `duplas` — lê por views/RPCs): ramo `d.mentorado_id = my_mentorado_id()` na 181 é código morto — o caminho real é a RPC `pdm_da_dupla`. Documentar ou remover.
10. Padrões menores: `set search_path=''`+`public.` (padrão pós-0085; =public aparece em 26,32,51,181); `CREATE OR REPLACE` deve redeclarar definer+search_path+grants; caps de texto ausentes (26 motivo ≤1000, 181 visao ≤2000, 20 devolvido_motivo ≤1000); check-then-insert raciável (70 resposta_unica_guard, 181 pdm_itens_cap → `pg_advisory_xact_lock`); 47 FK `not valid`+validate.

## REPROVADAS — correção exata

- **51** — grant `(uuid,uuid[])` ≠ função criada `(text,uuid[])` → migration aborta. Fix: `grant execute on function emitir_instrumento_lote(text, uuid[])`.
- **70** — dropa `formulario_respostas_link_id_key` sem índice substituto (seq-scan em rate-cap/joins/grade); `resposta_unica_guard` raciável sob concorrência (precisa advisory lock ou `select for update`); conflitos não declarados com 16 e 20 (ver §4/§5).
- **159** — `insert pessoa_notas(profile_id, mentorado_id)` preenche as DUAS colunas → viola CHECK XOR (`num_nonnulls=1`, 0016/0017): precisa 2 inserts; `update profiles set role` dispara trigger `profiles_role_para_papeis` (0085) criando papel primário GLOBAL indesejado + linha escopada redundante — escrever `profile_papeis` direto (primário com escopo) e deixar `profiles.role` derivar.
- **167** — seed de `turma_inscricoes` com uuids literais de prod quebra `db push` no staging (FK viola) — trocar pra `insert...select where email=` + `on conflict do nothing`, ou seed pós-deploy prod-only.
- **171** — **sem pasta de plano** (só stub de review): a issue real é cirúrgica (`rematch_dupla` 0105 emite §13 mas não grava `devolutiva_pdm`; CHECK 0037 exige o rito; coordenar rewrite com a 98).

## COM-AJUSTES — ajuste exato

- **16** — check de âncora com exceção `multi_uso`/`origem='intake'` (BLOCKER respondido pela 70); `add constraint not valid`+`validate`; `interacoes.tipo` é CHECK fechado (0008) — "vinculo_resposta" precisa drop/add; excluir respostas multi_uso do denominador da auditoria.
- **20** — dep na unique de link_id (§5); cap `devolvido_motivo ≤1000`; `notificacoes.tipo` novo valor `formulario_devolvido` (drop/add CHECK); replace da submit carrega todos os branches; consumidores de `usado_em` marcam devolvida como feita → PR3 (projeção status) entra junto; `revoke from public` explícito; `not null default` é metadata-only (sem rewrite).
- **26** — bypass `realiza.import_registros` no trigger (senão import 0082 polui); refinar acao: `old.data_hora is null→agendado; new null→desmarcado; else remarcado`; caps motivo; search_path=''.
- **32** — helper `minhas_turmas_supervisionadas()` exclui supervisor global (escopo null→conjunto vazio): trocar predicado das policies pra `has_papel('supervisor', duplas.turma)` (0085:121-138 cobre global OU escopo); policies a alterar saem de `pg_policies`; alargamento de `profiles`/`mentorados` pode vazar pelas views definer (`profiles_contato` etc.) — conferir WHEREs; teste RLS negativo = gate.
- **36** — índice `formulario_anexos(link_id)` ausente; redeclarar definer nos replaces; `revoke anon`; policy com `public.my_role()`.
- **47** — `escopo_turma_id` sem sync com `escopo_turma` texto (trigger 0085 valida só texto) — trigger de espelhamento ou não escrever id até PR do código; índices nas 3 FKs; contradição sdd (policy `my_role() is not null` inclui mentorado × texto "jovem sem acesso") — apertar policy ou corrigir doc; `aceitar_solicitacao` citado errado — quem materializa esp é `sol_efetivar` (0074→0101); `aceitar_solicitacao` é gate (0097).
- **69** — CHECK+trigger respondidos; depende de 36→70; documentar "links intake têm N respostas".
- **170** — ordem `resumo_acessos` com 183 assimétrica (183 `create table` sem `if not exists`): travar **183 → 170** ou DDL da 183 order-agnóstica; `titulo not null` vs nullable na 167 (alinhar no alter); `p_expira_em interval` → renomear `p_validade`; UPDATE de senha/slug = exceção deliberada à imutabilidade (documentar).
- **178** — CHECK emails converge com 51 (§2); ia_eventos.canal cobre CHECK+corpo (correto); tendência com feature-detect (sem declarar tabela no types antes de aplicada).
- **179** — `unique nulls not distinct (guia,secao,pagina)` em ia_chunks; `revoke anon`; grants do `match_ia_chunks`; canal `mcp` já existe (0108 da 178 cobre narrativa/importacao).
- **181** — replace concorrente (§3); ramo mentorado morto na policy (§9); cap visao; advisory lock no cap; `revoke anon` explícito em pdm/pdm_itens; `disable trigger` correto (precedente 0043); `atingida_em` por RPC (documentar "só RPC muda status"); modelo `pdm_itens` self-FK+índice parcial `origem_slot` bem desenhado.
- **183** — `create table if not exists` p/ ordem com 170; grants exemplares (virar template).

## APROVADO limpo (notas residuais)

- **21** — DDL/RLS verbatim de 0015; só adicionar `revoke anon` (default privileges); número de migration disputado.
- **98** — self-FK+CHECK+índice parcial corretos; preferir backfill do sdd (`distinct on` determinístico); sugestão trigger `duplas_dpp_pai_guard`; `jovem_duplas` omite coluna ✓.
- **169** — ledger+lock+revoke+CHECK da fonte certa (0103); sem pg_cron ✓.
- **180** — superfície quase nula, honesta; `ia_eventos.args.lote` sem índice ok.
- **182** — tabela+upsert+grants corretos; verificação "sinais cita nome?" resolver antes de persistir (LGPD).
