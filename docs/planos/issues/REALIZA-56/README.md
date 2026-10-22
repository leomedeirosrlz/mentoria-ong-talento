# REALIZA-56 — Hub `/relatorios`: dashboards operacionais (parcial)

**Jira:** [REALIZA-56] "Hub /relatorios: dashboards operacionais filtráveis"
— presença, completude, atrasos, remarcações, apoio, engajamento,
instrumentos, termos/documentos. Fonte: `docs/planos/relatorios-inteligencia.md`
**Tier:** A→B (parcial) — README, plan, sdd, design, sdr (leve), acceptance.
**Status:** PARCIAL — a página existe (`src/app/(app)/relatorios/page.tsx` +
`relatorio-builder.tsx`) mas é **só a grade configurável** (filtro turma +
colunas + CSV). Não há nenhum dashboard/métrica operacional.

## O que já está feito (evidência — não replanejar)

- Página coord-only `/relatorios` com `RelatorioBuilder`: grade configurável
  (turma × granularidade × colunas), edição inline de cadastro, download CSV,
  link público, paridade demo.
- Toda a matemática: `saudadeDaDupla` (ciclo.ts:1245), `resumoSemana`
  (:1108) + `textoResumoSemana` (:1227), `encontroEsperado` (:948),
  `diasAtrasoRegistro` (:2005), `PESO_AVALIACAO` (encerramento.ts:54).
- Dados: `presencas` (0040), `supervisoes` (0041), `assinaturas` (0033+),
  `encerramentos` (0037), `formularios`/`respostas` (0036+), `interacoes`,
  `encaminhamentos`, `solicitacoes_especialista`, `chamados`.

## O que falta (escopo desta issue)

Uma **camada de dashboards** acima da grade — cards de métricas + listas de
atenção, filtráveis. Inventário proposto (fonte: relatorios-inteligencia.md §2):

| Bloco | Métrica | Fonte |
|---|---|---|
| Semáforo | contagem ok/atenção/risco + lista de motivos | `saudadeDaDupla` vivo; **tendência** só com `dupla_saude_snapshots` (182) |
| Aderência | esperado × realizado (%), atraso médio de registro, média avaliações | `encontroEsperado`, `diasAtrasoRegistro`, `PESO_AVALIACAO` |
| Remarcações | count por dupla + motivos agregados | `encontros.motivo_reagendamento` — **lacuna conhecida**: só o último motivo sobrevive (rel-inteligencia.md:32) → v1 conta "encontros cujo estado envolveu remarcação"; histórico real depende de `encontro_eventos`/contador (follow-up fora de escopo) |
| Apoio | pedidos abertos (mentor/jovem), tempo médio de resposta | `saudadeDaDupla.apoio`, `interacoes`, `apoio_resolvido` |
| Engajamento | registros/semana por dupla, dias desde último contato | `registros`, `interacoes` |
| Presenças formação | faltas por evento, quem não tem `formacao_ok` | `presencas`, `mentor_profiles`, `ciclo_eventos` tipo `formacao` |
| Instrumentos | respostas recebidas × enviadas por formulário | `formulario_links`, `respostas` |
| Documentos | assinaturas por status × template | `assinaturas`, `documento_templates` |
| Digest | texto semanal pronto pra copiar | `textoResumoSemana` |

## Filtros

`turma` (text, existe), `cronograma_id` (existe em `duplas`), `dupla` (picker),
`status` da dupla. **`programa` não existe** — `turma` é o topo do modelo
atual (a 47 cria programa; filtro vira `programa→turma` lá). Filtros por
search params (URL compartilhável — o coord pode mandar o link do recorte).

## Dependências

- **182** (`dupla_saude_snapshots`) — o bloco "tendência do semáforo" (série
  por semana) depende dela; se não houver, o card mostra só o estado atual
  com "dados até <max(dia)>" quando houver.
- **167** — filtros por turma se beneficiam de turmas parametrizadas (sem ela,
  `distinct duplas.turma` alimenta o select — funciona também).
- Queries novas em `queries.ts` (`React.cache`), agregações em SQL ou em
  memória sobre selects existentes — **sem materialized view** (recomendação
  do brainstorm; volume é ~40 duplas).

## Esforço: M–G

~8 blocos de métricas + filtros + estados. A parte cara é definir cada
métrica com a mesma honestidade do semáforo (motivos visíveis, não números
opacos).

## Riscos

- **Número sem motivo vira métrica tóxica** — cada bloco lista o "porquê"
  (ex.: "risco" → motivos; "atraso" → duplas por nome). Padrão já provado
  pelo semáforo.
- **Dupla contagem com a fila** — pessoas sem dupla (`turma_inscricoes`, 167)
  entram na completude? Decisão: bloco "fila de espera" separado, não mistura
  nas taxas de duplas.
- **Perf** — semáforo de ~40 duplas em memória já roda na agenda-coordenacao;
  reusa o padrão (fetch único + compute TS).
