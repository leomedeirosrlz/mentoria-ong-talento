# Feedback — /duplas (visão geral / monitoramento de duplas)

Tela: `src/app/(app)/duplas/page.tsx` + `src/components/duplas-lista.tsx`
+ `src/components/fila-acompanhar.tsx` + `src/components/site-footer.tsx`
+ `src/components/lembrete-button.tsx` / `whatsapp-rapido.tsx`.

> **Nota de rastreabilidade**: o Thiago disse "parece que você ignorou
> totalmente o que eu falei sobre a visão geral de duplas — falei pra tirar
> esse footer, compactar botão do whatsapp no mobile". Procurei o feedback
> anterior em `docs/` e BACKLOG e **não achei registro** — provavelmente foi
> verbal/numa sessão que não persistiu. Os itens reafirmados agora ficam
> registrados aqui de forma permanente.

## Itens do feedback

1. **"Footer" = a faixa de baixo do card da dupla** — ✅ decidido: não é o
   `SiteFooter`. É a banda inferior do card/linha de cada dupla onde mora
   o botão WhatsApp (área que o Thiago marcou em vermelho no screenshot).
   Ela vira uma linha inteira dedicada a um único botão — desperdício.
   O card compacta e a ação migra pro corpo do card (ver item 2 e o
   exercício de compactação no item 6).
2. **Footer real flutua no meio da página em telas vazias** — o
   `SiteFooter` fica, mas em páginas com pouco conteúdo ele sobe e deixa
   buraco embaixo. Fix: o shell do app garante `min-height: 100dvh`
   (`min-h-dvh` + `flex flex-col` com o conteúdo `flex-1`), footer sempre
   encostado na borda inferior do viewport ou abaixo da dobra.
3. **WhatsApp compacto no mobile** — os botões "Lembrar {nome}" da fila /
   linhas de dupla ocupam espaço demais em 390px. No mobile: só o símbolo
   do WhatsApp (fundo verde WhatsApp `#25D366` ou token equivalente) com
   dropdown/⋮ — o rótulo completo fica no desktop.
4. **Animação de filtragem** — "não pode ser repaint seco": filtrar a lista
   de duplas (chips, busca, filtro por turma) deve animar — entrada/saída
   suave dos itens (FLIP ou fade+slide escalonado), não teleporte do DOM.
   Registrar como convenção: **filtro novo sempre anima** — anotar em
   `AGENTS.md` junto da regra de tipografia.
