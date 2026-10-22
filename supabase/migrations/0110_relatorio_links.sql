-- 0110 relatórios públicos com senha (REALIZA-170): a tabela mínima da 167
-- (`relatorio_links`) ganha senha/config/expiração e o /resumo/<slug> deixa
-- de ser "link obscuro com recorte na query" pra virar relatório salvo,
-- auditável e revogável — pra parceiros, diretoria e financiadores.
--
--   * senha_hash só guarda o bcrypt (pgcrypto `crypt`/`gen_salt('bf')`) — a
--     senha clara nasce no gerador da RPC, aparece UMA vez na UI e morre.
--     O seed legado da T2 fica `null` de propósito: o link em circulação
--     não pode quebrar no deploy; a UI de gestão marca "Sem senha" e a
--     coordenação define uma (redefinir) antes do `expira_em` fechar.
--   * `config` é o recorte SALVO — o público não escolhe nada por query.
--     Os 3 tipos de v1 são operacionais: 'grade' (a grade de sempre),
--     'ciclo' (uma linha por encontro — prestação de contas) e
--     'assinaturas' (documentos e status de assinatura). Respostas de
--     instrumentos (anamnese/360/avaliações) NÃO entram — LGPD art. 11.
--   * dados saem da RPC `abrir_relatorio` por allowlist de colunas escrita
--     em SQL: o que não está nomeado no select não atravessa a fronteira
--     (sem `*` nem jsonb genérico). Contato (email/whatsapp) só viaja
--     quando `expor_contato` é true — e só pro tipo 'grade'.
--   * anon continua com zero grants de tabela (0032): as únicas portas
--     públicas são as duas RPCs definer — `relatorio_link_info` devolve o
--     shell (existe/estado/precisa_senha/título) e `abrir_relatorio`
--     devolve os dados. Gestão é RPC autenticada com gate has_papel.
--   * auditoria: resumo_acessos (0106) ganha `ok`/`motivo`/`link_id` — a
--     própria RPC escreve a linha (best-effort; falha vira flag audit_fail
--     que o app alerta no Sentry — auditoria nunca é gate).
--   * rate-limit tem DOIS eixos: 5 falhas/15min por (slug, ip_hash) e
--     50 falhas/24h por slug. O por-IP usa `p_ip_hash`, que é argumento do
--     chamador — FORJÁVEL via PostgREST direto (o app manda o hash do IP
--     real, mas o contrato não pode confiar nele). O bound de segurança de
--     verdade é o cap global por slug, que não depende de nada externo.
--   * advisory lock por slug serializa contagem+insert do limite; a poda
--     lazy de 13 meses (decisão _decisoes.md) roda dentro da mesma trava.
--
-- ORDEM × a 0111: `0110` ordena ANTES de `0111` em replay completo (nome do
-- arquivo manda no `db push`), mas em prod a 0111 já foi aplicada — a tabela
-- relatorio_links que ela criou precisa de alter, enquanto num reset limpo
-- quem cria é a 0110. As duas trilhas convergem: `create table if not
-- exists` com o shape final + `alter ... add column if not exists`/`drop
-- not null` cobrem qualquer pré-existente, e o seed do slug legado é
-- insert-on-conflict (0110 primeiro) + update de backfill (0111 primeiro).
-- turma_inscricoes entra `if not exists` com RLS ligada e SEM policy —
-- deny-all seguro até a 0111 plantar a dela (a RPC lê como definer/owner
-- de qualquer jeito). Se a 0111 evoluir, revisitar o DDL copiado aqui.

begin;

