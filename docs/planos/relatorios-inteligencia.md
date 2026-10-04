# Relatórios automatizados + camada de inteligência

Brainstorm de produto — não é spec de implementação. Contexto em `docs/planos/_contexto.md` e `docs/analise-transcricao-mentor.md`.

**Tese:** a coordenação (Léo) precisa de **prestação de contas** — provar aderência, mostrar quem está em risco, auditar o que aconteceu. A "camada de IA" vem **depois** e só onde linguagem agrega valor (narrativa, NLP), porque (a) o volume é pequeno (~30 duplas × 16 encontros ≈ 500 encontros/registros por ciclo — regra clara ganha de ML por anos) e (b) são dados de **menores de idade** — cada envio pra API externa é decisão legal, não técnica.

---

## 0. O que já existe (alicerce — não reinventar)

| Peça | Onde | O que faz hoje |
|---|---|---|
| Export CSV | `src/app/api/export/route.ts` | `?tipo=ciclo` (uma linha/encontro, `:399`), `?tipo=pessoas` (`:446`), `?tipo=assinaturas` (`:528`), `?tipo=respostas&id=<form>` (`:279`). Padrão consolidado: `;` + BOM + tudo entre aspas + anti formula-injection (`celula`, `:673`), nomes de arquivo datados, gate coord-only (`:98-108`) **com paridade demo** (`:33-82`) |
| Semáforo | `src/lib/ciclo.ts:562` `saudadeDaDupla` | Deriva ok/atenção/risco **+ motivo explicável** por dupla — é o motor de "quem está em risco", já audível |
| Resumo da semana | `resumoSemana`/`resumoSemanaDe` (`ciclo.ts:424,468`) + `textoResumoSemana` (`:549`) | Métricas por encontro oficial + texto pronto pro WhatsApp da equipe — **é o embrião do relatório agendado** |
| Resumo da jornada | `src/lib/encerramento.ts:114` `dadosResumoJornada` + `:188` `textoResumoJornada` | Relatório narrativo **determinístico** gravado em `encerramentos.resumo_jornada` — prova de que "relatório gerado" não precisa de IA |
| E-mail | `src/lib/email.ts` (`enviarEmailsLote`/`enviarEmailsIndividuais`, Resend batch) + `email-templates.ts` (`emailLayout`) + log `emails_enviados` (0056) + `dispararParaRoles` (`actions-email.ts:51`) | Disparo transacional real, com audiência e auditoria |
| PDF | `src/lib/documentos/pdf.ts` (pdf-lib, classe `Fluxo` com quebra de página/rodapé/cabeçalho) | Renderer de documento A4 — orientado a parágrafo/tabela de evidências, não a tabelas largas |
| Log de contatos | `interacoes` (0008) + `/api/nudge` + `getUltimasInteracoes` (`src/lib/interacoes.ts:21`) | Cada nudge/contato da coord vira row — **o rastro de "a coordenação agiu"** |
| Presenças | `presencas` (0040) + `queries-presenca.ts` | Chamada por evento de formação; `formacao_ok` deriva |
| Supervisões | `supervisoes` (0041) + `queries-supervisao.ts` | Sessões supervisor↔mentor com resumo |
| Assinaturas | `assinaturas`+`documento_templates` (0033/0046) + `getAssinaturasResumo` | Quem assinou/pendente/expirado, evidências, PDF por id |
| Forms | `formularios`/`formulario_links`/`formulario_respostas` (0036/0042) | Links por destinatário (`dupla_id`, `contexto`), resposta por link |
| Especialista | `solicitacoes_especialista` (0027), `solicitacoes_mural` (0037) | Demanda→aceite→devolutiva, `respondida_em` (latência) |
| Encerramento | `encerramentos` (0037) | Checklist do rito, autoavaliação, `disponivel_proximo_ciclo`, `resumo_jornada` |
| Matching | `AfinidadePar` (`src/components/matching-afinidade.tsx:109`) | Score/alertas determinísticos: interesses comuns, gênero×preferência, sobreposição de agenda, <18 |
| Admin client | `src/lib/supabase/admin.ts` | Service role — pré-requisito pra cron |

