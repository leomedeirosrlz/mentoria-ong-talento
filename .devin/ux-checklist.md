# Checklist UX / Arquitetura da Informação — Realiza.vc

Checklist acionável, calibrada no código de `src/`. Cada item tem:

- **Teste** — verificação passa/falha concreta, olhando o JSX.
- **Violação aqui** — exemplo real encontrado neste app (`arquivo:linha`), ou "guarda" quando o padrão já está certo e o item é trava contra regressão.
- **Fix** — correção padrão.
- **Severidade** — `HIGH` quebra/induz erro numa tarefa central · `MED` atrito real em fluxo comum · `LOW` polimento/consistência.

**Baseline que já está certa (não "consertar"):** tokens semânticos (`--brand-lime`/`--brand-ink`/`--paper`/`--muted`/`--warn`/`--danger`, variantes `*-text` AA), cartões `bg-card shadow-[var(--shadow-border)]`, `size-11`/`min-h-11` mobile → `md:h-8`, skeletons espelhados por rota (`loading.tsx`), guard global de `prefers-reduced-motion` (`globals.css`), toasts sonner pt-BR, deep-link `#registrar-{id}` com `scroll-mt-20`, `RevelarApos` pra UI que vira válida durante a sessão.

**Lema que atravessa tudo:** dupla agenda → acontece → registra; coord monitora semáforo e faz nudge. Toda divergência da checklist se resolve a favor desse loop.

---

## 1. Divulgação progressiva

Regra-mestre: mostrar primeiro só o que a tarefa atual exige; o raro/secundário aparece por pedido explícito (disclosure, dialog, kebab) — e o gatilho anuncia o que esconde.

### PD-1 — Gatilho de disclosure declara o escopo — `LOW` (guarda)
- **Teste:** todo `<details>`, accordion ou "ver mais" diz *o que* e *quantos* itens esconde.
- **Violação aqui:** correto hoje — `duplas/[id]/page.tsx:249-255` mostra "Próximos {N} encontros" + `CaretDown` que rotaciona. Regredir se um summary virar só "Mais".
- **Fix:** `summary`/`trigger` com substantivo + contagem + chevron de estado.

### PD-2 — Lista truncada declara o overflow — `MED`
- **Teste:** todo `.slice(0, n)`/cap visual tem indicador "+N" ou link "ver todos".
- **Violação aqui:** `mentor-home.tsx:240` — `pendentes.slice(0, 4)` esconde o 5º+ encaminhamento sem pista nenhuma. Contraste: `agenda-calendario.tsx:781-785` faz certo (`+{n-3}`).
- **Fix:** sufixo `+{pendentes.length - 4} mais` linkando pra `/duplas/{id}`.

### PD-3 — Form inline não se multiplica na página — `MED`
- **Teste:** na ficha da dupla, quantos `RegistroForm` (9 seções, ~700px cada) podem estar abertos simultaneamente? Alvo: 1, e só por pedido.
- **Violação aqui:** `duplas/[id]/page.tsx:374-390,567-574` — todo encontro pendente renderiza o form inteiro inline; dupla com 2-3 pendências vira uma página de ~3 forms gigantes seguidos.
- **Fix:** form colapsado por padrão atrás do CTA "Registrar"/"Registrar agora" dentro do row; o deep-link `#registrar-{id}` abre o correspondente (já existe a infra).

### PD-4 — Um gatilho por fluxo por contexto — `LOW`
- **Teste:** a mesma ação não tem 2+ CTAs competindo no mesmo bloco visual.
- **Violação aqui:** `duplas/[id]/page.tsx:234-245` ("Registrar passado" ghost) + `:257-273` ("Registre aqui." inline) — mesmo `RegistrarRetroativoDialog`, dois triggers a ~20 linhas de distância.
- **Fix:** manter o de texto corrido (contexto) ou o de botão (chrome), não ambos.

### PD-5 — Destrutivo/raro fora do primeiro nível — `LOW` (guarda)
- **Teste:** excluir/desfazer nunca é botão solto de primeiro nível; mora em kebab, "danger zone" ou confirm.
- **Violação aqui:** correto — `PessoaActions`/`MentoradoActions` em `DropdownMenu`, "Excluir dupla" no rodapé do dialog de edição (`editar-dupla-dialog.tsx:191-200`).
- **Fix:** manter a gramática; novo destrutivo entra em kebab/rodapé de dialog.

### PD-6 — Campos condicionais só aparecem depois da escolha — `LOW` (guarda)
- **Teste:** campo que depende de resposta anterior não ocupa tela antes da hora.
- **Violação aqui:** correto e exemplar — `dificuldade === "outro"` → detalhe (`registro-form.tsx:453-460`), `proximoPasso === "outro"` → detalhe (`:475-482`), motivo de remarcação só exigido se `dataMudou` (`agendar-encontro-dialog.tsx:92-107`).
- **Fix:** aplicar o mesmo padrão a todo campo "outro/detalhe" futuro.

