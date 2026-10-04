# Análise da transcrição — experiência do mentor

Fontes: `~/Downloads/Desenvolvimento - Realiza_vc Transcrição.txt` (784 linhas, Google Meet, ~1h) **+** `~/Downloads/Novos sistemas Realiza.pdf` — a **ata formal** da mesma reunião (01/out/2026), que confirma as decisões que saíram da discussão e adiciona uma spec detalhada da tela de agendamento que a transcrição não captura por inteiro.
Participantes: Kelyng (mentora, usuária avaliadora), Leonardo (coordenação/ops), Thiago (dev/produto).

**Nota de método.** A transcrição tem atribuições trocadas, falas fundidas e ASR ruim ("Karen" por Kelyng, "Lelvy" etc.). Cada achado abaixo foi inferido por semântica e intenção — não pelo texto literal — e cruzado com o código atual. Onde a atribuição muda a interpretação, está marcado. Incerteza preservada onde o texto não sustenta conclusão. **A ata é a fonte que conta**: quando a transcrição é ambígua mas a ata registra uma decisão, a ata vence.

**Contexto que atravessa tudo:** Kelyng nunca tinha entrado na versão real — o doc de sugestões dela foi feito sobre a **demo**, porque o primeiro login falhou (bug `shouldCreateUser`, corrigido ao vivo na reunião, commit `bb67ad6`). Parte do walkthrough rodou numa conta de coordenação, não de mentora — feedback parcialmente contaminado.

---

## 1. O achado central: a ação mora longe do objeto

Tema mais repetido da sessão. A mentora articula sozinha o princípio — **"a telinha de dupla é a tela de trabalho do mentor"** (45:24) e **"quanto mais informação na telinha dupla, menos a gente tira o usuário de lá, e menos ele perde o foco"** (46:21) — e depois tropeça nele três vezes.

### 1a. "Só achei reagendar, não achei agendar" — duas vezes (demo ~15:00 e real ~49:37)

Causa raiz confirmada: quando existe `pendenteRegistro`, o slot primário do header vira **"Registrar encontro"** e o `AgendarEncontroDialog` **desce pro menu "⋯ Mais"** (`src/app/(app)/duplas/[id]/page.tsx:331-347` vs `486-503`). Ou seja: **quanto mais atrasada a dupla — quem mais precisa agendar — menos visível fica o Agendar**. Os únicos rótulos expostos são "Remarcar" e "Registrar". Ela descreveu exatamente isso na demo, e na hora de usar de verdade repetiu: *"Eu posso agendar dentro dessa telinha de dupla?"* (atribuição do Meet diz Thiago; semanticamente é ela perguntando — quem guia não pergunta onde está a ação).

### 1b. "Como o sistema sabe que é o encontro 2?" — nunca respondida (50:10, reprise 55:01)

O botão agenda `proximoNumero` implícito (`alvoAgendamento`, `src/lib/ciclo.ts`); na agenda, o número é inferido **do dia oficial clicado** (`AcaoDiaMentor`, `agenda-calendario.tsx:2184-2290`). Dois modelos mentais em duas telas, e **nenhum diz o número antes do clique**. O caso real dela quebra o modelo: com o Daniel um encontro atrasou e caiu numa semana com dois oficiais — *"se ele pegar a semana e entender que é o encontro na semana, no meu caso, vai dar pau"*. Confirmado: `agendarEncontro` valida só `1 ≤ numero ≤ maxNum`, sem trava de ordem, e clicar no dia oficial da "semana 5" agenda o nº 5 mesmo com 1–4 sem row.

### 1c. Clique no "3" da trilha = clique-morto (58:01)

`TrilhaJornada`: nó **com** encontro → âncora `#registrar-{id}`; nó **sem** row → `/duplas/{id}` pelado (`trilha-jornada.tsx:258-263`). Componente com hit-area de 44px e hover que grita "sou clicável" — e não faz nada. Ela clicou e o sistema "quis que ela registrasse o primeiro", sem explicar por quê.

### 1d. Pedido explícito (56:55): "o botãozinho Agendar dentro de cada sessão do encontro"

