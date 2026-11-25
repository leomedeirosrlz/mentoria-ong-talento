# Recon — Materiais: primeiro card do jovem, thumbs por título, seções colapsáveis e densidade do alternador (25/11)

**Head:** `10ebd056` (branch `recon/materiais-1125`, base `integration/plano2`) · **Fonte:** `docs/planos/feedback-thiago-2026-11-25.md` §4 · **Status:** recon concluído; próximo passo é spec (toca jovem + staff + mentor — mais de uma superfície, fluxo `/speckit-*` se aplica; a 029 já entregue não se reescreve, A10 — a spec nova referencia).

> Este arquivo é diagnóstico. Não implementa.

## 1. Resumo executivo

Os quatro pontos do feedback caem em cima da mesma fatia: a biblioteca recém-unificada pela spec 029 (`biblioteca-view-toggle.tsx` + `material-card.tsx` + `Linha`/`BibliotecaLista` compartilhados) e o topo da `/jovem/materiais`.

- **"Primeiro card ocupa espaço demais"** não é um card só: são **dois cards empilhados dizendo a mesma coisa** — o hero (`h1` + meta + badge + `text-3xl` + barra + "Próxima parada", ~200–240px em 390px) seguido de `MarcosACaminho` ("Próximo marco", ~150px). Somando o chrome sticky (header 56px + sub-nav 44px) e o título de seção, o primeiro conteúdo real (card da estante) começa a ~500–560px de scroll num viewport de 844px. Causa raiz: duplicação de superfície "o que vem a seguir", não padding isolado.
- **"Thumbs baseadas no título"**: hoje a capa do card é a tríade doc → faixa genérica "documento"; PDF → iframe da 1ª página; imagem → `<img>`; link → faixa de domínio (`material-card.tsx:108-124`). No celular do jovem o iframe quase nunca pinta (`pdfViewerEnabled` é false em Android/iOS — `material-preview-pdf.tsx:15-21`), e onde pinta, 96px de recorte da capa é ilegível. O repo já tem a gramática de capa pedida: `.capa-doc` (ink + glow lime, `globals.css:1029`) dos `DocumentoHero` e os tokens `--inst-*`/`instrumentoVars` para docs que são instrumentos.
- **"Seções colapsáveis"**: as seções nomeadas no feedback ("Conteúdos e roteiros", "Modelos", "Guias") são as `CATEGORIAS` fixas de `biblioteca-lista.tsx:46-51` — sempre abertas, tanto no staff quanto no mentor (que herda o componente). No jovem, `materiais-jovem-lista.tsx:117-155` tem grupos dinâmicos (Guias, Encontro N, Modelos, Conteúdos, Links) também sempre abertos; o "Mais adiante" já é `<details>` fechado — o precedente vive no próprio arquivo.
- **Densidade do alternador**: o toggle são duas pills `filterChipCls` com ícone + label (~190px de régua). No header do Acervo cabe, mas aperta; no staff divide a linha com a busca e a encolhe para ~150px em 390px.

A 029 está entregue e testada (unit `tests/biblioteca-views.test.tsx` + e2e `tests/e2e/demo/biblioteca-views.spec.ts`). O que resta é a rodada de densidade/mobile descrita aqui + duas decisões de produto (fusão do topo e destino do preview de PDF).

## 2. Item a item — evidência, causa raiz, opções

### 2.1 Primeiro card do jovem ocupa espaço demais no mobile

**Evidência** — `src/app/(jovem)/jovem/materiais/page.tsx`, render com dupla + cronograma:

1. Hero `Card` :395-467 — `CardContent space-y-4 pt-5` com 3 camadas: linha `flex justify-between` (esq.: `h1` `text-2xl` "Materiais" + meta turma/encontro + `Badge` "Fase · X"; dir.: número `text-3xl` "N/N" + "entregas feitas"), barra `h-2.5`, e o bloco "Próxima parada" com `border-t pt-3` (ou o estado "completou tudo").
2. `MarcosACaminho` :473 — `section rounded-xl p-5 sm:p-6` (`marcos-a-caminho.tsx:18-33`): `h2` "Próximo marco" + link "Ver conquistas" + emblema 40px + título + linha + barra `max-w-56` — a segunda superfície "o que vem a seguir".
3. Sub-nav sticky :476-492 (`min-h-11` por pill, `sticky top-14`) e o header de "Meus instrumentos" :508-516.

