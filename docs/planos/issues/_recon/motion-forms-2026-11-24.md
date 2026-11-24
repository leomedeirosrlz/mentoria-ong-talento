# Recon — Sistema de motion para forms/wizards (2026-11-24)

**Head:** `aecb135e` (branch `recon/motion-forms`, base `integration/plano2`) · **Fonte:** pedido do Thiago nesta sessão + varredura de código · **Status:** recon concluído; próximo passo é spec (mudança toca mais de uma superfície — fluxo `/speckit-*` se aplica).

> Este arquivo é diagnóstico. Não implementa.

## 1. Resumo executivo

O pedido ("animação de UX em todos os forms/wizards, com padrão de slide entre etapas") chega num repo que **já tem metade do sistema** — só falta unificar. Hoje existem **três idiomas diferentes de "troca de etapa"** convivendo, mais **~10 superfícies multi-etapa sem animação nenhuma**:

| Idioma | Onde | Direção fwd/back |
|---|---|---|
| `key={step}` + `.animate-rise` (remonta, sobe 14px, 500ms) | `onboarding-flow.tsx:1135`, `onboarding-jovem.tsx:517` | não |
| `hidden` + `.animate-enter-x` + `--dir` (montado, desliza ±8px, 200ms) | `registro-form.tsx:918-1224`, `WizardFicha` em `campos-pessoais.tsx:740-748` (→ 4 dialogs de pessoa) | **sim** |
| `hidden` + `motion.section animate={opacity,y}` (montado, fade só na entrada) | `formulario-publico.tsx:711-719` | não |

O idioma do meio é o mais completo: direcional, preserva `FormData` (etapas seguem montadas — requisito rígido do wizard do `/f/[token]`, decidido em `realiza-144-forms-wizard.md` §3), tem gerência de foco (`focoPendente` + `tituloRef`) e validação que navega até o campo inválido. **A proposta é canonizá-lo** — extrair o mecanismo num hook + componente do kit e aplicar às superfícies cruas, em vez de inventar um quarto idioma.

A segunda repetição grande já está padronizada de fato: **"form → sucesso/erro"** usa `AnimatePresence mode="wait" initial={false}` + `{...fade}` + `T.enter` em 10 lugares — falta só extrair (e 4 deles deixam o foco órfão).

Tokens/infra já existem e devem ser reusados, não duplicados: `--ease-snappy` (`globals.css:355`), `.animate-enter`/`--i`, `.animate-enter-x`/`--dir`, `.animate-rise`, `.fill-grow`, `EASE`/`T`/`fade`/`ExitList`/`ExitItem` (`src/components/motion.tsx`), `MotionConfig reducedMotion="user"` (`src/app/layout.tsx:97`) + guard global de `prefers-reduced-motion` (`globals.css:865-902`). Convenção vigente: `conventions-ui.md` §Movimento (linhas 40-42).

## 2. Inventário de superfícies

### A — Wizards com etapas numeradas (alvo do slide direcional)

