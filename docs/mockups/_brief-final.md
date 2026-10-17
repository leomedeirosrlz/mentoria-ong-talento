# Rodada final — telas compostas (leia INTEIRO antes de começar)

Esta rodada NÃO é mais "3 propostas": cada tela tem uma **base decidida** + pontos fortes das outras variantes costurados. O resultado vira a especificação de implementação, então precisa ser **funcionalmente fiel ao domínio**, com mais detalhe que as rodadas anteriores. Antes, leia também `docs/mockups/_brief.md` (tokens de design, dataset, regras da R2) e `docs/mockups/RELATORIO.md`.

## 1. Formato obrigatório (todas as telas)

- **Um arquivo HTML autocontido**, CSS inline, Inter via Google Fonts, SVG inline. JS só se indispensável; prefira CSS puro.
- **Página responsiva de verdade — NÃO pranchetas/molduras de celular.** O arquivo roda dentro de um iframe em tela cheia: ≥1024px renderiza o chrome desktop do app (topbar dos adultos / sidebar do jovem), <768px renderiza o chrome mobile (bottom nav). Quem testa redimensiona a janela ou abre no celular. Alvos de toque ≥44px no mobile.
- **Seletor de visão por papel no topo da página** (barra "Ver como:" com pills — Coordenação · Auxiliar executivo · Mentor DPP · …, só os papéis relevantes à tela). Implemente com **radio inputs + CSS (`input:checked ~ .panel`)**, sem JS. Cada papel mostra o que aquele papel realmente enxerga/pode fazer. Papéis ausentes de uma tela = a tela não existe pra eles (diga isso na nota).
- **Header de prancheta + notas** no padrão já usado (`board-head` com `MOCKUP · tela · vN` + linha "Direção:" + âncoras; `ul.notes` no fim). Em `notes` inclua: (a) a matriz **papel × o que vê × o que pode fazer**; (b) o que veio de cada variante anterior (rastreabilidade: "base v3", "da v5: …"); (c) **decisões em aberto** (marque claramente).
- Rotule em cada visão o escopo em linguagem natural ("Você vê: …  Você NÃO vê: …") — faz parte do mock.
- Tokens: `--background hsl(75 10% 95%)`, `--foreground hsl(0 0% 15%)`, `--card #fff`, `--primary/--brand-lime hsl(78 56% 53%)`, `--brand-ink hsl(0 0% 15%)`, `--role-mentorado hsl(48 100% 60%)` (âmbar: nav ativa do jovem; lime = adultos/brand), `--ok hsl(78 58% 38%)`, `--warn hsl(43 95% 44%)`, `--danger hsl(0 80% 48%)`, radius .75rem, fonte Inter.
- Acessibilidade (público até 60 anos): texto ≥12px, status NUNCA só por cor (ícone+rótulo), contraste AA, foco visível, `prefers-reduced-motion`.
- pt-BR em toda a interface.

## 2. Dataset canônico (usar IDÊNTICO em todas as telas — as rodadas anteriores divergiam)

Hoje = **terça, 7 de outubro**. Semana 41 (6–12 out). Calendário oficial: 16 encontros semanais; T1 = terças 19h; T2 = quartas 19h e **começou 3 semanas depois** (por isso mesma semana = T1 enc. 8 / T2 enc. 5).

| Papel | Pessoa |
|---|---|
| Coordenação | **Marina Costa** |
| Auxiliar executivo (papel `supervisor`) | **Paula Nunes** — supervisiona 6 duplas (T1 e T2) |
| Mentor DPP | **André Lima** — Ana (T1) e Caio (T2) |
| Mentor DPP (outro) | **Renata Gomes** — Pedro Ramos (T2) e outras |
| Mentor especialista | **Luísa Prado** — carreira/portfólio |
| Mentorados | **Ana Souza** (T1, 17 anos, enc. 8) · **Caio Martins** (T2, enc. 5, registro 4 pendente → semáforo "atenção") · **Pedro Ramos** (T2) · Sofia (T1) com Ricardo (mentor) |
| Outros especialistas (catálogo) | Ricardo Almeida (vendas/empreender) · Beatriz Fontoura (projetos/apresentações — indisponível) · Tomás Ribeiro (finanças/primeiro emprego) |

