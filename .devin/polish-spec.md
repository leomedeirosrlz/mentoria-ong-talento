# Polish spec — realiza.vc

Spec auto-contida pra implementadores. Contexto: `.devin/ux-checklist.md` (64 itens — nada aqui autoriza desfazê-los: `aria-current`, `min-h-11`, roving tabindex, deep-links `#registrar-*`, `title` só como redundância, skeletons). Tokens vivem em `src/app/globals.css`. Lib `motion` v13 instalada — `import { motion, AnimatePresence, MotionConfig } from "motion/react"`. Copy pt-BR.

## 1. Identidade de papel (mentor/mentorado) — tokens + regra de uso

**Decisão:** mentor NÃO ganha hue — fica na tinta do sistema (`--brand-ink`/`--foreground`). Lime em nome colide duas vezes: mesmo hue (78°) de `--ok`/`--ok-text` (regra dos 15° — um hue, um significado) e com a reserva de lime pra ação-primária/ativo/agora (HV-2). O mentorado ganha o único acento novo do sistema, **amarelo 48°** — o amarelo do ponto do logo (`rgb(255,213,49)`, mesmo valor de `--chart-2`). Violeta 258° (1ª escolha) e esmeralda 152° foram rejeitados em revisão — fora da paleta da marca. **Amarelo só como marcador (dot/disco), nunca como cor de texto** — variante escura pra texto ficou feia em revisão; nomes voltam à tinta normal e o dot `size-1.5` antes do nome carrega a identidade (mesmo vocabulário dos labels de parear). Convive com `--warn` 43°: warn é âmbar de status com motivo textual; o papel é marcador visual ao lado de texto normal. Leitura: quem age na plataforma fica na tinta do sistema; o marcador amarelo marca quem é acompanhado.

**Tokens** — adicionar em `:root` de `globals.css`, depois de `--danger`:

```css
--role-mentor: var(--brand-ink);            /* marcador (dot/anel) do mentor */
--role-mentor-text: var(--foreground);      /* nome do mentor = tinta normal */
--role-mentorado: hsl(48 100% 60%);         /* dot/disco do mentorado (= amarelo do logo) */
```

"Soft" = o idioma existente de opacidade (`bg-[var(--role-mentorado)]/15`, `/8`) — não criar token `*-soft`.

**Regra de uso:**

- **Lockup de nomes** — componente novo `src/components/dupla-nomes.tsx`, `DuplaNomes({ mentor, mentorado, onDark })`, renderiza inline: `{mentor} <span className="font-normal text-muted-foreground">e</span> <span className="inline-flex items-center gap-1.5"><dot amarelo/>{mentorado}</span>` — nomes sempre na tinta normal do contexto. O pai controla `truncate`/peso. Ordem mentor→mentorado é fixa — é a chave não-cromática (PV-2); o dot é redundância. Substitui o padrão "X e Y" repetido em 5 lugares.
- **Avatar** — `avatar.tsx` ganha `papel?: "mentorado"` → `bg-[var(--role-mentorado)]/30 text-[var(--brand-ink)]` (mentorado nunca tem foto — sempre iniciais; `Mentorado` nem tem `avatar_path`). Mentor/default: lime atual.
- **Onde aparece:** só onde os dois papéis dividem a mesma superfície — lockup de nomes (lista de duplas, dashboard, ficha, agenda, home do mentor), labels "Mentor"/"Mentorado" dos dialogs de parear (dot `size-1.5 rounded-full` antes do texto: `bg-[var(--role-mentor)]` / `bg-[var(--role-mentorado)]` — distinção crítica pra não trocar os campos), label de responsável em `encaminhamentos-list.tsx` (dot amarelo + "Mentorado" muted; "Mentor" só texto).
- **Onde NÃO aparece:** badges "mentor/mentorado" redundantes; meta-texto corrido; superfícies de papel único onde o rótulo já diz quem é quem. A lista "Com acesso" (papel misto: coord/supervisor/mentor) permanece neutra.
- **Nunca** dot de papel na mesma zona de dots de status (semáforo, `corDotEncontro`) — uma família de dots por zona. Papéis de staff (supervisor, coordenação) não têm cor de papel.

