# Resposta às sugestões — Plataforma Realiza.vc

Retorno sobre o documento "Plataforma realiza.vc — Sugestões". Cada item está
classificado e tem instrução de reteste na demo (`/demo`, sem login).

**Importante sobre a demo:** os dados que você viu são um conjunto fictício
compartilhado entre todos os visitantes — por isso nada do que é digitado é
gravado (qualquer envio de formulário mostra o aviso "Modo demonstração.
Nada é gravado de verdade."). Isso é proposital: a plataforma real persiste
tudo no banco. Na demo, o correto é avaliar telas, fluxos e conteúdo — não a
persistência.

## Resumo

| # | Sugestão | Status |
|---|----------|--------|
| 1 | Nome diferente do mentor na última página | Comportamento da demo (persona) |
| 2 | Página de dados pessoais com uploads | Já existia — `/perfil` |
| 3 | Notas de planejamento por encontro | Já existia — "Nota do encontro" |
| 4 | Renomear "anexar evidência" | Ajustado com texto explicativo |
| 5 | Todos os arquivos da dupla num lugar | **Implementado** |
| 6 | Múltiplas devolutivas de especialistas | **Implementado** |
| 7 | Atividades da equipe Realiza com o mentorado | Adiado — depende de definição de produto |
| 8 | Conteúdo de cada encontro na tela da dupla | Já existia — linha do tempo |
| 9 | Materiais de cada encontro | Já existia — detalhe do encontro |
| 10 | "Solicitar apoio" fora do registro | **Implementado** |
| 11 | Combinados por encontro (criar/editar) | Já existia — dentro do registro |
| 12 | Tem combinados na demo? | Sim — na dupla Ricardo × Ana |
| 13 | Clicar na data abre dados do encontro | Já existia — clicar no dia abre o detalhe |
| 14 | Ano nas datas | **Implementado** |
| 15 | Dados pareciam mockados | Correto — é a demo compartilhada |

---

## O que mudou (implementado agora)

### 1. "Pedir apoio" direto na página da dupla (item 10)

Antes, o pedido de apoio só existia como caixa de seleção dentro do
formulário de registro de encontro — ou seja, o mentor precisava estar
preenchendo um registro pra sinalizar. Agora há um botão **"Pedir apoio"**
na ficha da dupla, sempre visível pro mentor enquanto a dupla está ativa ou
pausada, com campo opcional pra ele dar contexto ("o mentorado não responde
há duas semanas").

O pedido chega na hora como notificação pra coordenação **e** pro supervisor
da dupla, com link direto pra ficha. O sino de notificações da coordenação é
a fila de pendências — o pedido fica "não lido" até alguém tratar. O botão
não aparece pra coordenação/supervisor (só o mentor pede pela própria
dupla) nem em duplas encerradas/concluídas.

**Reteste:** demo → papel **Mentor DPP (Ricardo)** → abrir a dupla com a Ana
Beatriz → botão "Pedir apoio" no topo. Na demo o envio mostra o aviso de
demonstração; em produção ele notifica de verdade.

### 2. Ano em todas as datas (item 14)

Datas de registro, log e histórico agora sempre levam o ano — "15 de set."
virou "15 de set. de 2026". Importante porque o ciclo cruza a virada do ano
(o ciclo 2026/2027 vai de outubro a junho), e "jan." sem ano podia ser lido
no ano errado. Onde a data já é compacta de propósito (número do dia na
grade do calendário), o formato curto continua.

**Reteste:** qualquer ficha de dupla — datas da linha do tempo, registros e
devolutivas agora mostram "dd de mmm. de aaaa".

### 3. "Arquivos" — todos os anexos da dupla num lugar só (item 5)

Nova seção na ficha da dupla que junta **todos** os arquivos anexados em
todos os registros de encontro, dos mais novos pros mais antigos — com nome,
número do encontro de origem, data, tamanho e autor. O download continua
pelo mesmo link seguro de antes (URL assinada de 5 min). Quem anexa ou
remove continua fazendo isso dentro do registro do encontro — a seção nova
é só leitura consolidada.

**Reteste:** demo → qualquer papel → dupla Ricardo × Ana → seção
"Arquivos" na coluna direita (3 arquivos de 2 encontros diferentes).

### 4. "Devolutivas de especialistas" — histórico completo (item 6)

A ficha da dupla DPP agora lista **todas** as devolutivas de trilhas de
especialista que o mentorado já passou — cada bloco com o nome do
especialista, a data de fechamento da trilha e o texto da devolutiva pro
PDM. Antes só a solicitação mais recente aparecia. O chip do topo continua
mostrando o estado da solicitação atual; a seção nova guarda o histórico.

**Reteste:** demo → papel **Mentor DPP (Ricardo)** ou **Coordenação** →
dupla Ricardo × Ana → seção "Devolutivas de especialistas": aparecem duas —
Helena Prado (oratória, trilha concluída) e Sofia Nogueira (matemática).

### 5. "Anexar evidência" ganhou explicação (item 4)

Mantivemos o termo "evidência" porque ele é intencional: o anexo serve pra
comprovar que o encontro aconteceu (auditoria do programa), não é só "um
arquivo qualquer". O que mudou: o botão agora tem uma linha explicativa —
"Foto ou arquivo que ajude a contar o encontro (PDF, PNG, JPG ou WebP)" —
que resolve a dúvida de formato sem perder o sentido do termo.

**Reteste:** demo → Mentor DPP → dupla Ricardo × Ana → abrir um encontro
realizado → texto de ajuda embaixo do botão "Anexar evidência".

---

## O que já existia (e onde encontrar)

| Item | Onde está | Como retestar na demo |
|------|-----------|----------------------|
| Dados pessoais + uploads (2) | `/perfil` e ficha em `/pessoas/[id]` | Qualquer papel → menu do avatar → "Meu perfil". Documentos ficam na ficha da pessoa (seção "Documentos") — ex.: ficha do Ricardo vista pela coordenação |
| Notas de planejamento (3) | Ficha da dupla → encontro agendado → "Nota do encontro" | Mentor DPP → dupla Ricardo × Ana → encontro 5 (agendado) tem nota de preparação do Ricardo |
| Conteúdo de cada encontro (8) | Linha do tempo na ficha da dupla | Qualquer papel → dupla Ricardo × Ana → cada encontro realizado expande com avaliação, dificuldades, reflexões e anexos |
| Materiais por encontro (9) | Detalhe do encontro + seção de materiais | Clicar num encontro na agenda ou na ficha → material do guia daquele encontro aparece no detalhe |
| Combinados por encontro (11, 12) | Dentro do registro do encontro + seção "Combinados" na ficha | Dupla Ricardo × Ana tem combinados em estados diferentes (feito/pendente); ao registrar um novo encontro, os combinados anteriores aparecem em "Da última vez" pra marcar o que foi cumprido |
| Clicar na data → dados do encontro (13) | `/agenda` | Clicar num dia com encontro abre o detalhe completo (status, link, registro, evidências). A criação/edição acontece a partir dali, não na célula da grade — se no reteste esse caminho parecer confuso, a gente reavalia um form direto no calendário |
| Pedido de apoio no registro (10) | Formulário de registro → "Preciso de apoio da coordenação" | Continua existindo pra quando o pedido nasce de um encontro específico — agora há **as duas vias**: dentro do registro (contexto do encontro) e o botão direto na ficha (a qualquer momento) |

## Sobre os pontos de interpretação

- **Nome diferente na última página (1):** na demo você navega "como" uma
  persona — entrou como Ricardo Tavares, por exemplo, e é esse nome que a
  plataforma mostra. Se acontecer algo parecido fora da demo (o nome exibido
  não ser o seu), aí é bug de verdade — me avisa com o link da página.
- **"Dados mockados" (15):** correto, e é de propósito — ver o aviso no topo.
- **Atividades da equipe com o mentorado (7):** faz sentido como produto,
  mas é uma entidade nova do programa (atividade coletiva com presença,
  anexos e comentários do próprio mentorado). Precisa de alinhamento com os
  guias do programa — quem registra a presença, que tipos de atividade
  existem, se o mentorado comenta ou só visualiza. Entrou no backlog
  priorizado, não na vertical slice atual.
- **Vários especialistas ao mesmo tempo (6):** o sistema já permite várias
  trilhas por mentorado ao longo do ciclo (a demo mostra duas pra Bia). Vale
  confirmar nas regras do programa se duas trilhas podem rodar **em
  paralelo** ou só em sequência — hoje nada impede nem exige.
