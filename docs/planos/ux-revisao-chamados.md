# Revisão de UX + Sistema de chamados — reunião Leo (out/2026)

Feedback da reunião: o Leo não gostou da agenda e de outras telas; decisão de **explorar variantes em mockup antes de implementar**, julgadas por agentes-revisores de UX. Este doc consolida os pedidos, propõe a arquitetura de cada frente e abre as perguntas que faltam. **Nada aqui é implementação** — material de decisão; depois de alinhado, vira issues REALIZA-* no Jira.

## Mapa das frentes

| # | Frente | Pedido original | Esforço provável |
|---|---|---|---|
| A | Sistema de chamados | Pedido de apoio universal, fora do registro, com categoria/roteamento/atribuição/status/comentários | **XL** (schema novo + fluxo + UI + semáforo) |
| B | Categorias da visão de duplas | Rotular/explicar categorias, mostrar por que tá em risco, "Pedido de apoio" separado de "Em risco" | M (depende de A pra categoria nova) |
| C | Agenda do jovem → mentor DPP | Mentor vê compromissos do mentorado incl. especialista; mentor com 2 jovens em turmas diferentes | M–L |
| D | Avaliação do jovem + registro | Compartilhar avaliação do jovem e registro do encontro com o mentor DPP | S–M (decisão de privacidade) |
| E | Aba Especialistas do jovem | Tirar do início, rota direta pro catálogo | S |
| F | Materiais como hub da jornada | Forms respondidos do jovem viram referência; view com 3–4 cards grandes verdes + ícones | M |
| G | Instrumentos do jovem | Metas (reorder+submetas+datas+limpeza), Roda da Vida (layout/labels/botões), forms com cara de site | M |
| H | Processo de mockups | Agentes geram variantes, juízes pontuam, switcher na demo | processo, não produto |

---

## A — Sistema de chamados (o bloco grande)

### Hoje

Três portas independentes que convergem pro mesmo lugar difuso:

- **`PedirApoioDialog`** (mentor, botão direto) → `pedirApoio(duplaId, mensagem)` — mensagem livre opcional, sem categoria, sem dono, sem status além de binário.
- **`registros.precisa_apoio`** — checkbox no follow-up semanal; acopla o grito de ajuda a um evento que pode nem ter relação.
- **`jovem-pedir-ajuda`** — pedido do mentorado.

Todos viram `risco` no semáforo (`saudadeDaDupla`: `pediuApoio || apoioJovem` → vermelho) e `resolver-apoio-button` fecha. Sem fila, sem histórico, sem saber quem pegou.

### Proposta: `chamados`

Entidade própria, desacoplada do registro:

```sql
chamados (
  id, dupla_id null,          -- pode ser pedido solto (jovem sem dupla, dúvida de plataforma)
  aberto_por profile_id,      -- mentor, jovem, especialista
  origem enum,                -- 'mentor' | 'jovem' | 'registro' (auto) | 'coord'
  categoria enum,             -- ver perguntas — ex.: 'relacionamento', 'agenda', 'plataforma', 'urgencia', 'metodologia'
  assunto, mensagem,
  status enum,                -- 'aberto' → 'em_atendimento' → 'resolvido' | 'encerrado'
  atribuido_a profile_id null,
  registro_id null,           -- quando nasceu de um follow-up
  resolvido_em, resolvido_por, resolucao_resumo
)
chamado_comentarios (id, chamado_id, autor_id, corpo, interno bool)
chamado_atualizacoes (id, chamado_id, autor_id, descricao, status_opcional, created_at)
  -- timeline de andamento: "pedido sendo revisado", "aguardando liberação
  -- de verba", "Maria designada como psicóloga pro Daniel — atendimento iniciado"
```

