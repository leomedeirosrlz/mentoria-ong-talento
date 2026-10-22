# REALIZA-157 — Ficha da dupla: itens do menu "Mais" não preenchem a largura

**Status: aberto (provável).** A composição atual é frágil o suficiente para
produzir esse defeito — e há uma simplificação que o elimina de qualquer forma.

## O que o código faz hoje

`src/app/(app)/duplas/[id]/page.tsx`:

- `:897-917` — o menu "Mais" usa `MenuPrimitive.Popup` **na mão** com a classe
  local `MENU_POPUP` (`w-56 min-w-32 … p-1`), não o `DropdownMenuContent`
  compartilhado, porque precisa de `keepMounted` — os itens são
  `DialogTrigger`s e os dialogs morrem com o popup se ele desmontar.
- `:562-649` — `maisItens` monta 5+ itens, cada um
  `Dialog > DialogTrigger render={<DropdownMenuItem render={<button/>} nativeButton/>}`.
- `src/components/ui/dropdown-menu.tsx:75-100` — `DropdownMenuItem` já traz
  `relative flex w-full items-center gap-1.5 …`.

Em teoria `w-full` deveria bastar — mas a composição
`Dialog.Trigger render={Menu.Item}` cria um botão híbrido trigger×menuitem
dentro de um provider (`Dialog.Root`) no meio da árvore de itens do `Menu`.
Qualquer divergência de render (portal, registry de itens, props mescladas)
pode quebrar o fill/foco/seta. O bug relatado é consistente com isso.

## Proposta em uma linha

**Tirar os dialogs de dentro do popup**: os itens viram `DropdownMenuItem`
simples com `onClick` que seta estado na página; os 5 dialogs ficam no nível
da página, controlados por `open`/`onOpenChange`. Com dialogs fora do menu,
o `keepMounted` deixa de ser necessário e o popup volta a ser o
`DropdownMenuContent` padrão — matando o defeito e simplificando a estrutura.

## Decisão

Tier B, direcional — a verificar em runtime só para confirmar o sintoma
exato (fill vs. alinhamento vs. foco), não para escolher a abordagem.
