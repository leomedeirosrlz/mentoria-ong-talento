# Manifesto — issues abertas do Jira (snapshot 22/out/2026)

Inventário completo de `project = REALIZA AND statusCategory != Done`, classificado
pra esteira de planejamento. Tiers: **A** = doc set completo (plan+sdd+design+sdr+acceptance),
**B** = padrão (plan + design-se-UI + acceptance), **C** = decisao.md apenas,
**D** = auditoria de status (possivelmente já entregue — confirmar antes de planejar),
**—** = index-only (epic/história/subtask de aceite).

## Vereditos da auditoria (recon `_recon/issues-status.md`, 23/out)

- **FEITO → README de evidência + fechar no Jira** (não replanejar):
  15, 27, 28, 30, 31, 38, 40, 46, 61, 63, 64, 72, 99, 100, 101, 102, 103,
  137, 140, 147, 152
- **PARCIAL → plano cobre SÓ o resto** (README cita o que já existe):
  22 (posição estável do Agendar + microcopy), 36 (4 tipos de campo faltando),
  54 (PDM+empty state), 56 (dashboards, dep 182), 66 (compressão client),
  68 (tipos atividades/matching/presencas), 71 (agregação na 360),
  73 (hub completo, dep 167), 143 (layout desktop roda), 144 (wizard real),
  172 (5-6 dos 7 débitos)
- **ABERTO → plano normal**: as demais.

Atenção de schema (mapas): **pg_cron NÃO existe em prod** — 169/182 precisam
alternativa (pg_net+edge fn, Vercel cron HTTP, ou extensão). **anon tem zero
grants** — 170/183 via RPC definer. **`duplas.pdm_url` foi dropada em 0098** —
181 assume modelo novo sem legado. `duplas.dupla_dpp_id` não existe (98).

## Absorções e duplicatas (não planejar 2×)

| Issue | Destino |
|---|---|
| 17 (PDM doc vivo) | absorvida por **181** (PDM nativo, decisão fechada) |
| 141 (metas reordenação), 142 (submetas recursivas) | absorvidas por **181** |
| 74 (snapshot semáforo) | absorvida por **182** (dupla_saude_snapshots) |
| 124, 125, 126 ([IA] fases 1-3) | absorvidas por **179** (chatbot+MCP+RAG) |
| 34 (turma via upload cronograma) | absorvida parcialmente por **180** (pipeline import) + 167 — plano da 34 referencia |
| 96, 97 (CLONEs) | dupes de 21 e 22 — plano diz "fechar clone" |
| 42 (DECISÃO camada IA) | respondida por 178/179/180 — decisao.md registra a resposta |

## Tier D — auditar status antes (suspeitas de já entregue)

- **15** — `cronogramas` existe; verificar o que falta da F1
- **63** — encerramento de ciclo entregue (0037); verificar restos
- **68** — exports CSV existem (4 tipos); verificar cobertura
- **100** — `rematch_dupla` (0105) entrega remanejamento atômico; verificar escopo
- **147** — avaliação esp final entregue (0104); provável Done
- **22/26/27/28** — parcialmente cobertas pela agenda nova; verificar restos
- **69, 70** — "Template nativo" × forms engine; verificar
- **31** — T1/T2 reais: verificar o que já existe em `turma`/`cronogramas`

## Issues a planejar

### Tier A (doc set completo)

