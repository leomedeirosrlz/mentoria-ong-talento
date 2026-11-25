# Spec — Biblioteca: alternar cards com preview × lista compacta

**Feature:** `specs/029-biblioteca-views-preview` · **Status:** Draft para revisão
**Fila:** rodada UI/UX 24/nov/2026 · **Dono:** Thiago · **Data:** 24/11/2026

> Pedido do usuário: o mentorado sem dupla vê cards com preview dinâmico de PDF em `/jovem/materiais`; mentores e coordenação só têm lista simples. Adicionar um alternador de view, com cards/preview e lista, principalmente no mobile. Esta spec avalia o comportamento e define o alvo antes de codar.

## Problema e resultado

- **Dor hoje:** a mesma biblioteca tem duas gramáticas incompatíveis. O jovem vê cards com `MaterialThumb` (PDF lazy, imagem ou faixa de link) e o card inteiro é o gesto (`src/app/(jovem)/jovem/materiais/page.tsx`, `MaterialCard`); staff vê `BibliotecaLista`/`MateriaisMentorBiblioteca` em linhas com ícone (`src/components/biblioteca-lista.tsx`, `src/components/materiais-mentor-biblioteca.tsx`), sem preview. O mentorado sem dupla cai no fallback da biblioteca plana do jovem e continua vendo os cards — não é vazamento: o gate é de audiência (`veMaterial` + `/api/material/[id]`), não de pareamento. A diferença é de **view**, não de permissão.
- **Resultado observável:** as duas superfícies ganham um alternador persistente **Cartões / Lista**. Cartões usam `MaterialThumb` com lazy preview e ações; Lista preserva a densidade operacional de hoje. No mobile, a lista é o default (evita vários iframes/scroll longo) e o cartão é opt-in; no desktop, cada superfície mantém seu default atual (jovem: cartões; staff: lista) até o usuário trocar.
- **Como saberemos que funcionou:** staff e coord conseguem ver o preview do PDF sem sair da biblioteca; o jovem consegue trocar para lista; a escolha sobrevive ao reload; a lista não monta nenhum iframe; 390px não tem scroll horizontal; o material sem audiência continua 404 no `/api/material/[id]`.

## Fora de escopo

- Mudar a regra de audiência ou o gate de `/api/material/[id]` — o PDF continua autorizado por `veMaterial`/storage; o toggle não amplia acesso.
- Transformar toda a biblioteca em um CMS ou mudar o catálogo/ordem dos materiais.
- Preview de PDF em `iframe` em navegadores que não embutem PDF (Android/iOS): o fallback de ícone de `usePdfEmbute` continua.
- Editor de material, upload, `MaterialActions` e leitura registrada (`material_leituras`) por view: os dois modos preservam o mesmo contrato.
- Unificar a curadoria do mentor (`MateriaisMentorBiblioteca` por turma/encontro) com a lista da coordenação; o alternador convive com os agrupamentos existentes.

## Histórias de usuário

### US1 — Alternador Cards/Lista em todas as bibliotecas (P1)
- **Dado** a biblioteca do jovem, do mentor ou da coordenação **quando** a página abre **então** há um controle segmentado “Cartões / Lista” com ícones, `aria-pressed`, foco visível e alvo ≥44px no mobile.
- **Dado** um viewport 390px **quando** abre pela primeira vez **então** o default é **Lista**; em ≥768px, jovem abre em Cartões e staff em Lista (defaults atuais preservados).
- **Dado** que o usuário troca a view **quando** recarrega ou volta à página **então** a preferência persiste (localStorage por superfície: jovem × staff; nunca cookie de sessão nem banco).
- **Dado** busca, seção, contagem, selo “lido” e `⋯` **quando** troca a view **então** tudo continua no mesmo estado; nenhum item duplica ou some.

### US2 — Cards com preview seguro (P1)
- **Dado** um material com PDF **quando** a view Cartões renderiza **então** a capa usa `MaterialThumb`/`PreviewPdf` lazy (IntersectionObserver), `aria-hidden`, `pointer-events-none`, sem scroll interno e com fallback de ícone quando o browser não embute.
- **Dado** material com imagem ou link externo **quando** renderiza **então** segue a mesma tríade do card do jovem (imagem / faixa do domínio / estado “em breve”).
- **Dado** staff ou coordenação **quando** clica no card **então** o destino é o mesmo da linha atual; `MaterialActions` da coordenação fica **fora** do `<a>`, no canto, como no card do jovem.
- **Dado** material sem audiência **quando** o card tenta abrir **então** `/api/material/[id]` responde 404/erro honesto — o toggle não contorna autorização.

### US3 — Lista compacta e mobile (P1)
- **Dado** a view Lista **quando** renderiza **então** nenhum `iframe`/imagem de preview é montado (só ícone do tipo), preservando a performance em listas longas.
- **Dado** 390px **quando** a lista renderiza **então** título, meta, selo lido, ações e link não estouram a largura; o alternador fica na mesma linha do título ou logo abaixo, sem empurrar o conteúdo.
- **Dado** leitor de tela **quando** alterna **então** anuncia “Cartões”/“Lista” e o total de itens; a view não muda o nome acessível de cada item.

## Casos de borda

