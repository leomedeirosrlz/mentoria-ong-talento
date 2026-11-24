# Recon — Gamificação: nível, badges, conquistas e motion

**Data:** 24/11/2026 · **Base:** `integration/plano2` @ `aecb135e` · **Status:** recon concluído, sem implementação.

> Este arquivo é diagnóstico e proposta. Não implementa, não altera código,
> não sugere migration aplicada — o SQL da seção 8 é sugestão para o lead.
> Skills carregadas nesta sessão: `ui-ux-pro-max`, `animation-principles`,
> `micro-interaction`, `ui-animation`, `accessible-animation`, `better-ui`,
> `antislop` (a skill `animate` pedida no brief não existe no catálogo;
> coberta por `animation-principles` + `ui-animation`).

---

## 1. Resumo executivo

A gamificação atual (spec `016-badges`, REALIZA-516) já tem **derivação pura
completa**: marcos, instrumentos, contagens e as 4 faixas de nível saem de
`conquistasDoJovem()` sem nenhuma tabela própria. O que o usuário rejeitou
não é a estrutura — é a **direção visual** (plantinhas/árvores em vez de
algo "badass") e a **monotonia de motion** (uma única animação genérica em
todas as superfícies).

Os três pedidos mapeiam para três fatias separáveis:

1. **Badge "seu nível" no header do perfil** — o espaço vazio à direita do
   card do topo é real: o `flex items-end justify-between` da página só
   contém o `FotoPerfil` à esquerda (e um "Remover foto" fantasma à direita
   quando há foto). Cabe um chip de nível compacto sem quebrar o layout.
2. **Família visual de nível** — hoje `nivel-*` são planta → árvore →
   árvore com estrela sobre o mesmo canteiro amarelo
   (`scripts/gerar-badges.mjs:378-429`). Trocar por uma família de
   **raios/energia** é barato: o gerador já tem a gramática isométrica
   (slab + extrusão + paleta), falta só o desenho novo e o mapeamento em
   `badges.ts`/`conquista-emblema.tsx`.
3. **Motion por faixa + conquistas novas** — a única animação de conquista
   é `badge-salta` (o mesmo salto de 1567ms em todas as peças) e a entrada
   genérica é `animate-enter`, usada em ~70 arquivos. O nível precisa de
   assinatura própria por faixa, e o catálogo de conquistas comporta as
   sugestões do usuário (combinados ≥5, horas de mentoria, metas/submetas)
   **sem nenhum DDL** — todos os dados já chegam ao perfil via queries e
   RPCs existentes.

Conclusão de dados: **zero DDL obrigatório**. O único gap real é a data do
combinado feito (`jovem_encaminhamentos` não expõe `feito_em`), que hoje já
rende `data: null` honesto — melhorar exige a migration sugerida na seção 8,
mas não bloqueia nada.

---

## 2. Inventário de badges/níveis/conquistas

### 2.1 Derivação (a "engine" — pura, nada persiste)

| Peça | Arquivo:linha | O que é |
|---|---|---|
| `conquistasDoJovem()` | `src/lib/conquistas.ts:548-950` | Entrada: encontros, duplas, jornada (RPC), avaliações, encaminhamentos. Saída: `{conquistas, futuras, nivel, proximoMarco, marcos, temJornada}` |
| Estante (marcos) | `conquistas.ts:597-639` | 4 limiares de `limiaresMarcos(total)` — primeiro/metade/reta_final/completo, datados pelo p-ésimo realizado |
| Estante (instrumentos) | `conquistas.ts:644-708` | Estações `feito` de `estacoesJornada` viram peça (roda_inicial, visao, metas, pdm, roda_formal, avaliacao_360); a recorrente `avaliacao_encontro` fica fora (coberta pela contagem) |
| Estante (contagens) | `conquistas.ts:710-784` | `conta:avaliacoes` (n enviadas), `conta:combinados` (n com `status=feito`, sem data — a view não expõe `feito_em`), `conta:especialista` (n sessões) |
| Níveis | `conquistas.ts:322-546` | `NivelChave` = `inicio/constancia/veterania/completa`. Régua DPP: constância = 30d + 4 encontros; veterania = 90d + 8; completa = `total` (16). Régua especialista: 30d+2 / 60d+3 / total. Tempo = dias somados **dentro** de dupla da trilha (união de intervalos `iniciada_em`→`encerrada_em`/hoje, sem lacuna entre duplas). Estados: `ganho`/`superado`/`futuro`; `parada` pausada/encerrada congela a contagem |
| Marcos de ação (faixa "Próximo marco") | `conquistas.ts:846-939` | `MarcoAcao`: primeiro encontro, avaliação, PDM, jornada completa — alimenta a faixa no topo de `/jovem/materiais` |
| Mapa glifo→arte | `src/lib/badges.ts:9-55` | `arteDoGlifo()`: PHOSPHOR/ESTACAO/NIVEL → `/badges/<slug>.svg` |
| Testes | `src/lib/conquistas.test.ts` (850 linhas) | 5 describes: derivação, marcos de ação, seleção do próximo (515), níveis (520-769), futuras (770+) |

