-- REALIZA-326: auditoria do canal MCP.
-- registrar_ia_evento carimbava profile_id = my_profile_id() (JWT do caller).
-- No canal MCP a execução roda com client service-role (sem JWT) → NULL → o
-- insert violava o NOT NULL e a rota engolia o erro: chamada MCP não deixava
-- rastro. Novo parâmetro p_profile_id (default null) recebe o dono da PAT —
-- identidade já resolvida por ia_mcp_autorizar — e o fallback segue o JWT,
-- então nada muda pro canal chat.
begin;

create or replace function public.registrar_ia_evento(
  p_canal text,
  p_tool text,
  p_args jsonb,
  p_ok boolean,
  p_erro text default null,
  p_duracao_ms int default null,
  p_profile_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_canal not in ('chat', 'mcp') then
    raise exception 'canal inválido';
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, erro, duracao_ms)
    values (
      coalesce(p_profile_id, public.my_profile_id()),
      p_canal, p_tool, coalesce(p_args, '{}'::jsonb), p_ok, p_erro, p_duracao_ms
    )
    returning id into v_id;
  return v_id;
end $$;

-- assinatura antiga sai — caminho único de escrita continua sendo a RPC
drop function if exists public.registrar_ia_evento(text, text, jsonb, boolean, text, int);

revoke all on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid)
  from public, anon;
grant execute on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid)
  to authenticated;

commit;