-- ------------------------------------------------------- relatorio_links
-- Shape final da 170 (o mínimo da 0111 + as colunas da 170). Num reset
-- limpo quem cria é este bloco; com a 0111 já aplicada o `if not exists`
-- pula a criação e os `alter` abaixo fecham a diferença.
create table if not exists public.relatorio_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[A-Za-z0-9_-]{12,128}$')
    default translate(encode(extensions.gen_random_bytes(18),'base64'),'+/=','-_')),
  -- turma opcional desde já: o recorte mora em config — ciclo pode mirar um
  -- cronograma e assinaturas pode nem ter turma (a 0111 previa: "a 170
  -- pode torná-la nullable")
  turma text check (turma is null or char_length(turma) between 1 and 80),
  titulo text not null check (char_length(titulo) between 1 and 120),
  senha_hash text
    check (senha_hash is null or char_length(senha_hash) between 20 and 120),
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  criado_por uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  expira_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid references public.profiles (id) on delete set null
);

comment on table public.relatorio_links is
  'Links públicos de relatório (/resumo/<slug>) — REALIZA-170. config = '
  'recorte salvo {tipo: grade|ciclo|assinaturas, ...}; senha_hash = bcrypt '
  'da senha compartilhada (null só no legado). Select coord-only; escrita '
  'só pelas RPCs de gestão; o público lê por relatorio_link_info e '
  'abrir_relatorio (definer).';

comment on column public.relatorio_links.senha_hash is
  'bcrypt (crypt/gen_salt bf) da senha compartilhada. NULL = link sem senha '
  '(legado ou exceção) — novos links sempre nascem com hash. (170)';
comment on column public.relatorio_links.config is
  'Recorte salvo do relatório público: {tipo: grade|ciclo|assinaturas, '
  'turma?, granularidade?, colunas?, expor_contato?, cronograma_id?, '
  'documento?, status_assinatura?}. O público não passa parâmetro — o '
  'allowlist de dados é do tipo, não da coluna pedida. (170)';
comment on column public.relatorio_links.expira_em is
  'Validade opcional do link. Não é autorização de sessão — é o fim do '
  'próprio link (abrir_relatorio recusa e o info marca "expirado"). (170)';

-- convergência com a 0111 já aplicada: colunas novas entram por alter, e o
-- NOT NULL que ela criou em turma/titulo cai/sobe pros valores da 170
alter table public.relatorio_links
  alter column turma drop not null,
  alter column titulo set not null,
  add column if not exists senha_hash text
    check (senha_hash is null or char_length(senha_hash) between 20 and 120),
  add column if not exists config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  add column if not exists expira_em timestamptz,
  add column if not exists revogado_por uuid references public.profiles (id)
    on delete set null;

alter table public.relatorio_links enable row level security;

-- mínimo privilégio explícito: metadado de link público não pode vazar por
-- grant esquecido (a 0032 já zera os defaults, mas o explícito é a régua)
revoke all on public.relatorio_links from public, anon;
revoke insert, update, delete on public.relatorio_links from authenticated;
grant select on public.relatorio_links to authenticated;

drop policy if exists relatorio_links_select on public.relatorio_links;
create policy relatorio_links_select on public.relatorio_links
  for select to authenticated
  using (public.my_role() = 'coordenacao');

-- ------------------------------------------------------- turma_inscricoes
-- Tabela da 0111, criada aqui `if not exists` pra ordem 0110-primeiro: a
-- RPC de grade lê a fila por ela. DDL copiado verbatim da 0111 — se ela
-- evoluir, REVISITAR. RLS ligada + zero policies = deny-all até a 0111
-- plantar a policy dela (a RPC lê como owner de qualquer jeito; a fila
-- aguardando é dado legítimo do relatório).
create table if not exists public.turma_inscricoes (
  id uuid primary key default gen_random_uuid(),
  turma text not null check (char_length(turma) between 1 and 80),
  profile_id uuid references public.profiles(id) on delete cascade,
  mentorado_id uuid references public.mentorados(id) on delete cascade,
  papel_esperado text not null
    check (papel_esperado in ('mentor','mentorado')),
  status text not null default 'aguardando'
    check (status in ('aguardando','formada','desistiu')),
  nota text check (nota is null or char_length(nota) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1),
  check ((papel_esperado = 'mentor') = (profile_id is not null)),
  unique nulls not distinct (turma, profile_id, mentorado_id)
);
alter table public.turma_inscricoes enable row level security;
revoke all on public.turma_inscricoes from public, anon;
grant select on public.turma_inscricoes to authenticated;