### 2.2 Assets e renderização

| Peça | Arquivo:linha | O que é |
|---|---|---|
| SVGs | `public/badges/*.svg` (16 arquivos) | Isométricos estáticos, 500×500, ~4-8 KB cada |
| Gerador | `scripts/gerar-badges.mjs` (677 linhas) | Gramática fun-isometric: face inclinada `FACE=lean(-18,36)` / `CHAO=lean(-45,55)`, extrusão `EXT=[-7,30]`, traço `W=11`, borda-papel `CORTE=9`, paleta fixa `CORES` (tinta/lima/amarelo/laranja/azul/turquesa/marinho/ameixa/verde) — `:623-634` |
| Família nível hoje | `gerar-badges.mjs:370-429` | `canteiro()` (placa amarela + terra) + broto (`nivel-inicio`, 2 folhas), muda (`nivel-constancia`, 4 folhas), árvore (`nivel-veterania`, frutos), árvore+estrela (`nivel-completa`). **É o "plantinha" rejeitado.** |
| Emblema | `src/components/conquista-emblema.tsx:30-126` | `ConquistaEmblema`: `BadgeImagem` (SVG) ou `Squircle` (fallback Phosphor/instrumento, glifo a ~57% do lado). Fallback de nível hoje: `Plant/CalendarCheck/Tree/Trophy` (`:121-126`) — **também é planta** |
| Imagem | `src/components/badge-imagem.tsx:9-43` | `<img>` decorativa com troca pro fallback no `onError`/`naturalWidth===0` |
| Card do perfil | `src/app/(jovem)/jovem/perfil/conquistas-card.tsx` (549 linhas) | `section#conquistas`: `NivelBloco` (vitrine 80px + régua das 4 faixas 40px + próximo nível com barras) `:342-462`; Estante earned-only grid 3/4/5 col `:491-514`; "Ainda por vir" apagada `:516-535`; detalhe em `Dialog` por peça |
| Faixa home | `src/app/(jovem)/jovem/materiais/marcos-a-caminho.tsx:14-78` | "Próximo marco" em `/jovem/materiais` — só o primeiro `MarcoAcao` não ganho + link "Ver conquistas" → `/jovem/perfil#conquistas` |
| Header do perfil | `src/app/(jovem)/jovem/perfil/page.tsx:106-144` | `PessoaBanner` (h-28/sm:h-36, marca de papel mentorado = arco tracejado amarelo + ponto lime, `pessoa-banner.tsx:105-122`) + linha `flex items-end justify-between` com `FotoPerfil` (avatar 80/96px sobrepondo o banner via `-mt-10/-12`) + h1 + `Badge` papel + `MapPin` meta + bio. **À direita do avatar: vazio** (só o "Remover foto" fantasma quando `src` existe — `perfil-form.tsx:303-314`) |

### 2.3 Animações existentes (todas CSS, todas sob o guard global)

