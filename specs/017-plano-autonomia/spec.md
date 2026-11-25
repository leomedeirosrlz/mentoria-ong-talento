# Spec — Plano "ficar em dia": autonomia da dupla

**Feature:** `specs/017-plano-autonomia` · **Status:** Clarified
**Fila:** `REALIZA-518` · **Dono:** Thiago · **Data:** 23/11/2026

> **Substitui a spec 013 onde diverge:** o "ritmo máximo de 1/dia" (FR-002 da 013) e o "aceite dos dois lados" (FR-005 da 013) são substituídos por esta spec — o ritmo é escolha livre da dupla (qualquer inteiro positivo) e um aceite de membro da dupla ativa o plano, com o outro lado notificado e contestação até o primeiro encontro do escopo. O resto da 013 (projeção honesta, deadline do encerramento, passos que vencem no caminho) segue valendo.

## Problema e resultado

- **Dor hoje:** o planner escolhe o ritmo sozinho (sonda 1→2→3→1/dia) e a dupla só descobre o custo na proposta pronta; a grade de disponibilidade declarada por mentor e jovem nunca entra na conta; o recesso é tratado como fato assumido (`usa=true` implícito) em vez de decisão da dupla; e o aceite bilateral empaca o plano quando um lado demora, enquanto o auxiliar de turma e a coordenação não veem o gesto na ficha (a RPC já aceita o auxiliar via `supervisiona_dupla`).
- **Resultado observável:** as decisões do plano (ritmo, recesso e — quando falta — a grade) são respondidas uma vez por versão numa superfície própria ("Combinar o plano"), uma pergunta por tela, e o card volta a ser leitura; qualquer um dos quatro papéis (mentor, jovem, auxiliar, coordenação) propõe; um aceite da dupla ativa o plano e o outro lado é notificado com caminho de contestação.
- **Como saberemos que funcionou:** a dupla escolhe o ritmo (inclusive um número livre) e a projeção mostra o efeito real sem trocar o número; grade vazia é respondida dentro do fluxo, não ejeta pro perfil; recesso sem resposta trava só a simulação, não a tela; plano proposto pelo auxiliar ativa no primeiro aceite de quem é da dupla — e o outro lado lê "Fulano combinou um plano", nunca "vocês combinaram".

## Fora de escopo

- Garantir horário exato a partir da grade (a disponibilidade vira **preferência forte por dias/períodos em comum** na escolha das datas; não é slot nem restrição dura).
- Qualquer teto de produto no ritmo: o planner e as RPCs aceitam qualquer inteiro positivo; a UI sugere até 5 e abre campo "outro" livre; escolha que implica mais de um encontro por dia gera aviso honesto do efeito nos gaps — nunca bloqueio nem troca silenciosa. Limite técnico (payload do `escopo`), se necessário, é declarado como técnico, não de produto.
- Ampliar quem **edita** a grade de disponibilidade: só o próprio lado e a coordenação editam; o auxiliar vê a grade e pede ajuste, não edita (item US2). A decisão de recesso é da dupla: só mentor e mentorado registram, de preferência no aceite; auxiliar/coordenação veem e cobram (item US3).
- Fusão de encontros (spec 018) e card "Sua semana" (spec 019).
- Trilha de especialista (sem calendário oficial; o planner já devolve não aplicável).

## Histórias de usuário

### US1 — Ritmo perguntado, não imposto (P1)

