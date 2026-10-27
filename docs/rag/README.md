# Corpus do assistente (RAG)

Documentos curados que alimentam a tool `guia_consulta` via `ia_chunks` +
`match_ia_chunks` (migration `0136`, FTS `portuguese`). A ingestão é pelo
script `pnpm ingerir:guias` (dry-run por padrão; `--apply` grava no banco).

## Fonte vs. corpus

- `docs/fontes/*.txt` = **transcrições brutas** dos materiais (DOCX/PDF do
  Drive). Não são ingeridas — algumas têm artefatos de OCR e PII real.
- `docs/rag/*.md` = **corpus curado**: consolidado, revisado e sanitizado.
  É o que entra no banco. O cabeçalho de cada arquivo declara o `guia`
  (slug) usado como chave de ingestão.

## Precedência entre fontes

- `guia-mentor-dpp.md` e `guia-mentor-especialista.md` consolidam os
  **guias físicos atuais** (`guia-*-docx/pdf`). Onde os rascunhos antigos
  (`novo-programa-*.txt`, que mencionam "Atados" e carga EaD obrigatória)
  divergem, **o guia físico vence**.
- `ciclo-2026-2027.md` e `plataforma-e-operacao.md` trazem o que **não
  está nos guias físicos**: cronograma oficial do ciclo e decisões de
  plataforma (PDM nativo, roteiros semanais como material, instrumentos
  digitais, regras operacionais).
- `termo-adesao-voluntario.md` é **template sanitizado** — o original em
  `docs/fontes/` contém nome, RG, CPF e endereço reais de um voluntário e
  **nunca** deve ser ingerido.
- `instrumento-definindo-minhas-metas.md` é a versão texto do instrumento
  do mentorado.

## Atualização

Guia físico muda → edita o `.md` correspondente → `pnpm ingerir:guias --
--apply`. A unique `(guia, secao, pagina)` + delete-por-guia do script
mantêm o banco idempotente. Decisão nova de plataforma/operação → edita
`plataforma-e-operacao.md` (ou cria um `.md` novo com `guia:` no cabeçalho
e adiciona o arquivo em `FONTES` do script).
