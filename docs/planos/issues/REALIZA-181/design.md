# Design — REALIZA-181 PDM nativo

Framework: `.devin/skills/ux-review/SKILL.md`. Pergunta central: *quanto tempo
o usuário leva pra detectar o que importa, entender a causa e executar a
próxima ação?*

## Persona + JTBD

| Persona | Pergunta nos primeiros 5s | Job |
|---|---|---|
| **Mentor DPP** (ficha, durante o encontro) | "Como tá o plano dela? O que a gente revisa hoje?" | Construir o PDM junto, marcar progresso, repriorizar |
| **Mentorado** (`/jovem/pdm`, celular) | "O que eu preciso fazer agora? O que já consegui?" | Ver o próprio plano, marcar conquistas, ajustar |
| **Coord/Supervisor** (ficha, fora do encontro) | "Essa dupla tem plano? Tá andando?" | Leitura — saúde do plano sem editar |

PDM é o documento central do ciclo (guia DPP §6): visão → metas SMART →
submetas. Ele é **vivo** — não uma ficha de leitura.

## Anatomia — seção "Plano de desenvolvimento" (ficha da dupla)

Nova `<section>` após `InstrumentosDupla` em
`src/app/(app)/duplas/[id]/page.tsx` (o comentário-âncora "PDM nativo" já
está lá desde `0098`). Reuso do padrão visual das seções da ficha
(`rounded-xl bg-card p-4 shadow-[var(--shadow-border)]` — vide
`resumo-jornada.tsx:21`).

```
┌ Plano de desenvolvimento ────────────────────────── [editar | só leitura]
│ "Declaração de Visão" — blockquote (padrão Declaracao de
│   instrumento-resultado.tsx:50 — border-l-2 brand-lime bg/5)
│   vazio → CTA "Escrever a Declaração de Visão" (editor inline textarea)
│
│ ████████░░ 6 de 10 submetas · 2 de 4 metas atingidas     ← barra de
│                                                          progresso do plano
│ Meta 1 · a mais importante                    [atingida ✓ 12/mar]  [CaretDown]
│ ├─ submeta a                                    [✓]
│ ├─ submeta b                          prazo 30/abr      [ ]
│ │   └─ sub-submeta c                            [ ]
│ └─ + adicionar submeta
│ Meta 2 ...
│ + Adicionar meta            (cap: "até 10 metas — priorize")
└──────────────────────────────────────────────────────────────────
```

**Hierarquia:** visão (o norte) → progresso (a saúde em 1 olhada) → metas
em ordem de prioridade (a operação). Ação primária contextual: editar
o item sob o cursor, nunca um menu global.

### Anatomia do item (meta e submeta compartilham)

Linha compacta, alvo de toque ≥40px:

```
[checkbox] Título da meta                    [Badge área] [prazo] [⋮]
           Indicador: "quando X acontecer"   ← linha secundária muted
```

- **Checkbox** marca `atingida` → revela o carimbo "atingida em 12/mar"
  (`date`, default hoje — `pdm_status_item` carimba `now()`; sem edição de
  data na v1, registrar quando aconteceu é o gesto; se precisar de data
  retroativa, edita via suporte — ver decisões). Desmarcar volta pra
  `ativa` e limpa o carimbo.
- **Badge `area_vida`**: `Badge` (`src/components/ui/badge.tsx`) neutro com
  o rótulo da área da Roda (as 16 do form `roda_vida`, `0080:638+`) ou
  "Outra".
- **Prazo**: `prazo_alvo` dd/mm; vencido e não atingida → `text-[var(--warn-text)]`
  "prazo 30/abr (venceu há 12 d)" — atenção, não alarme.
- **Menu `⋮`** (`dropdown-menu.tsx`): Editar · Reordenar ↑/↓ · Adicionar
  submeta aqui · Descartar · Apagar. Em mobile o mesmo menu — **sem
  drag-and-drop** (141: "mobile precisa funcionar"): ↑↓ move entre irmãos
  e `pdm_reordenar` persiste a nova posição.