-- ------------------------------------------------------------- seed legado
-- O slug em circulação vira link de verdade. Dois caminhos, mesmo destino:
--   · 0110 antes da 0111 → este insert já nasce com config+prazo e o seed
--     dela (`on conflict do nothing`) o respeita;
--   · 0111 já aplicada → o insert conflita e o update abaixo faz backfill
--     da config '{}' herdada.
-- senha_hash fica NULL: o link vivo não pode quebrar no deploy — a UI
-- marca "Sem senha" e a coordenação define uma (redefinir) antes do
-- expira_em fechar a janela em 120 dias.
insert into public.relatorio_links (slug, turma, titulo, config, expira_em)
values (
  't2-x7k4m9qf2w8j',
  'T2 · 2026/2027',
  'Resumo da turma — T2 · 2026/2027',
  '{
    "tipo": "grade",
    "turma": "T2 · 2026/2027",
    "granularidade": "pessoas",
    "colunas": ["papel","nome","cidade_uf","par","status_dupla","iniciada_em","demanda","auxiliar"],
    "expor_contato": false
  }'::jsonb,
  now() + interval '120 days'
)
on conflict (slug) do nothing;

update public.relatorio_links
   set config = '{
     "tipo": "grade",
     "turma": "T2 · 2026/2027",
     "granularidade": "pessoas",
     "colunas": ["papel","nome","cidade_uf","par","status_dupla","iniciada_em","demanda","auxiliar"],
     "expor_contato": false
   }'::jsonb,
       expira_em = coalesce(expira_em, now() + interval '120 days')
 where slug = 't2-x7k4m9qf2w8j'
   and config = '{}'::jsonb;

-- ------------------------------------------------ resumo_acessos: ok/motivo/link
alter table public.resumo_acessos
  -- link_id é FK fraca de associação (set null): o rastro sobrevive à vida
  -- do link — revogação não apaga e delete futuro mantém a linha
  add column if not exists link_id uuid references public.relatorio_links (id)
    on delete set null,
  add column if not exists ok boolean not null default true,
  -- motivo interno da falha: o externo é sempre a mesma resposta genérica,
  -- mas a coordenação precisa saber se foi senha errada, limite ou estado
  add column if not exists motivo text
    check (motivo is null or motivo in
      ('senha','limite','revogado','expirado','sem_link','config'));

-- contagem quente do rate-limit: falhas recentes por slug (a RPC filtra
-- acessado_em por janela; o partial index já deixa só o que interessa)
create index if not exists resumo_acessos_falhas
  on public.resumo_acessos (slug, acessado_em desc) where not ok;

-- ---------------------------------------------------------------- gerador de senha
create or replace function public.gerar_senha_relatorio()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  -- alfabeto sem ambíguos (fora l/i/1 e o/0): a senha é lida por
  -- telefone/WhatsApp — confundir caracteres custa acesso ao parceiro
  v_alf constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_senha text := '';
  v_b int;
begin
  while char_length(v_senha) < 8 loop
    v_b := get_byte(extensions.gen_random_bytes(1), 0);
    -- rejeição (8×31=248): descarta o excedente — sem viés de módulo nos
    -- primeiros 8 símbolos. 31^8 ≈ 39,7 bits + cap de tentativa = folga.
    if v_b < 248 then
      v_senha := v_senha || substr(v_alf, (v_b % 31) + 1, 1);
    end if;
  end loop;
  -- 2 grupos de 4 ("k7f2-m9xw") — ditável e conferível de relance
  return substr(v_senha, 1, 4) || '-' || substr(v_senha, 5, 4);
end;
$$;

comment on function public.gerar_senha_relatorio() is
  'Senha compartilhável "xxxx-xxxx" em alfabeto sem ambíguos (170). Só a '
  'RPC de gestão chama — o texto claro volta uma vez na resposta e não é '
  'gravado (o banco fica com o bcrypt).';