| Superfície (rota/componente) | State da etapa | Nº etapas | Animação atual | Fwd/back | Foco | Progresso | Alvo |
|---|---|---|---|---|---|---|---|
| Onboarding staff — `src/components/onboarding-flow.tsx` | `stepBruto` :236 | 7–12 dinâmico | `key={step}`+`.animate-rise` :1135 | não | `scrollTo`+`tituloRef.focus()` :315-320 | barra+`N/M` :1101-1116 | **P0** slide direcional (avaliar: balão `rise` é metáfora de conversa — ver §7) |
| Onboarding jovem — `src/app/(jovem)/jovem/onboarding-jovem.tsx` | `stepBruto` :157 | 4–5 dinâmico | idem :517 | não | idem :191-194 | barra+`N/M` :479-496 | **P0** idem |
| Registro de encontro — `src/components/registro-form.tsx` | `etapa` :221 + `direcao` :223 | 3 fixas (+pós-save) | `hidden`+`enter-x`+`--dir` :918-1224 | **sim** :580 | `focoPendente`+`tituloRef` :565-569 | barras `aria-current="step"`+`Passo N de 3` :898-916 | **P0** migrar pro hook (valida o sistema, zero mudança visual) |
| `WizardFicha` — `src/components/campos-pessoais.tsx` | `etapa` :540 + `direcao` :542 | por `passos[]` | idem :740-748 | **sim** :574 | idem :561-570 | stepper clicável `aria-current` :683-734 | **P0** migrar pro hook |
| ↳ NovaPessoa / NovoMentorado / EditarPessoa / EditarMentorado dialogs | `pessoas-dialogs.tsx:166,:422`; `pessoa-actions.tsx:144`; `mentorado-actions.tsx:127` | 4–7 | via WizardFicha | sim | sim | sim | herda |
| Combinar plano — `src/components/combinar-plano.tsx` (dialog) | `passo` :169, `passos` useMemo :308-320 | 2–5 dinâmico | **nenhuma** (corte :1116-1120) | não | `tituloRef.focus()` :325-331 | "Pergunta N de M" :1113 | **P0** slide + system |
| Form público wizard — `src/app/f/[token]/formulario-publico.tsx` | `etapa` :144 | ≥2 seções dinâmico | `hidden`+`motion animate{opacity,y}` :711-719 | não | foco `h2[data-secao]`/`focoPendente` :179-213 | pill `role=progressbar` "Seção N de M" :602-630 | **P0** ganhar direção |
| Roda da Vida (eixo ativo) — `src/components/instrumentos/roda-vida.tsx` | `ativoManual` :55, setas :165-190 | = nº áreas | **nenhuma** no cartão do eixo | não | `aria-live` anuncia nota :216 | "Área N de M" :176 | **P2** fade entre eixos (gesto direto: slide pode brigar com o dedo) |
| Cronograma builder — `src/components/cronograma-builder.tsx` | `etapa` :108 | 2 (config→previa) | **nenhuma** (early return :246) | não | não movido | nenhum | **P1** |
| Nova turma — `src/components/nova-turma-flow.tsx` | `modo` :37 | 3 modos | **nenhuma** (early returns :74-99) | não | não movido | nenhum | **P1** |
| Importar CSV — `src/components/importar-csv-dialog.tsx` | linhas/previa/resultado :115-126 | 3–4 fases | **nenhuma** | não | `el?.focus()` ref callback :294,:317,:398 | textual | **P1** |
| Importar registros — `src/components/importar-registros-dialog.tsx` | linhas/resultado :118-129 | 3 fases | **nenhuma** | não | idem :557,:582 | textual | **P1** |
| Registro pós-save — `src/components/registro-form.tsx` | `posSave` :249, render :815-836 | +1 (evidências) | **nenhuma** (early return) | não | não | — | **P1** (`FadeTroca`) |
| Fila de espera ↔ parear — `src/components/fila-espera.tsx` | `modo` :135 | 2 | **nenhuma** no conteúdo (card abre via Collapsible :528) | não | `aria-pressed` :510 | contadores | **P1** |
| Pedir especialista — `src/components/pedir-especialista-dialog.tsx` | `modo` :162 | disclosure progressivo | **nenhuma** | — | não | — | **P1** (entrada em cascata, não slide) |
| Adoção explorador — `src/app/(app)/relatorios/operacionais/adocao-explorador.tsx` | `etapa`/`fase` :40-41 | 4 fases | **nenhuma** (só `animate-pulse` no loading) | não | não | — | **P2** (ferramenta interna) |

### B — "form → resultado" (o idioma já padrão — `AnimatePresence mode="wait" initial={false}` + `{...fade}` + `T.enter`)

Consistente em 10 lugares: `enviar-formulario-dialog.tsx:234`, `enviar-instrumento-lote.tsx:244`, `enviar-termos-dialog.tsx:448`, `formulario-links.tsx:589`, `avaliacao-encontro-form.tsx:117`, `terceiro-publico.tsx:126`, `definir-senha-form.tsx:156`, `login-form.tsx:515`, `formulario-publico.tsx:565`, `instrumentos/flow.tsx:96`.

**Exceções fora do padrão / com foco órfão:** `novo-link-dialog.tsx:350` (early return seco), `resumo-senha-form.tsx:30` (`location.reload()`), `avaliar-token-flow.tsx:40-62` (early returns secos), `jovem-agendar-sugestao.tsx:117/:162` (corte + `.animate-enter` solto), `enviar-*`/`formulario-links` (trocam painel sem mover foco — o botão que disparou desmonta; só `enviar-instrumento-lote.tsx:251` tem `role="status"`).

### C — View-switches/abas (mesma gramática, não são wizards)

