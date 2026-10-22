# Mapa de telas e superfície de produto — realiza.vc

> Reconhecimento de código (mirror local, sem git/build). Cada afirmação cita `path:linha`.
> Convenções: "staff" = coordenação/supervisor/mentor DPP/mentor especialista (grupo `(app)`);
> "jovem" = papel `mentorado` (grupo `(jovem)`); "público" = sem login.
> Onde o código não confirma, marcado **a verificar**.

---

## 1. Guarda de rotas e papéis

- `src/lib/supabase/middleware.ts` (citado no contexto como `middleware.ts:6-94`): cookie `demo_role` dispensa auth; rotas públicas = `/login`, `/auth/*`, `/demo`, `/assinar/[token]`, `/api/assinar-token/*`, `/f/*`, `/t/*`, `/avaliar/*`, `/resumo/*`, `/privacidade`. Protegido sem sessão → `/login?next=...`; logado em `/login` → destino interno seguro.
- `src/app/(app)/layout.tsx:15-95`: `getMe()` + `getMeusDadosPessoais()` + `getMeuMentorProfile()` + `getMeusDadosCivis()` no boot do shell; profile ausente/inativo/sem papel → telas de conta bloqueada; `mentorado` → redirect `/jovem`; onboarding pendente → `OnboardingFlow` substitui o shell; senão `AppShell` + notificações.
- `src/components/app-shell.tsx:34-47`: nav staff = Visão geral `/`, Duplas, Chamados, Registros, Agenda, Materiais, Formulários, Turmas, Relatórios, Pessoas; mobile limita células visíveis e joga excedente em "Mais".
- `src/app/(jovem)/jovem/layout.tsx:25-90`: `getMe()` + `getNotificacoes()` + `getJovemPerfil()`; onboarding do jovem → `OnboardingJovem`; shell `JovemShell`.
- `src/components/jovem-shell.tsx:29-53`: nav jovem = `/jovem`, `/jovem/agenda`, `/jovem/especialistas`, `/jovem/pessoas`, `/jovem/materiais`, `/jovem/perfil`; acento `--role-mentorado` (amarelo), adulto usa lime.

Papéis (de `_contexto-agentes.md`, confirmado nos guards): `coordenacao`, `supervisor` (auxiliar executivo), `mentor_dpp`, `mentor_especialista`, `mentorado`; perfis híbridos via `papeis` (`temPapel`, `src/app/(app)/agenda/page.tsx:101-105`).

---

## 2. Árvore de rotas (`src/app`)

### Grupo `(app)` — staff autenticado

| Rota | Quem | O que mostra | Fonte |
|---|---|---|---|
| `/` | todos staff | Home ramificada por papel: dashboard radar (coord/sup) ou home do mentor | `src/app/(app)/(home)/page.tsx:35-211` |
| `/agenda` | todos staff | Agenda multi-modo: monitoramento (coord), auxiliar, especialista, minha/por-mentorado/calendário | `src/app/(app)/agenda/page.tsx:48-209` |
| `/duplas` | todos staff | Lista de duplas em 5 visões (coord/sup/mentor/esp/híbrido) | `src/app/(app)/duplas/page.tsx:20-75` |
| `/duplas/[id]` | todos staff (escopo RLS) | Ficha da dupla: trilha, encontros, registros, instrumentos, terceiros, supervisão, encerramento | `src/app/(app)/duplas/[id]/page.tsx:221-1248` |
| `/registros` | coord + supervisor | Timeline filtrada/paginada de registros de encontro | `src/app/(app)/registros/page.tsx:90-350` |
| `/materiais` | todos staff | Biblioteca oficial agrupada por encontro/tipo + painel de jornada | `src/app/(app)/materiais/page.tsx:58-167` |
| `/pessoas` | coord (gestão) / demais (diretório) | Listas de profiles + mentorados; matching/capacidade/docs coord-only | `src/app/(app)/pessoas/page.tsx:30-174` |
| `/pessoas/[id]` | coord completo / staff leitura | Perfil detalhado da pessoa (dados, formação, supervisões, docs) | `src/app/(app)/pessoas/[id]/page.tsx:1-64`, `:599` |
| `/formularios` | coord | Lista de formulários + CTA novo | `src/app/(app)/formularios/page.tsx:13-55` |
| `/formularios/novo` | coord | Builder de formulário | `src/app/(app)/formularios/novo/page.tsx:9-26` |
| `/formularios/[id]` | coord | Detalhe: builder, links, respostas, ações | `src/app/(app)/formularios/[id]/page.tsx:40-80` |
| `/chamados` | coord/sup (fila) / mentores (próprios) | Inbox de chamados com detalhe `?c=` | `src/app/(app)/chamados/page.tsx:13-50` |
| `/turmas` | coord | Cronogramas por status (ativo→rascunho→encerrado) | `src/app/(app)/turmas/page.tsx:24-80` |
| `/turmas/novo` | coord | Builder de cronograma | `src/app/(app)/turmas/novo/page.tsx:13-40` |
| `/turmas/[id]` | coord | Editor de cronograma (eventos, duplas, ações) | `src/app/(app)/turmas/[id]/page.tsx:25-45` |
| `/relatorios` | coord | Builder de relatório sobre `RelatorioCanvas` | `src/app/(app)/relatorios/page.tsx:13-89` |
| `/perfil` | todos staff | Dados pessoais, perfil de mentor, termo, avatar | `src/app/(app)/perfil/page.tsx:13-31` |
| `/assinar` | signatário logado | Termo de adesão: leitura + assinatura ou via PDF se assinado | `src/app/(app)/assinar/page.tsx:20-48` |

`loading.tsx` existe em `(home)`, agenda, assinar, duplas(+`[id]`), formularios(+`[id]`+novo), materiais, perfil, pessoas(+`[id]`), registros, relatorios, turmas(+`[id]`+novo) — ver `find` acima. `template.tsx` em `(app)` e `(jovem)` (transição de página). `error.tsx` por grupo.

### Grupo `(jovem)` — portal do mentorado

