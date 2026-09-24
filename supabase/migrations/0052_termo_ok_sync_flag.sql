begin;

-- Bug do primeiro uso real: o mentor assinando o PRÓPRIO termo em /assinar
-- tomava "campos de validacao so podem ser alterados pela coordenacao" e a
-- assinatura inteira fazia rollback. Cadeia: assinar_termo insere em
-- assinaturas → trigger assinatura_reflete_termo_ok atualiza
-- mentor_profiles.termo_ok → guard_mentor_profile vê my_role() do chamador
-- (mentor) e bloqueia. my_role() lê o JWT do request mesmo dentro de
-- security definer — o guard não distingue escrita manual de sync interno.
--
-- Mesmo padrão da tranca de formacao_ok (0040): flag transaction-local
-- isenta o sync automático; escrita manual no campo segue coord-only.
-- PostgREST executa cada request na própria transação, então um usuário
-- não consegue ligar a flag antes de um PATCH direto — a isenção só existe
-- dentro da RPC de assinatura.

create or replace function public.assinatura_reflete_termo_ok()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.profile_id is null then
    return new;
  end if;
  perform set_config('realiza.assinatura_sync', '1', true);
  -- termo em papel (documento_path) continua valendo: revogar uma assinatura
  -- não pode apagar o ok manual que a coordenação já tinha registrado
  update public.mentor_profiles mp
    set termo_ok = exists (
      select 1 from public.assinaturas a
        join public.documento_templates t on t.id = a.template_id
        where a.profile_id = new.profile_id
          and t.slug = 'termo-voluntario' and a.status = 'assinado')
      or p.documento_path is not null
    from public.profiles p
    where mp.profile_id = new.profile_id and p.id = new.profile_id;
  return new;
end $$;

create or replace function public.guard_mentor_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and ((new.termo_ok is distinct from old.termo_ok
           and current_setting('realiza.assinatura_sync', true) is distinct from '1')
          or new.capacidade is distinct from old.capacidade
          or new.tipo is distinct from old.tipo
          or (new.formacao_ok is distinct from old.formacao_ok
              and current_setting('realiza.formacao_sync', true) is distinct from '1')) then
    raise exception 'campos de validacao so podem ser alterados pela coordenacao';
  end if;
  return new;
end $$;

commit;