Crossfade por `key`: `agenda-calendario.tsx:3771` (dia selecionado, AP `mode="wait"`+fade), `assistente-conversa.tsx:1058-1070` (chat↔histórico, `mode="popLayout"`+slide x). Re-key + `.animate-enter`: `materiais-abas.tsx:91`, `agenda/page.tsx:394`, `chamados-app.tsx:386`, `pessoas-listas.tsx:952`, `duplas-lista.tsx:1666`. Páginas: `template.tsx` dos dois grupos (`.animate-enter` por navegação). `/assinar/[token]` e `/demo` usam `.animate-rise` em entrada única.

### D — Chrome de overlay (kit `src/components/ui/`)

`dialog.tsx:59,:108` — backdrop fade + popup `fade-in-0 zoom-in-95 slide-in-from-bottom-2` (150ms). `sheet.tsx:53-57,:82-90` — `slide-in/out-from-{left,right,bottom}` (200ms) + `will-change-transform` just-in-time. Tudo via `data-open`/`data-closed` do Base UI + `tw-animate-css` — **CSS, não motion/react**. Decisão a preservar: motion/react mora no conteúdo, CSS no chrome.

## 3. Diagnóstico e princípios

### Taxonomia — o que anima neste app

| Camada | Função | Vocabulário alvo | Duração |
|---|---|---|---|
| **Navegação** | orientação espacial entre etapas (fwd=vem da direita, back=da esquerda, LTR) | `.animate-enter-x`+`--dir` (ou `StepTransition`) | 200–260ms |
| **Troca de estado** | form→sucesso/erro, fases de um mesmo painel | `FadeTroca` (AP `mode="wait"`+`fade`+`T.enter`) | ~180ms |
| **Entrada/saída de overlay** | dialog, sheet, popover | `data-open/closed` + tw-animate-css (CSS, já ok) | 150–200ms |
| **Feedback** | press (`scale .96` em `button.tsx:12`), loading (`animate-spin`), `flash-ok`, `ping-once` | CSS existente | 100–200ms |
| **Entrada de lista** | itens/stagger `--i` | `.animate-enter` (180ms+35ms/item) | ≤300ms total |
| **Delight pontual** | `fab-chega`, `badge-*`, `confirm-pop/draw`, `ia-*`, `roda-abre` | keyframes nomeados | sob medida |

**O que NÃO anima:** filtros/ordenação de listas já usam re-key+`.animate-enter` (convenção); tooltips; estados de hover em cor (já em `transition-colors`); nada com `width`/`height`/`max-width`/`top`/`left` via transition CSS; nada com `transition-all`; nada que retrabalhe layout por frame.

### Regras a codificar no sistema (hoje dispersas em comentários)

1. **Duração/easing:** troca de etapa 200–260ms (o `enter-x` atual, 200ms, está certo; o `rise` de 500ms do onboarding é o outlier — ler como conversa ou reduzir). Curva `--ease-snappy` = `EASE` = `cubic-bezier(0.2,0,0,1)` (ease-out, entrada rápida sem overshoot). Saída mais curta que a entrada (`fade.exit` já usa `T.micro`).
2. **Direção:** `irPara(proxima)` seta `direcao = proxima > etapa ? 1 : -1` → `--dir: ${direcao*8}px`. Forward entra da direita (+8px), back da esquerda (−8px). Deslocamento pequeno de propósito: viagem longa lê como "o template andou" e custa repaint em tela fraca.
3. **Etapas sempre montadas (`hidden`), nunca remontar:** preserva `FormData`/digitação/rascunho — requisito do `/f/[token]` (realiza-144 §3) e do `WizardFicha` (salvar de qualquer etapa). `hidden` já tira os inativos da ordem de tab. `AnimatePresence`+remount está **proibido** dentro de form multi-etapa.
4. **Foco segue o conteúdo:** `focoPendente` ref → `useEffect` pós-commit → `tituloRef.focus()` no `tabIndex={-1}` do heading da etapa (o botão Voltar/Avançar segue montado; sem isso o foco ficaria num controle que não anuncia a página nova). Validação que força navegação reporta `reportValidity()` **depois** do passo ficar visível (`invalidoPendente` — reportValidity em `hidden` falha calado).
5. **Reduced motion é global, nunca local:** o guard em `globals.css:865` zera CSS; `MotionConfig reducedMotion="user"` (`layout.tsx:97`) torna transform/layout do motion instantâneos (fades ficam — tier correto). **Não adicionar media query por componente** (regra já escrita em conventions-ui.md:42). Para JS fora do motion (`useReducedMotion` já existe em `registros-painel.tsx:109`, `use-olhar.ts:44`, `chamado-detalhe.tsx:699`, `login-form.tsx:899`, `numero-vivo.tsx:25`).
6. **Só transform/opacity por frame:** a lição do `enter-flat`/`exit-flat` (`globals.css:388-397`) — keyframe com `filter: blur()` forçava re-raster por frame no mobile (a sheet da Liza redesenhava o shadow-modal inteiro). Sem blur, sem `transition-all`, sem animar width/height/max-width/top/left; barra de progresso preenche por `scaleX` (padrão `.fill-grow`), não `transition-[width]`.
7. **Teclado:** Enter em input avança etapa (não submete) — `WizardFicha.onEnterKey` :657-672, `registro-form` :607-609. Voltar nunca valida nem perde dados (realiza-144 §4). Em dialog, voltar do browser fecha o modal (`use-fechar-no-voltar`) — não navega etapa; documentar para não confundir com "Voltar uma etapa".
8. **Mobile:** 8px/opacity é o teto de deslocamento; nada de spring com bounce em superfície de form; `min-height` da etapa não pode pular o footer — a troca pode mudar a altura do documento (inevitável, iniciado pelo usuário → fora do score de CLS), mas o footer/header sticky seguem ancorados.