**Causa raiz:** redundância de topo, não um card inchado. O hero já foi enxuto uma vez (comentário :394 "hero slim (anti-extensão mobile): um card só"), mas ficou em cima de outro card que repete a função: "Próxima parada: <estação>" (`resumo.proxima`, :436-450) e "Próximo marco: <ação>" (`conq.marcos`, `marcos-a-caminho.tsx:34-69`) respondem à mesma pergunta do usuário. Orçamento em 390×844: hero ~200–240px + marcos ~150px + chrome ~100px + título de seção ~60px ≈ **meio viewport e dois gestos de scroll antes do primeiro instrumento**.

Detalhe que agrava: `InstrumentoCard` no mobile vira linha com lombada `w-14` + estado + a tira "Ler o guia" `min-h-11` (:769-851) — cada card da estante soma ~120–160px. Não é o alvo do feedback, mas compõe a densidade da página.

**Opções:**

| Opção | O quê | Prós | Contras |
|---|---|---|---|
| **A — comprimir o hero** | h1 + contagem numa linha só; badge "Fase" entra na meta; barra afina (`h-1.5`); "Próxima parada" vira linha única de rodapé | Menor risco; mantém anatomia e marcos como estão | Não mata a redundância — seguem dois "próximos" |
| **B — fundir hero + marcos num card só** | "Materiais · encontro X de 16 · N/N entregas" + uma linha de próximo passo (estação *ou* marco) + barra fina; "Ver conquistas" fica na linha | Realiza o "um card só" do próprio comentário; corta ~150px | `MarcosACaminho` também renderiza sozinho nos fallbacks sem hero (:161, :194) — a fusão precisa manter o standalone ou extrair a linha |
| **C — hero vira header, sem card** | `PageHeader`-style + meta com progresso inline; `MarcosACaminho` segue | Mais leve visualmente; header não compete com conteúdo | Perde o "produto" do progresso; dois componentes seguem |

Recomendação para a spec decidir entre **A** (passo seguro) e **B** (corte real — remove a redundância estrutural). **C** é o fallback se nem hero nem marcos sobreviverem a revisão de hierarquia.

### 2.2 Thumbs da view em cartões baseadas no título

**Evidência** — tríade da capa em `material-card.tsx:108-124`:

- `doc:<slug>` → faixa cinza com `FileText` + "documento" — genérica, ignora que `sistemaDoDoc()` mapeia o slug a um instrumento com cor própria (`--inst-*`, `instrumento-icone.tsx:92-95`).
- `m.path` PDF → `ThumbPdf` (`material-thumb.tsx:32-65`): iframe `/api/material/[id]#page=1&view=FitH`, `h-24`, largura +16px para esconder o trilho de scroll, lazy por IntersectionObserver, ícone atrás como placeholder/fallback.
- `m.path` imagem → `<img>` `object-top` (preview real, barato).
- `url` → `PreviewLink` (domínio, `material-preview-pdf.tsx:148-179`); sem destino → faixa com ícone do tipo.

**Causa raiz do incômodo:** a thumb "de verdade" depende do viewer de PDF do browser. `usePdfEmbute` (`material-preview-pdf.tsx:15-21`) devolve `pdfViewerEnabled` — **false no Android/iOS**, ou seja, no celular do jovem a capa é quase sempre o ícone-faixa; no desktop, o recorte de 96px da 1ª página é ilegível e custa um iframe + fetch de PDF por card. O feedback pede capa derivada do **título** — que é determinística, zero rede e legível.

Nota: `PreviewMaterial`/`PreviewPdf` (`h-36`) hoje são exports sem consumidor — só `MaterialThumb`/`ThumbPdf`/`PreviewLink` e os hooks compartilhados são usados (grep em `src/`). A família `material-preview-pdf` pode encolher junto.

**Recursos já existentes para a capa tipográfica:**