**Dois buracos de dados que limitam relatório e IA** (baratos de fechar agora, caros depois):

1. **Semáforo não tem história.** `saudadeDaDupla` é derivada na leitura — "a dupla estava em risco na semana 8 e melhorou" é impossível de responder hoje. Sem snapshot, todo relatório de tendência nasce morto.
2. **Remarcação não tem contagem nem histórico.** `encontros.motivo_reagendamento` é sobrescrito a cada remarcação (`actions.ts:1578-1586`, row única por `(dupla_id,numero)`); só o último motivo sobrevive. A Kelyng pediu exatamente isso na reunião ("sinaizinhos de remarcação, pra não perder esse histórico"). Hoje dá pra contar *encontros cujo último estado envolveu remarcação*, não *quantas vezes a dupla remarcou*.

---

## 1. Catálogo de relatórios pra coordenação

Agrupados por pergunta que respondem. Fonte = tabela/função existente; "lacuna" = dado que falta.

### 1a. Prestação de contas / aderência (o pedido central)

| Relatório | Responde | Fonte | Formato natural |
|---|---|---|---|
| **Encontros do ciclo** (existe `?tipo=ciclo`) | Linha a linha: o que aconteceu, quando, com registro | `duplas`+`encontros`+`registros` | CSV (feito) |
| **Aderência por dupla** | Esperado × realizado (%), atraso médio de registro, média de avaliações, combinados cumpridos, semáforo+motivo | `encontroEsperado`, `diasAtrasoRegistro` (`ciclo.ts:1097`), `PESO_AVALIACAO` (`encerramento.ts:54`), `saudadeDaDupla`, `encaminhamentos` | CSV + página |
| **Semáforo do ciclo** | Quem está em risco/atenção, por quê, desde quando (lacuna: snapshot) | `saudadeDaDupla` + `dupla_saude_snapshots` (nova) | Página + e-mail |
| **Adoção da plataforma** | Encontros agendados na plataforma × `origem='externo'`; registros tardios | `encontros.origem`, `registroTardio` (`ciclo.ts:1084`) | CSV/agregado |
| **Remarcações** | Quantas por dupla, motivos agregados, quem sempre remarca | `motivo_reagendamento` + **lacuna: histórico** | CSV |
| **Por ciclo/turma** | Todos os acima filtráveis por `duplas.ciclo` | `duplas.ciclo`, `ciclosOpcoes` (`ciclo.ts:968`) | parâmetro `?ciclo=` |

### 1b. Pendências operacionais ("o que falta cobrar")

| Relatório | Fonte | Formato |
|---|---|---|
| **Assinaturas pendentes** — quem falta por documento (anti-join `profiles`/`mentorados` × `assinaturas`), links expirados (`token_expira_em < hoje` + status pendente) | `getAssinaturasResumo` (`queries-assinaturas.ts:84`) | CSV + card |
| **Presenças de formação** — quem foi/faltou por evento `formacao`, quem ainda não tem `formacao_ok` | `presencas`, `ciclo_eventos` | CSV |
| **Registros pendentes/tardios** — realizado sem registro, limbo (`emLimbo`), tardios | `saudadeDaDupla.registroPendente`, `registroTardio` | já quase coberto por `?tipo=ciclo` + filtros de `/registros` |
| **Respostas de formulários** — taxa de resposta por form (links emitidos × `usado_em`), pendências por destinatário | `formulario_links`, `formulario_respostas` | agregado + CSV existente |
| **Interações/nudges** — último contato por dupla, duplas nunca contatadas, cadência da coordenação | `interacoes` | CSV |
| **Solicitações de especialista** — latência `created_at`→`respondida_em`, abertas, devolutivas entregues | `solicitacoes_especialista` | CSV |
| **Supervisões** — última sessão por mentor, mentores sem supervisão em N dias | `supervisoes` | CSV |
| **Encerramento do ciclo** — checklist por dupla, concluída × encerrada, `disponivel_proximo_ciclo`, autoavaliações recebidas | `encerramentos` | CSV + página |

