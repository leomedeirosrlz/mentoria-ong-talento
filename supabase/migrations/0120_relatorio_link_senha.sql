-- 0120 — senha digitada e "sem senha" explícito no link público (REALIZA-201)
--
-- O form de publicação (novo-link-dialog) ganha o campo de senha no mesmo
-- form: em branco mantém o comportamento da 0110 (gera a forte "xxxx-xxxx"
-- e mostra uma vez), digitada vira bcrypt como qualquer outra, e o toggle
-- "sem senha" grava senha_hash NULL — estado que a 0110 já suportava, mas
-- que só existia no seed legado. O aviso de exposição fica na UI.
--
--   * criar_relatorio_link precisa de 2 parâmetros novos (p_senha,
--     p_sem_senha). `create or replace` NÃO muda assinatura: criar a
--     função "de novo" com mais parâmetros geraria OVERLOAD no PostgREST —
--     duas funções homônimas convivendo, e a resolução da chamada dependeria
--     de quais chaves o cliente mandou no body. Por isso drop + create na
--     mesma transação: a assinatura velha morre e a nova nasce única.
--     Retrocompatível pra quem chama com os 3 args antigos — os novos têm
--     default (p_senha null → gera; p_sem_senha false → protegido).
--   * p_senha digitada: btrim + 6–72 chars. O teto 72 é o limite em bytes
--     do bcrypt 'bf' do pgcrypto — acima o crypt trunca em silêncio e a
--     senha "grande" vira mentira. O piso 6 barra "123" sem inventar regra
--     de complexidade (a gerada segue sendo a recomendada — a UI diz isso).
--   * p_sem_senha=true exige p_senha vazio: senha + sem-senha juntos é
--     contradição do chamador — erro explícito ('senha_invalida'), não
--     precedência silenciosa.
--   * Resposta continua devolvendo a senha clara UMA vez; link sem senha
--     volta 'senha': null e a UI pula o painel de segredo.
--   * redefinir_senha_relatorio_link NÃO muda: rotação e "definir senha" do
--     link sem-senha seguem gerando em um clique (decisão da 201 — senha
--     digitada é escolha na criação; depois, a gerada é o caminho).
--
-- Grants: o drop zera os grants da função — revoke/grant refeitos no fim.

begin;

drop function if exists public.criar_relatorio_link(text, jsonb, interval);

create function public.criar_relatorio_link(
  p_titulo text,
  p_config jsonb,
  p_validade interval default null,
  p_senha text default null,
  p_sem_senha boolean default false
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

  -- senha em três caminhos explícitos (201):
  --   p_sem_senha → hash NULL (link abre direto; exige p_senha vazio);
  --   p_senha vazio/null → gera a forte de sempre (0110);
  --   p_senha digitada → valida e faz bcrypt do que o usuário escolheu.
  if p_sem_senha then
    if p_senha is not null and btrim(p_senha) <> '' then
      return jsonb_build_object('ok', false, 'erro', 'senha_invalida');
    end if;
    v_senha := null;
  elsif p_senha is null or btrim(p_senha) = '' then
    v_senha := public.gerar_senha_relatorio();
  else
    v_senha := btrim(p_senha);
    -- teto em BYTES (o 'bf' do bcrypt trunca em 72 bytes) — char_length
    -- deixaria multibyte passar e o crypt truncaria em silêncio
    if char_length(v_senha) < 6 or octet_length(v_senha) > 72 then
      return jsonb_build_object('ok', false, 'erro', 'senha_invalida');
    end if;
  end if;

  insert into public.relatorio_links
    (titulo, turma, senha_hash, config, criado_por, expira_em)
  values
    (trim(p_titulo),
     nullif(p_config->>'turma', ''),
     case when v_senha is null
          then null
          else extensions.crypt(v_senha, extensions.gen_salt('bf')) end,
     p_config,
     public.my_profile_id(),
     case when p_validade is null then null else now() + p_validade end)
  returning id, slug into v_id, v_slug;

  -- a senha clara sai nesta resposta e em nenhum outro lugar: não vai pro
  -- log (config não a carrega), não vira coluna, não reaparece na listagem.
  -- Link sem senha devolve 'senha': null — o painel de segredo não existe.
  return jsonb_build_object(
    'ok', true, 'id', v_id, 'slug', v_slug, 'senha', v_senha);
end;
$$;

comment on function public.criar_relatorio_link(text, jsonb, interval, text, boolean) is
  'Cria link público de relatório (170/201): senha gerada (p_senha null), '
  'digitada (6–72 chars, bcrypt) ou nenhuma (p_sem_senha → senha_hash null '
  'e "senha": null na resposta). A clara volta UMA vez — o banco fica só '
  'com o bcrypt. Coord-only (has_papel); validade null = sem prazo.';

revoke all on function public.criar_relatorio_link(text, jsonb, interval, text, boolean)
  from public, anon;
grant execute on function public.criar_relatorio_link(text, jsonb, interval, text, boolean)
  to authenticated;

-- senha_hash null deixa de ser "só o legado": com a 201 é também a escolha
-- "sem senha" do form — o comentário da coluna conta a regra inteira
comment on column public.relatorio_links.senha_hash is
  'bcrypt (crypt/gen_salt bf) da senha compartilhada. NULL = link sem senha '
  '(legado da 0110 ou escolha explícita do form, 201). (170/201)';

commit;