| Rota | Quem | O que mostra | Fonte |
|---|---|---|---|
| `/jovem` | mentorado | Home: pedir ajuda, dupla, terceiros, próximos encontros, avaliações, combinados, docs, avisos, materiais, contatos | `src/app/(jovem)/jovem/page.tsx:299-864` |
| `/jovem/agenda` | mentorado | Agenda própria: futuros/histórico, agendar/remarcar/desmarcar/não-aconteceu, avaliar, especialistas | `src/app/(jovem)/jovem/agenda/page.tsx:66-556` |
| `/jovem/especialistas` | mentorado | Sugestão pendente, trilhas em curso, mesa de negociação, catálogo | `src/app/(jovem)/jovem/especialistas/page.tsx:34-60` |
| `/jovem/pessoas` | mentorado | Diretório por cargo (mentoria/esp/sup/coord) + colegas de turma | `src/app/(jovem)/jovem/pessoas/page.tsx:30-50` |
| `/jovem/pessoas/[id]` | mentorado | Detalhe de um contato | `src/app/(jovem)/jovem/pessoas/[id]/page.tsx` (estrutura a verificar) |
| `/jovem/materiais` | mentorado | "Minha jornada": 7 estações + Acervo | `src/app/(jovem)/jovem/materiais/page.tsx:62-105`, `:481-509` |
| `/jovem/perfil` | mentorado | Banner, dados, disponibilidade, ficha, chamados, privacidade, conta | `src/app/(jovem)/jovem/perfil/page.tsx:56-196` |

### Rotas públicas / auth

| Rota | Quem | O que mostra | Fonte |
|---|---|---|---|
| `/login` | público | LoginForm (magic link implícito + handoff); link fixo "Ver a demonstração" | `src/app/login/page.tsx:13-26` |
| `/auth/link` | público | Landing do magic link (resolve `#access_token`, handoff nonce) | `src/app/auth/link/page.tsx` + `link-landing.tsx` |
| `/auth/confirm` | público | `token_hash`/PKCE legado → entra direto | `src/app/auth/confirm/page.tsx` + `confirmar.tsx` |
| `/auth/confirmado` | público | Confirmação no dispositivo do link | `src/app/auth/confirmado/page.tsx` |
| `/auth/definir-senha` | logado | Definir senha (dispensável) | `src/app/auth/definir-senha/page.tsx` |
| `/demo` | público | Seletor de papel → cookie `demo_role` | `src/app/demo/page.tsx:20-50` |
| `/f/[token]` | público | Formulário por token (estados: ok/respondido/expirado/encerrado/inválido) | `src/app/f/[token]/page.tsx:16-60`, `formulario-publico.tsx` |
| `/t/[token]` | público | Avaliação por terceiros (2 perguntas, confidencial) | `src/app/t/[token]/page.tsx:16-50`, `terceiro-publico.tsx` |
| `/avaliar/[token]` | público | "Como foi o encontro?" — avaliação do jovem por link | `src/app/avaliar/[token]/page.tsx:16-50` |
| `/assinar/[token]` | público | Assinatura do responsável (link único reemitível) | `src/app/assinar/[token]/page.tsx` |
| `/resumo/[slug]` | público obscuro | Relatório público T2 por slug fixo | `src/app/resumo/[slug]/page.tsx:26-114` |
| `/privacidade` | público | Política de privacidade | `src/app/privacidade/page.tsx` |
| `not-found`, `error`, `global-error`, `manifest`, `robots`, `sitemap` | — | metadata/erros | `src/app/*` |

### API routes

| Rota | Função | Fonte |
|---|---|---|
| `/api/material/[id]` | signed URL 300s do bucket privado `materiais` | `src/app/api/material/[id]/route.ts` |
| `/api/anexo/[id]` | anexo de registro | `src/app/api/anexo/[id]/route.ts` |
| `/api/chamado-anexo/[id]` | anexo de chamado | `src/app/api/chamado-anexo/[id]/route.ts` |
| `/api/assinatura/[id]` | PDF/evidência de assinatura | `src/app/api/assinatura/[id]/route.ts` |
| `/api/documento/[id]` | documento oficial | `src/app/api/documento/[id]/route.ts` |
| `/api/assinar-token/[token]` | fluxo de assinatura público | `src/app/api/assinar-token/[token]/route.ts` |
| `/api/export` | CSV export (coord) | `src/app/api/export/route.ts` (link em `duplas-lista.tsx:1016`) |
| `/api/nudge` | disparo de lembrete/nudge | `src/app/api/nudge/route.ts` |

---

## 3. Mapas profundos das telas-chave

### 3.1 `(app)/(home)` — `/`

**Queries**: `getMe`, `getCicloEventos`, `getComunicados`, `getDuplas`, `getSupervisaoAlvos`, `getSupervisoesRecentes`, solicitações especialista, slots, interações (`page.tsx:35-53`, `:109-118`).

**Ramos**:
- `coordenacao` → `DashboardCoordenacao` (`page.tsx:73`): banner de pendências/termo, seção "resumo da semana" + saúde, radar, chamados, demandas especialista, avisos.
- `supervisor` → `DashboardCoordenacao supervisor` + supervisões (`page.tsx:109-144`).
- `mentor_dpp`/`mentor_especialista`/híbrido → `MentorHome` (`page.tsx:211`).

**DashboardCoordenacao** (`src/components/dashboard-coordenacao.tsx`):
- Estrutura: h1 (206) → seção sintética (229-332) → grid lg 1fr+340px (347) com coluna principal (saúde → radar → ...) e rail lateral (avisos, supervisão).
- "Duplas ativas" (385-478): contagem risco/atenção/em-dia (`:177-179`), barra de semáforo segmentada em CSS puro, filter chips "Todas/Em risco/Em atenção/Registro pendente/Avaliação pendente" (tests em `:54-58`).
- Radar (`:483-596`): lista agrupada por semáforo com headers `GRUPO_SEMAFORO` (`:72-76`), `SemaforoDot` + progresso `feitos de total`, próximo encontro, última avaliação (`AvaliacaoBadge`), último lembrete, ação WhatsApp (`WhatsAppRapido`, `:839-843`); card = stretched link para ficha + zona de ação separada (`:823-843`).
- `SupervisaoDialog` embutido (`:609`).
- Densidade: grid de 2 colunas só em lg; o radar é uma lista longa 1-col — em turmas grandes o scroll domina; rail de 300-340px aproveita largura.

**MentorHome** (`src/components/mentor-home.tsx`):
- h1 "Olá, {primeiro nome}" (`:97`); grid `xl:grid-cols-2` quando >1 dupla (`:92-95`) — com 1 dupla vira 1 coluna em qualquer largura (canal morto em desktop).
- Por dupla: card com semáforo, próximo encontro, ações:
  - "Entrar na chamada" (`:373`)
  - "Agendar próximo" → `AgendarEncontroDialog` (`:381-391`)
  - "Remarcar" (`:426`)
  - "Encontraram-se sem agendar? Registre aqui." → `RegistrarRetroativoDialog` (`:462-471`)
- Especialista: nota explicando que sessões nascem de pedidos aceitos (contexto `:summary`).
- Encaminhamentos abertos: até 4, depois "+N mais · ver todos" (`:522`).
- Densidade: cards verticais por dupla — escala mal além de 2-3 duplas; CTAs repetidos por card.

