# WP0b — Inventário para a fase 2 (migração dos consumidores)

Fase 1 entregue em `supabase/migrations/0085_profile_papeis.sql` — tudo aditivo.
Este documento é o checklist da fase 2: quem consome papel hoje, o que cada um
decide, e quem migra pra `has_papel`/`my_papeis` vs. quem fica em `my_role()`.

## 0. O que a fase 1 criou (decisões já tomadas)

- **`profile_papeis`** `(id, profile_id→profiles on delete cascade, papel
  app_role, escopo_turma text null, primario bool, created_at)`.
  - `unique nulls not distinct (profile_id, papel, escopo_turma)` — papel
    global (escopo null) não duplica. PG15+.
  - `escopo_turma` é **text** (label) — turma NÃO é entidade com id:
    `duplas.turma` e `cronogramas.turma` são text. Trigger valida contra os
    labels vivos (cronogramas ∪ duplas) no insert/update da coluna.
  - **Primário determinístico**: partial unique `(profile_id) where primario`;
    escrever `primario=true` rebaixa os demais; apagar/"desmarcar" o primário
    promove o próximo por precedência fixa
    `coordenacao > supervisor > mentor_dpp > mentor_especialista > mentorado`,
    desempate `created_at, id`. Profile com papéis nunca fica sem primário.
- **Autoridade única = `profile_papeis`.** `profiles.role` é projeção do
  primário e SEGUE POPULADO — `my_role()` não mudou e nada existente quebra.
  - Write legado em `profiles.role` = "esse papel global vira o primário"
    (aditivo: papéis secundários/escopados ficam). `role := null` zera os
    papéis. Espelho via trigger `profiles_role_para_papeis` (AFTER INSERT OR
    UPDATE OF role).
  - Recursão travada por `pg_trigger_depth() > 1` nos dois lados.
  - `handle_new_user` (create or replace, corpo da 0059 preservado) insere a
    linha de papel — necessário porque o vínculo do 1º login só toca
    `user_id`, e o espelho é `UPDATE OF role` (não dispara).
- **Helpers** (sql stable security definer, `set search_path=''`, grant
  `authenticated, service_role`, revoke `public, anon`):
  - `my_papeis() → setof app_role` — união dos papéis do caller, ordenada por
    precedência (1ª linha = mais alto). Gate `ativo` como `my_role()`.
  - `has_papel(p_papel app_role, p_escopo_turma text default null)` —
    predicado do caller. `p_escopo_turma null` = qualquer escopo;
    `'T1'` = papel global OU escopo 'T1'. Escopo só filtra, nunca amplia.
  - `has_papel(p_profile_id uuid, p_papel app_role, p_escopo_turma text
    default null)` — predicado por linha (catálogo/filtros). Mesma régua +
    gate `ativo` no profile alvo.
  - ⚠️ Em SQL cru, literais de papel pedem cast (`'mentor_dpp'::app_role`) —
    literal solto é ambíguo entre as duas sobrecargas.
- **RLS da tabela nova**: `select` = próprio profile OU os 4 papéis de staff
  (mentorado fora por omissão, espelho da `profiles_select` pós-0065);
  `for all` = coordenação. Papel é atribuição da coordenação — sem self-write.
- **Não migrado de propósito**: `solicitacoes_especialista`,
  `jovem_especialistas`, mural, guards — todos os consumidores seguem
  idênticos; `has_papel` está pronta esperando a fase 2.
- **`database.types.ts` NÃO foi regerado nesta fase** (pedido explícito) — a
  fase 2 regenera quando começar a ler `profile_papeis` no TS.

## 1. `my_role()` nas migrations — 55 arquivos

Definições: **0001** (cria `my_role()`/`my_profile_id()`), **0003**
(`my_role` ganha `and ativo`), **0004** (`my_profile_id` ganha `and ativo`).
O resto é consumo. Agrupado por família de policy/função:

### 1a. "Coordenação faz tudo" — `*_coord for all` (`my_role()='coordenacao'`)

O padrão dominante. Praticamente toda tabela tem uma policy coord-omni:

