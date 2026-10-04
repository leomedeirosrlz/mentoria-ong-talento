# Navegação multi-turma — brainstorm de IA/UX

**Pergunta que este doc responde:** quando existirem N programas × turmas × cronogramas, como as telas da coordenação (e dos demais papéis) se reorganizam — especialmente "separar melhor as telas de turmas diferentes" e "separar melhor as pessoas na aba de pessoas".

**Fontes:** ata da reunião (`analise-transcricao-mentor.md` §3 e §7 — "Programa → Turmas → Cronogramas → Duplas"; turma atual de 30 alunos já roda 2 cronogramas fora do sistema), `_contexto.md`, código em `src/`.

**Vocabulário (alinhar antes de modelar telas):** hoje `duplas.ciclo` e `ciclo_eventos.ciclo` (text, default `'2026/2027'` — `migrations/0001_init.sql:44,57`) são, na hierarquia da ata, o **cronograma**: o calendário que uma dupla segue. "Turma" ainda não existe como entidade — é o grupo de pessoas+duplas que compartilha uma edição do programa. O doc usa *turma* pra entidade navegável e *cronograma* pro calendário (≈ `ciclo` no schema atual). Se a operação tratar "cronograma" como coisa de primeiro nível (matching separado por cronograma, formação separada), o nível navegável pode descer — ver perguntas abertas.

---

## 1. Diagnóstico — a IA hoje é mono-ciclo por acidente, não por desenho

### 1.1 Mapa de rotas × papel

| Rota | Arquivo | Quem vê | O que mostra |
|---|---|---|---|
| `/` | `(app)/(home)/page.tsx` | todos | coord → `DashboardCoordenacao` (stats, radar de duplas, "Semana do Nº encontro", resumo da semana, rail com avisos+mural de especialista); supervisor → mesmo componente com `supervisor` flag + seção de supervisões; mentor DPP → `MentorHome`; especialista → `MentorHome` + `DemandasEspecialista` |
| `/duplas` | `duplas/page.tsx` | coord (todas), supervisor/mentor (escopo RLS via `getMinhasDuplas`) | `DuplasLista`: lista plana única, busca, chips de semáforo, ordenação. Subtítulo **hardcoded** "N duplas no programa 2026/2027" (`duplas/page.tsx:32`) |
| `/duplas/[id]` | `duplas/[id]/page.tsx` | escopo RLS | ficha da dupla — tela de trabalho do mentor; já é endereçável por id (turma vem de graça via `dupla.ciclo`) |
| `/registros` | `registros/page.tsx` | coord, supervisor | timeline flat paginada; filtro `?encontro=N` usa `maxEncontro` do calendário global (`registros/page.tsx:95`) |
| `/agenda` | `agenda/page.tsx` + `agenda-calendario.tsx` (2771 linhas) | todos | grade mensal: discos numerados de `ciclo_eventos` (sugestões oficiais) + dots dos encontros reais das duplas no escopo do papel; chamada de formação coord-only; especialista sem dupla DPP → `AgendaEspecialista` |
| `/materiais` | `materiais/page.tsx` | todos (audiência) | biblioteca oficial agrupada por `encontro_num` ou tipo — global por desenho |
| `/formularios` + `/novo` + `/[id]` | `formularios/page.tsx` | **só coord** | builder + `formulario_links` tokenizados (link já amarra `dupla_id`/`contexto` — turma vem transitiva pela dupla) |
| `/pessoas` + `/pessoas/[id]` | `pessoas/page.tsx` + `pessoas-listas.tsx` | todos | coord → gestão (badges de pendência, `RoleSelect` inline, "Livres para dupla" → `MatchingPanel`, criar/importar/enviar termos); demais → diretório de colegas (só `role != null`, badge de papel, chips de perfil) |
| `/perfil`, `/assinar` | | todos | o próprio cadastro — globais por natureza |
| `/demo`, `/f/[token]`, `/assinar/[token]` | | público | demo com `demo_role` cookie; links tokenizados — fora do escopo de contexto |

