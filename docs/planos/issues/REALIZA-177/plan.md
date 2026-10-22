# REALIZA-177 — plano do sweep

## Roteiro

### Fase 0 — inventário completo (artefato do PR)

Gerar a lista exaustiva dos `DialogContent`:

```sh
grep -rn "DialogContent" src/ | grep -v "ui/dialog"
# + largura atual de cada um:
grep -rn "DialogContent className" src/ | grep -o "sm:max-w-[a-z0-9]*"
```

Tabela no corpo do PR: `arquivo | largura hoje | degrau novo | justificativa`.
Os ~51 arquivos já foram mapeados na README — a tabela consolida.

### Fase 1 — remover redundância (diffs mecânicos)

Remover `max-h-[85vh]`, `max-h-[90dvh]`, `overflow-y-auto` que duplicam a
base (`ui/dialog.tsx:56` já tem `max-h-[calc(100dvh-2rem)] overflow-y-auto`):

- `src/components/evento-cronograma-dialog.tsx:72` — `max-h-[90dvh]
  overflow-y-auto` fora.
- `src/components/jornada-rever.tsx:54` — `max-h-[85vh] overflow-y-auto`
  fora (largura revista na fase 2).
- `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx:213` — idem.
- Audit restante: `grep -rn "max-h-\[" src/ | grep -i dialog` e
  `overflow-y-auto` por instância.

### Fase 2 — reclassificar larguras

Conforme `design.md` → tabela de degraus. Confirmados imediatos:
`registros-filtros` lg→md. Os "a verificar" (`pessoas-dialogs`,
`enviar-termos`, `jornada-rever`, `instrumentos-dupla`, `importar-registros`)
— abrir cada um em demo/staging e decidir com screenshot no PR.

### Fase 3 — auditoria a11y

```sh
# todo DialogContent deve ter DialogTitle e DialogDescription no mesmo arquivo
grep -rln "DialogContent" src/ | while read f; do
  grep -L "DialogTitle" "$f"; done
```

Cada sem `DialogTitle`/`Description` ganha (a11y obrigatória). `DialogFooter`
só onde faz sentido — não forçar.

### Fase 4 — smoke visual

`entrarNaDemo` em cada papel + abrir os dialogs-chave (novo-material,
enviar-formulario, remanejar, encerrar-dupla, registros-filtros,
importar-csv, importar-registros) → comparar largura/densidade.

## Arquivos

- `src/components/ui/dialog.tsx` — **sem mudança** na base (a escala vive
  nas instâncias; se quisermos convenção, adicionar comment-block com a
  tabela de degraus — opcional).
- Os ~51 arquivos listados — mudanças de `className` somente.

## Risco / rollback

Mudança de `className` por arquivo — diff grande, risco baixo. Breakpoints
mobile não mudam (`max-w-[calc(100%-2rem)]` da base). Rollback = revert.

## Gates

`tsc` · `eslint` · `pnpm test` · e2e demo+app completos — dialogs são
exercitados por dezenas de specs; qualquer quebra de role/nome aparece.
