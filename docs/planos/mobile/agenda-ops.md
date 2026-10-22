# Mobile audit — AGENDA e operação

## Cobertura

Rotas/superfícies auditadas (todas sob `src/app/(app)/agenda/` + componentes):

- `src/app/(app)/agenda/page.tsx` + `loading.tsx` — dispatcher por papel (coord, supervisor/auxiliar, mentor DPP, especialista, híbrido) e as 3 barras de abas.
- `src/components/agenda-calendario.tsx` (4.788 linhas) — visões dia/mês/semana/horários/lista, rail 1–16, detalhe do dia, painel "sem encontro", materiais.
- `src/components/agenda-coordenacao.tsx` + `fila-acompanhar.tsx` — monitoramento.
- `src/components/agenda-minha.tsx`, `agenda-por-mentorado.tsx`, `agenda-sua-semana.tsx` — mentor DPP.
- `src/components/agenda-auxiliar.tsx` — supervisor/auxiliar executivo.
- `src/components/agenda-especialista.tsx`, `agenda-disponibilidade.tsx`, `agenda-grade-semanal.tsx`, `agenda-grade-edicao.tsx` — especialista + híbrido.
- Dialogs/fluxos: `encontro-detalhe-dialog.tsx`, `agendar-encontro-dialog.tsx`, `editar-link-dialog.tsx`, `nao-aconteceu-button.tsx`, `copiar-chamada.tsx`, `whatsapp-rapido.tsx`, `nudge-button.tsx`, `lembrete-button.tsx`, `lembrete-disponibilidade.tsx`, `registro-form.tsx`, `importar-csv-dialog.tsx`, `importar-registros-dialog.tsx`, `supervisao-dialog.tsx`, `supervisoes-section.tsx`, `supervisao-delete-button.tsx`, `sugerir-especialista-dialog.tsx`, `notificacoes.tsx`, `app-shell.tsx` (bottom nav como contexto).
- **Em paralelo (wave 4 — não auditado):** `/duplas/[id]` inteiro (inclui `registro-inline.tsx`, `registro-card.tsx`, `registro-view.tsx`), Roda da Vida, forms públicos/intake, documentos LGPD. `agenda-dpp` como arquivo não existe — a agenda DPP é `agenda-minha`+`agenda-por-mentorado`+`agenda-calendario`. Não existe página `/notificacoes` — as notificações são o sino/popover do shell.

**Bloqueantes: 0** — todos os fluxos centrais (ver agenda, abrir dia, agendar, entrar na chamada, registrar, lembrar, supervisar) funcionam em 320–390px. Os problemas são de alvo de toque e refinamento.

---

### /agenda — barras de abas (todos os papéis)

- **Importante** — Abas `px-3 py-1.5` ≈ 30px de alvo e container `flex w-fit` sem wrap nem scroll: estoura a viewport de 320px nas 3 abas do mentor ("Minha agenda · Por mentorado · Calendário" ≈ 330px). Mesmo padrão em 4 lugares: `src/app/(app)/agenda/page.tsx:492` (híbrido), `:531` (coord), `:576` (mentor), `src/components/agenda-auxiliar.tsx:283` (supervisor). **Fix:** links → `inline-flex min-h-11 items-center rounded-md px-3`; container → `max-w-full overflow-x-auto` (a classe `scroll-fina` do rail 1–16, `agenda-calendario.tsx:2166`) ou `flex-wrap`. Régua existente: `filterChipCls` já é `min-h-11 sm:min-h-8` (`src/components/ui/filter-chip.ts:8`).
- OK: o conjunto usa `<nav>`/`role="tablist"` com `aria-current`/`aria-selected` e deep-link por `?aba=`/`?visao=` — a base semântica está certa, falta só a régua física.

### /agenda — calendário (`agenda-calendario.tsx`)

