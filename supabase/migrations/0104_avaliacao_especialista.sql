-- 0104 — avaliação geral da trilha de especialista (guia-esp §13)
--
-- O guia manda: "ao concluir o acompanhamento de um jovem, o Mentor
-- Especialista deve preencher o formulário online de avaliação geral da
-- mentoria" — percepções sobre o programa e o trabalho da coordenação.
-- Hoje o encerramento coleta só motivo + devolutiva (pro mentorado/PDM);
-- a avaliação geral não existia.
--
-- Desenho: um form `sistema='avaliacao_especialista'` (catálogo oficial,
-- molde 0042/0080) + link emitido automaticamente DENTRO da RPC de
-- encerramento — o especialista recebe uma notificação `avaliacao_pendente`
-- com href /f/<token> e responde logado (o gate de identidade da engine
-- aceita `dest_profile_id` = profile autenticado e carimba
-- `respondido_por_profile_id`). A coord lê em /formularios/[id] — zero
-- superfície nova de leitura.
--
-- Por que dentro da RPC e não trigger em duplas: o update dela já é o
-- ponto atômico do fechamento (WHERE status trava corrida e idempotência);
-- o link nasce junto, no mesmo commit, sem segundo evento.
--
--   1) `formularios.sistema` ganha 'avaliacao_especialista'
--   2) seed do form oficial (UUID estável 5eed0001-…-08)
--   3) `encerrar_trilha_especialista` emite o link + notifica o especialista
--      (dedup por (form, dest, dupla): reencerramento após reabertura não
--      repete — quem já respondeu/avaliou aquela trilha não recebe outra)

begin;

-- ---------- 1) vocabulário de sistema ----------

alter table public.formularios drop constraint formularios_sistema_check;
alter table public.formularios add constraint formularios_sistema_check
  check (sistema in (
    'anamnese', 'avaliacao_360', 'autoavaliacao_mentor',
    'visao', 'roda_vida', 'pdm', 'metas',
    'avaliacao_especialista'
  ));

-- ---------- 2) seed do form oficial ----------

insert into public.formularios (id, titulo, descricao, campos, sistema) values
(
  '5eed0001-0000-4000-8000-000000000008',
  'Avaliação geral da trilha de especialista',
  'A avaliação final do guia do especialista (§13), respondida ao concluir o acompanhamento de um(a) jovem: como foi a trilha e percepções sobre o programa e o trabalho da coordenação.',
  '[
    {"id":"s1","tipo":"secao","label":"A trilha","obrigatorio":false},
    {"id":"experiencia","tipo":"escala_1_5","label":"No geral, como você avalia a experiência desta mentoria especialista?","obrigatorio":true},
    {"id":"atendeu_demanda","tipo":"escala_1_5","label":"O quanto a trilha respondeu à demanda do(a) jovem?","obrigatorio":true},
    {"id":"resultados","tipo":"texto_longo","label":"Quais resultados ou avanços você percebeu no(a) jovem?","obrigatorio":true},
    {"id":"melhorar_trilha","tipo":"texto_longo","label":"O que poderia ter sido melhor na condução da trilha?","obrigatorio":false},
    {"id":"s2","tipo":"secao","label":"O programa e a coordenação","obrigatorio":false},
    {"id":"apoio_coordenacao","tipo":"escala_1_5","label":"Como você avalia o suporte da coordenação durante a trilha?","obrigatorio":true},
    {"id":"percepcoes","tipo":"texto_longo","label":"Percepções sobre o programa e o trabalho da coordenação — o que vale registrar?","obrigatorio":false},
    {"id":"participaria_outra","tipo":"sim_nao","label":"Você participaria de outra trilha como especialista?","obrigatorio":false}
  ]'::jsonb,
  'avaliacao_especialista'
)
on conflict do nothing;

-- ---------- 3) encerrar_trilha_especialista: emite o link + notifica ----------