*"A gente não pode botar ele dentro de cada sessão do encontro, ao invés de ficar lá em cima sozinho?"* — `EncontroRow` de encontro futuro mostra "Data a combinar" e nenhum affordance de agendar (`page.tsx:1026-1063`).

**Resolução convergente dos três pedidos dela:** a ação mora no encontro, com o número explícito — cada card/pass o sem row oferece "Agendar encontro N" (resolve 1b e 1d), o CTA global vira atalho rotulado ("Agendar 3º encontro"), e remarcar pede alvo explícito. O `RegistrarRetroativoDialog` já tem o select "Qual encontro foi" — o agendamento normal não.

---

## 2. Proveniência de datas: sugerido × agendado × remarcado

- **Hierarquia invertida no calendário:** encontro oficial do ciclo = disco lime numerado grande; encontro agendado pela dupla = dot de 8px com anel (`agenda-calendario.tsx:1348-1397`). A sugestão da coordenação pesa visualmente mais que o compromisso real. Ela entendeu o conceito sozinha ("esses verdinhos são datas sugeridas") — positivo — mas propõe: **sugerido em amarelo + legenda, verde = o que ela agendou, original superado em cinza** (50:53–53:02).
- **`motivo_reagendamento` existe mas é invisível:** select + texto livre no dialog, gravado na row (`actions.ts:1556-1572`) — mas só o **último** motivo sobrevive (campo sobrescrito, sem histórico/contagem) e não aparece no calendário. Ela pediu exatamente isso sem saber que existia: *"a pessoa colocar uma justificativa, por que tá reagendando… pra coordenação acompanhar — é o jovem que tá pedindo, é o mentor que não tá disponível… sinaizinhos de remarcação, pra não perder esse histórico"*. Thiago teve que narrar a feature (54:37) — feature que precisa de narração é feature invisível.
- **A motivação real (55:27):** *"se o sistema já não esquecer mais, eu tenho que olhar no WhatsApp. Eu não lembro por que a gente teve uma semana com dois encontros."* O "porquê" das remarcações mora no chat e morre na memória — a coordenação precisa auditar aderência. É rastreabilidade, não perfumaria.
- **Dialog dual trai:** `AgendarEncontroDialog` com data passada vira `registrarEncontroRetroativo` silenciosamente — "ele tá falando que eu fiz" (52:21). A virada de modo é nota de rodapé.
- **Feedback pós-agendar fraco:** *"ele não mostra pra mim alguma coisinha pintada, né?"* — o dia ganha só o dot de 8px.

### 2a. A spec de agendamento que a ata formaliza (novo vs. transcrição)

A ata transforma o achado §2 num spec concreto, decidido em reunião — vai além do que a fala captura:

- **Sugerido = laranja, não verde.** Hoje `ciclo_eventos` renderiza como disco lime numerado — a cor de "confirmado". Ata: *"a coloração das bolinhas será laranja e uma legenda será adicionada: 'Encontro pendente de agendamento'"*. O verde passa a significar exclusivamente "o mentor agendou".
- **Clique na bolinha laranja → popup de agendar.** *"O mentor deverá clicar sobre a bolinha laranja e agendar. Um popup será exibido com o número do encontro, data (mesma da bolinha), horário e link da sessão. Ao confirmar a bolinha muda para verde e será exibida na data escolhida."* — é a solução canônica do problema "ação junto ao objeto" (§1): o alvo do agendamento vem **do objeto clicado**, não de inferência implícita.
- **Células do dia com verde-pastel onde mentor E mentorado têm disponibilidade.** Usa a grade `disponibilidade` que já existe no schema (`0034/0038`) — hoje serve só o matching; aqui vira affordance de "quando dá pra marcar".
- **Painel lateral por estado:** bolinha laranja → à direita, informações e arquivos da coordenação daquele encontro + botão "Agendar encontro"; bolinha verde sem avaliação registrada (dot menor ao lado como indicador de pendência de avaliação) → info/arquivos + "Remarcar" + "Entrar na chamada" (se link) + "Editar link da chamada" + "Registrar como foi" (se data ≤ hoje). Pergunta aberta na própria ata: *"colocar também um botão para copiar o link?"*
- **Visão calendário Google como alternativa discutida:** nome do encontro dentro da célula do dia, simbologia distinta pra pendente/agendado/cancelado-remarcado — sem decisão; a spec das bolinhas é a que está escrita como definitiva.
- **O que a spec NÃO resolve** — e a transcrição mostra que importa: clicar na bolinha laranja infere o nº **da data oficial clicada**. O caso Daniel (encontro atrasado jogado pra semana com dois oficiais) continua ambíguo — a bolinha da semana 5 diria "encontro 5" quando o real é o 4 atrasado. O popup precisa permitir corrigir o nº ou o fluxo precisa do "qual encontro" explícito (o select do `RegistrarRetroativoDialog` é o precedente).