- Mentorado sem dupla: continua vendo a biblioteca por audiência; o default mobile é Lista, o desktop é Cartões, e o toggle não depende de dupla/cargo.
- Coordenação com `MaterialActions`: no card, o menu não pode ficar aninhado no link; no mobile, alvo ≥44px.
- Muitos PDFs: cards montam preview só quando entram perto do viewport; trocar para Lista desmonta/mantém? A view Lista **não monta** preview; voltar a Cartões remonta lazy.
- PDF que não embute: ícone de fallback; o card continua clicável pelo link.
- Busca vazia: estado vazio identifica a busca e “Limpar”; alternador não desaparece.
- Preferência inválida/corrompida no localStorage: cai no default da viewport sem erro.
- Deep link de material/leitura: não muda; o toggle é estado de apresentação.

## Requisitos funcionais

- **FR-001:** criar um `BibliotecaViewToggle` compartilhado (client) com duas views `cards`/`list`, ícones (`SquaresFour`/`List`), labels acessíveis, `aria-pressed`, foco visível e persistência por `localStorage` (`biblioteca:view:jovem` / `biblioteca:view:staff`). SSR deve hidratar sem mismatch; o default é resolvido após mount (ou via script mínimo) e não deve piscar conteúdo errado.
- **FR-002:** defaults: jovem ≥768px = cards; staff/coord ≥768px = list; ambos <768px = list. A preferência explícita do usuário vence o default em qualquer largura.
- **FR-003:** a view Cards reutiliza a anatomia de `MaterialCard` do jovem (capa + linha + `MaterialActions` fora do link) e `MaterialThumb`/`PreviewPdf`; a view Lista reutiliza `BibliotecaLista`/`Linha` sem preview. Não criar uma terceira anatomia de card.
- **FR-004:** a lista não monta `iframe`/`<img>` de preview; os cards só montam preview via IO/lazy e respeitam `usePdfEmbute`. Nenhuma mudança no `/api/material/[id]`, `veMaterial`, RLS/storage ou leitura registrada.
- **FR-005:** busca, seções, contagem, “lido”, `⋯`, ordenação e agrupamento por encontro/turma sobrevivem à troca; a view preferida não altera a URL nem o histórico (sem `router.replace`).
- **FR-006:** mobile 390px: alternador e cards em 1 coluna; preview ≤96px na estante e ≥? no card de staff; sem overflow horizontal; alvos ≥44px; menu de ações fora do link.
- **FR-007:** acessibilidade: o alternador é um grupo com nome (“Modo de visualização”), botões `aria-pressed`, anúncio do total; cards têm um link único com nome acessível; a lista mantém a linha inteira como gesto; `prefers-reduced-motion` não anima a troca além de um fade curto.
- **FR-008:** demo parity: as duas superfícies mostram o mesmo toggle e o unpaired mentorado continua vendo a biblioteca; staff/coord veem o preview em Cartões no demo.
- **FR-009:** telemetria (opcional): evento `biblioteca_view` com `view`, `superficie`, sem conteúdo; não bloqueia a troca.

## Requisitos não funcionais

- **Perf:** lista = zero preview; cards = IO com `rootMargin` já existente; PDFs em iframe fora da tela não montam; nenhuma dependência nova.
- **A11y:** alvos, foco, labels e anúncio de estado; cards não aninhados em links; `aria-hidden` nos previews decorativos.
- **Design:** um único card/lista compartilhado; a gramática atual (`rounded-xl`, `--shadow-border`, faixa de tipo) não muda. O alternador é discreto, não um segundo header.
- **Demo/RLS:** o gate de audiência não muda; unpaired é comportamento legítimo, não bug.

## Critérios de sucesso

- **SC-001:** demo e app: jovem, mentor e coordenação conseguem alternar Cartões/Lista; a escolha persiste após reload; defaults por viewport corretos.
- **SC-002:** staff/coord veem preview de PDF em Cartões (desktop) e o fallback de ícone no mobile; `/api/material/[id]` continua 404 para material fora da audiência.
- **SC-003:** view Lista não tem nenhum `iframe`/imagem de preview no DOM; view Cards monta no máximo os previews próximos do viewport.
- **SC-004:** 390px sem scroll horizontal; toggle, cards e ações com alvos ≥44px; leitor de tela anuncia o modo e a contagem.
- **SC-005:** busca/seções/lido/`⋯` preservados na troca; demo parity e e2e de staff/jovem verdes.

## Plano de testes

- Unit/jsdom: resolução de default por viewport + persistência; lista não renderiza thumb; cards renderizam fallback/lazy.
- E2E demo: toggle nas três personas; persistência; 390px; PDF preview staff; unpaired mentorado.
- E2E app: coord/mentor alternam e abrem material; material sem audiência 404; nenhuma regressão de leitura.
- Visual: prints 1440×900 e 390×844 das duas views em staff e jovem.

## Decisões de produto

1. Default mobile = Lista e desktop = comportamento atual (recomendado) — confirmar se o jovem também deve abrir Cards no mobile.
2. O alternador deve aparecer no cabeçalho da biblioteca ou junto do título de cada seção? Recomendado: um único controle no topo da biblioteca, não por seção.
3. Coordenação: manter `MaterialActions` no card como menu flutuante (recomendado) ou ocultar no mobile e deixar só na lista?
