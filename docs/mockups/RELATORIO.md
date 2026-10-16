# Mockups — relatório comparativo

_Rodada 1: 15 variantes (5 telas × 3), screenshots Playwright 1280/390px, 5 juízes UX. Rodada 2: +4 variantes focadas em regra de negócio (agenda v4/v5, jovem-especialistas v4/v5), julgadas contra as vencedoras R1 com rubrica de domínio._

**TL;DR — vencedoras por tela:**

| Tela | Vencedora | Direção |
|---|---|---|
| agenda | **v4** (R2) | Duas superfícies: "Minha agenda" × "Acompanhando seus jovens" + grade de disponibilidade do especialista |
| duplas | **v3** | Seções agrupadas por categoria com régua no header |
| materiais | **v2** | Hero "Minha jornada" com trilha de marcos + 3 portais |
| chamados | **v3** | Inbox denso + detalhe full-page |
| jovem-especialistas | **v4** (R2) | Trilha explícita: sessões 1–5 com estados, solicitação sem horário, apoio como outro canal |

Arquivos: `docs/mockups/<tela>/v{1..5}.html` + `v{N}-{desktop,mobile}.png` (v4/v5 só em agenda e jovem-especialistas).

---

## Rodada 2 — a correção de domínio

A R1 ganhou em forma mas falhou em regra de negócio — parecia calendário/loja genéricos. A R2 atacou as 3 dores reais e o erro de conceito em especialistas.

### Agenda — vencedora **v4 "duas superfícies"** (78,5 × 75,5 da v5, 47 da v3)

Estrutura da página resolve o domínio, não etiqueta: "Minha agenda" fica pura (só compromissos do André, cronológica, com legenda-nota "a T2 começou 3 semanas depois — por isso a Ana está no 8 e o Caio no 5"); toda a jornada vive na superfície âmbar "Acompanhando seus jovens" (progresso 3/5, registro + ★4, sessão 4 sem horário, stepper da solicitação do Caio). Na Luísa, a grade semanal de disponibilidade é instrumento de trabalho — a proposta do Pedro cai numa terça sem janela, com tag "fora da grade" e as duas ações de resposta.

**Resolve as 3 dores?** Multi-turma: sim. Jornada DPP: sim (participo × acompanho é o princípio organizador). Disponibilidade: sim.

**Resgates da v5:** barra "encontro 8 de 16 · T1" no header da dupla; faixa "Sua semana" (strip seg–dom); seção "Do programa" pra supervisão/formação; estado vazio do Caio; "+ novo" slot na grade.
**Resgates da v3:** pendências do próprio mentor como warnrows no topo de "Hoje" (na v4 elas caíram na superfície errada); prazo vermelho discreto; chips de escopo como filtro pra quem tem 3+ duplas.
**Correções p/ implementação:** metas/legendas 9,5–11,5px → ~12px; botões → ≥44px; grade da Luísa precisa de faixa horária configurável (a do mock é fixa 9–17h); Caio é qua 19h (o mock pôs 20h).

### Jovem-especialistas — vencedora **v4 "trilha explícita"** (8,8 × 8,7 da v5, 5,1 da v3)

Única que transforma a separação de conceitos em estrutura: trilha ativa (agendar mora dentro da sessão 4, nunca fora), solicitação de trilha com stepper "Pedido → Mural → Aceita → Trilha" visivelmente **sem** campo de horário ("ainda não tem especialista — por isso também não tem horário aqui" — a melhor copy da rodada), e pedido de apoio como linha discreta no rodapé ("outro canal"). A trilha é entre mentorado e especialista — a coordenação só acompanha, não analisa nem designa (copy corrigida após validação de domínio). O catálogo mostra disponibilidade em períodos ("sex à tarde") — remove a affordance de agendamento na raiz.