---

## 3. Papel invisível — bug de dados que virou bug de UX

A conta da Kelyng estava pré-cadastrada como **coordenação** em vez de mentor — passou a reunião inteira errada porque **nada na UI grita o papel ativo**. Três sinais independentes: ela perguntou "eu tô com o perfil de mentor?", Léo perguntou "eu sou coordenação, né?", e Thiago teve que "colocar você como coordenação". No código: o papel existe (`papelCurto` no header, `app-shell.tsx:119`) mas é `text-xs text-muted-foreground` — e **no OnboardingFlow o AppShell inteiro é substituído**, ou seja, exatamente no momento em que a pessoa mais precisa saber quem o sistema acha que ela é, não há badge nenhum.

- **Copy de onboarding mentor-cêntrica:** passo 0 fala "a jornada da sua **dupla**" pra coordenador, que não tem dupla (`onboarding-flow.tsx:481`). Léo leu em voz alta e objetou: *"eu que sou coordenador, deveria ser tipo 'você que vai fazer a gestão do programa'"*. `RECURSOS` já é por papel — só o hint não é. Barato.
- **Import CSV silencioso:** papel em branco → `mentor_dpp` por default (`importar-csv-dialog.tsx`). Vale resumo pós-import ("12 mentores, 1 coordenação") pra pegar erro de cadastro na hora.
- **Colisão do termo "supervisor" — decidido na ata:** o manual do programa tem o "supervisor de relacionamento" (mentor experiente eleito, apoia outros mentores); o `supervisor` do sistema é "mais um assistente da coordenação". A ata formaliza: **renomear `supervisor` → "assistente de coordenação"**. Dívida de vocabulário — quanto mais dados acumularem, mais caro muda; fazer cedo.
- **Sessão-surpresa no handoff:** *"agora você tá como eu"* — ela abriu o link e entrou na sessão de coordenação dele. Funciona como projetado, mas o link carrega identidade sem declarar — vale "entra como {nome}" no e-mail/landing.

---

## 4. Formulários: três modelos mentais colidindo

- **O pedido real do Léo (43:08–44:09) — decidido na ata:** avaliação **dentro de cada encontro, dos dois lados** — "cada um na sua visão" — agregando automaticamente na 360. Justificativa: *"responder no momento que terminou é muito melhor do que pensar depois"*. Thiago endossa (45:15); a ata formaliza: *"Avaliação 360: sugestão de integrar diretamente ao registro de cada encontro — mentor e mentorado avaliam logo após, enquanto está fresco; avaliação geral do programa ao final."* Hoje: o lado do mentor existe (`registros.avaliacao`); **o mentorado não tem canal in-app** — só link externo `/f/[token]`. `formulario_links.dupla_id/contexto` já amarra link à dupla — o gancho técnico existe.
- **Kelyng projetou um modelo que não existe (44:36–45:02):** vínculo declarativo de finalidade — "a autoavaliação serve pra avaliar as duplas, então o sistema pega esse modelo e coloca na telinha de duplas pra cada encontro" — com versionamento por turma ("versão 1, 2, 3"). A ata confirma a intenção: *"coordenação cria o modelo; sistema vincula automaticamente às duplas/encontros; permite versionar os formulários a cada turma."* Mais sofisticado que o implementado (builder genérico + link manual).
- **Nomes de instrumentos não se explicam:** ela perguntou diretamente "essa avaliação 360, o que que ela é?" — a mentora mais engajada não reconhece o instrumento oficial pelo nome. `formularios.descricao` existe; garantir que forms de sistema carreguem propósito ("avaliação final do ciclo, respondida por mentor e mentorado").
- **Anamnese Social — decidido na ata:** *"permanece em sistema externo (não entra na plataforma)"*. O instrumento `sistema=true` deve ser revisto — se a operação preenche fora, não faz sentido manter como form oficial na plataforma.
- **Pedido-chave de novo:** link no WhatsApp tudo bem — **mas também dentro da dupla**. Superfície de "pendências de formulário" na ficha (respondidos ou não), e/ou render inline pra quem está logado.