Shell: `app-shell.tsx` — `NAV` fixo filtrado por `me.role` (`app-shell.tsx:32-40`); badge de papel = `papelCurto` em `text-xs text-muted-foreground` no header mobile (`app-shell.tsx:119-122`) e sob o nome na sidebar (`:190`).

### 1.2 O que já existe de "turma" no dado — e onde falta

Existe:
- `duplas.ciclo` com índice único parcial `(ciclo, mentorado_id, trilha)` (`0027`) — o banco já permite a mesma pessoa em duplas de ciclos diferentes.
- `ciclo_eventos.ciclo` — os eventos já carregam a chave do cronograma.
- `NovaDuplaDialog` já tem select **"Ciclo"** (`nova-dupla-dialog.tsx:469-487`) alimentado por `ciclosOpcoes`/`cicloVigente` (`ciclo.ts:936-975`) — distinct do calendário + ciclos em uso.
- `getResumoFormacao` já resolve "ciclo vigente" por data dos eventos (`queries-presenca.ts:77-107`); `presencas(ciclo_evento_id, …)` é correta por construção (presença é por evento, evento tem ciclo).
- Demo já tem uma dupla de ciclo passado (`demo/data.ts:1483` — `"2025/2026"`) — precedente de histórico.

Não existe:
- **Nenhuma entidade turma.** `profiles` e `mentorados` não têm coluna de turma/ciclo — pertença a turma só pode ser *derivada* via `duplas` (e via `presencas`/`supervisoes`, transitivamente).
- `getCicloEventos()` retorna **todas** as linhas sem filtro (`queries.ts:224-234`) e **nenhum consumidor filtra por `dupla.ciclo`**: `saudadeDaDupla` (`ciclo.ts:562`), `alvoAgendamento` (`ciclo.ts:728`), `jornadaDaDupla`, `eventoDaSemana`, `resumoSemana`, `totalEncontros`. O §7 da análise já marcou: um segundo cronograma infla `esperado` → falso "risco", trilha com números duplicados.
- `profiles.role` único + `my_role()` em toda a RLS — papel por programa (Kelyng mentora numa turma, especialista noutra) é refatoração de schema+RLS, não de UI.

### 1.3 Onde "tudo misturado" quebra com 2+ turmas

| Superfície | O que quebra |
|---|---|
| Home coord | Stats somam turmas; "Semana do Nº encontro" (`dashboard-coordenacao.tsx:139-149`) é singular — dois cronogramas podem estar em semanas diferentes; radar mistura duplas de contextos incomparáveis |
| Semáforo | `saudadeDaDupla` compara cada dupla contra o calendário global inteiro → atraso fantasma **(bug de dados, não só de IA — pré-requisito de qualquer modelo)** |
| `/duplas` | Lista plana de 30→60+ duplas sem divisão; subtítulo mente o nome do programa; chip/prioridade misturam fases diferentes |
| `/agenda` | Dois calendários oficiais sobrepostos na mesma grade — dois discos numerados "7" em terças diferentes; chamada de formação lista **todos** os mentores ativos (`getMentoresChamada`, `queries-presenca.ts:24-39`) independente de turma |
| `/pessoas` | Duas seções planas globais; "Livres para dupla" forma pool cross-turma → matching pode parear mentorado da turma A com cronograma B; `EnviarTermosDialog` emite pra base inteira |
| `/registros` | `?encontro=3` é ambíguo (3º encontro do cronograma A e do B); "resumo da semana" idem |
| `/formularios` | Forms são globais; respostas agregam turmas; a ata pede **versionamento por turma** ("versão 1, 2, 3" da Kelyng, §4) |
| Export | `/api/export?tipo=ciclo` mistura ciclos e **não exporta a coluna `ciclo`** (header em `api/export/route.ts:432`) — a planilha mistura sem nem marcar |
| Comunicados | `audiencia` enum (`types.ts:338-343`: todos/dpp/especialista/coordenacao/equipe) não tem eixo turma |
| Notificações | `href` aponta pra objeto (`/duplas/[id]`) — ok; mas landing de lista perde contexto |
| Mentor em 2 turmas | A home/agenda dele assumem um calendário: `eventoDaSemana` global, `AgendaCalendario` recebe um array só |

