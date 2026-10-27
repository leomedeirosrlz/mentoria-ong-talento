# Auditoria de regressões — /duplas, ficha e home (pós-merge `feat/ux-refresh-2026-10`)

Base: `436065e^` (pré-merge) × HEAD. Superfícies: `/duplas` (lista, 4 visões), `/duplas/[id]` (ficha), home (coord/supervisor/mentor) + componentes compartilhados de ação. Referência de design: `docs/mockups/duplas/v6a.html` + `docs/planos/feedback-ux-2026-10/visao-geral-duplas.md`.

**Veredito curto:** não há regressão-funcional de remoção — todas as ações pré-existentes continuam alcançáveis, e a suspeita do "WhatsApp do mentorado" não se confirma (nunca existiu na lista; segue na ficha e no card da home). Os desvios reais são: ação de apoio virou Lembrar/Chamar em vez de "Abrir chamado" (gap de dados assumido no plano, mas a pill nem tem a âncora `#apoio` de fallback), "Registrar supervisão" enterrado num ⋮ de 1 item, busca que repinta seco, e "Chamar" aplicado a estados que o mock mostrava sem WA (decisões que o plano deixou abertas e o código resolveu sozinho).

## Catálogo (por severidade)

### regressão-funcional

- [regressão-funcional] /duplas · visão supervisor | "Registrar supervisão" — a ação própria do papel — saiu de botão direto na linha para item único dentro de um ⋮ (2 cliques, alvo `lg:size-6`; uma dropdown de 1 item é indireção pura) | `src/components/duplas-lista.tsx:1866-1872,1922-1937` vs anterior `duplas-lista.tsx.old:1422-1444` (`<SupervisaoDialog>` renderizado direto na célula `acao`)

### desvio-sistema

- [desvio-sistema] /duplas · linha com apoio | v6a define a ação do eixo apoio como "Abrir chamado" ("o trabalho mora na thread, não num lembrete"); impl não tem link pro chamado — a pill "Apoio" aponta pra `/duplas/${d.id}` **sem a âncora `#apoio`** que o plano dava como fallback (item 8), e a célula oferece Lembrar/Chamar | atual `duplas-lista.tsx:301-311,1046-1084`; mock `v6a.html:487` + nota `:651`; plano `visao-geral-duplas.md` item 8 (:244-251)
- [desvio-sistema] /duplas · busca | convenção "troca de filtro, **busca** ou ordenação sempre anima" (AGENTS.md·Movimento; nota do mock: "digitar na busca NUNCA repinta a lista seco") não se aplica à busca: a re-key cobre `filtro|turma|sup|mentor` e omite `q` — digitar repinta as linhas sem re-rodar `animate-enter`. Trade-off real (re-key por tecla mataria o dialog de supervisão e os grupos), mas desvio registrado da convenção | `duplas-lista.tsx:1653,1830-1831`; mock `v6a.html` bloco `.notes`
- [desvio-sistema] /duplas · ResumoSemaforo | segmento da barra-resumo **seta** o filtro mas não **desfaz** — chips têm toggle (`filtro===c.id ? "todas" : c.id`), segmento chama `onFiltrar(cat)` direto; clicar no segmento já ativo não volta pra "todas" | `duplas-lista.tsx:813-828` vs toggle em `chipBate`/CatChip (`:608+`); mock renderizava segmentos como links (decisão aberta (a) da nota — impl escolheu "filtra", só faltou o toggle)
- [desvio-sistema] /duplas · ResumoSemaforo | a linha por turma do resumo mostra "**N** duplas" no lugar do dia/horário da turma — o mock exibia "T1 encontro 8 de 16 ▓▓ terças 19h"; a info de **quando** a turma encontra sumiu do topo | `duplas-lista.tsx:~855-885` vs `v6a.html:420` (`…terças 19h`)
- [desvio-sistema] /duplas · fora-da-régua + massa | "Chamar" em TODA linha incluindo pausada/concluída/encerrada e `LinhaMini` colapsada — o v6a mostra pausada **sem** WA e `.mrow`/`.mini` sem WA; o plano marcou os dois pontos como "decidir/confirmar" (item 2: "o v6a mostra pausada sem wa… decidir"; "massa… presumivelmente. Confirmar") e o impl resolveu pela leitura literal de "todas" | `duplas-lista.tsx:1052-1084` (nudge só se `ativa`+pendência; senão `Chamar`), `LinhaMini:539`; `visao-geral-duplas.md:194-199`

