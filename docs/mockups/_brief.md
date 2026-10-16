# Brief compartilhado — mockups UX Realiza.vc

Você está criando **UM** mockup standalone de UMA tela da plataforma Realiza.vc. É um HTML estático de apresentação — não precisa de backend, JS funcional ou dados reais. Serve pra equipe avaliar direção de design antes de implementar.

## Regras do arquivo

- **Um arquivo HTML único**, CSS inline no `<style>` do head (sem frameworks, sem build).
- Pode usar Google Fonts via `<link>` (Inter) e SVG inline pra ícones — **nada de CDN de CSS/JS** (mockup deve abrir offline).
- **Responsivo**: deve ler bem em desktop 1280px E mobile 390px (media queries no próprio CSS).
- Copy em **pt-BR real** — textos como seriam no produto, nomes brasileiros, nada de lorem ipsum.
- Ícones: SVG inline simples (estilo Phosphor — linhas finas, stroke 1.5–2, cantos arredondados). Não importe biblioteca de ícones.
- Comentário no topo do arquivo: `<!-- MOCKUP <tela> v<N> — <direção> -->`.

## Tokens do produto (copie estes valores)

```css
:root {
  --brand-lime: hsl(78 56% 53%);      /* verde principal */
  --brand-ink: hsl(0 0% 15%);         /* quase-preto texto */
  --background: hsl(75 10% 95%);      /* fundo "papel" quente */
  --card: hsl(0 0% 100%);
  --muted: hsl(75 7% 93%);
  --muted-foreground: hsl(75 4% 40%);
  --accent: hsl(75 8% 91%);           /* hover */
  --border: hsl(75 6% 87%);
  --input: hsl(75 8% 54%);
  --ok: hsl(78 58% 38%);
  --ok-text: hsl(78 55% 30%);
  --warn: hsl(43 95% 44%);
  --warn-text: hsl(43 90% 30%);
  --danger: hsl(0 80% 48%);
  --role-mentor: var(--brand-lime);   /* marcador mentor */
  --role-mentorado: hsl(48 100% 60%); /* marcador jovem (amarelo) */
  --radius: 0.75rem;                  /* cantos arredondados generosos */
}
```

Fonte: **Inter**. Personalidade da marca: quente, direta, verde-lima como acento único, muito espaço em branco, cantos arredondados (12px+), densidade confortável — produto pra gente de 15 a 60 anos.

## Personas e dados de referência

- **Marina Costa** — coordenação. Vê tudo.
- **Paula Nunes** — auxiliar executivo (papel `supervisor`). Supervisiona 6 duplas de T1 e T2.
- **André Lima** — mentor DPP. Dois mentorados em turmas diferentes: **Ana (T1, encontro 8)** e **Caio (T2, encontro 5)** — cronogramas desencontrados.
- **Luísa Prado** — mentora especialista. Trilha de 5 sessões com a Ana (3 meses).
- **Ana Souza** — mentorada de T1. Usa o app no celular.

Contexto do programa: 16 encontros semanais por dupla (terças 19h–20h). T2 começou ~3 semanas depois de T1. Chamados usam protocolo `CHA-000XXX`. Semaforo das duplas: ok / atenção / risco + sinais (encontros atrasados, registro pendente, avaliação baixa, chamado de apoio).

## Requisitos por tela

Cada tela abaixo lista o que o mockup **precisa** mostrar — a organização/direção vem do seu prompt individual.

### agenda
Persona: **André (mentor DPP)** — o caso rico. Precisa mostrar:
- O **par de visões**: "Agenda do mentorado" (compromissos do jovem: encontros DPP + sessões com especialista Luísa + eventos oficiais) × "Minha agenda" (tudo do André, duas turmas misturadas) — o mecanismo de alternância é parte do que se avalia.
- Itens: encontro 8 com Ana (ter 19h), encontro 5 com Caio (qua 19h — T2 deslocada), sessão especialista da Ana (sex 16h, marcada "Luísa"), formação de mentores sáb 10h, prazo "avaliação de encontro" em vermelho discreto.
- Como identificar a turma/dono de cada item no consolidado (T1/T2, Ana/Caio).
- Mobile: como a agenda colapsa sem perder a lógica.

### duplas
Persona: **Marina (coord)** — `/duplas` redesenhada. Precisa mostrar:
- Chips de categoria: Todas, Em risco, Atenção, Em andamento, Pausadas, **Apoio** (novo, separado e destacado — chamado aberto ≠ falha da dupla).
- **Critério de cada categoria** explicado (a forma varia por variante): risco = "2+ encontros atrasados, ou avaliação baixa + dificuldade"; atenção = "1 atraso, avaliação baixa, registro/encaminhamento pendente"; apoio = "chamado aberto"; pausada = "jornada congelada".
- **Motivos por dupla** (dinâmico): "2 encontros atrasados · registro do 6º pendente" — plural, não só o primeiro motivo.
- Badge de avaliação (Boa/Regular/Excelente/Baixa) com explicação do que mede (nota do mentor ao último encontro).
- ~8 duplas com dados variados cobrindo todos os estados.

### materiais
Persona: **Ana (jovem)** — `/jovem/materiais` como hub. Precisa mostrar:
- Portais: **Minha jornada** (documentos que ela respondeu: anamnese, metas, PDM, roda da vida, autoavaliação — com datas), **Guias oficiais**, **Modelos e instrumentos**, **Links**.
- Cards grandes com ícone SVG próprio por portal — não linhas retangulares genéricas.
- Verde-lima como presença forte mas elegante.