Estado de cada jornada:
- **Ana**: encontro 8 hoje 19h (Meet) · trilha com **Luísa Prado — "Carreira e portfólio"**, sessão **3 de 5** sex 10/out 16h–16h50 confirmada; sessão 1 ✓ registro; sessão 2 ✓ registro entregue + Ana avaliou ★4 ("me ajudou a montar o portfólio"); sessão 4 sem horário; sessão 5 trancada. Avaliação do encontro 7 pendente (fecha sex 23h59). Prazo da trilha: até 19 dez (~3 meses).
- **Caio**: encontro 5 amanhã (qua) 19h presencial Biblioteca Comunitária, local a confirmar; registro do encontro 4 pendente. **Sem trilha de especialista; pedido "Finanças" no mural desde 30 set** (nenhum especialista aceitou ainda).
- **Pedro** (T2, DPP Renata Gomes): trilha com Luísa Prado — "Entrevistas e primeiro emprego", sessão 1 de 5 a confirmar: Pedro propôs **qui 9 out 18h** (dentro da grade da Luísa), prazo até 12 jan.
- **Grade de disponibilidade da Luísa** (semanal, faixas de 1h): seg 14–18h · qua 14–18h · sex 14–18h · sáb 9–12h. Sessões de 50 min.
- Supervisão hoje 12h30 (Paula × André, "rotina das duplas"); formação de mentores sáb 11/out 10h–12h (Sede Realiza); roda de conversa com as famílias qui 9 out 19h30 (evento oficial T1).
- Programa: 26 duplas; semáforo hoje: 2 em risco, 3 em atenção, 1 apoio aberto, resto em andamento, 1 pausada.

## 3. Regras de domínio que NÃO podem ser violadas

1. **A dupla agenda os encontros; a coordenação monitora e faz nudge — NUNCA agenda por ela.** Coordenação não tem botão "agendar encontro"; tem "lembrar/nudge", ver estado, chamada da formação. O jovem pode agendar/reagendar seus encontros DPP (com motivo no reagendamento), marcar "não aconteceu" e avaliar cada encontro (★ + comentário).
2. **Trilha de especialista é entre mentorado e especialista; coordenação só observa.** Fluxo: jovem pede (pode indicar preferência de pessoa) → pedido vai ao **mural** → um especialista aceita (aceite atômico) → nasce a trilha (5 sessões, ~3 meses) → sessão a sessão, o jovem propõe horário **dentro da grade** do especialista, que confirma/contrapropõe. **Uma trilha de especialista por jovem por ciclo** (índice único no banco) → pedido novo só quando não há trilha ativa. DPP acompanha a jornada, não participa das sessões.
3. **Pedido de apoio (chamado à coordenação) é outro sistema**: categorias `agenda · metodologia · plataforma · urgência · outro` (outro exige descrição curta). Vermelho/aberto só enquanto ninguém assumiu; ao assumir/responder sai do vermelho mas segue visível até resolver, com dono. Supervisão vê todos passivamente e só responde/assume **não-técnicos** (agenda, metodologia, urgência, outro); **plataforma é coord-only**; urgência notifica coord + supervisão (quem assumir primeiro trata). Timeline de **atualizações públicas** (datadas, visíveis ao autor) × **comentários internos** (só equipe). "Preciso de apoio" do registro abre chamado automático.
4. **Disponibilidade é primeira classe** na agenda do especialista (e no catálogo mostrada em períodos, nunca como slots clicáveis fora de trilha).
5. **Semáforo** (`saudadeDaDupla`): apoio pedido, avaliação baixa **+** dificuldade, ou ≥2 encontros atrasados → **risco**; 1 atraso, avaliação baixa, dificuldade, registro pendente ou encaminhamento vencido → **atenção**. **Apoio é eixo separado** (trabalho a fazer, não falha da dupla).
6. **Papéis e escopo**: coordenação vê tudo; auxiliar executivo (`supervisor`) lê as duplas sob sua supervisão e registra supervisões; mentor escreve só nas próprias duplas; mentorado só vê o que é dele. Jovem nunca vê dados sensíveis de outros jovens.
7. Cronogramas diferentes por turma: número do encontro **sempre qualificado pela turma** ("encontro 5 · T2"). Mentor com jovens de turmas diferentes tem **visão consolidada + visão por mentorado**. Auxiliar executivo: **por turma + consolidada**.
8. Metas/PDM: limite ~10 metas (ordem = prioridade, reordenável) e ~20 submetas **no total, recursivas** (submeta pode ter submeta), `prazo_alvo` e `atingida_em`; concluídas alimentam a retrospectiva do encerramento. Roda da Vida: **16 eixos fixos** em 4 quadrantes (Pessoal: saúde/disposição, intelecto/cultura, equilíbrio emocional, independência · Profissional: carreira, finanças, escola/universidade, contribuição social · Relacionamentos: família, amigos, amoroso, vida social · Qualidade de vida: hobbies, atividade física, realização/felicidade, espiritualidade), nota 1–10, duas aplicações (leitura inicial no enc. 1 + aplicação formal enc. 12–14) com overlay antes/depois.