-- ---------------------------------------------------------------- log interno
-- Insert best-effort em resumo_acessos — chamado de dentro de abrir_relatorio
-- (definer, owner: RLS/grant não se aplicam). Não é concedido a nenhum
-- papel: só outra função definer do owner o alcança. O try/except mora
-- aqui porque a auditoria é best-effort de verdade — schema quebrado não
-- pode derrubar nem travar a abertura do link.
create or replace function public.resumo_log_acesso(
  p_slug text,
  p_link_id uuid,
  p_ip_hash text,
  p_ua text,
  p_params jsonb,
  p_ok boolean,
  p_motivo text
)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into public.resumo_acessos
    (slug, link_id, ip_hash, user_agent, params, ok, motivo)
  values
    (p_slug, p_link_id, p_ip_hash, left(coalesce(p_ua, ''), 500),
     coalesce(p_params, '{}'::jsonb), p_ok, p_motivo);
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.resumo_log_acesso(text, uuid, text, text, jsonb, boolean, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- info pública
-- Shell do link — nada de dados. `existe` falso cobre slug malformado e
-- inexistente: a página 404 os dois e a enumeração não ganha oráculo.
create or replace function public.relatorio_link_info(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_link record;
begin
  if p_slug is null or p_slug !~ '^[A-Za-z0-9_-]{12,128}$' then
    return jsonb_build_object('existe', false);
  end if;

  select l.titulo,
         (l.senha_hash is not null) as protegido,
         case
           when l.revogado_em is not null then 'revogado'
           when l.expira_em is not null and l.expira_em <= now() then 'expirado'
           else 'ativo'
         end as estado
    into v_link
    from public.relatorio_links l
   where l.slug = p_slug;

  if not found then return jsonb_build_object('existe', false); end if;

  return jsonb_build_object(
    'existe', true,
    'estado', v_link.estado,
    'precisa_senha', v_link.protegido,
    'titulo', v_link.titulo
  );
end;
$$;

comment on function public.relatorio_link_info(text) is
  'Shell do link público (170): existe/estado/precisa_senha/título. Sem '
  'dados, sem log — quem tem o link e nunca tenta senha não aparece na '
  'auditoria (limitação consciente: tentativa é o evento auditável).';

revoke all on function public.relatorio_link_info(text) from public;
grant execute on function public.relatorio_link_info(text) to anon, authenticated;

-- ---------------------------------------------------------------- abertura
-- A única porta dos dados: estado → limite → senha → config → allowlist.
-- Falha externa é sempre {ok:false, motivo} sem detalhe; a razão interna
-- vai na linha resumo_acessos pra coordenação.
create or replace function public.abrir_relatorio(
  p_slug text,
  p_senha text,
  p_ip_hash text,
  p_ua text
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_link record;
  v_cfg jsonb;
  v_tipo text;
  v_turma text;
  v_cron uuid;
  v_doc text;
  v_st text;
  v_contato boolean;
  v_dados jsonb;
  v_profiles jsonb;
  v_mentorados jsonb;
  v_audit_fail boolean := false;
  v_n_ip bigint;
  v_n_slug bigint;
  v_min_ip timestamptz;
  v_min_slug timestamptz;
  v_retry timestamptz;
begin
  -- serializa tentativas por slug: a contagem do limite e o insert do log
  -- enxergam a mesma verdade sob concorrência (lock morre com a transação)
  if p_slug is not null then
    perform pg_advisory_xact_lock(hashtext('resumo:' || p_slug));
  end if;

  -- poda lazy de retenção (13 meses, decisão _decisoes.md — molde
  -- login_handoffs 0049): a RPC mais chamada carrega a manutenção
  begin
    delete from public.resumo_acessos
     where acessado_em < now() - interval '13 months';
  exception when others then
    v_audit_fail := true;
  end;

  select l.id, l.slug, l.titulo, l.senha_hash, l.config,
         l.expira_em, l.revogado_em
    into v_link
    from public.relatorio_links l
   where l.slug = p_slug;

  if not found then
    -- slug inexistente não vira linha: o log não é sensor de enumeração
    return jsonb_build_object('ok', false, 'motivo', 'sem_link');
  end if;

  -- gates de estado antes de qualquer custo de senha
  if v_link.revogado_em is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'revogado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'revogado', 'audit_fail', v_audit_fail);
  end if;
  if v_link.expira_em is not null and v_link.expira_em <= now() then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'expirado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'expirado', 'audit_fail', v_audit_fail);
  end if;

  -- rate-limit, dois eixos (o lock acima serializa contagem + insert):
  --   a) (slug, ip_hash): 5 falhas/15min — o ip_hash é fornecido pelo app,
  --      que o deriva de header confiável; via REST direto o argumento é
  --      forjável — por isso ele NÃO é o bound de segurança…
  --   b) slug global: 50 falhas/24h — este é o bound de verdade (sdr R1):
  --      nem mil IPs falsos passam dele.
  begin
    select count(*) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           count(*) filter (
             where a.acessado_em > now() - interval '24 hours'),
           min(a.acessado_em) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           min(a.acessado_em) filter (
             where a.acessado_em > now() - interval '24 hours')
      into v_n_ip, v_n_slug, v_min_ip, v_min_slug
      from public.resumo_acessos a
     where a.slug = p_slug and not a.ok;
  exception when others then
    -- fail-open por decisão: auditoria quebrada não pode transformar o
    -- relatório público inteiro em indisponível; audit_fail avisa o Sentry
    v_audit_fail := true;
    v_n_ip := 0;
    v_n_slug := 0;
  end;

  v_retry := null;
  if coalesce(v_n_ip, 0) >= 5 then
    v_retry := v_min_ip + interval '15 minutes';
  end if;
  if coalesce(v_n_slug, 0) >= 50 then
    v_retry := greatest(
      coalesce(v_retry, v_min_slug + interval '24 hours'),
      v_min_slug + interval '24 hours');
  end if;
  if v_retry is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'limite');
    return jsonb_build_object(
      'ok', false, 'motivo', 'limite',
      'retry_em', v_retry, 'audit_fail', v_audit_fail);
  end if;

  -- senha: bcrypt compara sem expor timing — IS DISTINCT FROM porque crypt
  -- devolve NULL com hash corrompido e NULL <> x avaliaria NULL (o IF
  -- trataria como falso e abriria o link). O sleep iguala a latência do
  -- erro à faixa do sucesso (o crypt de verdade custa ~80ms)
  if v_link.senha_hash is not null then
    if p_senha is null
       or extensions.crypt(p_senha, v_link.senha_hash)
          is distinct from v_link.senha_hash then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'senha');
      perform pg_sleep(0.3);
      return jsonb_build_object(
        'ok', false, 'motivo', 'senha', 'audit_fail', v_audit_fail);
    end if;
  end if;

  -- allowlist de tipos na leitura TAMBÉM: config 'respostas' forjado por
  -- SQL direto (bypass da RPC de criação) morre aqui, não na serialização
  v_cfg := v_link.config;
  v_tipo := v_cfg->>'tipo';
  if v_tipo is null or v_tipo not in ('grade', 'ciclo', 'assinaturas') then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
    return jsonb_build_object(
      'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
  end if;

  v_turma := nullif(v_cfg->>'turma', '');
  -- comparação textual, não cast: 'yes'::boolean explodiria a RPC com
  -- config forjado — '= ''true''' degrada pra false, que é o seguro
  v_contato := (v_cfg->>'expor_contato') = 'true';

  -- ---------------------------------------------------------- grade
  if v_tipo = 'grade' then
    -- participantes = mentores + auxiliares das duplas do recorte + a fila
    -- de espera da turma (turma_inscricoes, 0111). Sem select *: id, nome e
    -- cidade/uf são o que as linhas consomem; contato só entra no opt-in.
    if v_contato then
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf, p2.email, p2.whatsapp
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf, m2.email, m2.whatsapp
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    else
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    end if;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.mentor_id, d2.mentorado_id,
                 d2.supervisor_id, d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
        ) d), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'inscricoes', coalesce((
        select jsonb_agg(to_jsonb(i)) from (
          select i2.papel_esperado, i2.profile_id, i2.mentorado_id
            from public.turma_inscricoes i2
           where i2.status = 'aguardando' and i2.turma = v_turma
        ) i), '[]'::jsonb)
    ) into v_dados;

  -- ---------------------------------------------------------- ciclo
  elsif v_tipo = 'ciclo' then
    -- cronograma_id: uuid válido ou nada — um forjado não pode alargar o
    -- recorte nem explodir a RPC no cast
    if v_cfg->>'cronograma_id' is not null
       and (v_cfg->>'cronograma_id') !~
           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_cron := nullif(v_cfg->>'cronograma_id', '')::uuid;

    -- nomes só: o relatório de ciclo não tem coluna de contato, então
    -- email/whatsapp não atravessam nem com expor_contato forjado
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome from public.profiles p2
         where p2.id in (
           select d.mentor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
           union
           select d.supervisor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
              and d.supervisor_id is not null)
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select d.mentorado_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron))
      ) m;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.trilha, d2.cronograma_id,
                 d2.mentor_id, d2.mentorado_id, d2.supervisor_id,
                 d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
             and (v_cron is null or d2.cronograma_id = v_cron)
        ) d), '[]'::jsonb),
      'encontros', coalesce((
        select jsonb_agg(to_jsonb(e)) from (
          select e2.id, e2.dupla_id, e2.numero, e2.data_hora,
                 e2.realizado_em, e2.status, e2.motivo_reagendamento,
                 e2.duracao_min
            from public.encontros e2
           where e2.dupla_id in (
             select d3.id from public.duplas d3
              where (v_turma is null or d3.turma = v_turma)
                and (v_cron is null or d3.cronograma_id = v_cron))
        ) e), '[]'::jsonb),
      'registros', coalesce((
        select jsonb_agg(to_jsonb(r)) from (
          select r2.encontro_id, r2.created_at, r2.avaliacao,
                 -- texto livre (opção "outro" do form semanal) morre na
                 -- fronteira: só os valores do catálogo saem do banco —
                 -- ATIVIDADES_ENCONTRO de src/lib/ciclo.ts, duplicado de
                 -- propósito porque a fronteira é aqui, não na serialização
                 (select coalesce(array_agg(a), '{}'::text[])
                    from unnest(r2.atividades) a
                   where a = any (array[
                     'Conversa de acompanhamento',
                     'Orientação individual',
                     'Atividade prática',
                     'Desenvolvimento de competência',
                     'Acompanhamento de atividade/tarefa',
                     'Identificação de dificuldades',
                     'Orientação profissional'])) as atividades
            from public.registros r2
           where r2.encontro_id in (
             select e3.id from public.encontros e3
              join public.duplas d3 on d3.id = e3.dupla_id
             where (v_turma is null or d3.turma = v_turma)
               and (v_cron is null or d3.cronograma_id = v_cron))
        ) r), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'cronogramas', coalesce((
        select jsonb_agg(to_jsonb(c)) from (
          select c2.id, c2.nome from public.cronogramas c2
           where c2.id in (
             select d4.cronograma_id from public.duplas d4
              where (v_turma is null or d4.turma = v_turma)
                and (v_cron is null or d4.cronograma_id = v_cron)
                and d4.cronograma_id is not null)
        ) c), '[]'::jsonb)
    ) into v_dados;

  -- ------------------------------------------------------- assinaturas
  else
    if v_cfg->>'status_assinatura' is not null
       and (v_cfg->>'status_assinatura') not in
           ('pendente','assinado','revogado','expirado') then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_doc := nullif(v_cfg->>'documento', '');
    v_st := nullif(v_cfg->>'status_assinatura', '');

    -- O que NÃO sai: dados_snapshot (CPF/RG/endereço), assinatura_texto,
    -- ip/user_agent, hash_documento, token — a linha pública é nome +
    -- documento + status + datas, como o CSV interno menos a evidência.
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome, p2.role from public.profiles p2
         where p2.id in (
           select a.profile_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.profile_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st)
           union
           select a.created_by from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.created_by is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select a.mentorado_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.mentorado_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) m;

    select jsonb_build_object(
      'assinaturas', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
          select a2.id, a2.profile_id, a2.mentorado_id, a2.status,
                 a2.assinado_em, a2.created_at, a2.token_expira_em,
                 a2.created_by,
                 jsonb_build_object(
                   'slug', t.slug, 'titulo', t.titulo,
                   'versao', t.versao, 'signatario', t.signatario
                 ) as template
            from public.assinaturas a2
            join public.documento_templates t on t.id = a2.template_id
           where (v_doc is null or t.slug = v_doc)
             and (v_st is null or a2.status = v_st)
        ) a), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados
    ) into v_dados;
  end if;

  -- sucesso: a linha guarda o config servido (auditoria do "o que estava
  -- compartilhado"), não a URL — que não carrega recorte nenhum mais
  v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
    p_slug, v_link.id, p_ip_hash, p_ua, v_link.config, true, null);

  return jsonb_build_object(
    'ok', true,
    'config', v_cfg,
    'dados', v_dados,
    'audit_fail', v_audit_fail);