---

## 5. Primeiro acesso — falhou duas vezes pra usuária mais engajada

- **Bug real, já corrigido:** `shouldCreateUser: false` → pré-cadastrado nunca recebia magic link (`bb67ad6`, pushado ao vivo na reunião — "já fiz o push, tá no ar", e ela entrou: "o meu já está confirmado"). ~13 min de debugging ao vivo, com especulação de infra (free tier, queda de banco) porque o erro real — "e-mail não cadastrado" — não foi acreditado.
- **"E-mail não cadastrado" é beco sem saída:** a mensagem manda "falar com a coordenação" — Léo testou e a ironia é que **nem a coordenação estava pré-cadastrada**. Direção: ação real nesse estado ("pedir acesso" → notifica coordenação) ou caminho de verificação.
- **Expectativa "código" × link:** *"você mandou pra mim um código?"* — modelo mental OTP; o sistema manda link. Microcopy do e-mail pode ancorar ("clique no botão para entrar").
- **Entregabilidade Hotmail frágil:** o e-mail do Léo caiu em "arquivado" na caixa dela no início da reunião — canal que o magic link depende 100%. Monitorar Resend→hotmail/outlook; considerar link de acesso entregue por WhatsApp pela coordenação (a mecânica de `/assinar/[token]` já existe como precedente de link público escopado).
- **Ambiguidade de e-mails:** convite do Meet × magic link × convites antigos se confundem — assunto/remetente distintivos ("Seu link de acesso — Realiza.vc") + validade no corpo.
- **Ops:** walkthrough rodou na conta do Thiago (*"eu tô no meu perfil, mas seria mais ou menos assim"*) e dados de teste foram criados na base real ("vou apagar depois"). `/demo` existe pra isso — a sessão expõe que a demo não estava pronta/óbvia pra esse uso.

---

## 6. Cadastro e dados pessoais

- **ViaCEP — decidido na ata (mais amplo que a fala):** a transcrição pegou "cidade e UF"; a ata formaliza **rua + cidade + estado** no preenchimento automático. Thiago notou que bairro nem sempre vem na base → campos preenchidos mas editáveis. Coberto por `dados_civis.endereco` que já existe.
- **Expectativa quebrada da Kelyng (32:58):** *"aqui a gente não tem a rua, não tem o endereço completo da pessoa"* — os campos existem mas só no fluxo de assinatura (`assinatura-form.tsx`), coord-only. Ela esperava ver endereço completo no cadastro.
- **Matching × rede social × coordenador:** Léo quer importar o questionário de matching pro cadastro; Thiago diz que os campos atuais são "rede social/networking"; Léo rebate que coordenador não deve responder perguntas de matching ("ele tá só coordenando"). Três propósitos num form só; a intenção "networking" não é declarada, então lê como burocracia.
- **Pessoa → papel (Kelyng articulou o modelo certo, 34:25):** "cadastro da pessoa independente do perfil… eu faço o básico e depois entra uma sessão que é só pra mim, a mentor; se for coordenador, outra sessão". O onboarding já tem passos condicionais (`ehMentor`) — a ideia dela é formalizar.
- **Senha opcional não comunicada (29:22):** Léo pediu permissão duas vezes pra pular a senha — a tela `/auth/definir-senha` não deixa evidente que é dispensável ("opcional — você sempre entra pelo link do e-mail" + "Agora não").

---

## 7. Estrutural — turmas, cronogramas, papéis (bomba latente)

