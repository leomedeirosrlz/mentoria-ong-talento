# Spec — Produto e IA, rodada nov/2026

**Feature:** `specs/009-ia-produto-nov` · **Status:** Draft
**Fila:** brief ws12 (`plan/ia-produto-nov`) · **Data:** 19/nov/2026
**Base de auditoria:** `.devin-ctx/issues.md` (estado atual com `arquivo:linha`), `docs/audits/ia-canais-2026-11.md`

> Sete mudanças independentes sob o mesmo guarda-chuva de IA e produto.
> **Todas são spec-only nesta PR** — a implementação entra nas próximas
> janelas, por história. Onde a fronteira com outra spec em andamento
> existe, ela está marcada (007 = ws10 UX, 008 = ws11 telemetria).

## Problema e resultado

### US1 — Import de cronograma com modelo forte

- **Dor hoje:** coordenação importa o cronograma da turma e o parser
  determinístico falha nos PDFs reais mais difíceis — layout em colunas,
  tabelas mescladas, multi-sheet, escaneado. O botão "Montar com IA"
  existe, mas chama o modelo piso (`IA_MODEL`) sem tier, sem fallback,
  sem auditoria, sem rate limit e com teto de saída baixo — em cronograma
  completo a resposta trunca e vira "formato inválido".
- **Resultado observável:** documento complexo é processado pelo modelo
  `forte` com telemetria e revisão humana obrigatória — a coordenação só
  revisa, não redigita.
- **Como saberemos que funcionou:** um PDF de cronograma real em colunas
  produz rascunho completo com avisos acionáveis; o painel `/ia` mostra o
  evento no canal `importacao` com tier `forte`.

### US2 — Retrospectiva de encerramento compartilhável

- **Dor hoje:** a retrospectiva existe (determinística, desbloqueia no
  fim da jornada) mas vive só dentro do app — o ciclo de 16 encontros
  termina sem um artefato celebrável por pessoa.
- **Resultado observável:** ao encerrar a jornada, mentorado, mentor e
  coordenação recebem uma retrospectiva com narrativa própria — um card
  por link compartilhável e uma mensagem pronta pro WhatsApp.
- **Como saberemos que funcionou:** a mentorada abre o link dela, lê uma
  retrospectiva com números reais e destaques escritos pra ela, e manda
  no grupo da família sem login.

### US3 — "Ficar em dia" com a Liza

- **Dor hoje:** o plano de recuperação determinístico já existe (card na
  ficha + tool `plano_em_dia`), mas é estático: não pergunta o ritmo que
  a dupla aguenta, não mostra a grade de disponibilidade, nunca chega ao
  mentorado — e a Liza conversa sem um retrato consolidado da dupla.
- **Resultado observável:** o mentor conversa com a Liza para montar o
  plano — ela propõe ritmo e datas respeitando a metodologia dos
  encontros, mostra o plano em card interativo e executa passos com
  confirmação; por trás, ela conhece a dupla por um resumo consolidado
  sempre atual.
- **Como saberemos que funcionou:** mentor pergunta "como coloco a dupla
  em dia com 1 hora por semana?" e recebe o plano ajustado ao ritmo, com
  as datas já propostas na agenda dele.

### US4 — Remanejo assistido pela Liza

- **Dor hoje:** o remanejo existe e é rico (card de sugestão, dialog,
  RPC que preserva jornada), mas a Liza não enxerga os candidatos nem
  propõe nada; cenários fora do semáforo ("o mentor avisou que sai",
  "o jovem sumiu", incompatibilidade declarada) não acendem a superfície;
  e a dupla DPP remanejada fecha sem registrar desfecho.
- **Resultado observável:** a coordenação pergunta à Liza "o que faço com
  esta dupla?" e recebe as opções de remanejo com os mesmos candidatos
  ranqueados do card — com execução por confirmação e desfecho registrado.
