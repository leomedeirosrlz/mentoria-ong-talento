# REALIZA-159 — acceptance.md

## Critérios executáveis

1. **Elegibilidade**
   - Mentorado `concluido` + papel `mentor_dpp` + turma → RPC retorna
     `profile_id`; `profiles.role='mentor_dpp'`, `profile_papeis` tem o
     papel escopado, `mentor_profiles` existe, `pessoa_notas` gravada.
   - Mentorado `ativo` ou `desistente` → erro "Só quem concluiu…".
   - `papel='coordenacao'`/`'supervisor'`/`'mentorado'` → erro.
   - `mentor_dpp` sem turma → erro; `mentor_especialista` ignora turma.
   - Não-coord chamando o RPC direto → "Só a coordenação…".
2. **Identidade**
   - `mentorados.profile_id` null + e-mail presente → cria `profiles`
     (user_id null), grava o link, copia `dados_civis`.
   - Sem e-mail → erro orientando cadastrar e-mail.
   - `profile_id` existente → mesmo profile, `dados_civis` não perde
     chaves já preenchidas (merge-só-vazios — assert REST com jsonb).
   - Histórico: duplas antigas do mentorado inalteradas
     (`mentorado_id`/`status`); encontros, respostas, assinaturas intactos.
3. **Fechamento das superfícies jovem (regressão RLS central)**
   - Como o ex-jovem promovido (login de teste): `/jovem` redireciona;
     REST autenticado em `jovem_duplas`/`jovem_encontros` retorna `[]`;
     `my_mentorado_id()` ainda resolve o id antigo (via RPC de
     diagnóstico ou view que o exponha — se nenhuma superfície o expõe,
     validar com query service em `pg_get_functiondef`+exec direta).
   - Enquanto staff: `has_papel(profile,'mentor_dpp',turma)` = true;
     aparece como candidato no `NovaDuplaDialog`/`rematch` da turma.
4. **UI**
   - `/pessoas` → "Fora do programa": item "Promover a mentor" só em
     linhas `concluido`; desistente não mostra.
   - Dialog: DPP exige turma (select visível/habilitado); especialista
     esconde o select; obs vai parar na nota.
   - Sucesso → toast com link pra `/pessoas/<profile_id>`; a linha sai
     da seção "Fora" (mentorado continua `concluido` — a linha de
     mentorado permanece no arquivo; a **pessoa** aparece agora como
     staff na lista principal — assert dos dois lados).
5. **Idempotência/colisão**
   - Segunda chamada → erro explícito (já é mentor) ou sucesso
     idempotente documentado — o critério: nunca duplica
     `profile_papeis`/`mentor_profiles` (unicidade das tabelas).
   - E-mail do mentorado já usado por outro profile → erro legível.
6. **Demo**
   - `/demo` coord: linha concluída mostra o item; dialog abre; submit →
     toast `DEMO_MSG`, nada muda.
7. **Gates**
   - `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · migration em
     staging antes do push · schema-contract · spec e2e app nova cobrindo
     1/2/3 (login do ex-jovem via conta de teste staging) · 2 revisores
     (mudança de privilégio).

## Não-escopo

- Emissão automática do `termo-voluntario` (lembrete na microcopy apenas).
- Promoção de desistente (BLOCKER registrado; default: não).
- Readmissão como mentorado depois da promoção.