- **Multi-cronograma (Léo, 38:40) — formalizado na ata:** a turma de 30 alunos **já opera dois cronogramas** na vida real. Ata: *"Programa → Turmas → Cronogramas → Duplas"*; *"uma turma pode ter múltiplos cronogramas simultâneos (ex: turma atual tem 30 alunos em 2 cronogramas)"*; *"flexibilidade para ciclos mais curtos ou longos (padrão: 16 encontros em ~6 meses)"*. No código: `getCicloEventos()` devolve o calendário global inteiro e `saudadeDaDupla`/`passosDaTrilha`/`alvoAgendamento` ignoram `dupla.ciclo` — **um segundo cronograma quebra semáforo, trilha e "próximo encontro" de verdade** (esperado inflado → falso "risco"; trilha com números duplicados). É o item estrutural mais urgente porque a operação já trabalha assim fora do sistema.
- **Perfil como tabela configurável — novo detalhe na ata:** *"perfil de usuário deverá ser uma tabela onde a coordenação possa definir, criar e modificar… detalhar como configurar os acessos, os campos adicionais e como serão usados."* Mais profundo que a fala: não é só papel-por-programa, é a coordenação **criando papéis** novos. Ainda mais longe do `profiles.role` fixo.
- **Papel por programa (Kelyng, 39:32):** "nesse programa eu sou mentora, no outro posso ser supervisora ou especialista… se estiver em dois cronogramas, tenho mais de um papel". `profiles.role` único + `my_role()` em toda a RLS = refatoração profunda, não feature. Ata: *"cadastro básico único + seção adicional conforme o perfil atribuído."*
- **Hierarquia proposta (Léo, 40:36):** programa > turma > cronograma > dupla. Ele mesmo delimita escopo: pré-match/inscrições ficam fora; o que importa é execução (datas dos encontros). Matching por afinidade ele pede — a ata diz "ainda não implementado", mas **já existe** (`AfinidadePar`, migrações `0034/0038`) — confirmar com ele que está coberto.

---

## 8. Storage e uploads (ops, com pedido concreto)

- Ansiedade de infra gerou ~10 min de especulação (free tier, Lovable caindo) — mas o pedido útil saiu e a ata formaliza: **limitar tamanho de upload (ex.: PDFs comprimidos) pra não consumir cota**. Hoje só avatar tem `AVATAR_MAX_BYTES` — estender a disciplina pra evidência/documento/material + orientação de compressão (foto de celular = 3–8 MB; free tier = 1 GB storage, 50 MB/arquivo).
- **Offload pro Google — decidido como direção na ata:** *"migrar armazenamento de arquivos para o Google — o Instituto tem conta Nonprofit com 6 TB; regra proposta: arquivos que o banco precisa processar (IA, matching) ficam no Supabase; arquivos só para armazenamento vão para o Google."* É direção formal, não especulação. Implica: storage de documentos frios (PDM assinado, evidências antigas) é candidato a Drive; o que alimenta queries/semáforo permanece.

---

## 9. Menores mas reais

- **Arquivos agregados:** `ArquivosDupla` existe mas (a) **não inclui o PDM** (`duplas.pdm_url`, campo separado) — o "hub" dela ficou incompleto; (b) **some quando vazio** (`!arquivos.length → null`) — conceito indescobrível pra dupla que ainda não anexou; (c) ambiguidade não resolvida na fala dela: "todos os arquivos" = por dupla (feito) ou **cross-dupla pra mentor com vários mentorados** (não existe)? Perguntar.
- **Pedir apoio fragmentado:** três superfícies — checkbox `precisa_apoio` no registro, botão "Pedir apoio" (coordenação), item ⋯ "Solicitar mentor especialista". Ela pediu "sempre no mesmo lugar". Na mesma tela ≠ no mesmo lugar: agrupar sob um ponto de entrada ("Pedir apoio" → coordenação / especialista).
- **Microcopy de domínio na agenda:** Léo teve que perguntar se dá pra "repor uma data" pela plataforma — o modelo "sugestão oficial × agendamento real" não se comunica sozinho. Uma linha: "as datas do programa são sugestões — vocês combinam e registram aqui".
- **Termo pendente = âmbar sem ação:** ela viu o sinal e inventou teoria própria ("será que tá fazendo alguma coisa pra ele me reconhecer como ativo") — e o beco é circular: assinar o termo exige login, que já tinha falhado. Estado pendente precisa dizer a ação e o canal.
- **Virada de ano em compactos:** prosa já tem ano; `diaCompacto` ("ter 27 out") e a timeline flat de `/registros` continuam sem — o ciclo cruza dez→jan sempre. Agrupar por mês+ano ou ano quando ≠ corrente.
- **"evidência" × "arquivo":** seção agregada diz "Arquivos", pontos de upload dizem "evidência" — terminologia inconsistente residual. Manter "evidência" no domínio de auditoria/assinatura é correto; pro mentor talvez "arquivo" comporte melhor. Decisão editorial menor.

