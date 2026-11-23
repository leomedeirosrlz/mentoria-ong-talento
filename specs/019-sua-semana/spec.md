# Spec — Card "Sua semana" na home

**Feature:** `specs/019-sua-semana` · **Status:** Clarified
**Fila:** `REALIZA-520` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** a informação da semana da dupla está fatiada — o próximo encontro mora no hero `ProximoEncontro`, o plano mora no `PlanoBanner` (frase + quadrados + um CTA), a agenda da semana só existe como strip dentro de `/agenda`, e o auxiliar/coordenador não tem onde ver "quais planos estão em risco" sem entrar ficha a ficha.
- **Resultado observável:** cada home responde "o que acontece na sua semana e o que falta fazer" na superfície que já existe: no jovem, "Sua semana" é extensão do `ProximoEncontro` (mesma seção, com disclosure de roteiro/materiais) e carrega o vínculo "este é o Nº encontro do plano que {Fulano} combinou"; no mentor, entra no card da dupla substituindo `PlanoBanner` e absorvendo "O que fazer agora"; para coordenação e auxiliar, uma seção "O que precisa de você" lista o motivo antes do risco — auxiliar não é gestor: vê onde agir (incluindo propor plano), não um mini-dashboard.
- **Como saberemos que funcionou:** o jovem vê o plano do mentor no mesmo lugar onde vê o próximo encontro e pode contestar dali; o mentor age por dupla sem dois banners; a equipe vê "por que" antes de "quanto risco"; e o auxiliar de turma propõe plano pelo mesmo caminho da ficha.

## Fora de escopo

- Dashboard/página nova de acompanhamento — e nenhum segundo hero/mini-dashboard: cada papel ganha a semana dentro do que já existe.
- Edição de plano ou recesso dentro do card (o card lê e aponta; a decisão mora na superfície "Combinar o plano" da spec 017).
- Notificações novas (o card reflete o estado; push/WhatsApp é outra fila).
- A strip `AgendaSuaSemana` de `/agenda` segue onde está; o card não a duplica dentro de si.

## Histórias de usuário

### US1 — Jovem: um card na home (P1)

- **Por que P1:** a home do jovem é a única superfície dele — e hoje um plano que o mentor combinou pode ativar sem ele nunca ver.
- **Teste independente:** jovem com plano ativo combinado pelo mentor, jovem com encontro marcado fora de plano, jovem sem nada.
- **Cenários:**
  1. **Dado** o jovem com plano ativo e encontro marcado **quando** a home abre **então** o próximo encontro carrega o vínculo no mesmo lugar: "este é o 5º encontro do plano que {Fulano} combinou" + CTAs "Ver o combinado" e "Não serve pra mim" — nunca "vocês combinaram" nem um "aceitar" sobre plano já ativo.
  2. **Dado** o jovem com plano ativo **quando** a home abre **então** "Sua semana" (extensão da seção do próximo encontro, não card novo nem dropdown de navegação) mostra status do plano em texto, ritmo ("2 encontros por semana"), progresso ("6 de 16 feitos") e o disclosure de roteiro/materiais do próximo passo.
  3. **Dado** encontro futuro sem plano **quando** a home abre **então** a seção mostra a sessão da semana com os materiais do encontro — sem forçar plano onde não há.
  4. **Dado** nada marcado **quando** a home abre **então** o convite a marcar (o CTA do hero atual) segue; "Sua semana" não inventa conteúdo nem vira segundo hero.

### US2 — Mentor: um card por dupla (P1)

- **Por que P1:** o mentor tem N duplas; a leitura é por dupla, não agregada — e a home do mentor não tem hero, o card da dupla é o lugar.
- **Teste independente:** mentor com duas duplas em estados diferentes.
- **Cenários:**
  1. **Dado** dupla com plano **quando** a home abre **então** o card daquela dupla mostra a semana dentro da mesma seção — próximo encontro, status do plano, ritmo, progresso e "o que fazer agora" — substituindo o `PlanoBanner` + a seção "O que fazer agora" atuais (um lugar só, não dois banners).
  2. **Dado** passo pendente de data **quando** o card renderiza **então** o CTA principal é "Agendar data" para o passo que falta; "Ver o combinado" (âncora `#plano-em-dia` da ficha) e o roteiro/materiais do próximo passo a um clique.

### US3 — Coordenação e auxiliar: "O que precisa de você" (P1)