- **Importante** — Lista "Sem o Nº encontro marcado" (nudges do dia, coord/sup): o link da dupla `className="min-w-0 flex-1 truncate rounded-sm py-1 text-sm"` tem ~24px de alvo (`agenda-calendario.tsx:3809`, `li` em `:3806`). É o caminho pra ficha; o `WhatsAppRapido` ao lado já é `size-11`. **Fix:** `flex min-h-11 items-center` no link.
- **Polish** — `SemanaMentor` (visão "semana"): `role="region" aria-label="Grade do mês — role horizontalmente"` (`agenda-calendario.tsx:4134`) — rótulo errado; a grade de horários rotula certo em `:4465`. **Fix:** "Grade da semana — role horizontalmente".
- **Polish** — Linhas de material do encontro: `classeRow = "px-2 py-2"` ≈ 36px (`agenda-calendario.tsx:3668`). **Fix:** `min-h-11` na classe compartilhada.
- OK: rail 1–16 `overflow-x-auto` + botões `size-11` com `aria-label`/`aria-current` (`:2166–2219`); células do mês `min-h-11` (`:2373`); seletores de visão são `<input type="radio" className="sr-only">` dentro de label com `filterChipCls` + `flex-1` — semântica e 44px (`:1917–1980`); grades semana/horários em `role="region"` + `scroll-fina` + `min-w-[32rem]`/`minmax(4.5rem,1fr)` que rolam em vez de esmagar (`:4133–4139`, `:4463–4469`); coluna inteira do dia = um tab stop com label completo (`:4211–4220`); detalhe do dia só `lg:sticky`; lista do mês são botões `py-3` full-width (`:3021`); wizard de registro abre em `Dialog` (`:3567`).

### /agenda — monitoramento (`agenda-coordenacao.tsx` + `fila-acompanhar.tsx`)

- **Importante** — "Ver ficha ›" `min-h-9` = 36px na fila de acompanhamento (`fila-acompanhar.tsx:258`) — ação diária da coordenação no celular. **Fix:** `min-h-11 sm:min-h-9` (mesma régua do chip "Chamada", `agenda-especialista.tsx:282`).
- **Polish** — Links inline de navegação ~18–20px: "N pedidos de apoio" → `/chamados` na síntese (`agenda-coordenacao.tsx:202–210`) e "Encontro N · dd/mm" → dia do calendário na linha-resumo (`:321–333`). **Fix:** `py-1 -my-1` (ou `inline-flex min-h-11 items-center` se forem o CTA da linha).
- OK: chips de filtro com contagem usam `filterChipCls` (`fila-acompanhar.tsx:105–114`); busca só >10 linhas com `type="search"` + `aria-label` (`:118–127`); detalhe dos badges em `sr-only` (não só `title`, `:226`); "Lembrada dd/mm" desabilitado com razão em `title` (`lembrete-button.tsx:55–65`); linhas `flex flex-wrap` + `min-w-0` sem coluna fixa estreita.

### /agenda — mentor DPP (`agenda-minha.tsx`, `agenda-por-mentorado.tsx`, `agenda-sua-semana.tsx`)

- **Importante** — Estado limbo do próximo encontro: a única ação ("remarcar na ficha") é um `<Link>` inline `underline` dentro de `text-xs`, ~20px (`agenda-por-mentorado.tsx:640–647`). **Fix:** promover a pill `inline-flex min-h-11 items-center rounded-lg border px-2.5` ou `buttonVariants({ variant: "outline", size: "sm" })` — gramática dos CTAs de pendência logo abaixo (`:495–500`, `:520–525`).
- **Polish** — Strip "Sua semana": rótulos `hidden md:block` (`agenda-sua-semana.tsx:82`); no mobile restam só os contadores lime/âmbar, cujo sentido vive na legenda `text-xs` (`:99–101`), e a célula é `<li>` puro — SR ouve "ter 14 2 1" sem sentido e não há toque pra abrir o dia. **Fix:** `aria-label` por célula (ex. `"ter 14: 2 seus, 1 só acompanhando"`) e/ou virar `Link` pra `/agenda?aba=calendario&dia=${d.iso}` (deep-link já existe — `agenda-coordenacao.tsx:322`).
- OK: "Entrar na chamada" `min-h-11` (`agenda-minha.tsx:99`); rail lateral só em `lg` (`:565`); chips de escopo `filterChipCls` (`:553`); summaries nativos `min-h-11` em devolutivas/registro/trilhas anteriores (`agenda-por-mentorado.tsx:827`, `:984`, `:1075`); CTAs `buttonVariants` sm em todas as pendências; progressbar com `aria-*` (`:397–409`).

### /agenda — supervisor/auxiliar (`agenda-auxiliar.tsx`)

- **Importante** — "Ver ficha ›" `min-h-9` = 36px em dois lugares: card por turma (`agenda-auxiliar.tsx:403`) e linha da consolidada (`:601`). **Fix:** `min-h-11 sm:min-h-9`.
- **Importante (mesmo fix das abas)** — `AbasAuxiliar` repete o padrão `px-3 py-1.5` de ~30px (`agenda-auxiliar.tsx:283`) — coberto no achado das abas acima.
- OK: cards empilham (`lg:grid-cols-2`, `:201`); consolidada agrupa por dia com labels "Hoje/Amanhã"; "Registrar supervisão" é `Button` compartilhado; `LembreteButton` com cap de 48h visível.

