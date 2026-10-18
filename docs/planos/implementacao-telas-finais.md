# Implementação das telas finais — plano por tela

**Status:** plano de implementação — nada aqui está implementado.
**Origem:** rodada final de mockups (`docs/mockups/_brief-final.md`, `docs/mockups/RELATORIO.md`; telas `agenda/v6`, `jovem-especialistas/v6`, `duplas/v5`, `materiais/v4`, `instrumentos/v1`, `chamados/v4`), conferida contra o código de `~/realiza.vc` (migrations até a `0083`).
**Princípio:** os mocks são a intenção de produto; o código é a verdade do que existe. Onde divergem, este documento diz qual vale e por quê.
**Revisão do stakeholder** (out/2026): Agenda **Final** (com a dúvida "DPP também especialista?" → D9), Duplas **v1** (mais limpa), Materiais **v3** (narrativa, entregas registradas), Instrumentos **Final**, Especialistas **Final** + catálogo rico estilo "cardápio" (todos os dados do mentor), Chamados **Final**. Os WPs já refletem essas escolhas.
**2ª revisão — guias do programa** (out/2026): conferido contra os PDFs oficiais (Guia do Mentor DPP, Guia do Mentor Especialista, cronogramas T1/T2, doc "Novos sistemas Realiza"). Resultado: **mentor híbrido existe no domínio** (o pool de especialistas inclui mentores voluntários; perfil é por programa, não fixo) → entra nesta rodada via **tabela papel-por-programa** (WP0b); o DPP pode **registrar pedido de especialista** pelo jovem (guia) → WP6; **anamnese é instrumento externo** → fora da jornada; marcos da trilha corrigidos pro roteiro real (WP7).

---

## 1. O que já existe (não reinventar)

Verificado no código. Tudo abaixo é gancho real a reaproveitar.

| Área | Peça existente | Onde |
|---|---|---|
| Especialista | Agenda com grade semanal, exceções datadas e projeção de slots livres | `src/components/agenda-especialista.tsx`, `agenda-disponibilidade.tsx`, migration `0073`, `src/lib/queries-especialista.ts`, `actions-especialista.ts` |
| Especialista | Mural de pedidos (broadcast/dirigidos) + aceitar/contra-propor/recusar | `demandas-especialista.tsx`, `solicitacao-negociacao.tsx` |
| Jovem × especialista | Pedido iniciado pelo jovem, thread de contra-propostas (máx. 4), teto de 3 trilhas e 3 pedidos abertos, `aguardando_coord` quando não há DPP | migrations `0074`/`0075`, `jovem-especialistas.tsx`, `pedir-especialista-dialog.tsx`, `jovem-pedido-item.tsx`, `src/lib/jovem-especialista.ts` |
| Instrumentos | 4 instrumentos oficiais nativos (Visão, Metas, PDM, Roda) sobre a engine de forms; envio de link pelo mentor; resultado estruturado na ficha | migration `0080`, `src/components/instrumentos/*`, `instrumento-resultado.tsx`, `duplas/[id]/instrumentos-dupla.tsx`, `src/lib/forms/*` |
| Instrumentos | RPC `instrumentos_da_dupla` — **já legível pelo próprio mentorado e já devolve o token** do link | `0080` (linhas ~477–540), `src/lib/forms/queries.ts:335` |
| Agenda | Calendário com seletor de cronograma (turma), visões semana/mês/lista/horários, nudge, chamada da formação | `src/components/agenda-calendario.tsx` (4.550 linhas), `nudge-button.tsx`, `chamada-formacao.tsx` |
| Agenda | Resumo semanal **já calculado por cronograma** (`resumoSemanaDe` filtra `cronograma_id`) | `src/lib/ciclo.ts:815`, usado em `agenda-calendario.tsx` e `dashboard-coordenacao.tsx` |
| Agenda do jovem | Visão unificada DPP + especialista, agendar/reagendar com motivo, "não aconteceu", avaliação ★ | `src/app/(jovem)/jovem/agenda/page.tsx`, `jovem-agendar-dialog.tsx`, `jovem-encontro-acoes.tsx`, `jovem-avaliacoes.tsx` |
| Apoio | `registros.precisa_apoio`, `avaliacao_jovem.pedir_apoio`, notificação `pedido_apoio`, `PedirApoioDialog`, `ResolverApoioButton` | `src/lib/actions.ts:3065`, `pedir-apoio-dialog.tsx`, `resolver-apoio-button.tsx`, `jovem-pedir-ajuda.tsx` |
| Semáforo | `saudadeDaDupla` + `SemaforoDot` | `src/lib/ciclo.ts`, `src/components/semaforo.tsx` |
| Demo | Dataset por papel, queries que replicam o RLS, stub do supabase-js | `src/lib/demo/*` |
| Testes | Vitest nas regras puras (semáforo, semana, cronogramas, jornada, agenda do especialista, instrumentos, jovem-especialista); e2e demo e app | `tests/*.test.ts`, `tests/e2e/{demo,app}/*` |

### O que NÃO existe (trabalho novo de verdade)

- Tabela/fila/timeline de **chamados**.
- Visões **"Por mentorado"** e **"você acompanha"** para o mentor DPP; o DPP não lê nada da trilha do jovem com o especialista.
- **Instrumentos na área do jovem logado** (hoje o jovem só tem a biblioteca plana e o link solto `/f/<token>`).
- **Roda com antes/depois**, **metas reordenáveis**, **árvore de submetas** (o PDM é de campos fixos `meta_1..5`).
- **Painel de progresso por instrumento** para a coordenação.
- Página própria de **especialistas** do jovem (hoje é uma seção dentro da home).
- **Papel por programa** — `profiles.role` é único; o domínio exige a mesma pessoa DPP **e** especialista (e, por programa, mentor num e supervisor noutro).
- **Pedido de especialista registrado pelo DPP** — o guia prevê ("demanda registrada pelo Mentor DPP"); hoje só o jovem pede.

---

## 2. Onde os mocks divergem do código — correções ANTES de implementar

Cada item abaixo é um erro (ou simplificação) dos mocks que viraria bug se implementado literalmente.

| # | Mock diz | Código diz | Decisão |
|---|---|---|---|
| C1 | "Uma trilha de especialista por jovem por ciclo" | Teto de **3 trilhas simultâneas** e **3 pedidos abertos** por jovem; cada **sessão é uma solicitação** (`solicitacoes_especialista`); budget de **5 sessões por par** | **Vale o código.** Corrigir `jovem-especialistas/v6` e o `_brief-final.md` §3 regra 2 |
| C2 | "Coordenação só observa a trilha" | Existe `aguardando_coord`: sem dupla DPP ativa, a coordenação faz triagem de **turma** antes de liberar o pedido | **Manter a exceção**, documentá-la nas notas e no estado do pedido ("em triagem da coordenação") |
| C3 | Proposta do jovem **fora da grade** como "exceção" (aceitar/sugerir) | A contra-proposta só aceita **slot da grade do especialista** (`ContraPropostaForm` lista `slots`; sem slot: "Sem horário livre nas próximas 3 semanas") | **Regra nova, não existente.** Tratar como decisão D7: ou o mock remove o caso "fora da grade", ou se constrói de propósito (ver WP4) |
| C4 | "Apoio é eixo separado do semáforo" | `saudadeDaDupla` faz pedido de apoio virar **risco** (e há testes que fixam isso) | **A decisão da equipe vale** — mas é mudança de domínio, não visual (WP2) |
| C5 | Roda com leitura inicial × aplicação formal e overlay | Uma aplicação só; nenhum campo guarda o "momento" | **Recurso novo** (WP8-A) |
| C6 | Resumo "X de Y" por cronograma como correção | **Já é por cronograma** (`resumoSemanaDe`) | Nada a corrigir no cálculo; só tornar a explicação visível (WP5) |
| C7 | Nome da especialista "Luísa Campos" em versões antigas | Dataset canônico é "Luísa Prado" | Já corrigido nas versões finais; conferir v1–v5 só se forem reusadas |
| C8 | Estações da `materiais/v3` mapeiam instrumentos por encontro ("autoavaliação" no enc. 8, Roda no enc. 2, "PDM construído no enc. 6") | A "autoavaliação" do mock é instrumento **do mentor** — e a âncora real é o **enc. 16**, não o 8; janelas reais do guia: Roda no onboarding (leitura enc. 1), Visão 1–2, Metas 2–3, PDM 1–4 (rev. 9), Roda formal 12–14, 360º enc. 16/evento; a avaliação do encontro é recorrente | **A trilha deriva do guia/`ciclo_eventos`, não do mock** — marcos canônicos no WP7 |
| C9 | Dataset canônico dos mocks: "T2 = quartas 19h" e "26 duplas" | Cronograma oficial: T2 tem encontros **às terças** com 3 semanas de encontro duplo na quinta (05/11, 03/12, 10/12); o programa real é **1 turma de 30 jovens em 2 cronogramas** (Programa → Turma → Cronogramas → Duplas) | Nada a mudar no modelo (`cronograma_id` já suporta qualquer calendário); corrigir o dataset **dos mocks/demo** pra não ensinar errado — datas sempre derivam do cronograma, nunca fixas |
| C10 | Anamnese como estação da jornada (v3) | Anamnese Social é **instrumento externo por decisão** ("permanece em sistema externo", doc Novos Sistemas) e `coord-only` na 0080 | **Fora da jornada** — sem estação, sem nó. O formulário `sistema` existente segue pra coord (limpeza futura, não desta rodada) |
| C11 | Pedido de especialista só pelo jovem | Guia do especialista: a demanda pode ser **"registrada pelo Mentor de Desenvolvimento"** e o contato "parte do Mentor DPP ou do próprio jovem" | **WP6 ganha o fluxo DPP** (registrar em nome do jovem → jovem confirma → vira solicitação real) |
| C12 | "Uma trilha por jovem" implícito na leitura simples; devolutiva única | Teto real: 3 trilhas simultâneas; o doc Novos Sistemas pede devolutiva **por especialista** (vários especialistas, várias devolutivas) | Já coberto (C1 + WP6): stepper e devolutivas são **por trilha**, múltiplas |

---

## 3. Decisões que travam pacotes

| # | Decisão | Proposta | Bloqueia |
|---|---|---|---|
| D1 | **Privacidade dos instrumentos**: quem lê o conteúdo que o jovem escreve? | Jovem, mentor DPP da dupla, coordenação **e auxiliar executivo** leem o conteúdo (decisão do stakeholder — o auxiliar acompanha as duplas de perto). Nenhuma projeção extra: `instrumentos_da_dupla` já devolve `respostas` ao `supervisor_id` | WP7, WP8 |
| D2 | O que o DPP vê do **registro do especialista** e da ★ do jovem | Resumo (progresso, "registro entregue", ★ do jovem) — texto integral só se a coordenação confirmar | WP3 |
| D3 | **Limite de metas/submetas**: duro ou aviso; guia fala em "até 3 metas", equipe falou ~10 metas e ~20 submetas | Aviso suave a partir de 3 metas; bloqueio duro só no teto (10/20) | WP8 |
| D4 | **Chamado automático** de todos os canais de apoio | Todo pedido de apoio vira chamado: flag do registro (`origem=registro`), flag da avaliação do encontro do jovem (`avaliacao_jovem`) e os botões soltos do mentor e do jovem (`manual`). Nos automáticos a categoria é fixa `outro` com a descrição do texto de origem — quem pediu não preenche de novo | WP1 |
| D5 | **Nudge**: canal e frequência máxima | Notificação interna + botão WhatsApp (já existe `NudgeButton`); no máximo 1 por dupla a cada 48 h — **o cap vale também pro WhatsApp manual** (senão o botão vira spam encorajado) | WP5 |
| D6 | `duplas.pdm_url` externo × PDM nativo | Enquanto o PDM nativo for one-shot (fase A), o `pdm_url` segue como rota de fuga; só depreciar após a fase B | WP8-B |
| D7 | **Proposta fora da grade** do especialista | Não construir agora. Manter a regra atual (slot da grade). Remover o caso do mock | WP4, WP6 |
| D8 | Mentor emitir link de instrumento "preencher junto" (autoria da resposta) | Adiar. Entregar só "enviar link"/estado (já existe) | WP7 |
| D9 | Pessoa que é **DPP e especialista** ao mesmo tempo (dúvida do stakeholder na agenda) | **Existe no domínio e entra nesta rodada**: o guia DPP §5 diz que o pool de especialistas reúne "mentores voluntários capacitados e especialistas de mercado", e o doc Novos Sistemas pede "perfil atribuído por programa, não fixo". Modelo: **tabela `profile_papeis(profile_id, papel, escopo_turma)`** substituindo o role único (WP0b) + views híbridas do mentor. Escopo da rodada: híbrido DPP+especialista; "Supervisor de Relacionamento" (mentor eleito pelo grupo) **não entra no sistema** (muito pontual — decisão) | WP0b, WP3, WP6 |
| D10 | DPP registra pedido de especialista pelo jovem? | **Sim** (guia). Fluxo: mentor registra demanda (tema, preferência, objetivo) → jovem recebe e confirma/edita → vira solicitação real no mesmo pipeline (mesmos tetos/dedup); `origem='mentor'` na solicitação | WP6 |