- **Como saberemos que funcionou:** rematch proposto pela Liza aparece na
  ficha com a linhagem e o motivo corretos, e a dupla encerrada por
  remanejo carrega um desfecho.

### US5 — Mentorado registra o retroativo pela Liza

- **Dor hoje:** o mentorado já pode declarar o encontro que rolou fora da
  plataforma (RPC `registrar_retroativo_mentorado`, migrations 0207/0208)
  e a UI expõe tudo — menos o canal da Liza, que só cobre agendar/
  desmarcar/não-aconteceu/aconteceu.
- **Resultado observável:** o mentorado diz à Liza "a gente se encontrou
  sábado" e ela registra o retroativo com a mesma régua do banco.
- **Como saberemos que funcionou:** a conversa gera a row `realizado` com
  `origem='externo'` e o lembrete de registro pro mentor, idêntico ao
  caminho da UI.

### US6 — Recesso decidido pela dupla

- **Dor hoje:** o recesso é um período do cronograma da turma; a dupla que
  prefere seguir se encontrando "fura" o recesso (o agendamento não
  bloqueia), mas a plataforma não sabe — o plano de recuperação continua
  empurrando datas para depois do recesso como se a dupla parasse.
- **Resultado observável:** a dupla declara se usa o recesso do
  calendário; o plano, a agenda e a copy respeitam a escolha.
- **Como saberemos que funcionou:** dupla que declara "vamos seguir"
  recebe datas sugeridas dentro da janela de recesso; quem usa o recesso
  não vê diferença nenhuma.

### US7 — Feedback de terceiro registrado pelo mentor

- **Dor hoje:** a avaliação por terceiros só entra pelo link público
  `/t/[token]` respondido pelo próprio terceiro. O feedback colhido por
  telefone, papel ou presencial não tem onde morar — o workaround é
  digitar direto no consolidado, perdendo a evidência por contato, o
  badge "respondeu" e a contagem do instrumento.
- **Resultado observável:** o mentor lança a fala do terceiro como
  resposta marcada "registrada pelo mentor", que conta no instrumento e
  aparece na ficha como as demais.
- **Como saberemos que funcionou:** contato pendente ganha resposta com
  origem manual, selo de quem registrou e participa da consolidação como
  qualquer resposta por link.
- **Fronteira:** a UI deste fluxo é da spec 007 (ws10); aqui moram o
  modelo de dados, a RPC e as invariantes.

## Fora de escopo

- **WhatsApp Cloud API** (envio automatizado): a auditoria de canais
  marcou como não iniciado e depende de setup Meta — aqui todo contato
  externo segue via `wa.me` + `/api/nudge`.
- **Proatividade externa da Liza** (mensagem iniciada por ela fora do
  app): depende de canal de saída que não existe; a assistente pessoal
  desta spec conversa dentro do produto (chat, cards, balões contextuais).
- **Import de imagem/OCR** (foto de cronograma, PDF escaneado): o provider
  é texto-only; a fase 3 da REALIZA-180 já desenha visão — escaneado aqui
  cai no aviso honesto, não em visão.