- **Por que P1:** é a primeira pergunta do fluxo e o que torna o plano da dupla, não do sistema.
- **Teste independente:** abrir o fluxo com grades de 1, 3 e 0 dias em comum.
- **Cenários:**
  1. **Dado** uma dupla com células em comum em 3 dias **quando** a pergunta de ritmo abre **então** "Quantos encontros por semana vocês conseguem?" mostra pills (`OpcaoPilula`: 1, 2, 3, 4, 5, outro) + a sugestão honesta "Vocês marcaram períodos livres em comum em 3 dias — períodos livres não são horários marcados". A sugestão informa a contagem de **dias** com período livre em comum, não promete slot nem fecha o plano.
  2. **Dado** que quem responde escolhe um ritmo — pill ou número livre no "outro" (qualquer inteiro positivo) **quando** a simulação roda **então** a projeção usa exatamente esse ritmo e mostra o efeito real (data de recuperação, recesso no caminho) — sem o sistema trocar o número por baixo.
  3. **Dado** um ritmo que não fecha antes do encerramento **quando** a projeção renderiza **então** aparece o primeiro inteiro acima do pedido que fecharia como alternativa honesta (não o próximo da escada fixa), sem recusar a escolha nem prometer o impossível.
  4. **Dado** um ritmo que implica mais de um encontro por dia **quando** a projeção renderiza **então** a UI representa a escolha como está (ex.: "8 encontros por semana") e avisa o efeito pedagógico: os passos de prática pedem 7 dias entre si — a régua do calendário vira aviso e estado, nunca recusa.

### US2 — Disponibilidade antes de simular (P1)

- **Por que P1:** sugerir ritmo sem olhar a grade repete o erro de projetar o impossível.
- **Teste independente:** duplas com os dois lados sem grade, um lado sem grade, e interseção vazia.
- **Cenários:**
  1. **Dado** um lado (ou os dois) sem grade declarada **quando** a pergunta de ritmo abre **então** o estado é "falta confirmar a disponibilidade", respondível dentro do fluxo: preencher a grade ali mesmo (edição inline da própria grade — cada lado edita a sua, a coordenação edita qualquer uma; o auxiliar não edita grade, vê a pendência e pede o ajuste) ou responder explicitamente "vamos combinar sem a grade" — nunca ejeta pro perfil nem perde o que já foi respondido.
  2. **Dado** interseção vazia entre as grades **quando** a pergunta abre **então** o fluxo sugere ajustar a disponibilidade (inline para quem edita a própria grade; o auxiliar aponta e combina sem editar) ou falar com o auxiliar, sem simular ritmo nenhum — e também oferece a saída explícita "combinar sem a grade", com aviso.
  3. **Dado** uma grade com cobertura suspeita (célula em todo período de todo dia — caso detectável; não existe timestamp de declaração) **quando** a pergunta abre **então** o fluxo pede confirmação "a grade ainda vale?", em vez de tratar como verdade cega.
  4. **Dado** dias com período em comum **quando** o planner escolhe as datas **então** ele **prefere** esses dias no caminho; se não houver célula suficiente, ainda simula e mostra o aviso "as datas fogem dos dias em que vocês dois marcaram como livres" — nunca recusa o plano nem promete que a grade é um horário marcado.

### US3 — Recesso decidido antes da simulação (P1)

- **Por que P1:** o recesso muda a conta; assumir é o erro atual.
- **Teste independente:** dupla com recesso no caminho, sem declaração; depois com "usar" e com "seguir".
- **Cenários:**
  1. **Dado** um recesso oficial na janela e nenhuma decisão registrada **quando** o fluxo abre **então** aparece uma pergunta por recesso com as labels reais "Vamos usar o recesso" / "Vamos seguir nos encontrando" — e a simulação fica pendente até a resposta, com o resto do card legível (passos e datas visíveis, nada escondido).
  2. **Dado** a resposta "Vamos usar o recesso" **quando** ela é gravada **então** persiste `dupla_recessos.usa=true` e o recesso segue restrição (pausa) — igual ao default de hoje, agora com decisão explícita e autoria.
  3. **Dado** "Vamos seguir nos encontrando" **quando** gravada **então** persiste `usa=false` e a projeção pode sugerir datas dentro da janela — com o efeito (`alternativaRecesso`) visível antes de decidir.
  4. **Dado** que o jovem abre o plano primeiro **quando** a pergunta aparece **então** ele também pode responder (a decisão é da dupla), com autoria registrada; auxiliar e coordenação veem a pendência e o que a dupla decidiu, mas **não registram a decisão** no lugar dela.
  5. **Dado** que a dupla aceita com uma resposta de recesso diferente da proposta **quando** confirma o aceite **então** o servidor re-simula o escopo com a decisão nova em tempo real, grava a versão recalculada e, se ela fechar, a dupla já aprova a versão nova no mesmo gesto — com o pedido original e o ajuste no ledger (`dupla_plano_eventos.meta`). Se não fechar, a tela mostra o efeito antes de confirmar.