## 2. Sistema de motion

O guard CSS de `prefers-reduced-motion` (globals.css:232-241) **não cobre** animação JS — obrigatório `<MotionConfig reducedMotion="user">` envolvendo `{children}` em `src/app/layout.tsx` (server layout renderiza provider client normalmente). Resultado: transform/layout viram instantâneos, fades continuam.

**Vocabulário** — arquivo novo `src/components/motion.tsx`:

```ts
export const EASE = [0.2, 0, 0, 1] as const;             // = --ease-snappy
export const T = {
  micro: { duration: 0.15, ease: EASE },                 // hover/cor — prefira CSS
  enter: { duration: 0.18, ease: EASE },                 // entrada de painel/card
  panel: { duration: 0.22, ease: EASE },                 // height:"auto", crossfade
  pill:  { type: "spring", duration: 0.3, bounce: 0 },   // layoutId — bounce SEMPRE 0
} as const;
export const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -3, transition: T.micro },   // saída mais curta e sutil
};
```

**Divisão de trabalho:** CSS continua dono do que já funciona — `.animate-enter` (stagger `--i`×35ms, cap 10), `.animate-enter-x` (slide de mês), `animate-ping-once`, `shimmer`, `animate-in/out` de Dialog/Dropdown (tw-animate-css, 150ms snappy), `transition-colors` de hover, `active:scale-[0.96]` do button. Não converter. Motion entra só onde CSS não chega: shared-element (`layoutId`), exit, `AnimatePresence`, `height: "auto"`. Toda animação nova leva comentário de uma linha com a função (feedback / continuidade espacial / atenção) — sem função escrita, não entra. `initial={false}` em `AnimatePresence` que monta no primeiro paint.

**Onde aplicar:**

- `login-form.tsx:223-257` — segmento "Link|Senha": o bg do label ativo vira `motion.span layoutId="login-modo"` `absolute inset-0 rounded-lg bg-card shadow-[var(--shadow-border)]`, `transition={T.pill}` (label vira `relative`, conteúdo `relative z-10`). O pill desliza — continuidade espacial no lugar do corte.
- `login-form.tsx:168-322` — form ↔ painel "Link enviado": `<AnimatePresence mode="wait" initial={false}>` com dois `motion.div` keyed (`"form"`/`"enviado"`), `{...fade}` + `transition={T.enter}`. Crossfade; o `ref`/`tabIndex` de foco migra pro motion.div.
- `login-form.tsx:282-294` — campo senha: `AnimatePresence` + `motion.div` `initial={{ height: 0, opacity: 0 }}` `animate={{ height: "auto", opacity: 1 }}` `exit={{ height: 0, opacity: 0 }}` `transition={T.panel}` `className="overflow-hidden"`. O campo empurra o submit — a altura preserva a continuidade.
- `app-shell.tsx:158-165` — indicador da bottom nav (`h-0.5 w-8`): vira `motion.span layoutId="nav-bottom"` + `T.pill` — desliza entre tabs na troca de rota.
- `app-shell.tsx:99-113` — bg do item ativo da sidebar: `motion.span layoutId="nav-side"` `absolute inset-0 -z-10 rounded-lg bg-[var(--brand-lime)]` + `T.pill`; texto/ícone sobem pra `relative`. O AppShell persiste entre rotas — a pill viaja pra nova seção.
- `agenda-calendario.tsx:917` — detalhe do dia: o `<div key={selecionado} className="animate-enter">` vira `<AnimatePresence mode="wait" initial={false}><motion.div key={selecionado} {...fade} transition={T.enter}></AnimatePresence>` — hoje a saída é corte seco. O `<p aria-live>` (PV-4) fica **fora** do motion.
- `registro-inline.tsx:98-114` — `RegistroInlinePanel` sempre renderiza `<AnimatePresence initial={false}>`; dentro, `aberto && <motion.div id={...} className={className} initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={T.panel} style={{overflow:"hidden"}}>` — o card cresce pra revelar o form em vez de teleportar. `id` e `aria-controls` permanecem.
- Entrada de listas: `dashboard-coordenacao.tsx:288` (map dos DuplaCard) ganha `animate-enter` + `style={{ "--i": Math.min(i, 10) }}` — paridade com `duplas-lista:120`. `mentor-home.tsx:116` ganha `animate-enter` (1-2 cards, sem `--i`). CSS, não motion.