- **Registro do encontro pelo mentorado:** o relato segue do mentor
  (decisão documentada — "o fato pode nascer de qualquer ponta, o relato
  fica com o adulto"). Esta spec preserva a fronteira.
- **Transcript da Liza no servidor:** a não-persistência de conversa é
  decisão LGPD vigente; o resumo consolidado de US3 é retrato de domínio,
  não histórico de chat.
- **UI do feedback manual** (botão, dialog): spec 007.
- **Telemetria e painel `/ia`:** spec 008 cobre a rodada de analytics;
  aqui só entram os eventos mínimos exigidos por cada feature.

## Histórias de usuário

### US1 — Import de cronograma com modelo forte (P1)

- **Por que P1:** o caminho existe de ponta a ponta; o que falta é
  roteamento, tier e observabilidade — a fatia fecha sozinha.
- **Teste independente:** importar um PDF de cronograma real em colunas
  em `/turmas/novo` e conferir rascunho + evento em `ia_eventos`.

Cenários:

1. **Dado** um documento cuja extração determinística produz rascunho de
   confiança baixa ou sinais de layout complexo **quando** a coordenação
   importa **então** o rascunho é montado pelo tier `forte` sem exigir o
   clique "Tentar com IA".
2. **Dado** um documento simples bem resolvido pelo determinístico
   **quando** a coordenação importa **então** nenhuma chamada de IA
   acontece por conta própria — o botão continua disponível a pedido.
3. **Dado** o provider indisponível ou o limite estourado **quando** o
   documento complexo chega **então** o rascunho determinístico entra com
   aviso honesto ("processamento por IA indisponível") e nunca erro fatal.
4. **Dado** qualquer processamento por IA **quando** termina **então**
   `ia_eventos` registra canal `importacao`, tool, tier, modelo, tokens e
   `lote` — e nunca conteúdo do documento.
5. **Dado** resposta da IA incompleta ou truncada **quando** a validação
   roda **então** os problemas viram avisos na prévia, e a revisão humana
   segue obrigatória — nada persiste sem o salvar da coordenação.
6. **Dado** o tier `forte` reajustado pela coordenação no painel
   **quando** o próximo import roda **então** a escolha quente vale sem
   deploy (config viva, fallbacks do tier).

### US2 — Retrospectiva de encerramento compartilhável (P2)

- **Por que P2:** é a maior superfície nova (artefato persistido, rota
  pública, imagem) e depende de decisões LGPD de compartilhamento; o
  valor dela não bloqueia as P1.
- **Teste independente:** encerrar uma dupla demo e abrir o link da
  retrospectiva do mentorado sem login.

Cenários:

1. **Dado** uma dupla com retrospectiva desbloqueada (fim da jornada ou
   encerramento) **quando** o artefato é gerado **então** cada audiência
   (mentorado, mentor, coordenação) recebe narrativa própria sobre o
   mesmo retrato determinístico.
2. **Dado** a retrospectiva do mentorado **quando** ela abre o link
   **então** vê um card com números reais da jornada, destaques escritos
   pra ela e primeiro nome — sem login, sem notas internas, sem contato.
3. **Dado** um destaque inventado pelo modelo **quando** a validação roda
   **então** números e fatos só vêm do payload determinístico — a LLM
   escolhe e escreve, nunca cria dado.
4. **Dado** o link compartilhado **quando** aberto **então** expiração,
   revogação e auditoria de acesso seguem o padrão dos links de relatório.
5. **Dado** dados tardios (registro salvo depois da geração) **quando** a
   retrospectiva é reaberta **então** existe caminho de re-geração
   versionado, não conteúdo congelado errado.
6. **Dado** a retrospectiva pronta **quando** a pessoa toca em
   compartilhar **então** uma mensagem de celebração pronta abre no
   WhatsApp com o link.

### US3 — "Ficar em dia" com a Liza (P1)

- **Por que P1:** o motor do plano e o canal da Liza já existem — a
  fatia conecta os dois com ritmo, GenUI e contexto, e é o item central
  do brief.
- **Teste independente:** na demo, pedir à Liza "monta o plano pra ficar
  em dia" e receber card + passos com datas.

Cenários:

1. **Dado** uma dupla DPP ativa com passos devidos **quando** o mentor
   pede o plano à Liza **então** ela devolve o mesmo plano do card da
   ficha (mesma máquina de estados), narrado e em card interativo.
2. **Dado** a pergunta "e se a gente só tiver 1 hora por semana?"
   **quando** a Liza monta o plano **então** o ritmo entra como parâmetro
   e as datas recalculam — respeitando os intervalos que a metodologia
   exige entre encontros (prática, tarefa) e o calendário oficial.
3. **Dado** níveis de flexibilização **quando** o atraso ou o
   comprometimento pioram **então** o plano propõe o nível adequado —
   ritmo normal, semana dupla, ou conversa com a coordenação quando a
   conta não fecha antes do encerramento.
4. **Dado** um passo do plano que o mentor aceita **quando** ele confirma
   **então** o agendamento acontece pelo mesmo caminho validado do
   agendamento manual (escrita em duas fases, RLS do dono).
5. **Dado** a Liza conversando sobre uma dupla **quando** precisa de
   contexto **então** ela lê um resumo consolidado curto da dupla —
   trajetória, registros recentes, perfil e interesses do mentorado,
   próximos encontros — sempre atual, sem depender do histórico da
   conversa.
6. **Dado** a grade de disponibilidade do par **quando** a Liza propõe
   datas **então** a interseção mentor × mentorado aparece em card de
   agenda (GenUI) em vez de texto solto.
7. **Dado** o plano montado **quando** o mentorado abre o app dele
   **então** ele enxerga o que foi combinado pra ele — o plano hoje é
   invisível do lado do jovem.

### US4 — Remanejo assistido pela Liza (P2)

- **Por que P2:** a infra de remanejo já é a mais completa do domínio;
  a fatia da Liza é leitura + escrita confirmada, e a correção do
  desfecho em rematch DPP é pequena mas sensível.
- **Teste independente:** coordenacao pergunta "quem pode assumir a dupla
  X?" e recebe a lista ranqueada; execução só com confirmação.

Cenários:

1. **Dado** uma dupla em risco ou com apoio aberto **quando** a coord
   pergunta opções à Liza **então** ela devolve os mesmos candidatos
   ranqueados do card de sugestão (mentores por vaga e afinidade, fila
   aguardando par).
2. **Dado** cenários que o semáforo não acende — saída avisada do mentor,
   jovem sumido, incompatibilidade declarada **quando** a coord abre a
   ficha **então** a superfície de remanejo também aparece, não só em
   risco/apoio.
3. **Dado** a decisão de remanejar **quando** a coord confirma na Liza
   **então** a execução usa o mesmo caminho auditável do rematch atual —
   preservando jornada, registros e PDM — com confirmação humana.
4. **Dado** uma dupla DPP remanejada **quando** a origem encerra
   **então** o desfecho `remanejada` fica registrado com motivo — hoje a
   dupla fecha sem desfecho nem data de encerramento.
5. **Dado** "o jovem desistiu" **quando** a coord narra à Liza **então**
   o fluxo guia os dois passos (marcar situação do mentorado, depois
   remanejar o mentor) sem pular entre telas desconectadas.
6. **Dado** um papel sem permissão (mentor, jovem) **quando** pede
   remanejo à Liza **então** a tool nem aparece no catálogo dele — allowlist
   por papel, como nas demais escritas.

### US5 — Mentorado registra o retroativo pela Liza (P3)

- **Por que P3:** backend e UI já entregam o gesto completo; sobra a
  última milha no canal da Liza — pequena e sem risco de domínio.
- **Teste independente:** jovem demo diz à Liza "nos encontramos sábado"
  e a row nasce igual à da UI.

Cenários:

1. **Dado** encontro passado sem row **quando** o mentorado declara à
   Liza **então** a tool chama a mesma RPC da UI — com todos os guards
   (passo oficial vencido, não o último, data passada, piso de início).
2. **Dado** um retroativo criado por ele e ainda sem registro do mentor
   **quando** o jovem pede pra corrigir ou desfazer **então** a Liza
   executa edição/desfazimento pela mesma RPC — com notificação ao mentor.
3. **Dado** caso vedado (último encontro, já respondido por outro autor,
   `nao_aconteceu`) **quando** o jovem tenta **então** a Liza devolve a
   mensagem de domínio exata e orienta (o registro é do mentor).
4. **Dado** o encontro retroativo registrado **quando** o mentor abre a
   ficha **então** o lembrete "conte como foi no registro" está lá —
   idêntico ao caminho da UI.

### US6 — Recesso decidido pela dupla (P2)

- **Por que P2:** é domínio novo (decisão por dupla sobre evento da
  turma) com efeito no planner — pequeno, mas toca trilha, plano e copy.
- **Teste independente:** marcar "vamos seguir" numa dupla demo e ver o
  plano sugerir data dentro do recesso.

Cenários:

1. **Dado** um cronograma com período de recesso **quando** o mentor da
   dupla declara "vamos seguir nos encontrando" **então** o planner pode
   sugerir datas dentro da janela e a agenda mostra o período como
   disponível pra dupla.
2. **Dado** a decisão "vamos usar o recesso" (o default) **quando**
   qualquer superfície calcula **então** nada muda — o comportamento
   atual é o caminho padrão.
3. **Dado** a decisão registrada **quando** a coordenação lê a ficha
   **então** ela vê a escolha da dupla — visível, não implícita.
4. **Dado** a declaração feita **quando** o mentorado abre a agenda dele
   **então** a copy reflete o combinado ("vocês seguem durante o recesso").
5. **Dado** a dupla mudando de ideia **quando** a declaração é refeita
   **então** a última decisão vale, com registro de quando mudou.

### US7 — Feedback de terceiro registrado pelo mentor (P1)

- **Por que P1:** modelo e RPC autocontidos, destrava a UI da spec 007 e
  fecha um buraco operacional real do instrumento.
- **Teste independente:** RPC nova aplicada em staging → INSERT manual em
  contato pendente → resposta com `origem='manual'` aparece na ficha.

Cenários:

1. **Dado** contato pendente ou expirado **quando** o mentor registra a
   fala coletada fora da plataforma **então** o contato vira respondido
   com origem manual, quem registrou e como foi coletado.
2. **Dado** contato já respondido (por link ou manual) **quando** qualquer
   escrita tenta **então** a resposta é imutável — igual à régua do link.
3. **Dado** a resposta manual na ficha **quando** staff lê **então** a
   origem aparece ("coletada por telefone, registrada pelo mentor") —
   nunca disfarçada de resposta por link.
4. **Dado** a consolidação **quando** o mentor publica **então** respostas
   manuais entram na síntese como as demais — e o jovem continua lendo
   só o consolidado publicado.
5. **Dado** o registro manual **quando** salvo **então** a declaração de
   consentimento da coleta fica registrada (o mentor atesta que a pessoa
   autorizou) — o link era a evidência; na entrada manual a evidência é
   declaratória.
6. **Dado** mentor de outra dupla ou jovem **quando** tenta a RPC
   **então** a autorização é a mesma do consolidado: mentor da dupla ou
   coordenação, trilha DPP, dupla viva.

## Casos de borda

- **US1:** PDF escaneado (texto quase vazio) cai em aviso honesto, não em
  chamada de IA; documento >30k chars trunca antes do modelo com aviso;
  resposta IA divergente do determinístico coexiste como rascunho
  distinto — o usuário escolhe qual revisar; reprocessar pode dar
  rascunho diferente (LLM não é determinística).
- **US2:** dupla encerrada sem retrospectiva gerada gera sob demanda;
  trilha especialista (dados esparsos) degrada com elegância; token
  expirado/revogado mostra página honesta; mentorado menor — card sem
  sobrenome, contato nem notas internas.
- **US3:** dupla pausada/encerrada/sem cronograma → plano "não aplicável"
  com motivo (já é a régua); jovem pedindo plano recebe a versão do
  recorte dele, nunca o semáforo; ritmo absurdo (10 encontros/semana) é
  recusado com explicação; plano que não cabe antes do encerramento
  propõe falar com a coordenação em vez de prometer impossível.
- **US4:** rematch em dupla já encerrada ou de outra trilha → recusa da
  RPC; mentorado novo já em dupla na trilha → recusa; remanejo narrado
  por mentor não executa nada (só coord escreve).
- **US5:** retroativo em trilha especialista não existe pro jovem (só o
  mentor cobre) — a Liza explica a fronteira; edição vedada depois que o
  mentor registra (selado) → mensagem de domínio.
- **US6:** recesso já passado → declaração sem efeito, sem erro; cronograma
  editado depois da declaração (recesso movido) → decisão segue o evento,
  não a data; dupla com retroativo dentro do recesso → vale normalmente.
- **US7:** contato respondido expira o token — `/t/[token]` mostra
  "Resposta já registrada" (comportamento desejado); cap de 9 contatos
  por dupla segue valendo; resposta manual em trilha especialista →
  recusa (instrumento é DPP).

## Requisitos funcionais

- **FR-001 (US1):** o import classifica o documento com sinais
  determinísticos (confiança do rascunho, densidade de texto do PDF,
  indício de colunas/multi-sheet); documento complexo vai ao tier `forte`
  sem depender do clique, documento simples resolve determinístico.
- **FR-002 (US1):** a chamada usa a config viva do tier `forte`
  (modelo, esforço, cadeia de fallbacks) — nunca `IA_MODEL` solto.
- **FR-003 (US1):** esforço do processamento permite saída completa do
  cronograma (sem truncamento do JSON da tool; truncamento detectado vira
  aviso de prévia, não erro fatal).
- **FR-004 (US1):** todo processamento IA do import passa por rate limit
  no canal `importacao` e grava `ia_eventos` com args minimizados
  (`lote`, formato, páginas, chars, tier) — conteúdo do documento nunca é
  auditado.
- **FR-005 (US1):** revisão humana obrigatória se mantém — a IA alimenta
  a prévia editável; persistir segue pelo `criarCronograma` atual.
- **FR-006 (US2):** a retrospectiva é artefato persistido por dupla ×
  audiência (mentorado, mentor, coordenação), gerado quando a jornada
  desbloqueia ou sob demanda — nunca por request de página.
- **FR-007 (US2):** a LLM recebe só o recorte autorizado da audiência
  (privacidade aplicada antes do modelo): mentorado sem notas internas e
  sem identificar terceiros; mentor respeitando os lotes de privacidade
  de avaliação; prosa ancorada no payload determinístico.
- **FR-008 (US2):** o card é compartilhável por link público com
  expiração, revogação, senha opcional e log de acesso — o padrão dos
  links de relatório.
- **FR-009 (US2):** o compartilhamento oferece mensagem pronta de
  WhatsApp e imagem de preview (OG) própria — primeiro nome e números,
  nunca contato nem notas.
- **FR-010 (US3):** a tool `plano_em_dia` aceita ritmo (encontros por
  semana) e devolve o mesmo resultado do card — uma única máquina de
  estados alimenta ficha, Liza e testes.
- **FR-011 (US3):** existem níveis nomeados de flexibilização derivados
  do plano (ritmo disponível × atraso × data de encerramento) com ação
  sugerida por nível — inclusive, quando a conta não fecha, as saídas
  honestas: troca de dupla (US4), conversa com a coordenação ou o
  encaminhamento ao encerramento da trilha DPP com continuidade pela
  trilha especialista.
- **FR-012 (US3):** a Liza executa passos do plano por escrita em duas
  fases (prévia → confirmação humana) com os mesmos guards do
  agendamento manual; "quem agenda é a dupla" segue valendo — a Liza
  agenda pelo mentor, nunca no lugar dele.
- **FR-013 (US3):** existe resumo consolidado curto por dupla acessível à
  Liza (trajetória, registros recentes, perfil/interesses do mentorado,
  próximos encontros, pendências), materializado e atualizado — não
  recomputado a cada mensagem.
- **FR-014 (US3):** a interseção de disponibilidade mentor × mentorado
  aparece em GenUI de agenda quando a Liza propõe datas.
- **FR-015 (US3):** o mentorado enxerga o plano combinado no recorte dele
  (sem semáforo, sem motivos internos).
- **FR-016 (US4):** tool de leitura devolve os candidatos de remanejo
  ranqueados pelo mesmo projetor do card da ficha (vagas e afinidade,
  fila aguardando par).
- **FR-017 (US4):** a execução do remanejo pela Liza é coord-only com
  confirmação — e usa a mesma RPC auditável do rematch atual.
- **FR-018 (US4):** o gatilho da superfície de remanejo amplia para além
  do semáforo (saída declarada, jovem inativo, incompatibilidade
  registrada) — critérios concretos no plano.
- **FR-019 (US4):** rematch DPP registra desfecho `remanejada` + motivo
  na dupla encerrada (hoje fecha sem desfecho).
- **FR-020 (US4):** o fluxo "mentorado desistiu" guia a sequência marcar
  situação → remanejar mentor como um percurso único.
- **FR-021 (US5):** tools da Liza para `registrar_retroativo_mentorado` e
  `desfazer_retroativo_mentorado`, allowlist `mentorado`, espelhando a
  régua das RPCs — com devolução das mensagens de domínio.
- **FR-022 (US6):** a decisão de recesso é por dupla e por período de
  recesso do cronograma; default = usa o recesso (comportamento atual);
  última declaração vale, com data de quando mudou.
- **FR-023 (US6):** o planner respeita a escolha — opt-out permite
  sugestão dentro da janela; uso mantém o empurrão para o fim.
- **FR-024 (US6):** a escolha é visível para coordenação, mentor e
  mentorado (copy honesta por superfície).
- **FR-025 (US7):** `terceiros_respostas` ganha origem (`link`|`manual`),
  quem registrou, via de coleta e declaração de consentimento.
- **FR-026 (US7):** RPC `security definer` nova registra resposta manual
  com a autorização do consolidado (mentor da dupla ou coordenação,
  trilha DPP, dupla ativa/pausada), transição atômica
  pendente|expirado→respondido, e não notifica o próprio autor.
- **FR-027 (US7):** respostas manuais aparecem nos instrumentos/ficha com
  marca de origem e entram na consolidação como as demais — sem caminho
  de leitura novo pro jovem (ele lê só o consolidado publicado).
- **FR-028 (global):** toda escrita nova por tool da Liza usa o núcleo de
  validação de `escritas.ts` ou RPC `security definer` — nunca update
  direto fora da fronteira.

## Requisitos não funcionais

- **RLS:** remanejo e encerramento coord-only; retroativo jovem escopado
  à própria dupla ativa via as mesmas views definer de hoje; resposta
  manual com a autorização do consolidado; resumo consolidado lido por
  RPC definer com recorte por papel — jovem nunca recebe semáforo nem
  notas internas.
- **Auth:** a rota pública da retrospectiva entra em `isPublic` com e2e
  do caminho feliz e do token inválido; sem grant de tabela para `anon`
  (padrão token de posse + RPC definer, como `/t` e `/resumo`).
- **LGPD:** card compartilhável de provável menor = allowlist de campos
  (primeiro nome, contagens, prosa) + inventário `docs/lgpd/` na mesma PR
  de implementação; texto do documento de import segue indo ao provider —
  base legal já aberta no backlog, esta spec não a piora (mesmo escopo,
  melhor auditoria); entrada manual de terceiro exige consentimento
  declaratório; nenhum transcript de chat novo persistido.
- **Demo:** retrospectiva, plano, remanejo e terceiros precisam de
  paridade em `/demo` — dataset com dupla encerrada, respostas de
  terceiros e a Liza demo respondendo as novas tools pelos projetores.
- **A11y/perf:** GenUI novo segue o padrão dos cards existentes (rótulo
  textual, nunca só cor); geração de retrospectiva fora do caminho de
  request (job ou on-demand cacheado); import IA com orçamento de tempo
  explícito para documentos grandes.

## Entidades e dados

- **`terceiros_respostas`** ganha `origem` ('link'|'manual'),
  `registrado_por`, `coletado_via`, declaração de consentimento —
  invariante `contato_id` único e imutabilidade de respondido mantidos.
- **`dupla_recessos`** (entidade nova): decisão da dupla sobre um período
  de recesso do cronograma — uma row por dupla × evento recesso, com a
  decisão e quando foi declarada.
- **`retrospectivas`** (entidade nova): artefato por dupla × audiência —
  payload determinístico, narrativa, versão, quando e por qual modelo foi
  gerado.
- **`dupla_resumo_ia`** (entidade nova ou materialização existente
  expandida): resumo consolidado curto da dupla pra Liza — precedente é
  `dupla_saude_snapshots` (materialização diária por job).
- **`ia_eventos.canal`**: `importacao` cobre o import de cronograma (a
  0193 já criou o canal — nenhum vocabulário novo).
- **Tools da Liza (registry):** `plano_em_dia` ganha ritmo; novas
  `remanejo_opcoes` (leitura) e `remanejar_dupla` (escrita coord);
  `jovem_registrar_retroativo` / `jovem_desfazer_retroativo`
  (escrita mentorado); `resumo_dupla` (leitura do consolidado);
  `declarar_recesso` (escrita mentor). GenUI novo: card de
  disponibilidade (grade dia × período) e card de retrospectiva.
- **`duplas`:** rematch DPP passa a gravar `dupla_desfecho='remanejada'`
  + ledger `dupla_eventos` (o enum já existe — hoje a RPC fecha sem
  desfecho).

## Critérios de sucesso

- **SC-001:** o cronograma real de 2026 em PDF de colunas importa com
  rascunho completo revisável, sem redigitação — e todo evento auditado.
- **SC-002:** uma dupla encerrada gera três retrospectivas distintas por
  audiência, e o link do mentorado abre sem login com preview de card.
- **SC-003:** mentor monta um plano "em dia" pela Liza com ritmo próprio
  e agenda os passos confirmando um a um — sem sair do chat.
- **SC-004:** coordenacao executa um rematch pela Liza com candidatos
  idênticos aos do card, e a dupla origem fecha com desfecho.
- **SC-005:** jovem registra retroativo pela Liza e o mentor recebe o
  lembrete de registro — paridade total com a UI.
- **SC-006:** dupla que opta por seguir no recesso recebe sugestões de
  data na janela; a que usa o recesso não percebe mudança.
- **SC-007:** feedback de terceiro colhido por telefone entra na ficha
  com selo de origem e conta no instrumento — sem gambiarra no
  consolidado.

## Premissas

- O tier `forte` do `ia_config` é o "modelo forte" do brief — a escolha
  concreta do slug é da coordenação (config quente), não da spec.
- Auto-disparo da IA no import: "deve passar pela LLM" lido como —
  documento com sinais de complexidade processa com IA sem exigir clique;
  o botão continua para os demais casos. A revisão humana é intocável.
- A escrita de remanejo pela Liza entra como requisito (a infra de
  confirmação em duas fases existe justamente para escritas sensíveis);
  se a decisão de produto for "só leitura + atalho pro dialog", desce no
  clarify sem mudar o restante.
- "A dupla decide o recesso" = o mentor declara na plataforma (a decisão
  é combinada entre os dois fora da tela); o mentorado enxerga e pode
  pedir mudança pela Liza — a gravação final é do mentor.
- Retrospectiva gera por job no encerramento (custo previsível), com
  geração sob demanda para duplas já encerradas — nunca por pageview.
- O consentimento de divulgação de depoimento da avaliação 360 reaproveita
  para a prosa da retrospectiva; o card em si não publica depoimento sem
  esse consentimento.
- O resumo consolidado da dupla é dado de domínio (não transcript), com
  o mesmo recorte de privacidade das tools atuais — texto livre de
  registro segue fora do que vai ao modelo, salvo decisão LGPD explícita.
- O fluxo "encerrar DPP → trilha especialista" é sugestão assistida com
  confirmação (leitura dos sinais de estagnação/rito) — a escrita do
  encerramento segue coord-only como hoje.
