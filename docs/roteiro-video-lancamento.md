# Roteiro: vídeo de lançamento da plataforma

Vídeo de lançamento geral do realiza.vc para quem vai usar a plataforma no dia a dia: **jovens mentorados** e **mentores** em primeiro plano, **auxiliares executivos** (supervisores) num capítulo curto. A coordenação aparece só como "a equipe" que recebe os pedidos: ela é quem envia o vídeo, não quem assiste.

---

## 1. A ideia em uma frase

> **O encontro é da dupla. Todo o resto agora fica num lugar só.**

Tudo no vídeo serve a essa frase. Não é tour de funcionalidades: cada recurso entra porque resolve uma dor que alguém do programa já viveu.

### De onde vêm as dores (nada inventado)

| Dor mostrada no vídeo | Fonte |
|---|---|
| Acompanhamento espalhado em formulário semanal, planilha e WhatsApp; a coordenação descobria problema tarde | `docs/roteiro-demo.md` (narrativa "Antes / Agora") |
| "Eu não lembro por que a gente teve uma semana com dois encontros", o histórico morava no WhatsApp | Kelyng (mentora), reunião de 01/out, `docs/analise-transcricao-mentor.md` §2 |
| "Responder no momento que terminou é muito melhor do que pensar depois" | Leo, mesma reunião, §4 |
| PDM e Roda da Vida eram documentos externos (o próprio guia dizia isso) | Guia DPP cap. 05, `docs/planos/atividades-interativas.md` |
| Termo assinado fora (Signdoc), matching por Google Forms | `docs/planos/_contexto.md` |
| O jovem não tinha canal próprio: a única via era o próprio mentor | `docs/planos/mentorado-na-plataforma.md` |

---

## 2. Formato e entregas

| Peça | Duração | Aspecto | Público | Onde |
|---|---|---|---|---|
| **Master** | ~2:05 | 16:9 (1920×1080, 30fps) | todos | YouTube, onboarding, evento de encerramento |
| Corte **Jovem** | 30s | 9:16 | mentorados | Status/WhatsApp, Reels |
| Corte **Mentor** | 30s | 9:16 e 16:9 | mentores | grupo de mentores, e-mail de boas-vindas |
| **Teaser** | 15s | 9:16 e 1:1 | todos | divulgação antes do link de acesso |

- Narração (VO) em pt-BR, voz calorosa e sem tom de comercial, ritmo de ~140 palavras/min. O master tem ~270 palavras de VO.
- **Legenda queimada obrigatória**: a maioria vai assistir no WhatsApp sem som. Máximo 2 linhas, ~40 caracteres por linha.
- Toda a interface mostrada é **captura real** do app, rodando no **staging** com o dataset realista do `seed:demo` (pessoas fictícias). Nada de mockup.

---

## 3. Identidade visual aplicada ao vídeo

### Paleta (cada cor com um papel só, igual no app)

| Cor | Valor | No vídeo significa |
|---|---|---|
| Papel | `hsl(75 10% 95%)` | fundo das cenas de produto |
| Tinta | `#323232` (`hsl(0 0% 20%)`) | fundo das cenas de dor e do end card; texto |
| Lima | `#A0C644` | **mentor** e **ação** (o clique, o botão que importa) |
| Amarelo | `#FFD531` | **jovem**, jornada, celebração. Nunca alerta |
| Vermelho | `hsl(0 78% 48%)` | só no "tarde demais" e na dupla em risco |
| Laranja | `hsl(28 90% 44%)` | atenção |
| Verde | `hsl(105 42% 40%)` | em dia |
| Petróleo | `hsl(195 55% 38%)` | apoio / pedido de ajuda (é "trabalho a fazer", não falha) |

Regras herdadas do app: texto sobre lima ou amarelo é sempre tinta, **nunca branco** (1,9:1). Status sempre com rótulo escrito, nunca só cor.

### O motivo visual: os dois discos

No app, a dupla é desenhada como **um disco lima (mentor) sobreposto a um disco amarelo (mentorado)** (`jovem/page.tsx`, estado "sem dupla"; tokens `--role-mentor` / `--role-mentorado`). Esse é o fio do vídeo inteiro:

- Na abertura, os dois discos estão **separados**, cada um num canto, cercados pelo caos.
- No reveal, eles **se encontram e se sobrepõem** no beat da música. Isso é "a dupla".
- Cada capítulo abre com o disco do papel: amarelo (jovem), lima (mentor), os dois juntos e pequenos (auxiliar, que olha várias duplas).
- No end card, os dois discos ficam ao lado do logo.