---

## 2. Lei de Hick-Hyman

Regra-mestre: tempo de decisão cresce com o nº de opções; menos e bem agrupadas vence sempre. Agrupar > esconder: subdividir em categorias transforma escolha linear em log.

### HH-1 — Nav global ≤5 itens por papel — `LOW` (guarda)
- **Teste:** `NAV` filtrado por role renderiza ≤5 itens.
- **Violação aqui:** correto — mentor vê 3, coord 5 (`app-shell.tsx:18-24,38`).
- **Fix:** resistir ao 6º item; nova seção entra como sub-página ou feature de um item existente.

### HH-2 — ≤3 ações visíveis por card/linha — `MED`
- **Teste:** contar CTAs/badges-ação simultâneos num `EncontroRow` ou `DuplaCard`.
- **Violação aqui:** `duplas/[id]/page.tsx:468-490` — o row pode mostrar badge "sem registro" + "Não aconteceu" + "Desfazer" + "Marcar apoio como atendido" + badge "apoio solicitado" disputando o mesmo `flex-wrap`; no mobile empilham em ordem imprevisível.
- **Fix:** uma ação primária por row (a da pendência dominante); as demais em kebab ou no bloco expandido do registro.

### HH-3 — Selects longos: ordenação justificável + default — `LOW` (guarda)
- **Teste:** select com >7 itens tem ordem por frequência/semântica e `defaultValue` sensato.
- **Violação aqui:** correto — `ferramenta` prioriza `evento.instrumentos` antes da lista fixa (`registro-form.tsx:390-403`); `origem` defaulta pra `plataforma` (`agendar-encontro-dialog.tsx:123`).
- **Fix:** nunca ordem alfabética cega quando há frequência conhecida.

### HH-4 — Escolha excludente usa radio/select, não checkbox — `LOW` (guarda)
- **Teste:** opções mutuamente exclusivas não viram checkboxes paralelos.
- **Violação aqui:** correto — `avaliacao` é radio (`registro-form.tsx:421-436`), modo de login é tab exclusivo.
- **Fix:** seguir o padrão; checkbox só pra conjuntos não-excludentes (`atividades`).

### HH-5 — Information scent > contagem de cliques — `LOW` (guarda)
- **Teste:** a regra dos 3 cliques é mito (Porter/NN-g: abandono não sobe com >3 cliques); o que importa é cada passo cheirar aproximação — o label do link diz o que vem depois.
- **Violação aqui:** correto e forte — `EncontroDuplaRow` linka direto pra `#registrar-{id}` quando há pendência (`agenda-calendario.tsx:1100-1105`), nudge do WhatsApp leva deep-link no texto (`dashboard-coordenacao.tsx:270`). Anti-padrão a evitar: links "clique aqui" sem scent.
- **Fix:** julgar caminho por scent por passo, não por nº de cliques.

---

## 3. Carga cognitiva

Regra-mestre: matar carga **extrínseca** (ruído de apresentação), fatiar a **intrínseca** (o form oficial é grande mesmo), proteger a **pertinente** (o que ajuda a aprender o domínio).

### CC-1 — Ação não mora em microcopy pontilhada — `HIGH`
- **Teste:** nenhum link/botão de ação real vive dentro de `text-xs text-muted-foreground` separado por `·`.
- **Violação aqui:** `duplas/[id]/page.tsx:424-466` — a linha-meta do `EncontroRow` empilha "sugerido X · agendado Y · **entrar na chamada** · **Material** · remarcado: Z". Na hora do encontro, o link da chamada é a ação nº1 e está enterrado em texto muted de 12px.
- **Fix:** promover `encontro.link` a botão/chip próprio ("Entrar na chamada" com `VideoCamera`, verde quando o horário é agora); metadados continuam na linha.

### CC-2 — Form >6 grupos pede chunking nomeado — `MED`
- **Teste:** registro-form tem 9 seções visíveis de uma vez (~3 telas de scroll no mobile).
- **Violação aqui:** `registro-form.tsx:287-568` — fieldsets têm legends (bom), mas a página inteira é uma sequência sem macro-estrutura; o mentor perde noção de "quanto falta".
- **Fix:** 3 blocos nomeados ("Como foi" / "Sinais de atenção" / "Combinados e observações") ou accordion de seções; submit sticky ou "Salvar registro" sempre à vista.

