-- 0119 — chamado_anexos.created_by nunca era populado.
--
-- O insert do composer (chamado-anexos.tsx) não mandava created_by e nada
-- no banco preenchia: a coluna ficava NULL. O descarte do anexo órfão
-- (descartarChamadoAnexo — a compensação pra quando o upload do binário
-- falha depois da row) confere row.created_by = profile.id pra autorizar o
-- autor, e NULL nunca casa: nem quem anexou conseguia limpar a própria row.
-- Resultado: metadado órfão permanente na trilha e o retry empilhando
-- rows sem arquivo.
--
-- Fix em duas camadas — o cliente passa a mandar o campo e aqui fica a
-- garantia: stamp do token no INSERT + rejeição de forja, mesmo molde de
-- stamp_supervisao_autor (0041) e stamp_solicitacao_autor (0027/0053).
--
-- Sem backfill: não dá pra inferir retroativamente quem subiu cada
-- arquivo. Rows antigas com created_by NULL seguem descartáveis pela
-- equipe (ramo `equipe` da action) — e o objeto do bucket, coord-only.
begin;

create or replace function public.stamp_chamado_anexo_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null then
    new.created_by := public.my_profile_id();
  elsif auth.uid() is not null
        and public.my_role() is distinct from 'coordenacao'
        and new.created_by is distinct from public.my_profile_id() then
    raise exception 'created_by não pode ser forjado';
  end if;
  return new;
end $$;
drop trigger if exists chamado_anexos_autor on public.chamado_anexos;
create trigger chamado_anexos_autor
  before insert on public.chamado_anexos
  for each row execute function public.stamp_chamado_anexo_autor();

commit;