### US4 — Quatro papéis, um aceite (P1)

- **Por que P1:** a fila de aceite bilateral é o ponto onde o plano morre hoje.
- **Teste independente:** proposta por cada um dos quatro papéis e a sequência de aceite.
- **Cenários:**
  1. **Dado** o auxiliar (incluindo escopo de turma) ou a coordenação propõe **quando** a proposta nasce **então** nenhum lado está carimbado; o primeiro aceite de mentor **ou** jovem ativa o plano.
  2. **Dado** o mentor (ou o jovem) propõe **quando** a proposta nasce **então** o lado dele já conta como aceite e o plano ativa na hora; o outro lado é notificado com "Ver o combinado" e "Não serve pra mim".
  3. **Dado** o plano ativo com um aceite **quando** o outro lado abre **então** ele lê "{Fulano} combinou um plano pra vocês — você foi avisado em {data}", pode registrar a própria ciência (aceite informativo) e pode contestar ("Não serve pra mim") até o primeiro encontro do escopo realizado após a proposta — mesma régua atual (`realizado_em >= aprovado_em/created_at`); em plano ativo não se fala em "aceitar".
  4. **Dado** alguém fora da dupla ou sem papel **quando** tenta propor/responder **então** a RPC recusa (e2e do papel negado).
  5. **Dado** o auxiliar com escopo de turma **quando** abre a ficha da dupla **então** vê e usa o CTA de propor plano e acompanha a pendência de recesso, mas não registra a decisão (que é só da dupla) nem edita a grade — a permissão é calculada por `supervisiona_dupla` no servidor, não por `supervisor_id` na tela.

### US5 — Decisões numa superfície própria, uma vez por versão (P1)

- **Por que P1:** empilhar ritmo + grade + recesso dentro do card de leitura (o `plano-em-dia-card` já tem 431 linhas) vira formulário; decisão merece superfície própria.
- **Teste independente:** dupla com as três pendências (ritmo, grade, recesso) abre o fluxo e responde em sequência.
- **Cenários:**
  1. **Dado** pendências de decisão no plano **quando** a pessoa abre "Combinar o plano" **então** uma superfície própria (sheet no mobile, dialog no desktop) apresenta uma pergunta por tela — ritmo → recesso (só os que existem na janela) → confirmar — respondida uma vez por versão do plano.
  2. **Dado** tudo respondido **quando** o card renderiza **então** ele volta a ser leitura (projeção + combinado); com pendência, uma linha discreta "Falta 1 decisão" + CTA pra superfície — o card nunca vira formulário permanente.
  3. **Dado** a projeção mudando conforme as respostas **quando** recalcula **então** a mudança é anunciada (`role="status"`/`aria-live`) e a transição respeita reduced motion.

## Casos de borda

- Grade com período genérico demais (célula em todo período de todo dia): a contagem de dias mente — tratar como "confirme se a grade ainda vale" (único caso detectável; não há timestamp).
- Dupla que nunca declarou disponibilidade e não quer declarar: a saída honesta é a resposta explícita "vamos combinar sem a grade" (com aviso de que a sugestão de ritmo fica cega) + falar com o auxiliar — nunca travar o plano para sempre.
- Ritmo livre que implica >1 encontro por dia (ex.: 8+): o sistema representa e avisa o efeito nos gaps de prática/tarefa — não clampa, não recusa, não troca o número.
- Recesso já declarado antes da rodada: a decisão persistida vale e a pergunta não reaparece naquela versão.
- Dois recessos na janela: uma pergunta por recesso, decisões independentes.
- Proposta criada e o outro lado nunca entra: plano ativo com um aceite segue válido; a contestação expira no primeiro encontro do escopo realizado após a proposta. "O outro ainda não viu" é informação honesta: se virar regra de UX (pill "aguardando Fulano ver"), precisa de evento de leitura persistido — decisão na spec 019.
- Plano `proposto` por staff que expira sem aceite: `plano_ciclo` segue expirando (régua atual).
- Mudança de grade depois do aceite: o combinado não recalcula sozinho — versão nova é o caminho (mesma regra de hoje).
- Fuso America/Sao_Paulo: datas de janela/validação no molde da 0224.

