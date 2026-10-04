# Migração Linear → Jira (04/out/2026)

Site canônico: https://kelyng.atlassian.net — projeto REALIZA (Realiza.vc)

## Epics (módulos)

- REALIZA-7: Agendamento & Encontros
- REALIZA-8: Turmas & Cronogramas
- REALIZA-9: Pessoas & Navegação
- REALIZA-10: Atividades & Instrumentos
- REALIZA-11: Importação Google
- REALIZA-12: Relatórios & Inteligência
- REALIZA-13: Editor de PDF
- REALIZA-14: Ops & Infra

## Mapa de issues (Linear → Jira)

- REALIZA-5 → REALIZA-28 — Spec de agendamento da ata: bolinha laranja→verde + popup + painel lateral por e
- REALIZA-6 → REALIZA-27 — Ação de agendar dentro do card do encontro (número explícito)
- REALIZA-7 → REALIZA-26 — Histórico append-only de remarcações (motivo + data original + quem)
- REALIZA-8 → REALIZA-74 — Snapshot do semáforo (série temporal de risco)
- REALIZA-9 → REALIZA-15 — F1: entidade cronogramas + escopo do semáforo/queries por dupla
- REALIZA-10 → REALIZA-60 — DECISÃO: turma × cronograma como unidade de pertença
- REALIZA-11 → REALIZA-46 — Wizard: coord cadastra cronograma dinamicamente (datas, nº de encontros, instrum
- REALIZA-12 → REALIZA-73 — Hub de turmas na home coord + contexto de turma (?turma= + cookie)
- REALIZA-13 → REALIZA-39 — Aba Pessoas agrupada por turma + status de onboarding/documentos
- REALIZA-14 → REALIZA-48 — DECISÃO: papel por contexto (mesma pessoa, papéis diferentes por programa)
- REALIZA-15 → REALIZA-72 — Badge de papel no shell + onboarding por papel (copy específica)
- REALIZA-16 → REALIZA-41 — Renomear papel "supervisor" → "auxiliar executivo" (+ por turma, THI-55)
- REALIZA-17 → REALIZA-20 — atividade_links: link multi-sessão tokenizado (tipo form/pdf/roda/pdm) com rascu
- REALIZA-18 → REALIZA-50 — DECISÃO: mentor emite link de atividade pro mentorado sem passar pela coord?
- REALIZA-19 → REALIZA-19 — Instrumento-piloto: "Construindo a Visão" como atividade tokenizada
- REALIZA-20 → REALIZA-18 — Roda da Vida interativa: 16 eixos, radar, overlay antes/depois
- REALIZA-21 → REALIZA-17 — PDM: entidade documento-vivo com metas SMART → submetas recursivas
- REALIZA-22 → REALIZA-59 — DECISÃO: PDM/Roda da Vida dentro da plataforma? Com qual visibilidade pra coord?
- REALIZA-23 → REALIZA-71 — Avaliação por encontro (mentor + mentorado) agregando na 360
- REALIZA-24 → REALIZA-36 — Forms engine: +5 tipos (arquivo, grid disponibilidade, seção, condicional, outro
- REALIZA-25 → REALIZA-70 — Template nativo: "Matching de Mentores" (intake)
- REALIZA-26 → REALIZA-69 — Template nativo: "Matching de Mentorados" (intake)
- REALIZA-27 → REALIZA-58 — DECISÃO: intake dentro da plataforma, Google Forms mantido, ou híbrido (Sheets→i
- REALIZA-28 → REALIZA-53 — DECISÃO: acervo do Drive — mover pro Shared Drive org ou compartilhar item a ite
- REALIZA-29 → REALIZA-68 — Exports CSV por tipo (encontros, atividades, matching, presenças)
- REALIZA-30 → REALIZA-56 — Hub /relatorios: dashboards operacionais filtráveis
- REALIZA-31 → REALIZA-57 — Digest semanal automático por e-mail pra coordenação
- REALIZA-32 → REALIZA-42 — DECISÃO: camada de IA — confirmar progressão determinística→agregados→NLP gated
- REALIZA-33 → REALIZA-55 — Editor de PDF: upload→link→overlay annotation→flatten→devolução
- REALIZA-34 → REALIZA-67 — DECISÃO: devolução do mentor sobre atividade entregue entra no MVP do editor?
- REALIZA-35 → REALIZA-35 — Primeiro acesso: copy de identidade do magic link + deliverability Hotmail/Outlo
- REALIZA-36 → REALIZA-37 — ViaCEP no cadastro de endereço
- REALIZA-37 → REALIZA-66 — Upload: limite de tamanho + compressão client-side de imagem nas evidências
- REALIZA-38 → REALIZA-65 — DECISÃO: offload de arquivos frios pro Google Drive 6TB
- REALIZA-39 → REALIZA-54 — Arquivos da dupla: agregar PDM + empty state
- REALIZA-40 → REALIZA-64 — Copy de identidade em links tokenizados (mentorado sabe quem é/onde está)
- REALIZA-41 → REALIZA-63 — Backlog: encerramento de ciclo + checklist + trilha mentor_especialista
- REALIZA-42 → REALIZA-62 — Nudge com prazo preenchido (não "a partir de —")
- REALIZA-43 → REALIZA-61 — Copy em voz do mentor nos CTAs de encontro ("Como vai o encontro?", "Sem registr
- REALIZA-44 → REALIZA-52 — Feature: score determinístico + narrativa LLM em agregados sem PII
- REALIZA-45 → REALIZA-34 — Criar turma via upload de cronograma (PDF/planilha → normalização → revisão → pe
- REALIZA-46 → REALIZA-31 — Cadastrar Turma 1 + Turma 2 reais (ciclo 2026/2027) com cronogramas dos PDFs
- REALIZA-47 → REALIZA-30 — Modelo de eventos do cronograma: tipo + fase metodológica + dia variável + regra
- REALIZA-48 → REALIZA-51 — Distribuição de atividades: disparo em lote por e-mail + compartilhar WhatsApp d
- REALIZA-49 → REALIZA-16 — Preservação de dados do mentorado: identidade estável pra futura conta sem perda
- REALIZA-50 → REALIZA-49 — Modos de visualização familiares: grade tipo planilha nas listagens de intake/re
- REALIZA-51 → REALIZA-33 — Revisão LGPD estrutural: inventário de dados sensíveis + visibilidade + retenção
- REALIZA-52 → REALIZA-25 — Agenda estilo Google Calendar: views mês/semana/grade de horário + marcar direto
- REALIZA-53 → REALIZA-24 — Overlay de disponibilidade na agenda: verde mentor × amarelo mentorado, sobrepos
- REALIZA-54 → REALIZA-23 — Ações do encontro: editar link sem remarcar, remarcar encontro passado, copiar l
- REALIZA-55 → REALIZA-32 — Auxiliar por turma: escopo de leitura/escrita (RLS por turma, não por dupla)
- REALIZA-56 → REALIZA-45 — DECISÃO: vaga do mentorado — por turma ou por cronograma?
- REALIZA-57 → REALIZA-44 — DECISÃO: formação/onboarding é por turma ou por cronograma?
- REALIZA-58 → REALIZA-43 — DECISÃO: papel por contexto — granularidade programa, turma ou cronograma?
- REALIZA-59 → REALIZA-29 — DECISÃO: turma parceira com duplas pré-formadas — flag + import ou cadastro manu
- REALIZA-60 → REALIZA-22 — Polish de agendamento: posição estável do Agendar + dialog retroativo + microcop
- REALIZA-61 → REALIZA-21 — Checklist de intenções por encontro (não só nota livre)
- REALIZA-62 → REALIZA-47 — F3: turma entidade plena — tabelas turmas/programas + filtros por turma em tudo
- REALIZA-63 → REALIZA-40 — /duplas pra não-coord: "minhas duplas" default, "todas" de-emphasized (não é a t
- REALIZA-64 → REALIZA-38 — Perfil canônico rico: endereço completo + máximo de dados na pessoa (migrações f
