# Spec — Ficar em dia até o encerramento

**Feature:** `specs/013-ficar-em-dia` · **Status:** Clarified
**Fila:** `REALIZA-513` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** o plano “ficar em dia” não é confiável para o uso principal: uma dupla que não termina até 15/01 com um encontro por dia precisa saber se consegue terminar junto com quem vai terminar; o card já mostrou projeções que pareciam “só não fazer nada” e a UI não deixava claro o que era proposta, aceite e acompanhamento.
- **Resultado observável:** a projeção usa a data-limite real, o ritmo máximo de 1 encontro/dia, os recessos e o calendário que continua cobrando; a dupla vê um plano possível ou uma conversa honesta com a coordenação; o plano é proposto, aceito pelos dois lados e acompanhado por banner.
- **Como saberemos que funcionou:** casos de 10 atrasos e de dupla já em dia têm resultados diferentes e explicáveis; propostas aceitas aparecem nas duas homes; o card não promete recuperação impossível.

## Fora de escopo

- Trocar duplas automaticamente; a spec pode oferecer conversa/coordenação, não remanejo silencioso.
- Criar um cronograma paralelo fora do guia.
- Alterar a data de encerramento do programa.

## Histórias de usuário

### US1 — Projeção honesta com 1 encontro/dia (P1)

- **Por que P1:** é o cálculo que decide se a dupla continua ou conversa com a coordenação.
- **Teste independente:** rodar o planner com relógio fixo para 10 atrasos e para dupla em dia.
- **Cenários:**
  1. **Dado** uma dupla com 10 encontros atrasados em 23/11 **quando** o plano simula 1/dia **então** a data de recuperação considera os encontros que vencem durante a recuperação e não só o backlog de hoje.
  2. **Dado** que a projeção passa do encerramento **quando** o card renderiza **então** diz que não fecha e oferece a conversa com a coordenação, sem “só não fazer nada”.
  3. **Dado** uma dupla já em dia **quando** o card abre **então** ele não propõe mudança artificial; explica que não há recuperação a fazer.

### US2 — Propor, aceitar e acompanhar (P1)

- **Por que P1:** o plano sem aceite bilateral não muda a jornada.
- **Teste independente:** mentor propõe, jovem aceita; recarregar as duas homes.
- **Cenários:**
  1. **Dado** um plano possível **quando** o mentor/coordenação propõe **então** a dupla vê a proposta com janela, ritmo e passos.
  2. **Dado** que um lado aceita **quando** o outro abre **então** o estado é “aceito por um lado, falta o outro” e o aceite final ativa o plano.
  3. **Dado** o plano ativo **quando** as homes abrem **então** o banner mostra o próximo passo e o progresso, sem duplicar a ficha.

### US3 — Recesso e datas (P2)

- **Por que P2:** o recesso é opcional e muda a conta.
- **Teste independente:** plano com recesso usado/recusado.
- **Cenários:**
  1. **Dado** um recesso que a dupla decidiu usar **quando** a projeção roda **então** as datas não caem dentro dele.
  2. **Dado** um recesso recusado **quando** a projeção roda **então** ele não é restrição para a dupla.
  3. **Dado** uma data sugerida no passado **quando** o card renderiza **então** ela é rejeitada e a UI explica, sem abrir seletor inválido.

## Casos de borda

- Dupla pausada/encerrada/desistente; trilha especialista; sem cronograma; sem encerramento no calendário.
- 0 atrasos, 1 atraso, 10 atrasos, mais passos que dias até 15/01.
- Encontros travados no futuro, limbo, `nao_aconteceu`, registro pendente.
- Aceite de um lado, expiração, contestação, versão nova do plano.
- Fuso America/Sao_Paulo e virada de dia.

## Requisitos funcionais

- **FR-001:** a projeção DEVE usar o encerramento oficial (15/01/2027 quando for o evento do ciclo) como limite duro.
- **FR-002:** o planner DEVE simular até 1 encontro/dia (7/semana), respeitando gaps de prática e recessos.
- **FR-003:** a projeção DEVE contabilizar os passos que vencem durante a recuperação, não só o backlog do dia.
- **FR-004:** o card DEVE distinguir “em dia” de “recuperação possível” e “conversa com a coordenação”.
- **FR-005:** o plano DEVE ser proposto, aceito pelos dois lados e acompanhado nas duas homes.
- **FR-006:** nenhuma data sugerida pode ser anterior a hoje nem cair em recesso ativo.
- **FR-007:** o card DEVE mostrar o custo do plano (encontros/semana, janela) e não prometer o impossível.

## Requisitos não funcionais

- **RLS:** leitura/escrita do plano pelas RPCs existentes; não ampliar papéis.
- **Auth:** sem rota pública nova.
- **LGPD:** nenhum dado novo.
- **Demo:** cenários de 10 atrasos e em dia no dataset demo.
- **A11y/perf:** datas legíveis, foco no aceite, sem cálculo no cliente que divirja do servidor.

## Entidades e dados

`plano`/`plano_passos` (ou equivalente existente), `duplas.recessos`, `ciclo_eventos` e `encontros` são a fonte. Nenhuma tabela nova; se o schema atual não guardar o aceite bilateral/versão, registrar migration nova na plan.md antes de codar.

## Critérios de sucesso

- **SC-001:** testes de projeção com relógio fixo para os cenários de 10 atrasos e em dia.
- **SC-002:** prints das duas homes com banner e do card em cada estado.
- **SC-003:** e2e app de proposta → aceite → plano ativo.

## Premissas

- “1 encontro por dia” significa até 7/semana, com o gap mínimo do guia; não significa ignorar prática/recesso.
- A data de encerramento vem do calendário oficial, não de uma constante nova; o caso de 15/01 é o evento atual.
- A dupla rápida e a lenta terminam dentro da mesma janela; não há promessa de sincronizar encontros entre duplas.