## 3. Regras de hierarquia/declutter — gerais

- **Escala fechada:** h1 `text-2xl font-semibold tracking-tight` (um por tela); rótulo de seção de página/lista = overline `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`; título dentro de card = `text-sm font-semibold`; corpo/row = `text-sm`; meta = `text-xs text-muted-foreground`; ausência/dica = `text-xs italic text-muted-foreground/70`. `text-[11px]` fora disso só em badge e mono-caption. Proibido criar tamanho novo.
- **Peso:** `font-semibold` reservado a h1, lockup de dupla e números-chave; `font-medium` em título de card/row; caption/meta nunca semibold.
- **Tinta:** no máx 3 níveis por bloco — `foreground` → `muted-foreground` → `muted-foreground/70` (só ausência/dica).
- **Espaço antes de hairline:** gap intra-campo ≤ `gap-2`; entre grupos ≥ `gap-4` (regra 2×); entre seções `space-y-6`/`space-y-8`. `divide-y` só em lista homogênea; `border-t` só pra abrir grupo de lista ou separar zona de ação (coluna do nudge). Nunca hairline + gap grande duplicando a mesma separação.
- **Superfícies:** `bg-card shadow-[var(--shadow-border)]` = unidade de conteúdo; `bg-muted/40` = sub-bloco inset dentro de card (sem shadow); lavagem de status (`warn`/`danger` em `/5`–`/8`) uma por superfície, sempre com motivo textual ao lado (CC-5). Card dentro de card é proibido.
- **Ações:** uma primária por row/card/painel; secundárias `outline`; terciárias `ghost`/texto; raro/destrutivo em kebab (HH-2/PD-5). Ação nunca mora na linha-meta `text-xs` pontilhada (CC-1).
- **Badges:** só estado que pede decisão ou categoria estável; fato descritivo vira meta-texto. Máx 2 por row — além disso, consolidar.
- **Mono:** `font-mono tabular-nums` só em contadores alinhados (N/M, stats, discos de número); número em frase usa `font-medium` (padrão `Num`).
- **Overline:** um por superfície; é rótulo de região, não legenda de campo.

## 4. Por arquivo — ações concretas

**`src/components/mentor-home.tsx`**
1. `:121` — "Você e {nome}" → `<DuplaNomes mentor="Você" mentorado={...} onDark />` (dot amarelo marca o mentorado sobre o header ink).
2. `:160`,`:240` — labels "Próximo encontro"/"Encaminhamentos abertos" (`text-xs` solto) → overline padrão — mesma gramática de rótulo de região do resto do app.
3. `:116` — Card ganha `animate-enter` (§2).
4. Manter: chips de ação fora da meta (CC-1), "+N mais" (PD-2), banner warn.

**`src/components/dashboard-coordenacao.tsx`**
1. `:435-437` — lockup → `<DuplaNomes>`.
2. `:288` — DuplaCards com `animate-enter` + `--i` cap 10 (§2) — a entrada revela a ordem risco→ok.
3. `:447-452` — "Último nudge…" sai de baixo do motivo e entra na zona do nudge (`:474`, `justify-between` com o botão) — a anotação da ação mora junto da ação (GG-3).
4. Manter: superfície tingida por semáforo, Stat-link com `aria-current`, banner de apoio.

**`src/components/duplas-lista.tsx`**
1. `:125-128` — lockup → `<DuplaNomes>`.
2. `:134-154` — fundir as duas colunas à direita em uma só: `n/N` + barra + status empilham (`items-end`, status em `text-xs` muted sob a barra) — uma zona de meta, não duas.
3. Manter: `animate-enter`, `divide-y`, hover `bg-muted/50`, empty states com CTA real.