### 3.2 `/agenda`

**Params**: `?dia=YYYY-MM-DD`, `?visao=dpp|especialista`, `?aba=minha|por-mentorado|calendario` (`page.tsx:51-61`).

**Queries**: `getCicloEventos`, `getMe`, `getDuplas`, `getCronogramas`, `getMateriais`, `getMeuMentorProfile`, `getMentoresChamada`, `getPresencas`, `getSupervisaoAlvos` (`page.tsx:6-19`, `:63-70`).

**Roteamento de modos** (`page.tsx:88-209`):
- `visaoEsp` → `AgendaDisponibilidade` + `AgendaEspecialista` + `AbasAgenda` (`:122-183`).
- Aba default: `dia` deep-link → calendário; senão `aba` param (`:200-209`).
- Coordenação → `AgendaCoordenacao`; supervisor/auxiliar → `AgendaAuxiliar`; mentor → `AgendaMinha`/`AgendaPorMentorado`/`AgendaCalendario`.
- Banner de degradação quando `?visao=` inaplicável (`:107-120`).

**AgendaCoordenacao** (`src/components/agenda-coordenacao.tsx`): h1 (`:123`), síntese (`:146`), "Semana do encontro por cronograma" (`:199`), "Para acompanhar" (`:235`), "Semana no programa" (`:259`); réguas por turma com ticks clicáveis que abrem o dia no calendário (`:322-405`).

**AgendaMinha** (`src/components/agenda-minha.tsx`): seções por grupo (`:280`), aside "Esta semana" + "Suas duplas" (`:341-418`), escopo `role=group` (`:546`); reusa `AgendarEncontroDialog` (`:115-249`).

**AgendaAuxiliar** (`src/components/agenda-auxiliar.tsx`): h1 (`:137`), grupos por dia (`:192-199`), modos (`:266`), seções por dia (`:485`), `SupervisaoDialog` (`:391,588`).

**AgendaEspecialista** (`src/components/agenda-especialista.tsx`): h1 (`:73`), blocos por dupla com chips de passo (`:127-172`), `AgendarEncontroDialog`/`RegistrarRetroativoDialog`/`EncerrarTrilhaDialog` (`:193-238`).

**AgendaPorMentorado** (`src/components/agenda-por-mentorado.tsx`): "Pendências da dupla" (`:443`), seções por dia (`:702`), "Pedido de especialista em andamento" (`:1156`), "Trilha de especialista" (`:1240`), "Do programa" (`:1330`), `SugerirEspecialistaDialog` (`:1256`).

**AgendaCalendario** (`src/components/agenda-calendario.tsx`, 4783 linhas — o componente mais denso do app):
- Props (`:575-621`): eventos, cronogramas (seletor multi-turma, `:633-661`), espEventos, materiais, hoje, semanaId (deep-link), diaInicial, duplas, role, mentores (chamada coord), presencas, mentorDisponibilidade (overlay REALIZA-24, `:613-618`), papeis.
- Estrutura: seletor de cronograma → rail "semana atual" → grade mensal com marcadores de tipo (`MarcadorTipo:357`), overlay de disponibilidade (`GRADIENTE_AMBOS_DISPONIVEIS:323`), dia selecionado (`:2893`), todos os eventos do mês (`:2943`), "Encontros da jornada" (`:2162`), materiais do encontro (`MaterialDoEncontro:3626`), buckets (`BucketsEncontros:3711`), legenda (`LegendaAgenda:3823`), grade semanal do mentor (`SemanaMentor:4087`, `HorariosMentor:4345`, `ColunaHorario:4594`), cobertura (`CoberturaEncontro:3069`), ação do dia (`AcaoDiaMentor:3097`), `EncontroDuplaRow:3307` com dialog interno `sm:max-w-xl` (`:3570-3585`).
- Densidade: arquivo gigante com ~20 subcomponentes; em desktop a grade mensal + painel do dia convivem, mas cada célula carrega marcadores/overlay/aria — custo cognitivo alto; scroll horizontal explícito nas grades (`:4129`, `:4460`).

### 3.3 `/duplas`

**Queries**: `getDuplas` (escopo RLS), `getSupervisaoAlvos` (visão supervisor), `getEspecialistaEventos` (esp/híbrido), nudges (`page.tsx:45-75`). `visao` derivada do papel (`:25-37`); sem visão → `/`.

**DuplasLista** (`src/components/duplas-lista.tsx`, 1903 linhas):
- `LinhaDupla` (`:195-378`): grid lg 6 colunas `[96px minmax(190px,1.2fr) minmax(140px,.85fr) minmax(195px,1.35fr) 120px minmax(118px,.55fr)]` (`:192-193`) — pill estado+apoio (`:248-261`), dupla+avatars (`:264-285`), progresso feito×esperado com tick (`:288-331`), sinais+recência (`:334-349`), última avaliação (`:352-364`), ação+"Ver ficha ›" (`:368-376`).
- `LinhaMini` (`:382-422`): linha mínima da massa saudável.
- `CatChip` + `CATS` (`:426-500`): chips com régua textual de cada categoria.
- `ResumoLinha` (`:531-543`): resumo vivo "N duplas · X em risco…".
- `EstadoVazio` (`:547-625`): vazio por papel, busca sem resultado, filtro sem resultado.
- `LegendaSemaforo` (`:629-677`): `<details>` "Como o semáforo é calculado" com 5 blocos.
- `casoLembrete` (`:681-696`): copy contextual do nudge por tipo de sinal.
- `VisaoCoordenacao` (`:836-`~`:1250`): header+busca+`ImportarCsvDialog`+`NovaDuplaDialog`+Exportar (`:991-1022`); chips categoria + chip Apoio separado (`:1027-1085`); filtros turma+supervisão+mentor (`:1088-1148`); ordenação radar apoio→risco→atenção→ok→fora (`:888-899`); massa saudável colapsa em `<details>` quando >5 e sem recorte (`:916-944`); `LembreteButton` só com pendência + cap 48h (`:946-986`).
- `VisaoSupervisor`, `VisaoEspecialista` (5 passos + prazo), `VisaoMentor` (cards), `hibrido` (duas seções, `:768-819`).
- Densidade: a versão desktop é grid de linha única bem aproveitada; mobile vira card empilhado. Em turmas grandes a lista é longa — a massa colapsada mitiga. Chips de categoria ocupam linha inteira com réguas (bom p/ aprendizado, ruim p/ repetição diária).

### 3.4 `/duplas/[id]` — ficha da dupla