| Classe/keyframes | globals.css | Duração | Onde é usada |
|---|---|---|---|
| `badge-salta` = `badge-salto-p` + `badge-salto-r` | `:497-541` | 1567ms | **Todas** as peças: hover/focus dos tiles (`conquistas-card.tsx:159,371,421`) e abertura do detalhe (`:69`). Hop do kit: sobe 4,85% inclinando 9°, quica 2× |
| `badge-brilho` | `:544-560` | 500ms @900ms | Spark de 4 pontas no detalhe ganho (`Brilho`, `conquistas-card.tsx:33-49`) |
| `fill-grow` | `:480-489` | 500ms | Barras de progresso (`Barra` `:124-128`, `marcos-a-caminho.tsx:60-66`) |
| `animate-enter` (enter-stagger) | `:450-459` | 180ms + `--i`×35ms | **~70 arquivos** — listas do app inteiro, incl. Estante (`:501-502`) |
| `animate-enter-x` | `:464-476` | 200ms | Painéis/drawers (agenda) |
| `animate-ping-once` | `:613-622` | 700ms | Atenção única: semáforo risco (`semaforo.tsx:31`), nó "próximo" da trilha (`trilha-jornada.tsx:265`) |
| `confirm-pop`/`confirm-draw` | `:626-646` | 280/420ms | `/auth/confirmado` — pop de scale + check por `stroke-dashoffset` |
| `animate-fab-chega` | `:435-444` | 450ms overshoot | FAB da Liza |
| `animate-rise` | `:564-576` | 500ms | Onboarding por passo |
| `animate-flash-ok` | `:835-845` | 600ms | Célula recém-gravada pisca `--ok` |
| `roda-abre`/`roda-ponto` | `:995-1019` | 480ms / 160ms transição | Roda da Vida (instrumento) |
| `ia-*` (digitando/cursor/tok/shimmer/barra/traco/arco/pop/aparece) | `:652-831` | vários | Assistente: stream, gráficos inline |
| `shimmer` | `:603-610` | 1.4s loop | Skeleton (único loop permitido) + `ia-shimmer` de status |
| Guard reduced-motion | `:865-902` | — | `animation-duration: 0.01ms`, `iteration-count: 1`, `delay: 0`, `transition: 0.01ms`, `scroll-behavior: auto`; exceções funcionais: `.animate-spin`, `ia-cursor`, `ia-shimmer`, `ia-digitando→fade` |

**Por que "parece tudo a mesma animação tosca":** há exatamente UMA animação
de deleite (`badge-salta`), aplicada uniformemente a marco, instrumento,
contagem e nível — e UMA animação de entrada (`animate-enter`, fade+4px)
repetida em ~70 superfícies. O usuário percebe corretamente que o sistema
tem um único gesto. Adicional: o salto é do preset `hop` do kit isométrico
— foi desenhado para adesivos, não para "energia".

### 2.4 e2e que protege o comportamento atual

`tests/e2e/demo/jovem-conquistas.spec.ts` (186 linhas): régua das 4 faixas
com estado em texto, barras com `progressbar` nomeado, contagem "Faltam N",
estante earned-only × futuras apagadas (grayscale, sem cadeado), `src` das
imagens `^/badges/[a-z0-9-]+\.svg$`, alt vazio + `aria-hidden`, fallback
quando o SVG 404, e o par movimento/reduced-motion (`badge-salto-p` < 2s →
~0s com `reducedMotion:"reduce"`). **Qualquer mudança visual passa por esse
arquivo** — os seletores por role/nome sobrevivem à troca de arte, mas
asserts de classe (`grayscale`) e do nome do keyframe (`badge-salto-p`)
precisam ser mantidos ou atualizados.

---

## 3. Lacunas de gamificação (exemplo → dados → DDL?)