- **Categorias** ✅: `agenda` / `metodologia` / `plataforma` / `urgencia` / `outro` — e `outro` pede uma descrição curta ("descreva"). Se "relacionamento" aparecer bastante em `outro`, vira categoria própria depois (lista extensível — guardar em enum ou tabela é decisão de implementação).
- **Roteamento e papéis** ✅: a **supervisão vê todos os chamados abertos** (visão passiva, leitura) e pode **assumir/responder os não-técnicos** — agenda, metodologia, urgencia, outro (dúvidas, relacionamento e afins). **`plataforma` é coord-only** — problema técnico não passa pelo supervisor. `urgencia` notifica coord + supervisor (quem chegar primeiro assume).
- **Status**: `aberto` (vermelho/novo) → alguém assume ou responde → `em_atendimento` (**sai do vermelho mas fica visível**, badge "em atendimento · Marina") → `resolvido`. Reabrir volta pra `aberto`. Enum enxuto de propósito — a narrativa rica ("em aprovação", "aguardando liberação de verba") vive na timeline, não em status novos.
- **Timeline de atualizações** ✅ (pedido da Kelyng, out/2026): `chamado_atualizacoes` — cada entrada tem data/hora + autor + descrição livre do andamento (e opcionalmente a transição de status que motivou). **Visível pro autor** — é o "alguém já está tratando a demanda" que a coord quer passar. Comentário é conversa interna; atualização é linha do tempo pública.
- **Comentários**: visíveis pra coordenação inteira + atribuído (e supervisor se for da dupla dele). `interno=true` nunca aparece pro solicitante — é o canal de discussão da equipe.
- **Semáforo**: chamado `aberto` → categoria própria da lista ("Apoio" ou chip próprio), **separada de "Em risco"** — um pedido de ajuda atendido não é falha da dupla. `em_atendimento` volta a `atencao` no máximo, ou só badge informativo (decidir).
- **Registro**: `precisa_apoio` no follow-up passa a **abrir um chamado automaticamente** (origem='registro', categoria sugerida no form) em vez de flag solta — o checkbox vira atalho, não mecanismo paralelo. Os pedidos antigos migram como chamados resolvidos (histórico preserva).
- **UI**: fila `/chamados` pra coord/supervisor — filtro por categoria e status, agrupar por status (estilo board ou lista com chips); card na ficha da dupla com histórico; notificações na abertura/atribuição/comentário/resolução.

### Decisão fechada ✅

**Uma porta só**: mentor, jovem e o atalho do registro criam `chamados`. As três entradas atuais morrem como mecanismos e viram três pontos de entrada do mesmo sistema — `precisa_apoio` no registro abre chamado automático (origem='registro'), não flag paralela.

---

## B — Visão de duplas: categorias legíveis

### Hoje

Chips `Todas / Risco / Atenção / Pausadas / Em andamento` sem explicação de **critério** — a coord vê várias duplas em risco sem saber por quê: uma tem 2 encontros atrasados, outra 6, outra está em dia mas tem pedido de apoio. O motivo existe (`saude.motivo`) mas é uma string única, primeira-causa apenas.

### Decisão ✅ — critérios normalizados + explicados

**Duas camadas de explicação:**

1. **Critério da categoria** (estático, normalizado) — descrição breve sob cada chip ou via hover/popover. Os critérios reais de hoje, escritos em linguagem de gente:
   - **Em risco**: "2+ encontros atrasados, ou avaliação baixa **com** dificuldade identificada no último registro, ou pedido de apoio em aberto" *(o pedido de apoio sai daqui quando a Frente A entrar — vira categoria própria)*
   - **Atenção**: "1 encontro atrasado, avaliação baixa, dificuldade identificada, registro ou encaminhamento pendente"
   - **Em andamento**: "sem pendências abertas"
   - **Pausadas**: "jornada congelada — pedido de apoio fura o congelamento"
2. **Motivo da dupla** (dinâmico) — `motivos: string[]` em vez de `motivo: string`: o semáforo já computa todos os sinais mas retorna só o primeiro; listar todos responde "por que **essa** dupla tá aqui" — "2 encontros atrasados · registro do 6º pendente". Na linha da dupla vira texto ou chips de sinal.