end;
$$;

comment on function public.abrir_relatorio(text, text, text, text) is
  'Abertura do link público (170): estado → limite (5/15min por ip_hash + '
  '50/24h por slug) → bcrypt → allowlist de dados por tipo. Loga toda '
  'tentativa em resumo_acessos (best-effort, flag audit_fail). p_ip_hash '
  'é argumento do chamador — forjável via REST; o cap por slug é o bound.';

revoke all on function public.abrir_relatorio(text, text, text, text) from public;
grant execute on function public.abrir_relatorio(text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------- gestão (coord)
-- As três RPCs de gestão são concedidas a `authenticated` — o gate é
-- has_papel('coordenacao') dentro: a policy de select já limita a leitura,
-- mas a checagem explícita segura a RPC chamada direto por REST.
create or replace function public.criar_relatorio_link(
  p_titulo text,
  p_config jsonb,
  p_validade interval default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_senha text;
  v_id uuid;
  v_slug text;
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  if p_titulo is null
     or char_length(trim(p_titulo)) < 1 or char_length(p_titulo) > 120 then
    return jsonb_build_object('ok', false, 'erro', 'titulo_invalido');
  end if;
  -- a validação profunda (colunas/filtros por tipo) é do app + do gate de
  -- abertura; aqui é o contrato mínimo: objeto com tipo no allowlist
  if p_config is null or jsonb_typeof(p_config) <> 'object'
     or coalesce(p_config->>'tipo', '') not in ('grade','ciclo','assinaturas') then
    return jsonb_build_object('ok', false, 'erro', 'config_invalida');
  end if;
  -- validade só pra frente e com teto: um link "válido até 2040" criado por
  -- typo seria invisível até alguém notar — 370 dias cobre o ciclo inteiro
  if p_validade is not null
     and (p_validade <= interval '0' or p_validade > interval '370 days') then
    return jsonb_build_object('ok', false, 'erro', 'validade_invalida');
  end if;

  v_senha := public.gerar_senha_relatorio();
  insert into public.relatorio_links
    (titulo, turma, senha_hash, config, criado_por, expira_em)
  values
    (trim(p_titulo),
     nullif(p_config->>'turma', ''),
     extensions.crypt(v_senha, extensions.gen_salt('bf')),
     p_config,
     public.my_profile_id(),
     case when p_validade is null then null else now() + p_validade end)
  returning id, slug into v_id, v_slug;

  -- a senha clara sai nesta resposta e em nenhum outro lugar: não vai pro
  -- log (config não a carrega), não vira coluna, não reaparece na listagem
  return jsonb_build_object(
    'ok', true, 'id', v_id, 'slug', v_slug, 'senha', v_senha);
end;
$$;

comment on function public.criar_relatorio_link(text, jsonb, interval) is
  'Cria link público com senha gerada (170): a senha clara volta UMA vez '
  'na resposta — o banco fica só com o bcrypt. Coord-only (has_papel); '
  'validade null = sem prazo, explícito na UI.';

create or replace function public.revogar_relatorio_link(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  update public.relatorio_links
     set revogado_em = now(),
         revogado_por = public.my_profile_id()
   where id = p_id and revogado_em is null;
  if not found then
    -- idempotente de propósito: duplo clique/refresh não pode virar erro
    if exists (select 1 from public.relatorio_links where id = p_id) then
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.revogar_relatorio_link(uuid) is
  'Revoga o link na hora — o próximo abrir_relatorio já recusa (não há '
  'sessões a derrubar: o cookie só guarda a senha, revalidada a cada '
  'render). Idempotente; o rastro fica em resumo_acessos. (170)';

create or replace function public.redefinir_senha_relatorio_link(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_senha text;
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  v_senha := public.gerar_senha_relatorio();
  update public.relatorio_links
     set senha_hash = extensions.crypt(v_senha, extensions.gen_salt('bf'))
   where id = p_id and revogado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  return jsonb_build_object('ok', true, 'senha', v_senha);
end;
$$;

comment on function public.redefinir_senha_relatorio_link(uuid) is
  'Gera e aplica nova senha (170): a antiga morre no mesmo update — quem '
  'tinha o cookie dela cai no form na próxima render. Também é o caminho '
  'de "Definir senha" pro legado (senha_hash null → hash).';

revoke all on function public.criar_relatorio_link(text, jsonb, interval) from public, anon;
revoke all on function public.revogar_relatorio_link(uuid) from public, anon;
revoke all on function public.redefinir_senha_relatorio_link(uuid) from public, anon;
grant execute on function public.criar_relatorio_link(text, jsonb, interval) to authenticated;
grant execute on function public.revogar_relatorio_link(uuid) to authenticated;
grant execute on function public.redefinir_senha_relatorio_link(uuid) to authenticated;

-- Lista pra UI de gestão: metadados + contadores de acesso, SEM senha_hash
-- (o bcrypt não sai do banco nem pra coordenação — `protegido` booleano já
-- basta pro "Sem senha" da lista). Junta por slug e não por link_id: as
-- linhas de auditoria sobrevivem à vida do link e o slug é a chave estável.
create or replace function public.relatorio_links_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select l.id, l.slug, l.titulo, l.turma, l.config,
             (l.senha_hash is not null) as protegido,
             p.nome as criado_por_nome,
             l.created_at, l.expira_em, l.revogado_em,
             coalesce(s.total_ok, 0) as acessos,
             s.ultimo_ok as ultimo_acesso,
             coalesce(s.falhas_24h, 0) as falhas_24h
        from public.relatorio_links l
        left join public.profiles p on p.id = l.criado_por
        left join lateral (
          select count(*) filter (where a.ok) as total_ok,
                 max(a.acessado_em) filter (where a.ok) as ultimo_ok,
                 count(*) filter (
                   where not a.ok
                     and a.acessado_em > now() - interval '24 hours'
                 ) as falhas_24h
            from public.resumo_acessos a
           where a.slug = l.slug
        ) s on true
    ) x
  ), '[]'::jsonb);
end;
$$;

comment on function public.relatorio_links_stats() is
  'Painel de links da coordenação (170): metadados + acessos/falhas, sem '
  'senha_hash. [] pra não-coord — a RPC é a única leitura agregada '
  '(resumo_acessos não tem grant de join pra app).';

revoke all on function public.relatorio_links_stats() from public, anon;
grant execute on function public.relatorio_links_stats() to authenticated;

commit;
