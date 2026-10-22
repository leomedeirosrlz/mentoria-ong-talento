# Recon — status real das issues abertas no Jira

_Auditoria read-only do código em `~/nb/realiza.vc` (22–23/out/2026). Vereditos:
`FEITO` = implementado em produção no código atual · `PARCIAL` = parte entregue,
resto falta · `ABERTO` = não há evidência de implementação · `OBSOLETO` =
absorvida/duplicada (ver manifesto). Evidências em `path:linha` ou migration.
Onde a evidência é ambígua, está marcado `a verificar`._

## Tabela de vereditos

| Issue | Veredito | Evidência | Falta |
|---|---|---|---|
| REALIZA-15 | FEITO | `supabase/migrations/0061_cronogramas.sql` cria `cronogramas`, `ciclo_eventos.cronograma_id`, `duplas.cronograma_id`/`turma`; semáforo escopado por cronograma via `saudadeDaDupla`/`eventosDoCronograma` em `src/lib/ciclo.ts`, consumido por `agenda-coordenacao.ts`, `agenda-minha.ts`, `agenda-auxiliar.ts` | — |
| REALIZA-30 | FEITO | `0062_eventos_cronograma.sql`: tipos `etapa_preparacao`/`encontro`/`recesso`/`evento_encerramento`/`formacao`, `data` nullable, `status` pendente/concluída, `observacao`, `ordem`; seed/demo têm dias variáveis (quintas T2 — comentário em `agenda-calendario.tsx:1290`) | — |
| REALIZA-31 | FEITO | `0061` semeia `cronogramas` da união dos labels `duplas.ciclo`/`ciclo_eventos.ciclo` (migração linhas 55–96); T2 criada por script `scripts/importar-turma2.ts` | T3 parametrizada é da REALIZA-167 |
| REALIZA-22 | PARCIAL | Dialog retroativo existe (`RegistrarRetroativoDialog`, "Confirmar remarcação"/"Registrar encontro" em `agendar-encontro-dialog.tsx`); mas "Agendar encontro" ainda vai pro overflow "Mais" quando `pendenteRegistro && podeAgendar` — `duplas/[id]/page.tsx:566-578` | Posição estável do Agendar; microcopy "datas oficiais são sugestões" não encontrada na agenda |
| REALIZA-26 | ABERTO | Só existe `encontros.motivo_reagendamento` (coluna única, sobrescrita — `types.ts` Encontro, migration `0011_motivo_reagendamento.sql`). Nenhuma tabela/thread de histórico de remarcações no schema | Tabela/log append-only de remarcações |
| REALIZA-27 | FEITO | `AgendarEncontroDialog` recebe `numero`/`proximoNumero` explícito e abre do card (ficha `page.tsx:566`, `agenda-partes.tsx`, `agenda-por-mentorado.tsx`) | — |
| REALIZA-28 | FEITO | `agenda-calendario.tsx`: disco de status por encontro (`:1448`), popup/detalhe (`EncontroDetalheDialog`), painel lateral/semana, selo "fora do dia oficial" (`:805`,`:1598`) | — |
| REALIZA-36 | PARCIAL | `src/lib/forms/schema.ts` tem 10 tipos (`texto`, `texto_longo`, `select`, `multi_select`, `escala_1_5`, `escala_1_10`, `data`, `checkbox`, `sim_nao`, `secao`); `secao` é rótulo de estrutura (0080) | `arquivo` (upload), `grid_disponibilidade`, `visible_if` (condicional), "Outro" texto livre |
| REALIZA-38 | FEITO | `dados_civis` jsonb em `profiles`/`mentorados` com endereço completo `logradouro/numero/complemento/bairro/cep/cidade/uf` — `types.ts:897-903`, migration `0046_dados_civis.sql` | — |
| REALIZA-39 | ABERTO | `/pessoas` (`pessoas-listas.tsx`) agrupa por papel/status, sem agrupamento por turma; `PillTurma` só na `fila-acompanhar.tsx:193` | Seção/aba por turma (dep: 167) |
| REALIZA-40 | FEITO | `duplas/page.tsx:26-55`: visões `coordenacao`/`supervisor`/`mentor`/`especialista`/`hibrido`; RLS escopa, supervisor vê supervisionadas | — |
| REALIZA-73 | PARCIAL | `/turmas` + `/turmas/novo` existem (coord-only); home tem `DashboardCoordenacao` com resumo por cronograma ativo e label de turma (`dashboard-coordenacao.tsx:131,231-239`) | Hub completo por turma na home depende de 167 |
| REALIZA-46 | FEITO | `src/app/(app)/turmas/novo/page.tsx` + `CronogramaBuilder`; escrita via `salvarEventoCronograma` (`actions-cronogramas.ts:292`) | — |
| REALIZA-47 | ABERTO | Não existe tabela `turmas` — `turma` é texto em `cronogramas.turma` (`0061:30`) e `duplas.turma` | Modelo físico (mínimo vai na 167) |
| REALIZA-49 | ABERTO | `formularios/respostas-section.tsx` é resumo agregado (médias/listas); `relatorio-canvas.tsx` é grade configurável de relatório, não de respostas por respondente×campo | Grade tipo planilha com alternância grade↔cards |
| REALIZA-52 | ABERTO | `src/lib/ia/tools.ts`+`queries.ts` = registry de tools de leitura (fase 0) com auditoria `ia_eventos` (0083); nenhum score determinístico nem chamada LLM no código | Score de regras + narrativa LLM (dep: 178) |
| REALIZA-54 | PARCIAL | `arquivos-dupla.tsx` agrega `registro_anexos` da dupla; renderiza `null` quando vazio (sem empty state); não inclui PDM | Agregar PDM/instrumentos e estado vazio explicativo |
| REALIZA-55 | ABERTO | `material-preview-pdf.tsx` só faz preview (iframe página 1); `pdf-lib` no package.json mas nenhum canvas/overlay/flatten; nenhum `atividade_links` | Editor de PDF completo (dep: 20) |
| REALIZA-56 | PARCIAL | `/relatorios` existe: `relatorio-builder.tsx` = grade configurável (turma/granularidade/colunas, resize, sort, CSV) | Dashboards operacionais (presença, atrasos, remarcações, apoio, instrumentos, termos) — dep: 182 |
| REALIZA-61 | FEITO | CTAs em voz do executor: "Como foi o Nº encontro" (`agenda-calendario.tsx:3573`), "Sem registro: o mentor ainda não contou como foi" (`encontro-detalhe-dialog.tsx:245`), "Registrar como foi" | — |
| REALIZA-62 | ABERTO | Padrão "a partir de —" não localizado no código atual (UI mudou: `LembreteButton` mostra "Lembrada dd/mm" no bloqueio 48h — `lembrete-button.tsx:51-66`) | Confirmar superfície original do bug; se replicado em outro texto, placeholder "sem prazo definido" |
| REALIZA-64 | FEITO | `/f/[token]` identifica destinatário: "Este link é de outra pessoa" com `info.destinatario` em destaque (`f/[token]/page.tsx:144-155`) | — |
| REALIZA-66 | PARCIAL | Caps existem: 10 MB anexos (`anexos-registro.tsx:13`, `chamado-anexos.tsx:9`), 20 MB documentos (`documento-pessoa.tsx`), 2 MB foto (`actions.ts:107`), 1 MB assinatura | Compressão client-side canvas→webp não implementada |
| REALIZA-68 | PARCIAL | `/api/export` suporta `tipo=ciclo` (default, encontros+registros), `assinaturas`, `pessoas`, `respostas` — `route.ts:136-149` | Tipos `atividades`, `matching`, `presencas` |
| REALIZA-69 | ABERTO | `sistema` em `formularios` cobre `anamnese`, `avaliacao_360`, `autoavaliacao_mentor`, `avaliacao_especialista`, `visao`, `metas`, `pdm`, `roda_vida` (`schema.ts:63`) — nenhum template de intake/matching | Template "Matching de Mentores" nativo |
| REALIZA-70 | ABERTO | Idem 69 | Template "Matching de Mentorados" nativo |
| REALIZA-71 | PARCIAL | Avaliação por encontro entregue: `avaliacoes_encontro`+`avaliacao_links` (0071), média quantizada ≥3 pro mentor (`avaliacao-jovem.tsx:297`, `avaliacao_media_dpp`) | Agregação explícita no instrumento 360º (hoje são trilhas separadas) |
| REALIZA-72 | FEITO | Papel visível no shell: `papelCurto(me.role)` topbar mobile e `papelLabel` sidebar (`app-shell.tsx:130,209`); onboarding por papel via `RECURSOS` e passos distintos (`onboarding-flow.tsx:65-156`) | — |
| REALIZA-98 | ABERTO | `dupla_dpp_id` existe só em `solicitacoes_especialista` (`database.types.ts:3289`, FK `:3369`); `Dupla` não tem self-FK (`types.ts:479-513`) | Coluna `duplas.dupla_dpp_id` |
| REALIZA-99 | FEITO | `podeSupervisionar` aceita `supervisor`+`coordenacao` (`ciclo.ts:2116-2118`); dialogs buscam role `coordenacao` pra supervisão (`nova-dupla-dialog.tsx:124`, `editar-dupla-dialog.tsx:93`); validado em `actions.ts:695` e `:1548` | — |
| REALIZA-100 | FEITO | `rematch_dupla` (0064, revisto 0105): fecha dupla antiga com carimbo/motivo, cria nova com `remanejada_de`, carrega turma/cronograma/supervisor/demanda/trilha; esp emite `emitir_avaliacao_esp` | — |
| REALIZA-101 | FEITO | Fila derivada em `src/lib/fila.ts` (`filaMentorados`/`filaMentores`, `esperaDesde`, `textoEspera`, "há N dias"); UI `fila-espera.tsx` + `fila-acompanhar.tsx` (WhatsApp via `msgAguardandoPar`) | — |
| REALIZA-102 | FEITO | `src/lib/importar-duplas.ts` (REALIZA-102 no header) + tipo `duplas` no `importar-csv-dialog.tsx:31-56` com prévia server-side | — |
| REALIZA-103 | FEITO | Builder visual `CronogramaBuilder` (`/turmas/novo`, edição) + ações `salvarEventoCronograma`/`renumerar`/`recalcTotais` (`actions-cronogramas.ts:292-356`) | — |
| REALIZA-137 | FEITO | `docs/mockups/` com 2 rodadas + final composta e `RELATORIO.md` (vencedores por tela, rubrica de domínio) | — |
| REALIZA-138 | ABERTO | `DemoBar` tem seletor de papel "Ver como" (`demo-bar.tsx:142-160`) mas nenhum switcher `demo_view`/variantes de mockup | Switcher "Alterar view" nas variantes |
| REALIZA-140 | FEITO | "Minha jornada" implementado: `estacoesJornada` com 7 estações canônicas (`lib/jornada.ts:578`, `Estacao`/`EstacaoChave`), página `jovem/materiais/page.tsx`, rascunho localStorage (`JornadaRascunho`), links sem expiração | — |
| REALIZA-141 | OBSOLETO | Absorvida por REALIZA-181 (manifesto) | — |
| REALIZA-142 | OBSOLETO | Absorvida por REALIZA-181 (manifesto) | — |
| REALIZA-143 | PARCIAL | `instrumentos/roda-vida.tsx` existe com roda interativa + foco por eixo (navegação CaretLeft/Right) | Confirmar se o layout visual pedido (16 eixos legíveis no desktop) está entregue — a UI atual é um eixo por vez |
| REALIZA-144 | PARCIAL | `secao` renderiza divisor editorial com título+descrição em `/f/[token]` (`formulario-publico.tsx:601-613`); não é wizard multi-etapa | Modo wizard/paginação por seção |
| REALIZA-152 | FEITO | `materialLiberadoParaJovem` faz gate por `encontro_num ≤ encontro corrente` (`jornada.ts:567-575`), aplicado no acervo do jovem | — |
| REALIZA-147 | FEITO | `0104_avaliacao_especialista.sql` (form `avaliacao_especialista` semeado, `encerrar_trilha_especialista` emite link §13 na mesma transação); `0105` extrai `emitir_avaliacao_esp` e o rematch esp também emite | — |
| REALIZA-63 | FEITO | `0037_encerramentos.sql` (tabela+rito) + `EncerramentoDupla` (checklist, autoavaliação, 360º, decisão) + `resumo-jornada.tsx` print-friendly + fechamento automático no último encontro (0102) | — |
| REALIZA-171 | ABERTO | Confirmado no próprio comentário da 0105: rematch emite avaliação §13 mas `rematch_dupla` não tem campo `devolutiva_pdm`; Jira segue "Tarefas pendentes" | Estender RPC com `devolutiva_pdm` ou gerar devolutiva na emissão do link |
| REALIZA-172 | PARCIAL | `atribuido_nome` agora populado (`queries-chamados.ts:94`); demais itens seguem: `getCicloEventos` ainda chamado no portal jovem e zerado por RLS (`jovem/agenda/page.tsx:54,92,131-137`), agenda sem CTA de encerramento, `/assinar/[token]` sem faixa demo (nenhum ref demo), dataset demo sem `outra_pessoa` (confirmado `demo/queries.ts:1938`), card "expirado" de terceiros — a verificar, edição de evento esp × `cronograma_id` — a verificar | 5-6 dos 7 débitos |
| REALIZA-183 | ABERTO | `/resumo/[slug]` é slug fixo `RESUMO_SLUG_T2` hardcoded (`relatorio.ts`), sem escrita de log (page.tsx só lê via admin) | Tabela `resumo_acessos` + log fire-and-forget |