**Resgates da v5:** ciclo de vida com datas como header do card de trilha; sessões como cards com pill de estado + "Remarcar" + sessão final trancada; item "Trilha" na bottom nav — **decisão de produto aberta** (6 itens na nav × destino semanal real quando há trilha ativa; alternativa: item aparece só com trilha/solicitação).
**Resgate da v3:** a caixa de negociação ("Luísa propôs sex 16h, você sugeriu ter 18h — Aceitar / Propor outro") deve nascer dentro da sessão "a agendar" da v4 — o "Escolher horário" unilateral é fraco demais.
**⚠ Regra a arbitrar no domínio:** v4 permite solicitação em tema diferente coexistindo com trilha ativa; v5 impõe uma trilha por vez. Definir com a coordenação.

---

## Agenda (mentor DPP, 2 turmas) — R1, superada pela R2

**Vencedora da R1: v3** — recorte temporal Hoje > Amanhã > Próximos com sticky headers. Responde "o que eu tenho hoje" primeiro; card guest âmbar tracejado com "agenda da Ana — você não participa" resolve ver-sem-participar por texto, não cor; é acionável (Entrar no Meet, Lembrar o Caio, Preencher registro); escala pra coordenação melhor que grade ou colunas.

- **v1** (grade semanal GCal): melhor naming do par de visões ("Agenda do mentorado"/"Minha agenda") e painel contextual por pessoa — mas grade 8h–21h ~90% vazia; container domina o conteúdo.
- **v2** (seções por mentorado + mini-cal): melhor explicação do desencontro T1/T2 e base acessível (radios reais) — mas mini-cals duplicados comem ⅓ da tela e o segmented descreve agrupamento, não escopo.
- **Correção pedida na vencedora:** falta o escopo "só André" — hoje "Tudo" é o mais perto de "Minha agenda". Adicionar chip **Eu** ("Ana · Caio · Eu · Tudo"). Desenhar o modo overflow (Paula tem 6+ duplas → select).
- **Resgates:** naming do par de visões (v1); meta explicativa do desencontro "encontro 5 de 16 · quartas · turma começou depois" + faixa de steps da trilha (v2); week-strip com dots no mobile (v1).

## Duplas (coordenação)

**Vencedora: v3** — a estrutura da página É a explicação: seções na ordem do trabalho (Apoio → Em risco → Atenção → Em andamento → Pausadas), cada header com a régua ("Em risco — 2+ encontros atrasados, ou avaliação baixa + dificuldade") e contagem. Apoio lidera como trabalho a fazer, não falha ("Pedido de ajuda não é falha"). Única que encara escala real (26 duplas, massa saudável colapsada).

- **v1** (critério sempre visível nos chips): melhor resposta literal ao pedido, mas os 6 cards de categoria empurram a lista ~400px/2 viewports pra baixo; leem como painel, não como filtro.
- **v2** (legenda sob demanda): melhor razão info/pixel e modelo de dados mais coerente — mas o requisito central fica atrás de um toggle e o status é ponto de cor puro (falha de a11y).
- **Gaps a resolver na vencedora:** sem "Nova dupla" nem filtro por categoria (chips que saltam pras seções resolvem); compactar cards.
- **Resgates:** barra "feito × esperado" com tick de referência (v1) — visualiza a lógica do semáforo; pills de sinal com ícone + recência "há 26 dias" + resumo "2 em risco · 3 em atenção" no subtítulo (v2); legenda expansível como referência secundária quando a lista estiver filtrada (v2).

## Materiais (jovem)

**Vencedora: v2** — hero lime "Minha jornada" com trilha de 5 marcos (feito ✓ / em andamento com halo+barra / futuro tracejado) + 3 portais neutros. Único que entrega jornada-como-percurso E hub limpo; verde mais elegante (um bloco protagonista, não parede); melhor base de a11y (focus-visible, aria-current, reduced-motion).