| Key | Título | Deps |
|---|---|---|
| 16 | Preservação de dados do mentorado (identidade estável) | — |
| 20 | `atividade_links` multi-sessão tokenizado | — |
| 30 | Modelo de eventos do cronograma | 15 |
| 32 | Auxiliar por turma: RLS | 47 (decisão pendente: por dupla?) |
| 36 | Forms engine +5 tipos | — |
| 38 | Perfil canônico rico | — |
| 46 | Wizard cronograma dinâmico | 30 |
| 47 | Turma entidade plena (tabelas + filtros) | 15 |
| 55 | Editor de PDF embutido | 20 |
| 98 | `duplas.dupla_dpp_id` self-FK | — |
| 159 | Alumni→mentor | — |
| 166 | E2E no pipeline (push+nightly+required) | — |
| 167 | T2→T3 parametrização | — |
| 168 | Import semanal → RegistroForm nativo | — |
| 169 | Lembretes trilha esp (pg_cron) | — |
| 170 | Relatórios públicos com senha | 183 |
| 173 | /materiais coord refactor | — |
| 174 | /duplas overview compacta | — |
| 175 | /registros desktop | — |
| 176 | /agenda coord | — |
| 177 | Sweep modais | — |
| 178 | Relatórios + inteligência | 182 |
| 179 | Chatbot + MCP + RAG | 178 |
| 180 | Pipeline importação inteligente (NL+visão) | 178 |
| 181 | PDM nativo | — |
| 182 | dupla_saude_snapshots | — |
| 183 | resumo_acessos | — |
| 71 | Avaliação por encontro agregando 360 | — |
| 51 | Distribuição atividades em lote | 20 |
| 56 | Hub /relatorios | 182 |
| 52 | Score determinístico + narrativa LLM | 178 |
| 101 | Fila de espera | — |
| 102 | Import pareamento CSV | 180? |
| 103 | Builder cronograma | 30, 46 |
| 18 | Roda da Vida interativa | 20 |
| 19 | Instrumento-piloto "Construindo a Visão" | 20? |
| 143 | Roda da Vida layout visual | 18 |
| 144 | Forms seções/wizard | 36 |
| 152 | Materiais dinâmicos acervo jovem | — |
| 40 | /duplas pra não-coord | — |
| 72 | Badge papel + onboarding por papel | — |
| 73 | Hub turmas home coord | 167 |
| 39 | Aba Pessoas por turma | 167 |
| 49 | Grade tipo planilha intake/respostas | 36? |
| 137 | Rodada de mockups (3 variantes + juízes) | — |
| 138 | Demo switcher "Alterar view" | 137 |

### Tier B (plan + design-se-UI + acceptance)

| Key | Título |
|---|---|
| 21 | Checklist de intenções por encontro |
| 26 | Histórico append-only remarcações |
| 27 | Ação de agendar no card (nº explícito) |
| 28 | Spec agendamento ata (bolinha+popup+painel) |
| 35 | Bug: primeiro acesso copy + deliverability |
| 37 | ViaCEP no cadastro |
| 54 | Arquivos da dupla: agregar PDM + empty state |
| 61 | Copy voz do mentor CTAs |
| 62 | Nudge com prazo preenchido |
| 64 | Copy identidade links tokenizados |
| 66 | Upload limite + compressão imagem |
| 99 | Supervisão: coord como supervisor_id |
| 140 | Materiais (título truncado — verificar) |
| 171 | Rematch esp devolutiva_pdm |
| 172 | Débitos pequenos (7 itens) |
| 153 | Ficha: remanejo dropdown recolhido |
| 154 | Ficha: ocultar Combinados vazia |
| 157 | Ficha: menu "Mais" itens desalinhados |
| 162 | Jovem: jornada/acervo densidade desktop |

### Tier C (decisao.md — opções + recomendação + sign-off pendente)

| Key | Decisão |
|---|---|
| 33 | Revisão LGPD estrutural (inventário+visibilidade+retenção) |
| 53 | Acervo Drive: Shared Drive org × item a item |
| 65 | Offload arquivos frios → Drive 6TB |
| 67 | Devolução do mentor no MVP do editor? |
| 42 | Camada IA (respondida por 178/179/180 — registrar) |

### Index-only

- **Epics:** 7, 8, 9, 10, 11, 12, 13, 14, 75, 104
- **Histórias:** 77, 78, 79, 80, 81, 82, 83, 84, 85
- **Subtasks aceite:** 87, 88, 89, 90, 91, 92, 93, 94, 95