### Pontos "toscos" a corrigir na mesma onda (baratos)

- `transition-all` em progressbar: `onboarding-flow.tsx:1110`, `onboarding-jovem.tsx:488`, `roda-svg.tsx:192` — o próprio `button.tsx:10` documenta por que evita `transition-all`.
- `transition-[width]` em progressbar anima layout por frame: `formulario-publico.tsx:617`, `instrumentos/flow.tsx:125` → trocar por `scaleX` (`.fill-grow` cobre primeira pintura; para updates contínuos usar `transform: scaleX(var(--p))` + `transition-transform`, origem esquerda).
- `transition-[max-width]` animando layout: `onboarding-flow.tsx:1130` (alarga o wizard no passo 2), `onboarding-jovem.tsx:512`, `formulario-preview.tsx:104`.
- Duas técnicas de `height` coexistindo: motion `height:0→"auto"` ×~7 (`motion.tsx:59-71`, `registro-inline.tsx:178`, `assistente-cards.tsx:1452`, `login-form.tsx:709`, `metas.tsx:373`, `pdm.tsx:431`, `submetas-editor.tsx:101`) vs Base UI Collapsible `transition-[height]` ×2 (`encontro-disclosure.tsx:64`, `fila-espera.tsx:528`, `importar-registros-dialog.tsx:660`). Manter a do Base UI onde já é `Collapsible`; motion só onde não é.
- `ref={(el)=>el?.focus()}` reescrito nos importadores (`importar-csv-dialog.tsx:294,:317,:398`, `importar-registros-dialog.tsx:557,:582`) — mesma função do `focoPendente`, técnica diferente (ref callback roda no mount do painel novo; funciona porque lá cada fase remonta).

## 4. Proposta de sistema

Nada de lib nova nem de AnimatePresence no caminho de etapas. Três peças no kit, extraindo o que já funciona:

```tsx
// src/lib/use-troca-de-etapa.ts — o mecanismo do registro-form/WizardFicha
// virado hook: estado etapa+direção+foco em um lugar só.
const { etapa, direcao, irPara, tituloEtapaRef, marcarFocoPendente } =
  useTrocaDeEtapa(passos.length);
// irPara(n): seta direcao (n>etapa?1:-1), marca foco pendente, setEtapa(n).
// O efeito interno foca tituloEtapaRef depois do commit (mesmo contrato
// focoPendente → post-commit de hoje).
```

```tsx
// src/components/ui/etapa.tsx — o painel montado/oculto direcional.
// (nome a bater com o kit; wrappers finos são a convenção — fade-x.tsx, exit-item)
<div hidden={!ativa} className="animate-enter-x" style={{ "--dir": `${dir*8}px` }}>
  {children}
</div>
// Ou como prop em <WizardPassos>: <Etapa ativa={i===etapa} dir={direcao}>
```

