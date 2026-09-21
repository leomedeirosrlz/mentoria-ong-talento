-- 0026: M1 do security audit — profiles_select deixava QUALQUER autenticado
-- ler `select *` de profiles via PostgREST (email, whatsapp, documento_path
-- de coordenação, supervisores e outros mentores). Postgres não tem RLS por
-- coluna: a trava é por grant de coluna + view escopada por papel.

-- SELECT da tabela sai do papel `authenticated`; volta só pras colunas
-- públicas internas (nome/avatar aparecem em duplas, registros, mural).
-- insert/update não são tocados — coord gerencia, self atualiza o próprio.
revoke select on public.profiles from authenticated;
grant select (id, user_id, nome, role, ativo, avatar_path, created_at)
  on public.profiles to authenticated;

-- Contato (email/whatsapp/documento_path) fica atrás da view. Ela roda como
-- owner (security definer é o default de view: postgres ignora grants/RLS
-- da tabela base) e o WHERE faz o escopo por papel de app:
--   coordenação → tudo, com documento_path
--   supervisor  → os mentores das duplas que supervisiona (nudge por WhatsApp)
--   qualquer um → a própria linha
-- documento_path volta null pra quem não é coordenação (CASE, não coluna).
create or replace view public.profiles_contato as
select
  p.id,
  p.email,
  p.whatsapp,
  case when public.my_role() = 'coordenacao' then p.documento_path end as documento_path
from public.profiles p
where
  public.my_role() = 'coordenacao'
  or p.id = public.my_profile_id()
  or (
    public.my_role() = 'supervisor'
    and p.id in (
      select mentor_id from public.duplas
      where supervisor_id = public.my_profile_id()
        and status in ('ativa', 'pausada')
    )
  );

grant select on public.profiles_contato to authenticated;

-- As policies do bucket `documentos` (0012) subconsultam profiles.documento_path
-- — coluna agora fora do grant, o exists estouraria permission denied na
-- avaliação da policy. Passam a ler a view: pra coordenação ela expõe o
-- documento_path real de todo mundo (mesma semântica), pros demais vem null.
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
    )
  );

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
    )
  );