---

## 4. Estratégia global anti-regressão

### 4.1 Regras de entrega (valem para todo pacote)

1. **Um pacote = uma branch = um PR**, com preview e e2e verde antes do merge. Nunca empilhar dois pacotes de risco no mesmo PR.
2. **Migration primeiro no staging** (`supabase db push --db-url …`), depois produção **antes** do merge; o `schema-contract` falha se o remoto não tiver as colunas. Nunca redigitar SQL no MCP — passar o arquivo verbatim.
3. **Antes de escrever DDL, conferir o schema real** (`information_schema`, `pg_policies`, `pg_enum`, `pg_get_functiondef`). Os números de migration continuam a partir da `0084`.
4. **Sem feature flag.** O gate é o papel: quem não tem o papel não vê a superfície. Cada superfície nova nasce atrás do role-gate e das RPCs escopadas; reverter = `create or replace` da versão anterior.
5. **Commits de preview** levam `[deploy]` enquanto a regra da Vercel valer; só depois de `npx tsc --noEmit && npx eslint src/ && pnpm test`.
6. **Demo em paridade**: toda leitura nova tem versão em `src/lib/demo/queries.ts` escopada por papel; toda ação nova retorna `DEMO_MSG` em demo.
7. **Mocks saem do registry** (`src/lib/demo/mockups.ts`) quando a tela real entra em produção, para a equipe não comparar com cópia desatualizada.

### 4.2 Raio de impacto das mudanças de maior risco

| Mudança | Quem consome hoje | Como proteger |
|---|---|---|
| `saudadeDaDupla` (apoio vira eixo separado) | `duplas/[id]/page.tsx`, `dashboard-coordenacao.tsx`, `duplas-lista.tsx`, `mentor-home.tsx`, `encerramento.ts`, **`lib/ia/queries.ts` e `lib/ia/tools.ts`** (camada de IA), export CSV | PR isolado. Primeiro reescrever `tests/ciclo-semaforo.test.ts` (3+ testes hoje fixam "apoio ⇒ risco"), depois o código. Manter o campo antigo `pediuApoio`/`apoioJovem` no retorno durante a transição; só remover quando todos os consumidores migrarem. Conferir os tools de IA (eles descrevem o semáforo ao usuário) |
| Novas tabelas de chamados + backfill dos flags de apoio | `registro-form`, `registro-card`, `encontro-detalhe-dialog`, `resolver-apoio-button`, `avaliacao-jovem*`, `notificacoes`, dashboard | Backfill **idempotente** dos dois flags (`registro_id` único; a avaliação usa `encontro_id`/id próprio como chave); manter `precisa_apoio`/`pedir_apoio` nas fontes (o flag segue sendo o dado clínico) e **derivar** o chamado deles; só migrar a leitura de "apoio aberto" quando o backfill for verificado por contagem. Notificações `pedido_apoio` antigas (botão do jovem) não têm registro resolvível — não entram no backfill |
| RLS novo para o DPP ler a trilha do jovem | `especialista_eventos`, `encontros`, `registros` (dados sensíveis) | **Nunca abrir policy por ramo** (aprendizado documentado nos planos do mentorado: policy não filtra coluna nem status). Só **RPC/view `definer`** com projeção mínima, validando vínculo `dupla_dpp_id`. Teste de persona com JWT real no staging |
| Reescrever `/jovem/materiais` | `jovem-shell.tsx` (nav), home do jovem (seção Materiais), e2e `jovem*.spec.ts` | Manter a **biblioteca atual intacta** como "Acervo de apoio"; o hub entra **acima** dela. Se o RPC falhar/vier vazio, a página cai no comportamento de hoje |
| Mexer em `AgendaCalendario` (4.550 linhas) | coordenação, supervisor, mentor DPP; e2e `agenda-views`, `agenda-disponibilidade` | **Não editar o miolo.** Criar componentes novos e envolvê-lo. Cada edição inevitável é cirúrgica e coberta por e2e existente |
| Mover seção de especialistas da home do jovem para página própria | `jovem/page.tsx`, `jovem-especialistas.tsx`, e2e `jovem-especialista.spec.ts`, `solicitacao-esp.spec.ts` | Mover primeiro (mesmo componente, nova rota), só depois redesenhar; deixar na home o card-CTA. Atualizar os specs na mesma PR |
| Substituir `PedirApoioDialog` | pontos de uso na ficha, home do mentor, home do jovem | Trocar o **trigger** por ponto de uso, não tudo de uma vez; durante a transição o diálogo antigo continua chamando a mesma notificação |

### 4.3 Matriz de verificação por PR (checklist)

- [ ] `tsc`, `eslint src/`, `pnpm test` limpos.
- [ ] Nenhum texto < 12px nas telas tocadas; alvos ≥ 44px no mobile; conteúdo não coberto pela bottom nav (`padding-bottom ≥ nav + safe-area-inset-bottom`); legível a 200% zoom; submit não some atrás do teclado; foco visível.
- [ ] Status nunca só por cor (ícone + rótulo).
- [ ] Toda superfície nova com skeleton de carregando e estado de erro com retry (RPCs novas falham — o vazio honesto não é o loading).
- [ ] Persona test (JWT real, staging) para **cada papel** afetado — incl. híbrido e auxiliar — com asserts RLS negativos por RPC/view nova (`restComoUsuario`).
- [ ] Backfill verificado **por contagem** antes do merge (profiles→`profile_papeis`; flags→chamados).
- [ ] Inventário nominal dos specs e2e a reescrever na PR (o spec que fixa comportamento velho morre na mesma PR, não depois).
- [ ] Nota de rollback por migration (tabela nova = drop; CHECK = restore; RPC = `create or replace`).
- [ ] Demo: papel a papel abre sem erro; ações mutáveis retornam a mensagem de demo; **stub com casos pras tabelas novas** (o stub devolve `[]` pra tabela desconhecida — `chamados`/`profile_papeis` renderizariam vazio silencioso).
- [ ] e2e demo + app relevantes verdes no preview.
- [ ] `schema-contract` verde (migrations aplicadas em staging e prod).
- [ ] Sem regressão visual nas telas vizinhas (screenshot antes/depois quando houver CSS compartilhado).
- [ ] Linha do mockup correspondente removida do registry (quando a tela real fecha).

### 4.4 Sequência de segurança (ordem em que a proteção entra)

1. **Fixtures antes de consumidores**: os fixtures e2e novos (supervisor/auxiliar com auth, mentor híbrido) entram **no primeiro PR do WP0b** — antes de migrar qualquer consumer de `my_role()`. Sem fixture, nenhum fluxo migrado pode ser provado.
2. **`profiles.role` é o kill switch do WP0b**: enquanto houver consumer não migrado, a coluna segue sendo escrita pelo trigger — rollback de um fluxo = voltar o consumer pra `my_role()`, sem migration reversa. Só se remove a projeção quando o último consumer sair.
3. **Flag→chamado em dual-run**: no WP1 o flag continua escrito e lido; o chamado é derivado. A leitura de "apoio aberto" (semáforo, banner, mentor-home) só muda de fonte **depois** do backfill verificado por contagem em staging — antes disso as duas fontes coexistem e divergência aparece como chamado órfão, não como apoio sumido.
4. **Persona pass manual por WP**: além do persona test automatizado, uma passada manual em staging com login real por papel tocado (híbrido incluído) antes do merge — RLS errada que o spec não cobriu aparece em 5 minutos de clique.
5. **Um WP por vez em voo**: nada de WP0b e WP1 abertos juntos — a sobreposição flag↔papel é onde regressão silenciosa nasce. WP6 e WP7 podem paralelizar com WP3–5 (superfícies disjuntas).

---

## 5. Pacotes de trabalho

Legenda de esforço relativo: **S** pequeno · **M** médio · **L** grande · **XL** muito grande.

### Ordem e dependências

```
WP0b papéis (base de dados, cedo) ─► desbloqueia views híbridas em WP3/WP6
WP1 Chamados ─► WP2 Duplas/semáforo
WP3 Agenda DPP ─► WP4 Agenda especialista ─► WP5 Agenda coord/aux.
WP6 Especialistas do jovem (independente)
WP7 Materiais/jornada ─► WP8 Instrumentos (A → B)
WP9 transversal acompanha todos
```

Sequência sugerida: **WP0b → (WP6 ‖ WP1) → WP2 → WP3 → WP4/WP5 → WP7 → WP8-A → WP8-B**.

**Escopo desta rodada** (decisão, não esquecimento): as 6 telas mockadas. Ficam fora: dashboard da coordenação (só o banner de apoio muda, WP2), ficha da dupla (tocada só via semáforo, `InstrumentosDupla`, trigger de apoio e "Sugerir especialista", D10), `/pessoas` (exceto a atribuição de papéis do WP0b), `/formularios`, `/relatorios`, `/turmas`, `/registros`, `/perfil` (exceto a seção grade do híbrido, WP0b), `/jovem/pessoas`, a home do jovem além do card-CTA e a visão "Mentorado" do mock de agenda (coberta entre o WP6 e o `/jovem/agenda` já unificado).

---

### WP0b — Papéis por programa + mentor híbrido (L) · REALIZA-105

**Objetivo / dor:** `profiles.role` é único, mas o domínio exige a mesma pessoa ser **DPP e especialista** — a dúvida do stakeholder é um caso real ("mentores voluntários capacitados" integram o pool de especialistas, guia DPP §5; "perfil por programa, não fixo", doc Novos Sistemas).

**Estado atual:** `profiles.role` único dirige nav, guards de página, queries e RLS/RPCs (`my_role()`); `jovem_especialistas` filtra `role='mentor_especialista'`; `mentor_profiles`/`especialista_grade`/`capacidade_especialista` assumem o role.

**Mudanças**
1. **Migration `profile_papeis`** (`profile_id`, `papel` ∈ roles existentes, `escopo_turma text null` = papel vale pro programa todo, `criado_em`). Detalhes que a migration precisa acertar de cara:
   - **Unique com NULL**: `unique (profile_id, papel, escopo_turma)` no Postgres trata NULLs como distintos — papel global duplicaria. Usar `NULLS NOT DISTINCT` (PG15+) ou índice sobre `coalesce(escopo_turma,'')`.
   - **Escopo restringe acesso** (decisão): `escopo_turma` nulo = papel global (vale pra qualquer turma); preenchido = papel só vale naquela turma — `has_papel(papel, escopo)` exige bater; especialista escopo T1 não entra no catálogo de T2, supervisor escopo T1 só vê T1. Turma hoje é label no cronograma, não entidade com id — `escopo_turma text` casa com o modelo atual (validar contra labels existentes).
   - **Papel primário determinístico**: `profiles.role` segue como primário sincronizado — definir a regra (ex.: ordem fixa de prioridade coord > supervisor > DPP > especialista > mentorado, ou o papel mais antigo) senão `my_role()` fica instável entre writes.
   - **Sync sem recursão**: uma direção só de autoridade — `profile_papeis` é a fonte e um trigger sync projeta o primário em `profiles.role`; writes em `profiles.role` direto são bloqueados ou ignorados (guard `pg_trigger_depth() = 1` se os dois lados escreverem — triggers mútuos sem guarda recursam).
   - **Novos perfis**: `handle_new_user`/pré-cadastro e o write-path de `/pessoas` precisam gerar a linha em `profile_papeis` (trigger em `profiles` ou RPC de atribuição) — senão perfis criados depois do backfill ficam sem papel na tabela nova.
   - **Escopo × `supervisor_id`**: hoje a supervisão é atribuída por dupla (`duplas.supervisor_id`); papel escopo-turma criaria um 2º eixo de escopo. Regra: papel-escopo **filtra** o que já se veria (AND), nunca amplia — supervisor escopo T1 vê das supervisionadas só as de T1.
   - Backfill: todo `profiles.role` vira uma linha com escopo nulo.
