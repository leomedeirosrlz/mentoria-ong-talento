-- 0114 — REALIZA-51: emissão de instrumento em lote pra disparo por e-mail.
--
-- A jornada já emite sozinha (0099) e o mentor entrega 1 a 1 pela ficha —
-- mas a coordenação precisava abrir ficha por ficha pra cobrar/resgatar os
-- jovens que não abriram o link. Aqui nasce a operação em lote: uma RPC
-- definer coord-only que roda emitir_instrumento_core pra uma lista de
-- duplas e devolve o relatório por linha (token + destinatários) pra
-- action orquestrar o Resend — envio não sai do banco, o banco só emite e
-- relata.
--
--   * emails_enviados.tipo ganha 'instrumento' — superset da lista viva
--     (0084: comunicado/material/assinatura/apoio_jovem/chamado). Quem
--     mergear DEPOIS relê pg_get_constraintdef e carrega o superset da vez.
--   * emitir_instrumento_lote reusa o core (0099): link pendente é
--     reutilizado (idempotente por natureza), dupla encerrada/especialista
--     falha POR LINHA sem abortar o lote, e o relatório traz
--     jovem{email,whatsapp,nome} + mentor{email,whatsapp,nome} — a action
--     decide o destinatário (mentorado primeiro; fallback mentor repassa —
--     decisão _decisoes.md). Os endereços ficam server-side: o relatório
--     pro client carrega status/motivo, não PII de contato.
--   * instrumento respondido não re-emite em lote — a resposta é o
--     produto; re-emissão deliberada (nova rodada de PDM, revisão) segue
--     gesto por dupla na ficha. A roda tem DUAS aplicações: ≥2 respondidas
--     fecha a estação (1 respondida + janela aberta = a formal segue
--     devendo e o lote a emite normalmente).
--   * sanity cap: 100 duplas por chamada (sdr) — o alinhamento é natural,
--     enviarEmailsIndividuais batcheia no mesmo teto.

begin;

-- ---------- 1) tipo novo no log de e-mail ----------
alter table public.emails_enviados drop constraint if exists
  emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura',
                           'apoio_jovem','chamado','instrumento']));

-- ---------- 2) emitir_instrumento_lote ----------
-- Gate papel primeiro (qualquer autenticado pode chamar — só coord passa),
-- depois validações de argumento; cada dupla falha e reporta sozinha.
create or replace function public.emitir_instrumento_lote(
  p_sistema text, p_dupla_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_dupla_id uuid;
  v_dupla record;
  v_emit jsonb;
  v_link_id uuid;
  v_form_id uuid;
  v_respondidas int;
  v_linha jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  -- o mentor emite a própria dupla pela emitir_link_instrumento — o lote é
  -- operação da coordenação (mesma régua das RPCs de gestão da 0110)
  if not public.has_papel('coordenacao'::public.app_role) then
    raise exception 'sem permissão pra emitir instrumentos em lote';
  end if;
  -- os 4 instrumentos da jornada — o core repete a validação; aqui ela
  -- barra antes do relatório (erro global, não por linha)
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;
  -- cap anti-clique-gigante (o relatório nunca é escusa pra atravessar o
  -- programa inteiro de uma vez)
  if coalesce(array_length(p_dupla_ids, 1), 0) > 100 then
    raise exception 'lote acima do limite de 100 duplas por chamada';
  end if;
  if coalesce(array_length(p_dupla_ids, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  -- o form oficial da vez — pra contar respostas antes de emitir
  select f.id into v_form_id
    from public.formularios f
   where f.sistema = p_sistema;

  for v_dupla_id in
    select distinct u.id from unnest(p_dupla_ids) as u(id)
  loop
    -- select-into sem linha NÃO zera a variável — sem o reset ela carrega
    -- a dupla anterior e a linha sai duplicada/errada
    v_linha := null;
    v_link_id := null;
    select d.id, d.status, d.trilha, d.mentor_id, d.mentorado_id
      into v_dupla
      from public.duplas d
     where d.id = v_dupla_id;

    if not found then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'dupla_nao_encontrada');
      continue;
    end if;

    -- mesma régua do gate da emitir_link_instrumento (0099) — mas por
    -- linha: uma dupla inválida no meio não aborta o lote
    if v_dupla.trilha = 'especialista' then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'trilha_especialista');
      continue;
    end if;
    if v_dupla.status not in ('ativa', 'pausada') then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'dupla_encerrada');
      continue;
    end if;

    -- já cumprido descansa do lote (mesmo espírito do autoemit): a resposta
    -- registrada encerra a estação — a roda fecha só com as 2 aplicações
    if v_form_id is not null then
      select count(*) into v_respondidas
        from public.formulario_links l
       where l.formulario_id = v_form_id
         and l.dupla_id = v_dupla_id
         and l.usado_em is not null;
      if (p_sistema = 'roda_vida' and v_respondidas >= 2)
         or (p_sistema <> 'roda_vida' and v_respondidas >= 1) then
        v_out := v_out || jsonb_build_object(
          'dupla_id', v_dupla_id, 'ok', false,
          'motivo', 'ja_respondido');
        continue;
      end if;
    end if;

    begin
      v_emit := public.emitir_instrumento_core(
        v_dupla_id, p_sistema, public.my_profile_id(), 'lote'
      );
    exception when others then
      -- form encerrado/ausente, corrida de lock — falha registrada por
      -- linha, o lote segue
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'emit_falhou', 'erro', sqlerrm);
      continue;
    end;

    -- ref_id do log de e-mail é o link (uuid estável — nunca o token:
    -- bearer no log seria credencial em repouso)
    select l.id into v_link_id
      from public.formulario_links l
     where l.token = v_emit ->> 'token';

    -- destinatários pra action decidir: jovem primeiro, mentor é o repasse
    -- (decisão _decisoes.md). Os whatsapps alimentam o fallback manual do
    -- relatório — a action devolve só os das linhas não-enviadas.
    select jsonb_build_object(
        'dupla_id', v_dupla_id,
        'ok', true,
        'link_id', v_link_id,
        'token', v_emit ->> 'token',
        'reutilizado', coalesce((v_emit ->> 'reutilizado')::boolean, false),
        'jovem', jsonb_build_object(
          'nome', m.nome,
          'email', m.email,
          'whatsapp', m.whatsapp),
        'mentor', jsonb_build_object(
          'nome', p.nome,
          'email', p.email,
          'whatsapp', p.whatsapp)
      )
      into v_linha
      from public.mentorados m
      cross join public.profiles p
     where m.id = v_dupla.mentorado_id
       and p.id = v_dupla.mentor_id;

    v_out := v_out || coalesce(v_linha, jsonb_build_object(
      'dupla_id', v_dupla_id, 'ok', false,
      'motivo', 'emit_falhou', 'erro', 'destinatários incompletos'));
  end loop;

  return v_out;
end $$;

-- coord-only por gate interno: execute de authenticated como nas demais
-- RPCs de gestão; anon/public não endereçam (o PostgREST deles nem a vê)
revoke all on function public.emitir_instrumento_lote(text, uuid[])
  from public, anon;
grant execute on function public.emitir_instrumento_lote(text, uuid[])
  to authenticated;

commit;
