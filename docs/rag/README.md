# Corpus do assistente (RAG)

Documentos curados que alimentam a tool `guia_consulta` via `ia_chunks` +
`match_ia_chunks` (migration `0136`, FTS `portuguese`). A ingestão é pelo
script `pnpm ingerir:guias` (dry-run por padrão; `--apply` grava no banco;
`--manifest` regenera `fontes.json`).

## Fonte vs. corpus

- `docs/fontes/*.txt` = **transcrições brutas** dos materiais (DOCX/PDF do
  Drive). Não são ingeridas — algumas têm artefatos de OCR e PII real.
- `docs/rag/*.md` = **corpus curado**: consolidado, revisado e sanitizado.
  É o que entra no banco. O cabeçalho de cada arquivo declara o `guia`
  (slug) usado como chave de ingestão.
- `docs/rag/fontes.json` = **manifest gerado** (`pnpm ingerir:guias
  --manifest`): mapa `guia → {titulo, material, natureza, arquivo}` para
  as fontes estruturadas (link da citação → documento oficial) sem
  depender de parse de front-matter.

## Front-matter (obrigatório salvo indicação)

```yaml
fonte: <slug do doc — vira a coluna `guia`, chave de ingestão>
titulo: <título oficial do documento>
material: <slug de /materiais/documento/<slug> quando o material é doc
  nativo; nos demais casos, o identificador do doc (= fonte)>
tipo: guia | operacao | instrumento | conteudo | template | termo
natureza: transcrito | consolidado | sintese-operacional
audiencia: [papéis do catálogo de materiais]
versao: <vigente | rascunho | nota de versão>
origem: <de onde o texto saiu + o que fazer quando divergir>
```

`natureza` diz de onde o texto veio:

- `transcrito` — verbatim da fonte primária (PDF/docx, doc nativo do app,
  cronograma oficial, template de documento de assinatura).
- `consolidado` — fiel à fonte primária, re-organizado (os dois guias,
  consolidados do DOCX/PDF).
- `sintese-operacional` — a fonte primária não está transcrita no repo; o
  texto foi montado a partir do que o código/cronograma documenta
  (explicitado no `origem` do doc).

## Documentos do corpus

| arquivo | guia | material (slug de citação) | natureza |
|---|---|---|---|
| `guia-mentor-dpp.md` | `guia-mentor-dpp` | `guia-mentor-dpp` (PDF) | consolidado |
| `guia-mentor-especialista.md` | `guia-mentor-especialista` | `guia-mentor-especialista` (PDF) | consolidado |
| `ciclo-2026-2027.md` | `ciclo-cronograma` | `ciclo-cronograma` (PDF "Cronograma do programa — Turma 1") | transcrito |
| `ciclo-turma2-2026-2027.md` | `ciclo-turma2-cronograma` | `ciclo-turma2-cronograma` (PDF "Cronograma do programa — Turma 2") | transcrito |
| `plataforma-e-operacao.md` | `plataforma-e-operacao` | `plataforma-e-operacao` | sintese-operacional |
| `roteiros-encontros-11-16.md` | `roteiros-encontros-11-16` | `roteiros-encontros-11-16` (6 PDFs) | sintese-operacional |
| `perguntas-eficazes.md` | `perguntas-eficazes` | `perguntas-eficazes` (PDF) | sintese-operacional |
| `feedback-construtivo.md` | `feedback-construtivo` | `feedback-construtivo` (doc nativo) | transcrito |
| `checklist-competencias.md` | `checklist-competencias` | `checklist-competencias` (doc nativo) | transcrito |
| `mensagem-preparacao.md` | `mensagem-preparacao` | `mensagem-preparacao` (doc nativo) | transcrito |
| `mensagem-indicadas.md` | `mensagem-indicadas` | `mensagem-indicadas` (doc nativo) | transcrito |
| `mensagem-encaminhamento.md` | `mensagem-encaminhamento` | `mensagem-encaminhamento` (doc nativo) | transcrito |
| `instrumento-definindo-minhas-metas.md` | `instrumento-definindo-minhas-metas` | `instrumento-definindo-minhas-metas` (PDF) | transcrito |
| `termo-adesao-voluntario.md` | `termo-adesao-voluntario` | `termo-adesao-voluntario` | transcrito |
| `termo-mentorando.md` | `termo-mentorando` | `termo-mentorando` | transcrito |
| `autorizacao-responsavel.md` | `autorizacao-responsavel` | `autorizacao-responsavel` | transcrito |

## Precedência entre fontes

- `guia-mentor-dpp.md` e `guia-mentor-especialista.md` consolidam os
  **guias físicos atuais** (`guia-*-docx/pdf`). Onde os rascunhos antigos
  (`novo-programa-*.txt`, que mencionam "Atados" e carga EaD obrigatória)
  divergem, **o guia físico vence**.
- `ciclo-2026-2027.md` (Turma 1), `ciclo-turma2-2026-2027.md` (Turma 2) e
  `plataforma-e-operacao.md` trazem o que **não está nos guias físicos**:
  cronogramas oficiais do ciclo e decisões de plataforma (PDM nativo,
  avaliação por terceiros nativa, instrumentos digitais, regras
  operacionais). Cada turma tem seu calendário — encontro duplo na quinta
  e sem a folga de 15 dias só existem na Turma 2.
- `roteiros-encontros-11-16.md` e `perguntas-eficazes.md` são sínteses
  operacionais: os PDFs existem no acervo mas não estão transcritos —
  o roteiro 11–16 é extração do cap. 10 do guia (migration 0135) e o
  "Perguntas Eficazes" é consolidado do que os guias trazem sobre o
  instrumento. Quando os PDFs forem transcritos em `docs/fontes/`, estes
  docs passam a `transcrito`.
- `feedback-construtivo.md`, `checklist-competencias.md` e os três
  `mensagem-*.md` reproduzem os **documentos nativos** do app
  (`src/lib/materiais-documentos.ts`, texto do cap. 14 do guia) — é o que
  permite a citação linkar para `/materiais/documento/<slug>`.
- `termo-adesao-voluntario.md` é **template sanitizado** — o original em
  `docs/fontes/` contém nome, RG, CPF e endereço reais de um voluntário e
  **nunca** deve ser ingerido. `termo-mentorando.md` e
  `autorizacao-responsavel.md` vêm da fonte única
  `src/lib/documentos/texto.ts` (a autorização é **rascunho em revisão
  jurídica** — citar como tal).
- `instrumento-definindo-minhas-metas.md` é a versão texto do instrumento
  do mentorado.

## Atualização

Guia físico muda → edita o `.md` correspondente → `pnpm ingerir:guias --
apply`. A unique `(guia, secao, pagina)` + delete-por-guia do script
mantêm o banco idempotente. Decisão nova de plataforma/operação → edita
`plataforma-e-operacao.md` (ou cria um `.md` novo com o front-matter
completo — `fonte`, `titulo`, `material` e `natureza` são obrigatórios).
Metadados novos → `pnpm ingerir:guias --manifest` regera `fontes.json`.

## Gap de schema (TODO de migration)

`ia_chunks` tem só `(guia, secao, pagina, texto)` — não existe coluna para
o slug de material nem o título oficial. O script já carrega
`titulo`/`material` em cada chunk e os exporta em `fontes.json`, mas o
insert fica no schema atual. Para a citação virar link direto a partir do
banco, falta migration: colunas `material`/`titulo` em `ia_chunks` (ou
tabela `ia_fontes` com o mapa `guia → metadados`) + retorno do campo em
`match_ia_chunks`. Até lá, o mapa canônico é `fontes.json`/front-matter.