## Requisitos funcionais

- **FR-001:** a decisão do plano acontece na superfície "Combinar o plano" (sheet no mobile, dialog no desktop), uma pergunta por tela — ritmo → recesso por recesso → confirmar — respondida uma vez por versão. O card permanece leitura, com a linha "Falta 1 decisão" + CTA quando há pendência.
- **FR-002:** a pergunta de ritmo usa `OpcaoPilula` (radio nativo sr-only, `has-checked`, foco visível, hit ≥44px, grid no 320 sem scroll horizontal) com opções 1–5 + "outro" (número livre, qualquer inteiro positivo) + sugestão honesta por `celulasComuns` — a sugestão informa a contagem de **dias** com período livre em comum e diz que "períodos livres não são horários marcados"; nunca "5+" nem a palavra "ritmo" na copy da UI.
- **FR-003:** o planner e as RPCs DEVEM aceitar qualquer inteiro positivo sem clamp nem recusa; ritmo que implica >1 encontro/dia é representado como escolhido e gera aviso explícito do efeito nos gaps pedagógicos — a régua do calendário/gaps gera aviso e estado, nunca bloqueio. A alternativa honesta procura o primeiro inteiro acima do pedido que fecha.
- **FR-004:** a grade é **preferência forte** na escolha de datas, não restrição dura: o planner tenta cair primeiro nos dias/períodos com célula comum; se não houver célula suficiente, simula mesmo assim com aviso honesto ("as datas fogem dos dias livres de vocês") — nunca "impossível" nem bloqueio. A simulação exige grade respondida ou explicitamente pulada: lado sem grade → preencher inline (a grade é do próprio lado — cada um edita a sua e a coordenação edita qualquer uma; o auxiliar não edita grade, vê e pede) ou "combinar sem a grade"; interseção vazia → ajustar inline ou falar com o auxiliar.
- **FR-005:** cada recesso oficial que cruza a janela DEVE ter decisão da dupla persistida (`dupla_recessos.usa`) antes da simulação e da proposta: sem row, a simulação e a `plano_propor` recusam com "falta a dupla confirmar o recesso" (nunca assumem `usa=true`); `usa=true` mantém bloqueadas as datas dentro do recesso; `usa=false` libera. Ausência de declaração = pendente — a pendência não esconde passos nem datas. **Somente mentor e mentorado registram a decisão**, com autoria; auxiliar e coordenação veem e cobram, não decidem. No aceite, se a dupla mudar a resposta, o escopo é re-simulado em tempo real e a versão recalculada pode ser aprovada no mesmo gesto; o ledger guarda pedido original + ajuste.
- **FR-006:** `plano_propor` DEVE aceitar mentor, mentorado, auxiliar (`supervisiona_dupla`, incluindo escopo de turma) e coordenação (`has_papel('coordenacao')`); proposta de membro da dupla carimba o próprio lado e nasce `aceito`; proposta de staff nasce `proposto` sem carimbo.
- **FR-007:** o plano DEVE ativar no primeiro aceite de membro da dupla (`proposto → aceito`), notificar o outro lado ("{Fulano} combinou um plano pra vocês") e manter a contestação até o primeiro encontro do escopo realizado após a proposta.
- **FR-008:** a máquina de estados do plano para quem lê é uma união discriminada num módulo puro — `proposto_staff_falta_meu` | `proposto_staff_falta_outro` | `ativo_sem_minha_ciencia` | `ativo` | `contestado` — e pill, frase e CTA derivam dela (nada de `falta: "os_dois"` nem copy "os dois aceitarem" no `fraseDoCombinado`, `AceitesPlano` ou toast do `ProporPlanoButton`).
- **FR-009:** quem pode propor/responder é calculado no servidor por `supervisiona_dupla`/`has_papel` — a ficha não decide CTA por `dupla.supervisor?.id`; auxiliar com escopo de turma vê e usa as mesmas superfícies de decisão. **Recesso e aceite são só da dupla**; auxiliar/coordenação veem, propõem e cobram, mas não carimbam. Editar disponibilidade é só do próprio lado e da coordenação.
- **FR-010:** a copy da UI usa **auxiliar** (nunca `supervisor`) e os carimbos/autoria identificam quem propôs e de que lado.
- **FR-011:** a sugestão de ritmo, o estado das perguntas e a máquina de aceite DEVEM ser determinísticos e testáveis no módulo puro — nada de cálculo divergente entre cliente e servidor.
- **FR-012:** proposta, ativação e contestação DEVEM notificar o outro lado no sino e, quando houver contato e opt-in, também por e-mail e por **deep link `wa.me` com template dinâmico** — **o canal externo só avisa "tem um combinado no site" com deep link**, nunca o conteúdo do plano, nomes de passos ou datas. Registrar canal e entrega para auditoria; a ausência de canal externo não bloqueia o aceite.

