# Planos de evolução — índice consolidado

Brainstorms gerados a partir da reunião de 01/out/2026 (transcrição + ata) e dos materiais oficiais em `~/Downloads`. Cada doc tem alternativas com tradeoffs, recomendação e perguntas abertas. **Nada aqui é implementação** — é material de decisão pro Thiago escolher.

Leia primeiro `_contexto.md` (estado atual do código + decisões da ata). A análise da transcrição está em `../analise-transcricao-mentor.md`.

> **Backlog canônico: Jira** (site `kelyng.atlassian.net`, projeto **REALIZA**). 8 Epics = os módulos; issues dentro dos epics. Estes docs são o *porquê* — o Jira é o *o que/quando*. Regras de execução por agente em `EXECUCAO.md`. Migrado do Linear em 04/out — mapa de IDs antigos (`REA-*`) → Jira em `migracao-linear-jira.md`.

## Os cinco planos

| Doc | Frente | Recomendação central | Esforço |
|---|---|---|---|
| `atividades-interativas.md` | Instrumentos do guia (Roda da Vida, PDM, metas) como atividades nativas + links tokenizados | **Híbrida**: forms engine p/ coleta one-shot + `pdm`/`pdm_itens` recursivo p/ documento vivo | M–XL por instrumento |
| `turmas-cronogramas.md` | Programa→Turma→Cronograma→Dupla + cadastro dinâmico de cronograma | Faseado: `cronogramas` mínimo + filtrar ~20 pontos → wizard gerador → entidades plenas | F1 M, total XL |
| `relatorios-inteligencia.md` | Exports/relatórios automatizados + camada de IA | Export CSV por tipo → hub `/relatorios` → digest semanal Resend (template) → LLM só em agregados | M |
| `editor-pdf.md` | Editor/desenho sobre PDF estilo pdf24 | pdfjs raster + canvas overlay (perfect-freehand) + flatten pdf-lib (já instalada) | M–L |
| `navegacao-turmas.md` | IA multi-turma: telas, `/pessoas`, contexto | Híbrido: hub de turmas na home coord + `?turma=` + cookie `turma_foco` | M |

## Material de referência (fontes, não planos)

| Doc | O que é |
|---|---|
| `forms-google-mapeamento.md` | **Estrutura verbatim dos Google Forms oficiais** (matching mentores 45 campos, matching mentorados 17, avaliação semanal 10, voluntários Brasil Participativo 23) + inventário do Drive + **gap exato da forms engine** (faltam: `arquivo`, `grid_disponibilidade` hora×dia Seg–Sex, `secao`, `visible_if`, "Outro:" livre) |

## Dependências cruzadas (importante pra ordenar)

```
DADOS BASE (destrava tudo)
└─ turmas-cronogramas F1: cronogramas + escopo por dupla.ciclo/cronograma_id
   └─ destrava: navegacao-turmas (o filtro que ela propõe precisa da entidade)
   └─ destrava: relatorios (CSV ?ciclo= e relatórios por turma)
   └─ destrava: a 2ª operação real de cronograma sem corromper semáforo

ATIVIDADES (schema único — alinhar antes de implementar)
├─ atividades-interativas propõe documento vivo + links
└─ editor-pdf propõe `atividades` + `atividade_links` (link multi-sessão, rascunho)
   → CONVERGIR: uma tabela `atividade_links` com `tipo` ('form'|'pdf'|'roda'|'pdm')
     serve às duas frentes. Não criar tabelas paralelas.
   → Fase 0 comum: permissão pro mentor emitir link (hoje `gerarLinksParaDupla` é coord-only)

FORMS ENGINE (forms-google-mapeamento.md)
└─ pra replicar os forms oficiais faltam 5 tipos/feature: `arquivo` (upload 10MB),
   `grid_disponibilidade` (Seg–Sex × 09h–20h), `secao` (page-break),
   `visible_if` (condicional), "Outro:" livre em select
   → intake de mentor/mentorado nativo depende disso; o semanal não (já é `registros`)

HISTÓRICO (relatorios-inteligencia + ata de agendamento)
└─ snapshot do semáforo + log append de remarcações — implementar JUNTO com a
   spec nova de agendamento (bolinha laranja/verde), que é o momento de escrita

STORAGE (atravessa editor-pdf e atividades)
└─ PDF editado gera arquivo novo (~300KB/pág) — drive offload frio virá cobrar
```

