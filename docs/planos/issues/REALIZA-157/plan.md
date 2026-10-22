# REALIZA-157 — plano

## Objetivo

Menu "Mais" da ficha da dupla com itens que preenchem a largura do dropdown e
estado de foco correto — eliminando a composição frágil `Dialog.Trigger
render={Menu.Item}`.

## Passo 0 — reproduzir (10 min)

`entrarNaDemo("coordenacao")` → `/duplas/de000000-0000-4000-8000-000000001539`
→ clicar "Mais" → inspecionar largura/role dos `.dropdown-menu-item` vs.
popup. Registrar screenshot no PR. Se o bug não reproduzir, a refatoração
abaixo ainda vale (remove a fragilidade e o `keepMounted` hand-rolled) —
decisão já registrada na README.

## Refatoração em `src/app/(app)/duplas/[id]/page.tsx`

1. **Estado de dialog na página** — introduzir
   `const [dialogAberto, setDialogAberto] = useState<"agendar" | "form" | "esp" | "sugerir-esp" | "encerrar-esp" | null>(null)`
   (ou um `useState` por dialog, se o código local já favorecer).
2. **Popup volta ao padrão** — trocar o par `MenuPrimitive.Portal +
   MenuPrimitive.Positioner + MenuPrimitive.Popup (MENU_POPUP)` por
   `<DropdownMenuContent align="end" className="w-56">`. Remover `MENU_POPUP`
   e o comentário que o justifica (`:897-917`, e a definição da const).
3. **Itens simples** — em `maisItens` (`:562-649`), cada push vira
   `<DropdownMenuItem key=… onClick={() => setDialogAberto("…")}>…</DropdownMenuItem>`
   — sem `Dialog`/`DialogTrigger` wrapper. `DropdownMenuItem` já é
   `flex w-full items-center` (`ui/dropdown-menu.tsx:75-100`) → fill garantido.
4. **Dialogs fora do menu** — renderizar os 5 (`AgendarEncontroDialog`,
   `EnviarFormularioDialog`, `SolicitarEspecialistaDialog`,
   `SugerirEspecialistaDialog`, `EncerrarTrilhaDialog`) como irmãos, ao lado
   de `RemanejarDuplaDialog` (`:895`), cada um controlado por
   `open={dialogAberto === "…"} onOpenChange={…}`. Verificar a prop `trigger`
   opcional de cada dialog — hoje eles aceitam `trigger` (ver
   `agendar-encontro-dialog.tsx:238-247`); se `trigger` for obrigatório,
   tornar opcional (`trigger?: ReactNode` e renderizar `<DialogTrigger>` só
   quando houver).

## Alternativas descartadas

- Manter `keepMounted` e só ajustar CSS: deixa a composição frágil e um popup
  fora do padrão `DropdownMenuContent`.
- `DropdownMenuItem render={<DialogTrigger…>}` na ordem inversa: mesma
  mistura de responsabilidades, só troca o lugar do bug.

## Arquivos

- `src/app/(app)/duplas/[id]/page.tsx` — único editável.
- `src/components/ui/dropdown-menu.tsx` — **sem mudança** (item já é w-full).
- Possivelmente `trigger?` opcional nos 5 dialogs citados.

## Risco / rollback

Pequeno. Rollback = revert do PR. Cuidado: os specs e2e clicam
`page.getByRole("button", { name: "Mais" })` e depois o menuitem pelo nome —
a mudança preserva role+label, não deve quebrar (`tests/e2e/app/formularios.spec.ts:35-39`,
`solicitacao-esp.spec.ts:230`).

## Gates

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · e2e demo + app
(`formularios`, `solicitacao-esp`, `instrumentos`, `jovem-especialista-wp6`,
`operacional` — todos abrem o "Mais").
