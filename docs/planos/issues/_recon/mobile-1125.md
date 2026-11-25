# Recon — Mobile do jovem: Pessoas, Especialistas e perfil (25/11)

**Head:** `10ebd056` (branch `recon/mobile-1125`, base `integration/plano2`) · **Fonte:** `docs/planos/feedback-thiago-2026-11-25.md` §2 e §7 + leitura do código (varredura estática — sem device; "não verificado" sinalizado onde a evidência é só probabilística) · **Status:** diagnóstico, não implementa.

> Pipeline: feedback → recon → spec → implementação → reviews → aprovação manual.
> Duas frentes de explorer (kit/overlay + árvore das páginas) rodaram em paralelo e foram consolidadas com leitura direta; file:line verificado no worktree. Nenhum ponto do escopo exige migration — é tudo composição de UI sobre dados que o client já recebe.

## 1. Resumo executivo

- **"Pills estouram a largura" não reproduz em análise estática** — `FilterChipRow` já é scrollport correto (`overflow-x-auto` + `flex-nowrap` + fade, `ui/filter-chip.tsx:22-44`). Mas a decisão de produto do feedback resolve a classe inteira: esconder tudo atrás de "Filtros". E o **modal rico já existe pronto**: `FiltrosButton` + Dialog com rascunho→"Aplicar (N)" + `OpcaoPilula`/`OpcaoCheck` (staff coord, `pessoas-listas.tsx:1775-1935`) e `FormSurface` (Dialog lg no desktop / Sheet de rodapé com footer sticky no mobile, `form-surface.tsx`) — a implementação é colar a gramática, não inventar.
- **Scroll horizontal: nenhum culpado estrutural incondicional** nas duas páginas. Os suspeitos são condicionais ao dado: texto livre sem `break-words` no card de sugestão (`jovem-sugestao-card.tsx:151-169`, único bloco não-`Card` da página), e-mail inteiro como rótulo de botão `nowrap`/`shrink-0` na ficha (`pessoas/[id]/page.tsx:346-356`, dentro de `section` sem clip — `Card` tem `overflow-hidden`, `section` não), e a ausência de guarda `overflow-x` no document (`globals.css:956-963`). Fix pontual + guarda global.
- **"Sua rede" sem colegas é uma linha de composição** (`perfil/page.tsx:286-288`) — mas cria divergência semântica com a faceta "Minha rede" do diretório, que marca colegas via `enriqueceDiretorio` (`lib/jovem-diretorio.ts:85-97`). Decisão de produto abaixo.
- **WhatsApp em Pessoas não precisa de view nova**: `jovem_contatos` já chega na página (`pessoas/page.tsx:29`) e é cruzada no client — enriquecer `DiretorioPessoa` com wa/email do contato casado expõe zero dado novo (a view de rede já é a fronteira; colega segue atrás do opt-in).
- **Self-view já usa a gramática da ficha pública** (mesmo `PessoaBanner` + avatar sobre o banner + `Linha`/`ChipsTags`). O que destoa: o selo de nível com chrome de card (`selo-nivel.tsx:40`), a estante de conquistas sem colapso (~600–900px de scroll) e a fila de seções de edição. A arte das peças é frente autoral do Claude (feedback §1) — aqui o escopo é container/hierarquia.
- **Alvos de toque**: o kit garante `h-11`/`size-11`/`min-h-11` no mobile em quase tudo; **3 alvos sub-44px achados**: "Limpar filtros" `h-9` (`jovem-diretorio.tsx:213` e o mesmo padrão em `pessoas-listas.tsx:1195`, staff) e o toggle "Ver sua avaliação" `min-h-8` (`jovem-avaliacoes.tsx:168`).

## 2. Mapa das superfícies

### 2.1 `/jovem/pessoas` — diretório (`pessoas/page.tsx` + `components/jovem-diretorio.tsx`)