**Queries** (`page.tsx:221-269`): `getDupla` (2× via `React.cache`), `getCicloEventos`, `getMe`, `getMateriais`, `getInstrumentosDaDupla`, `getTerceirosDaDupla` (só DPP), `getMentorados`, `getMentorProfiles`, `getDuplasResumo(Todas)`, `getDuplaVinculo` (remanejo), `getDuplaSucessora` (encerrada); `!dupla || !me → notFound` (`:259`).

**Dialogs montados na ficha** (`page.tsx:563-895`):
- `AgendarEncontroDialog` (`:568`, `:831`, `:843`), `EnviarFormularioDialog` (`:586`), `SolicitarEspecialistaDialog` (`:610`), `SugerirEspecialistaDialog` (`:624`), `EncerrarTrilhaDialog` (`:640`), `PedirApoioDialog` (`:857`), `EditarDuplaDialog` (coord, `:890`), `RemanejarDuplaDialog` (`:895`), `SupervisaoDialog` (`:1191`), `RegistrarRetroativoDialog`, `EditarLinkDialog` (nos cards de encontro), `EncerrarDuplaDialog` (via `encerramento-dupla.tsx`).

**Estrutura**:
- h1 nomes (`:728`).
- Trilha: `<section>` com `TrilhaJornada` (`:925-943`).
- Sidebar/coluna: cards `text-[11px] uppercase` — contexto/demanda (`:981-997`), dados da dupla (`:1007-1048`), WhatsApp/contato (`:1053-1124`), `InstrumentosDupla` (`:1151`), `TerceirosDupla` (`:1167`), supervisões `SupervisoesSection` + `SupervisaoDialog` (`:1191`), encerramento `EncerramentoDupla`/`ResumoJornadaSection` (`:1223-1248`).
- Encontros: futuros colapsáveis, pendentes de registro diretos (resumo), cada `EncontroCard` com ações agendar/remarcar/link WhatsApp/registrar/`NaoAconteceuButton`/`EncontroDetalheDialog`, anexos, avaliação do jovem.
- Densidade: página longuíssima em 1-2 colunas; cards `text-sm` com h2 uppercase 11px — hierarquia consistente mas scroll grande; a ficha concentra TUDO (trilha, agenda, registros, instrumentos, terceiros, supervisão, encerramento) — candidata a tabs/âncoras.

### 3.5 `/registros`

**Guarda**: coord + supervisor (`page.tsx:94-96`).

**Params**: filtros parseados (`parseFiltros`), `?ordem=recentes|prioridade|antigas`, paginação cumulativa (`:102-112`, `:208`).

**Queries**: `getCicloEventos`, `getRegistros(filtros)`, `getDuplasOpcoes`, `getAlertasRegistros`, `getEspecialistaEventos`, `getEncontrosPorDuplas` (passo esp, `:114-140`).

**Estrutura**: `PageHeader` + `ImportarRegistrosDialog` (coord, `:279`) → `RegistrosFiltros` (`:346`, dialog `sm:max-w-lg` `registros-filtros.tsx:419-421`) → lista de `RegistroCard` (`:257`) → toggle de ordem (`:329-339`).

**RegistroCard** (`src/components/registro-card.tsx:20-195`): `Collapsible.Root` — header clicável inteiro (nº encontro/passo+título, avatares+dupla, preview tema/ferramenta/atividades); corpo expande `RegistroView` + link `#registrar-<id>` + `ResolverApoioButton` (coord); borda danger quando `precisa_apoio` (`:46-52`); badge `AvaliacaoBadge` com `rotulo` ("avaliação: boa").

**Estados**: vazio sem filtros vs. sem resultado (distintos); tardios marcados (`registroTardio`, `diasAtrasoRegistro`).

### 3.6 `/materiais`

**Queries**: `getMateriais`, `getMe`, `getDuplas`+`getPainelInstrumentosJornada` (staff, `:58-86`).

**Estrutura** (`page.tsx:100-167`): `PageHeader` (+`NovoMaterialDialog` coord, `:104-110`) → `PainelJornada` (`:114-123`) → vazio diferenciado coord ("publicar") vs. resto ("aguardar"/link agenda) (`:125-148`) → seções por rótulo (encontro Nº ou tipo) com `MaterialRow` (`:152-166`).

**MaterialRow** (`:198-262`): href = `/api/material/[id]` (path) ou url segura; sem ambos → "em breve" (estado legítimo); coord → `MaterialActions` (editar dialog `sm:max-w-md`, enviar e-mail, excluir; `material-actions.tsx:232-321`).

**PainelJornada** (`src/components/painel-jornada.tsx:220-518`): card de acompanhamento — estações do guia por dupla (`CelulaEstacao:59`, `BarraEstacao:115`), grupos "em dia"/"atenção" (`:335-443`).

### 3.7 `/pessoas`

**Queries**: `getPessoas`, `getMentorados`, `getMentorProfiles` (coord-only) (`page.tsx:44-48`); não-coord vê diretório restrito.

**PessoasListas** (`src/components/pessoas-listas.tsx`, 1308 linhas): busca (`:346`), ordenação (`:401`), seções por grupo (`:448`, `:532`, `:634`, `:677`); `PessoaRow` (`:826`) com badges de papel/documento/`formacao_ok`, `DetalhesTrigger` (`:724`), `DetalhesRegiao` (`:796`), `LinkAssinatura` (`:779`); `MentoradoRow` (`:1117`) com situação/WhatsApp/`<18`; ações: `ImportarCsvDialog`, `NovaPessoaDialog`, `NovoMentoradoDialog`, `CapacidadeMentorDialog`, `EnviarTermosDialog` (`:466-549`).

**`/pessoas/[id]`**: ficha completa com dados civis (coord), formação, supervisões (`getSupervisoesDaPessoa`), docs (`getDocumentosPessoa`), `CapacidadeMentorDialog` (`pessoas/[id]/page.tsx:599`).

### 3.8 `/formularios`

- Lista (`formularios/page.tsx:13-55`): coord-only; vazio com CTA duplo; `FormulariosLista` (filtro/ordenação client).
- Novo (`novo/page.tsx:9-26`): `mx-auto max-w-2xl`, `FormularioBuilder`.
- Detalhe (`[id]/page.tsx:40-80`): coord-only, `UUID_RE`→404; `FormularioAcoes`, `FormularioBuilder`, `FormularioLinks` (destinatários = profiles não-coord + mentorados, `:60-80`), `FormularioPreview` (dialog `sm:max-w-xl`, `formulario-preview.tsx:41-43`), `RespostasSection`; `FormularioExcluir`; "Gerar links de resposta" dialog `sm:max-w-md` (`formulario-links.tsx:494-496`).

### 3.9 `/chamados`