- **v1** (4 portais iguais): mais previsível, mas jornada sem precedência e parede de lime satura ~60% da tela.
- **v3** (trilha narrativa): emocionalmente superior (citações "Você escreveu…", estações por encontro) mas página longuíssima — kit vira rodapé inalcançável no mobile.
- **Correções na vencedora:** ordem dos marcos (PDM "em andamento" antes de Roda "concluída" quebra a leitura linear); trazer snippet de resposta por marco; reforçar contraste do marco futuro.
- **Resgates:** citações pessoais + "próxima parada" com data (v3); modelo de listagem interna com ações Baixar/Assistir/Abrir/"Em breve" + contadores por portal (v1).
- **Pendência de produto:** de onde saem os marcos (ciclo_eventos × respostas) e "Continuar" do PDM → edição ou visualização (`duplas.pdm_url` é RPC-guardado).

## Chamados (coordenação)

**Vencedora: v3** (62pts) — inbox estilo e-mail com a triagem mais completa (busca, "Sem dono 3", "Atribuídos a mim", badge NOVO, ordem por última atualização) e detalhe full-page mais rico (semáforo da dupla, link pra ficha, timeline público×interno intercalada, anexo, @mention). Único com as duas telas funcionais no mobile.

- **v1** (master-detail): melhor thread e legenda público×interno ("o André vê / só a equipe"), composer default interno (seguro) — mas mobile é só a fila; detalhe inexiste.
- **v2** (board por status): coluna "Aberto" vermelha = triagem automática e "mais antigo há 1 d" no header — mas sem composer e thread espremida em 370px.
- **Correções na vencedora:** composer defaulta público — inverter pra interno; reforçar "aberto sem dono" com tint/borda na linha (hoje só o pill); separar facetas da barra de filtro (categoria/status/propriedade).
- **Resgates:** legenda público×interno + master-detail como layout desktop opcional (v1); indicador de envelhecimento + resumo de resolução nos resolvidos + pill tracejado "Sem responsável" (v2).

## Jovem-especialistas — R1, superada pela R2

**Vencedora da R1: v3** (57pts) — nav intocada (5 itens atuais) + card-CTA lime na home com estado vivo ("Luísa propôs sexta 24/10 às 16h · seu pedido em negociação") → página cheia `/jovem/especialistas`. Única que modela o fluxo real (solicitação → mural → proposta/negociação, stepper 4 passos, limite de 3, dedup honesto, horários livres), única com desktop desenhado (sidebar), única que acerta a nav amarela do jovem (`--role-mentorado`).

- **v1** (aba dedicada): melhor descoberta (tripla redundância), mas rótulo "Especialistas" a 9.2px inaceitável e sacrificou "Pessoas" pro slot.
- **v2** (overflow "Mais"): não sacrifica destino e o badge "1 novidade" é inteligente — mas recurso novo atrás de "•••" tem descoberta quase nula pra quem nunca usou.
- **Correções na vencedora:** card na home hero-size (~⅓ da 1ª dobra) — versão compacta sem pendências, expande quando há; ações rápidas da negociação não podem viver dentro de `<a>`.
- **Resgates:** aba dedicada como passo futuro se a trilha virar destino semanal (v1); "Também essa semana" trazendo a sessão organicamente pra home + badge de novidade no card-CTA (v2).

---

## Transversal (vale pra todas as vencedoras)

- Fontes de 10.5–11.5px em metas/legendas precisam subir pra ~12px no produto (público até 60 anos).
- Estado nunca por cor pura — vencedoras já seguem; manter na implementação.
- Composer público×interno defaulta em **interno** (vazamento de nota interna é o pior erro possível).
- Datasets divergem entre variantes (Caio Mendes/Ramos/Martins) — padronizar se for pra teste com usuários.

## Próximo passo

Thiago aprova as 5 vencedoras (+ resgates a incorporar) → implementação segue REALIZA-133/136/139/140 + epic 127. Mockups e este relatório estão em `docs/mockups/` (não commitado).