- Página server: busca `getJovemDiretorio` + `getJovemContatos` + `getJovemColegas` + `getJovemDuplas` (`page.tsx:24-32`) e entrega `enriqueceDiretorio(...)` ao client (`:57-68`). Sem ficha, cai no empty-state (`:36-54`).
- `JovemDiretorio` (client): busca fuzzy debounced 300ms + `role="search"` (`:180-195`), contagem `role="status" aria-live` (`:196-208`), "Limpar filtros" ghost `h-9` (`:209-218`), régua de pills de vínculo "Filtrar por vínculo" (`:223-239`, facetas de `lib/jovem-diretorio.ts:127-137`) e régua de chips de tema "Filtrar por tema" com contagens (`:243-273`, derivados do recorte `:124-136`). Estado na URL `?busca ?papel ?area` por `history.replaceState` (`:91-106`); re-key dos cards anima a troca de filtro (`:173-175`).
- Cards: grade `grid gap-4 sm:grid-cols-2` (`:305`). `tipo === "especialista"` → `EspecialistaCatalogoCard` (`:307-322`, anatomia rica com `href` prop); demais → `DiretorioCard` (`:324-433`) — link único nomeado + badge "Sua rede" + chips 4+N. **Nenhum card tem ação de contato** — decisão registrada em `:31-32` e `:338-341`.
- Ficha `/jovem/pessoas/[id]` (`pessoas/[id]/page.tsx`): `PessoaBanner` + avatar 80 sobre o banner + `Badge` de vínculo/`SeloDupla`/lugar (`:152-214`) e seções `rounded-xl bg-card p-6` com `dl`/`Linha`/`ChipsTags`: `SecaoEspecialista` (`:441-498`), `SecaoContato` (mailto + wa, `:334-376`), `SecaoColega` (`:380-432`), `SecaoDiretorio` (`:268-293`).

### 2.2 `/jovem/especialistas`

- Catálogo `CatalogoJovem` → grade 1-col <640 (`catalogo-jovem.tsx:103`); sugestão do mentor `jovem-sugestao-card.tsx`; trilhas `jovem-trilha-card.tsx` (stepper vertical <640, `jovem-trilha-stepper.tsx:80`); pedidos `jovem-pedido-item.tsx` + mesa `solicitacao-negociacao.tsx` (chips `min-w-14 min-h-11`, `:226-286`); pedir via `PedirEspecialistaPainel`/dialog.
- Varredura completa do explorer: todo texto está em `Card` (`overflow-hidden` embutido, `ui/card.tsx:14`), toda fileira tem `flex-wrap`, toda coluna de texto tem `min-w-0`/`truncate`, todo overlay é portal `fixed` — **exceto** o card de sugestão (§4.2).

### 2.3 `/jovem/perfil` — self view (`perfil/page.tsx` + `perfil-form.tsx` + `conquistas-card.tsx`)

- Header: `PessoaBanner` + `FotoPerfil` (avatar 80 + câmera `size-11`, `perfil-form.tsx:274-301`) + `SeloNivel` pill (`:194`, `selo-nivel.tsx`) + h1 + `Badge` papel + meta + bio (`:171-216`) — mesma anatomia da ficha pública, comentário explícito em `:167-170`.
- Coluna principal: `DadosSecao` (dl `Linha`/`ChipsTags` + `DialogoDados`, `perfil-form.tsx:164-199`), `DisponibilidadeCard`, `FichaSecao` (`<details>`, `:416-434`), "Sua rede" (`page.tsx:243-291`), `ConquistasCard` (`conquistas-card.tsx:393-478`), `JovemChamados`. Rail: `PrivacidadeCard` + `ContaSecao`.
- "Sua rede" (`page.tsx:243-291`): legenda "Mentor, especialista, equipe e os colegas da sua turma" (`:253`), `rede` adultos dedup por `agrupaContatosPorPessoa` (`:157-163`, `jovem-contatos.ts:19-39`) renderizada por `ContatoLinha` e `colegas` por `ColegaLinha` (`jovem-rede.tsx` — WA/e-mail diretos pra adultos, WA de colega atrás do opt-in com fallback "não compartilhou o contato").

### 2.4 Kit e precedentes de overlay