## Notas por issue

- **REALIZA-15/30/31/46/103**: eixo cronograma entregue em cadeia (0061→0062→builder). O que sobra é parametrização de turma (167), não mais schema.
- **REALIZA-22**: o polish "Agendar nunca dentro do ⋯Mais" está **revertido na prática**: quando há registro pendente o Agendar é empurrado pro overflow (`page.tsx:566`). O dialog retroativo existe com sinalização explícita.
- **REALIZA-26**: `motivo_reagendamento` é só a última razão — sem histórico. Issue permanece aberta.
- **REALIZA-36**: dos 5 tipos pedidos só `secao` existe (via 0080). Bloqueia 69/70/49.
- **REALIZA-52**: existe infraestrutura de IA (tools+auditoria) mas nenhum artefato do pedido (score+narrativa). Manter ABERTO, dep 178.
- **REALIZA-56**: a página existe mas é um construtor de grade, não o hub de dashboards operacionais do issue. PARCIAL.
- **REALIZA-61/62/64**: 61 e 64 entregues. 62 precisa de confirmação da superfície original (o padrão literal "a partir de —" não existe mais).
- **REALIZA-98**: `dupla_dpp_id` está em `solicitacoes_especialista`, não em `duplas` — issue válida.
- **REALIZA-143/144**: componentes existem mas possivelmente aquém do pedido (roda 1-eixo-por-vez; seção = divider, não wizard). PARCIAL com nota.
- **REALIZA-138**: o "Ver como" da DemoBar troca papel, não variantes de view — issue segue aberta.
- **REALIZA-172**: 1 item provavelmente resolvido (`atribuido_nome` populado em `queries-chamados.ts:94`); `getCicloEventos` no portal jovem, faixa demo em `/assinar`, `outra_pessoa` no demo e CTA de encerramento na agenda confirmados **ainda abertos**; 2 itens a verificar.

## Histórias 77–85 e seus work items

| História | Resumo | Cobre as issues |
|---|---|---|
| REALIZA-77 | Navegar/filtrar a plataforma por turma | 73, 39, 32, 41, 48, 43, 38, 40, 72 |
| REALIZA-78 | Agenda do mentor / remarcação | 25, 24, 28, 27, 23, 22, 21, 26, 61 |
| REALIZA-79 | Monitorar saúde da dupla e agir | 74, 62 |
| REALIZA-80 | Mentorado responde atividades por token | 20, 50, 19, 18, 17, 59, 51, 16, 64, 71 |
| REALIZA-81 | Receber inscrições de mentores/mentorados | 36, 70, 69, 58, 49 |
| REALIZA-82 | Exportar dados e relatórios operacionais | 68, 56, 57, 52, 42 |
| REALIZA-83 | Mentorado preenche instrumentos PDF escrevendo sobre | 55, 67 |
| REALIZA-84 | Base operacional saudável | 35, 37, 66, 65, 54, 33, 53 |
| REALIZA-85 | Conduzir encerramento de ciclo por dupla | 63 |

(Emissões por história extraídas dos descriptions do Jira; subtasks de aceite 87–95 e épicos 7–14/75/104 são index-only.)