**Guarda**: `mentorado` → `/jovem/perfil` (`page.tsx:19`); staff vê fila, mentores veem próprios (`:20-21`).

**ChamadosApp** (`src/components/chamados-app.tsx`, 1024 linhas): lista+filtros (fila/categoria/estado/busca, `:181-282`) + painel de detalhe (`:383`, `:403`) com h2 (`:503`), stepper de situação `<ol>` (`:525`), conversa `<ol>` (`:625`), composer (`:890`); dialogs "Resolver {numero}" (`:683`) e "Atribuir {numero}" (`:721`, Select responsável `:728`); mobile lista↔detalhe com "Voltar pra lista" (`:481`). Layout `max-w-6xl` 2-col — denso mas com overflow potencial na lista.

### 3.10 `(jovem)/jovem` — home do jovem

**Queries** (`page.tsx:1-55`): `getJovemAssinaturas`, `getJovemContatos`, `getJovemDuplas`, `getJovemEncaminhamentos`, `getJovemEncontros`, `getJovemPedidosEspecialista`, `getJovemPerfil`, `getJovemAvaliacoes`, `getConsolidadoTerceirosJovem`, `getComunicados`, `getMateriais`, `getMe`.

**Seções** (`:299-864`): h1 saudação (`:299`) → Pedir ajuda (`:315-354`, `PedirAjudaDialog`→`NovoChamadoDialog`) → Minha dupla (`:357-437`, mentor/mentora card + WA + `EditarLinkDialog` `:524`) → terceiros (`:444-460`) → Próximos encontros (`:464-546`) → avaliações pendentes (`:563-577`, `JovemAvaliacoes`) → combinados (`:581-591`, `JovemCombinados`) → docs/termos (`:595-694`) → avisos (`:701-738`) → materiais (`:744-812`) → contatos WA (`:864`). `LembreteDisponibilidade` se grade vazia. Acento amarelo `--role-mentorado`.

### 3.11 `/jovem/agenda`

**Queries** (`page.tsx:62-105`): `getJovemEncontros`, `getJovemAvaliacoes`, `getMe`, `getJovemDuplas`, `getCicloEventos`, `getJovemContatos`, `getJovemPedidosEspecialista`, `getJovemPerfil`. Status map (`:66-85`): Agendado/Remarcado/Aconteceu/Não aconteceu/Cancelado.

**Ações**: `JovemAgendarDialog` (`:267`), `PedirEspecialistaDialog` (`:354`), `EditarLinkDialog` (`:556`), `JovemEncontroAcoes` (dialogs "O encontro não aconteceu?"/"Desmarcar o encontro?", `jovem-encontro-acoes.tsx:27-115`), "Avaliar" por encontro realizado. Writes via RPC definer (0072) — nenhum write por policy (`:60-66`).

### 3.12 `/jovem/materiais` — "Minha jornada"

`metadata.title = "Minha jornada"` (`page.tsx:62`); 7 estações canônicas, datas via RPC `jovem_jornada` (0096); fallback = biblioteca plana (`:62-70`). Trilha vertical com recibos datados; "Acervo" (biblioteca) embaixo fora do progresso (`:481-509`); `ReverRespostaDialog` (`:652`, `:669`) para rever respostas de instrumento.

### 3.13 `/jovem/perfil`

`page.tsx:56-196`: `PessoaBanner` (`:64`), `DadosSecao`, `DisponibilidadeCard` (só com ficha vinculada, `:106-111`), `<details>` "Sua ficha no programa" (badge "não vinculada" warn, `:113-140`), chamados pessoais, `PrivacidadeCard` (`:189`), conta. `perfil-form.tsx` tem dialogs "Seus dados" e "Sua disponibilidade" (ambos `sm:max-w-xl`, `:48`, `:221`).

### 3.14 `/resumo/[slug]`

- Slug **hardcoded**: `RESUMO_SLUG_T2 = "t2-x7k4m9qf2w8j"` (`src/lib/relatorio.ts:5`); mismatch → `notFound()` (`resumo/[slug]/page.tsx:34`); `force-dynamic` (`:19`), `robots noindex` (`:21-24`).
- Dados: `createAdminClient()` lê `duplas` (id, turma, mentores, supervisor, status, iniciada_em, demanda), `profiles` (id, nome, email, whatsapp, cidade, uf), `mentorados` (idem) (`:42-50`) — **sem RLS** (admin); erro → mensagem "Não foi possível carregar" (`:51-59`).
- Config por query `?turma=&gran=&col=` (`parseConfig`, `:36-40`); granularidade pessoas|duplas; colunas default = todas menos contato.
- **Opt-in de contato**: colunas `email`, `whatsapp`, `contato_mentor`, `contato_mentorado` só entram se pedidas em `?col=`; a poda é feita antes de serializar pro client (`:67-75`) — e-mail/WhatsApp nem chegam no payload sem opt-in.
- Render: header com logo, "Dados vivos, atualizados em …", "Link não listado — trate como documento interno" (`:90-97`) → `RelatorioCanvas` (`:100-108`) → `SiteFooter`.
- Futuro: REALIZA-170 (senha) — hoje é só obscuridade.

---

## 4. Inventário de Dialogs/Modais (REALIZA-177)

Primitiva única: `src/components/ui/dialog.tsx` — Base UI `@base-ui/react/dialog`; `DialogOverlay` = `bg-black/10` + `backdrop-blur-xs` + fade (`:28-38`); `DialogContent` = popup central `max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)]` `rounded-xl p-4 text-sm` `sm:max-w-sm` default, X absoluto top-2 (`:42-78`); `DialogFooter` com faixa `bg-muted/50` invertida mobile (`:83-110`).

Todos os usos abaixo seguem a primitiva compartilhada (import de `@/components/ui/dialog`) — nenhum modal custom fora dela encontrado. "Tam" = classe de largura passada a `DialogContent`.