- `FilterChipRow`/`filterChipCls`: scrollport + chip `min-h-11 sm:min-h-8` (`ui/filter-chip.tsx`).
- `FiltrosButton`: funil + selo de ativos (`ui/filtros-button.tsx`).
- `OpcaoPilula`/`OpcaoCheck`/`OVERLINE`: radio/checkbox sr-only `min-h-11` dentro de label (`ui/filtro-opcoes.tsx:9-94`) — a gramática dos modais de filtro de `/pessoas` (coord) e `/registros`.
- `FormSurface` (`form-surface.tsx`): "superfície única por viewport" — Dialog `lg`+ no desktop, `Sheet` bottom `h-auto max-h-[85dvh]` + footer sticky no mobile. Convenção `conventions-ui.md:40` (form 3+ campos ou select 8+ itens).
- `DropdownMenu` ⋯ canônico: `dupla-linha-menu.tsx:123-174` (trigger `w-11`/“Ações” ≥md, content `w-56` `align="end"`, dialogs controlados fora do popup).
- `Collapsible` (`@base-ui/react/collapsible`): `jovem-para-fazer.tsx:131-147` (trigger `min-h-11` + Panel); `<details>`/`summary` `min-h-11`: `perfil-form.tsx:434`, `especialista-catalogo-card.tsx:121-141`.
- `Button`: todo size é `h-11`/`size-11` no mobile, compacto só ≥md (`ui/button.tsx:30-41`). `Badge`: `h-5 whitespace-nowrap shrink-0 overflow-hidden w-fit` (`ui/badge.tsx:8`) — sem cap de largura.

## 3. Achados por ponto

### Ponto 1 — Pills de filtro → entrada "Filtros" com modal rico (feedback §2)

**Achado:** a barra do diretório acumula busca + contagem + limpar + 6 pills de vínculo + N chips de tema — três réguas interativas numa tela de 390px. As pills rolam (scrollport correto), então "estouram a largura" provavelmente descreve a percepção de barra poluída ou um estado anterior ao 0239 — *não verificado em device*. De qualquer forma, o pedido é estrutural: nada de pills expostas.

**Causa raiz:** o diretório nasceu (023) com a gramática de pills de `/pessoas` staff — desenhada pro coordenador em desktop, não pro jovem em 390px. Não há agrupamento dos filtros num único controle.

**Opções:**

- **A. `FiltrosButton` + `FormSurface`** (recomendada): busca fica na barra (já é `role="search"`); ao lado, `FiltrosButton` com selo `N ativos` (`ui/filtros-button.tsx`). Dentro: fieldset "Vínculo" (`OpcaoPilula`, as 6 facetas de `FACETAS_DIRETORIO`) + fieldset "Tema" (`OpcaoCheck` multi — ou `OpcaoPilula` single mantendo a semântica atual, decisão menor abaixo) + footer `Limpar`/`Aplicar (N)` com rascunho — o molde exato de `pessoas-listas.tsx:1775-1935`. No mobile vira bottom sheet com footer sticky (gramática atual dos fluxos densos; a lista de temas passa fácil de 8 itens → `conventions-ui.md:40` empurra pra FormSurface).
- **B. `DialogContent size="md"` igual ao staff coord** — porte direto, mas no mobile abre modal central (fora da régua "superfície única por viewport" quando o conteúdo cresce) e o feedback pede "modal rico" com respiro.
- **C. Manter uma régua** (ex.: vínculo) e esconder só tema — parcialmente contra "não quero pills de categorias expostas"; fica como decisão (§8.6 do feedback).

**Recomendação:** A. Estado na URL já existe — `?papel`/`?area` passam a refletir o estado *aplicado*; `?busca` segue viva na barra. O `FilterChipRow` continua no kit (staff usa) — só sai daqui.

**Aceite:** barra = busca + `Filtros` (com selo de ativos) + "N de M" + `Limpar` quando filtrando; abrir → sheet no mobile / dialog no desktop com Vínculo e Tema; "Aplicar" fecha e filtra (URL reflete); "Limpar" zera o rascunho; `aria-pressed`→radio `checked`; deep-link `?papel=rede` abre com o recorte ativo. Chips/pills fora do modal: zero.

### Ponto 2 — `/jovem/especialistas` com scroll horizontal (feedback §2)

