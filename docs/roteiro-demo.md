# Roteiro de demo — realiza.vc

Demo ao vivo contra produção (`https://realizavc.vercel.app`), ~20 minutos.
Duas janelas: **normal** (coordenação) e **anônima** (mentor DPP) — logadas ao
mesmo tempo, pra mostrar o que uma ação de um papel causa na tela do outro.

## Narrativa (a espinha da apresentação)

> Antes: Google Forms semanal + planilha de acompanhamento + WhatsApp como
> ferramenta de trabalho. A informação morria fragmentada e a coordenação
> descobria problema tarde demais.
>
> Agora: o ciclo inteiro num lugar só. **A dupla agenda e registra os próprios
> encontros; a coordenação monitora e age onde precisa.** O WhatsApp volta a ser
> canal de contato — não ferramenta de gestão.

## Setup (5 min antes)

| Janela | Conta | Papel |
|---|---|---|
| Normal | `thicosta1432@gmail.com` | Coordenação (Thiago) |
| Anônima | `thixaraujo@gmail.com` | Mentor DPP (thiago) |

Estado real dos dados — não precisa criar nada:

- 1 dupla ativa: **thiago (mentor) ↔ thiago (mentorado, ONG "js")**
- 2 encontros realizados com registro (entraram como retroativos/externos)
- 3º encontro **agendado pra 22/09** (pela plataforma)
- **1 pedido de apoio em aberto** — guardar pro fechamento (ver "O beat final")

Checklist físico: zoom 100%, fullscreen, devtools fechado, abas na ordem
(Visão geral · Duplas · Registros), celular ou devtools device pra mostrar
mobile se sobrar tempo.

---

## Roteiro A — Coordenação (~10 min)

### A1. Visão geral — "o que pede ação hoje"

- Home já responde: **semana do 3º encontro**, resumo operacional (registros,
  aguardando, apoio em aberto).
- Fala: *"A coordenação abre a plataforma e já vê onde o programa está — sem
  perguntar pra ninguém, sem planilha."*
- **Sino** no topo: cada registro que entra e cada pedido de apoio vira
  notificação pra equipe inteira.

### A2. `/registros` — o histórico operacional

- Timeline por **data real do encontro** (não por quando digitaram) — rail
  lateral com dia/mês e nó semafórico.
- **Resumo clicável** no topo: clicar em *"1 apoio em aberto"* já filtra a
  lista. (Clicar de verdade — é o beat do item.)
- Cada card: título oficial do guia (*"2º encontro · Avaliação por terceiros e
  visão de futuro"*), dupla com avatares pareados, datas (realizou · registrou
  · atraso), badges (`apoio solicitado` vermelho / `avaliação` / `registro
  tardio` âmbar / `dificuldade`).
- **Filtros** estilo marketplace: todas as dimensões num modal, contador de
  ativos no botão, chips removíveis embaixo da barra.
- Expandir um card (`Ver detalhes`): registro completo + link pra ficha.

### A3. `/duplas` → ficha da dupla

- Header: **"Risco · Pedido de apoio"** — *"pra coordenação, apoio aberto é
  risco operacional até ser atendido. Pro mentor, a mesma coisa aparece como
  'apoio solicitado' — a gente vai ver na segunda janela."*
- **Jornada**: os 16 encontros do guia viram trilha visual (com registro ·
  pendente · a caminho).
- Encontros com registro expandido: atividades, tema, próximo passo — o mesmo
  form semanal que o mentor preenchia no Google Forms, agora dentro do ciclo.
- **"Chamar no WhatsApp"**: wa.me direto pro mentor — o nudge de um clique.
- Sidebar: card do mentorado (com link pro perfil), combinados da dupla.
- Botão **"Marcar apoio como atendido"** visível — NÃO clicar ainda.

### A4. `/pessoas` — cadastro e formação de duplas

- Listas separadas: com acesso (equipe) × mentorados.
- Matching board: chip *"Sem dupla · N livres"*, badges `1/1 dupla`,
  `pendências: termo · formação`, `sem autorização` — *"a plataforma sabe o
  que falta antes de formar dupla: termo assinado, formação feita, autorização
  do responsável."*
- **Importar CSV**: abrir o wizard (colar ou subir arquivo → prévia linha a
  linha → importa). *"O cadastro inteiro veio de uma planilha em 2 minutos,
  com deduplicação por e-mail e WhatsApp."* Pode mostrar sem importar.
- **Nova dupla**: abrir o dialog — mentor + mentorado + supervisor +
  capacidade + início. *"A formação de duplas respeita a capacidade do mentor
  e valida papel de cada um — concorrência real não deixa estourar capacidade."*
- **Exportar CSV**: relatório do cadastro pro Excel, um clique.

### A5. `/agenda` e `/materiais` — o guia dentro da plataforma

- Agenda: calendário oficial das terças — *"o que o guia pede em cada
  encontro, com material linkado."*
- Materiais: guias oficiais por público — *"o PDF do mentor fica a um clique,
  sem depender de e-mail."*

### A6. Comunicado → notificação cruzada (beat de tempo real)