2. **Helpers SQL** — duas assinaturas: `my_papeis()`/`has_papel(papel, escopo?)` (invoker-centradas, pra policies/guards) **e** `has_papel(profile_id, papel, escopo?)` (predicado por linha — a view do catálogo filtra **a linha**, não o caller). `my_role()` segue devolvendo o papel primário — mas **auditar e migrar** cada consumidor por fluxo (checklist na §8). Superfície real medida: `my_role()` em **~55 migrations** + role-gates hardcoded dentro de triggers e RPCs (`solicitacao_integridade` valida `origem×my_role()` e `especialista_desejado_id` por `p.role`; `pedir_especialista_jovem`, `aceitar_solicitacao`, `contra_propor`, `recusar`, mural — o híbrido não pode nem ser alvo de pedido dirigido até migrar). E o papel não mora só no SQL — **guards e nav são TypeScript**: `me.role ===` em `agenda/page.tsx`, `(app)/layout.tsx`, `(home)/page.tsx` (branch do especialista — a home híbrida), `duplas/page.tsx`, `perfil/perfil-form.tsx`, `materiais/page.tsx`, `pessoas/*`, `(jovem)/layout.tsx`, `api/export`, `api/assinatura`, e componentes (`nova-dupla-dialog`, `remanejar-dupla-dialog`, `matching-panel`, `mentor-home`, `chamada-formacao`, `onboarding-flow`…) + NAV `roles:` em `app-shell.tsx` + `demoRole()`/`linhas(papel)` do stub. O app passa a ler `me.papeis` (união) nesses pontos — senão o híbrido com primário `mentor_dpp` não vê nada de especialista.
3. **Catálogo**: `jovem_especialistas` passa a listar quem tem `has_papel('mentor_especialista', turma do jovem)` — o mentor DPP híbrido aparece no cardápio com os mesmos campos do card (WP6). **Decisão: o DPP da própria dupla fica de fora** (`mentor_id !=` o da dupla DPP ativa do jovem) — o guia separa os papéis; trilha com o próprio mentor misturaria os mundos.
4. **Views híbridas do mentor** (o que o stakeholder pediu):
   - **Home**: os dois mundos lado a lado — "Minhas duplas" (DPP) + "Minhas trilhas" (especialista, x de 5, prazo) + mural de demandas.
   - **`/duplas`**: mesma página mostra duplas DPP e trilhas de especialista da pessoa (trilha já tem `TRILHA_LABEL`).
   - **`/agenda`**: calendário único — encontros das duplas DPP + sessões das trilhas + grade de disponibilidade do especialista editável (`/perfil` ganha a seção grade quando tem o papel).
   - **Nav**: itens se resolvem por `has_papel`, não por `role` — o híbrido vê a união das duas.
5. **Gestão**: `/pessoas` (coord) ganha atribuição de papéis por pessoa (adicionar/remover papel, com escopo opcional de turma) — substitui o role único no formulário.
6. **Demo**: um mentor híbrido no dataset (ex.: André Lima é DPP da Ana/Caio **e** especialista num tema) pra exercitar as views.

**Por quê:** resolve o caso real sem inventar segunda conta; a tabela já nasce com escopo pra suportar "mentor num programa, supervisor noutro" (a direção do doc), mesmo que esta rodada só use DPP+especialista.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| `my_role()` em dezenas de policies/RPCs quebra fluxos | `profiles.role` segue preenchido e sincronizado como primário; migração **por fluxo** (só os de especialista viram `has_papel` nesta rodada); checklist auditável na §8 |
| "Supervisor de Relacionamento" (papel eleito do guia) vira expectativa | **Decisão registrada: não entra no sistema** — papel pontual externo |
| Hybrid na nav confunde (duas identidades?) | Um perfil, uma home — papéis aparecem como seções, não como troca de identidade (sem seletor de papel) |
| Demo/e2e assumem role único | `demoRole()` e fixtures ganham `papeis`; specs app re-criam o piso com os dois papéis |

**Aceite:** um profile com papéis DPP+especialista vê home/agenda/duplas unificadas, recebe e aceita demandas no mural, aparece no catálogo do jovem — tudo num login só; um profile de papel único não vê diferença nenhuma.

---

### WP1 — Chamados (XL) · REALIZA-127 a 132

**Objetivo / dor:** pedido de apoio sem dono, sem status e sem histórico; o autor não sabe se alguém viu.

**Estado atual:** `precisa_apoio` é flag em `registros`; `pedirApoio` só notifica coordenação e supervisor; `resolverApoio` apenas desmarca. Não há quem assumiu, nem andamento. Do jovem há **dois** canais: `avaliacao_jovem.pedir_apoio` (flag da avaliação do encontro → notificação + **e-mail redundante**, 0071) e o `PedirAjudaDialog` da home (notificação `pedido_apoio`, sem registro resolvível).

**Dados (migration `0084+`)**
- `chamados`: `categoria` (`agenda|metodologia|plataforma|urgencia|outro`), `descricao_outro` (CHECK: obrigatória quando `outro`), `status` (`aberto|em_atendimento|resolvido`), `atribuido_a`, `autor_id`, `dupla_id` opcional, `origem` (`manual|registro|avaliacao_jovem` — `manual` cobre os botões soltos do mentor e do jovem), `registro_id` opcional (unique parcial → backfill idempotente) + chave análoga pra `origem=avaliacao_jovem` (`encontro_id` — `avaliacoes_encontro` é tabela com unique por encontro, 0071; o único write-path é `submeter_avaliacao`), `created_at`, `resolvido_em`.
- `chamado_atualizacoes` (timeline **pública**: autor/hora/texto/`status_opcional`) e `chamado_comentarios` (**interno**, só equipe).
- **RLS**: coordenação tudo; auxiliar executivo lê todos e escreve só em não técnicos (`plataforma` é coord-only **no banco**, não só na UI); autor lê o próprio chamado e as atualizações públicas — **nunca** os comentários internos. **`dupla_id` não dá leitura ao mentor da dupla**: o chamado do jovem pode ser justamente sobre o mentor — autor + equipe apenas (canal seguro), caso contrário o jovem perde o canal.
- **RPCs `definer`** (assumir, atribuir, devolver à fila, resolver, reabrir, publicar atualização, comentar interno), seguindo o padrão `marcar_combinado`/`aceitar_solicitacao`. Nada de `update` direto pelo cliente.
- **Notificações**: novos tipos no CHECK de `notificacoes` (`chamado_*`, incl. `chamado_mencao` para @menção em comentário interno); urgência notifica coordenação **e** supervisão; "quem assumir primeiro trata". Chamado de origem jovem ou categoria `urgencia` também dispara **e-mail redundante** (segurança de menor — espelha a 0071; o CHECK de `emails_enviados.tipo` `('comunicado','material','assinatura','apoio_jovem')` precisa de alter ou reusar `'apoio_jovem'`).
- **Guards de flag bloqueiam a sync** (bloqueio real, 0004/0071): `guard_registro_apoio` e `guard_avaliacao_encontro` levantam exceção quando `my_role() ≠ 'coordenacao'` limpa `precisa_apoio`/`pedir_apoio` — e `my_role()` lê o JWT do caller mesmo dentro de RPC definer. Um auxiliar resolvendo chamado de origem flag deixaria a flag acesa (ou a RPC falharia). Precisa de exceção transaction-local nos guards (precedente: `realiza.sol_transicao`/`realiza.no_notify`) ou resolver esses chamados só pela coordenação.

**App**
- `/chamados` (nav: coordenação e auxiliar executivo): fila + detalhe lado a lado no desktop; inbox + página cheia no mobile. Filtros por fila (Todos / Sem dono / Atribuídos a mim), categoria e status; busca; indicador "mais antigo sem dono há X".
- **"Meus chamados"**: card na home do mentor DPP e do especialista (lista dos que abriu + contagem — a nav não ganha item) e, para o jovem, dentro do Perfil (a nav de 5 itens do jovem **não muda**).
- **Diálogo de abertura por papel**: staff e mentores veem as 5 categorias (`outro` exige descrição curta); o **jovem vê opções na linguagem dele** — "com meu mentor", "com a plataforma", "outra coisa" + uma sempre visível **"É urgente / preciso de ajuda agora"** → `urgencia` (sem ela, o menor em risco cai na triagem baixa). Substitui `PedirApoioDialog` (o botão do mentor **fora do registro** também abre chamado) e `jovem-pedir-ajuda.tsx`.
- **Anexos** no chamado (bucket privado `chamado-anexos` + policies espelhando a visibilidade: autor e equipe leem; anexo em comentário interno segue a regra do interno) e **@menção** em comentário interno notificando o mencionado.
- **Composer** com padrão "comentário interno" e alternância explícita para "atualização pública" (corrige o erro da variante v3 de abrir como público).
- Vermelho/aberto **só** enquanto não assumido; em atendimento sai do vermelho mas continua visível, com dono.
- Todo pedido de apoio abre chamado (D4): automático nos flags do registro e da avaliação do jovem; pelos botões soltos o autor escolhe a categoria (ou a versão simplificada, no caso do jovem).
- **Sincronia flag × chamado** (buraco de transição): `resolverApoio` hoje só desmarca o flag — passa a resolver o chamado vinculado junto (ou o botão é absorvido pelo chamado). E o caminho inverso: a fonte do "apoio aberto" do semáforo/banners vira **a existência de chamado aberto**, não o flag — senão resolver o chamado deixa o flag aceso e vice-versa.
- **Sem notificação dupla**: o write-path do flag para de emitir `pedido_apoio` novas quando o chamado nasce — o tipo antigo fica só pra histórico; cada evento gera exatamente um `chamado_*`.

**Por quê:** é o mecanismo que separa **apoio** (trabalho a fazer) de **risco** (sinal da jornada) e dá ao autor visibilidade do andamento.

**Reaproveitar:** `notificacoes.tsx` (ícones e tipos), `NudgeButton`, padrão de RPC `definer`, `SemaforoDot` para o chip da dupla, padrões de lista do `registros/page.tsx`.

**Demo:** chamados no `data.ts` (8 casos cobrindo categorias e status), queries escopadas por papel em `demo/queries.ts`.

**Testes:** Vitest nas regras puras (quando é vermelho; quem pode agir em qual categoria; visibilidade de interno); e2e por papel (autor não vê interno; auxiliar não assume `plataforma`; coordenação vê tudo). **Specs e2e que fixam o fluxo velho e morrem nesta PR** (verificado): `avaliacao.spec.ts` (notificação `apoio_jovem` + "Marcar ajuda como atendida"), `jovem.spec.ts` ("Pedir ajuda" → `pedido_apoio` **pro mentor** — no modelo novo isso seria vazamento: o chamado do jovem não vai ao mentor), `operacional.spec.ts` (flag → semáforo risco + card remanejo), `remanejo-capacidade.spec.ts` ("Pedido de apoio" no card de risco).

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Perder pedidos de apoio antigos | Backfill idempotente + comparação de contagem antes/depois; `precisa_apoio` continua no registro |
| Duplicidade entre canal do mentor e do jovem | `origem` explícita; os dois canais continuam **distintos** no modelo (o jovem pode pedir apoio sobre o próprio mentor) |
| Vazamento de comentário interno ao autor | Tabela separada + policy própria + teste de persona; a RPC de leitura do autor nunca faz join com `chamado_comentarios` |
| Notificação em excesso na urgência | Uma notificação por destinatário por chamado; "assumir" resolve a pendência dos demais |
| Sobreposição com `notificacoes.pedido_apoio` | Manter o tipo antigo lendo-se só; novo fluxo emite `chamado_*` |