- `.capa-doc` (`globals.css:1029`) — painel ink + glow lime, a gramática do `DocumentoHero` (`material-documento.tsx:44-80`): kicker caps + título + barra de acento. A capa de card é essa peça miniaturizada.
- `sistemaDoDoc(slug)` → `instrumentoVars(sistema)` → `--ic`/`--ict`: material `doc:` de instrumento ganha a cor do instrumento (mesma lógica do selo "instrumento oficial" da `Linha`, `biblioteca-lista.tsx:94-103`).
- Tokens `--inst-*` nos dois temas (`globals.css:145-175` / `:278-296`); `PreviewLink` já ensina o padrão "kicker de domínio".

**Opções:**

| Opção | O quê | Prós | Contras |
|---|---|---|---|
| **A — capa tipográfica substitui o iframe** | `CapaMaterial`: mini capa-doc (ou tinta por tipo/instrumento) com kicker (tipo/domínio/inst.) + título `line-clamp-2`; imagem segue `<img>` real; sem destino segue ícone | Zero iframe/fetch; funciona em todo browser; uma gramática só de capa; mata o caso Android à raiz | Staff perde o preview real do PDF (SC-002 da 029) — decisão de produto |
| **B — capa de título + PDF como enhancement** | Capa tipográfica é a base; iframe pinta por cima onde `pdfViewerEnabled` | Mantém preview real onde possível; fallback digno virou o desenho padrão | Custo de rede/perf segue; duas camadas pra manter |
| **C — capa por tipo/instrumento sem kicker textual** | Tinta `--inst-*` (doc: de instrumento) ou uma paleta por `tipo` + glifo grande + título | Mais "estante", combina com `InstrumentoCard` | Precisa tokens/paleta novos por tipo; menos informação textual que A |

O texto do feedback ("baseadas no título") aponta para **A**, com **B** disponível se o preview real do staff for defendido. A capa resolve também a faixa genérica de `doc:` e a de domínio de `url` (kicker = "documento"/host/inst.) — a tríade vira uma peça só.

### 2.3 Seções "Conteúdos e roteiros" / "Modelos" / "Guias" colapsáveis

**Evidência:**

- Staff/coord e mentor: `biblioteca-lista.tsx:374-448` — `CATEGORIAS` fixas (:46-51) renderizam `<section aria-labelledby>` + `h3` + `ContagemTitulo`, **sempre abertas**, dentro do wrapper re-key `key={`${qt}:${view}`}` (:373).
- Jovem: `materiais-jovem-lista.tsx:117-155` — grupos dinâmicos `agrupar()` (:38-56: Guias, Encontro N, Modelos, Conteúdos, Links) idem, re-key `key={`${rotulo}:${view}`}` (:123). "A caminho" aberto (:156-192); **"Mais adiante na jornada" já é `<details>` fechado** (:193-263) — o precedente visual vive no próprio arquivo.
- Mentor: herda `BibliotecaLista` (`materiais-mentor-biblioteca.tsx:298-302`) — as mesmas seções, mesma mudança.

**Idiomas disponíveis no repo (não inventar terceiro):**

1. `<details>`/`<summary>` nativo — o que o acervo do jovem já usa: `summary` com layout flex, `h3` dentro (permitido), `CaretDown` que gira via `group-open:rotate-180`, sem animação de altura e sem JS.
2. `Collapsible` do Base UI — o que `encontro-disclosure.tsx:112-126` usa: `Trigger` (button, `aria-expanded` automático) + `Panel` com `h-[var(--collapsible-panel-height)]` + `transition-[height] duration-150` — a única `transition-[height]` sancionada em `conventions-ui.md:52`, e dá suporte a `hidden="until-found"` (find-in-page revela conteúdo fechado).

Com o pedido transversal "animações em todos os forms/superfícies" (feedback §7) e a gramática já codificada, **Collapsible é a escolha recomendada**; `<details>` fica como opção zero-JS se a animação de altura for dispensada.

**Armadilhas mapeadas (todas reais, não teóricas):**