| Arquivo | Título | Tam | Uso |
|---|---|---|---|
| `agendar-encontro-dialog.tsx:248-250` | `{nome}` (ex.: "Marcar o 5º encontro") | default (sm) | Agendar/remarcar encontro — form denso (data, hora, link, recorrência a verificar) |
| `agenda-calendario.tsx:3570-3574` | dinâmico (encontro) | `sm:max-w-xl` | Detalhe/criação no calendário |
| `anamnese-mentorado.tsx:124-126` | "Anamnese pra {nome}" | `sm:max-w-md` | Resumo da anamnese do mentorado |
| `assinaturas-pessoa.tsx:164-166` | "Contra-assinatura do presidente" | default | Upload/evidência |
| `capacidade-mentor-dialog.tsx:92-94` | "Capacidade de {nome}" | `sm:max-w-sm` | nº de duplas do mentor |
| `chamados-app.tsx:683` / `:721` | "Resolver {nº}" / "Atribuir {nº}" | default | Ações do chamado |
| `confirm-delete-button.tsx:61-63` | `{titulo}` | default | Confirmação destrutiva genérica (tem `DialogDescription`+`Footer`) |
| `cronograma-editor.tsx:143-145` | `{titulo}` | default | Evento do cronograma |
| `cronograma-editor.tsx:263-265` | "Dados do cronograma" | `sm:max-w-md` | Editar metadados |
| `editar-dupla-dialog.tsx:348-350` | "Editar dupla" | `sm:max-w-md` | Form completo da dupla (alto, `:680`) |
| `editar-link-dialog.tsx:77-79` | "Editar link da chamada" | default | Campo único |
| `encaminhamentos-list.tsx:233-235` | "Editar combinado" | `sm:max-w-md` | Encaminhamento |
| `encerrar-dupla-dialog.tsx:82-84` | "Registrar encerramento" | `sm:max-w-lg` | Checklist do rito |
| `encerrar-trilha-dialog.tsx:74-76` | "Encerrar a trilha de especialista" | `sm:max-w-lg` | Encerramento antecipado esp |
| `encontro-detalhe-dialog.tsx:133-148` | dinâmico (título do encontro) | `sm:max-w-xl` | Detalhe completo do encontro |
| `enviar-email-dialog.tsx:138-140` | "Enviar material por e-mail" | `sm:max-w-md` | Destinatários + msg |
| `enviar-formulario-dialog.tsx:202-204` | "Enviar formulário" | `sm:max-w-md` | Escolher form + destino |
| `enviar-termos-dialog.tsx:347-349` | "Enviar termos pra assinar" | `sm:max-w-lg` | Lote de termos |
| `evento-cronograma-dialog.tsx:72-74` | `{titulo}` | `sm:max-w-lg` + `max-h-[90dvh]` | Evento do cronograma |
| `importar-csv-dialog.tsx:285-287` | "Importar de planilha" | `sm:max-w-2xl` | Wizard CSV (alto, `:575`) |
| `importar-registros-dialog.tsx:439-441` | "Importar respostas do form semanal" | `sm:max-w-6xl` | **Maior dialog do app** — tabela de import (`:598`) |
| `instrumentos-dupla.tsx:213-215` | `{titulo}` | `sm:max-w-2xl` + `max-h-[85vh]` | Resultado de instrumento (roda etc.) |
| `jornada-rever.tsx:54-56` | `{titulo}` | `sm:max-w-2xl` + `max-h-[85vh]` | Rever resposta (jovem) |
| `jovem-agendar-dialog.tsx:165-169` | dinâmico | default | Agendar como jovem |
| `jovem-avaliacoes.tsx:73-77` / `:121-123` | dinâmico | `sm:max-w-xl` / default | Avaliar / ver avaliação |
| `jovem-encontro-acoes.tsx:27-29` / `:81-83` | "O encontro não aconteceu?" / "Desmarcar o encontro?" | default | Confirmações jovem |
| `jovem/perfil/perfil-form.tsx:48-50` / `:221-223` | "Seus dados" / "Sua disponibilidade" | `sm:max-w-xl` | Edição jovem |
| `jovem-sugestao-card.tsx:139-141` | "Confirmar pedido de especialista" | default | Resposta à sugestão |
| `material-actions.tsx:232-234` | "Editar material" | `sm:max-w-md` | Metadados do material |
| `mentorado-actions.tsx:323-325` | "Editar {nome}" | `sm:max-w-lg` | Ficha do mentorado |
| `nao-aconteceu-button.tsx:30-32` / `:86-88` | "O encontro não aconteceu?" / "Desfazer \"não realizado\"?" | default | Confirmação dupla |
| `nova-dupla-dialog.tsx:378-380` | "Formar dupla" | default | Matching + `AfinidadePar` embutido (alto, `:696`) |
| `novo-chamado-dialog.tsx:131-136` | dinâmico (ícone+título) | default + `max-h-[92dvh]` | Abrir chamado (denso, `:267`) |
| `novo-comunicado-dialog.tsx:68-70` | "Novo aviso" | default | Comunicado |
| `novo-material-dialog.tsx:145-147` | "Adicionar material" | default | Upload/URL |
| `pedir-especialista-dialog.tsx:257-259` | "Pedir apoio de um especialista" | default | Demanda + mesa (alto, `:463`) |
| `perfil/perfil-form.tsx:472-474` / `:506-508` | "Perfil público" / "Dados de cadastro" | `sm:max-w-xl` | Edição staff |
| `pessoa-actions.tsx:486-488` | "Editar {nome}" | `sm:max-w-lg` | Ficha de profile |
| `pessoas-dialogs.tsx:299-301` / `:459-461` | "Cadastrar pessoa" / "Cadastrar mentorado" | `sm:max-w-lg` | Pré-cadastro |
| `registrar-retroativo-dialog.tsx:169-171` | "Registrar {nome} que já aconteceu" | default | Registro retroativo |
| `registros-filtros.tsx:419-421` | "Filtros" | `sm:max-w-lg` | Filtros avançados |
| `remanejar-dupla-dialog.tsx:339-341` | "Remanejar a dupla" | `sm:max-w-md` | Rematch |
| `role-select.tsx:79-83` | dinâmico | default | Troca de papel |
| `saida-mentorado-dialog.tsx:129-131` | "Marcar saída de {nome}" | `sm:max-w-md` | Saída do programa |
| `solicitar-especialista-dialog.tsx:97-99` | "Solicitar mentor especialista" | default | Mentor → coord |
| `sugerir-especialista-dialog.tsx:102-104` | "Sugerir especialista pro jovem" | default | Mentor → jovem |
| `supervisao-dialog.tsx:114-116` | "Registrar supervisão" | `sm:max-w-lg` | Supervisor → sessão |
| `terceiros-dupla.tsx:303-305` / `:393-395` | "Editar contato" / "Indicar pessoa" | default | Terceiros |

**Não-Dialog (overlays adjacentes)**: `notificacoes.tsx:279-408` usa `Popover` ("Notificações"); `material-actions.tsx:152-208` usa `Tooltip`; `duplas-lista.tsx:631` usa `<details>`; `pessoas-listas` usa `Collapsible`/`details`; `resumo` usa nenhum overlay.