**Aceite:** os flags antigos (`precisa_apoio`, `avaliacao_jovem.pedir_apoio`) aparecem como chamados e todo pedido novo — de qualquer canal — abre chamado; o jovem pede ajuda com fricção mínima; o vermelho some ao assumir sem sumir o chamado; o autor acompanha o andamento sem ver o interno; anexo visível a autor+equipe; @menção notifica o mencionado.

---

### WP2 — Duplas e semáforo (L) · REALIZA-136

**Objetivo / dor:** não dá para entender por que a dupla está na categoria; apoio se confunde com risco.

**Estado atual:** `DuplasLista` (456 linhas) é lista plana com chips (Todas/Risco/Atenção/Pausadas/Em andamento), busca, ordenação e filtro de turma. `saudadeDaDupla` devolve `{semaforo, motivo, …}` e **força risco** quando há pedido de apoio.

**Mudanças**
1. **Domínio (`ciclo.ts`)**: apoio sai do semáforo e vira um campo próprio (`apoio: { aberto; origem }`); `motivo` ganha `motivos: string[]` com os critérios que acenderam o estado. Manter `motivo` (string) derivado do primeiro, para os consumidores atuais.
2. **`DuplasLista`** — spec no mock **`docs/mockups/duplas/v5.html`** (Final, out/2026): base **v1** (escolha do Léo — "mais limpo") + mitigações da Final. O que faz a v1 parecer "limpa" — e se preserva: filtrar e explicar são **o mesmo elemento** (a régua mora no chip, zero referência cruzada); um container único com colunas fixas em vez de 26 mini-cards; cada fato escrito uma vez.
   - **Chips de categoria com régua** (exatamente como na v1 — o visual que o Léo escolheu): 5 chips + "Apoio" separada por divisória + azul informativo; cada chip é `<button>` com dot+nome+contagem na linha 1 e a **régua completa na linha 2** (12px, nunca truncada). Mobile: grid 2 col, Apoio full-width. (A compressão em "faixa segmentada" foi considerada e descartada — distanciava do visual aprovado.)
   - **Lista = um container** com cabeçalho de colunas e linhas por hairline. Anatomia da linha: pill semáforo ícone+rótulo (+ segundo pill "Apoio" quando houver — flag na linha, não seção) · avatares+nomes + meta "T2 · enc. 4 · sup. X" · barra feito × esperado com tick (`role=progressbar`) · sinais em texto corrido **com recência** ("há 26 dias") + contexto (próximo encontro / trilha / origem do apoio) · coluna avaliação do mentor (badge + "nota do mentor · Nº enc.") · coluna de ações: "Lembrar" (nudge, quando há pendência) + "Ver ficha ›" — linha é `<div>`, não `<a>` aninhando botões.
   - **Toolbar de 1 linha**: busca real + filtros pill turma/supervisão/mentor (turma só se >1; mentor atrás de "+ mentor" pra não crescer a linha). Sub do h1 com o resumo vivo ("26 duplas · 2 em risco · 3 em atenção · 1 apoio"). Legenda completa sob demanda ("Como o semáforo é calculado") no rodapé da lista — resgata o glossário da v4 sem a caixa de 6 blocos.
   - **Ordem default**: apoio → risco → atenção → andamento → pausada. Massa saudável atrás do disclosure `<details>` "Mostrar as outras N duplas em andamento" (dentro do mesmo container, linhas compactas; auto-abre com busca/filtro).
   - **Sem banner de escopo** ("Você vê…") — era material de demo: privacidade é RLS, o escopo de cada visão fica nas notas do mock.
   - Régua fonte única: a mesma tabela de critérios que o código usa (`saudadeDaDupla`), para não divergir.
3. **Contrato de dados**: `saudadeDaDupla` exporta `sinais: { tipo, tom, texto, detalhe? }[]` — tudo já é calculado internamente (atraso, pendência, avaliação baixa, dificuldade, encaminhamento vencido, limbo, estagnação) e hoje se perde; manter `motivo` derivado pra back-compat. Metadados de chamado (nº/dono/categoria na linha de apoio) só depois do WP1 — até lá o pill "Apoio" linka pra ficha.
4. Por papel (4 visões preservadas da Final):
   - **Coordenação**: mantém **Nova dupla**, importar, exportar CSV, filtros de turma/mentor/auxiliar.
   - **Auxiliar executivo**: só as supervisionadas, agrupadas por turma, com "registrar supervisão"; sem Nova dupla.
   - **Mentor DPP ("Minhas duplas")**: cards enxutos (semáforo, próximo passo, pendências), **sem** seções de gestão (`paraMentor` já existe).
   - **Mentor especialista**: progresso x de 5 e prazo da trilha.
5. O banner de apoio do `dashboard-coordenacao.tsx` passa a contar **chamados abertos** (depende do WP1); até lá, continua lendo as flags.

**Por quê:** a estrutura da página passa a ser a explicação; "Apoio" vira trabalho a fazer, não falha da dupla; o mentor deixa de ver gestão que não é dele.

**Reaproveitar:** `DuplasLista` (busca, ordenação, filtro de turma, `filterChipCls`), `SemaforoDot`, `progressoDe`, `NovaDuplaDialog`, `ImportarCsvDialog`, `comparaNome`, `ORDEM_SEMAFORO`.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Quebrar consumidores do semáforo (`duplas/[id]`, dashboard, mentor-home, encerramento, **camada de IA**, export) | Mudança **aditiva** no retorno; migração dos consumidores um a um; PR isolado; revisar `lib/ia/tools.ts` (descreve o semáforo ao usuário) |
| Testes que fixam "apoio ⇒ risco" | Reescrever `tests/ciclo-semaforo.test.ts` **primeiro** (red → green), com novos casos: apoio + jornada em dia ⇒ ok + apoio aberto |
| Mudar a ordenação "Prioridade" altera a rotina da equipe | Manter a ordenação por semáforo na lista default (apoio primeiro); o card-filtro "Apoio" já abre filtrado |
| Lista de ~26 duplas vira rolagem longa | Massa saudável atrás do disclosure (16 linhas compactas na v5); chips viram grid 2-col no mobile; busca/ordenação mantidas |

**Aceite:** dupla com apoio aberto e jornada em dia aparece no filtro "Apoio" e **não** em "Risco" (e carrega o pill "Apoio" na linha, no topo da fila — trabalho a fazer); cada dupla mostra o motivo; a régua está visível no chip-filtro; a linha traz recência, avaliação do mentor e ações (Lembrar + Ver ficha); o auxiliar não vê duplas fora das suas; a lista bate com `duplas/v5.html`.

---

### WP3 — Agenda do mentor DPP (L) · REALIZA-133 a 135 — **revisado após recon (out/2026)**

**Objetivo / dor:** (1) compromissos de jovens em turmas diferentes se confundem; (2) o DPP é orientador pessoal e precisa ver a jornada do jovem com o especialista, sem que isso vire compromisso dele; (3) **feedback real da mentora Kelyng** — calendário confunde com sessões atrasadas, CTA de registro aparece em dia já registrado, sessão vencida sem remarcação óbvia, anexos fora do fluxo, e dúvida de privacidade ("o mentorado lê minha avaliação?").

**Recon (3 agentes):** mock `docs/mockups/agenda/v6.html` aprovado pelo Thiago como base (satisfaz REALIZA-137 p/ agenda); o DPP **já lê** pedido+devolutiva via `solicitacoes_mural` — falta só a projeção de sessões; `especialista_eventos` é catálogo (não por-dupla); passo das sessões = rank entre realizados (`passoEsp`), `numero` = tentativa.

**Decisões reconciliadas (Thiago):**
- **Visibilidade COMPLETA** (134 prevalece sobre "resumo" de 135): datas/estados das sessões + **registro integral** + ★ por sessão + devolutivas. Fora: `link` da sessão (acompanha, não participa) e campos de avaliação que identificam o jovem além da nota (sentimento/comentário/temas/avancei/pedir_apoio).
- **★ por sessão: sempre visível** (sem gate de `avaliacao_visivel_mentor`). Compensação honesta: rótulo "quem vê" nos forms (avaliação do jovem diz que o mentor lê a nota; registro do especialista diz que o DPP lê).
- **Navegação:** `role="tablist"` dentro da visão DPP com param `?aba=minha|por-mentorado|calendario` — `minha` = cronológica nova (default), `por-mentorado` = cards por jovem, `calendario` = `AgendaCalendario` atual **intacto** (mês/semana/lista/horários + overlay de disponibilidade sobrevivem — reduz regressão e preserva os specs pinados). Não reusa `nav[name="Visão da agenda"]` (é o `?visao=` do híbrido WP6b — os dois níveis coexistem).

**Migration:** `0092_trilha_do_jovem` (staging+prod) — definer, valida mentor/supervisor da dupla DPP ou coordenação (mesmo predicado do ramo 2 da `solicitacoes_mural`), retorna jsonb: sessões+registro+anexos(nomes)+★, devolutivas, metadados da trilha. Não exige trilha ativa (histórico legitima).

**Mudanças**
1. **Três abas** para o mentor (`AbasAgendaMentor`, role=tablist, `?aba=`):
   - **Minha agenda** (default): cronológica Hoje/Amanhã/Próximos com chips de escopo (mentorado+Eu+Tudo), warnrows de pendências próprias no topo de Hoje (registro pendente, encaminhamento vencido — **sem prazo inventado**), guest items esp âmbar "agenda da Ana — você não participa" (sem link/entrar), previstos tracejados "a agendar", rail "Esta semana" + "Suas duplas" (semáforo).
   - **Por mentorado**: card por jovem — turma + semáforo, barra "encontro N de 16 · Tx", próximo encontro/limbo honesto, bloco âmbar da trilha esp (5 sessões com estados reais, registro integral expansível, ★, devolutivas, `devolutiva_pdm`), pendências, stepper do pedido (sugerida/aberta/contra_proposta/aguardando_coord/aceita/expirada — estados reais do banco), CTA "Sugerir especialista" quando nada em voo, trilhas anteriores colapsadas.
   - **Calendário**: `AgendaCalendario` como hoje.
2. **Número do encontro sempre com a turma** ("encontro 8 · T1") + nota do desencontro quando turmas começam em datas diferentes.
3. **Fixes Kelyng (produção):** itens da dupla ANTES do evento oficial no painel do dia; dia resolvido (realizado+registro) sem CTA "Registrar encontro" solto; encontro agendado vencido com "Remarcar" explícito (+ "não aconteceu" se action existir); anexos no fim do fluxo de registro (estado pós-save no mesmo dialog); disclosure "quem vê" nos forms de registro/avaliação.
4. **Pendente (registrado, não bloqueia):** strip "Sua semana", seção "Do programa" (supervisão/formação no card — "Eu" cobre em Minha agenda), botão "Lembrar" mentor→jovem (canal indefinido — D5), pendência "avaliação do mentor" (write-path inexistente — provável que mapeie pro campo `registros.avaliacao`).

**Reaproveitar:** `AgendaCalendario` intocado na aba calendário, `jornadaDaDupla`, `alvoAgendamento`, `passoEsp`/`encontroDoPassoEsp`, `SolicitacaoStatusChip`, `TrilhaPrazoBadge`, `SugerirEspecialistaDialog`, `DevolutivaEspecialista`, `AgendarEncontroDialog`/`RegistrarRetroativoDialog`.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Escopo errado na RPC | Validação à la `avaliacao_media_dpp`/`instrumentos_da_dupla`; `revoke` de public/anon; teste de persona |
| Jovem se auto-censura sabendo que o mentor lê a ★ | Disclosure "quem vê" no form de avaliação (decisão explícita documentada) |
| Quebrar o calendário atual | `?aba=calendario` preserva o componente inteiro; specs `agenda-views`/`agenda-disponibilidade` migrados pra URL da aba |
| Colisão de navs (`?visao=` híbrido × `?aba=`) | `role="tablist"` + param próprio; spec híbrido cobre |
| Mentor com 1 dupla | "Por mentorado" renderiza o card único (conteúdo ainda útil); chips de escopo funcionam com 1 jovem |

