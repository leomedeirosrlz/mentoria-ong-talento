-- REALIZA-341 — histórico de remarcações de encontro.
--
-- A remarcação sobrescreve data_hora + motivo_reagendamento na mesma row
-- (unique dupla_id+numero): o app sabe a data atual e o último motivo,
-- nunca quantas vezes nem de quando pra quando o encontro andou. A
-- coordenação precisa dessa trilha pra ler o vaivém da dupla e o
-- calendário do mentor vai mostrar a data antiga riscada — então cada
-- mudança de data vira uma linha aqui, gravada pelo trigger.
--
-- Escrita SÓ pelo trigger: sem policy de insert/update/delete pra
-- usuário — histórico é fato, na mesma lógica do guard de 'realizado'
-- (0043). A função é security definer justamente pra não depender de
-- policy de INSERT do papel que remarcou.
--
-- WHEN é por COLUNA, não por status — verificado nos writers de
-- actions.ts e nas RPCs: salvarRegistro grava só status/realizado_em/
-- duracao_min, o retroativo é INSERT puro, marcar_aconteceu_mentorado
-- (0121) idem e o importa_registros (0082) faz coalesce(e.data_hora, …),
-- que nunca muda valor não-nulo. Quem move a data é agendarEncontro e
-- agendar_encontro_mentorado (0072) — sempre remarcação de verdade,
-- inclusive re-agendar o que foi "não aconteceu" (era X, não rolou, foi
-- pra Y: também é história). data_nova exige não-nulo: zerar a data não
-- é "de quando pra quando".
--
-- Escopo de leitura = o de encontros (0125): coord tudo, mentor e
-- supervisor da dupla, e o mentorado da dupla via jovem_duplas — ele
-- remarca junto pela agenda livre, esconder o histórico dele seria
-- incoerente. dupla_id e numero ficam desnormalizados pra policy e
-- leitura não dependerem de join (mesma régua de encontro_notas).

begin;

create table if not exists public.encontro_remarcacoes (
  id uuid primary key default gen_random_uuid(),
  encontro_id uuid not null references public.encontros (id) on delete cascade,
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  data_anterior timestamptz not null,
  data_nova timestamptz not null,
  motivo text check (char_length(motivo) <= 1000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.encontro_remarcacoes enable row level security;

-- "quantas remarcações essa dupla fez" e a trilha de um encontro
create index if not exists encontro_remarcacoes_dupla_idx
  on public.encontro_remarcacoes (dupla_id);
create index if not exists encontro_remarcacoes_encontro_idx
  on public.encontro_remarcacoes (encontro_id);

-- carimba cada mudança de data_hora: quem (my_profile_id resolve
-- auth.uid()→profiles.id; reparo via SQL sem sessão grava null), de
-- quando, pra quando e o motivo que o writer acabou de salvar na row
create or replace function public.encontro_log_remarcacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.encontro_remarcacoes
    (encontro_id, dupla_id, numero, data_anterior, data_nova, motivo,
     created_by)
  values
    (new.id, new.dupla_id, new.numero, old.data_hora, new.data_hora,
     new.motivo_reagendamento, public.my_profile_id());
  return new;
end
$$;

drop trigger if exists encontros_remarcacao_log on public.encontros;
create trigger encontros_remarcacao_log
  after update of data_hora on public.encontros
  for each row
  when (
    old.data_hora is distinct from new.data_hora
    and old.data_hora is not null
    and new.data_hora is not null
  )
  execute function public.encontro_log_remarcacao();

-- verbatim do escopo de encontros_select (0125): coord tudo; mentor e
-- supervisor da dupla; mentorado lê as das próprias duplas
drop policy if exists encontro_remarcacoes_select on public.encontro_remarcacoes;
create policy encontro_remarcacoes_select on public.encontro_remarcacoes for select
  to authenticated
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = encontro_remarcacoes.dupla_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
    or (
      public.my_role() = 'mentorado'
      and exists (
        select 1 from public.jovem_duplas jd
        where jd.id = encontro_remarcacoes.dupla_id
      )
    )
  );

commit;
