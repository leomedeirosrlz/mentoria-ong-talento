-- 0108 — trilha_lembretes (REALIZA-169): lembretes automáticos do prazo de
-- 3 meses da trilha de especialista, disparados pelo tick diário
-- (/api/jobs/tick → RPC processar_lembretes_trilha). O badge na ficha
-- (TrilhaPrazoBadge) sempre mostrou o marco — mas só quando alguém abria a
-- página; ninguém lembrava ninguém. NENHUM encerramento automático: o ping
-- aponta pro rito humano (encerrar_trilha_especialista + avaliação §13).
--
-- Marcos (fire-once por (dupla, marco, destino) — o ledger é a dedup):
--   15d      0 <= dias <= 15   → especialista (duplas.mentor_id)
--   7d       0 <= dias <= 7    → especialista
--   vencida  dias < 0          → especialista + coordenação (escopo de turma)
-- dias = fim - hoje, fim = iniciada_em + 3 meses — espelha
-- prazoTrilhaEspecialista (src/lib/encerramento.ts). A janela `<=` absorve
-- job atrasado; o piso `>= 0` nos marcos futuros evita que uma trilha já
-- vencida receba "faltam 15 dias" incoerente (aceite §5) — vencida é o
-- único marco retroativo. Marcos devidos e ainda não enviados disparam
-- juntos na mesma run (pulou de 16d pra 5d: sai 15d e 7d — §3a do sdd).
--
-- Ledger próprio e não dedup em `notificacoes`: a tabela de pings não tem
-- chave de dedup (mesma dupla, 3 marcos, mesmo href colidiriam). Uma row =
-- "este marco desta dupla foi processado pra este destino" — auditável
-- (quando saiu, qual notificação) e idempotente por constraint. `vencida`
-- grava duas rows (especialista + coordenacao) no mesmo run. `on delete
-- cascade` com a dupla: trilha removida leva o histórico junto; rematch
-- cria dupla NOVA → lembretes novos (correto — é outra trilha).

begin;

create table public.trilha_lembretes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  marco text not null check (marco in ('15d','7d','vencida')),
  destino text not null check (destino in ('especialista','coordenacao')),
  -- 1:1 no destino 'especialista' (um ping por row); no destino
  -- 'coordenacao' a row cobre N pings (um por profile coord no escopo) e a
  -- coluna fica null — a auditoria desse fan-out está nas notificacoes
  notificacao_id uuid references public.notificacoes(id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (dupla_id, marco, destino)
);
comment on table public.trilha_lembretes is
  'Ledger dos lembretes do prazo de 3 meses da trilha especialista (REALIZA-169). '
  'unique(dupla_id,marco,destino) = dedup fire-once; escrita só via RPC '
  'processar_lembretes_trilha (tick diário); select coord-only.';
create index trilha_lembretes_notificacao_idx
  on public.trilha_lembretes (notificacao_id);

alter table public.trilha_lembretes enable row level security;

-- grants explícitos (o checklist de toda tabela nova): anon nada;
-- authenticated lê via policy, escreve nunca — a única escritora é a RPC
-- definer abaixo, chamada com service role pelo tick
revoke all on public.trilha_lembretes from public, anon;
revoke insert, update, delete on public.trilha_lembretes from authenticated;
grant select on public.trilha_lembretes to authenticated;

-- auditoria é da coordenação: o especialista já recebe o ping em si (o
-- ledger pra ele é redundante); supervisor vê a ficha, não o ledger
drop policy if exists trilha_lembretes_select on public.trilha_lembretes;
create policy trilha_lembretes_select on public.trilha_lembretes
  for select to authenticated
  using (public.my_role() = 'coordenacao');

-- tipos novos no CHECK (lista viva — superset da 0103 + os 2 desta issue;
-- quem mergear DEPOIS relê pg_get_constraintdef e carrega o superset da vez)
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada', 'especialista_aceitou',
    'solicitacao_cancelada', 'trilha_encerrada', 'supervisao_registrada',
    'formulario_respondido', 'avaliacao_pendente', 'apoio_jovem',
    'encontro_marcado', 'encontro_alterado', 'encontro_desfeito',
    'solicitacao_triagem', 'solicitacao_recusada', 'solicitacao_proposta',
    'chamado_aberto', 'chamado_atribuido', 'chamado_atualizacao',
    'chamado_resposta_autor', 'chamado_resolvido', 'chamado_reaberto',
    'chamado_mencao', 'sugestao_especialista', 'devolutiva_especialista',
    'lembrete', 'dupla_reta_final', 'terceiro_respondeu',
    'trilha_prazo', 'trilha_prazo_coord'
  ]));

