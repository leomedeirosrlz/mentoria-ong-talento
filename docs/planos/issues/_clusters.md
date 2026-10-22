# Clusters de planejamento — quem planeja o quê

Cada agente de planejamento cobre UM cluster inteiro (issues relacionadas juntas =
modelo coerente). Lê: `_contexto-agentes.md`, `_manifest.md`, `_issues.json`
(descrições reais), `_recon/*.md`, e o código real citado nelas.

Tier por issue no `_manifest.md`. Docs esperados por tier:
- **A**: README.md + plan.md + sdd.md + design.md + sdr.md + acceptance.md
- **B**: README.md + plan.md + design.md (se tocar UI) + sdr.md (se tocar dado sensível/público) + acceptance.md
- **C**: README.md + decisao.md apenas
- **D**: README.md + veredito de status (só se auditoria falhar; normalmente o auditor cobre)

## Cluster T — Turmas & Cronogramas (o espinhaço)
Issues: 15, 30, 31, 32, 46, 47, 34 (ref 180), 103, 39, 73
Carga: modelo Programa→Turma→Cronograma→Dupla. Coerência obrigatória entre os
planos — todos derivam do mesmo SDD de turmas. 34 descreve a ponte com 180.

## Cluster I — Instrumentos & Jornada do jovem
Issues: 16, 20, 19, 18, 143, 140, 141→181, 142→181, 152, 51, 71
Carga: atividade_links como espinha, instrumentos nativos (Visão, Metas, PDM,
Roda), "Minha jornada" estações, distribuição em lote, avaliação por encontro.
141/142 são absorvidas por 181 — o plano delas vira seção "PDM/Metas" na 181,
então escreva as duas como docs próprios mas apontando a união.

## Cluster A — Agenda do mentor
Issues: 22, 26, 27, 28, 61, 62, 64, 21, 96(dupe 21), 97(dupe 22)
Carga: spec de agendamento da ata, histórico de remarcações, polish,
microcopys, checklist de intenções, identidade em links.

## Cluster U — UX das telas da coord (feedback direto do Thiago)
Issues: 173, 174, 175, 176, 177, 153, 154, 157, 162, 172
Carga: redesenhos de /materiais, /duplas, /registros, /agenda, sweep de modais,
ficha da dupla polish, jovem densidade, débitos pequenos. Pesado em design.md —
seguir o framework do skill ux-review. Persona central: coord operando todo dia.

## Cluster M — Pessoas, matching & fluxo de duplas
Issues: 38, 37, 99, 100, 101, 159, 98, 54
Carga: perfil canônico, ViaCEP, supervisão coord, remanejamento (vs rematch_dupla),
fila de espera, alumni→mentor, dupla_dpp_id, arquivos da dupla.

## Cluster R — Relatórios, exports & links públicos
Issues: 56, 68, 52, 170, 183, 182, 169, 166, 167, 168
Carga: hub /relatorios, exports por tipo, score determinístico, relatórios
públicos com senha, resumo_acessos, snapshots, pg_cron lembretes, e2e pipeline,
parametrização T3, import semanal nativo.

## Cluster AI — Camada de IA
Issues: 178, 179, 180, 42 (decisao.md — registra que 178/179/180 respondem)
Carga: relatórios/inteligência, chatbot+MCP+RAG, pipeline importação NL+visão.
Pesado em sdr.md (LGPD, provider retenção zero, ia_eventos, tools tipadas).

## Cluster P — PDM nativo (feature isolada grande)
Issues: 181 (absorve 17, 141, 142)
Carga: modelo pdm_metas + pdm_submetas, co-edição, superfícies, migração de
pdm_url. O SDD precisa casar com o cluster I (metas/submetas compartilham
estrutura — alinhar com o que cluster I decidir; se conflito, documentar).

## Cluster D — Decisões pendentes (só decisao.md)
Issues: 33, 53, 65, 67
Carga: LGPD estrutural, acervo Drive, offload frios, devolução mentor no MVP.

## Cluster E — Encerramento, forms & misc técnico
Issues: 63 (verificar restos), 36, 144, 49, 147 (verificar), 35, 66, 72, 40
Carga: forms +5 tipos, seções/wizard, grade planilha, primeiro-acesso bug,
upload caps, badge papel, /duplas não-coord.

## Cluster K — Mockups & demo
Issues: 137, 138
Carga: rodada de mockups (processo + artefatos), demo switcher.