- **Por que P1:** o staff precisa enxergar onde agir — e o auxiliar precisa poder **agir** (propor, destravar), não só olhar um painel de risco.
- **Teste independente:** coordenação e auxiliar (incluindo escopo de turma) com planos nos três motivos.
- **Cenários:**
  1. **Dado** planos propostos a caminho de expirar, ativos com passo vencido sem data, ou contestados **quando** a home abre **então** a lista mostra dupla + **o motivo antes do risco** ("plano expira em 3 dias", "passo 5 sem data", "contestado ontem") + link pra ficha.
  2. **Dado** o auxiliar (incluindo escopo de turma) **quando** a home abre **então** ele vê a mesma lista no escopo dele e, por dupla, o caminho de ação — propor/retomar o plano pelo mesmo fluxo da ficha (`supervisiona_dupla` no servidor). Auxiliar não é gestor: a superfície dele é ação, não mini-dashboard.
  3. **Dado** nenhum plano pedindo atenção **quando** a home abre **então** a seção some ou diz "nada pedindo você" — sem card vazio ocupando a dobra.

## Casos de borda

- Plano `proposto` por staff aguardando aceite: o lado que falta vê "Falta o seu aceite" com CTA para responder — estado `proposto_staff_falta_meu` da máquina da spec 017 (proposta de membro já ativa; "falta aceite" só existe quando staff propôs).
- Plano ativo que o outro lado ainda não abriu: se a régua for "aguardando Fulano ver", exige evento de leitura persistido (carimbo `visto_em` por lado via recorte definer/`dupla_plano_eventos`) — recomendado, porque "você foi avisado em X" precisa ser verdade; sem persistência, fica só o banner informativo, sem afirmar que o outro viu.
- Dupla esp (sem plano): o card cai na leitura atual da trilha; não inventa semáforo de plano.
- Fuso SP: "esta semana" e vencimentos calculados em America/Sao_Paulo no servidor.
- Sem plano E sem encontro: a seção não força conteúdo — o convite a marcar já existe no hero do jovem.
- Muitas duplas pedindo atenção: lista curta com corte (sugestão: 5) + "ver todas" pra `/duplas` filtrado — decidir destino.
- Mentor com plano ativo proposto por ele: o card não pergunta de novo — mostra "o jovem foi avisado" (com `visto_em` se persistido) + "Confirmar data".

## Requisitos funcionais

- **FR-001:** jovem — "Sua semana" é extensão da seção do `ProximoEncontro`: data/hora do próximo, o vínculo "este é o Nº encontro do plano que {Fulano} combinou", status do plano em texto, ritmo, progresso, CTAs "Ver o combinado" (âncora `#plano` da agenda do jovem) e "Não serve pra mim" enquanto contestável + disclosure de roteiro/materiais do próximo passo.
- **FR-002:** mentor — a semana entra no card da dupla substituindo `PlanoBanner` e absorvendo "O que fazer agora": próximo encontro, status, ritmo, progresso, CTA "Agendar data"/"Confirmar data", "Ver o combinado" (`/duplas/[id]#plano-em-dia`), roteiro/materiais do próximo passo. Sem hero novo.
- **FR-003:** staff — seção "O que precisa de você": item = dupla + motivo (expirando, passo sem data, contestado, decisão de recesso/decisão do plano pendente) + link pra ficha; para o auxiliar, cada item leva o caminho de ação (propor/responder conforme `supervisiona_dupla`).
- **FR-004:** a derivação do resumo é pura e compartilhada (estende `resumoCombinado`/`combinadoDoJovem` — `resumoPlanoJovem` é variável da página, não função) e a máquina de aceite é a união discriminada da spec 017 — nada de conta divergente por superfície.
- **FR-005:** "pedindo atenção" é régua explícita e testável: proposto perto de `expira_em`, ativo com passo pendente vencido, contestado recente, decisão do plano/recesso pendente — definida no módulo puro com os mesmos dados do plano; motivo antes do rótulo de risco.
- **FR-006:** o roteiro/materiais do passo lê o roteiro vigente (guia semanal quando existir — spec 020 — senão o roteiro oficial do corpus) + materiais da biblioteca do `encontro_num`; disclosure dentro da mesma seção, não dropdown de navegação.
- **FR-007:** notificação do plano proposto/ativo carrega copy "{Fulano} combinou um plano pra vocês" com destino direto ao combinado — nome e papel derivados de `proposto_por`/`proposta_via` (a `jovem_plano` devolve os dois), nunca "seu mentor" quando quem combinou foi o próprio jovem, o auxiliar ou a coordenação; nunca "vocês combinaram".
- **FR-008:** copy em pt-BR sem jargão; status sempre em texto (pill com rótulo, nunca só cor).