Instrumentos aparecem com as cores próprias do app: Roda da Vida `hsl(180 45% 32%)`, PDM `hsl(205 59% 25%)`, Metas `hsl(36 88% 38%)`, Visão `hsl(304 36% 30%)`.

### Tipografia

- **Mitr** 500–600 para títulos e frases-chave (é a fonte do app).
- **JetBrains Mono**, caixa-alta, tracking ~0.08em, ~11–14px equivalente, para kickers e rótulos ("SE VOCÊ É MENTORADO", "ENCONTRO 5 DE 16"). Mesmo estilo do rótulo de grupo do app.
- Textos de tela seguem a regra de copy do produto: **sem travessão**, sem jargão interno ("semáforo", "eixo", "janela") e "Turma 1" por extenso.

### Motion (personalidade: Corporate, calma e precisa)

| Propriedade | Valor |
|---|---|
| Easing | `cubic-bezier(0.2, 0, 0, 1)` (o mesmo do app) para quase tudo |
| Unidade de tempo | 0,3s (entradas 0,3s; movimentos de câmera 0,6–0,9s) |
| Entrada de listas | fade + subida de 12–16px, stagger de 60ms (igual ao `.animate-enter`) |
| Transições entre cenas | corte seco no beat ou crossfade de 0,3s. Sem wipe, sem giro, sem zoom-blur |
| Câmera nas capturas | push-in lento (escala 1,00 → 1,06) no elemento-herói; um herói por quadro |
| Overshoot | zero, exceto o "ping" do ponto vermelho (é a animação real `ping-once` do app) e o encontro dos discos (2%) |
| Único momento "uau" | o encontro dos dois discos no reveal |

### Som

- Trilha: bed quente e contida, ~100–115 BPM, entra **depois** do cold open (a abertura é só som de notificação). A trilha já usada no brag (`brag-output/composition/assets/music/happy-beats-business-moves-vol-12…mp3`, 109,96 BPM) serve se a licença cobrir uso público.
- SFX esparsos: notificações empilhando no cold open; um tique seco por ponto/disco; um impacto suave no encontro dos discos; nada de whoosh cinematográfico.
- A música abaixa ~6 dB sob a narração (ducking) e some 0,5s antes do "tarde demais".

---

## 4. Elenco (personas da demo, com continuidade)

A mesma dupla atravessa o vídeo inteiro, o que dá história e não só telas.

| Papel | Persona no staging (login de teste) | Papel na tela |
|---|---|---|
| Jovem | **Ana** (Ana Beatriz Souza, `jovem@`) | mentorado |
| Mentor | **Otávio** Martins (`mentor@`) | mentor DPP, dupla com a Ana |
| Auxiliar | **Paula** Vieira (`supervisora@`) | aparece na interface como "Auxiliar executivo" |

> Captura no **staging** com o dataset de `pnpm seed:demo` (contas `jovem@` / `mentor@` / `supervisora@` / `coord@realiza.test`), não na `/demo`: lá as ações gravam, então o ciclo fechado sai de verdade. As datas derivam do dia em que o seed roda (encontro 6 da Turma 1 = terça da semana). Depois de gravar, rodar `pnpm seed:demo` de novo pra devolver o staging ao estado limpo.

---

## 5. Roteiro do master (cena a cena)

Legenda: **VO** = narração · **TELA** = texto animado sobre a imagem · **SFX** = efeito · **AÇÃO** = o que a captura mostra.

---

### CENA 0 · Cold open: a mentoria em quatro lugares · 0:00–0:10

**Fundo tinta.** Sem música.

| Tempo | Imagem | Som / texto |
|---|---|---|
| 0:00 | Tela preta. Um disco lima no canto superior esquerdo, um amarelo no inferior direito, pequenos e distantes. | SFX: uma notificação de WhatsApp. |
| 0:01 | Cartões começam a empilhar entre os dois discos, cada um torto, entrando rápido: **grupo do WhatsApp** com contador de mensagens subindo · **planilha de acompanhamento** com células vazias · **formulário semanal** · **PDF do guia** (quatro cartões, batendo com a VO "quatro lugares"). | SFX: notificações acelerando, sobrepostas. |
| 0:04 | Os cartões cobrem quase todo o quadro. Os discos mal aparecem. | **VO:** "Uma mentoria acontece numa conversa entre duas pessoas." |
| 0:07 | Pausa de um frame em cada cartão (corte no ritmo das notificações). | **VO:** "Mas, até aqui, ela era organizada em quatro lugares diferentes." |

