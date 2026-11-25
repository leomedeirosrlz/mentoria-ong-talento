-- Feedback da mentora (nov/2026): "o que são afazeres? são os combinados?".
-- Afazeres (encontro_intencoes, 0152) e combinados (encaminhamentos, 0001)
-- viram uma coisa só: o combinado ganha o nº do encontro a que pertence e o
-- responsável diz de quem é. O afazer do mentor é o combinado com
-- responsavel = 'mentor' — e o jovem já não o vê (jovem_encaminhamentos e
-- marcar_combinado filtram responsavel = 'mentorado', 0070).
--
-- `numero` é a âncora no passo do guia, como a nota (0015) e o afazer
-- (0152): existe antes do registro (preparo) e não se move com remarcação.
-- Combinado antigo herda o nº do encontro do registro; sem registro fica
-- null (só aparece na aba Combinados da ficha).

begin;

alter table public.encaminhamentos
  add column if not exists numero smallint,
  add column if not exists feito_em timestamptz,
  add column if not exists created_by uuid references public.profiles (id);

update public.encaminhamentos e
   set numero = en.numero
  from public.registros r
  join public.encontros en on en.id = r.encontro_id
 where e.registro_id = r.id
   and e.numero is null;

-- feito_em carimba a transição de status, sem confiar no caller (mesma
-- regra do afazer em 0152). No insert respeita o valor vindo da cópia
-- abaixo; combinado criado já feito recebe now().
create or replace function public.encaminhamento_carimba_feito()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'feito' and new.feito_em is null then
      new.feito_em := now();
    elsif new.status <> 'feito' then
      new.feito_em := null;
    end if;
  elsif new.status = 'feito' and old.status is distinct from 'feito' then
    new.feito_em := now();
  elsif new.status <> 'feito' then
    new.feito_em := null;
  end if;
  return new;
end
$$;

drop trigger if exists encaminhamentos_feito on public.encaminhamentos;
create trigger encaminhamentos_feito
  before insert or update of status on public.encaminhamentos
  for each row execute function public.encaminhamento_carimba_feito();

-- o recorte do "pendentes de antes" e do aviso da agenda
create index if not exists encaminhamentos_pendentes_numero_idx
  on public.encaminhamentos (dupla_id, numero) where status <> 'feito';

-- afazeres existentes viram combinados do mentor, mesmo id
do $$
begin
  if to_regclass('public.encontro_intencoes') is not null then
    insert into public.encaminhamentos
      (id, dupla_id, numero, descricao, responsavel, status, feito_em, created_by, created_at)
    select i.id, i.dupla_id, i.numero, i.texto, 'mentor',
           (case when i.feito then 'feito' else 'pendente' end)::public.encaminhamento_status,
           i.feito_em, i.created_by, i.created_at
      from public.encontro_intencoes i
    on conflict (id) do nothing;
  end if;
end
$$;

drop table if exists public.encontro_intencoes;
drop function if exists public.intencao_carimba_feito();

commit;