### ruído

- [ruído] /duplas · pausada com apoio aberto (origem mentor) | o "Chamar" manda a mensagem neutra "Como estão as coisas?" — `casoLembrete` só entra com `temPendencia` (exige `ativa`); a dupla pausada com pedido de apoio em aberto recebe check-in genérico que ignora o contexto do pedido | `duplas-lista.tsx:1052-1068` + `casoLembrete:985-986`
- [ruído] /duplas · ResumoSemaforo | `key={c.turma}` nas linhas de cronograma colide se dois cronogramas dividirem o mesmo rótulo de turma (duas linhas "Turma 1" + warning de key) — raro, mas o id natural seria `cronograma_id` | `duplas-lista.tsx:859`

### cosmético

- [cosmético] /duplas · header | subtítulo virou só "hoje, {dia}"; o mock tinha "N duplas no ciclo · semana N · hoje é…". A contagem migrou pro título do Semáforo e a posição do programa pras linhas de turma — info preservada, formato mais pobre que o aprovado | `duplas-lista.tsx` header da `VisaoCoordenacao`/`VisaoSupervisor` vs `v6a.html` page-head
- [cosmético] /duplas · "Ver ficha" mobile | virou caret `›` sozinho em botão de borda (aria-label ok); no mock é um quadrado com chevron — equivalente, só registrando a diferença de affordance | `duplas-lista.tsx:322-330,540-548` vs `v6a.html` `.ficha`

### não-confirmado

- [não-confirmado] Suspeita: "dava pra mandar WhatsApp pro mentorado na tela de duplas e agora só aparece pro mentor" | **Na lista nunca existiu contato ao mentorado** — o pré-merge tinha só `LembreteButton destino="mentor"` (`duplas-lista.tsx.old:963-980`). Na **ficha** segue intacto: `page.tsx` byte-identical, `WhatsAppRapido destinos=[mentor,mentorado]` em `:776-785` e `apoioDestinos` em `:1622`. No **card da home** (`dashboard-coordenacao` › `DuplaCard`) `WhatsAppRapido [mentor,mentorado]` inalterado; na **agenda** a fila mantém `destino=mentorado` pro apoio do jovem. E a lista **ganhou** contato ao mentorado: apoio com origem jovem/ambos troca a ponta inteira — "Chamar" + nudge `destino=mentorado` com template `apoio_jovem` | `duplas-lista.tsx:1046-1084`, `whatsapp-msgs.ts:97-100`. Ressalva real: na linha comum o WA é single-target (mentor; mock também é single-target — `:502` "Lembrar Roberto Alves" = mentor); pra falar com o jovem fora do apoio_jovem segue ficha/home/agenda — ver Dúvida 5
- [não-confirmado] Suspeita: ficha perdeu ações/menus | `src/app/(app)/duplas/[id]/page.tsx` é **byte-identical** ao pré-merge; `mais-menu.tsx`, `terceiros-dupla.tsx`, `whatsapp-rapido.tsx`, `nudge-button.tsx`, `fila-acompanhar.tsx`, `aux-card-acoes.tsx`, `semaforo.tsx` sem diff. `instrumentos-dupla.tsx` mudou apenas cosmético (emblemas compartilhados, `GUIA_ENCONTRO` movido pra `lib/como-conduzir`, âncora `#instrumentos` + `scroll-mt`) | `git diff 436065e^..HEAD --stat`
- [não-confirmado] Suspeita: home/dashboard de coordenação, supervisor e mentor | `dashboard-coordenacao.tsx` diff = refactor `Seg`→`BarraSegmentada` (mesma info, viz compartilhado) + `turmaLonga` nos labels; `mentor-home.tsx` e `(home)/page.tsx` sem diff; `meus-chamados-card` (badge refactor), `solicitacoes-coord-card` (turmaLonga) — nada removido | `git diff 436065e^..HEAD`

## O que MELHOROU de verdade