3. **Chip novo "Apoio"** destacado (com a Frente A): dupla com chamado `aberto` entra aqui, não em Risco — salvo se também tiver sinal de risco próprio (a linha pode carregar os dois indicadores: chip Apoio + motivo de risco).
4. **Badge de avaliação explicada**: "Boa/Regular/Excelente/Baixa" (`registros.avaliacao`, escala 1–4 do form semanal do mentor sobre o último encontro) precisa de tooltip/legenda — hoje nada diz que é *a nota do mentor pro encontro* nem que `baixa` sozinha = atenção e `baixa + dificuldade` = risco. Onde renderizar a explicação: hover na badge (title/popover) + uma linha na legenda das categorias.

---

## C — Agenda (redesign geral) + agenda do jovem para o mentor DPP

### Pedido ampliado ✅

A agenda inteira precisa de redesign — **todas as personas**: coord (a grade de eventos oficiais + encontros), mentor DPP, especialista e jovem. O Leo não gostou da atual; o objetivo é "o mais intuitivo possível" e por isso ela é a tela número 1 do processo de mockups (Frente H) — as 3 variantes cobrem a visão de cada papel, não só a do mentorado.

Dentro do redesign, o pedido específico: o mentor DPP vê a agenda do mentorado — encontros da dupla (já vê) **+ sessões da trilha especialista** e outros compromissos do programa. Caso real: mentor com 2 mentorados em turmas diferentes (T1 e T2 têm cronogramas oficiais diferentes — `dupla.cronograma_id`).

### Decisões de privacidade

- ✅ **Visão completa — FECHADO.** O mentor DPP vê as sessões da trilha esp com tema/detalhes e o registro completo — a lógica da casa é que o especialista trabalha **a serviço da dupla**, não num território paralelo. A devolutiva segue existindo como resumo formal, mas deixa de ser o único canal. (Se surgir contraindicação jurídica sobre menor, revisita.)
- **Aberta — compromissos pessoais do jovem**: só itens do programa (encontro DPP, sessão esp, eventos oficiais, prazos de form) ou o jovem marca compromissos pessoais que bloqueiam horário? Se entrar pessoal, precisa de flag `privado` (mentor vê "ocupado", não o quê).

### Modelo de visões ✅ (alinhamento Kelyng, out/2026)

Cada papel com mais de uma dupla ganha **duas visões** — escopo e consolidado não são alternativa uma da outra, são dois modos:

- **Mentor DPP**: **"Agenda do mentorado"** (a agenda *do jovem* — encontros da dupla, sessões com o especialista, compromissos do programa; seletor por mentorado quando ele tem 2+) + **"Minha agenda"** (os compromissos *dele*, consolidando todos os mentorados e turmas numa grade só).
- **Mentorado**: uma agenda só — todos os compromissos dele com todos os mentores (DPP + especialista).
- **Auxiliar executivo** (papel `supervisor` — normalizar o termo: na conversa saiu "assistente executivo", no produto é "Auxiliar executivo"): **"Por turma"** (compromissos das duplas supervisionadas agrupados por turma — T1 e T2 não se misturam porque os cronogramas divergem) + **"Consolidada"** (todas as duplas dele numa grade só, cada item marcado com turma/dupla). Escopo = `duplas.supervisor_id`.
- **Coordenação**: a visão geral de sempre — grade de eventos oficiais + encontros, com filtros por turma/dupla (o redesign melhora a organização, não muda o escopo).
- **Especialista**: a agenda dele (sessões da trilha) — sem visões extras, é o caso mais simples.

O "como alternar entre as duas visões" (tabs, seletor de escopo, vista dupla) é exatamente o que as 3 variantes de mockup da agenda exploram — junto com a organização temporal em si (timeline semanal × lista por dupla × cards por dia).

---

## D — Avaliação do jovem + registro compartilhados

- ✅ **`avaliacao_jovem` visível pro mentor DPP — FECHADO: completa.** Nota + comentário do próprio encontro (via `/avaliar/[token]`) aparecem pro mentor — feedback legítimo do encontro dele. RLS hoje é coord/rls-only; abrir leitura escopada pro mentor da dupla.
- ✅ **Registro da trilha esp pro mentor DPP — FECHADO: completo.** Amarra com a decisão de visão completa da agenda (C): o mentor DPP lê os registros das sessões do especialista do mentorado dele. A `devolutiva_pdm` segue como resumo formal de encerramento, não como único canal.