create or replace function public.encerrar_trilha_especialista(
  p_dupla uuid,
  p_tipo text,
  p_motivo text,
  p_devolutiva text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  n int;
  v_form uuid;
  v_token text;
begin
  select id, mentor_id, trilha, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if d.trilha is distinct from 'especialista' then
    raise exception 'Essa ação é só pra trilha de especialista';
  end if;
  -- IS DISTINCT FROM: my_role()/my_profile_id() voltam null sem papel, e
  -- "null <> 'coordenacao'" avaliaria NULL — sem a forma is-distinct o
  -- guard não barraria (mesmo cuidado do aceitar_solicitacao, 0028)
  if d.mentor_id is distinct from public.my_profile_id()
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só o especialista da dupla ou a coordenação podem encerrar a trilha';
  end if;
  if p_tipo not in ('concluida', 'encerrada') then
    raise exception 'Escolha entre concluir e encerrar a trilha';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 300 then
    raise exception 'O motivo do encerramento precisa de 3 a 300 caracteres';
  end if;
  if p_devolutiva is null or char_length(btrim(p_devolutiva)) not between 10 and 4000 then
    raise exception 'A devolutiva pro PDM precisa de 10 a 4.000 caracteres';
  end if;

  update public.duplas
     set status = p_tipo::public.dupla_status,
         encerrada_em = now(),
         motivo_encerramento = btrim(p_motivo),
         devolutiva_pdm = btrim(p_devolutiva)
   where id = p_dupla
     and status in ('ativa', 'pausada');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Essa trilha já está encerrada';
  end if;

  -- avaliação geral (guia-esp §13): link do form oficial pro especialista,
  -- no mesmo commit do fechamento. Dedup por (form, dest, dupla) — quem já
  -- avaliou (ou já tem link vivo) não recebe outra em reencerramento.
  select f.id into v_form
    from public.formularios f
   where f.sistema = 'avaliacao_especialista'
     and f.ativo;
  if v_form is not null then
    -- emitir_instrumento_core não serve: é gated pros 4 instrumentos do
    -- jovem (dest_mentorado_id); aqui o respondente é o profile do esp.
    -- Sem lock adicional: o update acima já serializa por dupla.
    if not exists (
      select 1 from public.formulario_links l
       where l.formulario_id = v_form
         and l.dest_profile_id = d.mentor_id
         and l.dupla_id = p_dupla
    ) then
      insert into public.formulario_links
        (formulario_id, token, dest_profile_id, dupla_id, contexto, created_by)
      values (
        v_form,
        translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
        d.mentor_id,
        p_dupla,
        jsonb_build_object('origem', 'auto', 'trilha', 'especialista'),
        public.my_profile_id()
      )
      returning token into v_token;

      insert into public.notificacoes
        (profile_id, tipo, titulo, corpo, href, created_by)
      values (
        d.mentor_id,
        'avaliacao_pendente',
        'Avaliação geral da trilha',
        'Trilha encerrada — conte em 2 minutos como foi a mentoria especialista e o suporte da coordenação.',
        '/f/' || v_token,
        public.my_profile_id()
      );
    end if;
  end if;
end
$$;

revoke all on function public.encerrar_trilha_especialista(uuid, text, text, text) from public, anon;
grant execute on function public.encerrar_trilha_especialista(uuid, text, text, text) to authenticated;

-- ---------- 3) avaliacao_esp_da_dupla — estado + caminho de volta ao link ----------
-- A notificação avaliacao_pendente pode se perder no popover; a ficha da
-- dupla precisa oferecer o link de novo. formulario_links é coord-only por
-- RLS → a especialista lê o próprio link por esta RPC definer. O token só
-- volta pro mentor da dupla (o respondente); a coord vê só o estado — o
-- link dela mora em /formularios/[id].
create or replace function public.avaliacao_esp_da_dupla(p_dupla uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dupla   public.duplas%rowtype;
  v_token   text;
  v_usado   timestamptz;
begin
  select * into v_dupla from public.duplas where id = p_dupla;
  if not found or v_dupla.trilha <> 'especialista' then
    return null;
  end if;
  if public.my_profile_id() is distinct from v_dupla.mentor_id
     and public.my_role() is distinct from 'coordenacao' then
    return null;
  end if;

  select l.token, l.usado_em into v_token, v_usado
    from public.formulario_links l
    join public.formularios f on f.id = l.formulario_id
   where f.sistema = 'avaliacao_especialista' and l.dupla_id = p_dupla
   order by l.created_at desc
   limit 1;
  if v_token is null then
    return null;
  end if;

  return jsonb_build_object(
    'respondido', v_usado is not null,
    'respondido_em', v_usado,
    'token', case when public.my_profile_id() = v_dupla.mentor_id
                  then v_token end
  );
end;
$$;

revoke all on function public.avaliacao_esp_da_dupla(uuid) from public, anon;
grant execute on function public.avaliacao_esp_da_dupla(uuid) to authenticated;

commit;