**Aceite:** mentor identifica turma de cada item sem clicar; sessão da Ana marcada "você não participa" sem botão de entrar; registro integral do especialista expansível; agendado vencido oferece "Remarcar" a um toque; dia registrado não mostra "Registrar encontro"; painel do dia mostra a dupla antes do oficial; registro anexa evidências no mesmo fluxo.

---

### WP4 — Agenda do especialista (M) · REALIZA-133 (parcial)

**Objetivo / dor:** a disponibilidade é o instrumento de trabalho dele, não um detalhe.

**Estado atual (verificado):** `AgendaEspecialista` já tem `AgendaDisponibilidade` (grade + exceções + slots livres), `TrilhaJornada`, listas "Próximos"/"Já passaram", `AgendarEncontroDialog` só para mover tentativa existente e `EncerrarTrilhaDialog`. A grade é **formulário de janelas**, não uma grade visual semanal.

**Mudanças**
- **Grade visual semanal** (dias × horas) mostrando janelas oferecidas, sessões marcadas posicionadas e slots livres, **gerada dos mesmos dados** (`getMinhaGrade`, `getMinhasExcecoes`, `getSlotsLivres`). O formulário atual de janelas permanece como "Editar grade".
- Eixo horário **fixo 8h–20h** (configurável é preferência de power-user — corta); **fallback mobile**: a grade vira lista de janelas por dia abaixo do breakpoint, nunca grade espremida em ~390px.
- **Cards por trilha** com prazo (`TrilhaPrazoBadge`), "sessão x de 5", registro/avaliação e "Propor outro horário" (abre o thread existente).
- **Proposta fora da grade: NÃO construir** (D7). O mock é corrigido para remover esse caso.
- Reforçar o texto: quem agenda é a dupla; o card não é "reserva".

**Por quê:** hoje a oferta de horários existe mas é invisível como calendário; o especialista decide por intuição o que oferecer.

**Reaproveitar:** `AgendaDisponibilidade` (ações `adicionarJanela`/`removerJanela`/`adicionarExcecao`), `rotuloSlot`, `formatDiaHora`, `LinhaEncontro`, `SolicitacaoNegociacao`.

**Riscos e mitigação:** grade visual divergir da lógica de slots → derivar **só** dos dados já projetados pelo banco (nunca recalcular janelas no cliente); `tests/agenda-especialista.test.ts` estendido para a função pura que posiciona janelas/sessões.

**Aceite:** o especialista vê a semana como grade, com janelas e sessões; editar a grade atualiza a visão sem recarregar a página inteira.

---

### WP5 — Agenda do auxiliar executivo e da coordenação (M) · REALIZA-133 (parcial)

**Objetivo / dor:** o auxiliar precisa ver as duplas dele por turma e consolidadas; a coordenação precisa monitorar **sem agendar por ninguém**.

**Estado atual (verificado):** seletor de cronograma e `resumoSemanaDe` **já por turma**. Falta a visão consolidada para o auxiliar e a explicação do desencontro entre turmas.

**Mudanças**
- **Auxiliar**: abas **"Por turma"** (agrupa T1/T2, com cabeçalho explicando o desencontro) e **"Consolidada"** (lista cronológica única com turma/dupla em cada item). Ações: registrar supervisão, abrir ficha. **Nunca** agendar.
- **Coordenação**: cabeçalho por cronograma mostrando "encontro 8 · T1" e "encontro 5 · T2" na mesma semana; resumo "X de Y" por turma (já correto) com a **explicação visível**; lista **"Para acompanhar"** (sem agendamento ou atrasadas) com **Lembrar** (`NudgeButton`).
- Garantia explícita: nenhum botão "agendar encontro de dupla" para coordenação/auxiliar.

**Por quê:** a regra de ouro do projeto — a dupla agenda; a coordenação monitora e faz nudge.

**Reaproveitar:** `resumoSemanaDe`, `duplasSemEncontroDoNumero` (já filtra por cronograma), `cronogramaVigente`, `NudgeButton`, `chamada-formacao.tsx`, `supervisoes-section.tsx`.

**Riscos e mitigação:** nudge excessivo → D5 (limite de frequência, registrado). Mistura de turmas voltar por regressão → manter e ampliar `tests/ciclo-cronogramas.test.ts` e `ciclo-semana.test.ts`.

**Aceite:** com duas turmas ativas, nenhum número "X de Y" mistura cronogramas; o auxiliar alterna entre por turma e consolidada.

---

### WP6 — Especialistas do jovem (L) · REALIZA-139 + REALIZA-146 (D10 pedido pelo DPP)

**Objetivo / dor:** três conceitos se misturam na cabeça do jovem — **pedir apoio** (chamado), **pedir trilha** (processo) e **agendar sessão** (só dentro de trilha).

**Estado atual (verificado):** `JovemEspecialistas` é uma seção da **home** com convite, pedidos em andamento (`PedidoJovemItem` + `SolicitacaoNegociacao`) e botão "Pedir apoio de um especialista" (`PedirEspecialistaDialog`). O catálogo vem de `jovem_especialistas` (0075).

**Mudanças**
1. **Nova rota `/jovem/especialistas`** (a nav do jovem **continua com 5 itens**). Primeiro **mover** a seção existente para a rota (mesmos componentes) e só depois redesenhar.
2. **Card-CTA vivo na home**: "sessão 3 · sex 16h", "seu pedido está no mural", "em triagem da coordenação" (`aguardando_coord`) ou versão compacta quando não há nada pendente.
3. A página: trilhas ativas com **sessões 1–5 em estados** (feita com registro e ★, agendada, a agendar, trancada — derivados de `encontros` + solicitações) e **stepper do ciclo de vida com datas** no card da trilha (pedido → mural → aceite → em andamento → concluída) + **feed de devolutivas datadas** da trilha (decisão: o especialista posta ao longo da trilha, não só no fim — tabela `devolutivas(dupla_id, autor_id, texto, created_at)` nova, a coluna única `devolutiva_pdm` não comporta; a última entrega segue marcando o encerramento). **Negociação de horário dentro da sessão a agendar** (reusa `SolicitacaoNegociacao`, selecionando **da grade** do especialista — com os slots que batem com a `mentorados.disponibilidade` do jovem **destacados**); pedidos em aberto; link separado "Falar com a coordenação" que abre **chamado** (WP1). ⚠ Verificado: `encontros.numero` é a **tentativa**, não o passo do guia (0074 — reagendamento gera número novo) — "sessão 3" se deriva da contagem de solicitações aceitas/encontros realizados da trilha, não da coluna.
   - **Agendamento nos dois lugares** (decisão): `/jovem/agenda` mantém agendar/reagendar das sessões de trilha (já funciona) e a página ganha a negociação com destaque de compatibilidade — os dois caminhos abrem a **mesma thread** (`SolicitacaoNegociacao`), então não divergem de estado, só de entrada.
4. **Catálogo "cardápio"** (pedido do stakeholder — na prática aprofunda o que a v4 já tinha; a v6 era o catálogo mais pobre):
   - **Card por especialista**: foto+nome (protagonista) → cargo·empresa·cidade → chips de áreas → bio (clamp 3 linhas + `<details>`) → experiência/formação/voluntariado em bloco recolhível → "Atende: seg, qua e sex à tarde" (períodos, nunca slot) → CTA. Campo vazio simplesmente não renderiza.
   - **Uma variante por card**: Sua especialista (CTA "Pedir próxima sessão" — é o mecanismo de pedido ao mesmo par, `dupla_id` pré-vinculado) · Pedido em andamento · Sem vagas (→ "Pedir pro mural", nunca dirigido — pedido dirigido a quem está cheia só ela vê e não pode aceitar) · Agenda não aberta · Disponível ("Prefiro esta pessoa" → sobe pro form com a preferência travada + chip "falta enviar" — marcar preferência não é pedir). O teto 3+3 é regra de página (notice + CTAs desligados), não de card. Catálogo vazio (zero especialistas com papel+escopo): copy honesta "a coordenação está montando a lista", nunca página morta.
   - **Dados** — estender a view `jovem_especialistas` (drop+create, padrão 0074) com `bio`, `cargo`, `empresa`, `cidade`, `uf`, `voluntariado` + `experiencia_previa`/`formacao_externa` via LEFT JOIN `mentor_profiles` + `grade_resumo` (janelas da `especialista_grade` agregadas em períodos manhã/tarde/noite — nunca horário exato) + `vagas` (`capacidade_especialista` − trilhas ativas, derivada; só alimenta o estado, nunca mostra número). Todos self-authored/públicos-internos; a tabela crua segue inacessível (view definer escopada a `mentorado`).
   - **Guardrails anti-"loja de horários"**: períodos sim, slots exatos nunca; sem contador de vagas; verbo "pedir/preferir", nunca "agendar/marcar". `linkedin` **fora** (canal de DM fora da plataforma entre adulto e menor — mesma lógica do whatsapp/e-mail da 0075). `ativo=false` sai do catálogo (a view já filtra). "Pedir mesmo assim" a indisponível não existe — ou broadcast ou dirigido; se quiserem "preferência não-vinculante", é campo novo em `solicitacoes_especialista` (decisão futura).
5. **Pedido registrado pelo DPP** (D10, regra do guia): o mentor vê "Sugerir especialista" na ficha da dupla — registra tema, preferência opcional de especialista e objetivo **em nome do jovem** → o jovem recebe (notificação + card na home/na página) e **confirma ou edita** → só então vira `solicitacao` real (broadcast ou dirigida, mesmos tetos/dedup; `origem='mentor'`). Nunca cria pedido sem o aceite do jovem — a demanda é dele. **Migration concreta** (verificado): `solicitacoes_origem_check` (`('staff','jovem')`) e o CHECK de status precisam de alter — mas o bloqueio real é o **trigger `solicitacao_integridade`** (0074): rejeita `status ∉ ('aberta','aguardando_coord')` no INSERT pra não-coord e torna `demanda/motivo/origem/turma/especialista_desejado_id` **imutáveis** no UPDATE — o "jovem confirma/edita" morreria no trigger, não na policy. Caminho: alterar o trigger (permite edição enquanto `'sugerida'` + regra `origem='mentor'` exige mentor da dupla) + RPC `confirmar_sugestao` definer com GUC `realiza.sol_transicao`. A sugerida não conta nos tetos nem aparece no mural até o jovem confirmar; definir TTL/lembrete único se ele nunca confirmar.
6. Regras reais (C1/C2): teto de 3 trilhas, 3 pedidos abertos, budget de 5 sessões por par, `aguardando_coord` sem dupla DPP.
7. **Especialista**: o mural (`DemandasEspecialista`) já cobre aceitar/contra-propor/recusar; auditar e ajustar só filtros por tema e o estado "já aceito por outro". ◆ **Gap do guia**: a trilha pede uma **avaliação geral final do especialista** (além do registro por sessão e da `devolutiva_pdm` ao mentor) — hoje não existe no schema; decidir se entra nesta rodada ou fica registrado como débito (ver §8).
8. **Coordenação (só leitura)**: painel de trilhas (ativas, prazo, sessões feitas) e alerta de pedido sem aceite há X dias; ação única de exceção = encerramento antecipado (já existe).

**Por quê:** mostra o caminho certo para cada necessidade e elimina o "marcar horário direto com o especialista".

**Reaproveitar:** `JovemEspecialistas`, `PedidoJovemItem`, `SolicitacaoNegociacao`, `PedirEspecialistaDialog`, `jovem-especialista.ts` (`efetivoDe`, `pedidoEmAberto`, `nomeEspDoPedido`), `DemandasEspecialista`, `TrilhaJornada`, `EncerrarTrilhaDialog`.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Quebrar os specs `jovem-especialista.spec.ts` e `solicitacao-esp.spec.ts` | Mover primeiro; atualizar specs no mesmo PR; manter textos/roles estáveis nos seletores |
| Jovem não achar mais a tela (saiu da home) | Card-CTA persistente na home + atalho no "Início" |
| Desenhar estados que o dado não suporta | Estados derivados só de `solicitacoes_especialista`/`encontros` reais; cada estado do mock mapeado a uma consulta antes de implementar |
| Expor slots a quem não tem trilha | Catálogo só mostra períodos; slots só dentro da sessão a agendar |