```tsx
// src/components/ui/fade-troca.tsx — o "form↔resultado" que hoje se repete 10×.
<AnimatePresence mode="wait" initial={false}>
  {enviado ? <motion.div key="ok" {...fade} transition={T.enter} ref={focoAlvo}/> : <motion.div key="form" {...fade} transition={T.enter}/>}
</AnimatePresence>
// + prop focoAlvo: dispara focus() no painel entrante — cobre os 4
// enviar-* que hoje deixam o foco órfão.
```

E nos wizards, um `WizardPassos` (evolução do `WizardFicha`, que vira consumer): stepper + `useTrocaDeEtapa` + `Etapa` + footer Voltar/Avançar/Salvar — a API `passos[] {titulo, icone, conteudo}` já está provada nos 4 dialogs de pessoa.

**Decisão explícita sobre os onboards:** duas opções honestas — (a) o balão de conversa ganha direção também (slide ±8px) e `animate-rise` morre como transição de etapa; (b) onboarding é conversa, não seção de form: mantém `rise`, que passa a ter variante `--dir` (sobe da direita/esquerda) para ainda informar fwd/back. A recomendação é (a) por consistência de "um jeito de trocar etapa", mantendo a entrada da Liza dentro do passo; (b) é o fallback se design quiser preservar a metáfora.

**Divisão CSS×motion mantida:** chrome de overlay (Dialog/Sheet) segue `data-open/closed`+tw-animate-css; troca de etapa segue CSS (`enter-x`/`--dir`); motion/react só onde já está (state swaps, height:"auto", shared-element `layoutId`). `MotionConfig`+guard cobrem os dois lados — requisito de qualquer técnica nova.

## 5. Plano de adoção priorizado

**P0 — o sistema + os wizards de etapas numeradas** (o pedido explícito: "slide entre etapas"):

1. `use-troca-de-etapa` + `<Etapa>`/`<FadeTroca>` no kit; `registro-form.tsx` e `WizardFicha` migram pro hook (prova o sistema sem mudança visual — já são o padrão).
2. `combinar-plano.tsx` (2–5 passos em dialog, mentor+jovem, **zero animação hoje**): passos viram `<Etapa>` direcional + foco já existe → ganha slide+foco consistente.
3. `formulario-publico.tsx` wizard: troca o `animate={opacity,y}` por `enter-x`+`--dir` (adiciona `direcao` — o `irPara` equivalente mora em :473/:806); mantém seções montadas (invariante realiza-144).
4. `onboarding-flow.tsx` + `onboarding-jovem.tsx`: `key={step}`+`animate-rise` → `<Etapa>` direcional (ou variante `--dir` do rise — decisão §4). Cuidado: lá cada passo remonta de propósito (FormData é montado por passo, comentário :247) — o componente novo tem que aceitar o modo remount ou o onboarding mantém `key`+classe.

**P1 — flows/fases sem animação:**

5. `cronograma-builder.tsx` + `nova-turma-flow.tsx` (config→previa, montar→importar→revisar).
6. `importar-csv-dialog.tsx`, `importar-registros-dialog.tsx` (entrada→prévia→resultado; foco já existe via ref callback — alinhar com o hook).
7. `FadeTroca` nos pontos fora do padrão: `novo-link-dialog.tsx`, `avaliar-token-flow.tsx`, `registro-form` pós-save :815, `fila-espera.tsx` modo, `jovem-agendar-sugestao.tsx`; + `focoAlvo` nos 4 `enviar-*`/`formulario-links` (foco órfão).
8. `pedir-especialista-dialog.tsx`: disclosure progressivo → entrada em cascata da seção nova (`.animate-enter`), não slide de etapa — é revelação, não navegação.

**P2 — polimento e casos especiais:**

9. Barras de progresso: `transition-all`→explícito (`onboarding-flow:1110`, `onboarding-jovem:488`, `roda-svg:192`); `transition-[width]`→`scaleX` (`formulario-publico:617`, `instrumentos/flow:125`, e os mesmos `style width` dos onboards).
10. `transition-[max-width]` (`onboarding-flow:1130`, `onboarding-jovem:512`, `formulario-preview:104`) — aceitar como tween deliberado ou remover.
11. `roda-vida.tsx` eixo (fade curto entre eixos), `adocao-explorador.tsx`, `resumo-senha-form.tsx` (reload → FadeTroca), `tokens-mcp.tsx:246`, `chamado-detalhe.tsx` modo interno/publico.

## 6. Critérios de aceite e testes