- Criar comunicado rápido (*"Bem-vindas ao ciclo"*, quem recebe: todos).
- Trocar pra aba anônima: **o sino do mentor acendeu** — *"aviso da
  coordenação chega pra todo mundo, com público segmentável."*

---

## Roteiro B — Mentor DPP (~7 min, aba anônima)

### B1. Home — três perguntas respondidas

- *"O mentor não é gestor. A tela dele responde: quando é o próximo encontro,
  o que o guia pede nele, e como foi o anterior."*
- **"Olá, thiago"** — semana do 3º encontro · fase · card "Sua dupla".
- **Banner âmbar**: *"Apoio solicitado — a coordenação já foi avisada e vai
  entrar em contato com você."* ← **o contraste com o "Risco" da coordenação
  é o ponto**: quem pede ajuda não é problema, é alguém que já foi ouvido.

### B2. Jornada e próximo encontro

- Dots: verde = com registro, âmbar = pendente. **2 de 16.**
- 3º agendado 22/09 — botão **Remarcar** (exige motivo — fica auditável pra
  coordenação).
- *"Quem agenda o encontro é a própria dupla — a coordenação não agenda por
  ela. Esse é o modelo do programa, e a plataforma respeita."*

### B3. Registrar encontro — o coração do fluxo

- Abrir o form de registro: **atividades** (checkboxes do guia), **avaliação**,
  **dificuldade**, **próximo passo**, **combinados**.
- **"Da última vez"**: combinados pendentes do encontro anterior já aparecem
  pra concluir em lote.
- **Rascunho automático**: *"se a internet cair no meio, o rascunho fica no
  navegador — ninguém perde um registro por wifi."*
- Anexos de evidência quando houver (foto, PDF — privados, link temporário).

### B4. Encontro retroativo

- *"Encontrou fora da plataforma e esqueceu de marcar? Registra depois sem
  virar atraso falso."* Os encontros 1 e 2 desta dupla entraram assim —
  aparecem como `marcado fora da plataforma`, com a data real preservada.

### B5. Pedir apoio e falar com o mentorado

- **Pedir apoio**: um clique — a coordenação recebe notificação na hora
  (pode clicar de novo sem medo: já está pedido, idempotente visual).
- **Falar com mentorado**: wa.me direto — *"o WhatsApp continua sendo o
  canal de conversa; a plataforma é onde o trabalho fica registrado."*

### B6. Materiais e perfil

- Guia do mentor a um clique.
- `/perfil`: foto (cai pro Gravatar do e-mail, depois iniciais), WhatsApp,
  troca de senha.

### B7. Mobile (se der tempo)

- Devtools device ou celular real: bottom nav, mesmas telas — *"o mentor usa
  do celular entre um compromisso e outro; a interface foi feita pra isso."*

---

## O beat final (~2 min) — fechar o ciclo ao vivo

1. Volta pra aba da coordenação → ficha da dupla.
2. Clicar **"Marcar apoio como atendido"**.
3. Refresh na aba do mentor → **o banner sumiu**.
4. Fala: *"Esse é o ciclo completo: o mentor pediu, a coordenação viu na hora,
   agiu, e o mentor vê que foi ouvido. Antes isso era um WhatsApp perdido numa
   conversa de 200 mensagens."*

---

## Perguntas prováveis (preparar resposta)

- **"E quem não tem WhatsApp?"** — o botão desabilita com explicação;
  cadastro e importação validam o formato (E.164, dígitos BR).
- **"LGPD / dados de jovens?"** — `/privacidade` (pública): avatares por link
  público declarado; documentos e evidências em storage privado com link
  temporário de 5 min; exportação de contatos só pela coordenação; contato de
  staff não é legível via API por outros papéis.
- **"Se o mentor esquecer de registrar?"** — `registro pendente` entra no
  semáforo e no resumo operacional; nudge por WhatsApp com um clique.
- **"E dupla que termina antes?"** — pausar/encerrar preserva o histórico;
  encaminhamentos e registros ficam na ficha.
- **"Consegue importar o histórico dos Google Forms antigos?"** — sim,
  importador com normalização (em construção/entregue conforme o estado).
- **"Funciona offline?"** — rascunho de registro fica no navegador; o resto
  precisa de conexão (é uma plataforma, não um app nativo).
- **"Quantas duplas aguenta?"** — a modelagem é por ciclo; semáforo, filtros e
  resumo foram feitos pra dezenas de duplas simultâneas.

## Regras de palco

- **Não criar dados fake ao vivo** — dialogs podem ser abertos e fechados sem
  salvar. Exceções seguras: comunicado (visível e real), "Marcar apoio como
  atendido" (é o fechamento).
- Login por senha existe pras contas de demo — magic link pode demorar na
  hora; não depender dele.
- Internet caiu? Screenshots de backup e segue a narrativa — a demo é sobre o
  modelo, não sobre a rede.
- Se perguntarem algo fora do roteiro: responder com a regra do domínio —
  *"a dupla agenda e registra; a coordenação monitora e faz nudge"* cobre
  quase tudo.