- **Re-key destrói estado não-controlado.** Tanto `key={`${qt}:${view}`}` (staff) quanto `key={`${rotulo}:${view}`}` (jovem) remontam as seções a cada tecla da busca e a cada troca de view — `Collapsible.Root` não-controlado dentro da subárvore **perde o estado aberto/fechado a cada keystroke**. O estado precisa morar fora do subárvore keyed (controlado no componente pai, ou persistido) — ou a re-key sai dos grupos e vai para a lista interna.
- **Busca × seção fechada:** hits dentro de seções colapsadas ficam invisíveis. Opções: auto-abrir todas enquanto `qt` não-vazio; ou contagem de matches no trigger fechado ("Modelos · 3 resultados"); ou achatar para uma lista única durante a busca (muda mais o layout).
- **Estado inicial:** abertas (status quo + affordance), só a primeira aberta, ou fechadas por default no mobile — decisão de produto. Persistir por seção em `localStorage` é possível (mesmo padrão do view-pref) mas provavelmente overkill; avaliar.
- **A11y:** trigger dentro do `h3`/`aria-labelledby` para a região continuar nomeada; `aria-expanded` vem de graça no `Collapsible.Trigger`; caret decorativo `aria-hidden`; contagem segue o padrão `ContagemTitulo` (dígito `aria-hidden` + sr-only "N itens", `biblioteca-lista.tsx:63-70`) — hoje o jovem não mostra contagem nos grupos, e o resumo colapsado se beneficia dela.
- **Conteúdo fechado e find-in-page:** o padrão `[hidden]:not([hidden='until-found'])` do `encontro-disclosure` permite revelação por busca do browser — manter.

### 2.4 Densidade do alternador Cartões/Lista

**Evidência** — `biblioteca-view-toggle.tsx:107-134`: dois `button` com `filterChipCls` (`filter-chip.tsx:8-14`): `min-h-11` mobile (`sm:min-h-8`), `px-3`, ícone 15 + gap-1.5 + label. Cada pill ≈ 90–95px → régua ~190px.

Posições hoje:

- Jovem, header do Acervo `flex items-start justify-between` (`page.tsx:618-636`) — título "Acervo" + subtítulo à esquerda, toggle à direita; cabe em 390px mas aperta a linha.
- Jovem fallback `BibliotecaJovem` (:942-950) — mesmo arranjo.
- Staff `BibliotecaLista` (:345-364) — o grupo `flex w-full` joga toggle + busca para a linha própria no mobile; a busca `flex-1` fica com ~150px de largura útil em 390px.

**Causa raiz:** duas pills completas com label é o idioma certo de toggle (`filter-chip` é o padrão "um idioma só"), mas o rótulo duplicado é o que custa largura — os ícones `SquaresFour`/`List` já carregam a semântica.

**Opções:**

| Opção | O quê | Prós | Contras |
|---|---|---|---|
| **A — variante icon-only <sm** | label some em `<sm`, fica `aria-label`/`sr-only`; mantém pill ativa escura | ~96px total; libera a busca; mesmo idioma visual | Descobribilidade menor do rótulo — mitigada por ícone autoexplicativo + status sr que anuncia o modo |
| **B — segmentado único** | um container border com 2 segmentos de ícone | Padrão denso canônico; sinaliza mutualidade | Idiom novo — quebra "um idioma só pra toggles de lista" |
| **C — encurtar sem sumir** | `px-2.5`, `text-[13px]`/icone only no inativo | Menor mudança | Economia modesta (~150px) |
| **D — realocar** | toggle entra na sub-nav sticky do jovem / linha própria no staff | Título da seção respira | Adiciona chrome; no jovem a sub-nav já é sticky com 2 links |

O teste e2e já trava `≥44px` por botão (`biblioteca-views.spec.ts:156-161`) — qualquer variante mantém isso de graça.

### 2.5 Estado da 029 e o que ajustar

**Entregue** (commits `eb6125e6` + merge `42f4172c`):

- `biblioteca-view-toggle.tsx`: `useViewBiblioteca(superficie)` — localStorage por superfície (`biblioteca:view:{jovem,staff}`), default por viewport (`matchMedia ≥768px`: mobile Lista; desktop jovem Cartões, staff Lista), `useSyncExternalStore` com snapshot SSR "list" (zero iframe no HTML de servidor); controle no idioma filterChip com `role="group"` + `aria-pressed` + `role="status"` anunciando modo + total.
- `material-card.tsx`: anatomia compartilhada (capa tríade + linha + `acoes` fora do `<a>` no chip `right-2 top-2` com backdrop; props `rastrear`/`lido`/`meta`/`marca`/`semDestino`/`acoesSempre`).
- `biblioteca-lista.tsx`: `Linha` exportada parametrizada (`docBase`/`menu`/`rastrear`/`lido`/`marca`); views cards/list por seção; re-key anima a troca.
- `materiais-jovem-lista.tsx`: acervo do jovem extraído com as duas views; grupos dinâmicos; "A caminho" e "Mais adiante".
- Testes: `tests/biblioteca-views.test.tsx` (defaults por viewport, persistência, preferência corrompida, lista sem iframe/img, ⋯ fora do link, "sem conteúdo" sem duplicar, busca na view cards, docBase do jovem, "Mais adiante" recolhido) + `tests/e2e/demo/biblioteca-views.spec.ts` (3 personas, persistência, 390px ≥44px) + `tests/materiais-anel.test.ts`.

