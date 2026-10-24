# Revisão cruzada — prompt original × subplanos

Cada cláusula do `_prompt-original.md` mapeada pro arquivo que a cobre.
Feita ANTES de abrir as tasks no Jira. Legendas: ✅ coberto ·
⚠️ ambiguidade documentada no plano · ❌ faltando.

| # | Cláusula do prompt | Plano | § |
|---|---|---|---|
| 1 | "pra que serve o progresso da jornada em coord>materiais?" | materiais-coord | item 1 |
| 2 | "materiais ficam disponíveis automaticamente, pra que serve lembrar em lote?" | materiais-coord | item 1 + direção (a ação real é "Enviar em lote" = emitir link, copy não explica) |
| 3 | "a lista ainda ta muito grande, pouco visual" | materiais-coord + visao-geral-duplas | m. item 2 · v.g. item 4 |
| 4 | "4 cards quadrados com números simples, em vez de visualização rica" | materiais-coord | item 3 |
| 5 | "copy implícita: 0 estações respondidas — o que é estação? materiais?" | materiais-coord | item 4 + aceite "estação fora da copy" |
| 6 | "e as pendências e fora da janela?" | materiais-coord | item 4 (mesma família de copy) |
| 7 | "como conduzir da ficha da dupla em outros lugares — agenda do mentor, descrição do encontro" | como-conduzir | tudo |
| 8 | "cards de materiais sem preview real renderizando" → corrigido depois: "só funciona no pc, renderiza página toda scrollável — queria thumbnail curta, título legível" | materiais-coord | item 7 |
| 9 | "grande espaço embaixo vazio onde ficavam os botões — 30% × 20 cards" | materiais-coord | item 8 |
| 10 | "progresso da jornada não serve de muita coisa — sai ou compacta, só camada superficial, talvez dropdown" | materiais-coord | item 5 + direção |
| 11 | "por que os cards não têm badges e de repente têm? é a turma 2?" | materiais-coord (item 6) + turmas (nomeação) | ⚠️ ambíguo — as duas leituras registradas |
| 12 | "filtros de pílula 2 linhas no mobile — scroll lateral" | materiais-coord | item 9 |
| 13 | "digitar @ pra marcar não mostra nada — dropdown de opções" | chamados | item 1 |
| 14 | "caixinhas de seleção com todas as pessoas — dropdown sob demanda" | chamados | item 2 |
| 15 | "uploadar arquivo em chamados tem scroll lateral" | chamados | item 3 |
| 16 | "resposta enviada sem feedback — só disabled; animação satisfatória" | chamados | item 4 |
| 17 | "preview dos anexos" | chamados | item 5 (timeline + composer) |
| 18 | "ignorou o que eu falei sobre visão geral de duplas — procura tasks relacionadas" | visao-geral-duplas | nota de rastreabilidade: feedback anterior não estava persistido; itens reafirmados aqui |
| 19 | "tirar esse footer" | visao-geral-duplas | item 1 |
| 20 | "whatsapp no mobile: só símbolo + dropdown, fundo verdinho" | visao-geral-duplas | item 2 |
| 21 | "animação de filtragem, não repaint seco — anota isso" | visao-geral-duplas | item 3 + convenção AGENTS.md |
| 22 | "cada status uma cor: não respondido vermelho, resolvido verde" | chamados | item 6 |
| 23 | "registros e no geral mais cara de dashboard — barras, circulares, linhas, design criativo" | registros-dashboards | tudo (mini-kit compartilhado) |
| 24 | "mostra 4/10 e o gráfico com linha completa" | agenda-coord | item 1 (causa real identificada: denominador da barra ≠ do número) |
| 25 | "aba de semana do programa acima na agenda coord, como cards bonitos guia" | agenda-coord | item 2 — ⚠️ interpretação: aba Monitoramento; se a intenção era a Lista, revisar |
| 26 | "separar materiais nativos — colocar em materiais, forms só pra forms" | formularios | item 1 |
| 27 | "ícone svg custom por material transcendente" | formularios | item 2 — ⚠️ "transcendente" lido como instrumento oficial; revisar se for "transversais" |
| 28 | "engine de forms: drag and drop + numeração automática dinâmica" | formularios | itens 3–4 |
| 29 | "turmas: símbolo com número grande, card criativo tipo banner de perfil, não texto puro" | turmas | item 1 |
| 30 | "T1 na frente de 2026/2027, ou só turma 1/2; ano omitido da maioria das telas" | turmas | item 2 |
| 31 | "links públicos → dropdown 'Compartilhar'" | relatorios | item 1 |
| 32 | "form grande sem preview — importar o que tá setado nos filtros" | relatorios | item 2 |
| 33 | "senha no mesmo form; revogar/links/acessos no dropdown" | relatorios | itens 3–4 |

## Não encontrou dono / decisão pendente

- **"Lembrar em lote"** (item 2): o questionamento de propósito fica
  respondido pela copy nova do painel compacto. Se Thiago preferir REMOVER
  o envio em lote de vez, é decisão dele — registrado no plano.
- **"Materiais nativos/transcendente"** (itens 26–27): li "instrumentos
  oficiais do programa" (`sistema=true`). Se "transcendente" for os
  materiais **transversais** (sem encontro), o plano continua válido —
  ícones custom servem pros dois casos.

## Decisões travadas pelo Thiago (rodada de clarificação)

1. Painel jornada: **compactar** (plano já assumia — confirmado).
2. "Footer" = **a faixa inferior do card de dupla**, não o SiteFooter —
   remove a banda dedicada, ação migra pro corpo. E **separadamente**: o
   SiteFooter real deve parar de flutuar no meio em páginas vazias —
   shell com `min-h-dvh` + conteúdo `flex-1`.
3. Instrumentos oficiais: **os dois** — movem pra /materiais E ganham
   seção destacada própria (cards visuais, símbolo+cor próprios, estado
   de liberação "libera no encontro N" desabilitado). Materiais
   ordinários ficam como estão.
4. "Semana do programa": **as duas abas** (Monitoramento no topo +
   acima da Lista na aba Calendário).

## Itens novos da rodada de clarificação

- Thumbnail curta de PDF é **global** (jovem, mentor, ficha, coord) —
  só o painel compacto é coord-only (auxiliar reduzido).
- Grupos por encontro em /materiais ganham "o que trata / como conduzir"
  — fonte única com a agenda, copy por papel, base nos docs oficiais.
- Backlog novo: **atualizar skeleton loaders** pras telas novas desta
  rodada (a task já existia implícita — vira item próprio no Jira).

## Decisões travadas — rodada de mockups (escolhas do Thiago)

| Tela | Escolha | Correções/acréscimos |
|---|---|---|
| Turmas | **v1a** "banner de perfil" | — |
| Duplas | **v6a** linha densa | — |
| Relatórios | spec híbrida | dialog atual (melhor que o do mock) + dropdown wide + senha digitada (precisa migration/RPC) |
| Registros | **v2** | + parametrização de métricas + interatividade + animações na implementação |
| Materiais | **v5a** → revisado em **v5c** | card-produto p/ mentorado (sem snippet, card=botão, ícone grande); T1/T2 quebrado em TODAS as telas; lista "fora da janela" com teto (5+details) |
| Chamados | **v5** + polish aplicado | minimalista: sem bordas/faixas/fundo redundantes — cor só nos badges |
| Agenda | **v8** → revisado em **v8b** | cards da semana compactos (sem espaço morto, data=chip, condução em details); gráficos ACIMA do painel; scroll lateral em TODOS os viewports; faixa = componente por papel (coord+aux+**mentor**; jovem não) |