**Direção:** os cartões são ilustrações chapadas (tinta clara sobre tinta), sem marcas de terceiros. A sensação é de ruído, não de humor.

---

### CENA 1 · As dores, uma por papel · 0:10–0:30

Três vinhetas de ~6s, cada uma aberta pelo disco do papel. Mesmo fundo tinta, um cartão em foco, os outros desfocados atrás.

**1A · Mentor (disco lima) · 0:10–0:16**
- **AÇÃO:** rolagem infinita numa conversa de WhatsApp ilustrada. Uma mensagem destacada: "remarca pra quinta?"
- **TELA (Mitr, entra palavra por palavra):** "Por que a gente teve uma semana com dois encontros?"
- **TELA (mono, pequeno, embaixo):** "EU NÃO LEMBRO."
- **VO:** "O mentor procurava no WhatsApp o que tinha sido combinado."

**1B · Jovem (disco amarelo) · 0:16–0:22**
- **AÇÃO:** celular ilustrado. Tela de chat com a pergunta "quando é o próximo encontro?" sem resposta. Ao lado, um ícone de documento com um link quebrado: "PDM".
- **TELA:** "Quando é o próximo encontro?"
- **VO:** "O jovem não sabia quando era o próximo encontro, nem onde estava o próprio plano."

**1C · Auxiliar (dois discos pequenos) · 0:22–0:27**
- **AÇÃO:** planilha ilustrada, linhas de duplas, uma coluna "último encontro" com datas cada vez mais antigas. A câmera desce até uma linha vazia.
- **VO:** "E quem acompanhava as duplas descobria o problema quando ele já tinha virado atraso."

**1D · O preço · 0:27–0:30**
- A música (que ainda nem começou) não entra; o SFX das notificações corta seco.
- Todos os cartões somem. Fica só um **ponto vermelho** no centro, com o ping real do app (escala 1 → 2,2, esmaecendo).
- **TELA:** "Quando alguém via, já era tarde."
- **SFX:** um tique seco no ping. Silêncio de 0,5s depois.

---

### CENA 2 · O reveal: a dupla se encontra · 0:30–0:40

**Transição:** o ponto vermelho encolhe e some. O fundo passa de tinta para **papel** num crossfade de 0,3s.

| Tempo | Imagem | Som / texto |
|---|---|---|
| 0:30 | Os dois discos (lima e amarelo) voltam, agora grandes, entrando pelas laterais. | Música entra. |
| 0:33 | **No beat forte**, os discos se encontram e se sobrepõem (o disco lima por cima, anel de 2px na cor do papel entre eles, igual ao app). Overshoot de 2%. | SFX: impacto suave. |
| 0:34 | Os discos deslizam para a esquerda e o logo **realiza.vc** aparece ao lado (`public/logo-realiza.png`). Abaixo, em mono: "PROGRAMA DE MENTORIA SOCIAL". | **VO:** "Agora a mentoria inteira mora num lugar só." |
| 0:37 | Logo e discos sobem; entra a frase em Mitr: **"Do primeiro ao décimo sexto encontro."** | **VO:** "A plataforma do Programa de Mentoria Social." |

---

### CENA 3 · Capítulo Jovem · 0:40–1:05

**Abre com:** disco amarelo cresce e vira o fundo de um card. Kicker mono: **"SE VOCÊ É MENTORADO"**.
**Enquadramento:** celular (moldura simples, sem marca), centralizado. O fundo papel tem um leve tom amarelo (`--destaque-suave`).
**Persona:** Ana, rota `/jovem` na demo.

| # | Tempo | Ação na tela (captura real) | VO | Texto na tela |
|---|---|---|---|---|
| J1 | 0:40 | Home do jovem: "Olá, Ana". Push-in no card **Próximo encontro** (dia, hora, botão de entrar na chamada). | "A Ana abre o celular e já sabe: quando é o próximo encontro e onde entrar na chamada." | — |
| J2 | 0:46 | `/jovem/perfil`, grade de disponibilidade: ela marca as noites livres (a mesma grade que o mentor usa pra achar os horários em comum quando agenda). | "Ela marca os horários livres, e a agenda cruza com os do mentor." | "HORÁRIOS EM COMUM" (mono) |
| J3 | 0:51 | `/jovem/pdm`: a árvore de metas abrindo, nó por nó. Corte rápido para a Roda da Vida (o polígono se desenhando no SVG). | "O plano de metas e a Roda da Vida saíram do papel e ficam com ela." | — |
| J4 | 0:56 | Fim de encontro: a avaliação em estrelas + chips. Toque em 4 estrelas, um chip, enviar. | "Depois de cada encontro, ela conta como foi em poucos toques." | "Seu mentor vê só a média." |
| J5 | 1:00 | Volta pra home, toque em **"Precisa de ajuda? Fale com a equipe"**. O diálogo de chamado abre com as opções e "É urgente". | "E, se precisar de ajuda, fala direto com a equipe. Esse pedido é só dela." | "O SEU MENTOR NÃO VÊ ESSE PEDIDO." |

