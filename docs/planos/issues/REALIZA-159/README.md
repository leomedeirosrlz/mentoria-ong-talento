# REALIZA-159 — Promoção de ex-mentorado a mentor (alumni)

**Jira:** REALIZA-159 · **Tier:** A · **Status:** aberta — planejada

## Contexto

Jovens que concluem o programa são candidatos naturais a mentor num ciclo
seguinte. Hoje não existe caminho: `setPessoaRole` (`src/lib/actions.ts:843-940`)
rejeita explicitamente o papel `"mentorado"` como alvo e `RoleSelect`
(`src/components/role-select.tsx:16-75`) nem lista mentorado — não dá pra
"promover" editando papéis, e simplesmente trocar o papel quebraria a
invariante de identidade.

## Modelo de identidade (verificado)

- `mentorados` é a identidade de participação; `profiles` a identidade de
  conta/staff. `mentorados.profile_id` (nullable, unique —
  `supabase/migrations/0066_mentorado_identidade.sql:16-43`) liga os dois.
- `my_mentorado_id()` resolve `profiles→mentorados` **permanentemente** —
  é identidade, não autorização. O acesso às superfícies de jovem é
  controlado por `my_role()='mentorado'` nas policies/views `jovem_*`
  (comentário explícito em 0066: o vínculo é permanente, a autorização é
  pelo papel corrente).
- Consequência: promover = **trocar o papel efetivo do profile**, manter
  `mentorados.profile_id` intacto. As superfícies de jovem fecham
  sozinhas (RLS), e o histórico (duplas como mentorado, encontros,
  respostas, assinaturas) segue intocado — o jovem era ele, o mentor é ele.

## Decisões de planejamento

1. **Mesmo profile, nunca profile novo.** `profile_id` é unique por pessoa;
  um segundo `profiles` pra mesma pessoa humana quebraria o cânone "profile
  = pessoa", a allowlist de signup e a auditoria. Se
  `mentorados.profile_id` é null (jovem nunca logou — fluxos por token), a
  promoção **cria o profile** (pré-cadastro, `user_id` null até o 1º magic
  link — padrão 0045) e grava o link em `mentorados.profile_id`.
2. **Elegibilidade: `situacao='concluido'` apenas.** Desistente não é
  elegível por default — ver BLOCKER.
3. **Papel alvo:** `mentor_dpp` (escopo turma, via `profile_papeis.escopo_turma`)
  ou `mentor_especialista` (pool global, escopo null — 0101). A promoção
  grava `profile_papeis` (fonte de verdade, 0085) + projeção
  `profiles.role` + `mentor_profiles` (capacidade 1 default), mesma
  sincronização que `setPessoaRole` faz.
4. **Dados civis:** copiar `mentorados.dados_civis` → `profiles.dados_civis`
  na criação do profile (perfil canônico rico — espírito REALIZA-38). Com
  profile existente, não sobrescrever: merge só dos campos vazios.
5. **Execução atômica em RPC `security definer`** [NOVO]
  `promover_mentorado_mentor(p_mentorado_id, p_papel, p_turma, p_obs)` —
  4-5 writes (profiles, profile_papeis, mentor_profiles, possível
  mentorados.profile_id, pessoa_notas) com todas as validações no SQL.
  Server action `promoverMentorado` é só wrapper (padrão `remanejarDupla`
  → `rematch_dupla`).

## BLOCKER (pergunta pra Thiago)

- **Desistente pode ser promovido?** Plano assume **não** (só `concluido`).
  Se um desistente exemplar quiser voltar como mentor, hoje a resposta é
  "reverter a saída e depois concluir" — confirmar se esse caminho basta ou
  se a ação deve aceitar `desistente` com flag explícita.

## Superfície de UI

`/pessoas` → seção colapsável "Fora do programa" (`pessoas-listas.tsx:623-660`)
já lista concluídos/desistentes com `MentoradoActions` por linha. Item novo
"Promover a mentor" visível só em `situacao='concluido'` → dialog
(`sm:max-w-md`, padrão `saida-mentorado-dialog.tsx`): papel alvo
(mentor DPP / especialista), turma de escopo (só DPP), observação opcional
(vai pra `pessoa_notas`). Em `/demo`: dialog abre, submit retorna
`DEMO_MSG` (padrão de writes).

## Invariante RLS central (testar)

Após promoção: `my_role()` ≠ `'mentorado'` → views `jovem_*` vazias pra
esse usuário, `/jovem` redireciona pelo papel; `my_mentorado_id()` **ainda**
resolve (identidade histórica) — regressão obrigatória nos dois sentidos.

## Esforço

**M** — 1 migration (RPC definer, ~120 linhas) + action + dialog + item de
menu + testes RLS. Sem ALTER TABLE.