**Nota de escopo:** pro mentor, "turma" quase não é conceito de navegação — o escopo dele é a própria dupla (`/duplas/[id]` já resolve). Quem sofre com a mistura é coordenação e supervisor. Isso orienta os modelos abaixo: contexto de turma é ferramenta de **gestão**, e cai como lente leve pros demais papéis (ver §5).

---

## 2. Modelos de organização

### Modelo A — Seletor global de contexto ("turma em foco" no shell)

Um picker de turma no `AppShell` (sidebar desktop, header mobile) — ao lado do badge de papel, que ele passa a compor: "Coordenação · Turma 2026/2". Estado persistido em cookie (precedente direto: `demo_role`/`demo_onboarded` do demo mode, `src/lib/demo/mode.ts`). Todas as telas leem o contexto e filtram.

- **`/pessoas`**: seções e contadores escopados à turma em foco; opção "Todas as turmas" = visão atual + badge de turma por linha.
- **`/duplas`**: lista filtra; chips de semáforo contam só a turma.
- **`/agenda`**: um calendário oficial por vez — a sobreposição some por construção. "Todas" vira modo exceção com discriminador textual no detalhe do dia.
- **Matching**: `MatchingPanel` pool = livres da turma em foco (correto por padrão — vira feature, não só filtro).
- **Relatórios**: export herda o contexto.
- **Home**: dashboard = a turma em foco; "Todas" pode virar hub agregado (ver Modelo C).

**Prós:** mínimo de rotas novas (nenhuma); resolve o problema *dentro* de cada tela existente; seletor sempre visível = também resolve parte do "papel invisível" (§3 — vira "papel × turma" declarado no chrome); cookie = zero trabalho de URL.

**Contras:** estado implícito — link compartilhado/nudge cai na turma que o destinatário deixou selecionada, não na do objeto (`/registros?encontro=3` com cookie errado mostra o encontro 3 errado); deep-links ambíguos; "em que turma estou?" exige olhar o header (hoje ninguém precisa); bug clássico de contexto global esquecido ("cadastrei na turma errada porque o seletor estava na outra").

**Esforço:** médio. Cookie + seletor no shell + cada page ler contexto + o fix do semáforo. Risco concentrado em nunca esquecer `?turma=` nos links gerados.

### Modelo B — Hierarquia de rotas `/turmas/[id]/...`

A turma vira namespace de URL: `/turmas/[id]` (home da turma), `/turmas/[id]/duplas`, `/turmas/[id]/pessoas`, `/turmas/[id]/agenda`, `/turmas/[id]/registros`, `/turmas/[id]/formularios`. Rotas globais continuam pra o que é global (`/materiais`, `/perfil`, `/duplas/[id]` — objeto direto).

**Prós:** contexto explícito e compartilhável — a URL **é** a turma; nudge/notificação carrega contexto; breadcrumb natural ("Programa > Turma > Dupla" literal da ata); página da turma tem identidade própria (cronograma, chamada, matching, forms versionados por turma — cada pedido da ata ganha um lugar); escala pra N programas sem sobrecarregar.

**Contras:** a árvore quase duplica (ou as páginas migram pra dentro e as rotas planas viram redirect); supervisor/mentor entram numa hierarquia pensada pra gestão — pro mentor `/turmas/[id]/duplas/[id]` é um degrau a mais até a ficha (mitigável: `/duplas/[id]` continua global e redireciona/renderiza direto); dupla de uma turma linkada de outra = confusão de breadcrumb; decisões novas por página ("materiais é global ou por turma?") em cada rota.