**Inconsistências observadas**:
1. **Override de altura inconsistente**: `max-h-[85vh]` (instrumentos/jornada-rever), `[90dvh]` (evento-cronograma), `[92dvh]` (novo-chamado) vs. `calc(100dvh-2rem)` do default — 4 regras diferentes de teto.
2. **Largura**: 7 tamanhos distintos (`sm:max-w-sm/md/lg/xl/2xl/6xl` + default); forms similares ("Editar material" md vs. "Editar {pessoa}" lg) divergem sem critério aparente.
3. `DialogDescription` presente só em alguns (`confirm-delete-button`, `novo-comunicado`, `nao-aconteceu`, `jovem-encontro-acoes`, `role-select`, `importar-registros`, `registrar-retroativo`) — a11y de descrição irregular.
4. `DialogFooter` usado em forms de confirmação; forms longos (editar-dupla, nova-dupla, pedir-especialista) **sem** footer sticky — ações no fim do scroll.
5. Títulos dinâmicos (`{nome}`, `{numero}`) vs. estáticos — padrão ok, mas `role-select` e `novo-chamado` têm título composto com ícone fora do padrão `DialogTitle` simples.
6. `agenda-calendario.tsx` e `encontro-detalhe-dialog` abrem o mesmo tipo de objeto por componentes diferentes — duplicação de superfície de detalhe de encontro (a unificar no sweep).

---

## 5. Design system

### 5.1 Tokens (`src/app/globals.css`)

`:root` (`:46-108`): paleta neutra esverdeada — `--background: hsl(75 10% 95%)`, `--foreground: hsl(0 0% 15%)`, `--card: white`, `--muted: hsl(75 7% 93%)`, `--border: hsl(75 6% 87%)`, `--input: hsl(75 8% 54%)`, `--ring: hsl(78 58% 38%)`, `--radius: 0.75rem`.

Semânticos (`:80-99`):
- **Marca**: `--brand-lime: hsl(78 56% 53%)` (primary), `--brand-ink: hsl(0 0% 15%)`.
- **Estado**: `--ok: hsl(78 58% 38%)`, `--ok-text: hsl(78 55% 30%)`; `--warn: hsl(43 95% 44%)`, `--warn-text: hsl(43 90% 27%)`; `--danger/--destructive: hsl(0 80% 48%)`.
- **Info/apoio**: `--info: hsl(207 82% 45%)`, `--info-text`, `--info-bg: hsl(207 82% 96%)`, `--info-border` — eixo separado (apoio ≠ falha; `duplas-lista.tsx:79`, legenda `:661-667`).
- **Papel**: `--role-mentor: var(--brand-lime)`, `--role-mentorado: hsl(48 100% 60%)` (amarelo do jovem).
- Sidebar espelha a paleta (`:101-108`).

Uso canônico (skill + código): lime = ativo/progresso/ação primária/concluído (`SemaforoDot ok` não usa lime — usa `--ok`; lime marca "agendado/compromisso" em `trilha-jornada.tsx:30-37`); amarelo = pendência rastreável (`--warn`: registro pendente, remarcado, média de estrelas `estrelas.tsx:15`); vermelho = crítico real (risco, apoio em registro `registro-card.tsx:51`); azul info = pedido de apoio.

### 5.2 `src/components/ui/*`

`badge`, `button`, `card`, `dialog`, `dropdown-menu`, `filter-chip` (`filterChipCls`, usado em `duplas-lista.tsx:46`), `input`, `label`, `password-input`, `popover`, `select`, `skeleton`, `sonner`, `switch`, `textarea`, `tooltip`. Padrão: utilitários `cn()`, tokens `var(--*)`, `min-h-11` em alvos de toque, `tabular-nums` em contadores.

### 5.3 Padrões

- **Badge**: `ui/badge` + variants locais — `Pill` em `duplas-lista.tsx:74-95` (tons por estado), `AvaliacaoBadge` (`semaforo.tsx:54-69`), `StatusBadge` de cronograma, `Badge` warn "não vinculada" (`jovem/perfil/page.tsx:125-130`).
- **Card**: superfície `rounded-xl bg-card shadow-[var(--shadow-border)]` (ubíquo, ex. `duplas-lista.tsx:242`, `registro-card.tsx:49`); `Card`/`CardContent` do ui para blocos formais.
- **Tabela/relatório**: `RelatorioCanvas` + grids CSS `grid-cols-[…]` (linhas de `LinhaDupla`) — não há `<table>` semântico dominante.
- **Semáforo**: `SemaforoDot`/`SemaforoBadge`/`AvaliacaoBadge` (`semaforo.tsx:17-69`); `Estrelas`/`EstrelasMedia` (`estrelas.tsx`); `EstadoCard` para estados terminais públicos (`estado-card.tsx`).
- **Disclosure**: `@base-ui/react/collapsible` (`registro-card`, `pessoas/[id]`) e `<details>` nativo (`LegendaSemaforo`, "Sua ficha").
- **Entrada**: `animate-enter` + `--i` stagger (`duplas-lista.tsx:238-240`), `fill-grow`, `ease-snappy`, `animate-ping-once` (risco, `semaforo.tsx:28-33`).

### 5.4 `RelatorioCanvas`

`src/components/relatorio-canvas.tsx:68-94` — client component, "planilha" de relatório:
- Colunas redimensionáveis, sort clicável, gutter de nº de linha sticky, seleção por range, **copy TSV p/ Excel/Sheets**, scroll interno com header sticky, edição inline quando `editavel`, animação de entrada/saída de colunas.
- Props: `colunas`, `linhas`, `storageKey`, `editavel=false`, `colunasEntrando`, `colunasSaindo`, `onSalvarCampo`.
- Consumidores: `/relatorios` (builder completo, `relatorios/relatorio-builder.tsx`) e `/resumo/[slug]` (read-only, `page.tsx:102-107`).

---

## 6. Mapa de copy (microcopy e CTAs)

### Por persona

- **Coordenação**: voz operacional direta — "Lembrar", "Ver ficha ›", "Exportar", "Importar de planilha", "Quem assumir primeiro trata. Resposta combinada em 1 dia útil." (`chamados/page.tsx:31-33`). Nudges em 1ª pessoa assinados pelo operador (`casoLembrete` `duplas-lista.tsx:681-696`: "Vi que o último encontro rolou, mas ainda falta o registro. Consegue preencher hoje?").
- **Mentor**: encorajadora e situacional — "Olá, {nome}" (`mentor-home.tsx:97`), "Encontraram-se sem agendar? Registre aqui." (`:462-471`), "+N mais · ver todos" (`:522`).
- **Jovem**: acolhedora e simples — "Minha jornada", "Seus dados", "Sua ficha no programa", "O encontro não aconteceu?", "Pedir ajuda"; CTAs curtos ("Avaliar", "Conversar no WhatsApp").
- **Público (token)**: `EstadoCard` + instrução de beco (mailto/retry); og texts orientados ao gesto ("Como foi o encontro?", `avaliar/[token]/page.tsx:25-30`).

