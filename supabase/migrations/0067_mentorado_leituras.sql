-- REALIZA-107 fase C — camada de leitura do mentorado.
--
-- Dois mecanismos, escolhidos pelo que cada um expressa:
--
--   · policy branch em `encontros` — a tabela só tem dados de agendamento
--     (numero/data_hora/status/link/origem/motivo); todas as colunas são
--     seguras pro jovem. O exists() na dupla roda como dono da tabela,
--     então não precisa de acesso a `duplas`.
--
--   · views definer pro resto — onde a row tem colunas que não são do jovem:
--     `mentorados.notas`/`documento_path`/`form_bruto` (domínio da coord),
--     `duplas.devolutiva_pdm` (relato especialista→mentor), `profiles.dados_civis`
--     (CPF/RG/endereço do ADULTO — não é dado do jovem), `assinaturas.token`/
--     `ip`/`dados_snapshot` (evidência de assinatura). Mesmo padrão de
--     `solicitacoes_mural`: view com role-check no WHERE, projeção mínima.
--
-- `profiles_select` NÃO ganha ramo mentorado: jovem_contatos cobre os adultos
-- das próprias duplas + coord — dar row-access vazaria dados_civis do mentor.
-- Self-read do próprio profile já funciona via `user_id = auth.uid()`.
--
-- Toda leitura é gated por my_role()='mentorado' DENTRO do predicado —
-- ex-mentorado que vira adulto mantém o vínculo (mentorados.profile_id é
-- permanente) mas perde o acesso: a revogação vem do papel, não do vínculo.
--
-- `comunicados`/`materiais` audiencia='todos' já alcançam o papel (gate
-- `is not null` da 0065). `notificacoes` self select/update funciona de graça
-- (profile_id = my_profile_id()) assim que o jovem tem profile_id — assim como
-- o insert `pedido_apoio` pra coord/supervisor.
--
-- Sem escrita por policy: todo write do jovem é RPC definer com whitelist
-- (decisão do plano — policy não expressa "só data_hora/link"). As RPCs chegam
-- com as issues filhas (110 agenda, 109 avaliação, 112 especialista).

begin;

-- 1) encontros da própria dupla — read-only, colunas seguras.
drop policy if exists encontros_select on public.encontros;
create policy encontros_select on public.encontros for select using (
  public.my_role() = 'coordenacao'
  or exists (select 1 from public.duplas d
             where d.id = encontros.dupla_id
               and (d.mentor_id = public.my_profile_id()
                    or d.supervisor_id = public.my_profile_id()))
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.duplas d
                  where d.id = encontros.dupla_id
                    and d.mentorado_id = public.my_mentorado_id()))
);

-- 2) jovem_perfil — o próprio cadastro de mentorado.
--    Fora: notas/documento_path (campos da coord) e form_bruto (payload bruto
--    do intake — o dado já sai pelos campos normalizados).
create or replace view public.jovem_perfil as
select m.id, m.nome, m.nome_social, m.email, m.whatsapp, m.avatar_path,
       m.data_nascimento, m.genero, m.cidade, m.uf, m.interesses, m.motivacao,
       m.objetivos, m.escolaridade, m.origem, m.ong_origem, m.pref_genero_par,
       m.disponibilidade, m.dados_civis, m.responsavel, m.cor_raca,
       m.created_at
from public.mentorados m
where m.id = public.my_mentorado_id()
  and public.my_role() = 'mentorado';

-- 3) jovem_duplas — as duplas do jovem com os nomes dos adultos já resolvidos
--    (join definer = sem embed de profiles, sem branch em profiles_select).
--    Fora: devolutiva_pdm (relato do especialista pro mentor DPP), demanda do
--    staff? Não — demanda é o motivo do pareamento, transparência pro jovem;
--    fora: solicitacao_id/remanejada_de (plumbing interno).
create or replace view public.jovem_duplas as
select d.id, d.trilha, d.status, d.turma, d.cronograma_id, d.iniciada_em,
       d.encerrada_em, d.motivo_encerramento, d.pdm_url, d.demanda,
       d.mentor_id, p.nome as mentor_nome, p.nome_social as mentor_nome_social,
       p.avatar_path as mentor_avatar_path,
       d.supervisor_id, s.nome as supervisor_nome,
       s.nome_social as supervisor_nome_social,
       s.avatar_path as supervisor_avatar_path
from public.duplas d
left join public.profiles p on p.id = d.mentor_id
left join public.profiles s on s.id = d.supervisor_id
where d.mentorado_id = public.my_mentorado_id()
  and public.my_role() = 'mentorado';

-- 4) jovem_contatos — os adultos do jovem (mentor/supervisor das duplas dele +
--    coordenação, sempre alcançável), projeção de contato. Sem dados_civis,
--    documento_path, form_bruto, bio linkedin etc. — contato, não dossiê.
create or replace view public.jovem_contatos as
select * from (
  select d.id as dupla_id, 'mentor'::text as papel,
         p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.mentor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select d.id, 'supervisor'::text,
         p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.supervisor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select null::uuid, 'coordenacao'::text,
         p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.profiles p
  where p.role = 'coordenacao' and p.ativo
) contatos
where public.my_role() = 'mentorado';

-- 5) jovem_assinaturas — status dos próprios documentos (termo, autorização).
--    Sem token (link de assinatura é segredo do portador), ip/user_agent/
--    hash_documento/dados_snapshot (evidência — trilha de auditoria da coord).
create or replace view public.jovem_assinaturas as
select a.id, a.template_id, a.status, a.assinado_em, a.created_at
from public.assinaturas a
where a.mentorado_id = public.my_mentorado_id()
  and public.my_role() = 'mentorado';

grant select on public.jovem_perfil to authenticated;
grant select on public.jovem_duplas to authenticated;
grant select on public.jovem_contatos to authenticated;
grant select on public.jovem_assinaturas to authenticated;

commit;