**Achado:** varredura completa sem culpado incondicional — toda a página está defendida (ver §2.2). Os suspeitos, por probabilidade:

1. **Texto livre sem quebra no card de sugestão** (`jovem-sugestao-card.tsx:163-169`): `{s.demanda}`/`{s.motivo}` são `<p>` sem `break-words`, dentro de root `div` com borda+p+`rounded` (`:151`) — **único bloco card-like da página que não é `Card`** (sem `overflow-hidden`). Uma demanda do mentor com URL ou token longo sem espaço propaga até o document. Condicional ao dado.
2. **Bottom nav com Liza** (`jovem-shell.tsx:252-299`): a faixa `pr-[max(4.25rem,...)]` deixa ~61px/célula em 390px; "Especialistas" a `text-[10px]` com `whitespace-nowrap` pode vazar a célula — **quebra visual, não scroll** (a nav é `fixed`), mas é candidata ao relato de "bugado".
3. **Sem guarda de documento**: `body`/`html` sem `overflow-x` (`globals.css:956-963`) — qualquer elemento em fluxo que estoure 1px vira scroll de página.
4. **Mesma classe na ficha** (`pessoas/[id]/page.tsx:344-356`): `mailto:{c.email}` com o e-mail inteiro como rótulo — `buttonVariants` é `whitespace-nowrap`+`shrink-0` (`ui/button.tsx:12`), dentro de `flex flex-wrap` dentro de `section` sem clip. E-mail longo → botão largo → scroll de página. `ChipsTags`/`Badge` com tag longa (interesse é texto livre) segue a mesma rota (`dd` é `min-w-0`+`overflow-wrap`, mas o `Badge` em si é `w-fit`+`nowrap`).

**Opções:**

- **A. Fix pontual** (recomendada): `break-words`/`[overflow-wrap:anywhere]` nos `<p>` de texto livre (`jovem-sugestao-card.tsx:163-169`, `recado` de `jovem-pedido-item.tsx:122`, devolutivas de `jovem-trilha-card.tsx:261,322,416` — estes dentro de Card, defesa em profundidade); rótulo do mailto vira "E-mail" com endereço em linha `Linha`/`truncate max-w` (`pessoas/[id]/page.tsx:346-356`); cap em `Badge`/`ChipsTags` (`max-w-full truncate` ou corte na origem).
- **B. Guarda `overflow-x: clip`** em `body` (`globals.css`) ou na coluna `main` do `jovem-shell` (`:236`) — cobre a classe inteira de regressão. `clip` não cria scrollport, então o `sticky` vertical do header/`materiais` segue (o header sticky `top-14` de materiais vive dentro de `main` — `overflow-x` não afeta o eixo vertical; validar no device).
- **C. Medir no device** (`scrollWidth` probe por elemento) antes de fixar — mais caro; reservar se A+B não zerar o scroll.

**Recomendação:** A+B — correção nos pontos livres + guarda global documentada. Se o scroll persistir sem nenhuma sugestão renderizada, o culpado está fora da árvore auditada → então C.

### Ponto 3 — `/jovem/pessoas` "quebrada" no mobile (feedback §2)

**Achado:** mesma conclusão — a grade é 1-col com `truncate`/`min-w-0`/`overflow-hidden` em tudo. A "quebra" percebida é a barra de filtros (Ponto 1) + possivelmente a ficha (mailto do Ponto 2.4) + o único alvo sub-44px da página (`h-9`, Ponto 7). Nenhuma ação estrutural separada: resolver Pontos 1, 2 e 7 resolve a página. *Não verificado em device — se restar scroll após os fixes, medir `scrollWidth`.*

### Ponto 4 — "Sua rede" sem colegas de turma (feedback §2)

**Achado:** `perfil/page.tsx:243-291` — o mesmo `<ul>` renderiza `rede` (adultos) e `colegas` (`:286-288`); legenda e empty-check contam com eles (`:253`, `:268`); `getJovemColegas` entra no `Promise.all` só pra isso (`:90`).

