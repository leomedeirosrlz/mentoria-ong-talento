-- emails_enviados: log dos disparos transacionais (avisos e materiais) feitos
-- pela plataforma via Resend. O envio acontece na action; a row registra quem
-- pediu, pra qual audiência e o resultado — memória pra coordenação auditar
-- "pra quem saiu esse e-mail" sem depender do painel do Resend.
begin;

create table public.emails_enviados (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references public.profiles (id),
  tipo text not null check (tipo in ('comunicado', 'material')),
  -- ref aponta pra comunicados.id ou materiais.id conforme o tipo — sem FK:
  -- um uuid não referencia duas tabelas, e o log sobrevive à exclusão do
  -- aviso/material (apagar o aviso não pode apagar o histórico do envio)
  ref_id uuid,
  assunto text not null,
  audiencia text[] not null default '{}',
  destinatarios integer not null default 0,
  enviados integer not null default 0,
  falhas text[],
  created_at timestamptz not null default now()
);
create index emails_enviados_ref_idx on public.emails_enviados (tipo, ref_id);
create index emails_enviados_created_idx
  on public.emails_enviados (created_at desc);

alter table public.emails_enviados enable row level security;

-- leitura e escrita só da coordenação (o insert vem da action com o JWT dela)
grant select, insert on public.emails_enviados to authenticated;

drop policy if exists emails_enviados_select on public.emails_enviados;
create policy emails_enviados_select on public.emails_enviados for select
  using (public.my_role() = 'coordenacao');

drop policy if exists emails_enviados_insert on public.emails_enviados;
create policy emails_enviados_insert on public.emails_enviados for insert
  with check (public.my_role() = 'coordenacao');

commit;