- **SMART inline:** campos editáveis ao expandir o item: título (input),
  porque (textarea), indicador (input "como você vai saber que cumpriu?"),
  área (select das 16+Outra), prazo (`input type=date`). Dica do guia no
  placeholder da meta: "comece com um verbo — Concluir, Aprender…" (echo do
  seed `0080:590`).

### Árvore recursiva — a parte delicada (142)

- **Indentação leve:** cada nível = `pl-4` + trilha vertical sutil
  (`border-l border-border/60` no bloco de filhos) — a hierarquia se lê
  pela borda, não por deslocamento agressivo.
- **Collapse por nó:** `CaretDown/CaretRight` (Phosphor) no item com filhos;
  estado de expansão em memória (não persiste — sessão basta).
- **Profundidade:** renderiza tudo (modelo não limita); a partir do 4º
  nível o indent para de crescer e um badge `nível 4` no item orienta —
  evita "vira-lâmina" sem esconder dado (142 aberta → decidido no sdd D7).
- **"Adicionar dentro desta"** (do item) cria filho direto — nunca um modo
  global "nova submeta solta".
- **Caps visíveis:** contador discreto "4 de 10 metas"; botão desabilita
  com tooltip no limite ("Limite de 10 metas — priorize as que ficam").

### Prioridade = posição (141)

- Sem `meta_principal`: a **primeira meta é a mais importante** — copy no
  header da lista: *"A ordem é a prioridade: a primeira meta é a mais
  importante agora."* Reordenar ↑↓ = repriorizar.
- Item raiz mostra `Meta {ordem}` muted no canto (echo de
  `instrumento-resultado.tsx:229`); mudou de posição → número muda.

## Superfícies

### 1. Ficha da dupla `/duplas/[id]` — editor

- `podeEditar`: `souMentorDaDupla` (mentor da dupla logado). Coord e
  supervisor: mesma seção `podeEditar=false` — checkboxes e menus somem,
  mantendo visão/progresso/árvore (regra 4: coord lê conteúdo; supervisor
  como mentor — leitura).
- Dupla `concluida`/`encerrada` ou trilha `especialista`: leitura pra todos
  (documento congelado; especialista nem seção mostra — sem PDM no guia).
- Empty (sem `pdm` ainda): não é zero-state morto — *"O PDM nasce das
  rodadas de instrumento (Visão → Metas → PDM) ou começa aqui"* + botão
  "Começar o PDM" (cria via primeiro `pdm_salvar_visao`/item).

### 2. Portal do jovem `/jovem/pdm` `[NOVO]`

- Co-edição plena — o jovem é autor (decisão fechada; ele já loga, `0066`).
  Mesmo `<PdmDupla>` da ficha com `podeEditar=true`, dentro do
  `jovem-shell` (sem entrada nova na nav de 6 slots — `jovem-shell.tsx:34-39`;
  chega pela estação "PDM" de Minha jornada e por link do `/jovem`).
- Tom adaptado: primeira pessoa (*"meu plano"*, *"o que eu quero conquistar"*),
  copy de incentivo do guia.
- Empty: *"Seu Plano de Desenvolvimento nasce das atividades com seu mentor —
  quando a resposta do instrumento chegar, ele aparece aqui. Quer adiantar?
  Comece pela Declaração de Visão."*

### 3. Resumo da jornada / retrospectiva (ficha + encerramento)

- `ResumoJornadaSection` (`src/components/resumo-jornada.tsx`) ganha 5º card
  na grid `dl` (`:44`): **PDM** — "X de Y" metas atingidas; sub-linha "N
  submetas concluídas". Abaixo, lista das metas atingidas com `atingida_em`
  (dd/mm) — a retrospectiva pedida em 142, dentro do bloco que já vira
  snapshot `encerramentos.resumo_jornada` (`actions-encerramento.ts:168`) e
  sai no print (`ImprimirButton`).
- Checklist `revisao_pdm` (`src/lib/encerramento.ts:38`) segue marcação
  manual — decisão sdd D7 (o rito é revisar juntos; o resumo traz os dados
  pra essa conversa).

