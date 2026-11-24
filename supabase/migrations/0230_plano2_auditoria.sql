-- 0230 — correções da auditoria 017/018 (REALIZA-518/519)
-- 1) plano auto-aceito por membro da dupla também estende expira_em até
--    o fim da janela + 8 dias (o ciclo diário não pode matá-lo antes).
-- 2) uma sessão fundida só aceita UMA avaliação, mesmo que o convite
--    chegue por um encontro coberto não-âncora.
begin;

create or replace function public.trg_plano_expira_aceite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fim date;
begin
  if new.status = 'aceito'
     and (new.aceito_mentor_em is not null or new.aceito_mentorado_em is not null)
     and new.escopo->'janela'->>'fim' is not null then
    v_fim := (new.escopo->'janela'->>'fim')::date;
    new.expira_em := greatest(
      coalesce(new.expira_em, now()),
      ((v_fim + 8)::timestamp at time zone 'America/Sao_Paulo')
    );
  end if;
  return new;
end $$;

drop trigger if exists dupla_planos_expira_aceite on public.dupla_planos;
create trigger dupla_planos_expira_aceite
  before insert or update of status, aceito_mentor_em, aceito_mentorado_em
  on public.dupla_planos
  for each row execute function public.trg_plano_expira_aceite();

create or replace function public.guard_avaliacao_sessao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sessao uuid;
begin
  select e.sessao_id into v_sessao
    from public.encontros e where e.id = new.encontro_id;
  if v_sessao is not null and exists (
    select 1
      from public.avaliacoes_encontro a
      join public.encontros e on e.id = a.encontro_id
     where e.dupla_id = new.dupla_id
       and e.sessao_id = v_sessao
  ) then
    raise exception 'esta sessão já foi avaliada';
  end if;
  return new;
end $$;

drop trigger if exists avaliacoes_sessao_unica on public.avaliacoes_encontro;
create trigger avaliacoes_sessao_unica
  before insert on public.avaliacoes_encontro
  for each row execute function public.guard_avaliacao_sessao();

commit;