| Pedido do usuário | Dado disponível hoje | Deriva já? | DDL necessário? |
|---|---|---|---|
| Badge "seu nível" no card do topo | `conq.nivel` já derivado na página (`page.tsx:83-89`), hoje só renderiza dentro do `ConquistasCard` | Sim — é só posicionamento | **Não** |
| "Faça mais de 5 combinados" | `getJovemEncaminhamentos()` → `status='feito'` (`queries-jovem.ts:140-158`); já alimenta `conta:combinados` | Sim — hoje é contagem cumulativa; virar conquista por **limiar** é derivação nova, mesma fonte | **Não** |
| "Acumule 7 horas de mentoria" | `encontros.duracao_min` já selecionado em `JOVEM_ENCONTRO_COLS` (`queries-jovem.ts:206-207`) | Sim — **com ressalva**: sessão combinada grava o MESMO `duracao_min` em todas as rows do `sessao_id` (`actions.ts:3610-3631`) → somar por `COALESCE(sessao_id, id)`, não por row. E `duracao_min` pode ser null (registro antigo/retroativo sem duração; agenda assume 60 em `agenda-calendario.tsx:5151`) | **Não** |
| "Feche 1 meta" | `pdm_itens.status='atingida'` + `parent_id IS NULL`; jovem lê via `getPdmDaDupla(duplaId)` (RPC `pdm_da_dupla` valida `my_mentorado_id()` — `0211_pdm_autoria.sql:219`) | Não na página do perfil — exige adicionar `getPdmDaDupla` ao `Promise.all` do perfil (a `/jovem/pdm` já chama) | **Não** |
| "Conclua 3 submetas" | Idem, `parent_id IS NOT NULL` | Idem | **Não** |
| Data da conquista de combinado ("Conquistada em…") | `jovem_encaminhamentos` expõe `id, dupla_id, descricao, prazo, status, created_at` (`0070:26-35`) — **não há `feito_em`/`updated_at` na tabela** (`0001_init.sql:95-104`) | Parcial — hoje `data: null` honesto (`conquistas.ts:753`) | Só se quiser o carimbo (ver §8) |
| Conquistas com "raridade" | Não existe conceito de raridade/tier — toda peça é equivalente | Não | Não (é metadado de catálogo, não schema) |
| Celebração no cruzamento (toast/dialog "subiu de nível") | Padrão existe: `MarcoNotifier` dispara toast por baseline em `localStorage` (`marco-notifier.tsx:42-82`) — hoje só pro mentor, na trilha da ficha | Não — replicar o padrão pro jovem | **Não** |
| Backfill de conquistas passadas | A derivação é retrospectiva por natureza (datas vêm dos eventos reais) | Sim — "backfill" = a estante já nasce cheia | **Não** |

**Semântica a validar com o Thiago antes de implementar:**

- "Combinados" = `encaminhamentos.responsavel='mentorado'` (o que ELE se
  comprometeu) — a view já filtra isso; combinados do mentor não entram.
