-- 0216 — resposta de terceiros registrada manualmente (REALIZA-449/463).
--
-- A avaliação por terceiros só entrava pelo link público /t/<token>
-- respondido pelo próprio terceiro. Feedback colhido por telefone, papel
-- ou presencial não tinha onde morar — o workaround era digitar direto no
-- consolidado, perdendo a evidência por contato, o badge "respondeu" e a
-- contagem do instrumento.
--
-- `terceiros_respostas` ganha origem (link|manual), quem registrou, via
-- de coleta e a declaração de consentimento (na entrada manual a
-- evidência é declaratória — o mentor atesta que a pessoa autorizou).
-- A RPC nova usa a mesma autorização do consolidado (mentor da dupla ou
-- coordenação, trilha DPP, dupla viva), a transição atômica
-- pendente|expirado→respondido (imutável depois, igual ao link) e
-- notifica a coordenação — nunca o próprio autor.
begin;

alter table public.terceiros_respostas
  add column origem text not null default 'link'
    check (origem in ('link','manual')),
  add column registrado_por uuid references public.profiles(id),
  add column coletado_via text
    check (coletado_via in ('telefone','presencial','papel','outro')),
  add column consentimento_declarado boolean not null default false;

create or replace function public.registrar_resposta_terceiro_manual(
  p_contato_id uuid, p_pontos_fortes text, p_a_melhorar text,
  p_coletado_via text, p_consentimento boolean
) returns jsonb language plpgsql security definer set search_path = 'public' as $$
declare
  v_c record;
begin
  if p_pontos_fortes is null or char_length(btrim(p_pontos_fortes)) = 0
     or char_length(p_pontos_fortes) > 4000 then
    raise exception 'responda os pontos fortes (até 4000 caracteres)';
  end if;
  if p_a_melhorar is null or char_length(btrim(p_a_melhorar)) = 0
     or char_length(p_a_melhorar) > 4000 then
    raise exception 'responda os aspectos a melhorar (até 4000 caracteres)';
  end if;
  if p_coletado_via is null or p_coletado_via not in
     ('telefone','presencial','papel','outro') then
    raise exception 'informe como a resposta foi coletada';
  end if;
  if p_consentimento is distinct from true then
    raise exception 'confirme que a pessoa autorizou o registro da resposta';
  end if;

  select c.id, c.dupla_id, c.status, d.trilha, d.status as dupla_status
    into v_c
    from public.terceiros_contatos c
    join public.duplas d on d.id = c.dupla_id
   where c.id = p_contato_id
   for update of c;
  if not found then
    raise exception 'convite não encontrado';
  end if;
  if public.my_role() is distinct from 'coordenacao'
     and not exists (select 1 from public.duplas d
       where d.id = v_c.dupla_id and d.mentor_id = public.my_profile_id()) then
    raise exception 'dupla não encontrada';
  end if;
  if v_c.trilha is distinct from 'dpp' then
    raise exception 'avaliação por terceiros é da trilha DPP';
  end if;
  if v_c.dupla_status not in ('ativa','pausada') then
    raise exception 'a dupla não está mais ativa';
  end if;

  update public.terceiros_contatos
     set status = 'respondido', respondido_em = now()
   where id = v_c.id and status in ('pendente','expirado');
  if not found then
    raise exception 'esta pessoa já respondeu — a resposta não pode ser alterada';
  end if;

  insert into public.terceiros_respostas
    (contato_id, pontos_fortes, a_melhorar, origem, registrado_por,
     coletado_via, consentimento_declarado)
  values (v_c.id, btrim(p_pontos_fortes), btrim(p_a_melhorar), 'manual',
          public.my_profile_id(), p_coletado_via, true);

  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'terceiro_respondeu',
           'Resposta de terceiros registrada',
           'Resposta registrada pelo mentor na ficha da dupla.',
           '/duplas/' || v_c.dupla_id, public.my_profile_id()
      from profiles p
     where p.role = 'coordenacao' and p.ativo
       and p.id is distinct from public.my_profile_id();

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.registrar_resposta_terceiro_manual(uuid,text,text,text,boolean) from public, anon;
grant execute on function public.registrar_resposta_terceiro_manual(uuid,text,text,text,boolean) to authenticated;

commit;