---

## 10. Positivos (vale registrar)

- **Handoff de magic link funcionou ponta a ponta** ao vivo (depois do fix); mensagem de allowlist foi lida e entendida corretamente.
- **Vocabulário agendar×registrar distinguido sozinho:** "quando é registrar, é porque eu tô falando que eu fiz o encontro".
- **"verdinhos = sugeridas" deduzido certo** — o conceito do calendário passa.
- **Modelo→instância de forms entendido instantaneamente** e estendido (versionamento).
- **Loop feedback→ship overnight funcionou:** o doc dela já tinha virado código quando ela apresentou (PedirApoioDialog, ArquivosDupla, ano nas datas).
- **RegistroForm no formato do Forms validado:** "eu acho fantástico a pessoa já avaliar aí".
- Kelyng é usuária-canário de UX: verbaliza hesitações que analytics não pega ("só não li", "eu me perco nos encontros").

---

## Backlog consolidado

### Sprint 1 — barato, alto impacto (ordem sugerida)

| # | Mudança | Por quê |
|---|---|---|
| 1 | **Spec de agendamento da ata** — bolinha oficial pendente em laranja com legenda "Encontro pendente de agendamento"; clique abre popup (nº, data, horário, link); confirma → verde na data escolhida; painel lateral com info/materiais da coordenação + ações por estado ("Agendar", "Remarcar", "Entrar na chamada", "Editar link", "Registrar como foi"); células verde-pastel onde mentor+mentorado têm `disponibilidade` em comum; indicador de avaliação pendente. **Ressalva nossa:** o popup precisa deixar o nº explícito/corrigível — clicar na data oficial não resolve o caso atrasado (§1b) | É a resposta canônica à dor central da reunião — e já está decidida |
| 2 | Agendar **por encontro** também na ficha: `EncontroRow` futuro ganha "Agendar"; nó da trilha sem row abre o dialog daquele nº (ou explica a ordem) | Complemento da spec da ata — a ficha também é superfície de agendamento, não só a agenda |
| 3 | "Agendar encontro" nunca dentro do "⋯ Mais" quando `podeAgendar` — posição estável | A ação mais frequente migra de lugar conforme estado |
| 4 | Copy do passo 0 do onboarding por papel + badge de papel visível no wizard | Coordenador lendo "sua dupla" é a primeira impressão errada; custo mínimo |
| 5 | Dialog retroativo: sinalizar a virada no título ("essa data já passou — entra como realizado") | Modo duplo silencioso gerou confusão real |
| 6 | ViaCEP no campo CEP (rua + cidade + UF auto, editável) | Decidido na ata, quase grátis |
| 7 | Estado "e-mail não cadastrado" com ação real ("pedir acesso" → notifica coord); assunto/remetente distintivos no e-mail de acesso | Beco sem saída no ponto mais frágil do funil |
| 8 | `ArquivosDupla`: incluir PDM, empty-state ("quando vocês anexarem, aparece aqui"), label "Documentos da dupla" | O hub pedido ficou incompleto e indescobrível |
| 9 | `motivo_reagendamento` visível no detalhe do dia + log append (não sobrescrito) + badge "remarcado N×" | O campo existe; falta memória — pedido explícito na transcrição |
| 10 | Constraints de upload (tipo/tamanho) + copy de compressão | Decidido na ata; protege o 1 GB |
| 11 | Senha opcional explícita no onboarding; "entra como {nome}" no link de acesso | Atritos pequenos de primeiro acesso |
| 12 | **Renomear `supervisor` → "assistente de coordenação"** | Decidido na ata; dívida de vocabulário que encarece com o tempo |