**Esforço:** alto. Reorganização de `(app)`, `MOBILE_PRIMEIRO`/nav por contexto, middleware/guard de pertença, e todo link interno revisto.

### Modelo C — Home da coord como hub de turmas

`/` deixa de ser "o radar misturado" e vira **o mapa do programa**: um card por turma (nome, fase/cronogramas, stats — duplas ativas, risco, registros pendentes, semana de cada cronograma) + entrada pro que é global (materiais, formulários, diretório completo). Clicar no card abre a **página da turma** — na prática o dashboard atual escopado — e de lá as listas existentes via links com filtro (`/duplas?turma=X`).

**Prós:** encaixa no modelo mental que o Léo verbalizou ("Programa → Turmas → Cronogramas → Duplas"); não inventa navegação nova — usa a home que já é a porta de entrada; com 1 turma o hub pode nem aparecer (graceful: hoje é o caso); a página da turma dá casa pra coisas que não têm casa (chamada por turma, forms por turma, resumo copiável por turma).

**Contras:** sozinho não resolve o "estou vendo qual turma?" fora da home — precisa dos `?turma=` nas listas, ou seja, é meio caminho do Modelo A com hub no lugar de seletor; coord que trabalha alternando turmas navega home↔turma o dia todo (o seletor global do A é mais rápido pra troca).

**Esforço:** médio. Nova home hub + página da turma (reusa `DashboardCoordenacao` com prop de escopo) + params nas listas.

### Modelo D — Híbrido recomendado: contexto persistido + URL honesta + hub

Combina o que cada um faz melhor, com uma regra clara de precedência:

1. **Contexto persistido** (cookie `turma_foco`, cookie do demo como precedente) com seletor no shell — a troca rápida do Modelo A.
2. **URL vence cookie**: toda rota de lista aceita `?turma=` (ou `?ciclo=`); quando presente, grava o cookie. Links gerados pelo sistema (nudges, notificações, "ver registros", stat-cards) **sempre carregam o param** — deep-link nunca mente. Sem param e sem cookie → default: turma vigente (`cicloVigente` já existe) ou "Todas" pra coord.
3. **Hub na home**: `/` com >1 turma acessível mostra os cards (Modelo C) quando o contexto é "Todas"; com turma em foco, é o dashboard escopado de hoje.
4. **Rotas de objeto continuam planas**: `/duplas/[id]`, `/pessoas/[id]`, `/f/[token]` — o id já é o escopo; a ficha declara a turma dela ("Turma 2026/2 · cronograma quinzenal") e oferece "ver a turma" como saída.
5. **Escopo implícito pros não-gestores**: mentor/supervisor não precisam de seletor pra operar — a dupla carrega a turma; a agenda do mentor mostra os encontros das *suas* duplas + os eventos oficiais do(s) cronograma(s) delas (se 2 cronogramas: duas camadas rotuladas, ou filtro). O seletor existe pra eles só como lente de leitura ("ver só a turma X"), default = tudo que o RLS escopa.

Por superfície:

- **`/pessoas`** — seletor de turma na barra de filtros (sincronizado com o global) + agrupamento opcional por turma na visão "Todas" + badge de turma/membership por linha. Matching filtra livres da turma em foco. Detalhado na §3.
- **`/duplas`** — filtra por contexto; subtítulo vira "N duplas · Turma X" (mata o hardcode de `duplas/page.tsx:32`); em "Todas", agrupar por turma como seções (precedente: as seções "Com acesso"/"Mentorados" de pessoas) com chip de semáforo contando dentro de cada seção.
- **`/agenda`** — camada oficial = cronograma(s) da turma em foco (1 turma com 2 cronogramas → duas camadas: disco numerado + discriminador — sigla/chip do cronograma no detalhe do dia e tooltip, **não cor**: cor já é semáforo/legenda, a ata reservou laranja="pendente de agendamento", verde="agendado"). Encontros reais das duplas seguem o escopo do papel × turma. Chamada de formação lista mentores da turma (o `getMentoresChamada` global vira escopado).
- **Matching** — pool = turma em foco; se matching for por cronograma, a escolha do cronograma já é o select "Ciclo" do `NovaDuplaDialog` (renomear pra "Cronograma" na virada de vocabulário).
- **Relatórios** — `?turma=` no export; resumo copiável da home declara a turma no texto.
- **Comunicados** — MVP: continuam globais; depois `audiencia` ganha dimensão turma (`turma_id` nullable = "todos").
- **Formulários** — MVP: lista ganha filtro/etiqueta de turma nas respostas (via `formulario_links.dupla_id → dupla.ciclo`); depois `formularios.turma_id` pro versionamento por turma que a ata pede.

