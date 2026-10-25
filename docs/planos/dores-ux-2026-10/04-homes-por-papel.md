# Plano 04 — Homes por papel: "o que fazer agora"

> A home do mentor (`src/components/mentor-home.tsx`) é o melhor padrão do
> produto: uma ação por dupla, derivada do estado ("O 2º encontro aconteceu.
> Falta só o registro." → "Registrar como foi"). Resolve detectar, entender e
> agir numa tela só. Este plano leva o mesmo padrão para o jovem, a
> coordenação e o supervisor.

## 1. Jovem (`/jovem`), o ciclo semanal primeiro

### Problema (medido, 390px)

- **Altura:** 4.712px.
- **Ordem atual** (`src/app/(jovem)/jovem/page.tsx`):
  1. "Precisa de ajuda?" (`:315`)
  2. Minha mentoria (`:357`)
  3. "Como as pessoas próximas te veem" (`:444`)
  4. Encontros (`:464`), onde está o próximo encontro
  5. Especialistas (`:552`)
  6. Avaliações (`:563`)
  7. Combinados (`:581`)
  8. Documentos (`:595`)
  9. Avisos (`:701`)
  10. Materiais (`:744`)

  O próximo encontro, que é o motivo de abrir o app, é a 4ª seção.
- **Avaliações:** seis botões "Avaliar" preenchidos e iguais. A lista repete
  "1º encontro" e "3º encontro" sem dizer com quem (mentor ou especialista)
  e mostra a data de `created_at`, não a do encontro
  (`jovem-avaliacoes.tsx:167`, `:186`, `:190`).
- **Contagem inconsistente:** "11 encontros já feitos" (`:186`, `:541`) soma
  os encontros com o mentor e com a especialista. Na jornada, o mesmo jovem
  está no "encontro 5 de 16".
- **Privacidade da avaliação em três versões:**
  - lista: "Pro seu mentor aparece a sua nota" ou "só aparece a média"
    (`jovem-avaliacoes.tsx:172-173`);
  - cabeçalho do diálogo: "só a sua nota aparece";
  - formulário: "vê só as estrelas desta sessão".

  O jovem não sabe o que o mentor vê, justamente no momento de avaliar.

### Proposta

```
┌ Seu próximo encontro ─────────────────── (amarelo da marca) ┐
│ 6º encontro com Ricardo · terça 27/10, 19h                  │
│ [ Entrar na chamada ]   (no dia)  /  [ Agendar ] (sem data) │
└─────────────────────────────────────────────────────────────┘
Para fazer agora (no máx. 2)
  ★ Avaliar o 5º encontro com Ricardo        [ Avaliar ]  + mais 3
  ○ Combinado: Revisar as duas primeiras submetas · até 03/11
Sua jornada            ▮▮▮▮▮▯▯▯… 5 de 16      Ver jornada ›
Especialistas          1 sugestão esperando você   Ver ›
Precisa de ajuda?  Fale com a equipe ›     ← linha fixa, discreta
```

- **Um hero só:** o próximo encontro, com uma ação conforme o estado
  (Agendar / Entrar / Avaliar o último).
- **"Para fazer agora"** com no máximo 2 itens. As avaliações pendentes
  viram um item com contador ("+ mais 3"), não seis botões.
- **Cada avaliação rotulada** por pessoa e trilha ("3ª sessão com Sofia"),
  com a data do encontro e em ordem cronológica.
- **Contagem por trilha:** "5 de 16 com seu mentor · 2 sessões com
  especialista".
- **Privacidade:** uma frase única por trilha, definida num só lugar e
  reusada na lista, no diálogo e no formulário público.
- **Mudam de lugar:**
  - "Como as pessoas próximas te veem" vai para `/jovem/materiais`, junto
    da avaliação por terceiros, que é a origem do conteúdo;
  - documentos e avisos vão para o perfil e as notificações;
  - "Precisa de ajuda?" vira uma linha fixa discreta, sem deixar de ser
    alcançável.
- **A verificar:** o histórico do jovem mostra o 5º encontro passado ainda
  como "Agendado", com 3 ações. Pode ser dado da demo ou falta do estado
  "aguardando registro". Conferir em `jovem/agenda` antes de tratar como bug.

## 2. Coordenação (`/`), triagem, não inventário

### Problema

- **Altura:** 6.441px no celular.
- **Conteúdo da página:**
  - 2 blocos de turma;
  - 2 banners vermelhos (apoio e "jovem pediu ajuda");
  - a barra de duplas com 5 filtros;
  - **todas** as duplas em cards tingidos (8 de 10 âmbar, então o âmbar
    deixou de sinalizar exceção);
  - 5 avisos, cada um com "Reenviar por e-mail" e lixeira (detector:
    texto repetido 5× no mesmo card);
  - pedidos de especialista e trilhas de especialista.
- **Duplicação:** a lista completa de duplas já existe em `/duplas`.

### Proposta

```
Olá, Marina                                         seg 26/10
[ Situação das duplas: 10 em andamento · 1 em risco · 2 apoios ]  ← plano 03
Precisa de você hoje  (máx. 5, ordenado por urgência)       Ver todas ›
  ● Fernanda e Dandara · 2 encontros atrasados + apoio pedido   [ Abrir chamado ]
  ● Wendel · pedido de especialista em triagem há 6 dias        [ Liberar ]
  ...
Esta semana   Turma 1: encontro 5 (0 de 4 registraram) · Turma 2: encontro 1 (2 de 3)
Avisos (3)  ›          Trilhas de especialista (3 ativas) ›
```

- **"Precisa de você hoje":** fila unificada de exceções. Junta duplas em
  risco, chamados de apoio, pedidos de especialista parados e encerramentos
  pendentes, com no máximo 5 itens e "Ver todas" levando a `/duplas` já
  filtrada. A fila de acompanhamento já existe (`fila-acompanhar.tsx`);
  reusar, sem criar outra lógica.
- **Turmas** em uma linha cada (os dados já estão nos blocos atuais).
- **Avisos e trilhas** recolhidos com contador. As ações dos avisos vão para
  o ⋯ (padrão do REALIZA-186).
- **Estado vazio positivo:** "Nenhuma dupla precisa de você hoje", com o
  destaque amarelo da marca. É a celebração discreta do plano 01.

**Meta:** altura ≤ 2.000px no celular, com 10 duplas ativas.

## 3. Supervisor (`/`)

A mesma estrutura da coordenação, com o recorte das duplas que a pessoa
supervisiona. A ação contextual é "Lembrar" ou "Chamar"; "Registrar
supervisão" **não existe** (decisão já fechada no HANDOFF).

## 4. Mentor (`/`), ajustes no padrão que já funciona

- **Duplas concluídas** saem do meio das ativas. Vão para um bloco "Ciclos
  concluídos", com um fechamento celebrativo (hoje: card cinza "Jornada
  concluída. Agradecemos pelo ciclo!").
- **Cards sem aninhamento:** "O que fazer agora" e "Combinados" deixam de
  ser cards dentro do card (detector `nested-cards`). Viram seções do mesmo
  cartão, separadas por divisória.
- **Faixa "O que fazer agora"** com o destaque amarelo da marca (é um próximo
  passo), não com a borda âmbar de alerta (plano 01).
- **Legenda da jornada:** os 5 estados de bolinha ("com registro",
  "registro pendente", "a confirmar", "agendado", "a caminho") passam a ser
  3 visíveis. Os demais ficam no rótulo de cada bolinha.
- **"Registrar como foi"** abre a sheet do plano 05 sem sair da home.
- **Banner "Termo de adesão pendente"** continua, mas compacto, depois da
  primeira dupla e não acima dela.

## Escopo de arquivos

- `src/app/(jovem)/jovem/page.tsx`, `jovem-avaliacoes.tsx`,
  `avaliacao-encontro-form.tsx`, `jovem-pedir-ajuda.tsx`
- `src/app/(app)/(home)/page.tsx`, `dashboard-coordenacao.tsx`,
  `fila-acompanhar.tsx`, `avisos-section.tsx`, `demandas-especialista.tsx`
- `src/components/mentor-home.tsx`, `termo-banner.tsx`
- `loading.tsx` das homes (skeletons, REALIZA-203)

## Critérios de aceite

- [ ] Jovem: o próximo encontro e a ação dele ficam acima da dobra a 390×844.
- [ ] Jovem: no máximo 1 botão preenchido visível na primeira tela.
- [ ] Jovem: a privacidade da avaliação vem de uma constante única (grep da frase = 1 definição).
- [ ] Coordenação: altura ≤2.000px no celular com o dataset demo; nenhuma informação perdida (tudo está a 1 toque).
- [ ] Coordenação e supervisor: "Precisa de você hoje" ordenado por urgência, com no máximo 5 itens.
- [ ] Mentor: detector `nested-cards` = 0 na home.

## Decisões pendentes

- **D6:** "Como as pessoas próximas te veem" sai da home do jovem? É um
  conteúdo emocionalmente forte; pode ser intencional mantê-lo em destaque.
- **D7:** os avisos da coordenação continuam na home (recolhidos) ou viram
  uma página/drawer?