## Requisitos não funcionais

- **RLS/RPC:** a permissão mora nas RPCs re-emitidas (`plano_propor`, `plano_responder`, `declarar_recesso` se ampliada) com `has_papel('coordenacao')`/`supervisiona_dupla`; nenhuma policy de leitura muda — o jovem segue via `jovem_plano`.
- **A11y:** opções de ritmo/recesso como `OpcaoPilula` (input de radio nativo sr-only — setas do teclado e leitor de tela de graça), foco visível, toque ≥44px, grid que fecha no 320 sem scroll horizontal; mudança de projeção anunciada por `role="status"`/`aria-live`; transições respeitam `prefers-reduced-motion`; texto nunca depende de cor.
- **Copy:** pt-BR, sem travessão, sem jargão ("janela" vira "horários em que os dois podem"; nunca "ritmo" — "encontros por semana"; nunca "os dois aceitaram" — "{Fulano} combinou"; "períodos livres não são horários marcados" quando a sugestão usa a grade).
- **LGPD:** nenhum dado novo (a grade já existe; a decisão de recesso já existe).
- **Demo:** cenários "3 dias com período em comum", "grade vazia", "recesso pendente", "auxiliar de turma propõe" e "ritmo outro >5" no dataset demo com paridade de escopo.
- **Perf:** a sondagem do planner segue pura/cacheada; a leitura das grades reusa `disponibilidadesDaDupla`.

## Entidades e dados

- `dupla_planos`/`escopo` (jsonb): pode ganhar `ritmo_sugerido`, `recessos` (decisões snapshot), `proposto_por_papel` e `decisoes` (o que falta responder nesta versão) sem DDL; a validação vive na RPC re-emitida.
- `dupla_recessos.usa`: bool persistido; **ausência de row = pergunta pendente** (semântica nova, sem DDL). `usa=true` = "vamos usar o recesso" (pausa); `usa=false` = "vamos seguir nos encontrando".
- `mentor_profiles.disponibilidade` / `mentorados.disponibilidade`: lidas, não alteradas — sem timestamp (staleness indetectável; a confirmação "ainda vale?" vale só pro caso de cobertura total).
- Estado de leitura do plano (união discriminada, módulo puro): `proposto_staff_falta_meu` | `proposto_staff_falta_outro` | `ativo_sem_minha_ciencia` | `ativo` | `contestado`.
- Sugestão de SQL para o lead: re-emissão de `plano_propor` (gate dos quatro papéis + carimbo por lado + status no nascimento + ritmo sem teto + recesso sem decisão recusando a proposta), `plano_responder` (ativação no primeiro aceite), `jovem_plano` (proponente/papel + flag de pendência) e `declarar_recesso` (gate somente mentor/mentorado, sempre com autoria; a decisão pode ser revista no aceite com re-simulação em tempo real); `jovem_recessos` é re-emitida sem o `coalesce(usa, true)` para o jovem ver o pendente como pendente. Detalhes no recon `docs/planos/issues/_recon/plano-518-522-2026-11-23.md` §5.1.

