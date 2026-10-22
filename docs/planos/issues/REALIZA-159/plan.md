# REALIZA-159 — plan.md

## Estado atual (verificado)

| Ponto | Hoje | Arquivo |
|---|---|---|
| Saída de mentorado | `situacao` `'ativo'/'desistente'/'concluido'` + `saiu_em`/`motivo_saida`; bloqueado com dupla viva | `0077_saida_mentorado.sql:21-45`, `saida-mentorado-dialog.tsx` |
| Identidade jovem↔conta | `mentorados.profile_id` unique + `my_mentorado_id()`; autorização jovem = `my_role()='mentorado'` | `0066_mentorado_identidade.sql:16-43` |
| Papéis | `profile_papeis` (fonte) + `profiles.role` (projeção); `setPessoaRole` rejeita `'mentorado'` e trava quem tem dupla viva | `0085_profile_papeis.sql`, `actions.ts:843-940` |
| Mentor capacity | `mentor_profiles` sincronizado no role-set | `actions.ts:843-940` |
| Seção de saídos | "Fora do programa" colapsável em `/pessoas` com ações por linha | `pessoas-listas.tsx:382,623-660,1248` |

## Passos

1. **Migration `0107_promover_mentorado.sql`** [NOVO] — RPC
   `public.promover_mentorado_mentor(p_mentorado_id uuid, p_papel app_role,
   p_turma text, p_obs text)` `security definer`, `set search_path=''`:
   - Guards: `my_role()='coordenacao'`; mentorado existe;
     `situacao='concluido'`; `p_papel in ('mentor_dpp','mentor_especialista')`;
     se `p_papel='mentor_dpp'` então `p_turma` obrigatória (esp é pool
     global → `escopo_turma null`, padrão 0101).
   - Guard extra: mentorado não pode ter dupla viva (redundante com o
     bloqueio da saída, mas barato — defesa em profundidade).
   - `p_profile_id := mentorados.profile_id`. Se null →
     `insert into profiles (nome, email?, dados_civis, role, ativo)` com
     `dados_civis` copiado + `update mentorados set profile_id`. Com
     profile existente → merge de `dados_civis` só em chaves vazias
     (`coalesce`/jsonb `||` com filtro), nunca sobrescreve.
   - `delete from profile_papeis where profile_id=p_profile_id and
     papel='mentorado'` + `insert (profile_id, papel, escopo_turma)`
     do papel novo; `update profiles set role=p_papel`.
   - `insert into mentor_profiles (profile_id, tipo, capacidade)` com tipo
     conforme o papel (`'dpp'`/`'especialista'` — conferir valores do
     CHECK/enum `mentor_tipo` antes de escrever), `on conflict do nothing`.
   - `insert into pessoa_notas (profile_id, mentorado_id, texto, created_by)`:
     "Promovida(o) a mentor {dpp|especialista} em {data} — {obs}". Mesma
     nota vinculada nos dois lados (`profile_id` e `mentorado_id`) pra
     aparecer na ficha da pessoa e no histórico do jovem.
   - `revoke all ... from public, anon, authenticated` — chamada só via
     server action (mesmo padrão `rematch_dupla`? Não — `rematch_dupla` é
     executável por authenticated e autovalida pelo `my_role`; seguir o
     padrão: `grant execute to authenticated` + guard `my_role` no corpo.
     Conferir convenção dos RPCs coord recentes — `sol_efetivar` usa
     revoke-all+service? Não: `revoke all` apenas de `public, anon` e o
     corpo valida papel. **Seguir exatamente o padrão de `rematch_dupla`
     em 0105:392+.**)
2. **Action** `promoverMentorado` — arquivo novo
   `src/lib/actions-promocao.ts` [NOVO] (ou `actions.ts` junto do
   `setPessoaRole`; preferir arquivo novo — actions.ts já tem 4k linhas):
   wrapper `supabase.rpc`, `{error}`/`{ok}`, `revalidatePath("/pessoas")` +
   `/pessoas/[id]` do profile resultante.
3. **Query de elegíveis** — a seção "Fora do programa" já recebe os
   mentorados; `situacao` está no tipo (`queries.ts` `Mentorado`/`getMentorados`)
   — nenhuma query nova: o botão aparece por `m.situacao==='concluido'`.
   Retorno do RPC: `{profile_id}` pra navegação ("Ver ficha da pessoa").
4. **UI** `src/components/promover-mentor-dialog.tsx` [NOVO] — padrão
   `saida-mentorado-dialog.tsx`: Dialog `sm:max-w-md`, radio papel
   (`Mentor de jornada (DPP)` / `Mentor especialista`), select de turma só
   quando DPP (mesmas turmas do `NovaDuplaDialog` — fonte `cronogramas`),
   textarea obs. Wire: `pessoas-listas.tsx` — `MentoradoActions` recebe
   item "Promover a mentor" renderizado só quando `situacao==='concluido'`
   e `role==='coordenacao'` (as linhas fora já são coord-only? a seção é
   colapsável pra todos — checar `verFora`; o guard final é o RPC, a UI só
   esconde).
5. **Tipos** — nenhum ALTER TABLE; `AppRole` já cobre os alvos. Se a action
   devolver shape tipada, `type PromoverResult = { ok: true; profile_id:
   string } | { error: string }`.
6. **Demo** — `demoRole()` no wrapper: submit retorna `{ error: DEMO_MSG }`
   (dialog abre e demonstra o fluxo; writes são bloqueados em demo —
   padrão `importar-csv-dialog`).
7. **Docs operacionais** — a promoção NÃO emite termo: ex-aluno mentor
   precisa assinar `termo-voluntario` (fluxo já existe — assinaturas).
   Incluir na nota de sucesso do dialog: "Lembre de gerar o termo de
   voluntário na ficha da pessoa." (microcopy, não automação — escopo
   honesto.)

## Casos de borda

- `profile_id` null + `email` ausente em `mentorados` (jovem por token sem
  e-mail): profile sem e-mail não loga por magic link — **bloquear com
  mensagem clara**: "cadastre um e-mail na ficha do jovem antes de
  promover" (pré-validação no RPC + desabilitar no dialog se `!email`? a
  linha da seção fora tem `Mentorado` — checar se `email`/`contatos`
  chegam na lista; se não, o dialog valida e mostra o erro do RPC).
- Promoção dupla (clicar 2x): `profile_papeis` já tem o papel → o insert
  é idempotente? Usar `on conflict do nothing` + verificar se
  `profiles.role` já é mentor_* → retornar `{error:"Já é mentor"}` —
  preferir erro explícito a sucesso silencioso duplo.
- Jovem concluído que NUNCA teve dupla (concluído por decisão da coord):
  promovível — elegibilidade é a situação, não a existência de histórico.
- Mentorado promovido aparece na fila de mentores (`filaMentores`) com a
  vaga recém-criada — esperado e desejável.
- `rematch_dupla`/guards futuros: `has_papel` passa a incluí-lo — correto.

## Verificação

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · migration no
staging antes do push · schema-contract · e2e app novo
(`promocao.spec.ts` ou dentro de `operacional.spec.ts`): promover → login
como ex-jovem → `/jovem` redireciona, superfícies jovem vazias, ficha
/pessoas mostra papel mentor, `my_mentorado_id()` segue resolvendo via
REST (`select mentorado_id ...` autenticado como ele numa view que o
exponha — ou RPC de debug de identidade se existir).