### jovem-especialistas
Persona: **Ana**. O catálogo sai da home e vira destino próprio. Mostrar:
- Home do jovem enxuta (próximo encontro, pendência rápida, atalhos) + a **página/aba Especialistas** (catálogo com ~4 especialistas em cards, pedido em andamento, CTA "pedir apoio de especialista").
- A solução de **navegação mobile** (bottom nav hoje: Início, Agenda, Pessoas, Materiais, Perfil — Especialistas precisa entrar; alguém sai ou vira overflow).

### chamados
Persona: **Marina (coord)** — `/chamados` fila + thread. Precisa mostrar:
- Fila: filtros por categoria (agenda/metodologia/plataforma/urgencia/outro), status, atribuído; linhas com `CHA-XXXXXX`, autor+papel, dupla, categoria colorida, status, atribuído, idade.
- Chamado `em_atendimento`: fora do vermelho mas visível, com dono ("em atendimento · Marina").
- **Detalhe/thread**: timeline de **atualizações públicas** ("Pedido sendo revisado", "Aguardando liberação de verba", "Paula designada para acompanhar — atendimento iniciado") + comentários internos da equipe + ações (assumir, atribuir, resolver, reabrir).
- ~6 chamados cobrindo categorias e status diferentes.

## Rodada 2 — agenda com as regras de negócio reais

A rodada 1 de agenda ganhou elogios de forma (cards por dia no desktop) mas falhou em DOMÍNIO — parecia calendário genérico. As dores reais que a agenda precisa resolver:

### 1. Mentor com jovens em cronogramas/turmas diferentes — sem confundir
O André (mentor DPP) tem compromissos com a Ana (T1, terças, encontro 8) e com o Caio (T2, quartas, encontro 5 — a turma começou 3 semanas depois). A agenda precisa deixar ÓBVIO a qual turma/dupla cada item pertence e por que os números de encontro divergem — sem o mentor ter que deduzir. Agrupar por turma, por dupla ou por tempo são respostas possíveis — escolha e justifique.

### 2. DPP é orientador pessoal — precisa ver a jornada com especialistas
Além dos compromissos DELE, o mentor acompanha como os jovens progridem com os especialistas (ele não participa das sessões, mas precisa saber): sessão 3 de 5 com a Luísa marcada pra sexta, a sessão 2 já tem registro e o jovem avaliou ★4, a sessão 4 ainda sem horário. Isso não é "evento na agenda" — é **acompanhamento de jornada**: progresso da trilha, últimos registros, pendências ("sessão 4 sem data", "avaliação do encontro 7 pendente"). O desafio: mostrar isso SEM poluir a agenda dele — uma camada/seção própria, ou itens visualmente distintos como "você acompanha, não participa".

### 3. Disponibilidade — principalmente na agenda do especialista
Especialistas gerenciam a trilha pelo que ESTÁ livre. A agenda da Luísa precisa mostrar: grade de disponibilidade semanal (dias/horários que ela oferece), sessões já marcadas das suas trilhas (Ana 3/5, Pedro 1/5), sessões pendentes de agendar (o jovem propôs horário? falta confirmar?), e o prazo das trilhas (~3 meses). A grade de disponibilidade é tão importante quanto os eventos — é o instrumento de trabalho dela.

### 4. O básico bem feito
Hoje/amanhã/próximos, compromisso vs pendência vs "informativo", ações claras (entrar no Meet, lembrar, ver registro), mobile que colapsa sem perder lógica. Poucos itens por semana é a realidade — não force densidade.

### Rodada 2 deve mostrar DUAS personas no mesmo arquivo
Como o mock jovem-especialistas fez: a agenda do **André (mentor)** E a agenda da **Luísa (especialista)** — lado a lado no desktop, empilhadas no mobile, com um rótulo "Persona: …" por prancheta. O mesmo arquivo prova as duas visões.

## Rodada 2 — especialistas: separar apoio de trilha

Os mocks da rodada 1 misturaram três coisas diferentes sob o rótulo "pedido de apoio". O domínio real:

1. **Pedido de apoio** = chamado pra COORDENAÇÃO (o sistema de tickets — categorias agenda/metodologia/plataforma/urgência/outro). Não é desta tela; pode aparecer só como atalho secundário ("outra coisa? fale com a coordenação").
2. **Solicitação de trilha de especialista** = a Ana pede acompanhamento especializado → o pedido vai pro **mural dos especialistas** → um especialista que combina com o tema aceita (ela pode indicar preferência) → nasce a **trilha** (~5 sessões em ~3 meses). É um processo com estado (no mural → aceita → em andamento), não um agendamento. **A trilha não passa pela coordenação — é entre mentorado e especialista; a coordenação só observa.**
3. **Agendar sessão** = DENTRO de uma trilha ativa, cada sessão é marcada entre jovem e especialista (proposta/contra-proposta de horário). "Agendar encontro com especialista" só existe depois que a trilha existe.

A tela da Ana deve mostrar: a trilha ativa (com Luísa — sessão 3 de 5, próxima marcada sex 16h, sessão 4 ainda sem horário), o estado de uma solicitação pendente se houver, o CTA de nova solicitação de trilha, o catálogo, e a distinção clara entre "pedir trilha" e "agendar sessão" — quem olha a página tem que entender que não dá pra "marcar horário" direto com especialista nenhum.

## O que NÃO fazer

- Não use dados genéricos americanos (John Doe, lorem ipsum).
- Não faça variantes iguais trocando cor — cada uma tem direção própria (vem no prompt).
- Não implemente funcionalidade — é apresentação estática. Hover/focus CSS simples ok.
- Não copie o visual de outra variante se encontrar o arquivo — trabalhe só com seu brief.
