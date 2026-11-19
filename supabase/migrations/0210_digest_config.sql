-- 0210 — digest_config (REALIZA-451 / spec 007 US14): configuração do
-- digest semanal da coordenação. Uma row singleton (id boolean true): a
-- ausência dela é a config padrão — toda segunda, coordenação, todas as
-- seções — idêntico ao comportamento anterior à tabela.
--
-- `dia_semana` segue o getUTCDay do job (0=domingo … 6=sábado; default 1
-- = segunda). `cadencia`: 'semanal' (toda semana no dia), 'quinzenal'
-- (no dia, só se o último envio com sucesso tiver 14+ dias — a âncora é
-- a própria memória de emails_enviados) ou 'desligado' (job retorna
-- pulado sem montar nem enviar).
--
-- `destinatarios` = {"papeis":[], "profiles":[], "emails":[]} — união com
-- dedup na montagem: papéis resolvem via profile_papeis+profiles_contato,
-- profiles são ids individuais ativos, emails são endereços explícitos.
-- `secoes` = {"encontros":bool,"riscos":bool,"pendencias":bool} — o que
-- entra no corpo; as contagens do job (nRisco/nPendentes) não mudam.
--
-- Escopo: só a coordenação lê e escreve (has_papel cobre o papel
-- secundário — mesmo critério da action e da 0148). Ninguém mais tem
-- grant. O job lê via service role, que bypassa RLS por contrato.
begin;

create table public.digest_config (
  id boolean primary key default true check (id),
  dia_semana smallint not null default 1
    check (dia_semana between 0 and 6),
  cadencia text not null default 'semanal'
    check (cadencia in ('semanal', 'quinzenal', 'desligado')),
  destinatarios jsonb not null
    default '{"papeis": ["coordenacao"], "profiles": [], "emails": []}'
    check (jsonb_typeof(destinatarios) = 'object'),
  secoes jsonb not null
    default '{"encontros": true, "riscos": true, "pendencias": true}'
    check (jsonb_typeof(secoes) = 'object'),
  atualizado_por uuid references public.profiles (id),
  atualizado_em timestamptz not null default now()
);

alter table public.digest_config enable row level security;

revoke all on public.digest_config from public, anon;
grant select, insert, update on public.digest_config to authenticated;

drop policy if exists digest_config_coord on public.digest_config;
create policy digest_config_coord on public.digest_config
  for all to authenticated
  using (public.has_papel('coordenacao'))
  with check (public.has_papel('coordenacao'));

commit;