### CC-3 — Placeholder textual não finge ser dado — `LOW`
- **Teste:** dado ausente não renderiza frase que imita dado presente.
- **Violação aqui:** `duplas/[id]/page.tsx:303-305` — "Origem não informada" ocupa a mesma posição/estilo de uma ONG real; `pessoas-listas.tsx:255` idem.
- **Fix:** omitir a linha ou estilo distinto (`italic`/`—`); dado faltante que importa vira badge "sem ONG" só pra coord.

### CC-4 — Enum/jargão de banco nunca vaza — `LOW` (guarda)
- **Teste:** nenhum valor cru (`nao_aconteceu`, `remarcado`, `mentor_dpp`) chega à tela sem passar por `*_LABEL`.
- **Violação aqui:** correto — `STATUS_ENCONTRO_LABEL`, `DIFICULDADE_LABEL`, `papelLabel` cobrem tudo; `?? fallback` em todo mapa.
- **Fix:** novo enum nasce junto do seu `LABEL` em `lib/ciclo.ts`.

### CC-5 — Estado calculado vem com o "por quê" — `LOW` (guarda)
- **Teste:** semáforo/badge de status sempre carrega motivo textual adjacente (cor nunca explica sozinha).
- **Violação aqui:** correto — `saude.motivo` em todo lugar que o semáforo aparece (`dashboard:318`, `dupla:205`, `duplas-lista:116`).
- **Fix:** badge novo de status exige prop `motivo`/`title` textual.

---

## 4. Agrupamento / Gestalt

Regra-mestre: proximidade, similaridade e região comum têm que contar a mesma história que o modelo de dados.

### GG-1 — Região comum: dentro do card, só o que é do card — `MED`
- **Teste:** um container clicável (stretched-link) não engloba ação que leva a outro destino sem proteção `relative`.
- **Violação aqui:** `dashboard-coordenacao.tsx:296-306` — `Link absolute inset-0` cobre o card inteiro e o `NudgeButton` sobrevive via `relative` (`:331`); tecnicamente certo, mas a região comum diz "tudo aqui é a dupla" enquanto o nudge leva pro WhatsApp — ambiguidade de mapeamento (clicar perto do botão navega pra ficha).
- **Fix:** padrão atual é aceitável; reforçar separando visualmente a zona do nudge (divider ou alinhamento fora da área de texto) e nunca deixar interativo irmão sem `relative`.

### GG-2 — Mesmo visual = mesmo comportamento — `MED`
- **Teste:** dot/checkbox/badge com gramática de controle é interativo ou visivelmente estático.
- **Violação aqui:** `encaminhamentos-list.tsx:104-113` — modo read-only usa dot colorido redondo (mesma família do checkbox interativo `:86-100`); `dashboard:99-104` — `Stat` cards têm a mesma superfície `bg-card shadow` dos cartões clicáveis mas não fazem nada.
- **Fix:** read-only usa gramática distinta (dot miúdo/anel); cards de stat ou ganham link de drill-down ou perdem affordance de card (sem hover shadow).

### GG-3 — Ação fica na mesma região do objeto — `LOW`
- **Teste:** no wrap mobile, a ação de um item não se separa do título do item.
- **Violação aqui:** `duplas/[id]/page.tsx:402-490` — `flex-wrap` pode jogar "Não aconteceu"/badges pra linha de baixo, longe do nº do encontro.
- **Fix:** âncora visual (ações alinhadas à direita do bloco de título, `ml-auto` dentro de sub-grupo) ou mover ações pro corpo expandido.

### GG-4 — Hierarquia de campo: label mais perto do seu input que do vizinho — `LOW` (guarda)
- **Teste:** `space-y-2` dentro do campo < `space-y-4/5` entre campos.
- **Violação aqui:** correto em todos os forms.
- **Fix:** manter; nunca `space-y-4` uniforme que empata label com dois inputs.

### GG-5 — Overlay/modal: figure-ground inequívoco — `LOW` (guarda)
- **Teste:** dialog com backdrop + z único; nada interativo "atravessa".
- **Violação aqui:** correto — `DialogOverlay bg-black/10 backdrop-blur` (`ui/dialog.tsx:34`).
- **Fix:** manter z-50 exclusivo; toast não cobre CTA de dialog.

---

## 5. Hierarquia visual

Regra-mestre: um H1, escala previsível, o acento lime reservado pra ação primária ou "agora"; status atenção/risco escala banner > superfície > badge > texto conforme urgência.

### HV-1 — Um único ponto de entrada visual por tela — `LOW` (guarda)
- **Teste:** h1 `text-2xl` único; seções `text-sm font-semibold`; meta `text-xs muted`.
- **Violação aqui:** correto em todas as páginas lidas.
- **Fix:** nova página copia a escala; nunca dois `text-2xl`.