## Sugestão de ordenação (não é decisão — é o encadeamento técnico)

1. **turmas-cronogramas F1** — é fix de correção de dados disfarçado de feature; a operação real já roda 2 cronogramas fora do sistema
2. **Spec de agendamento da ata** (Sprint 1 item 1 da análise) — resolve a dor mais repetida da mentora; janela natural pra gravar histórico de remarcação
3. **navegacao-turmas MVP** — hub de turmas + `/pessoas` agrupada por turma (Nível 1 não precisa de schema novo além do F1)
4. **atividades: Fase 0** (permissão de link pro mentor) + um instrumento-piloto — sugestão: "Construindo a Visão" (cabe 100% nos campos do forms engine, zero código novo de schema) antes da Roda da Vida
5. **relatorios: novos `?tipo=` CSV** (barato) → depois hub + digest
6. **editor-pdf** — depois que `atividade_links` existir, o editor vira `tipo='pdf'`

## Decisões — estado atual (03/out/2026)

A maioria foi fechada — as respostas completas estão em `_contexto.md` § Decisões de alinhamento + § Decisões terceira rodada. Status por pergunta (refs `REA-*`/`REALIZA-*` abaixo são IDs do Linear antigo — o Jira equivalente está em `migracao-linear-jira.md`):

| # | Pergunta | Estado |
|---|---|---|
| 1 | Turma × cronograma (unidade de pertença) | ✅ **Fechada** — dupla ∈ turma **E** cronograma; modelo `Programa → Turma → Cronograma → Dupla` |
| 2 | 2º cronograma tem datas? | ✅ **Sim** — 2 PDFs oficiais transcritos em `_contexto.md` § Cronogramas reais (T2 inicia 06/10) |
| 3 | Mentor emite link de atividade? | ✅ **Sim, catálogo curado** pela coord (REA-18) |
| 4 | PDM/Roda na plataforma? | ✅ **Entram** como experiências nativas; coord vê conteúdo completo (REA-22) |
| 5 | `encaminhamentos` × submetas do PDM | 🔲 Aberta — resolver ao implementar REA-21 |
| 6 | IA sobre texto livre de menores | 🔲 Pendente — frente de IA separada (REA-32) + parecer jurídico |
| 7 | Digest por e-mail com PII | ✅ **Não** — `/relatorios` exportável substitui digest (REA-30, REA-31 cancelada) |
| 8 | `materiais.encontro_num` ambíguo | 🔲 Aberta — resolver junto com REA-47 (modelo de eventos) |
| 9 | Editor PDF: devolução no MVP? | 🔲 Aberta — project depriorizado (REA-33/34) |
| 10 | Cross-dupla de arquivos p/ mentor | ◐ Parcial — agregação **por dupla** fechada; view agregada do mentor segue aberta |
| 11 | Drive org × Shared Drive 6TB | 🔲 Pendente — pesquisa de offload (REA-28) |
| 12 | Grid duplicado no form | ✅ **Artefato** — é só a disponibilidade (REA-24) |
| 13 | Outros forms no Drive pessoal | ◐ Parcial — 4 forms mapeados via API; restantes conforme compartilharem |

## Ordenação — atualizada

A decisão foi "ordem livre, velocidade importa" — mas o **gate técnico** continua: **REALIZA-15 primeiro** (entidade `cronogramas`), depois REALIZA-31 (T1+T2 cadastradas, vence 06/10). O resto do encadeamento acima segue como referência, não obrigação.

## Fora de escopo deliberadamente

- **Sugerir duplas** por afinidade: pendente da camada de IA (REA-32) — `AfinidadePar` já existe mas não cobre sugestão
- WhatsApp Cloud API: backlog existente, nenhum doc novo precisou
- ~~Calendário estilo Google~~ → **decidido**: agenda vira Google Calendar de verdade (REA-52/53/54, milestone "Agenda nova do mentor")