**Prós:** URL compartilhável + troca rápida + hub + degradação elegante (1 turma = UI atual quase intacta); separa "escopo de navegação" (turma que estou olhando) de "pertença" (turmas em que atuo) — os dois eixos que a ata confunde.

**Contras:** dois mecanismos pra manter (cookie + param) — mitigado pela regra única de precedência; ainda não é `/turmas/[id]` navegável — se a turma virar "coisa" com páginas próprias ricas (config, cronograma editável), o Modelo B pode ser destino final (o híbrido não bloqueia: `?turma=` pode virar prefixo depois).

**Esforço:** médio, incremental (ver §5).

---

## 3. `/pessoas` em detalhe

### 3.1 Hoje

`pessoas/page.tsx` + `PessoasListas` (`pessoas-listas.tsx`):

- **Duas seções fixas e planas**: "Com acesso" (profiles) e "Mentorados", cada uma ordenada por nome ou "Pendências primeiro" (`ORDEM_PESSOAS_LABEL`, `:56-59`).
- **Controles**: busca (nome/email/ONG), chip "Livres para dupla" (abre `MatchingPanel`), select de ordenação. Sem filtro por papel, status ou turma.
- **Badges coord por linha** (`:687-707`): `inativa`, `ainda não entrou`, `em dupla`, `termo pendente`; `DetalhesTrigger` abre região com vagas/formação/civis faltantes; `RoleSelect` inline + `PessoaActions`.
- **Não-coord**: diretório — badge de papel à direita (`:682-686`), subtítulo cargo/empresa ou cidade/UF, chips de áreas/interesses.
- Pendência só **ordena**, não filtra — "quem precisa de ação" é leitura manual da lista ordenada.

### 3.2 Proposta — dois níveis

**Nível 1 (sem tabela de membership — derivado de vínculos):**

- **Filtro de turma** na barra (select sincronizado com o contexto global). Pertença derivada: `profile/mentorado ∈ turma` se tem dupla daquele ciclo (`getDuplasResumo`/`getDuplasResumoTodas` precisam devolver `ciclo` — hoje selecionam só ids, `queries.ts:313-337`; mudança de uma coluna).
- **Grupo "Sem turma"** automático: pré-cadastros e quem nunca foi pareado — é exatamente o pool de intake/matching.
- **Chips de filtro coord-only** (compondo com busca e turma): `precisa de ação` (OR das pendências de `pendenciasPessoa`/`pendenciasMentorado`, `:64-100` — hoje só alimentam o sort), `ainda não entrou`, `termo pendente`, `sem formação` (mentores), `livre para dupla` (existente), `inativa`.
- **Filtro de papel** como chips (DPP / especialista / supervisor / coordenação / sem papel) — o dado existe; hoje exige scroll.
- **Visão "Todas"**: seções viram `turma × tipo` — "Turma 2026/2 · Com acesso", "Turma 2026/2 · Mentorados" — ou mantém 2 seções com badge de turma por linha (mais barato; escolher pelo volume: >40 pessoas por seção pede agrupamento).

**Nível 2 (membership real — endgame da ata "papel por programa"):**