## 4. Composição por tela

Cada agente recebe a sua. A base é decidida; os "resgates" são obrigatórios, não opcionais.

### agenda → `docs/mockups/agenda/v6.html` — visões: Coordenação · Auxiliar executivo · Mentor DPP · Mentor especialista · Mentorado
- **Mentor DPP** — duas abas "Minha agenda" | "Por mentorado" (as duas visões pedidas pela equipe):
  - *Minha agenda* = base da **v3**: Hoje / Amanhã / Próximos com sub-cabeçalhos, chips de escopo (Ana · Caio · Eu · Tudo), rail "Esta semana", previstos tracejados "a agendar", pendências próprias (registro 4, avaliação enc. 7) como faixa no topo de "Hoje". Item da especialista aparece como "agenda da Ana — você não participa" (sem botão de entrar).
  - *Por mentorado* = cards da **v5**: turma + barra "encontro 8 de 16 · T1" + próximo encontro + seção âmbar "você acompanha, não participa" (trilha com Luísa: sessões 1–5 em passos, registro + ★ do jovem, sessão 4 sem horário) + pendências da dupla; Caio com o **stepper do pedido no mural** (da **v4**) e a nota de que a T2 começou 3 semanas depois. Faixa "Sua semana" da v5. Seção "Do programa" (supervisão, formação).
- **Mentor especialista** — base **v4** (grade de disponibilidade grande, com sessões plotadas e a proposta de Pedro dentro da janela / uma proposta fora da grade como exceção) + cards por trilha da **v5** (prazo, sessão x de 5, registro, "propor outro horário"); eixo de horas configurável (mostre pelo menos 8h–20h, com "Editar grade" funcional na narrativa); slot "+ novo".
- **Mentorado (mobile-first)** — todos os compromissos dele com **todos** os mentores (DPP + especialista) numa lista cronológica rotulada por mentor; agendar/reagendar encontro DPP (com campo "motivo"), "não aconteceu", avaliar encontro ★, combinados; sessão 4 da trilha "escolher horário" dentro da grade da Luísa. Nunca vê dados de outros jovens.
- **Auxiliar executivo** — duas abas "Por turma" | "Consolidada" das 6 duplas dele: por turma agrupa (T1 terças/enc. 8 · T2 quartas/enc. 5, cabeçalho explicando o desencontro) com semáforo e quem está sem encontro agendado; consolidada = lista cronológica única com turma/dupla em cada item. Ações: registrar supervisão, ver ficha — **não** agenda por ninguém.
- **Coordenação** — monitora: calendário oficial do ciclo por cronograma, "semana do N-ésimo encontro" por turma (resumo "X de Y realizaram" calculado POR cronograma, nunca global), duplas sem encontro agendado/atrasadas com "lembrar" (nudge), chamada da formação, supervisões. Sem botão de agendar encontro de dupla.

