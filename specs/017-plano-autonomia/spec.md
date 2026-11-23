# Spec — Plano "ficar em dia": autonomia da dupla

**Feature:** `specs/017-plano-autonomia` · **Status:** Clarified
**Fila:** `REALIZA-518` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** o planner escolhe o ritmo sozinho (sonda 1→2→3→1/dia) e a dupla só descobre o custo na proposta pronta; a grade de disponibilidade declarada por mentor e jovem nunca entra na conta; o recesso é tratado como fato assumido (`usa=true` implícito) em vez de decisão da dupla; e o aceite bilateral empaca o plano quando um lado demora, enquanto auxiliar e coordenação não podem destravar.
- **Resultado observável:** o plano abre perguntando "quantos encontros por semana vocês conseguem?" com pills e uma sugestão calculada das janelas em comum; o recesso é decidido antes de simular; qualquer um dos quatro papéis (mentor, jovem, auxiliar, coordenação) propõe; um aceite da dupla ativa o plano e o outro lado é notificado com caminho de contestação.
- **Como saberemos que funcionou:** dupla com 3 janelas em comum vê a sugestão "confirmam até 3 por semana?"; grade vazia pede atualização em vez de impossível; recesso sem resposta trava só a simulação, não a tela; plano proposto pelo auxiliar ativa no primeiro aceite de quem é da dupla.

## Fora de escopo

- Agendar os encontros dentro das janelas comuns (a disponibilidade calibra o **ritmo sugerido**; a escolha de datas segue o fluxo atual de confirmar passo a passo).
- Teto rígido de ritmo além do físico (1/dia); não inventar limite de produto.
- Mudar quem declara recesso além do necessário para a dupla decidir (decisão de papel no item US3).
- Fusão de encontros (spec 018) e card "Sua semana" (spec 019).
- Trilha de especialista (sem calendário oficial; o planner já devolve não aplicável).

## Histórias de usuário

### US1 — Ritmo perguntado, não imposto (P1)

- **Por que P1:** é a primeira pergunta do fluxo e o que torna o plano da dupla, não do sistema.
- **Teste independente:** abrir o card com grades de 1, 3 e 0 janelas em comum.
- **Cenários:**
  1. **Dado** uma dupla com 3 células em comum **quando** o plano abre **então** a pergunta "Quantos encontros por semana vocês conseguem?" aparece com pills (1, 2, 3, 4, 5+, outro) e a sugestão "Vocês têm disponibilidade em 3 janelas por semana. Confirmam até 3?"
  2. **Dado** que quem abriu escolhe um ritmo **quando** a simulação roda **então** a projeção usa exatamente esse ritmo e mostra o efeito real (data de recuperação, alternativa de ritmo quando não fecha, recesso no caminho) — sem o sistema trocar o número por baixo.
  3. **Dado** um ritmo que não fecha antes do encerramento **quando** a projeção renderiza **então** o card mostra o ritmo mais leve que fecharia como alternativa honesta, sem recusar a escolha nem prometer o impossível.

### US2 — Disponibilidade antes de simular (P1)

- **Por que P1:** sugerir ritmo sem olhar a grade repete o erro de projetar o impossível.
- **Teste independente:** duplas com os dois lados sem grade, um lado sem grade, e interseção vazia.
- **Cenários:**
  1. **Dado** um lado (ou os dois) sem grade declarada **quando** o plano abre **então** o estado é "falta confirmar a disponibilidade", com CTA pra atualizar a própria grade (link pro perfil/superfície de edição) — nunca "impossível".
  2. **Dado** interseção vazia entre as grades **quando** o plano abre **então** o card sugere atualizar a disponibilidade ou falar com o auxiliar, sem simular ritmo nenhum.
  3. **Dado** uma grade declarada mas incompleta/estranha **quando** o plano abre **então** o sistema pergunta se ainda vale, em vez de tratar como verdade cega.

### US3 — Recesso decidido antes da simulação (P1)