**Por que J5 fecha o capítulo:** é a dor mais séria resolvida pro jovem. Antes, o único canal era o próprio mentor, e às vezes o problema é a dupla. O chamado do jovem não aparece pro mentor (`jovem-pedir-ajuda.tsx`, comentário da 0084).

**Opcional (se o corte do jovem pedir mais um beat):** `/jovem/especialistas`, o catálogo de especialistas e o pedido num horário livre. VO: "Quer aprofundar um tema? Pede um especialista."

---

### CENA 4 · Capítulo Mentor · 1:05–1:35

**Abre com:** disco lima. Kicker: **"SE VOCÊ É MENTOR"**.
**Enquadramento:** navegador desktop limpo (sem barra de favoritos, zoom 100%), com dois cortes em celular para mostrar que funciona entre compromissos.
**Persona:** Otávio, mentor DPP.

| # | Tempo | Ação na tela | VO | Texto na tela |
|---|---|---|---|---|
| M1 | 1:05 | Home do mentor. Push-in na faixa amarela "O que fazer agora". | "O Otávio é mentor voluntário. Ao entrar, ele vê o que fazer agora." | — |
| M2 | 1:10 | Ficha da dupla, aba Encontros. No card do encontro sem data, clique em **"Agendar encontro 5"**. O diálogo já vem com o número. | "Agenda o encontro sem sair da ficha da dupla." | — |
| M3 | 1:14 | Formulário de registro: atividades do guia, avaliação, dificuldade, próximo passo. O bloco **"Da última vez"** mostra os combinados pendentes; ele marca dois como feitos. | "Registra como foi logo depois do encontro, com os combinados da última vez já na tela." | — |
| M4 | 1:20 | Micro-corte: ícone de wifi caindo, o texto do registro continua lá ao recarregar. | — | "Caiu a internet? O rascunho fica salvo." |
| M5 | 1:22 | No encontro 5, o chip do material do guia. Clique: o material abre. | "O que o guia pede pra cada encontro está no próprio encontro." | — |
| M6 | 1:28 | A trilha de 16 encontros: os nós já realizados acendem um a um até o encontro da semana (6º na Turma 1 do staging). Sem toast: o "Metade do caminho" só dispara no 8º e o calendário do staging ainda não chegou lá. | "Cada encontro registrado avança a jornada dos dois." | — |
| M7 | 1:32 | Botão **"Pedir apoio"**. Clique. | "Travou em alguma coisa? Pede apoio, e a equipe fica sabendo na hora." | — |

**Nota sobre M5:** o assistente **não aparece** no vídeo (está em desenvolvimento). Na captura, a bolha flutuante não pode estar visível em nenhum quadro.

---

### CENA 5 · Capítulo Auxiliar executivo · 1:35–1:48

**Abre com:** vários pares de discos pequenos lado a lado (várias duplas). Kicker: **"SE VOCÊ ACOMPANHA DUPLAS"**.
**Persona:** Paula, home de auxiliar.

| # | Tempo | Ação na tela | VO | Texto na tela |
|---|---|---|---|---|
| S1 | 1:35 | Home: o resumo de saúde das duplas (em risco, atenção, em dia) entrando com stagger. A lista `DuplaLinha` abaixo. | "Quem acompanha as duplas vê numa tela só quem precisa de atenção, e por quê." | — |
| S2 | 1:40 | Push-in numa linha com o motivo escrito ("2 encontros atrasados") e o botão **Lembrar**. Clique: abre o WhatsApp com a mensagem pronta. | "O lembrete sai pelo WhatsApp, com a mensagem já escrita." | — |
| S3 | 1:45 | A agenda continua sendo da dupla: o encontro aparece marcado por eles. | "E a agenda continua sendo da dupla." | — |