- `membros(profile_id, turma_id, papel, …)` (e `mentorado_turmas` ou membership única cobrindo mentorados) — a pessoa deixa de ter **um** papel e passa a ter **vínculos**.
- Agrupamento primário por turma, secundário por papel dentro da turma ("Mentores DPP", "Mentores especialistas", "Assistentes", "Mentorados") — lê como o organograma da turma.
- `RoleSelect` por linha vira gestão de memberships (uma pessoa, N linhas de vínculo) — o dialog de "elevar à coordenação" (`role-select.tsx:74-102`) escopa o aviso pra turma.
- Ficha `/pessoas/[id]` ganha seção **"Vínculos"**: turma × papel × status × datas — ao lado do que já tem (duplas, supervisões, assinaturas, mural).

### 3.3 O que cada papel vê em `/pessoas`

- **Coordenação**: tudo + gestão; default = turma em foco; "Todas" pra operações cross (import CSV continua global, mas ganha coluna turma no resumo pós-import — achado §3: "12 mentores, 1 coordenação" vira "12 mentores · Turma X").
- **Supervisor (→ assistente de coordenação)**: escopo = pessoas das turmas das duplas supervisionadas (hoje a lista já vem cortada pelo RLS das duplas); agrupamento por turma ajuda ele a ler "minhas turmas".
- **Mentor DPP / especialista**: diretório de colegas — misturar turmas aqui é **aceitável e até desejável** (rede do programa); ordenar "sua turma" primeiro é cortesia barata. Mentorados: só os das próprias duplas (RLS já faz).

---

## 4. Badge de papel e onboarding na IA multi-turma (achado §3)

O §3 mostrou que "papel invisível" já causou uma reunião inteira errada — e com turmas o problema ganha **segundo eixo**: não basta "eu sou mentora?", passa a ser "mentora **de quê**?" e "mentora **onde**?".

- **Lockup de identidade no shell**: o `papelCurto` solto (`app-shell.tsx:119`) vira `papel × contexto`: "Kelyng · Mentora DPP" + turma em foco quando houver ("Mentora DPP · Turma 2026/2"). No desktop, a linha sob o nome na sidebar (`:190`) carrega o mesmo. Com membership por turma, o badge é **por vínculo**: mesma pessoa, dois papéis — o badge declara o da turma em foco (ou "Mentora + Especialista" em "Todas").
- **O badge precisa gritar mais, não menos**: hoje é `text-xs text-muted-foreground` — o achado §3 já provou insuficiente. Com contexto duplo, vira chip estruturado (papel + turma), não texto corrido.
- **OnboardingFlow substitui o shell inteiro** (`layout.tsx:99-127`) — exatamente quando a pessoa mais precisa do badge, some tudo. O wizard precisa de um header persistente "Você está entrando como {papel} em {turma}" — análogo ao `demoDock` que já resolveu isso pra demo (`layout.tsx:90-97`, dock no header do wizard).
- **Onboarding por papel já existe** (`RECURSOS` por `AppRole`, `onboarding-flow.tsx:64-91`; passos condicionais `ehMentor`). Com papel por turma: o wizard roda **por membership** — cadastro básico uma vez (a ideia da Kelyng, §6: "cadastro da pessoa independente do perfil") + seção por papel novo. `onboarded_em` (flag única) vira por vínculo (`membros.onboarded_em`) ou "onboarded por papel" — decidir junto com o modelo de membership.
- **Handoff/magic link**: o link já carrega identidade sem declarar (§3 — "agora você tá como eu"); com turmas o e-mail/landing declaram "entra como {nome} — {papel} em {turma}".
- **Demo mode**: `demo_role` por papel já existe; demo multi-turma = personas × turma em foco (cookie `turma_foco` na demo também). O dataset já tem uma dupla `2025/2026` — vira a turma encerrada honesta do demo.

---

## 5. Recomendação

**Modelo D (híbrido)** — é o único que resolve ao mesmo tempo: troca rápida de contexto (A), link honesto/compartilhável (B, sem pagar a árvore nova), e uma casa pra turma (C). E degrada pra "quase nada muda" enquanto houver 1 turma — o caso de hoje.