### CTAs de encontro (estado atual)

- "Agendar próximo" (`mentor-home.tsx:391`), "Remarcar" (`:426`), "Entrar na chamada" (`:373`), "Registrar encontro já realizado"/"Registre aqui" (`:462-471`, `registrar-retroativo-dialog.tsx:171`), "O encontro não aconteceu?" (`nao-aconteceu-button.tsx:32`, `jovem-encontro-acoes.tsx:29`), "Como foi?" → copy de avaliação (`avaliar` title "Como foi o encontro?"), "Pedir apoio"/"Pedir ajuda" (`PedirApoioDialog`, `PedirAjudaDialog`), "Chamar no WhatsApp"/WA rápido (`whatsapp-rapido`, `waLink`), "Lembrar" (`lembrete-button.tsx:30`).
- Labels de status de encontro: Agendado/Remarcado/Aconteceu/Não aconteceu/Cancelado (`jovem/agenda/page.tsx:66-85`); semáforo: "Em dia"/"Atenção"/"Risco" (`semaforo.tsx:11-15`); pills: "Em risco"/"Atenção"/"Em andamento"/"Pausada"/"Concluída"/"Encerrada" (`duplas-lista.tsx:97-104`); apoio: "chamado aberto — não é falha da dupla" (`:1081`).

---

## 7. Gráficos e visualizações

**Sem biblioteca de charts** — `package.json` não declara recharts/d3/chart.js (a verificar lock, mas nenhum import de lib de gráfico encontrado no recon). Toda visualização é CSS/SVG/DOM:

1. **Barra de semáforo segmentada** — divs coloridas por fração, `dashboard-coordenacao.tsx:385-478`.
2. **Barras de progresso** — `role="progressbar"` com tick de "esperado", `duplas-lista.tsx:301-330`; idem `dashboard-coordenacao` cards.
3. **Réguas de cronograma** — ticks clicáveis por encontro, `agenda-coordenacao.tsx:322-405`.
4. **Trilhas/jornadas** — discos de estado + legenda, `trilha-jornada.tsx:14-80` (gramática: fill=aconteceu, contorno lime=agendado, anel warn=incerteza, apagado=não rolou); estações do jovem em `jovem/materiais`.
5. **Roda da vida** — **SVG real** (pointer input), `src/components/instrumentos/roda-svg.tsx:12-192`; reuso em leitura `instrumento-resultado.tsx` e ficha da dupla.
6. **Agenda/calendário** — grade mensal CSS + overlay de disponibilidade em gradiente (`agenda-calendario.tsx:323-340`), grades de horário por px (`HORA_PX:4278`).
7. **Afinidade de matching** — painel comparativo DOM (interesses em comum, alertas de gênero), `matching-afinidade.tsx:19-80` — **não é gráfico**, é layout de comparação.
8. **Planilha de relatório** — `RelatorioCanvas` (ver §5.4).
9. **Steppers** — `<ol>` de situação (chamados `:525`), passos 1-5 especialista.
10. **Estrelas** — ícones Phosphor fill/duotone (`estrelas.tsx`).

---

## 8. Estados transversais

- **Loading**: `loading.tsx` por rota (skeletons `ui/skeleton`); `Suspense` em login.
- **Empty**: padrão card central com ícone em `bg-muted` + título + corpo + CTA contextual — ver `EstadoVazio` (`duplas-lista.tsx:547-625`), materiais (`materiais/page.tsx:125-148`), formularios, turmas, resumo por papel.
- **Erro**: `error.tsx`/`global-error.tsx`; fetch error inline (`resumo/[slug]/page.tsx:51-59`); token inválido → `EstadoCard` com `acao` (`estado-card.tsx`).
- **Permissão**: redirects server-side (`me?.role !== "coordenacao" → "/"`), `notFound` para id inválido/fora de escopo, telas de bloqueio no `(app)/layout.tsx`, RLS como última linha (dados ausentes, não erro).
- **Demo**: `demoAtivo()`/`demoRole()` desvia queries (`src/lib/demo/*`); aviso "Modo demonstração — só leitura" (turmas `page.tsx:65-69`); actions retornam `DEMO_MSG`.

---

## 9. Densidade desktop — achados transversais

1. **Largura morta**: `MentorHome` com 1 dupla = coluna única sem cap (`mentor-home.tsx:92-95`); forms `max-w-2xl` centralizados (`formularios/novo`); header `max-w-6xl` mas canvas full-bleed em resumo.
2. **Scroll longo**: ficha da dupla (todas as seções empilhadas, `duplas/[id]/page.tsx:925-1248`), radar (lista 1-col), `agenda-calendario` (4783 linhas, seções empilhadas), home do jovem (7+ seções verticais `jovem/page.tsx:315-812`).
3. **Repetição de cards**: `RegistroCard` ×N, `LinhaDupla` ×N, cards de encontro idênticos; paginação cumulativa em registros mitiga parcialmente.
4. **2-col reais**: só `dashboard-coordenacao` (1fr+340px rail, `:347`), `chamados` (lista+detalhe `max-w-6xl`), `agenda-minha` (main+aside `:341`); maioria das telas é 1-col em qualquer viewport.
5. **Tables vs. cards**: `/duplas` coord usa grid densa de linha única (bom); demais listas são cards — inconsistência de densidade entre listas equivalentes.
6. **Dialogs grandes**: `importar-registros` (`sm:max-w-6xl`) e `importar-csv` (`sm:max-w-2xl`) são quase páginas — candidatos a rota própria no sweep REALIZA-177.

---

## 10. Lacunas / a verificar

- `src/app/(jovem)/jovem/pessoas/[id]/page.tsx` — estrutura interna não inspecionada.
- `src/components/encontro-card.tsx` — referenciado mas arquivo não localizado no tree (a verificar nome real; os cards de encontro podem estar inline na ficha).
- `AfinidadePar`/`matching-afinidade` — alertas completos além de gênero (interesses, distância) — inspecionar restante do arquivo.
- Conteúdo exato de `registro-view`, `supervisoes-section`, `avisos-section`, `meus-chamados-card`, `remanejo-sugerido`, `agenda-disponibilidade`, `catalogo-jovem`, `jovem-avaliacoes`, `formulario-builder` (8 tipos de campo), `cronograma-builder`.
- `middleware.ts` linhas exatas (citadas de contexto `6-94`, arquivo não relido nesta sessão — confirmar range).
- Presença de `encontro-detalhe-dialog` vs. dialog inline do calendário — consolidar no sweep.
- `manifest.ts`, `sitemap.ts`, `robots.ts` — escopo (provável PWA/SEO básico).