### HV-2 — Lime só em ação-primária/ativo/agora — `LOW` (guarda)
- **Teste:** `bg-[var(--brand-lime)]` aparece só em CTA primário, item ativo da nav, semana atual, progresso.
- **Violação aqui:** correto; hover de card usa `lime/60` sutil (`dashboard:298`).
- **Fix:** status nunca em lime (warn/danger têm tokens próprios).

### HV-3 — Urgência escala de superfície — `LOW` (guarda)
- **Teste:** pedido de apoio/risco usa nível acima de badge comum (banner, superfície tingida).
- **Violação aqui:** correto — banner `danger` (`dashboard:106-117`), card inteiro tingido por semáforo (`:288-293`), badge "sem registro" nível médio.
- **Fix:** nunca rebaixar pedido de apoio pra badge comum.

### HV-4 — CTA no fim do fluxo de leitura (F/Z) — `LOW` (guarda)
- **Teste:** submit é o último elemento do form; CTA de página depois do conteúdo que o justifica.
- **Violação aqui:** correto — "Salvar registro" fecha o form; "Ver histórico" fecha o card da home.
- **Fix:** nunca CTA primário antes do conteúdo que informa a decisão.

---

## 6. Affordance / signifiers

Regra-mestre (Norman + Jakob): affordance é o que dá pra fazer; signifier é o que comunica isso — e convenções de outros apps (calendário mensal, bottom nav, kebab ⋯, X fecha) são grátis, não reinventar.

### AF-1 — Nada depende só de hover/`title` — `MED`
- **Teste:** toda informação de `title=`/tooltip existe também em texto visível ou estado perceptível sem hover.
- **Violação aqui:** `nudge-button.tsx:46-58` — nudge sem telefone explica "Sem WhatsApp cadastrado" só em `title`/`aria-label` (no toque: nada acontece, nada explica); `dashboard:144` badge "em reposição" só no `title`; `trajetoria-avaliacoes.tsx:46-53` dots individuais só em `title`.
- **Fix:** texto inline ao lado (ex.: "sem WhatsApp" em `text-xs`), ou omitir o controle com nota contextual; `title` só como redundância desktop.

### AF-2 — Desabilitado explica por quê, inline — `MED`
- **Teste:** controle `disabled`/`aria-disabled` tem razão visível adjacente, não só tooltip.
- **Violação aqui:** o padrão bom já existe — `pessoa-actions.tsx:114-119` e `mentorado-actions.tsx:68-72` explicam o disabled do Excluir dentro do menu; o `NudgeButton` desabilitado (AF-1) é a exceção.
- **Fix:** copiar o padrão "nota inline" pra todo disabled novo.

### AF-3 — Signifier de link vs botão consistente — `LOW` (guarda)
- **Teste:** navegação = `<a>`/`Link` (underline ou row com hover), ação = `<button>`/`Button`; nunca `div onClick`.
- **Violação aqui:** correto; edge-case legítimo é `role="link" aria-disabled` do nudge sem telefone — coberto por AF-1.
- **Fix:** manter; ghost-button destrutivo leva cor (`text-destructive`) ou fica atrás de confirm.

### AF-4 — Ícone sozinho sempre nomeado — `LOW` (guarda)
- **Teste:** todo `size="icon*"`/botão só-ícone tem `aria-label` ou `<span class="sr-only">`.
- **Violação aqui:** correto — "Ações" (kebab), "Excluir", "Fechar" (sr-only), "Mês anterior/próximo", "Sair", "Meu perfil".
- **Fix:** novo ícone-só nasce com `aria-label`.

### AF-5 — Convenções externas respeitadas (Jakob) — `LOW` (guarda)
- **Teste:** calendário = grid mensal dom→sáb, bottom nav = ícone+label ≤5, ⋯ = overflow, X fecha, chevron aponta estado do disclosure.
- **Violação aqui:** correto em tudo — inclusive o grid usa roving tabindex + setas como os calendários nativos (`agenda-calendario.tsx:424-451`).
- **Fix:** padrão novo copia o app mais parecido que o usuário já conhece (WhatsApp, Google Agenda).

### AF-6 — Roles/estados semânticos completos — `MED`
- **Teste:** `role` customizado vem completo (tablist→tab→tabpanel; checkbox→aria-checked); item "atual" usa `aria-current`.
- **Violação aqui:** `login-form.tsx:216-246` — `role="tablist"/"tab"` sem `aria-controls`/tabpanel associado; `app-shell.tsx:83-95` — sidebar desktop tem destaque visual de ativo mas **sem** `aria-current` (a bottom nav tem, `:133`).
- **Fix:** `aria-current="page"` na sidebar; ou tabs viram segmented-control semântico completo, ou radios com legend.

---

## 7. Pistas visuais / feedback de estado