- **Por que P1:** o recesso muda a conta; assumir é o erro atual.
- **Teste independente:** dupla com recesso no caminho, sem declaração; depois com "usar" e "não usar".
- **Cenários:**
  1. **Dado** um recesso oficial na janela e nenhuma decisão registrada **quando** o plano abre **então** aparece a pergunta com pills "Podem contar com o recesso" / "Não contar" — uma por recesso — e a simulação fica pendente até a resposta, com o resto do card legível.
  2. **Dado** a resposta "podem contar" **quando** ela é gravada **então** persiste por recesso na dupla (`usa=false`) e a projeção agenda dentro do recesso.
  3. **Dado** "não contar" **quando** gravada **então** o recesso segue restrição e a projeção respeita — igual ao default de hoje.
  4. **Dado** que o jovem abre o plano primeiro **quando** a pergunta aparece **então** ele também pode responder (a decisão é da dupla), com a autoria registrada.

### US4 — Quatro papéis, um aceite (P1)

- **Por que P1:** a fila de aceite bilateral é o ponto onde o plano morre hoje.
- **Teste independente:** proposta por cada um dos quatro papéis e a sequência de aceite.
- **Cenários:**
  1. **Dado** o auxiliar (incluindo escopo de turma) ou a coordenação propõe **quando** a proposta nasce **então** nenhum lado está carimbado; o primeiro aceite de mentor **ou** jovem ativa o plano.
  2. **Dado** o mentor (ou o jovem) propõe **quando** a proposta nasce **então** o lado dele já conta como aceite e o plano ativa na hora; o outro lado é notificado com "Ver plano" e "Contestar".
  3. **Dado** o plano ativo com um aceite **quando** o outro lado abre **então** ele vê o combinado vigente, pode registrar o próprio aceite (informativo) e pode contestar até o primeiro encontro do escopo realizado — mesma régua atual.
  4. **Dado** alguém fora da dupla ou sem papel **quando** tenta propor/responder **então** a RPC recusa (e2e do papel negado).

## Casos de borda

- Grade com período genérico demais (dia inteiro em todos os dias): a contagem de janelas mente — tratar como "confirme se a grade ainda vale".
- Dupla que nunca declarou disponibilidade e não quer declarar: caminho é falar com o auxiliar, não travar o plano para sempre — definir saída honesta (ver Riscos).
- Ritmo "outro" acima do físico (>1/dia): a UI não oferece; se chegar, o planner clampa — a UI explica que o máximo é um encontro por dia.
- Recesso já declarado antes da rodada: a decisão persistida vale e a pergunta não reaparece.
- Dois recessos na janela: uma pergunta por recesso, decisões independentes.
- Proposta criada e o outro lado nunca entra: plano ativo com um aceite segue válido; a contestação expira no primeiro encontro do escopo.
- Plano `proposto` por staff que expira sem aceite: `plano_ciclo` segue expirando (régua atual).
- Mudança de grade depois do aceite: o combinado não recalcula sozinho — versão nova é o caminho (mesma regra de hoje).
- Fuso America/Sao_Paulo: datas de janela/validação no molde da 0224.

## Requisitos funcionais

- **FR-001:** o fluxo do plano DEVE abrir com a pergunta de ritmo em pills, com sugestão derivada de `celulasComuns(mentor, jovem)` e opção livre ("outro") + saída "falar com o auxiliar".
- **FR-002:** o planner DEVE aceitar o ritmo escolhido sem sobrescrever; a alternativa honesta (mais leve que fecha) aparece quando o escolhido não fecha — sem teto de produto abaixo do físico.
- **FR-003:** a simulação DEVE exigir as grades cruzadas: lado sem grade → "confirmar/atualizar disponibilidade"; interseção vazia → "atualizar ou falar com o auxiliar"; nunca "impossível" por falta de dado.
- **FR-004:** cada recesso oficial na janela DEVE ter decisão persistida (`dupla_recessos.usa`) antes da simulação; ausência de declaração = pendente, não default.
- **FR-005:** `plano_propor` DEVE aceitar mentor, mentorado, auxiliar (`supervisiona_dupla`) e coordenação; proposta de membro da dupla carimba o próprio lado.
- **FR-006:** o plano DEVE ativar no primeiro aceite de membro da dupla (`proposto → aceito`), notificar o outro lado e manter a contestação até o primeiro encontro realizado do escopo.
- **FR-007:** a copy da UI usa **auxiliar** (nunca `supervisor`) e os carimbos/autoria identificam quem propôs e de que lado.
- **FR-008:** a sugestão de ritmo e o estado das perguntas DEVEM ser determinísticos e testáveis no módulo puro — nada de cálculo divergente entre cliente e servidor.

