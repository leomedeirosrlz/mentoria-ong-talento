# REALIZA-362 + REALIZA-66 + REALIZA-368 — Materiais: título canônico da Roda, compressão de evidências e conteúdo stale

Issue: `materiais`,`upload`,`ux`. Fonte: batch `materiais-upload` do `_contexto.md` (362/368 de auditoria de conteúdo; 66 migrada do Linear REALIZA-37). Implementação em voo: branch `thiago/materiais-upload` (worktree `liza-olhos-maiores`, PR #153), commit `89270da`. Status: em implementação.

## O que exige vs. o que existe

**REALIZA-362** — o catálogo chama o documento nativo de "Roda da Vida (instrumento)", mas a linha `materiais` se chamava "Roda da Vida: roteiro de aplicação". Estado no branch: rename aplicado na migration `0185_material_roda_titulo.sql` (UPDATE por título), no `seed.sql` e no catálogo demo (`demo/data.ts`).

**REALIZA-66** — evidência de câmera moderna chega com 3–8 MB; o plano Supabase cobra pelo storage (1 GB free, ~50 duplas × 16 encontros estoura) e o teto por arquivo é 50 MB. Estado no branch: novo `src/lib/anexo-imagem.ts` (`prepararArquivoAnexo`) + cap explícito + hint nos dois pickers + teto do lado do servidor no bucket.

**REALIZA-368** — varredura de conteúdo stale:

- **drift dos paths `doc:<slug>`** — o seed já declarava `doc:<slug>` pros 16 roteiros e pros instrumentos de corpus (Roda, Definindo Metas) desde 0135/0138, mas **prod** seguia apontando pro PDF embutido (`materiais/*.pdf`). Era drift de dado, não de código — `/materiais/documento/<slug>` já rende nativo. Flip via UPDATEs na 0185.
- **cronograma vazando pra turma errada** — "Cronograma do programa — Turma N" aparecia pra qualquer DPP; pessoa nova via PDF de turma em que não está. Fix: recorte por turma **na query** (`getMateriais` + `demoMateriais`) — `materiais` não tem coluna de turma, a âncora é o título.
- **label vazado** — grupo "Supervisores" em `/pessoas` virou "Auxiliares executivos" (`GRUPO_LABEL`, pessoas-listas.tsx:96) — jargão antigo do papel.
- **número da coordenação verificado** — varredura confirmou: nenhum telefone/contato fixo hard-coded nas superfícies de materiais (`corpus-doc.ts`, `materiais-documentos.ts`, páginas `/materiais` e `/jovem/materiais`). Nada a corrigir — fica registrado como achado da auditoria.

**Entregue além do plano:** o recorte por turma não ficou só na UI — `getMateriais` (`queries.ts` ~825-845) e `demoMateriais` (`demo/queries.ts` ~414-435) carregam a régua, via helpers puros novos em `materiais.ts`.

## Decisões

- **Compressão no client, teto no servidor.** `prepararArquivoAnexo` roda no browser (`createImageBitmap` + canvas): imagem >200 KB vira WebP ~200 KB — escada de qualidade `[0.82, 0.68, 0.54, 0.42, 0.32]`, e se nenhuma atinge o alvo encolhe 30% a dimensão e repete (até 4 rodadas, `LADO_MAX` 2048). PDF, imagem já pequena e qualquer falha de decode/canvas devolvem o arquivo **intacto** — a recusa de formato/tamanho já rodou antes e o bucket fecha por cima. A row `registro_anexos` guarda nome/tamanho/mime **do que subiu de fato** (`foto.webp`), não do original.
- **Cap 50 MB nos três níveis:** mensagem do client ("O arquivo passa de 50 MB"), `file_size_limit` do bucket `registro-anexos` + `allowed_mime_types = [pdf, png, jpeg, webp]` na 0185 — mesmo teto do plano, allowlist explícita (`image/*` admitiria SVG, conteúdo ativo).
- **Recorte de turma por título, na query — não na RLS.** `materiais` não tem coluna de turma; criar uma agora pra 2 linhas seria peso morto. `turmaDoMaterial` lê o nº com `/\bturma\s+(\d+)\b/i` (dígito só: "turma da"/"turma toda" não é âncora) e `veMaterialDaTurma` decide: material sem âncora passa sempre; `turmas = null` desliga o recorte (coordenação lê o catálogo inteiro); mentor/supervisor/jovem vê só a turma das próprias duplas (`duplasDoPapel` → `turmaDaDupla` → `turmaNumero`). Fast-path em `getMateriais`: se nenhum material visível tem âncora, retorna sem query extra de duplas/cronogramas.
- **Flip idempotente na 0185.** UPDATEs casados por `titulo`/`encontro_num` e limitados a `path like 'materiais/%'` — rodar duas vezes é no-op; re-run pós-reset não toca path `doc:` nem `http`.

## Schema — `supabase/migrations/0185_material_roda_titulo.sql`

(a) `update materiais set titulo='Roda da Vida (instrumento)' where titulo='Roda da Vida: roteiro de aplicação'`.
(b) flips `doc:` — Roda → `doc:instrumento-roda-da-vida`, "Instrumento: Definindo Metas" → `doc:instrumento-definindo-minhas-metas`, `Roteiro Semana %` (encontro_num 1–16) → `doc:roteiro-encontro-NN` (`lpad` 2 dígitos) — todos só onde `path like 'materiais/%'`.
(c) `storage.buckets` `registro-anexos`: `file_size_limit = 52428800`, `allowed_mime_types` fechada.

Sem RLS nova (recorte é query-level); sem dados de menores. Rito padrão: aplicar no staging antes/junto do push da branch, e em prod **antes** do merge (senão o schema-contract/e2e-preview quebram — a migration é a que torna o dado real coerente com o que o código espera).

## Domínio (src/lib/)

- `materiais.ts` — `+ turmaDoMaterial(titulo)`, `+ veMaterialDaTurma(m, turmas)`.
- `anexo-imagem.ts` — novo: `prepararArquivoAnexo(file)`.
- `queries.ts` — `getMateriais` ganha o segundo filtro de turma com fast-path; coord via `temPapel(me,"coordenacao")`.
- `demo/queries.ts` — `demoMateriais` idem via `duplasDoPapel`.
- `demo/data.ts` — catálogo demo reflete o flip: roteiros e os dois instrumentos com `path: "doc:..."`; "Cronograma — Turma 1/2" seguem `materiais/*.pdf` (são o caso que o recorte cobre).

## UI

- `anexos-registro.tsx` — `LIMITE_BYTES` 10→50 MB; `enviarAnexo` sobe `enviavel` (comprimido); hint "…(PDF, PNG, JPG ou WebP) até 50 MB: fotos são comprimidas automaticamente.".
- `registro-form.tsx` — hint da seção Evidências: "…até 50 MB. Fotos são comprimidas automaticamente. Opcional."
- `pessoas-listas.tsx` — `GRUPO_LABEL.supervisores`: "Supervisores" → "Auxiliares executivos".

## Seed + demo

- `seed.sql` — título da Roda atualizado na linha do catálogo; comentário de pendência de rollout do flip substituído pela referência à 0185.
- `demo/data.ts` — catálogo pós-flip (doc: nos roteiros/instrumentos); cronogramas por turma seguem PDF (exercitam o recorte).
- `demoMateriais` aplica `veMaterialDaTurma` com as turmas das duplas do papel.

## Testes

- `src/lib/materiais.test.ts` — `turmaDoMaterial` (lê nº, null em material do programa e em null/undefined) e `veMaterialDaTurma` (só a própria turma; quem não tem dupla não vê cronograma; material sem âncora passa; `null` desliga).
- `src/lib/anexo-imagem.test.ts` — novo: pass-through em node (PDF, imagem pequena, imagem grande sem canvas — a compressão em si só existe no browser, cobertura intencionalmente no fallback).
- ⚠ gap: sem e2e de upload comprimido (exigiria browser real medindo o payload subido) e sem teste do recorte em `getMateriais` nível query (helpers puros cobertos; a integração com `getDuplasInfo`/`getCronogramas` não).

## Critérios de aceite

- [x] `materiais.titulo` da Roda é "Roda da Vida (instrumento)" em seed, demo e remoto (0185).
- [x] Os 16 roteiros + Roda + Definindo Metas resolvem `doc:<slug>` → página nativa (flip `materiais/%` → `doc:` idempotente).
- [x] "Cronograma do programa — Turma N" só aparece pra quem tem dupla na turma N; coordenação vê os dois; pessoa sem dupla não vê cronograma nenhum.
- [x] Imagem >200 KB sobe como WebP ~200 KB (escada qualidade→dimensão, máx 4 rodadas); PDF/imagem pequena/falha de decode passam intactos.
- [x] Cap de 50 MB no client (mensagem pt-BR), no hint dos dois pickers e no bucket (`file_size_limit` + MIME allowlist).
- [x] Metadados do anexo (`nome`/`tamanho`/`mime`) refletem o arquivo comprimido que subiu.
- [x] Grupo de supervisores em /pessoas lê "Auxiliares executivos".
- [x] Nenhum telefone/número da coordenação hard-coded nos materiais (varredura verificada — achado negativo).
- [ ] ⚠ gap: recorte por turma coberto só nos helpers puros — sem e2e/integration confirmando que `getMateriais` real filtra no app.

## Fora de escopo

- Coluna `materiais.turma` + recorte na RLS — desenho por título é suficiente pro catálogo atual; se turmas virarem filtro de primeiro nível, reabre.
- Compressão/limite nos outros buckets (avatars, documentos de intake) — o escopo é `registro-anexos`.
- Upload de vídeo / HEIC→JPEG transcode (fora da allowlist, recusado).
- Editor/admin de catálogo (quem publica material edita SQL/seed — sem tela).
