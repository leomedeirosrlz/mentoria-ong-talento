# Spec — Fusão de encontros e registro combinado

**Feature:** `specs/018-fusao-registro` · **Status:** Clarified
**Fila:** `REALIZA-519` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** a dupla que faz dois encontros numa sessão de 2h registra uma sessão só, mas o sistema clona o registro inteiro por encontro coberto (o "sessão dupla" atual copia o payload para N rows de `registros`) e a avaliação do jovem vira um link por encontro — copiar/colar vestido de cobertura, com avaliações duplicadas e nenhuma marca de que foi uma sessão só.
- **Resultado observável:** no plano, passos adjacentes podem ser combinados numa sessão (2h cobrindo 2 encontros por padrão); no registro, o mentor marca nativamente os encontros que a sessão cobriu e salva **um** registro; o jovem responde **uma** avaliação; jornada, semáforo e progresso contam cada encontro coberto como realizado sem duplicar conteúdo.
- **Como saberemos que funcionou:** uma sessão de 2h cobrindo os encontros 5 e 6 gera 1 registro e 1 avaliação, os dois passos constam como feitos, e o aviso de prática aparece quando a fusão atropela o gap de 7 dias sem bloquear a decisão.

## Fora de escopo

- Fundir na trilha de especialista (cada sessão é linha própria — régua atual preservada).
- Mudar `unique(dupla_id, numero)` de `encontros`, o terminal de `realizado` ou o encerramento automático.
- Registro retroativo combinado além da régua de elegibilidade existente (`passosCobertosCandidatos`).
- Cobrir encontro agendado para o futuro (cobrir não é desmarcação silenciosa — mesma regra atual).
- Limite rígido de quantidade de encontros por sessão: o sistema avisa, não proíbe.

## Histórias de usuário

### US1 — Fusão no plano (P1)

- **Por que P1:** a sessão combinada nasce no combinado, não na hora do registro.
- **Teste independente:** propor plano com dois passos adjacentes fundidos e conferir o escopo gravado.
- **Cenários:**
  1. **Dado** dois passos adjacentes do plano **quando** quem propõe os funde **então** o escopo marca a sessão (mesma data, duração sugerida 2h) e os dois passos mostram "na mesma sessão".
  2. **Dado** a fusão tocando passo de prática (4–8) **quando** a UI renderiza **então** o aviso "esse encontro pede uma semana de prática até o próximo" aparece junto à decisão, sem bloquear.
  3. **Dado** a dupla que quer fundir passos não adjacentes ou mais de dois **quando** ela insiste **então** o sistema deixa com aviso explícito do efeito pedagógico — a flexibilização é decisão da dupla/coordenação, nunca silenciosa.

### US2 — Registro combinado (P1)

- **Por que P1:** é o fim do copiar/colar de resposta e avaliação.
- **Teste independente:** registrar a sessão cobrindo 2 encontros e conferir o banco.
- **Cenários:**
  1. **Dado** uma sessão realizada **quando** o mentor abre o registro **então** ele marca os encontros que a sessão cobriu (mesma régua `passosCobertosCandidatos`) e salva um único registro no encontro-âncora com a cobertura declarada.
  2. **Dado** o registro salvo **quando** a jornada e o semáforo recalculam **então** cada encontro coberto conta como realizado e o conteúdo aparece uma vez só, ligado aos dois passos.
  3. **Dado** um encontro coberto já com registro próprio, agendado pro futuro ou `nao_aconteceu` **quando** o mentor marca **então** a mesma recusa atual explica o motivo (já tem registro / desmarcar antes / desfazer o fato).

### US3 — Avaliação única da sessão (P1)

- **Por que P1:** o jovem não deve responder duas vezes a mesma sessão.
- **Teste independente:** sessão cobrindo 2 encontros com o link de avaliação.
- **Cenários:**
  1. **Dado** a sessão com cobertura **quando** os encontros viram realizado **então** nasce **um** link de avaliação para o grupo, não um por encontro.
  2. **Dado** o jovem respondendo **quando** a avaliação grava **então** ela cobre o grupo inteiro e aparece ligada aos encontros cobertos.
  3. **Dado** o mentor olhando a ficha **quando** a avaliação está visível pra ele **então** a mesma regra de visibilidade atual se aplica ao grupo.

## Casos de borda

- Sessão fundida onde um dos encontros fica sem registro porque a dupla desfez a cobertura — desfazer é gesto explícito com aviso, nunca efeito colateral.
- Encontro coberto cujo passo oficial ainda não venceu: segue fora (régua atual, evita pular o guia).
- Fusão que atravessa o último encontro do ciclo: o último passo segue fora da cobertura (mesma régua — o rito de encerramento não é absorvido).
- Sessão de 2h com encontro `nao_aconteceu` no meio: o fato vence, desfazer antes.
- Registro editado depois: a cobertura pode ser ajustada? Decisão: edição corrige o conteúdo; mexer na cobertura exige desfazer/refazer o gesto (mais simples e auditável).
- Avaliação já respondida por um encontro que depois entra numa cobertura: cobertura não se aplica retroativamente a avaliação existente.
- Dupla com plano ativo: passos fundidos do escopo aplicam juntos; fora do plano a fusão do registro funciona igual.
- Data oficial vs data do fato: cobertura carimba `realizado_em`/`data_hora` da sessão em todos os cobertos; a data oficial nunca é reescrita.

## Requisitos funcionais

