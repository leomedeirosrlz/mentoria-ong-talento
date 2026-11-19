# Spec — materiais nativos

**Feature:** `specs/004-materiais-nativos` · **Tipo:** as-built · **Status:** Delivered
**Origem:** auditoria de 19/nov/2026 (`docs/audits/materiais-2026-11.md`) — congela o contrato do que o lote de 16–17/11 entregou (REALIZA-361/380/394/409/410/413) e registra o resíduo corrigido nesta PR.

## Problema e resultado

Os materiais do programa (guias de mentor, roteiros dos 16 encontros, cronogramas, instrumentos e modelos) viviam em PDF: versões desencontradas, conteúdo desatualizado e leitura ruim no celular. A direção: todo material de leitura vira um documento nativo renderizado pelo mesmo pipeline de corpus, e o PDF deixa de ser dependência de leitura.

**Resultado:** catálogo 100% `doc:<slug>` (verificado em staging); o único destino externo que resta é link de plataforma por desenho.

## Fontes de conteúdo

- Fonte canônica do corpus: `docs/rag/*.md` (frontmatter `fonte`/`titulo`/`material`/`tipo`/`audiencia`), consolidado de `docs/fontes/` e dos PDFs publicados. Onde o DOCX do Drive é mais novo que o PDF, o DOCX prevalece — registrado no frontmatter (`origem`).
- Nada de texto inventado: documento sem fonte disponível fica fora e listado no relatório. Hoje: zero pendentes.

## Requisitos funcionais (contrato congelado)

- **FR-001:** material nativo usa `path = "doc:<slug>"`; `hrefMaterial()` (`src/lib/materiais.ts`) resolve para `/materiais/documento/<slug>` (ou `/jovem/materiais/documento/<slug>` no portal do jovem). `path` de arquivo cai em `/api/material/<id>`; `url` externa passa por `linkSeguro`.
- **FR-002:** `/api/material/<id>` rejeita `doc:` (404) — documento nativo nunca é servido como arquivo.
- **FR-003:** autorização do documento nativo é audiência do frontmatter + `veMaterial`: coordenação vê tudo; demais papéis veem `todos` + própria audiência. Staff e mentor abrem o mesmo `doc:` (REALIZA-409).
- **FR-004:** a ficha da dupla mostra por encontro o roteiro + instrumentos/técnicas da janela do guia, incluindo instrumentos `encontro_num = null` (`docsDoEncontro` + `enriquecerMateriaisPorEncontro`, dedup por slug).
- **FR-005:** seção cujo eyebrow repete o título do documento é suprimida (`eyebrowDe`); âncoras e TOC ficam intactos.
- **FR-006:** leitura é registrada por `(profile_id, ref)` em `material_leituras` — doc nativo na montagem, arquivo/link no clique — e o card mostra um indicador discreto com rótulo textual.
- **FR-007:** docs lidos em runtime permanecem empacotados: `outputFileTracingIncludes` cobre `docs/rag/**/*.md` nas duas rotas de documento.
- **FR-008:** o encontro 16 é "Encerramento e celebração" com `instrumentos: ["Avaliação final"]` em **todas** as fontes: `seed.sql`, `gerador-cronograma`, dataset demo e scripts de fixture/importação. "Avaliação 360º"/"Autoavaliação do mentor" como nome de instrumento do encontro 16 está aposentado.

## Casos de borda

- E-mail de material (`dispararMaterialEmail`) segue a mesma regra: `doc:` → página nativa, arquivo → `/api/material`, sem os dois → biblioteca.
- Modo demo espelha o mesmo catálogo e marca leitura via cookie (sem escrita).

## Verificação (proteção ativa)

- `tests/materiais-encontro.test.ts`, `tests/corpus-doc.test.ts`, `tests/corpus-audiencia.test.ts`.
- E2e demo: `material-leitura.spec.ts`, `materiais-encontros.spec.ts`, `jovem-jornada.spec.ts` (instrumentos aposentados fora do acervo).
- Auditoria: `docs/audits/materiais-2026-11.md` (tabela issue × evidência × status).

## Resíduo corrigido nesta PR

- `scripts/seed-demo-staging.mjs` e `scripts/importar-turma2.ts` ainda gravavam `["Avaliação 360º","Autoavaliação do mentor"]` no encontro 16 — normalizado para `["Avaliação final"]` (FR-008). Linhas `de*`/e2e já semeadas em staging convergem no próximo reseed.