**Aceite:** é impossível marcar horário com um especialista sem pedido aceito; cada um dos três conceitos tem lugar próprio; a nav não ganhou item.

---

### WP7 — Materiais como jornada do jovem (L) · REALIZA-140

**Objetivo / dor:** o jovem não sabe o que fazer em cada fase; os instrumentos ficam atrás de links soltos.

**Estado atual (verificado):** `/jovem/materiais` é lista plana agrupada por encontro/tipo (`getMateriais`). `instrumentos_da_dupla` (0080) é legível pelo próprio jovem **e já devolve o token** do link vivo, mas não é usado na área dele.

**Mudanças**
- **Hub** no topo: "Minha jornada" — base **v3 narrativa** (o que ganhou pra ele: gramática única de estações, entregas como **recibos** com data e a caligrafia do jovem, eixo cronológico vs. portais abstratos), com a semântica da v4. O mock v3 mapeia instrumentos **errado** (autoavaliação do enc. 8 é instrumento do mentor, não do jovem; Roda no enc. 2 quando a real é enc. 1; "PDM construído no enc. 6") — a trilha deriva do guia/`ciclo_eventos`, não do mock.
  - **Marcos canônicos** (7 estações, janelas do roteiro oficial do guia): Roda da Vida · leitura inicial (jovem **preenche no onboarding/trilha preparatória**, mentor lê e conversa no enc. 1) → Construindo a Visão (jovem faz **sozinho entre enc. 1–2** e traz a Declaração pro enc. 2) → Metas SMART (definidas sozinho entre enc. 2–3, **apresentação e checagem no enc. 3**; submetas desdobradas até o enc. 4) → PDM — documento vivo (do enc. 1 ao 4 — a abertura é no 1º encontro; revisão de meio de percurso no enc. 9; estado "N metas · X de Y submetas") → Avaliação do encontro (recorrente, os dois lados: "em dia · X de Y", nunca "fecha") → Roda da Vida · aplicação formal (enc. 12–14) → Avaliação 360º (**última atividade** — mês 6 / evento de encerramento; coord emite; bandeira terminal fecha a trilha). **Anamnese fora** — instrumento externo por decisão (C10). **Avaliação por terceiros fora** — o fluxo é todo do mentor fora da plataforma (decisão do stakeholder): não vira estação, não aparece na jornada.
  - **Backing por estação** (verificado — `INSTRUMENTOS_SISTEMA` = visao/metas/pdm/roda_vida): Visão, Metas, PDM e Roda têm instrumento nativo; avaliação do encontro vem de `avaliacao_jovem`; 360º existe como form `sistema`.
  - **Anatomia da estação**: eyebrow "Estação N · encontro X" + título + pill de estado (a fazer / em andamento* / feito / "abre no enc. N") + carimbo "Respondido em {data real}" + 1 linha de descrição + snippet **"você escreveu…"** quando há campo citável (`respostas` vem na RPC) + **uma ação honesta** por estado: feito → "Rever resposta"; em andamento (link vigente) → "Continuar" → `/f/<token>`; a fazer sem link → texto "o mentor envia quando chegar a hora" (**nunca botão de emitir** — o jovem não emite, 0080); trancado → texto "libera no enc. N ({data da turma dela})", sem falso botão. *"em andamento" = rascunho em `localStorage`, mesmo dispositivo — dizê-lo no card. Na avaliação do encontro o controle "você escolhe se o André lê" permanece (o toggle já é dela) — sem banner genérico de escopo: o aviso "Quem vê" era material de demo, não produto.
  - **Anti-extensão mobile** (o que derrubou a v3 no júri): hero slim de 1 card (turma · enc. N de 16 + fase real de `ciclo_eventos.fase` + "4 de 7 entregas" + próxima parada com nome+data); estações futuras num `<details>` "Daqui pra frente · N estações" com **nomes+datas no summary**; sub-nav sticky Jornada·Acervo (âncora pro acervo, `scroll-margin-top`); sem scroll-snap; Acervo intacto abaixo (linhas ≥44px, badge "em breve" quando sem arquivo, microcopy "não conta no progresso").
  - **Datas sempre do cronograma DELA** (cada turma tem calendário próprio — T2 corre ~3 semanas depois com semanas de encontro duplo na quinta, C9); derivar só de `tipo='encontro'` (recesso não é marco).
- **Links de instrumento sem expiração**: verificado — `emitir_link_instrumento` (0080) **já** nasce com `expira_em` nulo; só o caminho genérico `/formularios` (`gerarLinksFormulario`) seta validade. Fechar esse caminho pros 4 instrumentos `sistema` (ou garantir que nunca passe por ele) — o gate de identidade (0070) segue protegendo o submit.
- Faixa "falta avaliar o encontro X" reaproveitando o dado de avaliação pendente — **sem prazo inventado** ("fecha sexta às 23h59" não existe no domínio; copy honesta: "responda quando puder").
- **Acervo de apoio** (a biblioteca atual) abaixo, **inalterado**.
- **Mentor DPP**: estender `InstrumentosDupla` com encontro-alvo, estado e card "como conduzir" (conteúdo de apoio). "Preencher junto agora" fica para depois (D8).
- **Coordenação**: painel de progresso por instrumento e por turma **em `/materiais`** (junto da biblioteca que ela gerencia), mantendo o upload; **não preenche pelo jovem**.
- **Auxiliar executivo**: apenas o estado nas duplas dele (sem conteúdo).

**Por quê:** dá percurso ao jovem ("onde estou, o que vem") e ao mentor ("o que entregar agora"), e traz o dado de volta para a plataforma em vez de documento solto.

**Reaproveitar:** `getMateriais`, `InstrumentosDupla`, `estadoAtual()`, `INSTRUMENTO_INFO`, `instrumentos_da_dupla`, `CopiarLink`, `jovem-avaliacoes.tsx`.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Regressão na biblioteca atual | Intacta como "Acervo"; se o RPC falhar ou vier vazio, a página se comporta como hoje |
| Expor conteúdo de menores além do definido | Visibilidade de conteúdo segue D1; auxiliar só recebe estado (RPC separada, sem `respostas`) |
| Fases inventadas serem tratadas como do guia | Rotular como "proposta de organização" nas notas; só usar o que `ciclo_eventos.instrumentos` já define |
| Caio (T2) e Ana (T1) com estados diferentes | Estado calculado **por dupla/cronograma**, nunca global |

**Aceite:** Ana (encontro 8) e Caio (encontro 5) veem estados diferentes e coerentes com o guia; o jovem abre um instrumento pendente em um toque.

---

### WP8 — Instrumentos (XL, em duas fases) · REALIZA-141 a 144

**Objetivo / dor:** Roda e Metas hoje são formulários; o guia pede percurso, comparação e documento vivo.

#### Fase A — dentro do modelo atual (M)

- **Roda da Vida**: fluxo passo a passo por quadrante (4 passos + resultado), progresso, **controles verdes**, título separado dos controles, rótulos completos no desktop. Reusar `roda-svg.tsx` e `roda-vida.tsx`.
- **Duas aplicações** (inicial e formal) com **overlay antes/depois**: guardar o "momento" da aplicação (`contexto` do link — 0080 já usa `contexto.origem`). Verificado: `instrumentos_da_dupla` já devolve `entregas` como `jsonb_agg` de **todos** os links por instrumento — N aplicações cabem; basta projetar `contexto`/`created_at` por entrega pra separar inicial × formal.
- **Metas**: ordem = prioridade (reordenável, com botões subir/descer acessíveis além do arrastar), `prazo_alvo` e "atingida em"; **remover a pergunta separada de meta principal**; avisos de limite conforme D3. Metas atingidas alimentam a retrospectiva do encerramento (`resumo-jornada.tsx`). **Decisão: edição pós-submit entra** — metas são documento vivo; construir "editar resposta" via RPC definer nova (o submit é one-shot por `unique link_id` e `formulario_respostas` é coord-only — edição = update na resposta com `editado_em`; não re-emite `formulario_respondido` nem re-carimba checklist 360; revalidar contra `campos` pra não reescrever payload; auditar se fica restrita a metas).
- **Construindo a Visão**: wizard de **5 perguntas** reflexivas → Declaração de Visão (verbo no futuro + prazo) que alimenta o PDM — o deck oficial e o form `visao` da 0080 têm 5 `texto_longo` + `declaracao_visao`, não 6. O `visao.tsx` atual é página única deliberadamente sem passos — reusar o passo-a-passo da Roda como casca.

#### Fase B — documento vivo (XL)

- Entidade `pdm_itens` com `parent_id` (árvore recursiva de submetas, ~20 no total), conforme `docs/planos/atividades-interativas.md` — **decisão de domínio já fechada pela Kelyng** (REALIZA-142: "uma submeta pode ter submetas", caso real do Daniel com 5+ por meta; a alternativa de lista plana foi considerada na revisão de escopo e rejeitada por contrariar essa decisão). UI com indentação leve + collapse, sem espiral de níveis. Decidir D3 e D6 antes. **Não misturar com a Fase A.**

**Por quê:** A entrega valor imediato e baixo risco; B resolve o PDM como documento vivo, que é o ponto mais pedido pela equipe.

**Reaproveitar:** engine de forms (`schema.ts`, `use-resposta.ts`, `campos.tsx`), `instrumento-resultado.tsx`, `agrupaEmSecoes`, `extraiGruposMeta`, `roda-svg.tsx`.

**Riscos e mitigação**
| Risco | Mitigação |
|---|---|
| Mudar o schema de campos quebrar respostas já gravadas | Campos novos **aditivos** (ids estáveis `meta_N`, `is_N`, `prazo_N`); leitura tolerante de respostas antigas; testes em `tests/instrumentos.test.ts` com fixtures reais |
| Dados de menores (eixos íntimos da Roda) | D1 decidida antes; leitura por RPC escopada; auditoria `formulario_respondido` mantida |
| Árvore de submetas complexa na UI | Recolhida por padrão, 2 níveis visíveis + "ver mais", contador "14 de 20" |
| Limite duro frustrar o uso | Aviso suave antes do teto (D3) |
| Conflito com `pdm_url` externo | D6; manter o campo como rota de fuga até a Fase B estabilizar |

**Aceite (A):** Roda funciona em passos e mostra antes/depois; reordenar metas muda a prioridade e persiste; o wizard da Visão gera Declaração que alimenta o PDM; respostas antigas continuam legíveis.

---

### WP9 — Transversal (acompanha cada pacote) · REALIZA-137 a 138

- **Demo**: dataset e queries por papel atualizados a cada pacote; ações mutáveis → mensagem de demo. Estrutural: `demoRole()`/`personas: Record<AppRole>` são papel único — o híbrido exige persona com `papeis[]` (6ª persona ou papel multi); o stub devolve `[]` pra tabela desconhecida → cada tabela nova (`chamados`, `profile_papeis`…) precisa de caso no `client-stub`, senão renderiza vazio silencioso.
- **Fixtures e2e**: hoje não existe **supervisor/auxiliar com auth** nem **híbrido** — os aceites "auxiliar não vê duplas fora das suas", "auxiliar não assume plataforma", "híbrido vê os dois mundos" precisam de fixtures novas em `seed-e2e-staging.mjs` antes dos WPs que as exigem.
- **Testes**: Vitest para regras novas; e2e por papel nos previews.
- **Limpeza**: remover a linha do mockup do registry quando a tela real fecha; ao final, `public/demo/mockups/` e o menu "Layouts em teste" podem sair (decisão REALIZA-138).
- **Segurança**: manter CSP global; a exceção de iframe continua só em `/demo/mockups`.
- **Documentação**: atualizar `AGENTS.md` (seções Domínio e Modo demo) quando chamados e as novas telas entrarem.

---

## 6. Telas e fluxos principais

