# Spec — Card "Sua semana" na home

**Feature:** `specs/019-sua-semana` · **Status:** Clarified
**Fila:** `REALIZA-520` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** a informação da semana da dupla está fatiada — o próximo encontro mora no hero `ProximoEncontro`, o plano mora no `PlanoBanner` (frase + quadrados + um CTA), a agenda da semana só existe como strip dentro de `/agenda`, e o auxiliar/coordenador não tem onde ver "quais planos estão em risco" sem entrar ficha a ficha.
- **Resultado observável:** um card único por superfície que responde "o que acontece na sua semana e o que falta fazer": jovem vê um card; mentor vê um card por dupla; auxiliar e coordenação veem uma lista curta de planos em risco. Sem dashboard novo — o card vive nas homes que já existem.
- **Como saberemos que funcionou:** a dupla responde sem sair da home: próximo encontro com data/hora, status do plano, ritmo e progresso; e age com dois gestos: agendar o próximo, abrir o plano completo, e o roteiro/materiais do próximo passo a um clique.

## Fora de escopo

- Dashboard/página nova de acompanhamento.
- Edição de plano ou recesso dentro do card (o card lê e aponta; a decisão mora nas superfícies de decisão).
- Notificações novas (o card reflete o estado; push/WhatsApp é outra fila).
- A strip `AgendaSuaSemana` de `/agenda` segue onde está; o card não a duplica dentro de si.

## Histórias de usuário

### US1 — Jovem: um card na home (P1)

- **Por que P1:** a home do jovem é a única superfície dele; a semana precisa estar nela.
- **Teste independente:** jovem com plano ativo, jovem com encontro marcado fora de plano, jovem sem nada.
- **Cenários:**
  1. **Dado** o jovem com plano ativo e encontro marcado **quando** a home abre **então** o card mostra data/hora do próximo, status do plano em texto, ritmo ("2 encontros por semana"), progresso ("6 de 16 feitos") e os CTAs "Ver plano" e "Roteiro e materiais".
  2. **Dado** encontro futuro sem plano **quando** a home abre **então** o card mostra a sessão da semana com os materiais do encontro — sem forçar plano onde não há.
  3. **Dado** nada marcado **quando** a home abre **então** o card convida a marcar (mesmo CTA do hero atual) sem virar um segundo hero.

### US2 — Mentor: um card por dupla (P1)

- **Por que P1:** o mentor tem N duplas; a leitura é por dupla, não agregada.
- **Teste independente:** mentor com duas duplas em estados diferentes.
- **Cenários:**
  1. **Dado** dupla com plano **quando** a home abre **então** o card daquela dupla mostra próximo encontro, status, ritmo, progresso e CTAs "Agendar" / "Ver plano" / "Roteiro e materiais" do próximo passo.
  2. **Dado** passo pendente de data **quando** o card renderiza **então** o CTA principal é "Agendar data" para o passo que falta.

### US3 — Auxiliar e coordenação: lista de risco (P2)

- **Por que P2:** a prioridade do staff é enxergar onde intervir, não o detalhe de cada dupla.
- **Teste independente:** coordenação com planos nos três estados de risco.
- **Cenários:**
  1. **Dado** planos propostos a caminho de expirar, ativos com passo vencido sem data, ou contestados **quando** a home abre **então** a lista curta mostra dupla + motivo do risco em texto + link pra ficha.
  2. **Dado** nenhum plano em risco **quando** a home abre **então** a lista some ou diz "nenhum plano pede atenção" — sem card vazio ocupando a dobra.

## Casos de borda

- Plano `proposto` por staff aguardando aceite: o card do lado que falta mostra "Falta o seu aceite" com CTA para responder (mesma máquina do `fraseDoCombinado`, agora com aceite único — "falta você" nunca "falta os dois" se um já carimbou... ver regra da 017: proposta de membro já ativa; o caso "falta aceite" só existe para proposta de staff).
- Jovem cujo plano veio proposto pelo mentor e já está ativo: card mostra "Plano em andamento" + caminho de contestação até o primeiro encontro.
- Dupla esp (sem plano): o card cai na leitura atual da trilha; não inventa semáforo de plano.
- Fuso SP: "esta semana" e vencimentos calculados em America/Sao_Paulo no servidor.
- Sem plano E sem encontro: o card não força conteúdo — o convite a marcar já existe no hero; o card só assume quando há semana pra mostrar.
- Muitas duplas em risco: lista curta com corte (sugestão: 5) + "ver todas" pra `/duplas` filtrado — decidir destino.