### 1c. Institucional (diretoria / financiadores / auditoria externa)

| Relatório | Fonte | Formato |
|---|---|---|
| **Relatório narrativo do ciclo** — prosa + números: aderência média, trajetória, destaques, encerramentos | agregados de tudo acima | página print-friendly → PDF → e-mail |
| **Ficha de prestação por dupla** — o `resumo_jornada` + trilha + avaliações + devolutivas | `dadosResumoJornada` (já print-friendly na ficha) | print/PDF por dupla |

### Formatos — quando cada um

- **CSV** — já é o padrão; ideal pra auditoria/planilha do Léo. Todo relatório tabular sai por aqui primeiro.
- **Página print-friendly** — precedente real: o bloco "resumo da jornada" na ficha da dupla. Pra leitura humana/reunião; permite filtro interativo (`?ciclo=`, `?encontro=`) antes de imprimir. **Quase sempre deve preceder o PDF** — é barato e revisável.
- **PDF** — `pdf-lib`+`Fluxo` existem, mas o renderer é de parágrafos/evidências; tabela larga pede layout próprio. Só onde o documento oficial importa (relatório de ciclo pra financiador, ficha de dupla arquivada).
- **E-mail agendado** — Resend + `emails_enviados` já são infra; `textoResumoSemana` é o protótipo do conteúdo.
- **Dashboard** — a home já é radar (`DashboardCoordenacao`); relatório não é mais dashboard, é **saída** (arquivo, página, e-mail). Não confundir.

### Arquiteturas

**(a) Estender `/api/export` com novos `tipo`s** — *esforço: P por tipo (100–200 linhas de rota + função `csvX` pura)*.
- Prós: padrão maduro (gate, demo, BOM, anti-injection, nomes datados); zero superfície nova; cada tipo testável como função pura (mesma estratégia do Vitest em `tests/`).
- Contras: route handler só devolve CSV — sem preview, sem parâmetros ricos além de query string; **cada tipo paga paridade demo** (`route.ts:33-82`) — o dataset demo já cobre a maioria das entidades, então o custo é previsível, não zero.

**(b) Página `/relatorios` (hub com previews + botões de export)** — *esforço: M (uma página + seções + query de agregados)*.
- Prós: UX condizente com o app; preview antes de baixar resolve "exportei e estava errado"; a mesma página renderiza os print-friendlys; gate natural por papel (pode até escopar pro supervisor com os mesmos dados filtrados por RLS — hoje `/registros` já abre pros dois, `page.tsx:91`).
- Contras: agregados pesados inline na página pedem cuidado de performance (mas ~500 encontros é trivial); nova rota de menu.
- Encaixe: os `tipo=` de (a) viram os botões "Baixar CSV" dentro de cada seção.

**(c) Digest semanal por e-mail (cron + Resend)** — *esforço: M (vercel.json `crons` + rota `/api/cron/relatorio-semanal` com `CRON_SECRET` + template + log em `emails_enviados`)*.
- Prós: vai até o Léo em vez de depender de ele entrar; `textoResumoSemana`/`resumoSemana` já produzem o conteúdo — **o MVP do digest é template, não IA**; log de envio já existe.
- Contras/decisões: cron roda sem sessão → precisa de `createAdminClient` (existe) ou RPC `security definer` escopada; conteúdo carrega nomes de menores → vai pra caixa de entrada (aceitável? ver perguntas); destinatários (só coordenação? supervisores recebem recorte próprio?); dedup pra não reenviar.
- **Bônus oculto:** o mesmo tick semanal é onde o snapshot de semáforo (buraco 1) é gravado — um cron, dois ganhos.