**Causa raiz:** herança da página `/jovem/pessoas` antiga — a seção (023) reaproveitou as duas fontes sem distinguir "rede de apoio" (adultos com vínculo) de "colegas" (pares). A faceta "Minha rede" do diretório (`jovem-diretorio.ts:85-97`) marca colega como rede pela `mentorados_turma` — semântica ampliada que pode divergir da seção.

**Opções:**

- **A. Cortar só do perfil** (literal do feedback): remove o `colegas.map` + ajusta legenda ("Mentor, especialista e a equipe que acompanha você"), empty-check e o fetch. A faceta "Minha rede" do diretório segue incluindo colegas (lente "quem você conhece").
- **B. Idem + semântica única**: "rede" vira "os adultos que te acompanham" nos dois lugares — `enriqueceDiretorio` deixa de marcar `ehColega`/`minha_rede` do braço jovem (mudança em `jovem-diretorio.ts:92`, sem SQL: a marca da view é sobrescrita no client) e colegas ficam só na faceta "Colegas". Coerente mas muda o significado da faceta.
- **C. Sub-seção "Colegas da turma"** separada dentro do perfil — devolve o que o feedback tira.

**Recomendação:** A — implementa o feedback sem redefinir a lente do diretório; a divergência semântica vai pra decisão de produto (§5). Onde o colega alcançável aparece depois: no card do diretório (faceta "Colegas" + o WA do Ponto 6 quando ele optou) e na ficha `/jovem/pessoas/[id]` — cobertura preservada.

### Ponto 5 — Self view do perfil ≈ perfil público (feedback §2)

**Achado:** a anatomia-base já é espelho da ficha (`perfil/page.tsx:171-216` × `[id]/page.tsx:152-214` — mesmo `PessoaBanner`, avatar `-mt-10` sobre a faixa, h1, badge+meta; `DadosSecao` já usa `Linha`/`ChipsTags` como `SecaoDiretorio`). O que destoa do "perfil de outras pessoas": (a) `SeloNivel` é uma **caixa** (`selo-nivel.tsx:40` — `border`+`bg-card`+`shadow`+`pl-2 pr-4`) — o print do feedback §1 aponta exatamente ela como "poluída"; (b) `ConquistasCard` ocupa a dobra inteira (Ponto 6); (c) a coluna empilha edição e leitura sem hierarquia editorial clara (dados → disponibilidade → ficha → rede → conquistas → pedidos).

**Opções:**

- **A. Aplicar a régua da ficha no chrome** (recomendada): selo vira peça minimalista — `ConquistaEmblema` + título/meta sem a caixa (o trigger continua abrindo `FaixaDetalhe`); conquistas colapsam (Ponto 6); reordenar a coluna pra ordem da ficha — identidade → sobre/dados → rede → jornada — movendo `JovemChamados`/`FichaSecao` pra baixo ou pra seção colapsada. Mantém todas as funções.
- **B. Hierarquia nova**: o self-view vira leitura primeiro (bio/interesses como `SecaoDiretorio`), edição só por lápis/dialog (padrão `DialogoDados` já existente — generalizar pra disponibilidade/ficha). Mais fiel ao pedido "parecido com o perfil de outras pessoas", diff maior.
- **C. Reusar as seções da ficha pra si** (`SecaoDiretorio` self-scoped) — duplica gramática sem ganho.

**Recomendação:** A como fatia imediata, com B como direção (o feedback pede repensar a hierarquia, não só o card de badges). Fronteira: a **arte** das conquistas (ilustrações isométricas animadas) é frente autoral do Claude (§1 do feedback) — este ponto cobre container, ordem e colapso.

### Ponto 6 — WhatsApp para mentores em Pessoas (feedback §2)

**Achado:** `DiretorioCard`/`EspecialistaCatalogoCard` não têm ação nenhuma (decisão `:31-32`: "o contato direto mora na ficha e só pra quem já tem vínculo") — e o feedback rebate: "hoje a área está vazia; eles precisam conseguir se comunicar". **Dado já está no client**: `getJovemContatos()` (`pessoas/page.tsx:29`) traz whatsapp/e-mail dos adultos da rede e `getJovemColegas()` traz whatsapp do colega *com opt-in*. Basta `enriqueceDiretorio` projetar `wa`/`email` do contato casado em `DiretorioPessoa` — zero exposição nova, sem migration. Precedente de render: `ContatoLinha`/`ColegaLinha` (`jovem-rede.tsx:56-83,144-163` — `waLink` + `msgApresentacaoJovem`), `EquipeWaDialog`, `SecaoContato`.