| Arquivos | Tabelas/objetos |
|---|---|
| 0001 | profiles, mentor_profiles, mentorados, duplas, ciclo_eventos, materiais (+ select/write de encontros, registros, encaminhamentos) |
| 0008 | interacoes |
| 0009 | registro_anexos (+ storage registro-anexos) |
| 0010 | materiais storage (bucket `materiais`) |
| 0012 | documentos_pessoa (+ storage `documentos`) |
| 0015 | encontro_notas |
| 0016 | storage `avatares`; pessoas listing coord+supervisor |
| 0018, 0019 | comunicados + notificacoes |
| 0020, 0021 | anexos mentor-only / insert hardening |
| 0024 | avatares ext |
| 0033 | assinaturas, documento_templates, storage `documentos` |
| 0034 | profiles/mentorados campos matching, views `*_pessoal` |
| 0036, 0042 | formularios, formulario_links, formulario_respostas |
| 0037 | encerramentos, especialista_eventos |
| 0040 | presencas |
| 0041 | supervisoes |
| 0044 | `definir_pdm_url` (RPC) |
| 0046 | dados_civis, RPCs de assinatura |
| 0047 | delete coord-only em encontros/registros |
| 0048, 0054 | `meus_dados_civis`, intake/documentos |
| 0056 | emails_enviados |
| 0058 | assinaturas insert profile |
| 0061 | cronogramas |
| 0063, 0064 | remanejo/`rematch_dupla` |
| 0067–0071 | leituras/escritas do mentorado (ramo coord) |
| 0076 | diretorio do jovem |
| 0080 | instrumentos_da_dupla, emitir_link_instrumento |
| 0081 | mentorados_curriculo |
| 0082, 0083 | importar_registros, ia_eventos |

### 1b. Auto-grant "staff lê" — lista explícita de papéis (pós-0065)

- **0065**: `profiles_select`, `mentor_profiles_select`, `ciclo_eventos`,
  `especialista_eventos`, `cronogramas` — `my_role() in (4 papéis de staff)`;
  `materiais_select` + storage = `is not null` + filtro de audiência
  (`audiencia='dpp'→my_role()='mentor_dpp'` etc.).

### 1c. Escopo por vínculo de dupla — `my_role()='coordenacao'` como bypass

- **0001/0004/0013/0023**: `duplas_*`, `encontros_*`, `registros_*`,
  `encaminhamentos_*`, `mentorados_select` — vínculo via
  `my_profile_id()` + bypass coord.
- **0072** (agenda livre DPP), **0074** (solicitações — policies de leitura:
  coord / especialista / mentorado / mentor da dupla).

### 1d. Fluxo do especialista — gates de `my_role()='mentor_especialista'`

- **0027** trilha (`duplas.trilha`, especialista_eventos policies);
  **0028** `aceitar_solicitacao`; **0029** `solicitacao_integridade`;
  **0030** mural (`solicitacoes_especialista_select`: `status='aberta'` +
  papel); **0073** `especialista_grade`/`excecoes` (write só se
  `my_role()='mentor_especialista'` e dono); **0074** máquina de estados
  (`origem×my_role()`, `especialista_desejado_id` por `p.role`,
  `pedir_especialista_jovem`, `contra_propor`, `recusar`, mural);
  **0075** view `jovem_especialistas` (`p.role='mentor_especialista'` —
  **ponto-chave do híbrido**: híbrido com primário DPP hoje não aparece no
  catálogo); **0079** capacidade_especialista guard.

### 1e. Fluxo do mentorado — `my_role()='mentorado'`

- **0066** (papel + `my_mentorado_id()`), **0067–0071** (leituras,
  notificações, combinados, `submeter_avaliacao`), **0076** (diretório),
  **0078** (disponibilidade), **0081** (currículo — auxiliar executivo =
  `my_role()='supervisor'`).

### 1f. Guards/triggers com gate de papel interno

