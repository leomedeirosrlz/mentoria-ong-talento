# REALIZA-34 — Criar turma via upload de cronograma (PDF/planilha → normalização → revisão → persist)

- **Jira:** [REALIZA-34](https://kelyng.atlassian.net/browse/REALIZA-34) (Feature, prioridade High; migrada do Linear REALIZA-45)
- **Tier:** A
- **Veredito da auditoria:** **ABERTO** — plano completo nesta pasta.

## O que a issue pede (decisão Thiago, 03/out/2026)

Coord cria turma nova **upando o cronograma** — normalizado, robusto, multi-formato:

1. Upload (PDF / planilha / DOCX / imagem) → extração;
2. **Normalização em camadas**: parser determinístico por formato → **Gemini API como fallback/normalizador** (autorizado) → schema canônico;
3. **Revisão humana obrigatória** antes de gravar (SLC: nunca gravar parse cego);
4. Persiste `turma` + `cronograma` + `ciclo_eventos`.

Schema canônico alvo (dos 2 PDFs reais): etapas de preparação (nome, data/período, obs), encontros numerados (data, fase metodológica, dia-da-semana variável), recesso, evento de encerramento, observações/regras — o mesmo modelo que `ciclo_eventos` já carrega (`0062`, `EventoRascunho` em `src/lib/gerador-cronograma.ts:17-38`).

## Destinos parciais (absorção declarada)

Esta issue é **parcialmente absorvida** por duas irmãs — o plano cobre o que falta e aponta o destino de cada parte:

- **REALIZA-167** — fornece o degrau de parametrização: turma nova sem migration/código hardcoded (`turma_inscricoes`, `resumo_links`). O upload da 34 **persiste dentro do modelo que a 167 parametriza** (turma por label → `turma_id` na 47).
- **REALIZA-180** — pipeline de importação inteligente **generalizado**: extração com visão, match semântico com confiança+razões, revisão em linguagem natural, escrita só via RPCs existentes, auditoria `ia_eventos`. A 34 é o **caso de uso cronograma** desse pipeline — se a 180 implementar primeiro, a 34 vira uma fonte/adaptador (`cronograma_upload`) plugado nela.

Ordem coerente: **167 → (180 ∥ 34)** — 34 pode sair antes da 180 com pipeline próprio mais simples (determinístico + Gemini fallback + revisão), desde que o contrato de persistência seja o das actions existentes.

## Estado atual (evidências)

- `CronogramaBuilder` (`src/components/cronograma-builder.tsx`) — o wizard manual `/turmas/novo` já é a **tela de revisão** ideal: passo 2 materializa a lista editável antes de gravar.
- `criarCronograma` (`src/lib/actions-cronogramas.ts:130`) — persiste cronograma+eventos em uma action `{error}`/`{ok}` — é o contrato de escrita que o upload deve chamar (não escrever tabela crua).
- `gerador-cronograma.ts` — `EventoRascunho`/`validaEventos`/`TIPO_EVENTO_LABEL`/`FASES_DPP`: o schema canônico de saída do parser já existe como tipo TS.
- `src/lib/importar.ts` — `normEmail`/`normNome`/`parseCsv`: padrão de importação determinística existente (usado por `importar-turma2.ts` e CSV de pessoas — `ImportarCsvDialog` em `pessoas-listas.tsx:466`).
- Upload/storage de arquivos: padrão existente via buckets privados (`materiais`, `registro-anexos`) + actions — a verificar se há action genérica de upload ou se cada fluxo assina a sua (provável: `actions` específicas; ver `src/app/api/material/[id]`).
- Gemini/IA: **não há** integração existente no repo (a verificar — recon não registra provider de IA); entra como dependência nova, contrato mínimo no `sdd.md`/`sdr.md`.

## Documentos

`plan.md` (pipeline por etapas + PRs), `sdd.md` (schema canônico + contratos + Gemini), `design.md` (fluxo de revisão), `sdr.md` (LGPD/IA/rate limit), `acceptance.md`.

## Esforço / risco

- **M-G** com parser determinístico + Gemini fallback; **G** se incluir visão em imagem (coberto pela 180).
- Risco: Gemini alucinar datas → mitigação central: revisão humana obrigatória + `validaEventos` no submit (o CHECK do banco é a última palavra).
