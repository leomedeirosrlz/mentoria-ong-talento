# REALIZA-66 — Upload de evidências: compressão client-side (canvas → WebP)

[Jira REALIZA-66](https://realizavc.atlassian.net/browse/REALIZA-66)

**Status: PARCIAL** — os caps de upload já existem e estão certos; falta
**compressão client-side** (canvas → WebP) antes do upload de imagens de
evidência. Storage Supabase free-tier tem ~1GB — foto de celular de 8MB
vira ~200KB.

## Já existe (não refazer)

- Caps por superfície: avatar 2MB (`foto-field.tsx`/`subirFoto`),
  assinatura PNG 1MB, anexos de registro 10MB
  (`src/components/anexos-registro.tsx` — `LIMITE_BYTES = 10MB`,
  allowlist `pdf/png/jpeg/webp`), anexos de chamado 10MB, documentos de
  pessoa/currículo/materiais 20MB.
- Buckets privados + signed URL em `/api/anexo/[id]`,
  `/api/chamado-anexo/[id]`, `/api/documento/[id]`, `/api/material/[id]`.
- Validação client de tamanho com toast em pt-BR.

## Restante (escopo)

Compressão **client-side** de imagens antes do upload — canvas →
`image/webp` — nas superfícies de **evidência** (`registro-anexos`,
`chamado-anexos`, e campo `arquivo` de forms do REALIZA-36) e, por
consistência, fotos/documentos. PDFs **nunca** comprimem. Falha de
compressão → sobe o original (comportamento atual preservado).

## Dependências

- Relacionado: REALIZA-36 (`arquivo` herda o helper), REALIZA-69/70
  (intake recebe documentos).
- Sem dependência de código externo — zero lib nova (canvas nativo).

## Esforço estimado: **P–M**

Um helper `src/lib/imagem.ts` [NOVO] + integração em ~3 componentes +
testes. M pela cobertura de superfícies e edge cases mobile.

## Riscos

- `createImageBitmap`/canvas em iOS antigo — fallback = original.
- Orientação EXIF: `createImageBitmap(file, {imageOrientation:'from-image'})`
  resolve na maioria; documentar.
- HEIC não entra (já fora do `accept`).

## Documentos

`plan.md` · `design.md` · `acceptance.md` (sdr: sem nova superfície —
server caps e buckets intactos; nota dentro do plan).