**Opções:**

- **A. Ícone WA no card da rede** (recomendada): `p.rede` + `wa` resolvido → `<a>` `buttonVariants({variant:"outline",size:"icon-sm"})` (size-11 no mobile) como **irmão** do Link de perfil (nunca aninhado — interactive dentro de link é inválido), ao lado do badge "Sua rede". `EspecialistaCatalogoCard` recebe pelo slot `rodape`/badge já existente ou mesma posição. Cobre mentor/especialista/auxiliar/coord da rede *e* colega com opt-in automaticamente.
- **B. ⋯ menu "Ações"** com WhatsApp/E-mail/Ver perfil (molde `dupla-linha-menu.tsx`): alinha com a régua "1 CTA + menu" do §7, mas adiciona um gesto num card que hoje tem 1 ação — guardar pra quando houver 2+ ações reais (decisão §8.7 do feedback).
- **C. Nada no card** — status quo rejeitado pelo feedback.

**Recomendação:** A. Adulto fora da rede: sem botão — o canal só abre com o vínculo (fronteira correta já no banco: `jovem_contatos` não projeta contato de quem não é da rede; `mentorados_turma` projeta `whatsapp` null sem opt-in).

### Ponto 7 — Conquistas tomando scroll + alvos ≥44px (feedback §1/§7)

**Achado:** `ConquistasCard` (`conquistas-card.tsx:403-477`) = `NivelBloco` (`:418`) + "Estante" `grid-cols-3` (`:423-436`) + "Ainda por vir" `grid-cols-3` (`:445-463`). Tile ≈ 120px (emblema 56 + título + linha); 15–20 futuras ≈ 5–7 linhas ≈ **600–900px de scroll**. O feedback aceita "dropdown/expansão".

**Opções:**

- **A. `<details>`/`Collapsible` em "Ainda por vir"** (recomendada): trigger `min-h-11` com contagem ("Ainda por vir · 17"), padrão `jovem-para-fazer.tsx:131-147` ou `FichaSecao` (`perfil-form.tsx:434`). Estante (earned) permanece visível — é a coleção do jovem; se ela própria passar de ~2 linhas, cap + "Ver todas" dentro do mesmo gesto.
- **B. Só capar altura** com scroll interno — carretel vertical numa página de leitura, pior.
- **C. `DropdownMenu`** — metáfora errada (menu é ação, não lista).

**Recomendação:** A + selo minimalista do Ponto 5 (o detalhe `FaixaDetalhe`/`PecaDetalhe` por peça não muda — só o container).

**Alvos sub-44px achados** (piso do kit = `h-11`/`size-11`/`min-h-11` em touch, `ui/button.tsx:30-41`):

| Alvo | Medida | Onde |
|---|---|---|
| Ghost "Limpar filtros" | `h-9` = 36px | `jovem-diretorio.tsx:213`; mesmo padrão em `pessoas-listas.tsx:1195` (staff) |
| Toggle "Ver sua avaliação" (quiet) | `min-h-8` = 32px | `jovem-avaliacoes.tsx:168` |

Fix: `size="sm"` puro (h-11) ou `min-h-11`. Todo o resto auditado está conforme (chips, `OpcaoPilula`/`OpcaoCheck`, nav/sheet, summaries, `size-11` icons, tiles de conquista).

## 4. Critérios de aceite consolidados