## Requisitos não funcionais

- **RLS/RPC:** jovem lê via `jovem_plano` (ampliar o recorte com ritmo/progresso, `proposto_por`+nome e `visto_em` se a leitura persistida for adotada); staff lê `dupla_planos` pelas policies existentes; a ação do auxiliar usa as mesmas RPCs da spec 017 (`supervisiona_dupla`).
- **Leitura:** os dados vêm das queries que a home já faz + `getJovemPlano` — sem N+1 por dupla (planos dos mentorados do mentor numa query só, padrão `jovem_plano`/escopo atual); "o outro viu" só se persistido (caso contrário não se afirma).
- **A11y:** disclosure de roteiro/materiais com resumo de verdade (details/summary ou equivalente acessível), foco visível, hit ≥44px, estado lido por leitor de tela (pill com texto); reduced motion nas transições.
- **Responsivo:** 320/390 e 1440 nas três superfícies; lista "O que precisa de você" colapsável.
- **Demo:** estados "plano ativo proposto pelo mentor", "falta aceite (staff propôs)", "pedindo atenção" e "auxiliar de turma" no dataset demo.

## Entidades e dados

- Reuso: `dupla_planos` + `dupla_plano_passos` (status/ritmo/progresso), `encontros` (próximo, vínculo "Nº encontro do plano"), `jovem_plano()`/`dupla_planos` por papel, `materiais` (`encontro_num`), `encontro_guia_ajustes`/roteiros da spec 020 quando existirem.
- `visto_em` por lado (carimbo de leitura do plano) se a régua "o outro ainda não viu" for persistida — coluna leve ou evento no ledger; decisão de implementação na hora, a spec exige só que a UI não afirme o que não sabe.
- Nenhuma entidade nova além disso; a lista "O que precisa de você" é derivação, não tabela.

## Critérios de sucesso

- **SC-001:** unit do resumo por papel (jovem/mentor/staff), da régua "pedindo atenção" com datas fixas e da máquina de aceite nos 5 estados.
- **SC-002:** e2e app: jovem abre home → vínculo "Nº encontro do plano que {Fulano} combinou" + "Ver o combinado"/"Não serve pra mim" no mesmo lugar; mentor abre home → card da dupla com a semana dentro (sem `PlanoBanner` nem segundo banner); coordenação e auxiliar veem "O que precisa de você" com o motivo certo.
- **SC-003:** e2e da notificação: plano combinado pelo mentor → jovem recebe "{Fulano} combinou" (nome derivado de `proposto_por`/`proposta_via`) → abre → contesta/recusa após o 1º encontro do escopo.
- **SC-004:** prints 1440×900 e 390×844 dos três recortes.
- **SC-005:** paridade demo dos estados.

## Plano de testes

- **Unit:** resumo unificado por papel; régua "pedindo atenção" (proposto expirando, passo vencido, contestado, decisão pendente); montagem do disclosure (roteiro do passo + materiais do nº); máquina discriminada derivando pill/frase/CTA.
- **E2E app:** as três superfícies com estados distintos; deep-link `#plano` (jovem) e `#plano-em-dia` (ficha); CTA "Agendar" abre o seletor correto; aceite único com o outro lado que nunca abriu (`ativo_sem_minha_ciencia`); auxiliar de turma propõe pelo mesmo fluxo.
- **E2E demo:** os estados de dados.

## Riscos

- Vínculo "o plano que {Fulano} combinou" sem `visto_em` persistido não pode afirmar que o outro viu — ou a UI usa "combinou/avisado em" (fato) ou se grava leitura; decidir antes da implementação.
- N+1 na home do mentor com muitas duplas: medir e agregar numa query única se doer.
- "Pedindo atenção" vira alarme falso se a régua for sensível demais — começar conservadora (só os sinais claros) e o motivo sempre antes do rótulo.

## Premissas

- "Sua semana" é a seção do jovem (extensão do `ProximoEncontro`); no mentor o conteúdo mora no card da dupla; para staff a seção é "O que precisa de você" (ou copy equivalente).
- A seção não recria a strip dia-a-dia da `/agenda` — aponta para ela quando o detalhe fizer falta.
- O plano invisível é problema de produto assumido: a home do jovem sempre carrega o vínculo quando existe plano ativo que outro combinou.