Visão consolidada por tela — o que cada papel vê e quais ações executa. Detalhes de dados e risco ficam nos WPs indicados; esta seção é o mapa de "como fica" pra revisar com a equipe.

### `/agenda` — cinco visões numa rota (WP3 · WP4 · WP5)

**Mentor DPP** — duas abas:
- *Minha agenda*: cronológico Hoje / Amanhã / Próximos; chips de escopo (Ana · Caio · Eu · Tudo); rail "Esta semana"; previstos tracejados "a agendar"; pendências próprias (registro, avaliação) como faixa no topo de Hoje; item de especialista marcado "agenda da Ana — você não participa", sem botão de entrar; semana/mês continuam como visões alternativas.
- *Por mentorado* (só com 2+ duplas): card por jovem — turma, barra "encontro N de 16 · Tx", próximo encontro, pendências da dupla e a trilha com o especialista em modo "você acompanha" (progresso, "registro entregue", ★ do jovem — via RPC `trilha_do_jovem`, D2).
- Fluxos: agendar/reagendar encontro da dupla; entrar na chamada; preencher registro; avaliar encontro; nudge no jovem; alternar semana/mês.

**Mentor especialista** — grade visual semanal (dias × horas, eixo configurável, mín. 8h–20h) com janelas oferecidas, sessões posicionadas e slots livres, derivada dos mesmos dados da projeção atual; cards por trilha (prazo, sessão x de 5, registro/avaliação).
- Fluxos: editar grade e exceções; aceitar / contra-propor / recusar proposta de horário; registrar sessão; propor outro horário; encerrar trilha (exceção).

**Auxiliar executivo** — abas "Por turma" (T1/T2, cabeçalho explica o desencontro) e "Consolidada" (lista única, turma/dupla em cada item).
- Fluxos: registrar supervisão; abrir ficha. Nunca agenda.

**Coordenação** — calendário oficial por cronograma; "encontro N · Tx" por turma na mesma semana com a explicação visível do desencontro; resumo "X de Y" por turma; lista "Para acompanhar" (sem agendamento / atrasadas) com Lembrar; chamada da formação.
- Fluxos: monitorar, nudge, chamada — nunca agendar por dupla.

**Mentorado** (`/jovem/agenda`, já unificada hoje) — lista cronológica rotulada por mentor (DPP + especialista); o "escolher horário" da sessão cai no fluxo do WP6.
- Fluxos: agendar/reagendar com motivo; "não aconteceu"; avaliar ★; ver combinados.

> **Mentor híbrido** (DPP + especialista na mesma pessoa — papel por programa, WP0b): um único calendário com os encontros das duplas DPP **e** as sessões das trilhas; home com os dois mundos; `/duplas` mostra duplas DPP e trilhas juntos; mural de demandas acessível; nav resolve por `has_papel` (união dos papéis, sem seletor de identidade). Regra de remarcação oficial: **reposição na mesma semana**.

### `/duplas` — categorias no topo + lista (WP2)

- **Coordenação**: faixa **segmentada** de categorias (um container, células com dot+contagem na linha 1 e régua na linha 2; Apoio separada por divisória) filtrando a lista plana em container único com cabeçalho de colunas; linha = link pra ficha com pill semáforo (+pill "Apoio" quando houver), meta com recência e supervisora, barra feito × esperado, sinais em texto + linha de contexto, coluna avaliação do mentor e "Lembrar" quando há pendência; ordenação apoio → risco → atenção → andamento → pausada com a massa saudável atrás de linha-disclosure; toolbar de busca + filtros por turma/mentor/auxiliar, Nova dupla, importar/exportar CSV.
- **Auxiliar executivo**: só as supervisionadas, agrupadas por turma, com "registrar supervisão".
- **Mentor DPP**: "Minhas duplas" — cards enxutos (semáforo, próximo passo, pendências).
- **Mentor especialista**: trilhas com progresso x de 5 e prazo.
- Fluxos: filtrar por categoria (card com a régua); buscar/ordenar; do card de apoio, abrir o chamado (WP1); abrir ficha; criar/editar dupla, importar, exportar (coord); registrar supervisão (aux).

### `/chamados` — fila + thread (WP1)

- **Coordenação**: master-detail no desktop, inbox + detalhe em página cheia no mobile; filas Todos / Sem dono / Atribuídos a mim; filtros por categoria e status; busca; indicador "mais antigo sem dono há X"; vermelho só enquanto aberto sem dono.
- **Auxiliar executivo**: lê todos passivamente; age só nos não-técnicos; `plataforma` aparece bloqueado "só coordenação".
- **Mentor DPP / especialista**: card "Meus chamados" na home (lista + contagem) → detalhe com timeline pública.
- **Mentorado**: "Meus chamados" dentro do Perfil; abertura com opções na linguagem dele + **"É urgente"** sempre visível.
- Fluxos: abrir chamado (categorias por papel; `outro` exige descrição) — ou automático a partir do flag do registro e da avaliação do encontro; assumir ("quem assumir primeiro trata"); atribuir / devolver à fila; comentar interno (default) × publicar atualização; anexar; @mencionar; resolver; reabrir. O autor acompanha a timeline pública sem ver o interno; origem jovem/urgência também dispara e-mail redundante.

### `/jovem/especialistas` — página nova, nav intocada (WP6)

- **Mentorado**: home ganha card-CTA vivo ("sessão 3 · sex 16h" / "seu pedido está no mural" / compacto quando nada pendente); a página tem trilhas ativas com sessões 1–5 em estados + stepper do ciclo de vida com datas (pedido → mural → aceite → em andamento → concluída + devolutiva); negociação **dentro** da sessão a agendar, escolhendo da grade do especialista com os slots que batem com a disponibilidade do jovem destacados; pedidos em aberto; **catálogo "cardápio"** — card completo por especialista (foto, cargo·empresa·cidade, chips de áreas, bio em clamp, experiência/formação recolhíveis, "Atende: …" em períodos, vagas derivadas mas nunca exibidas) com uma variante por card (sua especialista / pedido em andamento / sem vagas → mural / agenda fechada / disponível); "Falar com a coordenação" → chamado (WP1).
- Fluxos: pedir trilha (tema, preferência opcional de especialista, objetivo — visível enquanto trilhas ativas + pedidos abertos < 3; notice + CTAs desligados no teto) **ou confirmar um pedido que o mentor DPP registrou em seu nome** (D10 — chega como sugestão, jovem confirma/edita e vira solicitação real); aceitar ou contra-propor horário na sessão; remarcar; acompanhar pedido no mural; abrir chamado.
- **Mentor DPP**: "Sugerir especialista" na ficha da dupla → registra tema/preferência/objetivo em nome do jovem; acompanha o pedido como sugestão até o jovem confirmar.
- **Especialista** (mural, ajuste fino): filtros por tema e estado "já aceito por outro"; aceite atômico / contra-propor / recusar.
- **Coordenação**: painel só-leitura de trilhas (ativas, prazo, sessões feitas) + alerta de pedido sem aceite há X dias; única ação de exceção = encerramento antecipado.

### `/jovem/materiais` — hub da jornada (WP7)

- **Mentorado**: "Minha jornada" **narrativa** (v3) — trilha de estações do guia (Roda inicial → Visão → Metas → PDM vivo → avaliação do encontro → Roda formal → 360º; janelas e datas sempre do cronograma dela), cada estação com carimbo "respondido em", snippet **"você escreveu…"**, estado honesto (a fazer / em andamento\* / feito / "abre no enc. N" — \*sinal do rascunho local, só mesmo dispositivo) e **uma ação honesta** por estado (jovem nunca emite link); hero slim com fase real e próxima parada; estações futuras em `<details>` com nomes+datas no summary; sub-nav sticky Jornada·Acervo; faixa "falta avaliar o encontro X"; Acervo de apoio inalterado.
- Fluxos: abrir/continuar instrumento pelo próprio link (sem expiração); responder avaliação pendente; baixar/abrir material do acervo.
- **Mentor DPP**: `InstrumentosDupla` estendido — encontro-alvo, estado, card "como conduzir", enviar link.
- **Coordenação**: painel de progresso por instrumento e por turma em `/materiais` + biblioteca com upload; não preenche pelo jovem.
- **Auxiliar executivo**: lê o conteúdo dos instrumentos das duplas dele (D1 — igual coord/DPP).

### `/f/<token>` — instrumentos (WP8-A)

- **Roda da Vida**: fluxo de 4 passos (um por quadrante) + resultado; radar de 16 eixos com controles verdes e rótulos completos no desktop; duas aplicações com overlay antes/depois.
- **Metas / PDM**: lista reordenável (arraste + botões subir/descer acessíveis) — a ordem é a prioridade; indicador SMART, `prazo_alvo`, "atingida em"; aviso suave a partir de 3 metas, teto 10. Árvore de submetas só na Fase B.
- **Construindo a Visão**: wizard de 5 perguntas reflexivas → Declaração de Visão (verbo no futuro + prazo) que alimenta o PDM.
- Fluxos (jovem logado ou via link): preencher por passos com rascunho local; enviar; ver resultado. Mentor DPP, coordenação e auxiliar leem o conteúdo conforme D1.

---

## 7. Mapa de esforço e risco

| Pacote | Esforço | Risco de regressão | Depende de |
|---|---|---|---|
| ~~WP0 aviso de escopo~~ | — | — | cortado — era material de demo, não produto |
| WP0b papéis/híbrido | L | **Alto** (RLS/nav transversais) | D9 |
| WP1 chamados | XL | Médio-alto (dados + RLS) | D4 |
| WP2 duplas/semáforo | L | **Alto** (domínio compartilhado, IA) | WP1 (parte) |
| WP3 agenda DPP | L | Médio (privacidade) | D2 |
| WP4 agenda especialista | M | Baixo | D7 |
| WP5 agenda coord/aux. | M | Baixo-médio | D5 |
| WP6 especialistas do jovem | L | Médio (e2e existentes) | — |
| WP7 materiais/jornada | L | Médio | D1 |
| WP8-A instrumentos | M | Médio | D1, D3 |
| WP8-B PDM vivo | XL | Alto | D1, D3, D6 |

---

## 8. Auditoria executada (out/2026) — fatos verificados no código

Itens abaixo foram conferidos contra migrations e `src/` no fechamento do plano. Decisões de produto estão marcadas **fechada**.

**WP0b — papéis**
- **`my_role()`: 55 migrations** confirmadas; ~30 arquivos TS com `.role` (nav `roles:` em `app-shell.tsx`, guards em `(app)/layout.tsx`/`agenda/page.tsx`/`(jovem)/jovem/layout.tsx`, page-guards, `demoRole()`, queries/actions, `lib/ia/`, `lib/remanejo.ts`, `lib/fila.ts`, API `/api/export`). Migrar por fluxo, cada um migra ou justifica ficar no primário.
- **Sync do primário**: trigger `profile_papeis → profiles.role` ou write-path único — regra determinística de desempate + `handle_new_user`/pré-cadastro/`/pessoas` gerando a linha de papel.

**WP1 — chamados**
- **E-mail redundante do apoio do jovem**: verificado — `submeter_avaliacao` (RPC, 0071) devolve `destinatarios` e `actions-avaliacao.ts:172` dispara `enviarEmailsLote` + template `emailApoioJovem` + log `emails_enviados`. O chamado de urgência reutiliza esse mesmo padrão.
- **`resolverApoio`**: `actions.ts:3031` (coord-only). Guard "só coord limpa" em `avaliacoes_encontro.pedir_apoio` = trigger na 0071:110; `registros.precisa_apoio` = `guard_registro_apoio` (0004). Resolver chamado limpa flag via bypass GUC na mesma transição.
- **`avaliacoes_encontro` idempotência**: confirmado — `encontro_id unique` (0071), write-path único `submeter_avaliacao`; flag vive lá, não em `encontros`.

**WP2 — duplas/semáforo**
- **Camada de IA**: `saudadeDaDupla` tem 3 call sites em `lib/ia/tools.ts` (radar ordenado por `semaforoOrd`) + projeção `IA_SAUDE_SELECT` em `lib/ia/queries.ts:48` — contrato de campos documentado; se `sinais[]` mudar a forma do retorno, os dois arquivos migram juntos.
- **`sinais[]`**: todos mapeados a cálculo existente (atraso, pendência, limbo — `ciclo.ts`, estagnação, avaliação baixa, dificuldade, combinado vencido) — nenhum conceito inventado.