**(d) Agregação no Postgres (views / RPCs / materialized views)** — *esforço: P–M por view*.
- Prós: joins pesados ficam no banco; view coord-only (`*_pessoal` é o padrão: `WHERE my_role()='coordenacao'`) embute o gate; RPC `security definer` serve ao cron sem service-role.
- Contras: **prematuro na escala atual** — PostgREST com embeds resolve tudo que existe hoje (`DUPLA_SELECT` já traz a árvore inteira por request); materialized view precisa de refresh agendado e é ferramenta pra milhões de linhas, não pra ~500. Recomendada só onde a query já provou custo (ex.: um `relatorio_aderencia` como view normal — não materializada — se o cálculo se repetir em export + página + e-mail).

**(e) Snapshots temporais (`dupla_saude_snapshots`)** — *esforço: P (tabela + insert no cron)*.
- Não é relatório, é **habilitador**: semáforo+esperado+feitos+pendência por dupla por semana → destrava "evolução do risco", taxa de resposta a nudge (`interacoes` × melhora posterior), e vira a "verdade histórica" pra treino futuro de qualquer score.
- Prós: barato (30 rows/semana), derivação já existe (`saudadeDaDupla`).
- Contras: é dado derivado gravado — aceitar como cache auditável (mesma filosofia do `resumo_jornada` snapshot, 0037).

**Composição recomendada:** (e)+(a) → (b) → (c) → (d) sob demanda. Nenhuma exclui as outras; a ordem é de valor-por-esforço.

---

## 2. Camada de inteligência

Regra de bolso pra cada capacidade: **o que é conta, fica em SQL/TS; o que é linguagem, pode virar LLM — depois.** Volume de referência: ~30 duplas, ~500 registros/ciclo, ~150 registros com texto livre — minúsculo pra ML, suficiente pra digest por LLM.

| # | Capacidade | Dados | Quando ativar | Abordagem | Custo | LGPD/menores |
|---|---|---|---|---|---|---|
| 1 | **Digest semanal narrativo** p/ coord ("o que aconteceu, quem precisa de você") | `resumoSemana`, semáforo+motivo por dupla, `interacoes`, presenças | Imediato — funciona com 1 dupla | **Template primeiro** (`textoResumoSemana` já é 80%); LLM opcional pra prosa | ~1 chamada/semana → centavos | Nomes de menores na prosa — primeiro nome ok pra consumo interno; conteúdo vai por e-mail (ver P2) |
| 2 | **Resumo da jornada da dupla** | `dadosResumoJornada` (estruturado) + opcional `registros.tema/reflexoes/observacoes` | Já existe determinístico (`textoResumoJornada`); LLM quando coord quiser prosa por dupla | Determinístico hoje → LLM opcional depois | ~30 chamadas/ciclo | **Tier A (só estruturado): seguro.** Tier B (com texto livre): texto fala do menor — exige revisão de base legal antes |
| 3 | **Risco explicável / "preditivo"** | Semáforo histórico (snapshot), remarcações (lacuna), trajetória de avaliações (`PESO_AVALIACAO`), gaps entre encontros, interações | Score composto assim que snapshot+remarcações existirem | **Regras + pesos em TS** (explicável, auditável — o semáforo já prova o padrão). LLM só pra *redigir* a explicação. ML real precisa de N ciclos — honestamente: anos | ~0 | Baixo — só sinais estruturados; explicação sempre mostra o motivo (nunca score opaco) |
| 4 | **Assistente de matching** | `interesses`, `motivacao`/`objetivos`, `disponibilidade`, `areas`, `pref_genero_par`, `escolaridade`, cidade/UF | Pré-ciclo, 1×/turma (~30 pares) | `AfinidadePar` já cobre regras duras; LLM agrega: ranquear pares com justificativa a partir do texto livre de motivação/objetivos; embeddings pra sinônimos de interesses ("violão"≈"música") | 1 lote pequeno/ciclo | Campos já coord-only (`*_pessoal`); motivação é texto livre — scrub de nomes no prompt; **sugestão com razão, decisão humana** (nunca auto-formar) |
| 5 | **NLP sobre registros** (temas, tom, sinais de alerta) | `reflexoes`, `observacoes`, `dificuldade_detalhe`, `proximo_passo_detalhe` | Com ~1 ciclo de texto acumulado E decisão legal tomada | 1º passo sem IA: vocabulário fechado já existe (`atividades`, `dificuldade` enum) + busca por palavras-chave de safeguarding. LLM depois, com pipeline de minimização | ~500 textos — barato em $, caro em compliance | **O ponto mais sensível do sistema:** texto livre pode conter saúde/família/violência (dado sensível de menor, Art. 11+14 LGPD). Só com revisão legal + scrub + retenção zero no provedor |
| 6 | **Relatório narrativo da turma/ciclo** p/ financiadores | **Só agregados** (aderência, avaliações, presenças, encerramentos) | Fim de ciclo / marcos | LLM ideal: transforma números em prosa institucional; template fallback | 1–4 chamadas/ciclo | **Melhor primeira candidata LLM:** não precisa de nenhum nome nem texto livre — dado agregado não é pessoal |
| 7 | **Perguntas em linguagem natural** ("quais duplas não se encontram há 3 semanas?") | tudo | Distante | Text-to-SQL é frágil; alternativa honesta: filtros salvos + relatórios parametrizados já cobrem 90% | — | Prompt pode vazar escopo — adiar |
| 8 | **Preenchimento inteligente de lacunas** ("falta disponibilidade do mentor X") | campos null | Já é SQL | Regra pura — não é IA, entra nos relatórios de pendência | ~0 | ok |