- "Horas de mentoria" = soma de `duracao_min` dos encontros `realizado`
  da trilha da régua (DPP), dedup por `sessao_id`. Recomendo **contar só
  o que tem duração registrada** e escrever isso no critério ("horas de
  encontro registradas"), em vez de assumir 60min para nulls — a regra da
  casa é nunca inventar número.
- "Meta fechada" = `pdm_itens.status='atingida'` — a meta descartada não
  conta (`metasAtivas` já filtra, `pdm.ts:116-120`). Submeta aninhada a
  qualquer profundidade conta como submeta (`parent_id != null`).
- Metas/submetas só existem na trilha DPP (PDM é doc de dupla DPP) —
  jovem só-especialista nunca ganha essas peças; não entram nas "futuras"
  dele (mesma regra de não-promessa do `conta:combinados` `:816-830`).

---

## 4. Proposta de níveis/raios e motion

### 4.1 Família visual: raios/energia no lugar das plantas

**Manter a gramática** (é o que dá identidade de casa: face inclinada,
extrusão, traço tinta, borda-papel) e trocar só o **motivo**. O gerador já
tem tudo que a nova família precisa: `poly()` aceita polígonos com filete
por vértice, `slab()` extrui, `chapa()` sobrepõe detalhes. Um raio é um
polígono em zigue-zague — encaixa direto em `D["nivel-*"]`.

Progressão proposta (quantidade + forma + presença):

| Faixa | Desenho | Leitura |
|---|---|---|
| `inicio` | 1 raio pequeno, fino, saindo de um disco/base | a primeira faísca |
| `constancia` | 2 raios cruzados/paralelos, médios | corrente estabelecida |
| `veterania` | 3 raios, o central maior, com arco/anel de energia | potência acumulada |
| `completa` | burst/coroa de raios irradiando de um núcleo | sobrecarga total |

- **Cor:** a família de nível já usa `TOM_NIVEL` = tinta sobre
  `--destaque` (amarelo #FFD531, `conquistas.ts:316`) — raio amarelo/
  laranja sobre base tinta (`marinho`/`ameixa` escuras da `CORES`) lê
  "energia" e fica dentro da paleta; foge do verde "planta" sem inventar
  matiz novo.
- **Base:** trocar o `canteiro()` (placa+terra, metáfora jardim) por um
  pedestal neutro (disco deitado, como `base()` dos marcos `:431-436`)
  ou núcleo/dínamo — senão o raio continua lendo "plantado".
- **Fallback squircle:** trocar `Plant/CalendarCheck/Tree/Trophy` por
  `Lightning` (já usado na casa — `chamados-shared.tsx:12,157`) com
  variação de weight/quantidade por faixa: `Lightning` → `Lightning` fill
  → `Lightning`+anel → `Lightning`+`Crown`/`Sparkle`. O Phosphor tem
  `Lightning`, `Sparkle`, `Crown`, `Medal`, `Trophy` — todos já no
  bundle do app.
- **Decisão de produto (§7):** a troca é só na família `nivel-*` ou a
  casa toda migra pra "energia"? Recomendo **só nível** — marcos
  (bandeiras/medalha) e contagens (estrela/checklist/balões) já leem bem
  e não foram reclamados; trocar tudo aumenta superfície e risco sem
  ganho pedido.

### 4.2 Badge de nível no header do perfil (print 3)

Estrutura atual (`page.tsx:115-123`): `div.flex.items-end.justify-between`
contém `FotoPerfil` (fragmento: avatar 80→96px com `-mt-10/-12` + botão
câmera + "Remover foto" condicional). **A direita está livre.**

Proposta: `NivelChip` compacto na ponta direita dessa linha — emblema
40-48px + "Seu nível" + título da faixa + micro-linha ("Desde dd/mm" ou
o que falta), abrindo o MESMO `FaixaDetalhe` (`conquistas-card.tsx:297`)
— um gesto, uma fonte de verdade. Alternativa menos invasiva: chip entra
na linha de badges abaixo do nome (`:127-137`), junto do `Badge` papel —
mas é menor e menos "badge".

Responsividade:
- **390px:** a linha é `items-end` sem wrap; avatar 80px + chip à direita
  cabem (390 - 32 padding ≈ 358px úteis). O chip pode empilhar emblema
  sobre texto curto. Sem overflow de largura.
- **1440px:** o header é `max-w-5xl`; espaço à direita abundante — o chip
  pode crescer para emblema 56px + 2 linhas.
- Caso-borda: sem jornada (`!conq.temJornada`) o chip não renderiza —
  mesmo gate do `ConquistasCard` (`page.tsx:167`); sem `nivel` (jornada
  não começou), mostra a faixa `inicio` apagada, como a vitrine faz hoje.
- Conflito: quando há foto, "Remover foto" ocupa a direita — o chip e o
  botão são ambos irmãos no `justify-between`; ordem sugerida: avatar |
  chip nível | remover foto (ou o chip vai para a linha de badges nesse
  caso). Decidir no spec.

### 4.3 Motion por faixa (sem exagerar)

Princípio (animation-principles): cada faixa tem **assinatura própria**,
curta, uma vez por gatilho — e o nível NÃO usa o mesmo `badge-salta` das
outras peças. O hop genérico fica para marcos/instrumentos/contagens.

| Faixa | Assinatura de motion | Técnica |
|---|---|---|
| `inicio` | pop único com leve overshoot | `scale 0.4→1` + opacity, 280ms `ease-snappy` — reusa o padrão `confirm-pop` (`globals.css:626-631`) |
| `constancia` | pulso duplo de carga (scale 1→1.06→1→1.04→1) | transform-only keyframe ~600ms, roda no mount da peça atual |
| `veterania` | "flicker" elétrico curto: 2-3 cortes rápidos de opacity no raio (nunca >3 flashes/s — WCAG 2.3.1) + settle | opacity-only keyframe ~700ms; área pequena (só o raio, não a peça) |
| `completa` | burst: raios escalam do núcleo + 1 `badge-brilho` | scale com stagger interno ~600ms + spark existente `:544-560` |

- **Onde dispara:** mount da peça atual na régua e ao abrir o detalhe
  (como hoje `badge-salta` no `PecaDetalhe`). No chip do header: no
  máximo um settle no primeiro paint — nunca idle infinito.
- **Idle contínuo:** se o produto pedir "vivo", o candidato é uma
  varredura de luz lenta SÓ no raio (padrão `ia-shimmer` `:727-741`,
  gradiente sobre o desenho) — não no card, não na tela. Avaliar
  necessidade; o default é sem idle (regra de custo de atenção do
  better-ui: animação cobra a cada trigger).
- **Reduced-motion (tiered, accessible-animation):** flicker/burst são
  Tier 1 (remove); pulso vira fade ≤200ms (Tier 2); pop pode virar
  fade (Tier 3). O guard global já zera tudo — para as variantes por
  faixa, seguir o modelo `ia-digitando→ia-digitando-fade` (`:897-901`):
  troca o keyframe por um de opacity dentro do `@media reduce`.
- **Performance:** SVG estático + keyframes em `transform/opacity` =
  custo de compositor, zero layout. `stroke-dashoffset` (estilo
  `confirm-draw`) é paint — ok em área pequena se quisermos o raio
  "se desenhando" no detalhe. Nada de canvas/JS por frame — reforça o
  requisito não-funcional da spec 016 (FR perf).

### 4.4 Regra de diferenciação (mata a "animação única")

| Camada | Vocabulário | Duração | Onde |
|---|---|---|---|
| Identidade (nível) | assinatura por faixa (§4.3) | 280-700ms, uma vez | badge de nível: header, régua, detalhe |
| Feedback de conquista | `badge-salta` + `badge-brilho` | 1567/500ms | hover/focus e detalhe das peças da estante |
| Entrada de superfície | `animate-enter`/`enter-x`/`rise` | 180-500ms | listas e cards (como hoje) |
| Microinteração | `scale 0.96` press, transitions `ease-snappy` | ≤200ms | botões, tiles, links |

Regra: identidade nunca reusa feedback; a peça de nível é a única que
leva sua própria família de keyframes (`nivel-<faixa>-*`).

---

## 5. Conquistas propostas

Raridade é rótulo de catálogo (copy + peso visual), não schema. Sugestão
de 3 tiers: **inicial** (1ª semana), **constância** (meio da jornada),
**marco grande** (ralo/fim). Nomes em pt-BR, sem travessão.

| Chave | Título | Critério (texto do detalhe) | Fonte | Raridade | Copy do detalhe |
|---|---|---|---|---|---|
| `conta:combinados-5` | "Palavra cumprida" | Concluir 5 combinados com seu mentor | `jovem_encaminhamentos` feito ≥5 | constância | "Cinco tarefas ditas e feitas. Combinado aqui é compromisso." |
| `conta:combinados-15` | "De palavra" | Concluir 15 combinados | idem ≥15 | marco grande | "Quinze combinados fechados: o que você diz, acontece." |
| `conta:horas-7` | "Sete horas de conversa" | Acumular 7h de encontro registradas | `encontros.duracao_min` (realizado, dedup `sessao_id`) | constância | "Sete horas cara a cara com seu mentor — tempo que vira repertório." |
| `conta:horas-15` | "Mês de conversas" | Acumular 15h registradas | idem ≥15 | marco grande | "Quinze horas de mentoria somadas. Isso é um turno inteiro de troca." |
| `pdm:meta-1` | "Primeira meta fechada" | Marcar 1 meta do PDM como atingida | `pdm_itens` atingida, `parent_id IS NULL` ≥1 | constância | "A primeira meta do seu plano saiu do papel." |
| `pdm:metas-3` | "No rumo" | 3 metas atingidas | idem ≥3 | marco grande | "Três metas cumpridas — o plano deixou de ser intenção." |
| `pdm:submetas-3` | "Passo a passo" | 3 submetas atingidas | `pdm_itens` atingida, `parent_id NOT NULL` ≥3 | inicial | "Três passos concluídos: submeta é como meta grande se quebra." |
| `pdm:submetas-10` | "Tijolo a tijolo" | 10 submetas atingidas | idem ≥10 | marco grande | "Dez passos fechados. Obra se faz assim." |
| `perfil:completo` | "Cara do lugar" | Ficha preenchida (whatsapp + disponibilidade + bio ou interesses) | `getJovemPerfil` + `me` | inicial | "Perfil completo: quem te acompanha sabe quem você é." |
| `doc:termo` | "Termo assinado" | Termo do mentorado assinado | `jovem_assinaturas` status `assinado` | inicial | "O documento que abre a jornada, assinado." |
| `conta:avaliacoes-5` | "Voz treinada" | Enviar 5 avaliações de encontro | `avaliacoes` ≥5 | constância | "Cinco notas enviadas: sua opinião guia a dupla." |
| `presenca:sem-falta` | "Não faltou" | N encontros realizados seguidos sem `nao_aconteceu` entre eles | `encontros` da trilha | marco grande | "Presença limpa: cada encontro marcado, cada encontro feito." |

Notas:
- `conta:combinados`/`conta:avaliacoes`/`conta:especialista` atuais são
  **contadores** (sempre mostram n) — as novas são **limiares** (ganham/
  futuras). Convivem: o contador fica na estante, o limiar é a peça
  nomeada. Ou o contador vira série (`X combinados` atualiza o número do
  mesmo tile). Decisão de produto (§7): manter contador + limiar é o mais
  barato; fundir é mais limpo.
- "Sem falta" precisa de definição honesta: sequência de realizados sem
  `nao_aconteceu` no meio — reagendado não quebra (é a vida real).
- `perfil:completo` e `doc:termo` são "gerais" (fora da régua de jornada)
  — entram na estante com tom neutro próprio (ex.: `--inst-checklist` já
  usado para combinados; termo pode usar `--inst-desfecho`).
- Futuras correspondentes aparecem automaticamente (mesmo mecanismo
  `futuras.push` com `progresso {atual, alvo}` onde há contagem).

---

## 6. Critérios de aceite

**Visual**
- `nivel-*` redesenhados em raios/energia na gramática isométrica
  (traço 11, extrusão [-7,30], paleta `CORES`), gerados por
  `scripts/gerar-badges.mjs` — nada de asset externo/CDN.
- As 4 faixas distinguíveis por quantidade/forma à primeira vista em
  40px (tamanho da régua) e 500px (detalhe); grayscale das futuras ainda
  lê a silhueta.
- Chip "Seu nível" presente no header em 390 e 1440, sem quebrar avatar,
  nome, badges nem "Remover foto"; ausente quando não há jornada.
- Fallback squircle coerente com a nova família (Phosphor Lightning,
  não Plant/Tree).

**Motion**
- `badge-salta` permanece para conquistas da estante; faixas de nível
  ganham `nivel-<faixa>-*` próprios, uma vez por gatilho, < 800ms.
- Nenhuma superfície fora de nível muda de animação; `animate-enter`
  continua a entrada padrão de listas.
- Nenhum loop infinito novo (shimmer de idle só se o produto pedir e só
  no raio).

**A11y**
- Estado do nível sempre em texto ("Seu nível", "Alcançada"…) — nunca
  só cor/anel (já vale hoje; manter no chip do header).
- Leitor de tela: imagem `alt=""` + `aria-hidden`; nome+estado+data no
  accessible name (padrão do spec atual, `jovem-conquistas.spec.ts:123-139`).
- Nenhum efeito >3 flashes/s (WCAG 2.3.1) — flicker da Veterania limitado
  e em área pequena; reduced-motion vira fade (Tier 2), pop vira
  fade/scale curto (Tier 3).
- Foco visível no chip (`focus-visible:ring-2` como os demais triggers).

**Performance**
- SVGs gerados ≤ ~8 KB cada, `<img>` estático, sem JS por frame;
  animações só `transform`/`opacity` (+`stroke-dashoffset` pontual).
- Perfil não adiciona waterfalls: `getPdmDaDupla` entra no `Promise.all`
  existente; soma de `duracao_min` é derivação O(n) no cliente.

**Dados/testes**
- `conquistas.test.ts` cobre: limiares novos (combinados≥5, horas com
  dedup `sessao_id`, meta/submeta atingida), futuras com progresso
  honesto, jovem só-especialista sem peças de PDM.
- e2e demo atualizado se a família/títulos mudarem; fixture demo já tem
  `duracao_min` (`demo/data.ts:786-816`) e PDM com atingidas
  (`demo/pdm-data.ts:134-222`).

---

## 7. Riscos e decisões de produto

1. **Escopo da repintura visual.** Só `nivel-*` vira raios, ou toda a
   casa (marcos/contagens) migra pra energia? Recomendado: só nível.
   Risco de consistência se as famílias divergirem demais — mitigar
   mantendo canteiro→pedestal neutro e mesma paleta.
2. **Nomes das faixas.** Hoje Início/Constância/Veterania/Jornada
   completa (tempo). Se a família vira energia, nomes podem seguir
   ("Faísca/Corrente/Voltagem/Sobrecarga" ou manter os atuais). Trocar
   nome quebra o spec e2e (`FAIXAS` hardcoded, `jovem-conquistas.spec.ts:15`)
   — atualizar junto.
3. **Contador × limiar.** `conta:combinados` hoje é um tile que cresce
   ("3 combinados feitos"). Limiar nomeado ("Palavra cumprida") é outra
   peça. Fundir = menos tiles, menos clareza de critério. Manter os dois
   = mais tiles, estante mais cheia (a área "Ainda por vir" cresce).
4. **Horas honestas.** `duracao_min` null existe (retroativo antigo,
   registro sem duração). Opções: (a) contar só registradas — critério
   diz "horas registradas"; (b) assumir 60min — viola "não inventar
   número". Recomendo (a). Se nulls forem comuns em staging/prod, a
   conquista de 7h fica sub-contada — medir antes de travar o limiar.
5. **Sessão combinada infla horas se somar por row** — dedup por
   `sessao_id` obrigatório na derivação (detalhe fácil de errar).
6. **Nível no header: gesto.** O chip abre `FaixaDetalhe` (Dialog) ou é
   link âncora pra `#conquistas`? Dialog é consistente com as peças;
   âncora é mais simples (server, sem client). Recomendo Dialog reutilizando
   `FaixaDetalhe` — exige extrair o componente pra uso nos dois lugares.
7. **"Próximo nível" duplicado.** Com o nível no header, o bloco
   `NivelBloco` dentro do card pode ficar redundante — opção: o card
   mantém régua+progresso, o header é só o selo. Ou o card some com a
   vitrine grande. Decidir.
8. **Celebração de level-up.** Toast/dialog quando cruza faixa —
   replicar `MarcoNotifier` (baseline localStorage) pro jovem? Fora do
   pedido estrito, mas é o "momento" que o usuário provavelmente espera
   de "nível". Barato de adicionar depois; decidir se entra na fatia.
9. **Raridade.** Se adotada, é só peso visual (anel/tamanho no detalhe) —
   não ordena a estante (cronológica hoje). Sem esquema de pontos/ranking
   (fora de escopo 016, reafirmar).

---

## 8. SQL sugerido (NÃO aplicar — alçada do lead)

Nenhum DDL é necessário para os pedidos desta rodada. O único ganho real
seria datar o combinado feito; se o lead quiser:

```sql
-- SUGESTÃO para o lead revisar/numerar — NÃO aplicar.
-- Datar a conclusão do combinado: hoje jovem_encaminhamentos não expõe
-- quando o jovem marcou feito (a conquista fica sem carimbo).

alter table public.encaminhamentos
  add column if not exists feito_em timestamptz;

-- marcar_combinado (0070) passa a carimbar/limpar junto do flip:
--   set status = case when p_feito then 'feito' else 'pendente' end,
--       feito_em = case when p_feito then now() else null end
-- e a view ganha a coluna:
create or replace view public.jovem_encaminhamentos as
select e.id, e.dupla_id, e.descricao, e.prazo, e.status, e.feito_em, e.created_at
from public.encaminhamentos e
where public.my_role() = 'mentorado'
  and e.responsavel = 'mentorado'
  and exists (
    select 1 from public.duplas d
    where d.id = e.dupla_id
      and d.mentorado_id = public.my_mentorado_id()
  );
```

- Alternativa sem coluna nova: expor `registros.created_at` via
  `registro_id` como proxy da data — frágil (combinado pode ser feito sem
  registro posterior). A coluna é o caminho honesto.
- Se a decisão for persistir "quando cada conquista cruzou" (para ordenar
  a estante sem depender de carimbos terceiros), aí sim nasce uma
  `conquistas_ganhas(mentorado_id, chave, ganha_em)` — mas a spec 016 já
  decidiu derivação pura; manter essa linha.