- **Unificação mensurável:** grep por `hidden={`+`animate-enter-x`/`animate-rise`/`key={step}` fora do kit = só `ui/etapa.tsx` e os wrappers; as 4 superfícies P0 renderizam via componente compartilhado.
- **Direção:** avançar entra pela direita, voltar pela esquerda, em toda superfície P0 (checagem visual + assert de `--dir` no e2e via `getComputedStyle` ou screenshot).
- **60fps / sem layout por frame:** só `transform`/`opacity`/`background-color` animam; DevTools Performance sem banda Layout/Paint durante a troca; zero `transition-all`/`transition-[width]`/`transition-[max-width]` novos (guardar via eslint ou revisão).
- **Sem CLS de terceiros:** a troca é iniciada por input (fora do score CLS), sem adicional shift — header/footer sticky não pulam (screenshot antes/durante/depois).
- **`prefers-reduced-motion`:** troca vira mudança instantânea de estado (CSS guard) / fade curto (MotionConfig); e2e `playwright --reduced-motion=reduce` ou context `reducedMotion: 'reduce'` validando que a etapa troca e o foco chega.
- **Foco/teclado (sem regressão):** foco no heading da etapa nova (`tabIndex=-1`, `outline-none`, `:focus-visible` não aparece); `aria-current="step"` no stepper; Enter avança; Voltar preserva valores (já testado em realiza-144 para o público — estender o caso aos demais).
- **Dados:** payload de submit byte-a-byte igual (etapas montadas — teste já previsto em realiza-144 §Testes; repetir o "paridade de payload" nas superfícies P0 com FormData).
- **e2e por superfície** (`docs/convencoes/ci-e2e.md`): troca de etapa com valores preservados, erro inline não troca de seção, foco visível na etapa nova, `axe` sem violação nova.
- **Gates do repo:** `pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard`.

## 7. Riscos

- **a11y — foco órfão já existe** nos `enviar-*`/`novo-link`/`importar-*`: animar sem embutir o foco no componente é cosmético — o sistema precisa entregar `focoPendente`+`tituloRef` como parte da API, não como exercício por superfície.
- **a11y — `aria-live` vs foco:** as superfícies usam foco-no-heading (correto); não adicionar `aria-live` duplicado que narra duas vezes. `aria-current="step"` já existe nos steppers.
- **Performance — repaint móvel:** a lição do blur no `enter-flat` (`globals.css:388-397`) e o `will-change-transform` just-in-time do `sheet.tsx:87-90` mostram que o app roda em tela fraca; manter deslocamento ≤8px + opacity, springs com `bounce:0` (`T.pill` já documenta).
- **Escopo/spec:** toca >15 superfícies e 2 padrões de kit → pelo AGENTS.md entra no fluxo `/speckit-specify → … → implement`; sugerir spec própria (`motion-forms`) ou fatiar dentro de issues já filadas (realiza-144 já cobriu o `/f`).
- **Perda de personalidade:** `animate-rise` é a metáfora de conversa dos onboards (balão que sobe); trocar por slide horizontal empobrece. Opção (b) do §4 preserva. Decidir com design antes de implementar.
- **Remount acidental:** o erro clássico seria "padronizar" tudo para `AnimatePresence`+`key` — quebra `FormData`, rascunho e "salvar de qualquer etapa". A restrição "etapas montadas com `hidden`" é inegociável e deve estar escrita no componente.
- **Dois sistemas convivendo por design:** CSS no chrome + motion no conteúdo + Collapsible com height própria — resistir à tentação de unificar; documentar a fronteira no componente (motion.tsx já faz isso: "shared-element, exit e height:auto moram aqui; hover, enter-stagger e dialogs seguem em CSS").
- **StrictMode/SSR:** `ref callback` focus (importar) vs `focoPendente` (wizards) — escolher um no hook; `useMedida`/`useFadeX` mostram o padrão de ref callback do repo. `MotionConfig` no root já evita hydration mismatch.
- **`useFecharNoVoltar`:** botão/gesto voltar do sistema fecha o dialog inteiro em vez de voltar uma etapa — avaliar se wizard dentro de dialog merece interceptar o voltar (hoje não intercepta; documentar comportamento esperado).

---

**Skills usadas neste recon:** `animation-principles`, `micro-interaction`, `ui-animation`, `accessible-animation`, `60fps-animation`, `antislop`, `antislop-ui`, `frontend-ui-engineering`, `ui-ux-pro-max`. (`animate` não existe como skill; as equivalentes cobriram o escopo.)
