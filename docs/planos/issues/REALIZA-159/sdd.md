# REALIZA-159 — sdd.md (schema & dados)

## DDL / DML proposta [NOVO]

Nenhum `alter table`. Um RPC `security definer` em
`0107_promover_mentorado.sql` (número seguinte a 0106/REALIZA-98 — se 98
ainda não saiu, confirmar o próximo livre na hora):

```sql
create or replace function public.promover_mentorado_mentor(
  p_mentorado_id uuid, p_papel public.app_role,
  p_turma text default null, p_obs text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m public.mentorados%rowtype;
  v_profile uuid;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação promove ex-mentorados';
  end if;
  if p_papel not in ('mentor_dpp','mentor_especialista') then
    raise exception 'Papel alvo inválido';
  end if;
  if p_papel = 'mentor_dpp' and nullif(btrim(coalesce(p_turma,'')),'') is null then
    raise exception 'Mentor DPP precisa de turma de escopo';
  end if;

  select * into m from public.mentorados where id = p_mentorado_id;
  if not found then raise exception 'Mentorado não encontrado'; end if;
  if m.situacao is distinct from 'concluido' then
    raise exception 'Só quem concluiu o programa pode virar mentor';
  end if;
  if exists (select 1 from public.duplas d
    where d.mentorado_id = m.id and d.status in ('ativa','pausada')) then
    raise exception 'Mentorado ainda tem dupla viva';
  end if;

  v_profile := m.profile_id;
  if v_profile is null then
    -- pré-cadastro (0045): user_id null até o 1º magic link
    if nullif(btrim(coalesce(m.email,'')),'') is null then
      raise exception 'Cadastre um e-mail no mentorado antes de promover';
    end if;
    insert into public.profiles (nome, email, dados_civis, role, ativo)
    values (m.nome, m.email, m.dados_civis, p_papel, true)
    returning id into v_profile;
    update public.mentorados set profile_id = v_profile where id = m.id;
  else
    -- merge conservador: só preenche chaves ausentes/vazias
    update public.profiles p
       set dados_civis = coalesce(p.dados_civis,'{}'::jsonb) ||
                         coalesce(m.dados_civis,'{}'::jsonb) -- revisar: merge só-vazios, ver nota
     where p.id = v_profile;
    update public.profiles set role = p_papel where id = v_profile;
  end if;

  delete from public.profile_papeis
   where profile_id = v_profile and papel = 'mentorado';
  insert into public.profile_papeis (profile_id, papel, escopo_turma)
  values (v_profile, p_papel,
          case when p_papel='mentor_especialista' then null else p_turma end)
  on conflict do nothing;

  insert into public.mentor_profiles (profile_id, tipo, capacidade)
  values (v_profile, case when p_papel='mentor_especialista'
                          then 'especialista' else 'dpp' end, 1)
  on conflict (profile_id) do nothing;

  insert into public.pessoa_notas (profile_id, mentorado_id, texto, created_by)
  values (v_profile, m.id,
    'Promovido a mentor ' || p_papel || ' em ' || to_char(current_date,'DD/MM/YYYY')
      || coalesce(' — ' || btrim(p_obs), ''),
    public.my_profile_id());

  return v_profile;
end $$;
-- grants: seguir o padrão de rematch_dupla em 0105 (execute pra
-- authenticated + guard my_role; revoke de public/anon).
```

### Ajustes obrigatórios antes de escrever o SQL final

- **Conferir no banco real** (`pg_get_functiondef`,
  `information_schema.columns`, `pg_enum`): colunas exatas de
  `mentorados` (`email` existe? ou contato vive só em `contatos`/`contato`
  — checar `getMentorados` em `queries.ts`), colunas de
  `profile_papeis` (`escopo_turma`, unique constraints), tipo/CHECK de
  `mentor_profiles.tipo` (valores `'dpp'/'especialista'` confirmados?),
  colunas obrigatórias de `profiles` (`nome_social`? `telefone`? not-nulls).
- **Merge de `dados_civis` "só vazios"**: `||` sobrescreve chaves —
  implementar com `jsonb_each` filtrando chaves nulas/vazias do lado
  existente, ou `(coalesce(m.dados_civis,'{}') || coalesce(p.dados_civis,'{}'))`
  (direita vence → preserva o profile). Decidir e comentar a direção no SQL.
- **`profiles.email` unique?** — colisão de e-mail (jovem cadastrado com o
  e-mail que já é de outro profile) vira erro legível, não 500.

## Invariantes preservadas

- `mentorados`/`duplas`/`encontros`/`registros`/respostas do jovem:
  **intocados** — histórico permanece.
- `mentorados.profile_id`: preenchido só quando estava null; nunca reescrito.
- `my_mentorado_id()`: continua resolvendo (identidade permanente — 0066).
- Superfícies jovem: fecham via `my_role()` (nenhuma policy editada).

## Grants / RLS

- RPC: `grant execute to authenticated` + guard `my_role()='coordenacao'`
  no corpo (padrão `rematch_dupla`, 0105). `revoke` de `public`/`anon`.
- Nenhuma policy nova — todas as tabelas escritas já aceitam write via
  definer; a segurança mora nos guards.