---

## E — Aba Especialistas do jovem

Hoje `JovemEspecialistas` mora embutido na home (`/jovem`). Pedido: aba própria.

- Nova rota `/jovem/especialistas` — catálogo + pedidos em andamento + mesa de negociação (o componente inteiro migra).
- Nav do jovem fica com 6 itens (`Início, Agenda, Especialistas, Pessoas, Materiais, Perfil`) — a bottom nav mobile tem teto de 5: Especialistas entra e **alguém sai** — candidato natural: `Pessoas` ou `Perfil` vão pro overflow/"Mais" (o jovem usa Pessoas pra contatos — medir se é diário). Alternativa: Especialistas só aparece na nav quando o jovem tem ficha de mentorado vinculada (mesmo gate da RPC).
- Home do jovem emagrece — a seção sai e o espaço volta pros cards de encontro/combinados.

## F — Materiais como hub da jornada

### Pedido

Forms/instrumentos que o jovem respondeu (Anamnese, Autoavaliação, 360, **Metas**, PDM, Roda da Vida) são **referência viva do programa** — devem morar em Materiais, não só nos links. E a view sai de rows retangulares pra **3–4 cards grandes verdes com ícones SVG** — portas de entrada, não listagem.

### Proposta

`/jovem/materiais` (e possivelmente `/materiais` do staff) vira hub de portais:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  [SVG]      │ │  [SVG]      │ │  [SVG]      │ │  [SVG]      │
│  Minha      │ │  Guias      │ │  Modelos    │ │  Links      │
│  jornada    │ │  oficiais   │ │  e          │ │             │
│  5 docs     │ │  16 itens   │ │  instrumentos│ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

- **"Minha jornada"** = respostas do forms engine do próprio jovem + instrumentos da dupla (metas, PDM, roda) — a lista de coisas "trabalhadas por muito tempo". Cada item abre a view de resultado (`instrumento-resultado` já existe).
- Cards verdes = `--brand-lime`/`--brand-ink` com SVG próprio por portal; conteúdo dentro de cada portal mantém a listagem atual (ou a view que o mockup decidir).
- Staff: cards por audiência/tipo. O staff talvez precise mais de lista do que de portal — variante pra decidir no mockup.

## G — Instrumentos do jovem

### G1 — Metas (Definindo Minhas Metas)

A ficha vira um objeto de acompanhamento, não só de coleta:

- **Ordem = prioridade** ✅: a posição define a importância — "Minha meta 1 · a mais importante". Sai o select `meta_principal` (a ordem já diz), e o reorder (drag ou ↑↓) ganha semântica: mover é repriorizar. Persiste em `meta_ordem` no payload da resposta — não mexe nas chaves `meta_N`/`porque_N`.
- **Submetas por meta** ✅ (revisado na conversa com Kelyng, out/2026): **cascateadas** — submeta pode ter submeta, como o guia manda ("pelo documento guia, uma submeta pode ter submetas"). Limites flexíveis: **até ~10 metas** no instrumento (alinhado à duração do programa — "não adianta 20 metas que não dá pra fazer em 3 meses") e **~20 submetas no total**, em qualquer profundidade. O modelo natural é o recursivo que `atividades-interativas.md` já propõe pro PDM (`pdm_itens` com `parent_id`) — uma estrutura só pros dois instrumentos, o que resolve a pergunta 12 a favor de **mesmo dado compartilhado**. A UI é o ponto delicado: árvore aninhada tem que ficar simples (indentação leve, collapse, "adicionar dentro desta") — entra na rodada de mockups como componente.
- **Duas datas por meta** ✅: `prazo_alvo` ("quando quero atingir") + `atingida_em`. O alvo pode ser campo sempre visível; a realização entra por **checkbox "meta atingida" → abre o campo "quando?"**. Metas atingidas alimentam a **retrospectiva final** do encerramento (entram no resumo da jornada como conquistas).
- **Limpeza do bloco de revisão** ✅: saem `rev_ajudam`, `rev_importantes`, `rev_claras` (os sim/não de autoavaliação que ninguém lê) e `meta_principal` — o conteúdo pedagógico deles ("suas metas te ajudam a chegar lá? revise antes do encontro") vira **copy da seção de revisão**, não pergunta. O form passa a responder só o que é dado: metas, porquês, prazos, submetas.
- Impacto na definição: os campos removidos saem do jsonb do instrumento (migration nova atualiza `formularios.campos`) e os novos (`meta_ordem`, `submetas`, `prazo_alvo`, `atingida_em`) vivem no payload da resposta — sem coluna nova no banco, o forms engine já é jsonb. O resultado renderizado (`instrumento-resultado`) passa a mostrar ordem/prioridade, submetas e status de atingida.