Regra-mestre (Nielsen #1 + Doherty): o sistema sempre diz o que está acontecendo — ack <100ms, resultado visível, e nenhuma mudança fora da viewport sem sinal.

### PV-1 — Seleção fora da viewport precisa de sinal — `HIGH`
- **Teste:** no mobile, tocar um controle produz efeito visível sem scroll.
- **Violação aqui:** `agenda-calendario.tsx:540` — no mobile o layout empilha [calendário ~500px] → [detalhe do dia] → [lista do mês]; tocar num dia das últimas semanas muda um painel abaixo da dobra, invisível. `aria-live` cobre leitor de tela, não o olho.
- **Fix:** no mobile, detalhe como sticky/bottom-sheet, ou `scrollIntoView` no painel ao selecionar, ou resumo do dia dentro/abaixo da própria célula tocada.

### PV-2 — Cor nunca é o único canal — `MED`
- **Teste:** todo estado codificado em cor tem texto/ícone/forma equivalente — e a chave está perto de onde a cor aparece.
- **Violação aqui:** `agenda-calendario.tsx:772-785` — dots ok/warn/ring/muted nas células; a legenda do card (`:797-824`) cobre Encontro/Recesso/Hoje mas **não** os dots de status (a chave deles mora no painel de detalhe, `:934-950`, que só aparece quando o dia tem itens).
- **Fix:** incluir a mini-chave dos dots no rodapé do calendário (ou no primeiro dia com dots).

### PV-3 — Async: ack imediato + resultado nomeado — `LOW`
- **Teste:** todo `start(async…)` muda o trigger (spinner/"Salvando…") e o toast nomeia a entidade ("12º encontro agendado").
- **Violação aqui:** quase tudo certo; `confirm-delete-button.tsx:65` — `toast.success("Excluído.")` genérico (a descrição do dialog sabia o nome); `role-select.tsx` — pending só desabilita, sem spinner no trigger.
- **Fix:** toast com nome ("{nome} excluído(a)"); select com spinner inline ou valor otimista.

### PV-4 — Live region anuncia a mudança, não o painel inteiro — `LOW`
- **Teste:** `aria-live` cobre região mínima; conteúdo grande remontado não é anunciado por inteiro.
- **Violação aqui:** `agenda-calendario.tsx:828-834` — `aria-live="polite"` na seção de detalhe + `key={selecionado}` remonta → leitor de tela despeja o painel todo a cada dia.
- **Fix:** `aria-live` só no cabeçalho do detalhe (data + relativo), ou `aria-live="off"` + `aria-label` já completo no botão do dia.

### PV-5 — Skeleton = espelho do layout — `LOW` (guarda)
- **Teste:** `loading.tsx` reproduz a grade real; zero spinner genérico em rota com layout conhecido.
- **Violação aqui:** exemplar — `(home)/loading.tsx` espelha stats+resumo+cards; `agenda/loading.tsx` idem.
- **Fix:** nova rota nasce com skeleton espelho junto.

### PV-6 — Ping/animação de atenção dispara uma vez — `LOW` (guarda)
- **Teste:** nenhum loop infinito fora do shimmer de skeleton; chamar atenção = animação única.
- **Violação aqui:** correto — `animate-ping-once` no semáforo de risco (`semaforo.tsx:26-31`), guard de reduced-motion global.
- **Fix:** loop infinito só pra progresso indeterminado.

---

## 8. Fricção: intencional vs. acidental

Regra-mestre: fricção proporcional ao blast radius — irreversível pede confirm nomeado; reversível pede undo ou nada; confirm genérico treina clique-no-automático e é proibido.

### FR-1 — Irreversível: confirm com consequência nomeada — `LOW` (guarda)
- **Teste:** todo destrutivo passa por `ConfirmDeleteButton` cuja `descricao` cita entidade + números do que se perde.
- **Violação aqui:** exemplar — "Apaga a dupla X e Y junto com N encontros e M registros… prefira encerrar" (`editar-dupla-dialog.tsx:208`).
- **Fix:** novo destrutivo copia a fórmula "o quê + quanto + alternativa reversível".

### FR-2 — Reversível-frequente: sem confirm (undo ou toggle direto) — `LOW` (guarda)
- **Teste:** toggle/edição banal não pede confirmação.
- **Violação aqui:** correto — encaminhamento marca/desmarca direto (reversível em 1 clique); "não aconteceu" tem confirm leve **e** `Desfazer` — fricção mínima com saída.
- **Fix:** ação reversível nova não ganha dialog.

### FR-3 — Alto impacto mas reversível: declarar o efeito antes — `MED`
- **Teste:** Select/ação instantânea com blast radius (papel, status da dupla, desativar pessoa) avisa o efeito antes ou pede confirm leve.
- **Violação aqui:** `role-select.tsx:16-29` — trocar papel aplica na hora, sem nota de efeito (rebaixar a própria coordenação tranca o acesso na hora); `editar-dupla-dialog.tsx:172-178` — `status → Encerrada` sem nota de que a dupla sai do radar/semáforo; `setPessoaAtivo` no dropdown (`pessoa-actions.tsx:87-105`) sem nota de efeito no login da pessoa.
- **Fix:** micro-copy de efeito sob o campo ("Encerrada tira a dupla do acompanhamento; reversível") ou confirm leve pra auto-rebaixe de papel.

### FR-4 — Fricção acidental: caminho intenção→ação tem 0 passos mortos — `LOW` (guarda)
- **Teste:** nenhum dialog/interstitial entre "quero" e "feito" em ação banal; copiar resumo, alternar filtro, abrir detalhe = 1 gesto.
- **Violação aqui:** correto; o `target="_blank"` + `/api/nudge` do nudge é fricção estrutural consciente (log), coberta pelo spinner.
- **Fix:** novo passo intermediário precisa de justificativa de domínio.

### FR-5 — Duplo envio bloqueado por pending, não por confirm — `LOW` (guarda)
- **Teste:** submit `disabled={pending}` + label "Salvando…".
- **Violação aqui:** correto em todos os forms.
- **Fix:** manter; `disabled` + `aria-busy` onde o trigger mantém texto.

---

## 9. Erro: prevenção e recuperação (Nielsen)

Regra-mestre: constraint primeiro, validação inline depois, mensagem em linguagem do usuário com próxima ação, e trabalho em progresso nunca se perde.

### ER-1 — Constraint no input antes de validar no submit — `MED`
- **Teste:** `type`/`min`/`max`/`accept`/`required` impedem o erro antes dele acontecer.
- **Violação aqui:** `agendar-encontro-dialog.tsx:83-90` — `datetime-local` sem `min`: dá pra "agendar" no passado (server rejeita, a UI devia impedir); contraste com `registrar-retroativo-dialog.tsx:155` que tem `max={agora}` corretamente.
- **Fix:** `min={agora}` no agendamento (com exceção documentada se "registrar no passado" for caso válido — aí o fluxo certo é o retroativo).

### ER-2 — Erro de validação inline e em pt-BR — `MED`
- **Teste:** submit inválido marca o campo (`aria-invalid`) com mensagem ao lado, não só balão nativo do browser.
- **Violação aqui:** `registro-form.tsx:426` — `avaliacao` é o único `required` não-textual; o erro é o tooltip nativo ("Please select…"), sem âncora visual no grupo.
- **Fix:** mensagem inline "Escolha uma avaliação" sob o fieldset + `aria-invalid`/`role="alert"`; estender a campos required futuros.

### ER-3 — Erro de servidor em linguagem de usuário + saída — `LOW` (guarda)
- **Teste:** `res.error`/catch exibem copy acionável ("Sem conexão — tente de novo."), nunca código/enum/stack.
- **Violação aqui:** correto — `mensagemErro` traduz códigos do Supabase (`login-form.tsx:15-26`), catch padrão consistente.
- **Fix:** erro novo de server action nasce pt-BR na action, não no componente.

### ER-4 — Caminho de volta declarado ou existente — `LOW` (guarda)
- **Teste:** ação destrutiva sem undo diz explicitamente "não tem volta"; com undo, o controle de desfazer é óbvio.
- **Violação aqui:** correto — `DesfazerNaoAconteceuButton` ao lado do estado; deletes nomeiam a irreversibilidade.
- **Fix:** manter simetria confirm↔desfazer.

### ER-5 — Trabalho em progresso sobrevive a acidente — `LOW` (guarda)
- **Teste:** form longo salva rascunho (localStorage) e avisa na volta.
- **Violação aqui:** exemplar — draft autosave 500ms + flush no desmonte + banner "Rascunho de dd/mm restaurado" com Descartar (`registro-form.tsx:81-230`).
- **Fix:** form futuro com >3 campos livres adota o padrão (ou justifica por que não).

### ER-6 — Upload/entrada de arquivo: allowlist + limite declarados — `LOW` (guarda)
- **Teste:** `accept` + validação de tipo/tamanho com mensagem que diz o formato aceito.
- **Violação aqui:** correto — `anexos-registro.tsx:16-17,62-69` ("use PDF, PNG, JPG ou WebP", "até 10 MB"); `perfil-form.tsx:35-37` idem.
- **Fix:** manter mensagem "formato + limite" na mesma frase.

---

## 10. Mobile / toque

Regra-mestre: alvo ≥44px, nada depende de hover, thumb-zone respeitada, `text-base` em input (sem zoom iOS), safe-area aplicada.

### MT-1 — Alvo standalone ≥44×44px — `MED`
- **Teste:** botão/link fora de texto corrido mede ≥44px de altura no mobile (ou tem exceção WCAG consciente).
- **Violação aqui:** `nudge-button.tsx:7-8` — `px-3 py-1.5` ≈ 32px (principal ação de contato da coord/supervisor); `agenda-calendario.tsx:1112-1114` — `EncontroDuplaRow` `py-2` ≈ 40px; `login-form.tsx:236` — tabs `h-10` (40px); "Registre aqui." inline (`mentor-home.tsx:222-227`, `duplas/[id]:264-269`) ~20px — exceção inline do WCAG cobre, mas é raso.
- **Fix:** `min-h-11` no `CLASSES` do nudge; `py-3`/`min-h-11` nas rows de detalhe; `h-11 md:h-10` nas tabs do login.

### MT-2 — Nenhuma info crítica só em hover — `MED`
- **Teste:** (= AF-1) tooltip/title é redundância, nunca o único canal — no touch não existe hover.
- **Violação aqui:** mesmos casos de AF-1 (`nudge-button` disabled, `trajetoria` dots, badge "em reposição").
- **Fix:** idem AF-1.

### MT-3 — Input não dispara zoom iOS e teclado é o certo — `MED`
- **Teste:** inputs `text-base` (ou ≥16px) no mobile + `type`/`inputMode`/`autoComplete` corretos.
- **Violação aqui:** `ui/input.tsx:12` garante `md:text-sm text-base` (ok); mas `pessoas-dialogs.tsx:64,110` — WhatsApp sem `type="tel" inputMode="tel"` (perfil-form:189-196 faz certo); `editar` pessoa idem (`pessoa-actions.tsx:137`, `mentorado-actions.tsx:89`).
- **Fix:** `type="tel" inputMode="tel" autoComplete="tel"` em todo campo WhatsApp.

### MT-4 — Conteúdo fixo não cobre CTA nem é coberto pelo teclado — `LOW` (guarda)
- **Teste:** `pb-[calc(5rem+env(safe-area-inset-bottom))]` no main; dialog `max-h-[calc(100dvh-2rem)]` com scroll interno.
- **Violação aqui:** correto — `app-shell.tsx:120,125`, `ui/dialog.tsx:56`.
- **Fix:** submit de form longo em dialog avaliar sticky-footer se o teclado cobrir.

### MT-5 — Navegação por polegar: primária ao alcance — `LOW` (guarda)
- **Teste:** nav no bottom, ação recorrente não exige alcançar o topo.
- **Violação aqui:** correto — bottom nav 3-5 itens; CTAs de página no fluxo, não fixos no topo.
- **Fix:** nunca CTA fixo no topo no mobile.

---

## 11. Redução de esforço (reconhecimento, defaults, mapeamento)

Regra-mestre: reconhecer > lembrar; default certo > campo vazio; o sistema mostra o que já sabe; controle e efeito na mesma posição conceitual.

### RE-1 — Defaults = resposta mais provável — `LOW` (guarda)
- **Teste:** todo form novo nasce com `defaultValue` justificado por domínio.
- **Violação aqui:** exemplar — agendar prefills data oficial 19h (`agendar-encontro-dialog.tsx:66`); retroativo prefills `dataSugerida` (`registrar-retroativo-dialog.tsx:61-68`); `iniciada_em` vazio=hoje (`nova-dupla-dialog.tsx:165`).
- **Fix:** campo novo pergunta "o que 80% responderia?".

### RE-2 — Contexto do passado visível na decisão — `LOW` (guarda)
- **Teste:** decidir agora não exige lembrar o que aconteceu antes — a UI traz.
- **Violação aqui:** exemplar — "Da última vez — marcar como feito?" (`registro-form.tsx:311-343`), "Último nudge dd/mm por X" (`dashboard:324-329`), "criado no Nº encontro" (`encaminhamentos-list.tsx:55-57`), "Semana do Nº encontro" no topo.
- **Fix:** novo form pergunta "o que o usuário precisaria lembrar?" e mostra.

### RE-3 — Agregação leva ao detalhe que resume — `MED`
- **Teste:** número-resumo clicável filtra/rola pra lista que o produziu (mapeamento natural resumo↔itens).
- **Violação aqui:** `dashboard-coordenacao.tsx:99-104` — "Em risco: 3" é estático; clicar não filtra a lista abaixo nem rola pros 3 cards (a lista já vem ordenada por severidade, mas o stat não aproveita isso).
- **Fix:** stat vira âncora/filtro (`?filtro=risco`) ou scroll-spy pra primeira seção correspondente.

### RE-4 — Deep-link direto na ação — `LOW` (guarda)
- **Teste:** link de nudge/notificação/lembrete cai no ponto de ação, não na tela genérica.
- **Violação aqui:** exemplar — `#registrar-{id}` em nudge (`dashboard:270`), banner da home (`mentor-home.tsx:139`), row da agenda (`agenda-calendario.tsx:1104`), push pós-retroativo (`registrar-retroativo-dialog.tsx:92`).
- **Fix:** todo novo entry-point de fluxo tem âncora equivalente.

### RE-5 — Nunca pedir o que o sistema já sabe — `LOW` (guarda)
- **Teste:** campo pede só dado que o sistema não tem nem consegue derivar.
- **Violação aqui:** correto — `origem` ("onde foi marcado") é dado que só o mentor sabe; o resto é derivado (sugerido, número, autor).
- **Fix:** novo campo justifica por que não dá pra derivar.

### RE-6 — Pular repetição estrutural — `LOW`
- **Teste:** teclado/SR consegue pular nav repetida (skip-link ou landmark direto).
- **Violação aqui:** `app-shell.tsx` — sem skip-link; teclado tabula top bar + nav inteira antes do `main`.
- **Fix:** `<a href="#conteudo" class="sr-only focus-visible:not-sr-only">` + `id="conteudo"` no main.

---

## 12. Onboarding / estado vazio

Regra-mestre: vazio não é fim — é o lugar de ensinar o modelo e dar o próximo passo com ação real.

### EV-1 — Estado vazio = o quê + por quê + ação real — `MED`
- **Teste:** todo empty state tem CTA funcional (link/botão), não só instrução verbal.
- **Violação aqui:** `pessoas-listas.tsx:119-125` — "Importe de uma planilha ou cadastre uma pessoa." sem link/botão (os CTAs estão no header da página, longe do card); `duplas-lista.tsx:73-79` — "Use 'Nova dupla'…" instrui em vez de oferecer o botão; `encaminhamentos-list.tsx:31` — "Nenhum encaminhamento registrado." sem ação nem contexto. Bons exemplos internos: `dashboard:178-182` ("Cadastre pessoas" linkado) e `nova-dupla-dialog.tsx:176-186` (CampoVazio linka `/pessoas`).
- **Fix:** empty state renderiza o mesmo CTA do header dentro do card, ou linka a seção correspondente.

### EV-2 — Busca sem resultado ecoa o termo + sugere caminho — `LOW` (guarda)
- **Teste:** "Nenhum resultado para '{q}'" + sugestão de próximo passo.
- **Violação aqui:** correto em `pessoas-listas` e `duplas-lista`.
- **Fix:** manter; incluir "limpar busca" quando houver filtro ativo.

### EV-3 — Setup guiado por dado, some sozinho — `LOW` (guarda)
- **Teste:** checklist de onboarding lê contagem real, sem "pular/dispensar".
- **Violação aqui:** exemplar — `setup-checklist.tsx` retorna `null` quando os 4 passos passam de zero; passos do mentor viram `dica` ("a vez é dele").
- **Fix:** novo onboarding segue "só sai fazendo".

### EV-4 — Novo papel aprende o modelo na 1ª tela — `LOW` (guarda)
- **Teste:** primeiro acesso de cada papel explica o ciclo que lhe cabe.
- **Violação aqui:** correto — mentor lê "Vocês marcam o encontro; depois registram aqui como foi." (`mentor-home.tsx:122`); sem dupla lê "A coordenação forma as duplas no matching."; sem papel cai em "cadastro recebido".
- **Fix:** toda empty state de papel explica de quem é a vez.

### EV-5 — Onboarding não bloqueia o resto do app — `LOW` (guarda)
- **Teste:** checklist/guia ocupa uma seção, não modal/trava.
- **Violação aqui:** correto — checklist é um card na home.
- **Fix:** nunca tour modal obrigatória.

---

## Anexo — problemas encontrados na leitura (resumo por severidade)

**HIGH (3)**
1. `duplas/[id]/page.tsx:213-217` — `NudgeButton telefone={dupla.mentor.whatsapp}` renderiza pra todos os papéis: o **mentor** vê "Chamar no WhatsApp" que abre conversa consigo mesmo e loga um "nudge" falso em `interacoes`. Falta gate `{!souMentor && …}` ou alvo por papel.
2. `agenda-calendario.tsx:540` — feedback de seleção de dia acontece no painel abaixo da dobra no mobile (PV-1).
3. `duplas/[id]/page.tsx:424-466` — ações de tempo crítico (link da chamada, material) enterradas na linha-meta pontilhada (CC-1).

**MED (~15)** — PD-2, PD-3, HH-2, CC-2, GG-1, GG-2, AF-1, AF-6, PV-2, FR-3, ER-1, ER-2, MT-1, MT-3, RE-3, EV-1.

**LOW (~12)** — restantes itens de guarda/regressão e polimentos listados acima.