**Direção:** é o capítulo mais curto de propósito. Fala de autonomia da dupla (a coordenação acompanha e lembra, não agenda por ela), o que também tranquiliza o mentor que está assistindo.

---

### CENA 6 · O ciclo fechado · 1:48–1:58

O momento de impacto: os três papéis na mesma tela.

**Layout:** tela dividida em três colunas finas, cada uma com o disco do papel no topo (amarelo · lima · pares pequenos). Fundo papel.

| Tempo | Ação | VO |
|---|---|---|
| 1:48 | Coluna do mentor: clique em "Pedir apoio". Aparece "Apoio solicitado: a equipe já foi avisada". | "Alguém pediu ajuda." |
| 1:51 | Coluna da equipe: o sino acende, o pedido entra no topo. Clique em **"Marcar como atendido"**. Toast: "Pedido de apoio atendido." | "Alguém viu na hora." |
| 1:54 | Coluna do mentor: o aviso some. Os discos lima e amarelo, no topo, se aproximam. | "E quem pediu sabe que foi ouvido." |

**Captura:** no staging, de verdade: `mentor@` pede apoio, `coord@` marca como atendido, `mentor@` recarrega e o aviso some. Nunca gravar com dados reais de produção. Depois, `pnpm seed:demo` limpa o estado.

---

### CENA 7 · End card · 1:58–2:05

**Fundo tinta.** Os dois discos sobrepostos ao centro, o logo ao lado.

| Tempo | Elemento |
|---|---|
| 1:58 | Discos + logo **realiza.vc** (claro sobre tinta). |
| 1:59 | Frase em Mitr: **"O encontro é de vocês. O resto fica organizado aqui."** |
| 2:01 | Abaixo, mono: "PROGRAMA DE MENTORIA SOCIAL · INSTITUTO REALIZA.VC" |
| 2:02 | CTA em pílula lima, texto em tinta: **"Entre pelo link que chegou no seu e-mail"** |
| 2:02–2:05 | Hold parado, música resolve. |

**VO (1:58):** "realiza.vc. O encontro é de vocês. O resto fica organizado aqui."

Alternativas de frase final (escolher uma):
1. "O encontro é de vocês. O resto fica organizado aqui."
2. "A mentoria acontece no encontro. A plataforma cuida do caminho."
3. "Do primeiro ao décimo sexto encontro, num lugar só."

Alternativa de CTA para público externo (teaser): "Conheça sem login: realizavc.vercel.app/demo".

---

## 6. Narração completa (pra gravar de uma vez)

> Uma mentoria acontece numa conversa entre duas pessoas.
> Mas, até aqui, ela era organizada em quatro lugares diferentes.
>
> O mentor procurava no WhatsApp o que tinha sido combinado.
> O jovem não sabia quando era o próximo encontro, nem onde estava o próprio plano.
> E quem acompanhava as duplas descobria o problema quando ele já tinha virado atraso.
>
> *(pausa)*
>
> Agora a mentoria inteira mora num lugar só.
> A plataforma do Programa de Mentoria Social.
>
> A Ana abre o celular e já sabe: quando é o próximo encontro e onde entrar na chamada.
> Ela marca os horários livres, e a agenda cruza com os do mentor.
> O plano de metas e a Roda da Vida saíram do papel e ficam com ela.
> Depois de cada encontro, ela conta como foi em poucos toques.
> E, se precisar de ajuda, fala direto com a equipe. Esse pedido é só dela.
>
> O Otávio é mentor voluntário. Ao entrar, ele vê o que fazer agora.
> Agenda o encontro sem sair da ficha da dupla.
> Registra como foi logo depois do encontro, com os combinados da última vez já na tela.
> O que o guia pede pra cada encontro está no próprio encontro.
> Cada encontro registrado avança a jornada dos dois.
> Travou em alguma coisa? Pede apoio, e a equipe fica sabendo na hora.
>
> Quem acompanha as duplas vê numa tela só quem precisa de atenção, e por quê.
> O lembrete sai pelo WhatsApp, com a mensagem já escrita.
> E a agenda continua sendo da dupla.
>
> Alguém pediu ajuda.
> Alguém viu na hora.
> E quem pediu sabe que foi ouvido.
>
> realiza.vc. O encontro é de vocês. O resto fica organizado aqui.

**~270 palavras · ~2:00 a 140 ppm.** Se passar do tempo, o primeiro corte é S3.

---

## 7. Cortes derivados