### Sprint 2 — médio

- Superfície de formulários na ficha da dupla (pendências por `formulario_links.dupla_id`; respondido/não) + vínculo declarativo form→contexto (modelo "serve pra X" → aparece onde deve).
- Micro-avaliação do mentorado por encontro (link tokenizado ancorado em dupla+nº) + agregação que pré-compõe a 360 — decidido na ata.
- Versionamento de formulários por turma — decidido na ata (a usuária assumiu que existe).
- Unificar pedidos de apoio: "à coordenação" + "especialista" sob um ponto de entrada.
- Descrição de propósito nos instrumentos oficiais (`formularios.descricao` na UI do mentor).
- Resumo de papéis pós-import CSV.
- Microcopy "datas oficiais são sugestões" na agenda; vocabulário "repôr".
- Ano em `diaCompacto`/timeline de `/registros` quando ≠ ano corrente.
- Revisitar `Anamnese Social` — decidido externo na ata; se sai da plataforma, remover do sistema ou virar upload.
- Seção de planejamento do encontro (item 3 do doc original) — `NotaEncontro` já cobre o caso base; o pedido real é "pontos específicos pendentes" (ex.: "enviar vídeo depois") — um checklist de intenções por encontro, não só nota livre.

### Visão — decisões de produto (registrar, não sprint)

- **Turma > cronograma > dupla** com `ciclo_eventos` escopado por cronograma — urgente porque a operação **já roda dois cronogramas** fora do sistema; sem isso, o segundo cronograma corrompe semáforo e trilha.
- **Papel por membership configurável** (pessoa × programa × papel; coord cria papéis) — refatoração de RLS. Ata pede tabela gerenciável pela coordenação.
- **Offload de storage** (Drive nonprofit 6 TB × Supabase 1 GB) — regra: frios no Drive, processáveis no Supabase.
- **Endereço completo no cadastro** vs só no termo.
- **Calendário estilo Google** (nome do encontro na célula do dia) — alternativa discutida, sem decisão.

### Perguntas abertas pra Kelyng/Léo

1. "Todos os arquivos" = por dupla (feito) ou agregado cross-dupla pra mentor com vários mentorados?
2. Confirmar que matching por afinidade (`AfinidadePar`) cobre o pedido dele de "sugerir duplas" — a ata diz "ainda não implementado" mas já existe.
3. O segundo cronograma já existe na operação — precisa entrar no sistema já ou pode esperar a modelagem?
4. Botão "copiar link da chamada" — pergunta ficou em aberto na própria ata.

---

## Notas de atribuição (quem disse o quê, corrigido)

- **l. 183–188:** bloco rotulado Kelyng mistura Thiago pedindo o e-mail; *"você nunca fez login aqui, né?"* é Thiago; **"Não, nunca fiz" é Kelyng** — o fato mais importante da sessão (feedback todo veio da demo porque produção falhou pra ela).
- **l. 666–676:** rótulos trocados — "eu posso agendar dentro dessa telinha?" é **Kelyng** sondando; "pode, pode, aqui" é Thiago guiando.
- **l. 74–78:** *"a maioria das coisas que você anotou eram limitações da versão demo"* é **Thiago** triando o doc dela, não ela concedendo.
- **l. 642–655** ("mandei", "coloquei no chat o link") rotuladas "Falante não identificado" = **Thiago**.
- **l. 661:** turno de Thiago contém "Não, não, eu já cliquei" — **Kelyng** (ela já tinha clicado no link).
- **l. 713:** "Não, eu quero um na quarta" = Kelyng escolhendo data.
- **l. 782** "É por isso que caiu" = provavelmente Thiago sobre o Read AI, não sobre o app.
- "Karen" (2:11) = Kelyng — ASR; checar se `profiles.nome` dela diverge do display name do Meet.