- **Pessoas/jovem (390×844):** barra = busca + "Filtros" + contagem + limpar; zero pills na página; modal/sheet aplica vínculo e tema de uma vez (rascunho→Aplicar), URL `?papel/?area/?busca` refletida; `role="status"` anuncia a contagem; **scroll horizontal zero** em 320–430px.
- **Especialistas/jovem:** idem — scroll horizontal zero com sugestão renderizada (demanda com URL longa não estoura); bottom nav sem vazamento de label com a Liza ativa.
- **Ficha `/jovem/pessoas/[id]`:** e-mail/whatsapp/tags longas nunca estouram a `section` (scroll horizontal zero).
- **Perfil/jovem:** "Sua rede" lista só adultos (`rede`); zero linhas de colega; legenda e empty state atualizados; selo de nível sem caixa (emblema + meta, abre o mesmo detalhe); "Ainda por vir" atrás de colapso `min-h-11` fechado por padrão.
- **WhatsApp:** card de pessoa `rede` com contato → ícone WA `size-11` com `aria-label` nomeado (mentor, especialista, equipe, colega com opt-in); sem contato → sem botão (nunca link vazio/undefined); fora da rede → sem canal, coerente com a ficha.
- **Alvos:** todo elemento interativo em superfície de toque ≥44×44px (os 3 achados corrigidos).
- **Motion/a11y:** troca de filtro continua animando (re-key); modal devolve foco ao trigger; `aria-expanded`/foco correto nos colapsos; copy pt-BR sem travessão.

## 5. Decisões de produto (só o lead fecha)

1. **"Minha rede" (faceta do diretório) inclui colegas?** O perfil corta (A do Ponto 4); a faceta pode seguir ampliada ("quem você conhece") ou virar "adultos" (B). Recomendo manter ampliada — são lentes diferentes com nomes parecidos; se a ambiguidade incomodar, renomear a faceta (ex.: "Conhecidos").
2. **Alguma pill fica exposta?** (feedback §8.6) — recomendo nenhuma; o selo `N ativos` no `FiltrosButton` preserva a legibilidade do estado filtrado.
3. **Tema no modal: single ou multi-select?** Hoje o chip é single-select (re-tocar limpa). `OpcaoCheck` multi é a gramática do staff; single mantém a semântica atual. Menor.
4. **`Filtros` também colapsa as pills do staff não-coord?** (`pessoas-listas.tsx:1206-1241` tem a mesma régua "Filtrar por categoria/trilha/área") — consistência de gramática × escopo do feedback (só jovem). Recomendo jovem-only nesta rodada.
5. **WhatsApp no card: ícone ou ⋯?** (feedback §8.7 — menu só quando 2+ ações) — recomendo ícone WA direto (o card tem 1 ação real); se surgir 2ª ação (e-mail?), migrar pro ⋯.
6. **Estante também capa?** "Ainda por vir" colapsa (A); manter a estante earned sempre visível ou capar a 2 linhas quando longa — recomendo capar as duas simetricamente se >2 linhas.
7. **Arte × container do selo/conquistas:** a frente autoral do Claude redesenha as peças (§1); este trabalho só muda o chrome. Confirmar que a ordem das frentes não conflita (a arte pode vir antes e o colapso absorve qualquer arte nova).
8. **Guarda global vs só fixes pontuais:** `overflow-x: clip` no `body` esconde a classe inteira de regressão mas pode encobrir bugs futuros — aceitar o trade-off? Recomendo aceitar (o critério "scroll horizontal zero" é explícito no §7).

## 6. Riscos

- **Descoberta de filtro**: sem pills visíveis, o jovem pode não perceber o filtro — mitigação: selo `N ativos` sempre que >0, e o estado default do sheet já mostra "Vínculo" expandido.
- **Semântica "rede" divergente** (perfil vs faceta) — coberto na decisão 1.
- **WA em card muda um invariante de produto** ("contato só na ficha", `jovem-diretorio.tsx:31-32`) — a fronteira de dados não muda (já autorizada pela view), mas comentários/docstrings que prometem o invariante precisam ser corrigidos na mesma PR (regra do AGENTS.md: doc que contradiz código é corrigida junto).
- **Sheet de filtros × teclado virtual**: busca fica fora do sheet — ok; dentro do sheet só radios/checks (sem input) → sem colisão com teclado.
- **`overflow-x: clip` em `body`**: checar `position: sticky` vertical continua funcionando (header `jovem-shell.tsx:128`, barra de materiais `materiais/page.tsx:478`) — `clip` não é scrollport, sticky resolve no viewport; confirmar no device no primeiro implementável.
- **`min-w-0` na célula do card**: o botão WA novo entra como irmão do Link `min-w-0 flex-1` — o link continua truncando nome; o botão `shrink-0` não espremerá o resto (44px).
- **Demo mirror**: qualquer mudança de shape em `DiretorioPessoa` (ex.: `wa`/`email` novos) precisa do espelho `demoJovem*` em `src/lib/demo/` — `tests/diretorio-jovem.test.ts` prova a paridade.

