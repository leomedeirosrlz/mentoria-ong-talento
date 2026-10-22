# REALIZA-66 — plan.md

## Passo 0 — helper puro + wrapper browser

`src/lib/imagem.ts` [NOVO] — duas camadas:

```ts
// puro/testável (Vitest): decide e calcula dimensões
export function ehImagemComprimivel(mime: string): boolean
// image/jpeg | image/png | image/webp — pdf/svg/heic = false
export function dimensoesFinais(w: number, h: number, max = 1600):
  { w: number; h: number }   // contain, nunca upscale

// browser (canvas):
export async function comprimirImagem(file: File): Promise<File>
```

`comprimirImagem`:
1. `ehImagemComprimivel(file.type)` false → devolve `file` intacto.
2. `createImageBitmap(file, { imageOrientation: "from-image" })` →
   `OffscreenCanvas`/`canvas` com `dimensoesFinais` → `ctx.drawImage` →
   `toBlob("image/webp", 0.8)` (loop q 0.8→0.6 se resultado > 1MB —
   `a verificar` se necessário; decidir na implementação com foto real
   de celular).
3. Falha em qualquer passo (bitmap, canvas, blob null, iOS sem API) →
   **catch → devolve `file` original** (invariante: compressão nunca
   bloqueia upload).
4. Resultado: `File` novo, nome `base.webp`, `type: image/webp`.
   Se o original já for ≤ ~400KB **e** jpeg/webp → devolve original
   (comprimir não compensa — `dimensoesFinais` intactas).

## Passo 1 — pontos de integração (em ordem de dor)

| Componente | Hoje | Integração |
|---|---|---|
| `src/components/anexos-registro.tsx` | File→FormData direto na action | `comprimirImagem(file)` antes de anexar; toast "Comprimindo…" só se demorar? — não: silencioso, é <1s |
| `src/components/chamado-anexos.tsx` | idem | idem |
| `src/components/documento-pessoa.tsx` | idem (20MB) | idem |
| `src/components/foto-field.tsx` | avatar 2MB | idem — avatar comprimido vira ~80KB |
| Campo `arquivo` do form (REALIZA-36) | — | integra desde o nascimento |

Regra: comprimir **uma vez**, na entrada (onChange/input), não na action
— a UI mostra o tamanho **comprimido** ao usuário.

## Passo 2 — UX honesta

- O `tamanho` exibido (`formatTamanho` em `ciclo.ts`) e validado é o do
  arquivo **final** (webp) — cap de 10MB agora raramente atinge.
- Hint de tipos continua "PDF, PNG, JPG ou WebP" — webp já é aceito
  (allowlist `TIPOS_ACEITOS` em `anexos-registro.tsx` inclui `image/webp`
  — **a verificar** nos outros 3 componentes; se faltar, adicionar).
- Nenhum texto novo de "comprimido" — transparência não exige ruído.

## Passo 3 — servidor/banco (nada muda)

- Caps e allowlists do servidor **continuam** valendo o arquivo final —
  nenhuma migration. Buckets/policies/signed URLs intactos.
- `saneiaNome` já troca extensão — garantir `.webp` no path
  (`nome.webp`), não `nome.jpg` com conteúdo webp.

## Passo 4 — testes

- Vitest (puro): `ehImagemComprimivel` (pdf/svg/heic false),
  `dimensoesFinais` (4000×3000→1600×1200; 800×600 não upscale).
- e2e app: anexar JPG real ~3MB no registro → o objeto no bucket é
  `.webp` < 1MB (assert via size da resposta ou metadata).
- Fallback: simular `createImageBitmap` throw → upload segue com o
  original (unit test da action com mock).

## Ordem

1 PR só (helper + 4 integrações + testes). Rollback = revert — uploads
voltam a subir original; nada gravado muda shape (webp já é aceito
everywhere que imagem entra).