- **FR-001:** o plano DEVE oferecer "fundir encontros" para passos adjacentes por padrão; a sessão combinada grava marca no `escopo` (mesma data + duração) — sem máximo rígido e com aviso de prática.
- **FR-002:** o registro DEVE permitir selecionar os encontros cobertos na mesma régua `passosCobertosCandidatos` e salvar **um** registro que declara a cobertura — nunca clonar o payload.
- **FR-003:** cada encontro coberto DEVE virar `realizado` na row dele com a data/hora do fato (régua atual de criação/atualização de rows), sem `registros` próprio.
- **FR-004:** a jornada, o semáforo, a agenda e os relatórios DEVEM contar encontro coberto como feito e tratar "registro ou cobertura" como conteúdo entregue — a régua de leitura única mora no módulo puro.
- **FR-005:** o mint de link de avaliação DEVE gerar um link por sessão fusionada (grupo), não por encontro; a avaliação grava a cobertura do grupo.
- **FR-006:** o aviso de gap pedagógico (prática = 7 dias, 4–8) DEVE aparecer no plano e no registro quando a fusão o ignora — avisar sempre, bloquear nunca.
- **FR-007:** a cobertura DEVE ser legível na UI: o registro mostra "cobriu também o 6º encontro" e a ficha/jornada marca os passos como sessão combinada.
- **FR-008:** quem pode fundir no plano segue a regra do plano (quatro papéis propõem, dupla confirma no aceite); quem registra é o mentor da dupla (régua atual do `salvarRegistro`).

## Requisitos não funcionais

- **RLS/RPC:** cobertura gravada nas tabelas existentes ou em RPC definer nova; leitura segue o escopo-dupla atual; o jovem lê cobertura via recorte definer.
- **Migrations:** coluna(s) de cobertura + ajuste do trigger `encontros_avaliacao_prompt` (sugestão no recon §4/§5.2); número 0225+ pelo lead.
- **Domínio puro:** "tem conteúdo" passa a "registro próprio com conteúdo OU coberto por registro com conteúdo" — mesma função usada por jornada/semáforo/agenda/testes.
- **LGPD:** nenhum dado novo; a cobertura é metadado de sessão.
- **Demo:** dupla com sessão combinada no dataset demo; e2e demo do registro cobrindo 2 passos.
- **A11y/copy:** seleção de cobertos acessível por teclado; copy explica "sessão combinada" sem jargão ("um encontro só cobriu dois passos do guia" → "a sessão valeu pelos encontros 5 e 6").

## Entidades e dados

- Opção recomendada (recon §4, Opção A): `registros.cobertura smallint[]` + `avaliacoes_encontro.cobertura smallint[]` — números cobertos além do próprio `encontro_id`; `encontros` intacto com uma row por passo.
- Opcional e recomendado: `encontros.sessao_id uuid` agrupando as rows da mesma sessão — resolve o mint de link e a leitura "é uma sessão só" sem inferir por `data_hora` igual.
- `escopo.passos[].sessao`/`grupo` no jsonb do plano (sem DDL) para a marca da fusão no combinado.
- SQL sugerido e alternativas (join table, stub `coberto_por`) com prós/contras: recon `docs/planos/issues/_recon/plano-518-522-2026-11-23.md` §4–§5.

## Critérios de sucesso

- **SC-001:** unit de cobertura: sessão cobre 2 passos → 2 encontros realizados, 1 registro, jornada marca os dois como feitos, semáforo inalterado na contagem.
- **SC-002:** e2e app: plano com fusão → aplica sessão → registra cobrindo 2 → jovem recebe 1 link e avalia o grupo.
- **SC-003:** invariante "registro ou cobertura = conteúdo" verde em `ciclo-cobertura`, `estado-encontro`, `agenda-minha`, `dupla-resumo`; teste da régua antiga atualizado na mesma PR.
- **SC-004:** prints do plano com fusão e do registro combinado (1440 e 390).

## Plano de testes

- **Unit:** `passosCobertosCandidatos` inalterada na elegibilidade; nova régua de leitura "conteúdo por cobertura" nos estados da jornada; aviso de prática na fusão; avaliação 1×grupo.
- **E2E app:** fusão no plano (adjacentes e insistência não adjacente), registro combinado, link único de avaliação, papel negado.
- **E2E demo:** sessão combinada no dataset.
- **Regressão a reescrever:** `tests/ciclo-cobertura.test.ts` (o "um registro por nº" vira "registro ou cobertura"), e2e `plano-em-dia.spec.ts`/`registro-rota.spec.ts` onde a sessão dupla clonava.

## Riscos

- O clone atual "parecia" cobertura e era lido por relatórios como N registros: métricas de "registros entregues" mudam de sentido — revisar consumidores (relatórios, `registro_tentativas`, resumos).
- `duracao_min` 120 com CHECK fechado `(30,45,60,90,120)` já cobre 2h; fusão de 3+ passos na mesma sessão excede o catálogo de durações — decisão: duração livre na fusão ou manter o catálogo (sugiro manter 120 como teto de fato e deixar a dupla agendar duas sessões).
- Cobertura + `encontro_id` unique preservados evitam migração destrutiva; stubs/clones antigos continuam legíveis — decidir se a sessão dupla histórica vira "cobertura legada" na leitura (sugiro deixar como está: clones históricos são registros válidos).
- Jovem avaliando "a sessão" e não "os dois encontros": a copy do link precisa dizer que a resposta vale pelo grupo.

## Premissas

- A sessão combinada padrão é 2h cobrindo 2 passos adjacentes; mais que isso é flexibilização com aviso, nunca padrão.
- O aviso pedagógico informa a decisão; o sistema não bloqueia autonomia da dupla.
- O encontro-âncora é o menor número da sessão; a ordem cronológica das rows espelha a ordem dos passos.