5. **Lista ainda muito grande e pouco visual** — a massa de ~26 duplas.
   As mitigações do mock v5 (massa saudável colapsada com "mostrar as
   outras N") e a densidade da 176 já existem — mas o feedback é que ainda
   não basta: considerar resumo visual no topo (semáforo agregado, barra
   de progresso da semana) antes da lista crua.
6. **Card da dupla compacto estilo dashboard** — ✅ spec travada:
   **variante v6a "linha densa evoluída"** (`docs/mockups/duplas/v6a.html`
   — tabela da v5 com 2 linhas por dupla, sem faixa-footer, WhatsApp na
   célula de ações, encontros em segmentos 1–16, resumo de semáforo no
   topo). v6b (mini-card) descartada. Mantém visível: semáforo + motivo
   ("3 encontros em atraso"), contagem com proporção visual, badge de
   trilha, ação WhatsApp.
   - **Decisões travadas (review v6a)**: botão WhatsApp **visível em
     todas as duplas** (não só as com pendência) e **auxiliar também
     pode mandar nudge** (mesmo acesso ao Lembrar/WhatsApp que a coord
     no escopo supervisionado).
7. **"Lembrar em lote"** — questionou a existência do batch em materiais;
   na visão de duplas o Lembrar por linha faz sentido (já existe) — manter
   por linha, sem criar batch novo.

## Critérios de aceite

- [ ] O card/linha de dupla não tem faixa inferior dedicada a ações — a
      ação WhatsApp mora no corpo do card (no mobile: ícone verde + menu).
- [ ] Em qualquer rota `(app)` com pouco conteúdo, o `SiteFooter` encosta
      na borda inferior do viewport (shell com `min-h-dvh` + conteúdo
      `flex-1`); nunca flutua no meio com buraco embaixo.
- [ ] Em ≤480px, o botão Lembrar/WhatsApp das linhas é só ícone verde
      WhatsApp + menu (copiar mensagem / abrir wa.me / ver texto); label
      completo só ≥sm. Foco e aria-label preservados ("Lembrar {nome}").
- [ ] Card compacto mantém visíveis: semáforo + motivo em texto, contagem
      de encontros com proporção visual (não só "4/16"), badge de trilha
      quando existe. Altura do card reduzida vs. anatomia atual.
- [ ] Aplicar/limpar filtro ou digitar na busca anima a lista (fade/slide
      ou FLIP ≤300ms, stagger leve); `prefers-reduced-motion` desliga.
      A regra "filtros animam" vai pra `AGENTS.md`.
- [ ] Specs de `/duplas` e `agenda-auxiliar.spec.ts` verdes (asserts de
      botão Lembrar por rótulo podem precisar virar aria-label).

## Mapa de regressões e gaps (review out/2026)

### Estado atual — onde cada coisa mora

- **Página** — `src/app/(app)/duplas/page.tsx` (:19-79): `visao` deriva de
  papéis efetivos — coordenação → `getDuplas()` (todas); supervisor →
  `getMinhasDuplas()` filtrada por `supervisor_id` (:44-53); mentor/esp →
  `getMinhasDuplas()`. Extras por visão: `getSupervisaoAlvos()` só p/
  supervisor (:55), `getEspecialistaEventos()` p/ esp/híbrido (:56-58) e
  **`getUltimasInteracoes(..., "nudge")` só p/ coordenação** (:62-65).
  `DuplasLista` (`src/components/duplas-lista.tsx:709-728`) recebe
  `lista, eventos, agora, visao, meuNome, supervisaoAlvos,
  especialistaEventos, nudges`.
- **Linha densa** — `LinhaDupla` (:195-413) com `GRID_COLS` (:192-193),
  6 colunas desktop (estado/apoio · dupla · progresso · sinais · nota ·
  ações). A célula de ações (:397-410) é `hidden` no mobile sem `acao` e
  `flex` com ação; sem `acao`, "Ver ficha ›" sobe pro topo do card
  (:272-279). Pill "Apoio" linka `/duplas/<id>` (:264-271). Progresso é
  **barra contínua** `role="progressbar"` + tick do esperado (:306-349,
  `aria-label` "X de Y encontros"). Sinais: `p.truncate[title]` + texto
  `sr-only` íntegro (:354-376). **Não existe faixa-footer nos cards
  coord/supervisor** — o "footer" que sobra é a célula de ações no fim do
  card mobile quando `acao` existe.
- **Visões** — `VisaoDuplas` (:63-70): `coordenacao | supervisor | mentor
  | especialista | hibrido`. `VisaoCoordenacao` (:843): busca/chips/
  filtros client-side (`CATS`/`chipBate` :487-510, `useMemo`), massa
  saudável colapsada em `<details>` (:923-947, `LinhaMini` :416),
  `ResumoLinha` textual (:590-605). **`lembrar` só existe quando
  `d.status === "ativa" && s.sinais.length > 0`** → `LembreteButton`
  `destino="mentor"` (:960-981). `VisaoSupervisor` (:1284): grupos por
  turma com subheader "encontro N <data>" via `eventoDaSemana`
  (:1395-1416), `acao` = `SupervisaoDialog` (:1421-1434) — **sem
  LembreteButton, sem WhatsApp, sem nudges**. `VisaoMentor` (:1462):
  card com **footer condicional só quando `pendente`** (:1678-1693 —
  "Registrar encontro N" + "Abrir ficha"); sem pendência, "Abrir ficha"
  vai inline no header (:1582-1589).
- **`fila-acompanhar.tsx`** — `LinhaFila` (:29-46): `{item, destino,
  rotulo, lembrete{titulo,corpo}, telefone, acao?: "lembrete"|"ficha"}`.
  `acao:"ficha"` vira link (pendência da coord — ex.: rito de
  encerramento), senão `LembreteButton` (:230-263). Quem monta as linhas
  é o server em `agenda-coordenacao.tsx:87-134` (destino mentor×mentorado
  conforme `apoioDoJovem`; texto via `lembreteDaDupla` em
  `agenda-partes.tsx:100`+ e `msgsContato` de `whatsapp-msgs.ts`).
- **`lembrete-button.tsx`** (:17-100): props `duplaId, destino
  ("mentor"|"mentorado"), rotulo, telefone, titulo, corpo, href,
  bloqueadoAte`. Cap 48 h → disabled "Lembrada dd/mm" (:50-65). Sucesso →
  abre wa.me se `waLink(telefone)` válido + `router.refresh()` (:68-100).
  Server action `enviarLembrete` (`actions-lembrete.ts:13-53`) → RPC
  `enviar_lembrete` (`0094_lembrete.sql:34-137`, security definer): cap
  serializado por advisory lock **por dupla, qualquer autor**;
  **autoriza coord (global/turma via `has_papel`), supervisor da dupla e
  mentor_dpp→mentorado** (:73-82); recusa `dupla_inativa` (:84-86) e
  `sem_destino`/self-nudge (:113). Insere `interacoes(canal=in_app,
  tipo=nudge)` + `notificacoes(tipo=lembrete)`.
- **`whatsapp-rapido.tsx`** — `DestinoWA {rotulo, telefone, mensagem,
  t:"nudge"|"contato"|"apoio"}` (:18-23); `hrefDestino` monta
  `/api/nudge?d&to&t` (:27-33). `icone` (:59-119): 0 válidos → span
  disabled "Sem WhatsApp cadastrado"; 1 → `<a>` direto; >1 →
  DropdownMenu trigger `WhatsappLogo`. `compacto` (:121-179): botão
  outline "WhatsApp" + menu; sem compacto → `NudgeButton` por destino.
  **Não existe "Copiar mensagem" nem variante verde** — o trigger é
  neutro.
- **`/api/nudge` route** — valida `to` como `https://wa.me/<dígitos>`
  (`waMeValido`), sessão, `t` whitelist; cap 48h **soft** só p/ `nudge`
  (HTML "Lembrete já enviado"); dedupe 60 s por (dupla, autor, tipo);
  insert em `interacoes` via RLS — `interacoes_insert` (0008:31-39) já
  permite supervisor na dupla supervisionada; redirect 302 sempre.
- **Contatos** — `getContatos` lê a view `profiles_contato`
  (`queries.ts:228-244`): supervisor já recebe `whatsapp` dos mentores
  supervisionados via `mergeContatoDuplas` (:367-377); o embed
  `mentorado` carrega `whatsapp` em `MENTORADO_COLS_PAR` (:90-91).
- **Shell/footer** — `app-shell.tsx`: wrapper `min-h-[100dvh] md:flex`
  (:110) — **só vira flex em `md:`**; coluna `flex min-w-0 flex-1
  flex-col md:ml-56` (:228), `main#conteudo` `flex-1` (:231),
  `SiteFooter tone="ink"` (:243). **Bug real**: no mobile o wrapper é
  block, a coluna flex não é esticada a 100dvh → footer flutua em página
  curta. `jovem-shell.tsx` tem o mesmo padrão (:98, :209-218). O footer
  ink já tem `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` p/ a
  bottom-nav fixa (`site-footer.tsx:24`) — não remover.
- **Animação** — `motion` está no projeto (`package.json`),
  `MotionConfig reducedMotion="user"` global (`app/layout.tsx:67`),
  keyframes `animate-enter`/`fill-grow`/`enter-x` em `globals.css`
  (:149-195) com guard `prefers-reduced-motion` global (:300). Filtro
  hoje = `useMemo` + re-render instantâneo; `animate-enter` só roda no
  mount (classe fica, `key=d.id` preserva o nó — filtrar não re-anima).
- **Dados que faltam** — `DUPLA_SELECT` (`queries.ts:349-358`) **não
  carrega chamados**; `saudadeDaDupla.apoio` vem de
  `registro.precisa_apoio`/`avaliacao_jovem.pedir_apoio`
  (`ciclo.ts:1287-1338`) — não há `chamado.id/numero` na linha, então
  "Abrir chamado" do mock não tem href hoje.
- **E2E que morde** — `tests/e2e/demo/duplas.spec.ts`: linha ≤80 px
  desktop; sinais `p.truncate[title]`; massa collapsed com "Ver ficha";
  card 390 px `padding-left:12px`/`row-gap:8px`; **exatamente um "Ver
  ficha" por card** e "sem ação → Ver ficha no topo"; supervisor
  "agrupadas por turma"; mentor "Abrir ficha" no header. E
  `agenda-auxiliar.spec.ts`: `Lembrar` por rótulo + ⋯ "Mais ações da
  dupla de <nome>" (`aux-card-acoes.tsx`) — vive em /agenda mas
  compartilha `LembreteButton`/`WhatsAppRapido`.

### Riscos de regressão por item do plano

1. **"Sem faixa-footer" (item 1/6)** — o alvo real é: (a) a célula de
   ações que vira faixa no fim do card mobile quando `acao` existe
   (:397-410) — o v6a a joga pro TOPO via `order`; (b) o footer
   condicional do `VisaoMentor` (:1678-1693), que carrega "Registrar
   encontro N" com `href=/duplas/<id>#registrar-<encontroId>` — remover
   sem realocar esse link quebra o fluxo do mentor e o spec
   `duplas.spec.ts` (footer só com par). E com WhatsApp em toda linha,
   `acao` sempre existe → o branch "sem ação → Ver ficha no topo"
   (:272-279) vira código morto — e o spec mobile que o testa fica sem
   caminho; atualizar spec ou manter branch por outro critério. **O
   `SiteFooter` real não se toca** — o "footer" do feedback é a faixa do
   card.
2. **WhatsApp em todas as duplas** — hoje `lembrar` só com sinal
   (:961) e só coord. "Todas" precisa resolver:
   - **Semântica split** (notas do v6a): `Lembrar` = nudge
     (RPC, cap 48 h, notificação in-app) vs `Chamar` = contato
     (`/api/nudge?t=contato` — **sem cap, sem sino, só log**). Dupla ok
     não leva nudge — `Chamar` usa o template "contato neutro" de
     `msgsContato` (whatsapp-msgs, ~136).
   - **Status**: `enviar_lembrete` recusa `status <> 'ativa'`
     (`dupla_inativa`) — pausada/concluída/encerrada não podem ter
     `Lembrar`; o v6a mostra pausada **sem** wa e com "Ver ficha" só
     (contradiz "todas" — decidir se pausada leva `Chamar` ou nada).
   - **Massa colapsada**: `LinhaMini` não tem célula de ações; o `.mrow`
     do mock também não tem wa — "todas" = todas as linhas completas
     visíveis, presumivelmente. Confirmar.
   - **Apoio**: o eixo de apoio no v6a usa "Abrir chamado", não nudge —
     depende do gap de dados (item 8 abaixo).
   - **Sem telefone**: estado disabled já existe (ícone + "sem WhatsApp
     cadastrado"); com wa em toda linha vira ruído — o mock mostra o
     item disabled no menu, seguir isso.
   - **Menu novo**: "Copiar mensagem"/"ver texto" não existem — padrão
     clipboard de `copiar-chamada.tsx` (:34-47); cuidado com
     `agenda-auxiliar.spec.ts` que usa o ⋯ "Mais ações".
3. **Auxiliar pode mandar nudge** — **já é permitido no servidor**: RPC
   `enviar_lembrete` aceita `supervisor_id = my_profile_id()` (0094:77)
   e `interacoes_insert` cobre a dupla dele (0008:31-37). O gap é só
   UI/dados: `page.tsx:62-65` só carrega `nudges` p/ coord → carregar
   também p/ supervisor (o select já é escopado pela RLS); e
   `VisaoSupervisor` (:1421-1434) só monta `SupervisaoDialog` — somar
   `LembreteButton`/`WhatsAppRapido` **sem remover "Registrar
   supervisão"**. Contradição a registrar: as notas do v6a dizem que o
   auxiliar **não** tem WhatsApp/nudge (~652, 787-790), mas a decisão
   travada do plano diz o contrário — **o plano vence** (é pós-review);
   o mock está desatualizado nesse ponto. Cap 48h é por dupla: nudge da
   coord bloqueia o botão do auxiliar e vice-versa (por desenho — D5).
4. **WhatsApp compacto mobile** — `icone` já existe; falta a variante
   "verde WhatsApp + chevron" do v6a (token `--wa`/`#25D366` é cor de
   marca, não do sistema — aceitar consciente) e o `LembreteButton`
   responsivo (hoje sempre mostra rótulo/"Lembrada dd/mm"). Asserts por
   rótulo (`getByRole("button", {name:/Lembrar/})`) quebram se virar
   ícone — migrar p/ `aria-label` como o plano prevê.
5. **Filtro animado** — hoje re-render seco (`chipBate`/`useMemo`);
   `animate-enter` não re-roda em filtro (key preserva nó). Opções:
   `motion` layout/`AnimatePresence` por linha (motion já instalado,
   reduced-motion coberto pelo `MotionConfig`) ou re-key do container +
   `enter-stagger`. Custo: ~26+ nós animando juntos — limitar stagger
   (`--i` já cap em 10) e não animar a massa dentro de `<details>`.
   Não há virtualização/paginação — a animação é sobre a lista inteira.
6. **Resumo agregado no topo** — `ResumoLinha` é texto (:590-605); o
   `.sbar` segmentado do v6a deriva de `saudePorId` (já computado no
   topo, :737-739 — de graça). As linhas por turma (".s-r") replicam o
   `eventoDaSemana` que a `VisaoSupervisor` já calcula por subheader
   (:1395-1401) — extrair helper `turma→cronograma` compartilhado.
   Segmento clicável = atalho de filtro? (decisão aberta no mock — se
   sim, wire com `setFiltro`).
7. **Segmentos 1–16** — substituir a barra contínua (:320-349) por N
   caixinhas: `totalDaTrilha(d.trilha, eventosDoCronograma(...))` já dá o
   total por dupla — **especialista é 5, não 16** (o mock fixa 16);
   marcador de esperado = `saude.esperado`. Migrar `role="progressbar"`
   + `aria-valuenow` para `role="img"`/`list` + `aria-label` equivalente
   ("8 de 16 encontros") pra não perder a11y.
8. **Apoio → "Abrir chamado"** — `Dupla` não carrega chamado: precisa
   de query nova (ex.: `chamados` por `dupla_id`, RLS-scoped — supervisor
   recebe os mascarados/pula plataforma) ou fallback pra
   `/duplas/<id>#apoio`. Se o link for `/chamados?c=<id>` e o auxiliar
   clicar num chamado restrito, cai no painel `Lock` — aceitável, mas
   decidir.
9. **`min-h-dvh` do shell** — já existe no wrapper, mas **só estica em
   `md:`** (`min-h-[100dvh] md:flex` — `app-shell.tsx:110`): no mobile o
   outer é block e a coluna interna (`flex-1`, :228-231) não estica → o
   footer flutua exatamente como o feedback descreveu. Fix mínimo:
   `min-h-[100dvh]`/`min-h-dvh` na coluna interna (ou `flex` no outer sem
   gate de breakpoint). Mesmo bug no `jovem-shell.tsx:98,209`. **Não
   remover** o `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` do footer
   ink (site-footer.tsx:24) — é o colchão da bottom-nav fixa.
10. **Não regredir** — pill "Apoio" + fundo info da linha (:253,264-271);
    "sup. Nome"/"sem supervisor" (:294-301); badge de trilha esp;
    sinais `title`+`sr-only`; subheaders de turma do supervisor; ⋯
    "Mais ações" do `aux-card-acoes.tsx`; "Registrar supervisão" como
    ação do auxiliar; `CabecalhoColunas` alinhado ao `GRID_COLS`
    (:192/:252/:468 — os três usam a mesma const, mudar nos três);
    `EstadoVazio` por visão; e **nunca** afrouxar o escopo da RPC
    `enviar_lembrete` além do que 0094 já permite.

### Gaps do plano

- **Matriz ação × visão × estado** — quem vê o quê em cada linha:
  Lembrar (cap, ativa+sinal) / Chamar (contato) / Registrar supervisão /
  Abrir chamado / Ver ficha, para coord e auxiliar, em ativa com sinal,
  ativa ok, apoio aberto, pausada, concluída/encerrada e massa colapsada.
  Sem isso cada ponto vira decisão improvisada.
- **Mensagem do "Chamar"** — qual template `msgsContato` (o "contato
  neutro" cobre check-in; confirmar) e destino (mentor sempre? o
  mentorado nunca é destino de nudge da coord — só de apoio_jovem).
- **`Chamar` fora do cap** — hoje `tipo=contato` não conta nos 48h
  (comentário em interacoes.ts:24-28); confirmar que o "Chamar" genérico
  fica fora mesmo.
- **Dados novos** — chamado aberto por dupla (item 8); nudges p/
  supervisor (`getUltimasInteracoes` escopado); sumário por turma do
  coord (derivação client-side ou query).
- **Arquitetura da animação** — motion layout vs CSS re-key, stagger
  cap, reduced-motion (já coberto por `MotionConfig user` + guard CSS),
  e a convenção "filtros animam" a registrar em `AGENTS.md` (seção
  "Hierarquia de texto", ~linha 46).
- **Testes a atualizar** — `duplas.spec.ts` (Ver ficha único,
  altura ≤80 px, "sem ação→topo" morre, massa),
  `agenda-auxiliar.spec.ts` (rótulo→aria-label), e um assert novo de
  footer-no-fim em página curta no mobile.
- **E-mail/notificação do "Chamar"** — nenhuma (só `interacoes`); deixar
  explícito pra não virar expectativa.
- **Páginas públicas** — `SiteFooter light` flui no documento (sem shell)
  — o problema é só das rotas `(app)` e do jovem; delimitar o fix.

### Melhorias opcionais

- `LinhaMini` ganhar "último contato" (o `.mrow` do mock mostra).
- Data do último nudge no menu do WhatsApp ("Lembrada dd/mm" já existe
  como botão — manter a info no estado disabled).
- Extrair helper `turma→eventoDaSemana` hoje duplicado no subheader do
  supervisor.
- `ResumoLinha` pode virar o `.sbar` mantendo o mesmo texto em
  `sr-only`/title.

### Checklist do implementador (must-read)

- `src/app/(app)/duplas/page.tsx` — escopo por papel e **nudges
  coord-only** (:60-65).
- `src/components/duplas-lista.tsx` — `GRID_COLS` (:192), `LinhaDupla`
  (:195-413: ações :397-410, Ver ficha topo :272-279, progresso
  :306-349, sinais :354-376), `LinhaMini` (:416), `CabecalhoColunas`
  (:462), `CATS`/`chipBate` (:487-510), `resumoDaLista`/`ResumoLinha`
  (:563-605), `VisaoCoordenacao` (:843 — `lembrar` :953-993, massa
  :923-947), `VisaoSupervisor` (:1284 — acao :1421-1434, subheader
  :1395-1416), `VisaoMentor` footer (:1678-1693).
- `src/components/fila-acompanhar.tsx` — `LinhaFila` (:29-46), ficha ×
  lembrete (:230-263); montagem server em
  `agenda-coordenacao.tsx:87-134` e `lembreteDaDupla`
  (`agenda-partes.tsx:100+`).
- `src/components/lembrete-button.tsx` (:17-100) +
  `src/lib/actions-lembrete.ts` (:13-53) + RPC
  `supabase/migrations/0094_lembrete.sql:34-137` (permissões, cap,
  advisory lock).
- `src/components/whatsapp-rapido.tsx` (:18-33, :59-179),
  `src/components/nudge-button.tsx`, `src/components/aux-card-acoes.tsx`,
  `src/components/copiar-chamada.tsx` (padrão "copiado").
- `src/app/api/nudge/route.ts` — wa.me valido, cap soft, dedupe 60 s.
- `supabase/migrations/0008_interacoes.sql:20-39` — policies
  select/insert (supervisor já coberto na dupla dele).
- `src/components/site-footer.tsx` (:9-60), `src/components/app-shell.tsx`
  (:110, :226-243), `src/components/jovem-shell.tsx` (:98, :208-219).
- `src/lib/whatsapp-msgs.ts` (templates + "contato neutro"),
  `src/lib/interacoes.ts` (`getUltimasInteracoes`),
  `src/lib/ciclo.ts` (`lembreteBloqueadoAte` :2126-2133, `waLink`
  :2135-2142, `saudadeDaDupla` :1245+).
- `tests/e2e/demo/duplas.spec.ts` e
  `tests/e2e/demo/agenda-auxiliar.spec.ts` — asserts que vão mexer.
- `docs/mockups/duplas/v6a.html` — `.segs`/`.cell-acts`/`.sum`/`.massa`,
  notas de implementação (~646-652) e a nota contraditória do auxiliar
  (~787-790).