**Gaps / fora da spec entregue:** FR-009 telemetria `biblioteca_view` — opcional, **não implementado**. Demais FRs cobertos.

**O que o feedback muda nas premissas da 029:**

- US2 pressupunha preview real de PDF no card — se a capa virar título (§2.2-A), SC-002 muda de sentido: o "preview" passa a ser a capa tipográfica.
- Seções colapsáveis interagem com o re-key por view/busca (§2.3) — a mudança tem que decidir onde mora o estado de collapse antes de mexer na anatomia das seções.
- Densidade do toggle (§2.4) é polimento direto da peça que a 029 criou.

## 3. Mapa de superfícies e componentes

| Superfície | Arquivo | Papel nesta frente |
|---|---|---|
| `/jovem/materiais` (com dupla) | `src/app/(jovem)/jovem/materiais/page.tsx` | hero :395-467 + `MarcosACaminho` :473 + sub-nav sticky :476 + estante `InstrumentoCard` :745-926 + `MateriaisLista` :637 |
| `/jovem/materiais` (fallback) | mesma página, `BibliotecaJovem` :933-954 | header + `MateriaisLista` — sem hero/estante |
| `/materiais` staff/coord | `src/app/(app)/materiais/page.tsx:385-394` | `PageHeader` + `MateriaisAbas` + `BibliotecaLista` (busca + 4 CATEGORIAS) |
| `/materiais` mentor/especialista | `src/components/materiais-mentor-biblioteca.tsx` | `CardSemana` + `BibliotecaLista` — herda seções/toggle |
| Card do material | `src/components/material-card.tsx` | capa tríade :108-124 + chip ⋯ :239-243 |
| Thumb/preview | `src/components/material-thumb.tsx`, `material-preview-pdf.tsx` | `ThumbPdf`, `usePdfEmbute`, `useMontarQuandoPerto`, `PreviewLink`; `PreviewMaterial`/`PreviewPdf` sem consumidor |
| Alternador | `src/components/biblioteca-view-toggle.tsx` + `ui/filter-chip.tsx` | hook + controle + idioma visual |
| Colapsável de referência | `src/components/encontro-disclosure.tsx:112-126`; `materiais-jovem-lista.tsx:193-263` | `Collapsible` Base UI × `<details>` nativo |
| Capa de referência | `src/app/globals.css:1029` (`.capa-doc`); `material-documento.tsx:44-80`; `instrumento-icone.tsx` | gramática de capa e tokens por instrumento |
| Testes | `tests/biblioteca-views.test.tsx`; `tests/e2e/demo/biblioteca-views.spec.ts`; `tests/materiais-anel.test.ts` | contrato da 029 a estender |

## 4. Decisões de produto pendentes

1. **Topo do jovem:** comprimir o hero (A) ou fundir hero + `MarcosACaminho` num card só (B)? Recomendo B — elimina a redundância real ("Próxima parada" × "Próximo marco").
2. **Thumb:** capa tipográfica substitui o iframe de PDF (A) ou o PDF vira enhancement por cima (B)? O texto do feedback sugere A; confirmar se o staff abre mão do preview real (SC-002 da 029).
3. **Colapsáveis:** estado inicial — todas abertas, primeira aberta, ou mobile fechado? Persistir por seção ou não? Comportamento na busca — recomendo auto-abrir com `qt` não-vazio.
4. **Toggle:** icon-only no mobile (A) vs labels encurtados (C) vs realocar (D)? Recomendo A.
5. **Escopo jovem:** os grupos dinâmicos "Encontro N" também viram colapsáveis, ou só as categorias transversais? E "A caminho" entra na régua?