### /agenda — especialista + híbrido (`agenda-especialista.tsx`, `agenda-disponibilidade.tsx`, `agenda-grade-semanal.tsx`, `agenda-grade-edicao.tsx`)

- OK (forte): grade visual é **desktop-only** com fallback mobile de pills `min-h-11` por dia (`agenda-grade-semanal.tsx:246–343`); editor "pintar na grade" explicitamente desktop-only com a lista como caminho de toque/teclado (`agenda-grade-edicao.tsx:44–45`); remover janela usa `-m-2.5 size-11` (hit-area 44px dentro de chip menor, `agenda-disponibilidade.tsx:263`, `:353`); inputs `type="date"`/`"time"`; "Chamada" `min-h-11 sm:min-h-9` e link da dupla `size-11` (`agenda-especialista.tsx:282`, `:291`). Nenhum achado.

### Dialogs e fluxos (registro, import, supervisão, lembretes, notificações)

- **Polish** — Import de registros: "Ignorar todas" é botão texto `text-xs` ~16px (`importar-registros-dialog.tsx:503–513`); trigger do collapsible "Prontas — entram direto" `text-xs` sem min-height (`:525`). **Fix:** `min-h-11 px-2 -my-1` ou `<Button variant="ghost" size="sm">`; trigger → `min-h-11` (régua do summary "Como o CSV é lido", `:574`).
- **Polish** — Links de evidência/anexos `text-xs underline` ~20px no detalhe do encontro (`encontro-detalhe-dialog.tsx:217–225`) — baixar evidência é gesto real de coord/sup. **Fix:** `flex min-h-11 items-center` no `<a>`.
- **Polish** — `CopiarChamada` usa `transition-all` animando `filter: blur()` (propriedade de paint) por 150ms (`copiar-chamada.tsx:75`, `:82`) — a casa documenta `transition-all` como anti-padrão (`ui/button.tsx:10`). **Fix:** `transition-[transform,opacity]` + cross-fade só por opacity.
- OK: `DialogContent` já é `max-h-[calc(100dvh-2rem)] overflow-y-auto` + `max-w-[calc(100%-2rem)]` (`ui/dialog.tsx:56`); inputs com tipos corretos (`datetime-local`/`url`/`date`/`time`) e submit `w-full`; `registro-form.tsx` wizard 3 etapas com progresso + foco no heading + etapas `hidden` que preservam FormData + **sticky footer com `bottom-[calc(4rem+env(safe-area-inset-bottom))]`** (`:899–933` — referência pro resto do app); previews de import em `scroll-fina overflow-auto min-w-640` (decisão documentada, `importar-csv-dialog.tsx:408–411`) com `role="alert"` nos erros (`importar-registros-dialog.tsx:561`); sino `size-11` com label de contagem (`notificacoes.tsx:296–303`), lista `max-h-[min(24rem,var(--available-height))]` (`:349`), itens `px-4 py-3` + `line-clamp-2` (`:382–396`), "marcar lida" `w-11` stretch (`:398–404`), `aria-live` pra novas (`:206–208`), "Marcar todas" `min-h-11 sm:min-h-0` (`:335`); `SupervisaoDialog` com `type="date"` + `aria-labelledby` + contador; `NudgeButton`/`WhatsAppRapido`/`CopiarChamada`/`EditarLinkDialog` icone todos `size-11 sm:size-8`; bottom nav com `pb-[env(safe-area-inset-bottom)]` + L/R (`app-shell.tsx:247`); guard global `prefers-reduced-motion` cobre animate-*/transitions (`globals.css:300–318`).

### Em paralelo / a verificar

- `registro-inline.tsx:186` — trigger `px-4 py-2.5` ~40px; e `RegistroInlinePanel` anima `height` (layout property, `:117–129`). Vivem em `/duplas/[id]` — wave 4 avalia junto da ficha.
- `registro-view.tsx` (renderizado dentro do detalhe do encontro) — conteúdo lido por coord/sup no dialog; a auditoria da ficha cobre a anatomia completa.
- `SemanaMentor`/`HorariosMentor` com `animate-enter-x` — cobertos pelo guard global; se houver jank relatado em Android low-end, revisitar `--dir` (transform-only, OK).
