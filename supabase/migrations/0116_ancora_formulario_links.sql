-- 0116 · REALIZA-16 — âncora de identidade em formulario_links.
--
-- Regra da issue: nada coletado do mentorado via token nasce (ou fica) órfão
-- de identidade — toda resposta resolve pra `mentorados.id`, direto
-- (`dest_mentorado_id`) ou via contexto (`dupla_id → duplas.mentorado_id`,
-- `dest_profile_id → profiles`, `respondido_por_profile_id` no submit
-- autenticado de link genérico legado).
--
-- BLOCKER respondido na revisão (dba §4 / INDEX): links genéricos SÃO
-- necessários — mas só os de campanha. O intake público (0115) nasce sem
-- as três âncoras por desenho: é anônimo de propósito e reconcilia por
-- `formulario_respostas.promovido_profile_id` (a resposta vira cadastro,
-- nunca fica solta). Link genérico MANUAL (origem='manual') não tem mais
-- caso de uso — a emissão saiu da UI/action; a constraint é a fronteira
-- física pra qualquer caminho que restar.
--
-- NOT VALID de propósito (aceite #9): o check já vale pra INSERT/UPDATE
-- novos, mas o scan no histórico é adiado — `validate constraint` roda
-- quando scripts/auditoria-identidade-mentorado.mjs zerar os órfãos em
-- produção (saneamento = "Vincular a um jovem" na ficha do formulário ou
-- exclusão do link pendente). Enquanto isso órfãos legados seguem legíveis.
--
-- Guard de futuro (política da issue): toda tabela nova que guarda dado
-- coletado do/pelo jovem expõe `mentorado_id` ou `dupla_id` — exceção só
-- com reconciliação documentada (o padrão intake: carimbo `promovido_*`).
-- A matriz canônica vive em src/lib/identidade-ancora.ts e é exercitada
-- contra database.types.ts em teste (identidade-ancora.test.ts); a
-- auditoria executável roda contra o banco de verdade.

begin;

alter table public.formulario_links
  drop constraint if exists formulario_links_tem_ancora;
alter table public.formulario_links
  add constraint formulario_links_tem_ancora
  check (
    num_nonnulls(dest_profile_id, dest_mentorado_id, dupla_id) >= 1
    or multi_uso
    or origem = 'intake'
  ) not valid;

comment on constraint formulario_links_tem_ancora on public.formulario_links is
  'REALIZA-16: todo link manual nasce com âncora (destinatário ou dupla). Exceção: links de campanha do intake (multi_uso/origem=''intake''), anônimos por desenho — reconciliam por promovido_profile_id. NOT VALID: validate após a auditoria zerar órfãos legados.';

-- ---------- interacoes.tipo += 'vinculo_resposta' ----------
-- A reconciliação manual (vincularRespostaOrfa) registra autor+timestamp na
-- timeline da dupla quando o mentorado tem uma (caderneta da pessoa cobre o
-- caso sem dupla — ver a action). CHECK fechado desde 0008: drop/add é a
-- forma — valores existentes seguem válidos no superset.

alter table public.interacoes
  drop constraint if exists interacoes_tipo_check;
alter table public.interacoes
  add constraint interacoes_tipo_check
  check (tipo in ('nudge', 'contato', 'apoio', 'vinculo_resposta'));

commit;