**WP6 — especialistas**
- **Mural** (`demandas-especialista.tsx`, 168 linhas): só `emAberto`/`aceitas`/`praMim`/`negociando` — **filtro por tema e estado "aceito por outro" não existem** → construir no WP6.
- **`pedir_especialista_jovem`** (0074:338): dedup (1 aberto por par alvo), teto de abertos e teto de 3 trilhas **já existem** — a `'sugerida'` entra sem contar nesses contadores. `solicitacoes_origem_check`=('staff','jovem') + trigger `solicitacao_integridade` são os pontos de alter.
- **"Sessão N"**: `encontros.numero` é tentativa — derivar o passo da contagem de aceites/realizados.

**WP7 — jornada**
- **`expira_em`**: verificado — `emitir_link_instrumento` já nasce nulo; só garantir que os 4 sistemas nunca passem pelo `gerarLinksFormulario` genérico.
- **Avaliação por terceiros**: fechada — **fora da jornada** (decisão do stakeholder): o fluxo é inteiro do mentor fora da plataforma, não vira estação nem nó.
- **Roteiros "Semana N"**: os cartões oficiais por encontro existem (PDFs) — cadastrar no Acervo por `encontro_num` como conteúdo oficial, não inventar.
- **360º**: fechada — é a **última atividade** (enc. 16/evento de encerramento, terminal).
- **Devolutiva**: fechada — **feed de várias entradas datadas por trilha** — tabela nova `devolutivas(dupla_id, autor_id, texto, created_at)` + RPC/view por papel; stepper da trilha e card do jovem mostram em ordem.
- **Avaliação geral do especialista**: **backlog** (BACKLOG.md + REALIZA-147) — fora desta rodada.

**WP8 — instrumentos**
- **Momento da aplicação da Roda**: `formulario_links.contexto` (já existe `contexto.origem`) — projetar `contexto`/`created_at` por entrega na RPC (`entregas` já agrega N links).
- **Edição pós-submit**: verificado — grant de update existe (0036:108) mas **a única policy é `formulario_respostas_coord for all`** — não há caminho de edição pro autor hoje; exige RPC definer `editar_resposta` com validação contra o schema do form + `editado_em`.

## 9. Referências

- `docs/mockups/_brief-final.md` — dataset canônico, regras de domínio e composição por tela.
- `docs/mockups/RELATORIO.md` — comparativo das 3 rodadas.
- `docs/planos/ux-revisao-chamados.md` — decisões de chamados, agenda por papel e metas.
- `docs/planos/atividades-interativas.md` — catálogo dos instrumentos e proposta de PDM vivo.
- `docs/planos/mentorado-na-plataforma.md` — RLS do jovem (RPC `definer` em vez de ramo de policy).
- `docs/planos/turmas-cronogramas.md`, `docs/planos/navegacao-turmas.md` — turmas e cronogramas.
- Guias oficiais do programa (PDFs): Guia do Mentor DPP (roteiro dos 16 encontros, modalidades, papéis), Guia do Mentor Especialista (5 encontros, fluxo de contato), cronogramas T1/T2, "Novos sistemas Realiza" (decisões de produto: perfil por programa, anamnese externa, devolutivas múltiplas).

---
## WP6 — fechado (PR #60 · merge 508a314)

**Migrations (todas em staging E produção):**
- `0086` — `origem='mentor'` + `status='sugerida'` no integrity trigger (sugerida só com origem mentor e autor=DPP da dupla; UPDATE libera demanda/motivo/alvo enquanto sugerida); RPCs `sugerir_especialista_mentor`/`confirmar_sugestao_especialista`/`dispensar_sugestao_especialista`/`postar_devolutiva`; tabela `devolutivas`; view `jovem_especialistas` rica (bio/cargo/empresa/cidade/uf/voluntariado/experiencia_previa/formacao_externa/grade_resumo "seg à tarde"/vagas, has_papel na turma, DPP da própria dupla excluído); `notificacoes_tipo_check` +sugestao_especialista/devolutiva_especialista.
- `0087` — híbrido age como especialista: `has_papel` no lugar de `my_role()` em `sol_select`, `solicitacoes_mural`, policies de `especialista_grade`/`especialista_excecoes`, `pedir_especialista_jovem`, `aceitar_solicitacao`, `recusar_solicitacao`, `contra_propor_solicitacao`, `sol_coords`.
- `0088` — view definer `jovem_trilha_esp` (5 passos do guia pro jovem; a tabela `especialista_eventos` não abre pro papel).
- `0089` — fix: `devolutivas_select` consultava `duplas` cru (RLS do invoker → feed vazio pro mentorado); passou a usar a view definer `jovem_duplas` — mesmo padrão do fix da 0068.

**Frontend:**
- `/jovem/especialistas` (rota nova + 6º item do shell com Sparkle): cardápio rico, card de sugestão (confirmar/edita/dispensa), trilhas com stepper dos 5 passos (`passoEsp`/`encontroDoPassoEsp` — rank por tentativa, sem depender de `registro`) + feed datado de devolutivas, mesa de pedidos em aberto.
- Home `/jovem`: banner de sugestão pendente + link pra página.
- Ficha DPP: menu Mais → "Sugerir especialista pro jovem" (some com sugestão pendente); chip da ficha ganha o caso `sugerida` ("Sugestão com o jovem").
- Ficha da trilha esp: seção "Devolutivas da trilha" (feed + `DevolutivaComposer` pro especialista enquanto aberta).
- `getEspecialistas` (staff) inclui híbridos via `profile_papeis`.

**Gates:** tsc 0 · eslint limpo · vitest 530 · build ok · schema-contract 0 avisos · e2e demo 25/25 · e2e app WP6 4/4 no preview (sugestão→confirma dirigida com asserts de banco+sino, dispensa→cancelada, devolutiva→feed, híbrido no catálogo).

**Jira:** REALIZA-139 e REALIZA-146 → Concluído.

**Débito conhecido:** a sugestão não rende Card-CTA na home do jovem além do banner (o CTA completo com sessão N/mural ficou no mínimo da página própria); roteamento de superfície do híbrido (qual home ele cai) fica pro WP3.

## WP6b — mentor híbrido fechado (PR #61 · merge 071cc7b)

Edge case coberto de ponta a ponta: mentor com `mentor_dpp` **e** `mentor_especialista` em `profile_papeis`. O roteamento por `role` primário tornava o segundo papel invisível — o híbrido DPP-primário não recebia pedidos dirigidos, não editava a grade e não entrava nos pools da trilha esp. Fundação: `getMe` carrega `papeis` via `my_papeis()`; `temPapel(p, papel)` decide gates por papel efetivo (primário ∪ `papeis`); papéis efetivos propagados por `profile_papeis(papel)` embed em `getPessoas`/`getPessoaPerfil`/export/IA.

**Migration `0090` (staging E produção):** `has_papel` em `notificacoes_insert` (destinatário de `demanda_especialista` + autor dos pings esp), `comunicados_select`, `materiais_select`/storage, `especialista_avaliacoes`, `rematch_dupla`, `emitir_link_instrumento` e policies de `especialista_grade`/`especialista_excecoes` da 0073; `avaliacoes_select` restrita a `trilha='dpp'` (o ramo DPP não lê integral de trilha esp — privacidade); **bugfix `abrir_chamado`** (`d.especialista_id` não existia → 42703 pra qualquer não-mentorado com `p_dupla_id` — bug geral em prod, não só híbrido).

**Frontend:**
- Home: `DemandasEspecialista` + `getSolicitacoesVisiveis`/`getSlotsLivres` montam quando `temPapel(esp)` — o pedido dirigido ao híbrido agora tem superfície pra responder; negociação passa `papel` contextual da trilha.
- `/agenda`: abas `?visao=dpp|especialista` (decisão de produto registrada) — o híbrido edita a grade/exceções da trilha esp; `/duplas`: visão `hibrido` com seções por trilha (cada card na régua da própria).
- Criar/editar dupla: **select explícito de trilha** quando o mentor escolhido é híbrido (trilha nunca mais derivada do primário; `createDupla`/`updateDupla` recebem `trilha` opcional).
- Capacidade por trilha: `capacidade` (DPP) × `capacidade_especialista` (esp) — pools independentes, contagem `${mentor}:${trilha}` em fila/remanejo/matching/`/pessoas`/export/tools da IA; edição de pessoa expõe as duas pools pro híbrido (`updatePessoa` grava as duas); `mentor_profiles.tipo` segue o **primário** (pool secundária não inverte o tipo).
- Swap mecânico restante dos gates `me.role ===` "é mentor" → `temPapel` (nav, onboarding, perfil, materiais, agenda, `pessoa-actions`, fan-outs de `actions-especialista` via `profile_papeis!inner`).

**Demo:** stub corrigido — `resolveEmbed` só devolve to-one quando a linha alvo **existe**; senão cai no ramo to-many (um `user_id` no pai engolia `profile_papeis(papel)` → pool de remanejo vazio — regressão pega pela suite); `demoMe`/gates demo espelham `has_papel` e a restrição por trilha de `avaliacoes_select`.

**Gates:** tsc 0 · eslint limpo · vitest 532 (fixtures migradas pra chave `${id}:${trilha}` + casos híbridos novos em `fila`/`remanejo`) · build ok · e2e demo **28/28** incluindo `hibrido.spec.ts` novo (mural na home DPP, abas da agenda, seções por trilha em `/duplas`) · **e2e app no preview: tudo verde (12m32s)**.

**Jira:** REALIZA-148, REALIZA-149 e REALIZA-150 → Concluído.

**Débito conhecido:** a fixture `hib-e2e` do staging tem híbrido completo mas ainda não há spec app que logue **como** ele (demo cobre o caminho DPP-primário; o caminho esp-primário+DPP depende de fixture logada); redesign visual da home do mentor segue no WP3.

## WP6b review follow-up — fechado (PR #62 · merge 99651c3)

Revisão multi-agent do merge anterior (3 revisores paralelos: DB, lib/actions, UI/demo) achou a mesma classe de bug fora do recorte + bugs reais de UI; todos os ALTAs/MEDIAs corrigidos.

**Migration `0091` (staging E produção):** `rematch_dupla` valida papel **com escopo da turma**; destinatários/autores de `notificacoes_insert`, fila de chamados (`eh_equipe`/`chamado_visivel_equipe`/`chamado_notifica_equipe`), `supervisoes_insert`, `documentos_storage_select_curriculo`, `pessoa_notas_insert`, `comunicados_*`, `materiais_*` → `has_papel` (coord/supervisor/mentorado **secundários** agora agem e recebem — superset seguro, `has_papel ⊇ role`); `abrir_chamado` com revoke PUBLIC/anon.

**App:** aba "Ciclo DPP" inalcançável pro híbrido esp-primário (href sem `?visao=`); `CapacidadeMentorDialog` sem `trilha` escrevia a pool errada (nova-dupla, remanejo-sugerido); "(atual)" no editar podia migrar trilha da dupla; trilha por papel efetivo nos dialogs; `/pessoas/[id]` com stats por trilha; `me()` das actions carrega `papeis`; `setPessoaRole` preserva `mentor_profiles` quando papel mentor secundário sobrevive; `updateDupla` confere capacidade na troca de trilha; e-mail por audiência via `profile_papeis!inner`+dedupe; tools IA por `my_papeis()`; import CSV com coluna `trilha` (obrigatória pra híbrido); `!inner` dedupe; demo/stub com `papeis` em `demoPessoas` + to-one pendurado→`null`; export `tipo` une papéis.

**Gates:** tsc 0 · eslint limpo · vitest 532 · build ok · schema-contract 0 · e2e demo **29/29** (spec híbrida ampliada: href `?visao=dpp`, ida/volta, `?visao=` inválido) · **e2e app no preview: verde (7m55s)**.

**Decisão registrada:** supervisor/coord/mentorado como papel secundário é suportado — `has_papel` decide (0091), não o primário.
