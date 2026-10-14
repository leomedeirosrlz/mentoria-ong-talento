-- 0081: currículo do mentorado — documento confidencial (REALIZA-119)
--
-- O form de matching coleta o currículo como link do Google Drive e ele
-- morria no form_bruto (leitura raw, sem casa estruturada). Vira campo
-- dedicado em duas formas que convivem:
--   · curriculo_url  — o link externo que veio do intake;
--   · curriculo_path — arquivo no bucket privado `documentos`, quando a
--     coordenação anexa o PDF/imagem direto na ficha.
--
-- Confidencial por decisão de produto: coordenação e auxiliar executivo
-- (role 'supervisor') leem; mentor NÃO vê por ora (decisão pendente —
-- o caminho é adicionar `or d.mentor_id = my_profile_id()` à view); o
-- próprio jovem e colegas nunca. Por isso as colunas ficam fora do grant
-- por coluna (0034) e a leitura passa por view escopada, no modelo das
-- views *_pessoal — mas com recorte mais estreito: pro auxiliar executivo
-- só as linhas dos mentorados das duplas que supervisiona (a policy
-- mentorados_select da 0023 promete exatamente isso e a ficha /pessoas/[id]
-- já só abre pra eles nesse escopo).
--
-- Escrita é coord-only pela RLS de mentorados (mentorados_coord) + a
-- checagem de papel na action — sem RPC: o update é coluna direta, como
-- documento_path.

begin;

alter table public.mentorados
  add column curriculo_path text,
  add column curriculo_url text
    check (curriculo_url is null or curriculo_url ~* '^https?://\S+$');

-- 1 objeto do bucket = currículo de 1 pessoa (mesmo desenho do
-- mentorados_documento_path_key, 0012) — o unique deixa a subquery das
-- policies de storage barata e impede dois cadastros apontando o mesmo path.
create unique index mentorados_curriculo_path_key
  on public.mentorados (curriculo_path)
  where curriculo_path is not null;

comment on column public.mentorados.curriculo_path is
  'Currículo (arquivo) no bucket documentos. Confidencial: coord e auxiliar executivo leem via mentorados_curriculo.';
comment on column public.mentorados.curriculo_url is
  'Currículo (link externo, ex.: Drive) do form de matching. Confidencial: idem curriculo_path.';

-- fora do grant de propósito — revoke explícito documenta a intenção e
-- segura uma re-concessão table-level futura (padrão da 0034/0054)
revoke select (curriculo_path, curriculo_url)
  on public.mentorados from authenticated;

-- ---------- view escopada ----------
-- Roda como owner (ignora grants/RLS da base); o WHERE entrega: tudo pra
-- coordenação; pro auxiliar executivo só os mentorados das duplas que ele
-- supervisiona — o mesmo recorte em que a RLS deixa ele abrir a ficha.
-- Qualquer outro papel (mentor, jovem, sem papel) recebe zero linhas.
create or replace view public.mentorados_curriculo as
select
  m.id,
  m.nome,
  m.curriculo_path,
  m.curriculo_url
from public.mentorados m
where public.my_role() = 'coordenacao'::app_role
  or exists (
    select 1
    from public.duplas d
    where d.mentorado_id = m.id
      and d.supervisor_id = public.my_profile_id()
  );

revoke all on public.mentorados_curriculo from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.mentorados_curriculo from authenticated;
grant select on public.mentorados_curriculo to authenticated;

-- ---------- storage do bucket `documentos` ----------
-- A leitura/escrita de objeto exige o path já registrado em alguém, e a
-- subquery da policy roda como invoker — curriculo_path está fora do
-- grant de coluna, então o exists lê a VIEW (o mesmo remendo da 0026 com
-- profiles_contato: pra coordenação a view cobre todas as linhas).
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
      or exists (select 1 from public.documentos_pessoa d where d.path = name)
      or exists (select 1 from public.mentorados_curriculo mc where mc.curriculo_path = name)
    )
  );

-- auxiliar executivo: baixa (signed URL) só o objeto que é curriculo_path
-- de mentorado que ele supervisiona — a view já carrega esse recorte.
-- Upload/remoção seguem coord-only (policies insert/delete não mudam pra
-- ele — escrever currículo é gesto de coordenação).
create policy documentos_storage_select_curriculo on storage.objects for select
  to authenticated using (
    bucket_id = 'documentos'
    and public.my_role() = 'supervisor'::app_role
    and exists (
      select 1
      from public.mentorados_curriculo mc
      where mc.curriculo_path = name
    )
  );

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
      or exists (select 1 from public.documentos_pessoa d where d.path = name)
      or exists (select 1 from public.mentorados_curriculo mc where mc.curriculo_path = name)
    )
  );

commit;