### Jovem · 30s · 9:16
| Tempo | Cena |
|---|---|
| 0:00–0:04 | 1B condensada: "Quando é o próximo encontro?" sobre tinta. |
| 0:04–0:07 | Reveal curto: discos se encontram + logo. |
| 0:07–0:12 | J1 (próximo encontro) |
| 0:12–0:16 | J2 (horários em comum) |
| 0:16–0:20 | J3 (metas e Roda da Vida) |
| 0:20–0:25 | J5 (pedir ajuda + "O seu mentor não vê esse pedido.") |
| 0:25–0:30 | End card vertical: discos, logo, "Entre pelo link que chegou no seu e-mail". |

Copy mais direta, em segunda pessoa ("você"). VO: "Seu próximo encontro, sua agenda, suas metas e um botão de ajuda que é só seu. Tudo no celular."

### Mentor · 30s · 9:16 e 16:9
1A condensada (0–4s) → reveal (4–7s) → M2 + M3 (7–17s) → M6 trilha acendendo (17–21s) → M7 pedir apoio (21–25s) → end card (25–30s).

### Teaser · 15s
Cold open acelerado (0–5s) → ponto vermelho "Quando alguém via, já era tarde." (5–7s) → discos se encontram no beat + logo (7–11s) → "Do primeiro ao décimo sexto encontro." + CTA (11–15s).

**Safe areas no 9:16:** nada importante nos 12% de cima nem nos 18% de baixo (interface do Instagram/WhatsApp). Logo e CTA dentro do quadrado central para sobreviver ao corte 1:1.

---

## 8. Lista de captura (shot list)

Gravar no staging (login por senha com as contas de teste), tela 1920×1080 a 2x (para ter margem de push-in), tema claro, sem cursor do sistema (cursor animado na edição) ou com cursor grande e lento.

| ID | Persona | Rota / tela | O que gravar |
|---|---|---|---|
| J1 | Ana | `/jovem` (viewport 390×844) | home parada 3s, depois rolagem lenta até a jornada |
| J2 | Ana | `/jovem/perfil` | grade de disponibilidade (não salvar) |
| J3 | Ana | `/jovem/pdm` e Roda da Vida | árvore abrindo; polígono da roda |
| J4 | Ana | avaliação de encontro realizado | toque nas estrelas e chip |
| J5 | Ana | `/jovem` → "Precisa de ajuda?" | diálogo do chamado aberto |
| M1 | Otávio | `/` | home do mentor |
| M2 | Otávio | `/duplas/[id]?aba=encontros` | "Agendar encontro N" no card |
| M3 | Otávio | registro do encontro | formulário + "Da última vez" |
| M5 | Otávio | material do encontro | chip do guia → material abre (sem bolha do assistente no quadro) |
| M6 | Otávio | trilha da ficha | pan lento pelos 16 nós, realizados acesos |
| M7 | Otávio | "Pedir apoio" | |
| S1–S3 | Paula | `/` (auxiliar) | resumo + `DuplaLinha` + "Lembrar" |
| C6 | Otávio + Marina (equipe) | staging, `mentor@` + `coord@` | o ciclo do apoio em duas janelas |

**Checklist de captura:** bolha do assistente fora do quadro, onboarding de cada persona já visto (senão o wizard aparece), DemoBar escondida ou cortada no enquadramento, zoom 100%, notificações do sistema desligadas, devtools fechado.

---

## 9. Pendências antes de produzir

1. **Domínio do CTA:** confirmar se o link oficial é `realizavc.vercel.app` ou se haverá domínio próprio.
2. ~~Assistente (M5)~~ **decidido:** fora do vídeo, está em desenvolvimento.
3. **"Supervisor" × "Auxiliar executivo":** a interface usa "Auxiliar executivo". O roteiro fala "quem acompanha as duplas" na VO para não travar no nome; confirmar se o programa quer o título explícito no kicker.
4. **Licença da trilha** para uso público (a do brag foi usada num vídeo interno).
5. **Números de impacto (opcional):** os cronogramas oficiais indicam Turma 1 com 13 duplas e Turma 2 com 17 (30 duplas no pico, encerramento em 15/01/2027). Se quiser um cartão "30 duplas, 2 turmas, um lugar só" antes do end card, confirmar os números atuais com a coordenação antes.
6. **Citação da Kelyng (1A):** a frase vem da reunião de 01/out. Se for aparecer como citação atribuída (com nome), pedir autorização a ela; sem nome, segue como está.
