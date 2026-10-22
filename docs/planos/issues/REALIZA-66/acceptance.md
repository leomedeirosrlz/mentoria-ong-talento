# REALIZA-66 — acceptance.md

## Compressão

1. **GIVEN** JPG de 4000×3000 (~6MB) **WHEN** anexar no registro
   **THEN** o arquivo enviado é `image/webp`, ≤1600px no lado maior,
   tipicamente <1MB.
2. **GIVEN** PNG de screenshot 800×600 (~200KB) **THEN** política
   "não compensa" devolve original ou webp pequeno — mas dimensões
   **iguais** (sem upscale).
3. **GIVEN** PDF qualquer **WHEN** anexar **THEN** bytes originais —
   nunca toca.
4. **GIVEN** `createImageBitmap` falha (iOS antigo/mock) **THEN** upload
   segue com o arquivo **original** — usuário não percebe.

## Superfícies

5. A compressão acontece em `anexos-registro`, `chamado-anexos`,
   `documento-pessoa`, `foto-field` e no campo `arquivo` de forms (36).
6. **GIVEN** webp gerado **WHEN** abrir depois via signed URL **THEN**
   `Content-Type: image/webp`, abre no browser.

## Caps/servidor

7. **GIVEN** comprimido ainda > cap do componente (raríssimo) **THEN**
   erro "…até N MB" exibido e nada sobe — cap client é sobre o arquivo
   **final**.
8. **GIVEN** servidor **THEN** limits/MIME do bucket inalterados —
   requests fora da allowlist seguem 4xx.

## Testes

9. `ehImagemComprimivel`/`dimensoesFinais` cobertos no Vitest
   (pdf/svg/heic/heic⇒false; 4000×3000⇒1600×1200; 800×600⇒800×600).
10. e2e app: anexar imagem real no registro no staging → objeto no
    bucket termina `.webp` e `metadata.size` < original.

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` ✅ e2e-preview ✅ review ≥2 ✅
