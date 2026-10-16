# Rodada 1 de mockups — relatório comparativo

_15 variantes (5 telas × 3), geradas por agentes independentes com o mesmo brief (`_brief.md`), screenshots Playwright em 1280px e 390px, julgadas por 5 revisores de UX com rubrica de 7 critérios (1–10)._

**TL;DR — vencedoras por tela:**

| Tela | Vencedora | Direção |
|---|---|---|
| agenda | **v3** | Cards por dia (Hoje/Amanhã/Próximos) + chips de escopo |
| duplas | **v3** | Seções agrupadas por categoria com régua no header |
| materiais | **v2** | Hero "Minha jornada" com trilha de marcos + 3 portais |
| chamados | **v3** | Inbox denso + detalhe full-page |
| jovem-especialistas | **v3** | Card-CTA na home → página cheia |

Arquivos: `docs/mockups/<tela>/v{1,2,3}.html` + `v{N}-{desktop,mobile}.png`.

---

## Agenda (mentor DPP, 2 turmas)

**Vencedora: v3** — recorte temporal Hoje > Amanhã > Próximos com sticky headers. Responde "o que eu tenho hoje" primeiro; card guest âmbar tracejado com "agenda da Ana — você não participa" resolve ver-sem-participar por texto, não cor; é acionável (Entrar no Meet, Lembrar o Caio, Preencher registro); escala pra coordenação melhor que grade ou colunas.

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

## Jovem-especialistas

**Vencedora: v3** (57pts) — nav intocada (5 itens atuais) + card-CTA lime na home com estado vivo ("Luísa propôs sexta 24/10 às 16h · seu pedido em negociação") → página cheia `/jovem/especialistas`. Única que modela o fluxo real (solicitação → mural → proposta/negociação, stepper 4 passos, limite de 3, dedup honesto, horários livres), única com desktop desenhado (sidebar), única que acerta a nav amarela do jovem (`--role-mentorado`).

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
