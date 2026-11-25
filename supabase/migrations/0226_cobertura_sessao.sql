-- 0226 — cobertura de sessão e fusão de encontros (REALIZA-519)
--
-- Uma sessão de 2h pode cobrir mais de um passo do guia. O fato físico é
-- uma sessão (data_hora + duracao_min); os efeitos são N rows de encontros.
-- A cobertura vive no registro/avaliação âncora; `encontros.sessao_id`
-- agrupa as rows da mesma sessão e permite ao trigger de avaliação mintar
-- um único link (na âncora), nunca um por passo coberto.

begin;

alter table public.registros
  add column cobertura smallint[] not null default '{}',
  add constraint registros_cobertura_check check (
    cobertura <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24}'::smallint[]
  );

alter table public.avaliacoes_encontro
  add column cobertura smallint[] not null default '{}',
  add constraint avaliacoes_cobertura_check check (
    cobertura <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24}'::smallint[]
  );

alter table public.avaliacao_links
  add column cobertura smallint[] not null default '{}';

alter table public.encontros
  add column sessao_id uuid;

comment on column public.encontros.sessao_id is
  'Agrupa rows da mesma sessão fundida (0226); null = sessão simples. A menor row é a âncora do registro/avaliação.';
comment on column public.registros.cobertura is
  'Números de encontros cobertos além do próprio encontro_id (0226).';
comment on column public.avaliacoes_encontro.cobertura is
  'Números de encontros cobertos pela avaliação da sessão (0226).';

create index encontros_sessao on public.encontros (sessao_id)
  where sessao_id is not null;

-- Um link de avaliação por sessão: a âncora é a row de menor número.
-- A RPC de sessão insere todas as rows com sessao_id (agendadas) e só
-- depois vira a âncora para realizado; as cobertas nunca mintam link.
create or replace function public.avaliacao_ao_realizar()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text;
  v_profile uuid;
begin
  -- coberta não-âncora não cria link nem notifica
  if new.sessao_id is not null
     and exists (
       select 1 from public.encontros e
        where e.dupla_id = new.dupla_id
          and e.sessao_id = new.sessao_id
          and e.numero < new.numero
     ) then
    return new;
  end if;

  -- mint sempre (idempotente): jovem sem login precisa do link pra responder.
  insert into avaliacao_links (token, encontro_id, dupla_id, expira_em, cobertura)
  values (gen_random_uuid()::text, new.id, new.dupla_id,
          now() + interval '60 days',
          case when new.sessao_id is null then '{}'::smallint[]
               else (select coalesce(array_agg(e.numero order by e.numero), '{}'::smallint[])
                       from public.encontros e
                      where e.dupla_id = new.dupla_id
                        and e.sessao_id = new.sessao_id) end)
  on conflict (encontro_id) do nothing
  returning token into v_token;
  if v_token is null then
    select token into v_token from avaliacao_links where encontro_id = new.id;
  end if;

  -- backfill/operação: supressão por sessão (precedente realiza.*)
  if current_setting('realiza.no_notify', true) = 'on' then
    return new;
  end if;

  -- jovem sem login: só o link (coord encaminha por WhatsApp) — não quebra.
  select m.profile_id into v_profile
    from duplas d join mentorados m on m.id = d.mentorado_id
   where d.id = new.dupla_id;
  if v_profile is null then
    return new;
  end if;

  -- dedup: não-lida de mesmo destino já cobre o prompt
  if exists (select 1 from notificacoes n
    where n.profile_id = v_profile and n.tipo = 'avaliacao_pendente'
      and n.lida_em is null and n.href = '/avaliar/' || v_token) then
    return new;
  end if;

  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  values (v_profile, 'avaliacao_pendente',
    'Como foi seu encontro?',
    'Conte em 1 minuto como foi. Pro seu mentor, a nota só aparece na média.',
    '/avaliar/' || v_token, public.my_profile_id());
  return new;
end $$;

commit;