### jovem-especialistas → `docs/mockups/jovem-especialistas/v6.html` — visões: Mentorado · Mentor especialista · Coordenação (só leitura) · Mentor DPP (acompanha)
- Base **v4** (mobile-first). Nav do jovem **intocada com 5 itens** (Início · Agenda · Pessoas · Materiais · Perfil; âmbar ativo): a página "Especialistas" é alcançada pelo **card-CTA da home** (da **v3**, com estado vivo: "sessão 3 · sex 16h" / "seu pedido está no mural" / compacto quando nada pendente) — mostre também a **home do jovem** como primeira tela da visão Mentorado.
- Resgates da **v5**: ciclo de vida com datas (pedido → no mural → Luísa aceitou → em andamento → concluída+devolutiva), cards de sessão com pill de estado, "Remarcar", sessão 5 trancada. Resgate da **v3**: caixa de negociação dentro da sessão a agendar ("Luísa propôs sex 16h — você tinha sugerido ter 18h → Aceitar / Propor outro") e proposta **dentro da grade** da Luísa (mostre os horários livres daquela semana como seletor *dentro da sessão*).
- Pedido de trilha: formulário curto (tema, preferência opcional de especialista, o que quer alcançar); só existe quando **não há trilha ativa** (Caio = estado "pedido no mural" + o que acontece depois; Ana = trilha ativa, sem CTA de pedir). Link terciário "Falar com a coordenação" = chamado (sistema à parte).
- **Mentor especialista**: o lado dela — **mural de demandas** (pedidos abertos de jovens, filtros por tema, "aceitar" = aceite atômico, "já foi aceito por outro") + suas trilhas ativas.
- **Coordenação**: só leitura — painel de trilhas (ativas, prazo, sessões feitas/esperadas), pedidos há X dias no mural sem aceite (alerta de acompanhamento), encerramento antecipado como única ação de exceção. Sem agendar, sem designar especialista.
- **Mentor DPP**: cartão de acompanhamento da trilha da Ana (progresso, registros, ★) — sem ações de sessão.

### duplas → `docs/mockups/duplas/v5.html` — visões: Coordenação · Auxiliar executivo · Mentor DPP · Mentor especialista
- **Decisão do Léo: base v1** ("mais limpo") — tabela densa, uma linha por dupla, chips de categoria carregando a régua. A v4 (seções + cards) foi descartada: chrome demais.
- Mitigações sobre a v1 (o que ela perdia): as **4 visões por papel**; **ações na linha** ("Lembrar" nudge + "Ver ficha"); **recência** nos sinais ("há 26 dias"); **filtros** turma/supervisão/mentor em linha única; **massa saudável colapsada** ("mostrar as outras 16 em andamento") — a lista pura não escala pra 26 duplas; **legenda** sob demanda no rodapé.
- **Sem banner de escopo** ("Você vê…") — era material de demo; a privacidade é RLS, o escopo fica nas notas do mock.
- Apoio primeiro na fila (pill azul sobre o estado real + "Abrir chamado"). Cada linha mostra turma + encontro qualificado + porquê do estado em texto corrido.
- **Coordenação**: 26 duplas, todos os filtros, Nova dupla, apoio com link pro chamado. **Auxiliar executivo**: só as 6 supervisionadas, agrupadas por turma, ação "registrar supervisão"; sem Nova dupla. **Mentor DPP ("Minhas duplas")**: André com Ana e Caio — versão enxuta em cards (semáforo, próximo passo, pendências), sem seções de gestão. **Mentor especialista**: duplas de trilha (Ana, Pedro) com progresso x de 5 e prazo.

### materiais (hub da jornada) → `docs/mockups/materiais/v4.html` — visões: Mentorado · Mentor DPP · Coordenação · Auxiliar executivo
- Base **v2**: hero "Minha jornada" com trilha de marcos (os 16 encontros agrupados por fase) + portais. **Os "materiais" aqui são os INSTRUMENTOS do programa de verdade** — não 4 portais genéricos: **Roda da Vida · PDM / Definindo minhas metas · Construindo a sua Visão · Avaliação por terceiros · Avaliação do encontro** — cada um com estado (a fazer / em andamento / feito), em que encontro entra segundo o guia (Roda inicial: enc. 1; Visão e PDM: enc. 1–4; Definindo metas: enc. 2–3; PDM revisão: enc. 9; Roda aplicação formal: enc. 12–14; 360º/autoavaliação: enc. 16) e botão que leva à tela do instrumento. Separado, o acervo de apoio (Guia do Mentorado, mensagens-modelo, Perguntas Eficazes, Escuta Ativa, CNV).
- Resgates: snippets "você escreveu…" (**v3**) — a resposta do jovem como referência (ex.: trecho da Declaração de Visão no marco do PDM); listagem interna com ação por item (**v1**).
- **Mentorado**: estante da jornada, mobile-first. **Mentor DPP**: por jovem (seletor Ana/Caio): instrumentos do guia por encontro com estado, "enviar link ao jovem" / "preencher junto agora", ver resposta, e card "como conduzir" (conteúdo de apoio). **Coordenação**: progresso por instrumento entre duplas (quantas concluíram a Roda inicial etc.), biblioteca de materiais (upload, audiência por papel, material sem arquivo = "em breve"), sem preencher pelo jovem. **Auxiliar executivo**: leitura de progresso nas 6 duplas dele.
- **Decisão em aberto a marcar**: privacidade — o que o jovem escreve nos instrumentos é visível a quem? (mentor DPP da dupla + coordenação; auxiliar executivo só o estado, não o conteúdo?). Mostre um rótulo "Quem vê" em cada instrumento e registre a decisão nas notas.