-- Varredura diária das trilhas esp ativas. Definer + revoke total: só o
-- service role executa (o handler do tick) — o PostgREST dos papéis não a
-- vê. p_hoje injetável pra teste; o handler sempre passa o dia civil BRT.
-- Ledger+notificação na mesma transação, advisory lock por dupla serializa
-- runs concorrentes (o on conflict absorve o resto — molde enviar_lembrete,
-- 0094). Erro não é engolido: sobe pro handler e o tick responde 500 (retry
-- é inócuo — o que já saiu fica marcado no ledger).
create or replace function public.processar_lembretes_trilha(
  p_hoje date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := coalesce(p_hoje, current_date);
  v_dupla record;
  v_coord record;
  v_marco text;
  v_devido boolean;
  v_ledger uuid;
  v_notif uuid;
  v_n int;
  v_avaliadas int := 0;
  v_enviados int := 0;
  v_por_marco jsonb := '{}'::jsonb;
  v_lembretes jsonb;
  v_chave text;
begin
  for v_dupla in
    select d.id, d.mentor_id, d.turma,
           -- mesmo fim do prazoTrilhaEspecialista (setMonth(+3) sobre a data)
           ((d.iniciada_em + interval '3 months')::date - v_hoje) as dias_restantes,
           to_char((d.iniciada_em + interval '3 months')::date, 'DD/MM') as fim_br,
           pf.nome as nome_esp,
           md.nome as nome_md
      from public.duplas d
      join public.profiles pf on pf.id = d.mentor_id
      join public.mentorados md on md.id = d.mentorado_id
     where d.trilha = 'especialista'
       and d.status = 'ativa'
       and d.iniciada_em is not null
     order by d.id
  loop
    v_avaliadas := v_avaliadas + 1;
    -- serializa a varredura da dupla: dois ticks paralelos não se chocam na
    -- janela check→insert (o on conflict já bastaria; o lock evita a espera
    -- em row lock — mesmo desenho do cap do enviar_lembrete, 0094)
    perform pg_advisory_xact_lock(hashtextextended(v_dupla.id::text, 169));

    foreach v_marco in array array['15d','7d','vencida'] loop
      -- marcos futuros exigem a trilha ainda dentro do prazo (dias >= 0):
      -- vencida é o único retroativo — sem "faltam N dias" pra quem já
      -- passou do marco. Marcos devidos acumulam: job parado uma semana
      -- dispara 15d e 7d na mesma run (§3a do sdd)
      v_devido := case v_marco
        when '15d' then v_dupla.dias_restantes between 0 and 15
        when '7d'  then v_dupla.dias_restantes between 0 and 7
        else v_dupla.dias_restantes < 0
      end;
      if not v_devido then continue; end if;

      -- destino especialista (duplas.mentor_id — na trilha esp o mentor É
      -- o especialista): todo marco pinga ele
      v_ledger := null;
      insert into public.trilha_lembretes (dupla_id, marco, destino)
      values (v_dupla.id, v_marco, 'especialista')
      on conflict (dupla_id, marco, destino) do nothing
      returning id into v_ledger;
      if v_ledger is not null then
        insert into public.notificacoes
          (profile_id, tipo, titulo, corpo, href, created_by)
        values (
          v_dupla.mentor_id,
          'trilha_prazo',
          case v_marco
            when '15d' then 'Trilha de especialista: faltam ~15 dias'
            when '7d'  then 'Trilha de especialista: faltam ~7 dias'
            else 'Trilha de especialista completou 3 meses'
          end,
          case v_marco
            when '15d' then 'A trilha com ' || v_dupla.nome_md ||
              ' completa 3 meses em ' || v_dupla.fim_br ||
              '. Se já cumpriu os 5 encontros e a devolutiva, é hora de' ||
              ' preparar o fechamento com a coordenação.'
            when '7d' then 'A trilha com ' || v_dupla.nome_md ||
              ' completa 3 meses em ' || v_dupla.fim_br ||
              '. Prepare o fechamento com a coordenação.'
            else 'O guia sugere fechar a trilha com ' || v_dupla.nome_md ||
              '. Fale com a coordenação pra combinar o encerramento e a' ||
              ' avaliação final.'
          end,
          '/duplas/' || v_dupla.id,
          -- sem autor humano: automação, o tipo já diz a origem (§3b)
          null
        )
        returning id into v_notif;
        update public.trilha_lembretes
           set notificacao_id = v_notif
         where id = v_ledger;
        v_enviados := v_enviados + 1;
        v_chave := v_marco || '/especialista';
        v_por_marco := jsonb_set(
          v_por_marco,
          array[v_chave],
          to_jsonb(coalesce((v_por_marco ->> v_chave)::int, 0) + 1),
          true
        );
      end if;

      -- destino coordenação: só no vencimento — cruzar o prazo vira tarefa
      -- dela (agendar o encerramento/§13); os avisos prévios são do
      -- especialista. Escopo = mesma régua do has_papel (0085): papel
      -- global (escopo null) ou escopo = turma da dupla, e só ativas.
      -- distinct: profile com papel global + escopado não recebe em dobro
      if v_marco = 'vencida' then
        v_ledger := null;
        insert into public.trilha_lembretes (dupla_id, marco, destino)
        values (v_dupla.id, 'vencida', 'coordenacao')
        on conflict (dupla_id, marco, destino) do nothing
        returning id into v_ledger;
        if v_ledger is not null then
          v_n := 0;
          for v_coord in
            select distinct pp.profile_id
              from public.profile_papeis pp
              join public.profiles p on p.id = pp.profile_id
             where pp.papel = 'coordenacao'
               and p.ativo
               and (pp.escopo_turma is null
                    or pp.escopo_turma = v_dupla.turma)
             order by pp.profile_id
          loop
            insert into public.notificacoes
              (profile_id, tipo, titulo, corpo, href, created_by)
            values (
              v_coord.profile_id,
              'trilha_prazo_coord',
              'Trilha de especialista venceu o prazo',
              v_dupla.nome_esp || ' × ' || v_dupla.nome_md ||
                ' completou 3 meses — agendar o encerramento e a' ||
                ' avaliação §13.',
              '/duplas/' || v_dupla.id,
              null
            );
            v_n := v_n + 1;
          end loop;
          v_enviados := v_enviados + v_n;
          v_por_marco := jsonb_set(
            v_por_marco,
            array['vencida/coordenacao'],
            to_jsonb(coalesce(
              (v_por_marco ->> 'vencida/coordenacao')::int, 0) + v_n),
            true
          );
        end if;
      end if;
    end loop;
  end loop;

  -- {lembretes:[{marco,destino,n}]} agregado — o log do tick guarda o que
  -- saiu sem precisar consultar o ledger
  select coalesce(jsonb_agg(jsonb_build_object(
           'marco', split_part(e.key, '/', 1),
           'destino', split_part(e.key, '/', 2),
           'n', e.value)),
         '[]'::jsonb)
    into v_lembretes
    from jsonb_each(v_por_marco) e;

  return jsonb_build_object(
    'ok', true,
    'hoje', v_hoje,
    'avaliadas', v_avaliadas,
    'enviados', v_enviados,
    'lembretes', v_lembretes
  );
end $$;

-- interna: só service_role executa (o handler do tick). O PostgREST dos
-- papéis não a vê — mesmo desenho de gravar_saude_snapshots (0107) e
-- emitir_avaliacao_esp (0105)
revoke all on function public.processar_lembretes_trilha(date)
  from public, anon, authenticated;

commit;

-- rollback manual:
-- drop function public.processar_lembretes_trilha(date);
-- alter table public.notificacoes drop constraint notificacoes_tipo_check;
-- alter table public.notificacoes add constraint notificacoes_tipo_check
--   check (tipo = any (array[<lista anterior, ver 0103]>));
-- drop table public.trilha_lembretes;