## 5. Critérios de aceite e testes

- **Densidade do topo (390×844):** hero + `MarcosACaminho` juntos ≤ ~280px (de ~380–390 hoje); primeiro card da estante visível sem segundo gesto de scroll; nada some — progresso, fase e próximo passo seguem no topo.
- **Sem regressão de largura:** 320–390px sem scroll horizontal em nenhuma das três superfícies (e2e já cobre parcial — estender ao estado colapsado).
- **Thumbs:** view Cartões monta **zero** iframe de PDF em `pdfViewerEnabled=false` e também em `true` se a opção A vencer; capa com título legível (`line-clamp-2`) para `doc:`, PDF, link e sem destino; `doc:` de instrumento recebe a cor `--inst-*` do sistema; imagem real segue `<img>`; `aria-hidden` preservado (a capa é decorativa — o nome acessível vem do link).
- **Colapsáveis:** trigger é `button` nomeado com `aria-expanded`; altura anima via `Collapsible.Panel` (exceção documentada — nada de `transition-all`); região segue nomeada (`h3`+trigger ou `aria-labelledby`); busca com seção fechada revela o resultado (auto-open ou contagem); troca de view não zera estado indevidamente (ou o reset é decisão documentada); `hidden="until-found"` quando o idiom permitir.
- **Toggle:** alvos ≥44px; labels acessíveis preservados em qualquer variante; `role="status"` segue anunciando modo + total; preferência/persistência intactas (contrato da 029 se mantém).
- **Reduced motion:** tudo coberto pelo guard global + `MotionConfig` — nenhuma media query por componente nem `useReducedMotion` local (`conventions-ui.md:54`).
- **Unit (`biblioteca-views.test.tsx` + vizinhos):** matriz de capa por destino (doc:/pdf/img/link/sem destino); collapse × busca × troca de view (estado preservado ou reset documentado); contagens nas seções; `Linha` inalterada.
- **E2E (`tests/e2e/demo/biblioteca-views.spec.ts` + jovem):** colapsar/expandir seção nas três personas; busca revela item em seção fechada; toggle compacto em 390px; hero compacto em `/jovem/materiais`; screenshots 390×844 e 1440×900 anexados ao PR.
- **Gates do repo:** `pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard`; demo parity (A7) — toda mudança visual vale na demo.

## 6. Riscos

- **Re-key reseta collapse** (o maior risco técnico): `key={`${qt}:${view}`}` / `key={`${rotulo}:${view}`}` remontam as seções — estado de collapse precisa ser controlado fora da subárvore keyed ou a re-key desce um nível. Resolver isso errado regressa a busca.
- **Perda do preview real de PDF** (staff): se a capa tipográfica substituir o iframe, a promessa de SC-002 da 029 muda — precisa assinatura de produto, não de engenharia.
- **Busca esconde hits** em seções fechadas: sem auto-open/contagem, "buscar" parece não achar o que está colapsado.
- **Chip ⋯ sobre a capa tipográfica:** o `MaterialMenu`/`MaterialActions` flutua `right-2 top-2` (`material-card.tsx:240`) — com título na capa, pode cobrir texto; posição/contraste do chip entram no desenho da capa nova.
- **`localStorage` creep:** persistir collapse por seção multiplica chaves (`biblioteca:sec:*`); preferir estado de sessão salvo se produto insistir.
- **HTML inválido/a11y:** heading dentro de `button`/`summary` tem restrições de phrasing content — o padrão do acervo (`h3` dentro de `summary`, :206) e `Collapsible.Trigger render={<h3>}` ou heading com trigger dentro resolvem; cuidado para não quebrar `aria-labelledby` da `section`.
- **Altura da estante compõe a densidade:** a tira "Ler o guia" `min-h-11` por card (`page.tsx:842-851`) soma ~44px × N instrumentos — fora do recorte estrito do feedback, mas listar como ajuste adjacente se a página seguir alta.
- **Comentários doc×código:** a página e os componentes carregam contexto de decisão nos comentários (capa tríade, "um card só", "preview grande h-36") — qualquer mudança precisa atualizá-los na mesma PR (AGENTS.md: doc que contradiz código é corrigida junto).