### G2 — Roda da Vida

Refinamentos diretos no layout atual (a faixa verde com setas + título):

- **Título em fundo branco**, separado da navegação — hoje título e setas dividem a mesma faixa lime; separar: título da área (branco/neutro) em cima, setas < > em linha própria **acima do - / +**, e os botões **- / + e as setas em verde** (`--brand-lime` + ink) como ações primárias da zona.
- **Labels de todas as áreas visíveis no desktop** — igual ao PDF impresso: os 16 nomes ao redor da roda (hoje só o eixo ativo mostra nome embaixo). No mobile mantém o foco por eixo (não cabe) — a lista-slider por quadrante já cobre a visão geral.
- Mais responsiva no geral: a roda escala com o container (viewBox já ajuda) e a lista de sliders fica em 2 colunas no desktop?

### G3 — Forms com cara de site

Pedido transversal: os instrumentos/forms hoje são um scroll de cards — cara de "form básico". Passar a experiência de **wizard/seções** como o onboarding do jovem:

- Uma seção por vez (ou capítulos com transição), progresso visível, animações fluidas entre passos (motion já instalado — `AnimatePresence`, `layout`), feedback de transição ao concluir bloco.
- Aplica primeiro nos instrumentos de jornada (`/f/[token]` sob medida: visão → metas → roda → pdm já renderizam por seções via `agrupaEmSecoes`) e depois avalia estender ao renderer genérico dos forms da coordenação.
- Rascunho/resposta continuam os mesmos — é camada de apresentação sobre o mesmo payload jsonb.

Pergunta aberta: wizard tradicional (próximo/voltar, uma seção por tela) ou scroll com seções "snap" animadas? Pra forms de 5+ minutos, o wizard com progresso responde melhor; pra instrumento curto, o scroll animado pode bastar.

## H — Processo de mockups (como rodar)

### Fase 1 — variantes ✅ (escopo fechado)

**3 variantes × todas as telas afetadas** — primeira rodada: agenda (dor do Leo), visão de duplas, materiais, home do jovem + aba especialistas, fila de chamados ≈ **15 mocks**. Cada variante com direção de design explicitamente diferente (pra não saírem 3 iguais). Os instrumentos (metas/roda) entram numa **segunda rodada** ou como variantes menores — são componentes, não páginas inteiras.

- **Agenda = o caso mais rico**: cada variante precisa cobrir o *par de visões* por papel — mentor ("Agenda do mentorado" × "Minha agenda"), auxiliar executivo ("Por turma" × "Consolidada"), mentorado (única), coord (filtros), especialista (simples). A variante explora tanto a organização temporal quanto **como se alterna entre as duas visões** (tabs, seletor de escopo, vista dividida).
- Formato: **HTML estático standalone** em `docs/mockups/<tela>/v1.html`, `v2.html`, `v3.html` — CSS inline com os tokens do app (`--brand-lime`, `--brand-ink`, Inter), dados fake realistas pt-BR, desktop 1280 + mobile 390.
- Cada variante recebe uma **direção de design** distinta — ex. agenda: (1) timeline vertical tipo Google Cal semanal; (2) lista por-dupla com calendário inline compacto; (3) agenda de cards por dia "hoje/amanhã/próximos".
- Subagents geram em paralelo (um por variante), com o mesmo brief de conteúdo e a direção como variável.

### Fase 2 — juízes