### MVP → visão

**Passo 0 — pré-requisito de dados (independe do modelo, sem ele todo resto mentira):**
- `saudadeDaDupla`/`alvoAgendamento`/`jornadaDaDupla`/`eventoDaSemana`/`resumoSemana`/`totalEncontros` recebem os eventos **filtrados por `dupla.ciclo`** — ou `getCicloEventos(ciclo)` parametrizado e cada page passa o slice certo. É a bomba do §7: o segundo cronograma já existe na operação.
- `getDuplasResumo*` devolvem `ciclo`; `getMentoresChamada` escopa por cronograma/turma; export declara ciclo.

**MVP (navegação):**
1. Entidade mínima `turmas` (id, nome, programa?) + `duplas.turma_id`/`turma_ciclo` — ou, mais barato ainda, tratar `ciclo` como a unidade navegável no MVP e adiar a turma-composta (ver perguntas). O select "Ciclo" do `NovaDuplaDialog` vira a fonte de verdade.
2. Seletor de contexto no shell + cookie `turma_foco` + `?turma=` vencendo cookie nas rotas de lista (`/duplas`, `/pessoas`, `/registros`, `/agenda`).
3. Home: com >1 contexto, "Todas" = hub de cards; turma em foco = dashboard escopado (reusa `DashboardCoordenacao`).
4. `/pessoas` Nível 1: filtro de turma + chips de pendência + "Sem turma"; matching escopado.
5. Badge papel×turma no shell e header persistente no onboarding.

**Visão:**
- Membership real com papel por turma (`membros`/`papel_por_turma`), RLS `my_role()` → por vínculo (a refatoração profunda — separar do MVP de IA).
- Turma como "coisa" rica → opcionalmente migrar pra `/turmas/[id]/...` (Modelo B) quando a turma ganhar páginas próprias (config de cronograma, forms versionados, relatório da turma). O `?turma=` híbrido não bloqueia essa migração.
- Formulários/materiais/comunicados com dimensão de turma onde fizer sentido.
- Pessoas Nível 2 (organograma por turma, seção Vínculos na ficha).
- Demo com 2ª turma provando o modelo.

### Perguntas abertas (pro Léo/Thiago)

1. **Turma × cronograma — qual é a unidade de pertença?** Os 30 alunos da turma atual pertencem à *turma* e os 2 cronogramas são só calendários alternativos dentro dela — ou cada mentorado é "do cronograma A"? Isso decide se o contexto seleciona turma (cronograma = sub-filtro na agenda/duplas) ou cronograma direto. Também decide se o pool de matching é por turma ou por cronograma.
2. **Formação/chamada é por turma ou por cronograma?** (os dois encontros de formação são conjuntos ou separados?) — define o escopo de `getMentoresChamada`.
3. **Papel por programa entra quando?** A ata pede até tabela de perfis configurável pela coordenação — IA aguenta os dois mundos se separarmos "escopo de navegação" de "pertença", mas `RoleSelect`, badge e onboarding mudam de forma quando membership chegar.
4. **"Todas as turmas" na agenda** vale a sobreposição? Ou a coord usa a agenda sempre em foco único e "Todas" vira só listas?
5. **Histórico**: turmas encerradas continuam navegáveis no seletor (arquivo read-only) ou somem pra uma área de "ciclos anteriores"?
6. **Materiais por turma?** Hoje é biblioteca oficial do programa — global parece certo, mas `encontro_num` fica ambíguo quando cronogramas têm comprimentos diferentes (ata prevê ciclos curtos/longos).
7. **Comunicados por turma** — necessidade real ou global basta?
8. Nome na UI: "turma", "edição", "ciclo"? (hoje "ciclo" aparece no select da NovaDupla e no AGENTS.md — a virada de vocabulário é agora, junto com o rename supervisor→assistente já decidido.)