### Análise LGPD (dados de menores — o eixo que manda)

- **Consentimento atual:** `autorizacao-responsavel` (responsável assina por menor) + `termo-mentorando` + `consent_lgpd_em` em profiles. **Pergunta jurídica aberta:** o termo cobre "processamento automatizado dos registros da mentoria por terceiros (API de IA)"? Provavelmente não explicitamente — resolver antes da capacidade 5 (e de preferência antes de qualquer texto livre sair do perímetro).
- **Minimização:** capacidades 1/2A/3/6 rodam com **dados estruturados ou agregados** — sem `reflexoes`/`observacoes`/`motivacao` cruas no prompt. Esse é o corte que separa "ativa amanhã" de "precisa de parecer".
- **Transferência internacional:** API de LLM = transferência (Art. 33 LGPD). Mitigações: provedor com DPA + **zero retention** (não treina, não loga), ou scrub de PII antes do envio (nomes → "o mentorado", sem CPF/endereço/escola — `dados_civis`/`documentos_pessoa` nunca entram em prompt, ponto).
- **Direito de exclusão:** se texto sair pra API com retenção, não dá pra honrar pedido de eliminação → exige retenção zero contratual.
- **Regra prática proposta:** capacidades LLM trafegam **agregados ou dados estruturados** por default; texto livre de/​sobre menor só com flag legal explícita (ex.: `processamento_ia_ok` derivado do termo) e pipeline de scrub documentada em `/privacidade`.
- **Custo real:** chamadas de LLM nesse volume são centavos/mês (Haiku/mini-class). O custo verdadeiro é engenharia + compliance — mais um motivo pra template determinístico primeiro.

---

## 3. Roadmap faseado

### Fase 0 — agora, SQL/TS puro, sem IA nem infra nova
- Fechar os **dois buracos de dados**: `dupla_saude_snapshots` (tabela + captura semanal — mesmo sem cron, dá pra gravar sob demanda num botão "fechar semana" ou no primeiro acesso da semana) e **histórico de remarcações** (`encontro_eventos` audit log ou `vezes_reagendado` counter — decide junto com a spec de agendamento da ata, que mexe nesse fluxo).
- Novos `tipo=` no `/api/export` (esforço P cada, com paridade demo): `aderencia`, `assinaturas-pendentes`, `presencas`, `supervisoes`, `interacoes`, `solicitacoes`, `encerramento`, `forms-taxa`. Todos com parâmetro `?ciclo=` (o filtro por turma já existe como `duplas.ciclo`).

