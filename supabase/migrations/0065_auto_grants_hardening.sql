-- REALIZA-107 fase A — hardening dos auto-grants ANTES do papel 'mentorado'.
-- `my_role() is not null` concede acesso a qualquer papel presente E futuro:
-- no dia em que 'mentorado' entrasse no enum, todo jovem leria profiles/mentor_profiles
-- inteiros e catálogos de domínio (o card dos menores também ficaria aberto à via
-- reversa). Troca por lista explícita dos 4 papéis atuais — 'mentorado' fica fora
-- por omissão até a fase C adicionar ramos escopados próprios.
--
-- Não referencia 'mentorado' (o valor do enum ainda não existe — fase B).
-- Comportamento preservado 1:1 pros papéis atuais; usuário autenticado sem papel
-- (my_role()=null) já não tinha acesso por outros caminhos e não perde nada.
-- Rollback: reexecutar os create policy com o predicado antigo.

begin;

-- 1) profiles — o auto-grant mais sensível: qualquer papel lia TODOS os profiles.
-- Mantém self-read (user_id = auth.uid()); adultos ligados ao jovem entram na
-- fase C como ramo escopado — aqui só a exclusão por omissão.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    public.my_role() in ('coordenacao','supervisor','mentor_dpp','mentor_especialista')
    or user_id = auth.uid()
  );

-- 2) mentor_profiles — idem. O catálogo de especialistas que o jovem vê vem por
-- view definer dedicada (D6), não pela tabela base.
drop policy if exists mentor_profiles_select on public.mentor_profiles;
create policy mentor_profiles_select on public.mentor_profiles for select
  using (public.my_role() in ('coordenacao','supervisor','mentor_dpp','mentor_especialista'));

-- 3) catálogos de domínio — ciclo_eventos, especialista_eventos, cronogramas.
drop policy if exists ciclo_eventos_select on public.ciclo_eventos;
create policy ciclo_eventos_select on public.ciclo_eventos for select
  using (public.my_role() in ('coordenacao','supervisor','mentor_dpp','mentor_especialista'));

drop policy if exists especialista_eventos_select on public.especialista_eventos;
create policy especialista_eventos_select on public.especialista_eventos for select
  using (public.my_role() in ('coordenacao','supervisor','mentor_dpp','mentor_especialista'));

drop policy if exists cronogramas_select on public.cronogramas;
create policy cronogramas_select on public.cronogramas for select
  using (public.my_role() in ('coordenacao','supervisor','mentor_dpp','mentor_especialista'));

-- 4) materiais — a policy de 0004 NUNCA teve gate de papel: qualquer autenticado
-- (incl. sem papel / inativo) lia audiencia='todos'. Espelha comunicados (0019):
-- gate `is not null` + filtro de audiência. 'todos' continua alcançável por
-- qualquer papel — decisão explícita: o jovem lê comunicados/materiais 'todos'.
drop policy if exists materiais_select on public.materiais;
create policy materiais_select on public.materiais for select using (
  public.my_role() is not null and (
    audiencia = 'todos'
    or public.my_role() = 'coordenacao'
    or (audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
    or (audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
  )
);

-- 5) storage do bucket materiais — mesmo gate, espelhando a policy da row.
drop policy if exists materiais_storage_select on storage.objects;
create policy materiais_storage_select on storage.objects for select
  using (
    bucket_id = 'materiais'
    and public.my_role() is not null
    and exists (
      select 1 from public.materiais m
      where m.path = name
        and (
          m.audiencia = 'todos'
          or public.my_role() = 'coordenacao'
          or (m.audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
          or (m.audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
        )
    )
  );

-- De propósito NÃO mexemos em:
-- · comunicados_select (0019) — já é `is not null and (audiência…)`: o jovem
--   recebe 'todos' pelo mesmo caminho. Shape final correto, sem troca.
-- · templates_select using(true) (0033:68) — metadados públicos do programa.
-- · documentos_storage_select_sistema (0033:316) — `sistema/` aberto a
--   autenticados por desenho (contra-assinatura embutida nos PDFs).
-- · assinaturas_select (0033:73) — já escopada (self+coord); ramo mentorado
--   é fase C (precisa de my_mentorado_id(), que ainda não existe).
-- · notificacoes_insert ramo pedido_apoio (0041:105) — fica: o jovem ganha
--   "pedir ajuda" de graça quando tiver profile_id.

commit;
