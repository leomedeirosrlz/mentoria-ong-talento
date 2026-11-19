# Auditoria — Materiais nativos (2026-11)

**Branch:** `feat/materiais-nativos` · **Base:** `fix/instrumentos-rodada-2`
**Issues:** REALIZA-361, 380, 394, 409, 410, 413
**Modo:** auditoria primeiro — o lote de 16–17/11 já havia implementado a maior parte; este documento registra o que já estava cumprido e o resíduo corrigido.

## Verificação realizada

- **Código:** `src/lib/materiais.ts` (`hrefMaterial`, `enriquecerMateriaisPorEncontro`, `veMaterial`), `src/lib/materiais/corpus-doc.ts`, `src/lib/como-conduzir.ts` (`docsDoEncontro`), `src/components/corpus-documento.tsx` (`eyebrowDe`), `src/components/material-leitura.tsx`, `src/components/materiais-mentor-biblioteca.tsx`, rotas `/materiais/documento/[slug]` e `/jovem/materiais/documento/[slug]`.
- **Migrações/seed:** `0185_material_roda_titulo`, `0194_materiais_nativos` (file→`doc:`), `0196_material_leituras`, `supabase/seed.sql`.
- **Dados reais (staging, somente leitura, service key):** todo o catálogo `materiais` do programa usa `doc:<slug>` — guias DPP/Especialista, os 16 roteiros, instrumentos, modelos e os dois cronogramas. Únicos links externos restantes: `https://mentoria.realiza.vc` e `https://ead.realiza.vc` (links de plataforma, `tipo: 'link'` por desenho — não são material de leitura). `ciclo_eventos` do cronograma canônico: encontro 16 com `instrumentos: ["Avaliação final"]`.
- **Testes/e2e existentes:** `tests/materiais-encontro.test.ts`, `tests/corpus-doc.test.ts`, `tests/corpus-audiencia.test.ts`, `tests/e2e/demo/material-leitura.spec.ts`, `tests/e2e/demo/materiais-encontros.spec.ts`, `tests/e2e/demo/jovem-jornada.spec.ts` (asserção "Autoavaliação do mentor" fora do acervo).

## Tabela de status

| Issue | Evidência | Status | O que falta | Comentário sugerido no Jira |
|---|---|---|---|---|
| **361** Materiais nativos | Catálogo staging 100% `doc:` (guias, 16 roteiros, cronogramas, instrumentos, modelos); migração 0194 converteu paths file→`doc:`; correções de conteúdo conferidas no corpus (Roda 1–10, PDM/Roda da plataforma, esp sem form final, guia esp consolidado do DOCX mais recente — `docs/rag/guia-mentor-especialista.md` frontmatter); encontro 16 = "Avaliação final" no seed/gerador/cronograma real; âncoras de mês substituídas por callout "seis meses". | **parcial** | Resíduo em fontes de fixture: `scripts/seed-demo-staging.mjs` e `scripts/importar-turma2.ts` ainda gravavam `["Avaliação 360º","Autoavaliação do mentor"]` no encontro 16 — corrigido neste PR. Linhas de staging já semeadas (`de*`/e2e) permanecem obsoletas até o próximo reseed (dado descartável). | "Catálogo já 100% nativo e corrigido no lote de 16/11. Restava drift em scripts de fixture/importação do encontro 16 — normalizado para 'Avaliação final'. Cronogramas reais (staging/prod) já corretos." |
| **380** Guia Mentor DPP nativo | `docs/rag/guia-mentor-dpp.md` com frontmatter de corpus; linha `materiais` em staging = `doc:guia-mentor-dpp`; renderiza pelo mesmo `CorpusDocumento`; nota de versão no doc registra que o PDF de 6 meses está desatualizado. | **cumprido** | — | "Implementado em cdb2f0aa: guia DPP nativo via `doc:guia-mentor-dpp`, sem dependência de PDF." |
| **394** Materiais por encontro | `docsDoEncontro` cobre roteiro + instrumentos `encontro_num = null` via janela do guia (`ESTACOES`: roda inicial enc.1, visão/PDM 1–4, metas 2–3, roda formal 12–14, avaliação final 16) + técnicas; `enriquecerMateriaisPorEncontro` sintetiza e deduplica; `EncontroRow` renderiza via `hrefMaterial` (nativo direto ou popover); e2e `materiais-encontros.spec.ts`; staging sem nenhum material `url` para PDF interno. | **cumprido** | — | "Ficha da dupla completa: roteiro + instrumentos + técnicas por encontro, todos `doc:` nativos. Únicos externos são links de plataforma (mentoria/EaD), por desenho." |
| **409** Guias esp/dpp via /api/material | `hrefMaterial` devolve `/materiais/documento/<slug>` para `doc:`; `/api/material` rejeita `doc:` (404 por desenho); staging confirma `doc:guia-mentor-dpp` e `doc:guia-mentor-especialista` para todos os papéis — coordenação entra no doc nativo (RLS por audiência + `veMaterial`). | **cumprido** | — | "Drift era do banco local: migração 0194 já converteu os paths para `doc:`. Staging verificado — coord abre o documento nativo." |
| **410** Título de seção repete título do doc | `eyebrowDe(titulo, docTitulo)` em `corpus-documento.tsx` suprime prefixo numérico ("01 · …") e eyebrow contido no título do doc ("Roda da Vida · …" dentro do doc Roda); âncoras e TOC preservados; teste `corpus-doc.test.ts`. | **cumprido** | — | "Corrigido em 3a374049: eyebrow duplicado do título é suprimido mantendo âncoras e estrutura." |
| **413** Indicador de leitura nos cards | `material_leituras` (0196) + `RegistrarMaterialLido` (montagem do doc nativo) + `LinkComLeitura` (clique em arquivo/link, telemetria `material_aberto`); `/materiais` busca `getMateriaisLidos` e passa `lidos`; `materiais-mentor-biblioteca` mostra check discreto; paridade demo via cookie; e2e `material-leitura.spec.ts`. | **cumprido** | — | "Indicador discreto de lido nos cards, rastreio por perfil e por ref (`doc:<slug>` ou material id), com e2e e paridade demo." |

## Mudanças deste PR

- `scripts/seed-demo-staging.mjs` e `scripts/importar-turma2.ts`: encontro 16 normalizado para `["Avaliação final"]`, alinhando fixtures ao seed canônico, ao `gerador-cronograma` e ao cronograma real já corrigido.

## Guias/documentos: migrados vs pendentes

**Migrados (verificado em staging):** Guia do Mentor DPP, Guia do Mentor Especialista, Roteiros 01–16, instrumentos (Roda da Vida, Visão, Metas, PDM, técnicas), modelos, Cronogramas Turma 1 e 2, Checklist de competências.

**Pendentes:** nenhum — toda fonte disponível em `docs/fontes/`/`docs/rag/` está migrada; os dois links externos restantes são plataforma, não leitura.

## Riscos de empacotamento

- Docs nativos lidos em runtime dependem de `outputFileTracingIncludes` (`docs/rag/**/*.md`) para `/materiais/documento/*` e `/jovem/materiais/documento/*` — mantido, sem alteração neste PR.
- Linhas `de*`/e2e já semeadas em staging com instrumentos obsoletos convergem no próximo `pnpm seed:demo` (idempotente); dado descartável, sem write manual.