### instrumentos → `docs/mockups/instrumentos/v1.html` (tela NOVA) — visões: Mentorado · Mentor DPP · Coordenação
Uma única página com **seletor de instrumento** (abas): **Roda da Vida**, **Metas / PDM**, **Construindo a Visão**.
- **Roda da Vida** (mentorado, fluxo estilo onboarding: um quadrante por passo, progresso, animação leve): radar SVG de 16 eixos com rótulos legíveis (labels completas no desktop, abreviadas no mobile), título separado dos controles, **controles verdes** (sliders 1–10 / toque por anel), valor de cada eixo editável, passo final "resultado" com os 4 quadrantes resumidos; aplicação inicial × formal com **overlay antes/depois**. Mentor DPP: vê o radar e as duas aplicações, anota o que conversaram. Coordenação: só leitura.
- **Metas / PDM** (documento vivo): Declaração de Visão no topo; lista de **até 10 metas reordenáveis** (alça de arraste + botões subir/descer acessíveis; a ordem é a prioridade e isso está escrito na UI); cada meta com indicador de sucesso (verbo de ação + indicador + prazo), `prazo_alvo`, checkbox "atingida" com `atingida_em`, **árvore recursiva de submetas** (indentação, recolher/expandir, "+ submeta" em qualquer nível, contador "14 de 20 submetas"), progresso por meta (barra), checagem SMART (sim/rever). UI de árvore não pode ficar complexa: recolhida por padrão, profundidade máx. visível 2 níveis + "ver mais". Metas atingidas formam a **retrospectiva** (resumo no encerramento). Revisão de meio de percurso (enc. 9) como marco.
- **Construindo a Visão**: wizard de 6 perguntas reflexivas → Declaração de Visão (verbo no futuro + prazo) que alimenta o PDM.
- **Rótulo "Quem vê"** em cada instrumento (decisão de privacidade em aberto, como em materiais).

### chamados → `docs/mockups/chamados/v4.html` — visões: Coordenação · Auxiliar executivo · Mentor (DPP/especialista) · Mentorado
- Base **v3** (inbox denso + detalhe em página cheia no mobile). Resgates: master-detail em duas colunas no desktop (**v1**); indicador "mais antigo há X" e coluna/filtro de status (**v2**); composer **default = comentário interno** (corrige o erro da v3) com alternância clara para "atualização pública"; timeline que intercala atualizações públicas × comentários internos com legenda; filtros por categoria/status/atribuído, "Sem dono", "Atribuídos a mim", busca.
- **Coordenação**: fila completa, assumir/atribuir/resolver/reabrir, categoria plataforma só aqui. **Auxiliar executivo**: vê todos (passivo); ações só nos não-técnicos; plataforma aparece **bloqueado/cinza com "só coordenação"**. **Mentor/Mentorado**: "Meus chamados" (os que abriu) + detalhe com **timeline de atualizações públicas** (sem comentários internos, sem categoria plataforma de outros) + diálogo de **abrir chamado** (categorias, `outro` exige descrição curta; no registro, "preciso de apoio" abre automático).
- Tela do **diálogo de abertura** e estados vazios (inbox zerada, nenhum chamado).

## 5. Qualidade (a barra desta rodada)

- Mais detalhe que as rodadas anteriores: estados vazios, estados de erro/pendência, rótulos de escopo, microcopy explicando regras, itens "a agendar"/"em breve"/"trancado".
- Cada visão tem de ser **coerente com a matriz papel × ação** das notas. Se um papel não faz algo, o botão não existe (ou aparece bloqueado com o motivo).
- Dados sempre do dataset canônico; nunca invente pessoas novas fora das listadas (exceto figurantes óbvios em listas longas, marcados genericamente).
- Antes de terminar: abra o HTML num navegador headless (Playwright está instalado no projeto: `node` com `@playwright/test` dentro de `~/realiza.vc`) em **1280px e 390px**, confira sem overflow horizontal, troque cada visão do seletor e corrija. Rode screenshots para checar.
- Termine com um resumo: estrutura, o que veio de cada variante, matriz de papéis e **decisões em aberto**.