## Critérios de sucesso

- **SC-001:** testes puros do planner com relógio fixo: ritmo escolhido (1, 3, 7, e livre >7), ritmo que não fecha + alternativa do primeiro inteiro que fecha, aviso de gaps quando implica >1/dia, recesso pendente, grade ausente.
- **SC-002:** e2e app: mentor propõe → plano ativo imediato → jovem notificado ("{Fulano} combinou") → contesta; auxiliar propõe → jovem aceita → ativa; auxiliar com escopo de turma vê e usa o CTA.
- **SC-003:** prints 1440×900 e 390×844 da superfície "Combinar o plano" (pergunta de ritmo, recesso, confirmar) e do card nos estados "falta 1 decisão" e "ativo sem minha ciência".
- **SC-004:** caso e2e do papel negado para cada gate novo.

## Plano de testes

- **Unit (Vitest, prioridade):** `montarPlanoEmDia` com ritmo explícito (1/2/3/5/7 e livre >7), sugestão por dias com célula comum (0/1/3), recesso sem resposta → estado pendente sem esconder passos/datas, "Vamos usar o recesso" (`usa=true`) vs "Vamos seguir nos encontrando" (`usa=false`), jovem propondo (carimbo mentorado), staff propondo (sem carimbo), ativação no primeiro aceite, máquina discriminada nos 5 estados — incluindo `ativo_sem_minha_ciencia` com outro lado que nunca abriu.
- **E2E app:** as quatro propostas por papel; jovem propõe e responde; notificação do outro lado → contestar → recusa após o 1º encontro do escopo (guard `realizado_em >= aprovado_em`); round trip da grade vazia dentro do fluxo; ritmo "outro" >7; auxiliar com escopo de turma.
- **E2E demo:** os estados de dados (grade vazia, recesso pendente, dias com período em comum, ritmo livre).
- **Regressão a reescrever:** expectativas de "falta os dois" nos testes do combinado e o default `usa=true` nos testes de recesso — os dois viram as novas réguas na mesma PR.

## Riscos

- "Um aceite basta" pode ativar plano que o outro lado nunca viu — mitigado por notificação forte ("{Fulano} combinou"), CTA "Não serve pra mim" visível e pelo ledger `dupla_plano_eventos`; monitorar contestações.
- A contagem de dias com período em comum é aproximada (período ≠ hora) — a sugestão declara isso em texto ("períodos livres não são horários marcados") e nunca trava a escolha.
- Ritmo livre alto pode gerar projeção absurda (mais encontros que dias) — a honestidade é mostrar o efeito e o aviso, não esconder; se surgir necessidade de limite técnico, declarar como técnico.
- Tri-estado de recesso pode deixar planos parados esperando resposta — a pendência é visível e a conversa com o auxiliar é a saída.
- RPC re-emitida com gate novo do mentorado precisa do caso negado no e2e e de espelho no demo.

## Premissas

- "Sem teto" é decisão tomada: qualquer inteiro positivo vale; o sistema avisa o efeito nos gaps e registra a escolha — não bloqueia nem troca o número.
- A decisão de recesso é da dupla e **somente mentor e mentorado registram** (decisão tomada), de preferência no aceite; se a resposta divergir do pedido, o plano é re-simulado em tempo real e a versão recalculada pode ser aprovada no mesmo gesto. Auxiliar/coordenação veem e cobram, não decidem. `declarar_recesso` é re-emitida com esse gate. A grade de disponibilidade é outra história: só o próprio lado e a coordenação editam; o auxiliar vê, pede e combina — não edita.
- A disponibilidade é **preferência forte por dias/períodos em comum**: o planner tenta esses dias primeiro, mas não trava o plano se a grade não cobrir o necessário — ele simula com aviso. A grade não garante horário exato.
- "O outro ainda não viu" como regra de UX depende de evento de leitura persistido — decidido na spec 019.