1. **Contrato WhatsApp do v6a implementado inteiro**: split `Lembrar` (nudge real: notificação + wa.me + cap 48h com "Lembrada dd/mm") × `Chamar` (contato `t=contato`, fora do cap), menu com `Abrir wa.me / Copiar mensagem / Ver texto da mensagem`, estado disabled "sem WhatsApp cadastrado" com o Lembrar saindo só-notificação, quadrado verde compacto no mobile, ações no topo do card mobile e na célula do desktop — sem faixa-footer (`dupla-wa-acao.tsx`, `duplas-lista.tsx:314-332`).
2. **Contato ao mentorado no caso `apoio_jovem`** — inédito na lista, e correto por domínio (o pedido pode ser sobre o próprio mentor): `duplas-lista.tsx:1046-1048,1079-1084` + template acolhedor `whatsapp-msgs.ts:97-100`.
3. **Catálogo único de mensagens** (`whatsapp-msgs.ts`): dashboard, agenda e ficha/lista saem do mesmo texto por contexto — fim de 3 cópias divergentes.
4. **Apoio ordena a fila em 1º** (peso 0) + pill azul sobre o estado real + fundo info — antes apoio não influenciava a ordem (`:1291-1296`).
5. **Supervisor ganhou o mesmo Lembrar/Chamar da coord** no escopo supervisionado, com `nudges` carregados (page.tsx:66-69) e cap 48h compartilhado por dupla — decisão travada do plano (item 3) que sobrepõe a nota desatualizada do mock.
6. **ResumoSemaforo agregado**: barra proporcional clicável + apoio como eixo separado + posição "encontro X de Y" por turma + nota "começou depois — não é atraso" (`:707-893`).
7. **Segmentos 1–16 com tick do esperado** substituindo a barra contínua, com `role="img"`/`aria-label` ("8 de 16 encontros") — a11y preservada; a `LinhaMini` ganhou mini-barra com tick só em dupla ativa (`:501-531`).
8. **`textoSinais` de fora-da-régua** agora diz o status real ("Dupla pausada") em vez do "em dia" que o pré-merge exibia.
9. **`nome_social` do mentorado** na assinatura das mensagens (`:1049`) — antes usava `nome` civil.
10. **`min-h-dvh`/`flex-col` no shell** (`app-shell.tsx:110`) — footer encosta na borda inferior no mobile, bug apontado no feedback corrigido; skeletons de `/duplas` e da ficha espelham a anatomia nova.
11. **Refactors saudáveis**: `turmaLonga/Curta` centralizados (`lib/turma.ts`), `GUIA_ENCONTRO` único em `lib/como-conduzir`, `BarraSegmentada`/`Donut` compartilhados em `components/viz`.

## Dúvidas que precisam de decisão

1. **"Todas as duplas" literal**: confirmar `Chamar` em pausada/concluída/encerrada e na `LinhaMini` da massa (mock mostrava sem WA nos dois; plano deixou "decidir/confirmar"). Se for manter, registrar no mock/plano.
2. **Eixo apoio**: aceitar pill→ficha + Lembrar/Chamar como substituto definitivo de "Abrir chamado", ou implementar o item 8 do plano (query do chamado por `dupla_id`, RLS-scoped)? Mínimo imediato: a pill podia apontar `/duplas/<id>#apoio` — hoje vai sem âncora.
3. **Busca**: manter repaint seco (justificativa: re-key por tecla recolhe grupos e mata dialogs) ou animar com debounce? A convenção escrita cobre busca.
4. **`Registrar supervisão` em ⋮ de 1 item**: aceitar 2 cliques ou promover a botão quando for a única secundária da linha?
5. **Destino único por linha**: hoje mentor sempre; mentorado só via apoio_jovem. `msgsContato` já gera as duas pontas de graça — querer troca de destino no menu (ou um 2º item "Falar com {jovem}") pra casos como "dupla sumiu", onde o jovem é o canal seguro documentado?
6. **Mock desatualizado**: v6a diz "auxiliar sem WA/nudge" (`v6a.html:652,788`); o plano pós-review diz o contrário e o impl seguiu o plano — confirmar que o mock deve ser corrigido e que `agenda-auxiliar.spec.ts` cobre a presença do Lembrar.