## Requisitos não funcionais

- **RLS/RPC:** a permissão mora nas RPCs re-emitidas (`plano_propor`, `plano_responder`, `declarar_recesso` se ampliada); nenhuma policy de leitura muda — o jovem segue via `jovem_plano`.
- **A11y:** pills são botões de verdade (grupo `radiogroup` ou lista de botões com estado pressionado), foco visível, toque ≥44px, texto sem depender de cor.
- **Copy:** pt-BR, sem travessão, sem jargão ("janela" vira "horários em que os dois podem", "ritmo" vira "encontros por semana").
- **LGPD:** nenhum dado novo (a grade já existe; a decisão de recesso já existe).
- **Demo:** cenários "3 janelas", "grade vazia", "recesso pendente" e "auxiliar propõe" no dataset demo com paridade de escopo.
- **Perf:** a sondagem do planner segue pura/cacheada; a leitura das grades reusa `disponibilidadesDaDupla`.

## Entidades e dados

- `dupla_planos`/`escopo` (jsonb): pode ganhar `ritmo_sugerido`, `recessos` (decisões snapshot) e `proposto_por_papel` sem DDL; a validação vive na RPC re-emitida.
- `dupla_recessos.usa`: bool persistido; **ausência de row = pergunta pendente** (semântica nova, sem DDL).
- `mentor_profiles.disponibilidade` / `mentorados.disponibilidade`: lidas, não alteradas.
- Sugestão de SQL para o lead: re-emissão de `plano_propor` (gate + carimbo por lado + status no nascimento), `plano_responder` (ativação no primeiro aceite), `jovem_plano` (proponente/papel + flag de pendência), e — se produto confirmar — `declarar_recesso` com gate do mentorado/auxiliar. Detalhes no recon `docs/planos/issues/_recon/plano-518-522-2026-11-23.md` §5.1.

## Critérios de sucesso

- **SC-001:** testes puros do planner com relógio fixo cobrindo ritmo escolhido (1, 3, 7), ritmo que não fecha + alternativa, recesso pendente, grade ausente.
- **SC-002:** e2e app: mentor propõe → plano ativo imediato → jovem notificado → contesta; auxiliar propõe → jovem aceita → ativa.
- **SC-003:** prints 1440×900 e 390×844 dos estados: pergunta de ritmo, falta disponibilidade, falta confirmar recesso, proposta ativa com um aceite.
- **SC-004:** caso e2e do papel negado para cada gate novo.

## Plano de testes

- **Unit (Vitest, prioridade):** `montarPlanoEmDia` com ritmo explícito (1/2/3/5/7), sugestão por células comuns (0/1/3), recesso sem resposta → estado pendente, recesso "podem contar" vs "não contar", jovem propondo (carimbo mentorado), staff propondo (sem carimbo), ativação no primeiro aceite.
- **E2E app:** as quatro propostas por papel; jovem propõe e responde; notificação do outro lado; contestação dentro/fora do prazo.
- **E2E demo:** os três estados de dados (grade vazia, recesso pendente, 3 janelas).
- **Regressão a reescrever:** expectativas de "falta os dois" nos testes do combinado e o default `usa=true` nos testes de recesso — os dois viram as novas réguas na mesma PR.

## Riscos

- "Um aceite basta" pode ativar plano que o outro lado nunca viu — mitigado por notificação com CTA de contestação e pelo ledger `dupla_plano_eventos`; monitorar contestações.
- A contagem de janelas por célula é aproximada (período ≠ hora) — a sugestão declara isso em texto e nunca trava a escolha.
- Tri-estado de recesso pode deixar planos parados esperando resposta — a pendência é visível e a conversa com o auxiliar é a saída.
- RPC re-emitida com gate novo do mentorado precisa do caso negado no e2e e de espelho no demo.

## Premissas

- "Sem teto" significa sem limite de produto abaixo do físico: mais de um encontro por dia não é encontro — a UI explica, não oferece.
- A decisão de recesso é da dupla: mentor e mentorado respondem; staff registra igual (coord já pode hoje; auxiliar fica como leitura/ponte, salvo decisão em contrário do Thiago).
- A disponibilidade calibra a **sugestão** de ritmo nesta fatia; agendar dentro das janelas vem depois se o Thiago quiser.