**`src/app/(app)/duplas/[id]/page.tsx`**
1. `:199-209` — h1 vira lockup: par de avatares sobrepostos (`flex -space-x-2`, cada um `ring-2 ring-background`; mentor = Avatar atual, mentorado = `<Avatar papel="mentorado" nome={...} size={28}>`) + `<DuplaNomes>`. A dupla vira unidade visual.
2. `:214` — "Supervisor:" desce pra `text-xs` (terciário; hoje compete em `text-sm` com o semáforo).
3. `:297-298` — card "Mentorado": título vira overline "Mentorado" + linha `text-sm font-semibold` com o nome + dot de papel — hoje o nome do mentorado não aparece no card dele.
4. `:443-452` — meta do EncontroRow: quando `feito` sem divergência, omitir "sugerido {data}" — depois de realizado, a data oficial é ruído (meta encolhe uma cláusula).
5. `registro-inline.tsx` — expand animado (§2); manter `<details>` com contagem (PD-1).

**`src/components/agenda-calendario.tsx`**
1. `:1195-1199` — lockup do `EncontroDuplaRow` → `<DuplaNomes>` (dentro do `truncate`).
2. `:917` — detalhe do dia → crossfade `AnimatePresence` (§2); `aria-live` fora do motion.
3. `:1042` — "Todos os eventos de {mês}" (`text-sm font-medium text-muted-foreground`) → overline padrão — é rótulo de seção.
4. Manter: `animate-enter-x` direcional do grid/lista, roving tabindex, legenda + `ChaveDotsDupla`.

**`src/components/pessoas-listas.tsx`**
1. `:293` — nomes na lista "Mentorados" → dot de papel + nome em tinta normal (§1).
2. `:210-219` — "sem termo" + "sem formação" → um badge warn só: `pendências: termo · formação` — 2 badges → 1 (HH-2, máx 2/row).
3. `:194-209` — pra `ehMentor`, suprimir badge "em dupla" quando `vagas > 0` — `{vagas}/{capacidade} duplas` já diz isso; badge redundante sai.
4. Manter: `animate-enter`, filtro "Sem dupla", empty states com CTA.

**`src/app/login/login-form.tsx`** — só motion (§2: pill, crossfade form↔enviado, senha expand). Manter fieldset/legend (HH-4/AF-6), `min-h-11` (MT-1).

**`src/components/app-shell.tsx`** — só motion (§2: `nav-bottom`, `nav-side`). Manter skip-link, `aria-current`, safe-area.

**Suporte:** `globals.css` (tokens §1) · `avatar.tsx` (prop `papel`) · `dupla-nomes.tsx` e `motion.tsx` (novos) · `app/layout.tsx` (`MotionConfig`) · `encaminhamentos-list.tsx:55` (responsável) · `nova-dupla-dialog.tsx:135,158` + `editar-dupla-dialog.tsx:173,190` (dots nos labels).

## 5. O que NÃO fazer (anti-slop)

- Não pintar mentor de lime nem de outro hue — mentor é a tinta do sistema. Nunca `--brand-lime`/`--ok` em nome de pessoa.
- `--role-mentorado` nunca como cor de texto — só marcador (dot `size-1.5`, disco do avatar, label de parear). Nome de pessoa é sempre tinta do contexto.
- Cor de papel nunca em dot vizinho de semáforo, nunca em badge redundante com nome colorido, nunca em papéis de staff.
- Motion funcional ou nada: sem `bounce > 0`, sem loop (único infinito permitido: `shimmer` do skeleton), sem parallax/scroll-driven, sem stagger além de 10 itens (~350ms), sem animar célula a célula do calendário (o mês entra como bloco — já é o comportamento). `AnimatePresence` nunca atrasa ação: exit ≤ 160ms e `mode="wait"` só onde o entrante depende do espaço do saínte.
- `initial={false}` em todo `AnimatePresence`/wrapper que monta no primeiro paint — a página não anima no load (skeleton → conteúdo já é a entrada).
- Sem `transition-all` — transição nomeia as props (`transition-colors`, `transition-[border-color,box-shadow]`).
- Não adicionar gradiente, glass, glow, stripe colorida, radius ou sombra novos; não criar tokens fora do listado.
- Não remover/afrouxar nada da ux-checklist — em conflito, a checklist vence e o item volta marcado.