### 4. Instrumentos respondidos (legado visível)

`InstrumentoResultado`/`MetasResultado`
(`src/components/instrumento-resultado.tsx:161`) **não muda de cara** — é a
vista do snapshot "o que foi respondido na rodada". Respostas antigas com
`meta_principal`/`rev_*` continuam renderizando (campos ausentes do form
novo simplesmente não rotulam — `campos.find`→`respostaFormatada`, sem
crash). A diferença: acima/ao lado, o PDM vivo mostra o estado atual.

## Estados

| Estado | Ficha | Jovem |
|---|---|---|
| Sem PDM | empty + "Começar o PDM" (ou "aguarda a 1ª rodada") | empty orientando (acima) |
| Loading | `Skeleton` (`ui/skeleton.tsx`) 3 linhas | idem |
| Erro RPC | card erro + "tentar de novo" | idem |
| Cap atingido | botão meta/submeta desabilitado + tooltip | idem |
| Sem permissão | `podeEditar=false` — sem controles | nunca (sempre edita o seu) |
| Prazo vencido | warn text no item | idem |
| Tudo atingido | 🎉 contido: barra 100% + "plano cumprido" | idem |
| Pós-ação | `Sonner` toast ("Meta marcada como atingida") + refresh do dado — optimistic update local com rollback no erro |

## Componentes reutilizados (nada novo de UI kit)

`src/components/ui/`: `button`, `badge`, `card`, `input`, `textarea`,
`select`, `dialog` (confirmação de apagar), `dropdown-menu` (menu do item),
`skeleton`, `tooltip`, `sonner`. Checkbox = `<input type="checkbox">` puro —
é o padrão da casa (`jovem-combinados.tsx:67`, `registro-form.tsx:594`),
não existe `ui/checkbox`. `Sonner` via `ui/sonner`.
Phosphor: `CaretDown/Right`, `Plus`, `DotsThree`, `CheckCircle`, `FlagBanner`.
**Sem lib nova** — árvore é recursão de componente + Tailwind; sem DnD.

## Microcopy (pt-BR real)

- Seção: "Plano de desenvolvimento" / sub: "o documento vivo da dupla —
  visão, metas e o caminho até elas"
- Visão vazia: "Escrever a Declaração de Visão — a frase que dá norte a
  todas as metas"
- Meta nova: título `"Ex.: Concluir o ensino médio"`; indicador
  `"Como você vai saber que cumpriu? Ex.: boletim com aprovação"`
- Prioridade: "A ordem é a prioridade — a primeira meta é a mais
  importante agora."
- Atingida: toast `"Meta marcada como atingida em hoje"` / item
  `"atingida em 12 de mar"`
- Cap: `"Limite de 10 metas — priorize as que ficam"` / `"Limite de ~20
  submetas no plano"`
- Apagar: dialog `"Apagar "Concluir o EM" e suas 3 submetas? Pra registrar
  que desistiram, prefira "Descartar" — fica no histórico."`

## A11y

- Árvore com `role="tree"`, itens `role="treeitem"` + `aria-expanded` nos
  com filhos — navegação de setas segue o padrão treeview.
- Checkbox `aria-label="Marcar <título> como atingida"`.
- ↑↓ `aria-label="Mover <título> para cima/baixo"`; resultado anunciado
  (`aria-live="polite"` "Meta agora é a 2ª prioridade").
- Alvos de toque ≥40px (mobile-first do `/f/[token]`); contraste
  `text-muted-foreground` só em metadado, nunca em ação/estado decisório.
- Focus ring visível nos controles inline (padrão `globals.css`).

## Layout mobile → desktop

- Mobile: uma coluna; meta = card, filhos dentro da borda-esquerda; menu
  `⋮` bottom-sheet do `dropdown-menu` (Base UI já trata).
- Desktop (`sm:`): a seção ocupa a largura da coluna de conteúdo da ficha;
  indicador+prazo do item vão pra linha lateral direita (`sm:flex-row`);
  editor inline em 2 colunas (`sm:grid-cols-2` nos campos SMART).