## Requisitos funcionais

- **FR-001:** o card exibe por dupla: próximo encontro (data/hora ou "sem data"), status do plano em texto, ritmo, progresso, CTA "Agendar próximo", CTA "Ver plano" (deep-link `#plano-em-dia`), dropdown "Roteiro e materiais" do próximo passo (roteiro da semana + materiais `encontro_num`).
- **FR-002:** a derivação do resumo é pura e compartilhada (estende `resumoCombinado`/`resumoPlanoJovem`) — nada de conta divergente por superfície.
- **FR-003:** jovem = um card; mentor = um por dupla, dentro da seção da dupla (substitui o `PlanoBanner` para não criar segunda superfície concorrente); auxiliar/coord = lista curta de planos em risco.
- **FR-004:** "em risco" é régua explícita e testável: proposto perto de `expira_em`, ativo com passo pendente vencido, contestado recente — definido no módulo puro com os mesmos dados do plano.
- **FR-005:** o dropdown de roteiro/materiais lê o roteiro vigente do passo (guia semanal quando existir — spec 020 — senão o roteiro oficial do corpus) + materiais da biblioteca do nº.
- **FR-006:** copy em pt-BR sem jargão; status sempre em texto (pill com rótulo, nunca só cor).

## Requisitos não funcionais

- **RLS/RPC:** jovem lê via `jovem_plano` (ampliar o recorte com ritmo/progresso se faltar); staff lê `dupla_planos` pelas policies existentes; nenhuma escrita nova.
- **Leitura:** os dados do card vêm das queries que a home já faz + `getJovemPlano` — sem N+1 por dupla (planos dos mentorados do mentor numa query só, padrão `jovem_plano`/escopo atual).
- **A11y:** dropdown de verdade (menu Base UI), foco visível, hit ≥44px, estado lido por leitor de tela (pill com texto).
- **Responsivo:** 320/390 e 1440 nas duas homes; lista de risco colapsável.
- **Demo:** estados "plano ativo", "falta aceite", "em risco" no dataset demo.

## Entidades e dados

- Reuso: `dupla_planos` + `dupla_plano_passos` (status/ritmo/progresso), `encontros` (próximo), `jovem_plano()`/`dupla_planos` por papel, `materiais` (`encontro_num`), `encontro_guia_ajustes`/roteiros da spec 020 quando existirem.
- Nenhuma entidade nova prevista; a lista de risco é derivação, não tabela.

## Critérios de sucesso

- **SC-001:** unit do resumo por papel (jovem/mentor/staff) e da régua "em risco" com datas fixas.
- **SC-002:** e2e app: mentor abre home → card por dupla com CTA correto; jovem abre home → card único; coordenação vê a lista com o motivo certo.
- **SC-003:** prints 1440×900 e 390×844 dos três recortes.
- **SC-004:** paridade demo dos três estados.

## Plano de testes

- **Unit:** resumo unificado por papel; régua "em risco" (proposto expirando, passo vencido, contestado); montagem do dropdown (roteiro do passo + materiais do nº).
- **E2E app:** as três homes com estados distintos; deep-link `#plano-em-dia`; CTA "Agendar" abre o seletor correto.
- **E2E demo:** os três estados de dados.

## Riscos

- Sobreposição com `PlanoBanner` e `ProximoEncontro`: o card substitui o banner nas homes e não duplica o hero — decidir na implementação a ordem visual final (hero primeiro, card logo abaixo por dupla).
- N+1 na home do mentor com muitas duplas: medir e agregar numa query única se doer.
- "Em risco" vira alarme falso se a régua for sensível demais — começar conservadora (só os três sinais claros).

## Premissas

- "Sua semana" é o título do card nas homes da dupla; para staff a seção é "Planos pedindo atenção" (ou copy equivalente).
- O card não recria a strip dia-a-dia da `/agenda` — aponta para ela quando o detalhe fizer falta.