- **0004** `guard_registro_apoio` (só coord limpa apoio),
  `guard_mentor_profile` (campos de validação coord-only — estendida na
  **0052** com bypass GUC `realiza.assinatura_sync`/`realiza.formacao_sync`);
  **0023** `guard_profiles_self_columns` (self não edita role/email/ativo —
  **a projeção 0085 herda esse comportamento**: write no próprio papel falha
  — coord não muda o próprio papel, igual a hoje); **0029**/**0074**
  `solicitacao_integridade`; **0053** hardening de RPCs públicas;
  **0059** `handle_new_user` (substituído na 0085); **0064** rematch;
  **0079** capacidade; **0080** `instrumentos_da_dupla`/`emitir_link`.

## 2. `.role`/`me.role`/`roles:` em TypeScript — ~61 arquivos

### 2a. Guards de rota/layout (redirect por papel)

| Arquivo:linha | Decisão |
|---|---|
| `src/app/(app)/layout.tsx:58` | `me.role==='mentorado'` → redirect `/jovem` |
| `src/app/(jovem)/jovem/layout.tsx:64` | `me.role!=='mentorado'` → redirect `/` |
| `src/app/(app)/registros/page.tsx:94-95` | só coord/supervisor; `souCoord` |
| `src/app/(app)/relatorios/page.tsx:15` | só coord |
| `src/app/(app)/turmas/{page,novo,[id]}.tsx` | só coord |
| `src/app/(app)/formularios/{page,novo,[id]}.tsx` | só coord (+filtro destinatários `:68`) |
| `src/app/(app)/pessoas/page.tsx:33,36` | mentorado→/jovem; `souCoord` |
| `src/app/(app)/duplas/page.tsx:15-22,35,50-51` | `mentor`=dpp|esp; query por papel; botões coord |
| `src/app/(app)/pessoas/[id]/page.tsx:231-249` | `ehMentor`, `ehStaff`, `souCoord` |
| `src/app/(app)/duplas/[id]/page.tsx:250,987,1033-1040` | `souCoord`, `souMentor`, supervisor |
| `src/app/(app)/(home)/page.tsx:48,76,112,127,144` | **branch por papel — a home híbrida nasce aqui** |

### 2b. Nav e shell

| Arquivo:linha | Decisão |
|---|---|
| `src/components/app-shell.tsx:34-42` | `NAV[].roles` — whitelist por item |
| `src/components/app-shell.tsx:63` | filtro `i.roles.includes(me.role)` — **trocar por união `me.papeis`** |
| `src/components/app-shell.tsx:123,194` | `papelLabel/papelCurto(me.role)` — rótulo único; híbrido: decidir "Mentor" vs lista |
| `src/components/demo-bar.tsx` | troca de papel da demo |

### 2c. Filtros de audiência/lista

| Arquivo:linha | Decisão |
|---|---|
| `src/app/(app)/agenda/page.tsx:54-56` | materiais por audiência × papel |
| `src/app/(app)/materiais/page.tsx:55-61` | idem |
| `src/app/(app)/perfil/perfil-form.tsx:1096` | `isMentor` — **a seção grade do especialista pendura aqui** (WP0b) |
| `src/lib/queries.ts:97,158,249` | mapas/listas coord-only |
| `src/lib/queries.ts:622,697` | `ehMentor` / `getMeuMentorProfile` |
| `src/lib/queries-supervisao.ts:74` | `podeSupervisionar(me.role)` |
| `src/lib/fila.ts:28,150,181` | candidatos do mural por papel; `trilha` por role |
| `src/lib/remanejo.ts:269` | candidatos a remanejo `p.role === papel` |
| `src/lib/importar-duplas.ts:366-371` | trilha da dupla derivada de `mentor.role` — **híbrido: trilha não pode mais derivar do papel primário** |
| `src/lib/ia/tools.ts:281` | filtro especialista pro radar IA |

### 2d. Actions (server-side guards e derivações)

- ~40 gates `eu.role !== 'coordenacao'` em `actions*.ts` (assinaturas,
  avaliacao, cronogramas, email, encerramento, formularios, importar,
  presenca, supervisao, forms/actions, actions.ts).
- Gates de papel do jovem: `actions-jovem.ts:44,68,102`,
  `actions.ts:2507,3127,3155` (`mentorado`).
- Gates de mentor: `actions.ts:2485-2487` (dpp|esp|mentorado),
  `2859`, `3761`, `3834` (`ehMentor`).
- **Derivações papel→estado** (o híbrido quebra a premissa "role único"):
  `actions.ts:546-556` (cria `mentor_profiles.tipo` pelo role),
  `:641-646` e `:1387-1393` (`trilha := role==='mentor_especialista'`),
  `:957-960`, `:1005-1006`, `:1963-2008` (import: papel→mentor_profiles).
- Alvo por papel: `actions-especialista.ts:94`
  (`esp?.role!=='mentor_especialista'` — híbrido não recebe pedido dirigido
  até migrar), `:77,232,349`.

### 2e. Componentes

`nova-dupla-dialog`, `remanejar-dupla-dialog`, `editar-dupla-dialog`,
`matching-panel` (AfinidadePar por papel), `mentor-home`, `chamada-formacao`,
`onboarding-flow` (wizard por papel), `pessoas-dialogs` (RoleSelect do
cadastro — **vira atribuição de papéis no WP0b item 5**), `pessoas-listas`,
`pessoa-actions`, `role-select.tsx` (`setPessoaRole` — write-path legado que
a 0085 espelha), `agenda-calendario`, `pessoas/[id]` sub-componentes.

### 2f. API routes e demo

- `src/app/api/export/route.ts`, `src/app/api/assinatura/[id]/route.ts` —
  guards `me.role`.
- Demo: `demo/mode.ts` (`demoRole()`, `papelDemoValido`, cookies por papel),
  `demo/shared.ts` (`DEMO_ROLES`), `demo/data.ts`
  (`personas: Record<AppRole, Profile>` — **híbrido entra como persona com
  `papeis`**, decisão do plano), `demo/queries.ts` (escopo por papel do
  cookie — réplica do RLS), `demo/encerramento-data.ts`, `demo/forms-data.ts`.
- Tipos: `AppRole` em `src/lib/types.ts`; labels `papelLabel`/`papelCurto` em
  `src/lib/ciclo.ts:1698-1721`.

## 3. Onde o híbrido (DPP + especialista) precisa de escolha de contexto

Sem seletor de identidade (decisão do plano) — resolve por união de papéis:

1. **`app-shell.tsx` NAV `roles:`** — `me.papeis.some(p => roles.includes(p))`
   em vez de `roles.includes(me.role)`. É O ponto do híbrido.
2. **`(app)/layout.tsx:58` × `(jovem)/layout.tsx:64`** — os espelhos
   mentorado↔staff assumem papel único; híbrido staff+staff não encosta, mas
   a leitura tem que ser "tem papel de staff?" e não `role ===`.
3. **`(home)/page.tsx`** — hoje despacha por `me.role` (coord / supervisor /
   especialista / dpp). Híbrido precisa renderizar os dois mundos juntos
   (duplas + trilhas + mural) — não é "qual branch", é soma.
4. **`/duplas` page + `getMinhasDuplas`** — lista une duplas DPP e trilhas de
   especialista da pessoa.
5. **`/agenda`** — calendário único DPP+sessões; grade editável em `/perfil`
   quando `has_papel('mentor_especialista')`.
6. **`perfil-form.tsx:1096` `isMentor`** — a seção grade do especialista.
7. **`setPessoaRole`/`role-select.tsx` → atribuição de papéis em `/pessoas`**
   (WP0b item 5): hoje `update profiles.role` — a 0085 já espelha pra
   `profile_papeis` (vira "marca o primário"), mas a UI nova escreve a tabela
   direto (add/remove com escopo).
8. **`papelLabel` no shell/perfil** — híbrido tem 2+ rótulos; exibir
   concatenado ou o do contexto da tela (decisão de UX na fase 2).

## 4. Fica `my_role()` pra sempre × migra pra `has_papel`

**Fica `my_role()` (ou equivalente) — justificativa:**

- Gates `!= 'coordenacao'` (família 1a + ~40 guards de action): coordenação é
  papel global por natureza; ninguém tem "coordenação escopada" nesta rodada.
  Migrar não muda semântica e só adiciona superfície.
- Gates `= 'mentorado'` (1e + actions-jovem): o papel jovem vem do vínculo
  `mentorados.profile_id` e nunca é híbrido — a premissa "um jovem, um papel"
  é de domínio, não de schema.
- `my_role() is not null`/`in (staff)` auto-grants (1b): quem tem SÓ papel
  escopado ainda tem primário projetado → `is not null` segue verdadeiro;
  semântica "tem algum papel" já cobre.
- Guards de integridade que distinguem só coord×não-coord
  (`guard_registro_apoio`, `solicitacao_integridade` update-branch,
  `guard_profiles_self_columns`, delete-hardening): o eixo é staff-vs-rest,
  não presença de papel.

**Migra pra `has_papel`/`my_papeis` — justificativa:**

- `jovem_especialistas` (0075) e todo filtro `p.role='mentor_especialista'`
  (0074:158,381; `actions-especialista.ts:94`): **o híbrido com primário DPP
  é invisível/imutável como alvo sem isso** — é o cerne do WP0b.
- Policies/RPCs do fluxo especialista (0027/0028/0030/0073/0074/0079):
  `has_papel('mentor_especialista', turma)` — com escopo quando o contexto
  tiver turma (catálogo do jovem: turma da dupla DPP dele).
- Filtros de audiência materiais/agenda (`my_role()='mentor_dpp'` etc. —
  0004/0010/0065 + TS 2c): híbrido precisa ver os dois públicos.
- Nav + guards TS (2a/2b): `me.papeis` (união) — senão o híbrido primário-DPP
  não vê nada de especialista.
- Derivações papel→trilha/`mentor_profiles.tipo` (2d):
  `mentor_profiles.tipo` é single-valued ('dpp'|'especialista') — o híbrido
  precisa dos dois lados; trilha não pode mais derivar do papel. Decisão da
  fase 2: ou `tipo` vira set/duas linhas, ou deriva por papel consultado
  (`has_papel`) + `capacidade_especialista` (0073) já separa os pools.
- `demoRole()`/`linhas(papel)`/`personas` (2f): dataset ganha persona híbrida
  com `papeis[]`; stub de queries replica `has_papel` por cookie+união.

## 5. Armadilhas que a fase 2 precisa conhecer

1. **`has_papel('coordenacao')` com escopo null = "coord em qualquer
   escopo"** — uma "coordenação T1" (se existir um dia) passa. Pros gates
   admin-globais, manter `my_role()='coordenacao'` até existir papel escopado
   de coord — ou passar a turma do contexto.
2. **Ordem de writes**: `insert into profile_papeis ... primario=true`
   rebaixa os demais — a UI de atribuição decide o primário explicitamente.
   "Desmarcar" o primário sem sucessor não funciona (a guarda re-promove):
   marca-se outro.
3. **Write legado `profiles.role=X` é ADITIVO** (marca primário, mantém os
   demais papéis) — quem esperar "troca papel único" precisa saber que os
   secundários ficam; remoção é write em `profile_papeis` (UI nova).
4. **`role := null` zera TODOS os papéis** — o mesmo efeito de hoje
   ("sem papel = sem acesso"), só que agora apaga linhas.
5. **Coord não muda o próprio papel** — `guard_profiles_self_columns`
   bloqueia o `profiles.role` projetado quando o ator é o dono da linha
   (igual a hoje; `setPessoaRole` já barra no app).
6. **Delete de profile cascateia** os papéis; o trigger de projeção roda com
   a row-pai já morta → no-op seguro (role morre junto).
7. **`escopo_turma` valida contra labels vivos** — criar o cronograma/dupla
   antes de atribuir papel escopado àquela turma.
8. **Cast explícito em SQL** — `has_papel('x')` com literal solto é ambíguo
   entre as sobrecargas; sempre `'x'::app_role`. Via PostgREST/RPC os args são
   nomeados e tipados — sem risco.
9. **`has_papel` tem gate `ativo`** nos dois sabores — igual `my_role()`.
   Desativar a pessoa suspende todos os papéis sem apagar linhas.
10. **`database.types.ts` ainda não tem `profile_papeis`** — regerar junto do
    primeiro consumidor TS; até lá, `.from('profile_papeis')` precisa de cast.