### Fase 1 — superfícies de saída
- `/relatorios` hub coord (seções por pergunta, preview, botão CSV → (a), print-friendly pra ficha de dupla e aderência).
- **Digest semanal por e-mail** via Vercel cron + Resend: conteúdo = `textoResumoSemana` enriquecido (risco+motivo, pendências, presença de formação); log em `emails_enviados`; **no mesmo tick grava o snapshot** (e).

### Fase 2 — primeira camada LLM (só agregados/estruturados)
- Relatório narrativo do ciclo (capacidade 6 — zero PII).
- Resumo de jornada da dupla em prosa opcional sobre `dadosResumoJornada` (capacidade 2, tier A).
- Score de risco composto explicável (capacidade 3 — TS, não LLM).
- Assistente de matching ranqueado com justificativa (capacidade 4 — com scrub).

### Fase 3 — depois de volume + parecer legal
- NLP sobre texto livre de registros (capacidade 5) — só com base legal resolvida e pipeline de minimização.
- Análise cross-ciclo de coortes (precisa de >1 ciclo de snapshots).
- Linguagem natural ad-hoc (capacidade 7) — se ainda fizer falta.

**Dependências com outras frentes:** multi-cronograma (ata: turma roda 2 cronogramas) — relatórios filtram por `duplas.ciclo` hoje e devem assumir escopo de turma quando a refatoração chegar; remarcações — a spec de agendamento nova é o momento natural de gravar o histórico; storage — relatórios são gerados sob demanda, **nada arquivado** (Drive nonprofit pode virar destino de PDFs oficiais depois, alinhado à ata).

---

## 4. Recomendação + perguntas abertas

**Recomendação:**
1. Começar por **(e) snapshot + buraco de remarcações** — custo P, e são os dois únicos itens cuja ausência *impede* relatórios futuros (tendência e histórico morrem sem eles).
2. **(a) export tipos** na sequência — é onde o padrão já está pago; entrega a planilha de prestação de contas em uma semana.
3. **(b) `/relatorios`** consolida; **(c) digest por e-mail** é o primeiro "automático" — e **começa como template**, que já carrega 80% do valor com 0 risco LGPD.
4. IA entra **só na Fase 2**, e entra pelos agregados (narrativa da turma) — nunca começando pelo texto livre dos registros. O "preditivo" honesto é score de regras explicável, não ML.
5. Nada de materialized view agora — escala não justifica; view normal/RPC se alguma agregação se repetir em 3 lugares.

**Perguntas abertas (pra Thiago/Léo):**
1. **Pra quem é a prestação de contas?** Diretoria, financiadores, auditoria? Resposta muda o mix: tabular (CSV) × narrativo (página/PDF).
2. Como o Léo reporta hoje — planilha manual, docs? O que ele preenche à mão que o sistema já sabe?
3. Digest por e-mail: **só coordenação** ou supervisores recebem o recorte das duplas deles? E **conteúdo completo no corpo** (nomes de menores na caixa de entrada) vs. resumo numérico + link pra plataforma?
4. A **autorização do responsável** cobre processamento automatizado dos dados da mentoria (inclusive por serviço de IA)? Se não, vale emendar cláusula na próxima versão do termo — é o gate real das capacidades 2B/4/5.
5. Snapshot de semáforo: aceito gravar dado **derivado** (como `resumo_jornada` já é)? E captura semanal — cron ou sob demanda?
6. Histórico de remarcações: `encontro_eventos` audit log genérico (serve pra outras auditorias) ou contador simples?
7. `/relatorios` abre pro **supervisor** com escopo próprio (como `/registros`) ou fica coord-only?
8. Retenção: quanto tempo guardar `reflexoes`/`observacoes`/`form_bruto` depois do encerramento do ciclo? Anonizar é opção real?
9. Turma/cronograma: relatórios assumem `duplas.ciclo` até a refatoração multi-cronograma — ou esperam?
10. PDFs oficiais (relatório de ciclo, ficha de dupla) valem arquivar no **Drive nonprofit** em vez de gerar sob demanda pra sempre?