Screenshots via Playwright (`chromium` já instalado pra e2e) → 2–3 agentes-revisor de UX leem cada PNG e pontuam por rubrica fixa:

| Critério | Peso |
|---|---|
| Clareza da hierarquia (o que importa salta primeiro?) | ×2 |
| Intuitividade (um mentor de 50 anos entende sem tutorial?) | ×2 |
| Densidade certa (nada de tela vazia nem parede de texto) | ×1 |
| Mobile (polegar, leitura, estados) | ×1 |
| Aderência à marca (lime/ink, Phosphor, voz do produto) | ×1 |
| Acessibilidade (contraste, alvos, leitura) | ×1 |

Saída por juiz: nota 1–10 por critério + o que mudaria + veredicto. Consolido num comparativo.

### Fase 3 — relatório

Ranking por tela + os pontos fortes de cada perdedor (às vezes o vencedor é síntese) → trago pra você decidir.

### Fase 4 — switcher na demo

A variante vencedora (ou as 3, se quiser comparação viva) vira modo real na `/demo`: botão "Alterar view: Agenda 1 / 2 / 3" — cookie `demo_view` escolhe o componente, dados demo evergreen alimentam as três.

---

## Decisões fechadas (primeira rodada de alinhamento)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Visibilidade trilha esp → mentor DPP | ✅ **Visão completa** — sessões com detalhes + registro completo das sessões esp |
| 2 | Pedido de apoio × chamados | ✅ **Uma porta só** — as 3 entradas viram `chamados`; flag do registro abre chamado automático |
| 3 | Avaliação do jovem pro mentor DPP | ✅ **Completa** — nota + comentário do próprio encontro |
| 4 | Escopo de mockups | ✅ **3 variantes × todas as telas afetadas** (~15 mocks na 1ª rodada) |
| 5 | Categorias de chamado | ✅ **agenda / metodologia / plataforma / urgencia / outro** — `outro` pede descrição curta |
| 6 | Roteamento/papéis | ✅ Supervisão **lê todos** os abertos e **responde os não-técnicos**; `plataforma` é coord-only; urgência notifica os dois |
| 7 | Agenda | ✅ **Redesign geral** — todas as personas, não só a visão do jovem |
| 8 | Modelo de visões da agenda | ✅ **Duas visões por papel multi-dupla** — mentor: "Agenda do mentorado" + "Minha agenda"; auxiliar executivo: "Por turma" + "Consolidada"; mentorado: agenda única com todos os mentores |
| 9 | Timeline do chamado | ✅ **`chamado_atualizacoes` visível pro autor** — data/hora + descrição livre de andamento; comentários `interno` seguem escondidos; enum de status continua enxuto (3 valores) |
| 10 | Limites de metas/submetas | ✅ **~10 metas + ~20 submetas total, recursivas** (submeta pode ter submeta, como o guia); estrutura recursiva compartilhada com PDM |
| 11 | Terminologia | ✅ **"Auxiliar executivo"** é o nome do papel `supervisor` no produto — normalizar nos textos (a conversa usou "assistente") |

## Perguntas abertas (restantes)

12. **Agenda do jovem**: inclui compromissos pessoais marcados pelo jovem? Se sim, flag "privado" por item?
13. **Nav do jovem com Especialistas**: quem sai da bottom bar — Pessoas, Perfil, ou Especialistas só aparece quando tem ficha vinculada?
14. **Materiais**: os documentos da jornada do jovem ficam visíveis pro mentor DPP/coord (o jovem "compartilha" a anamnese dele?) ou é espaço privado do jovem?
15. **Switcher na demo**: constrói as 3 views reais pra comparar no produto, ou só a vencedora?
16. **Forms em modo wizard**: uma seção por tela com progresso, ou scroll com seções animadas? E vale só pros instrumentos de jornada ou pro renderer genérico também?
17. **Metas atingidas na retrospectiva**: entram automático no resumo do encerramento ("metas atingidas: X de Y") ou o jovem revisita/edita antes?
18. **Semáforo × `em_atendimento`**: chamado assumido vira `atencao` na dupla ou só badge informativo?