## 7. Testes

**Que re-pontam (mudam com a implementação):**

- `tests/e2e/demo/jovem-pessoas.spec.ts:17-20` — helper `pill()` = `getByRole("group", "Filtrar por vínculo")`; casos `:31`, `:66`, `:76` (facetas+URL). Reescrever abrindo "Filtros" e aplicando via modal; `?papel=` na URL segue provando deep-link.
- `tests/e2e/app/jovem-pessoas.spec.ts:163-165` (mesmo helper), `:179` (faceta Minha rede), `:456` (escopo 0097).
- `tests/e2e/app/jovem-pessoas.spec.ts:319-346` — prova o WA do colega **dentro da seção "Sua rede"**; com colegas fora da seção, a asserção migra pro card do diretório (faceta "Colegas"/"Minha rede") + ficha (já coberta em `:350-356`).
- `tests/e2e/app/jovem.spec.ts:661-680` — revisita a seção/facetas de rede.
- `tests/diretorio-jovem.test.ts:247-252` — "rede = união dos contatos e colegas": se a decisão 1 for B (faceta sem colegas), este caso muda; se A, fica verde. O shape novo (`wa`/`email`) ganha caso de projeção (só rede, só opt-in).
- `tests/e2e/demo/pessoas-turma.spec.ts:298-337` — pills do staff não-coord ("Filtrar por categoria"); só toca se a decisão 4 expandir o escopo.

**A criar:**

- **e2e modal**: `/jovem/pessoas` → "Filtros" abre sheet (390px) / dialog; aplicar "Minha rede" + um tema → grade recorta, URL ganha `?papel=rede&area=`; selo "2 ativos"; "Limpar" no footer zera; Escape devolve foco ao botão.
- **e2e overflow**: demanda/mentorado com token longo sem espaço em sugestão + ficha com e-mail longo → `document.documentElement.scrollWidth === clientWidth` (asserção de zero-scroll em 390px; helper reutilizável pras 3 páginas).
- **e2e WA**: card da rede com contato → `a[href*="wa.me/"]` com o número da ficha; colega sem opt-in → sem link (hoje o spec prova zero wa.me na página inteira — `:187`; ajustar pro escopo "fora da rede").
- **e2e rede do perfil**: `sua-rede-titulo` não contém `ColegaLinha`/`Colega da turma`; contém mentor/coord; legenda nova.
- **e2e conquistas**: "Ainda por vir" fechado por padrão → `aria-expanded=false`; abre com contagem; cada tile continua abrindo `Dialog`.
- **Unit**: `enriqueceDiretorio` com `wa`/`email` projetados (rede+opt-in vs fora); se decisão 1=B, rede≠colega.
- **Alvos**: asserção `getBoundingClientRect().height >= 44` nos 3 pontos corrigidos ou `min-h-11` por classe (spec de atributo já é o padrão da casa).

---

### Apêndice — método e skills

Skills carregadas: `ui-ux-pro-max`, `frontend-ui-engineering`, `better-layout`, `better-accessibility`, `better-interface`, `antislop-copywriting` — aplicadas na régua de alvos/overflow (better-layout), teclado/SR/naming (better-accessibility), hierarquia e gramática de componentes (frontend-ui-engineering/better-interface) e nas opções de copy/decisão (antislop). Dois explorers read-only rodaram frentes disjuntas: (i) kit de overlay/menus/testes afetados; (ii) árvore completa de `/jovem/especialistas` + `/jovem/pessoas` com auditoria de overflow — relatórios consolidados aqui com verificação file:line própria. Sem browser: "não verificado em device" é honesto onde a evidência é só estática.
