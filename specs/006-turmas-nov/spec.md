# Spec — Importar cronograma de turma (REALIZA-34)

**Status:** Delivered · **Issue:** REALIZA-34 · **Auditoria:** `docs/audits/turmas-2026-11.md`

## Problema

Coordenação recebe o cronograma da turma em PDF, planilha ou DOCX e hoje redigita tudo no builder. O Jira pede: **upload → extração → normalização em camadas → revisão humana editável → persist** de `cronograma` + `ciclo_eventos` (+ turma, que hoje é label text até a REALIZA-47 promover a entidade).

## Requisito

O que a fatia entrega (SLC — só formatos que funcionam fim a fim entram no `accept`):

1. **Entrada** `/turmas/novo`: coordenação escolhe "Importar de arquivo" e envia um arquivo.
2. **Formatos**: PDF, planilha (`.xlsx`, `.xls`, `.csv`, `.tsv`), DOCX, `.txt`. **Imagem fica fora** — o provider de IA é texto-only e a fatia não mente: `accept=` não oferece imagem; bypass no servidor responde erro limpo ("Formato ainda não suportado: converta a imagem em PDF").
3. **Camada 1 — extração**: texto/linhas por formato, 100% determinístico, no servidor (`pdfjs-dist` legacy, `xlsx`, `mammoth`; CSV/TXT direto). Nada sai da máquina.
4. **Camada 2 — normalização**: parser determinístico em cima do texto/linhas → `EventoRascunho[]` + metadados sugeridos (`turma`, `nome`) + `avisos[]` + `confianca` (0-1).
5. **Camada 3 — fallback IA**: confiança baixa, ou usuário clica "Tentar com IA": o texto (truncado) vai pro provider existente (`chamarModelo` com `toolChoice` forçado, schema = `EventoRascunho`); saída validada pelas mesmas regras. Se o provider não estiver configurado, o botão nem aparece.
6. **Revisão obrigatória**: nada persiste automaticamente. Os rascunhos alimentam a prévia editável do `CronogramaBuilder` (mesma UI, mesma `validaEventos`) — avisos do parse ficam visíveis no topo.
7. **Persist**: `criarCronograma` sem mudança — grava `cronogramas` (com `turma` label) + `ciclo_eventos`; `created_by` já é a trilha.

## Regras

- Server action `importarCronogramaRascunho(FormData)` retorna `{ ok: true, resultado } | { error }`; nunca grava; `meCoord()` (RLS continua sendo a fronteira no persist).
- Arquivo nunca é salvo (sem bucket, sem tabela de importação — LGPD: zero cópia do documento).
- Tamanho máx. 8 MB; PDF limita 40 páginas; IA recebe no máx. ~30k chars.
- Demo: página já é bloqueada (só leitura) — a fatia herda.
- Auditoria IA: `ia_eventos` não recebe canal novo nesta fatia (CHECK fecha 'chat'/'mcp'); rastreabilidade da gravação é `cronogramas.created_by`.

## Esquema alvo (canônico — já existe)

`EventoRascunho` de `gerador-cronograma.ts`: `tipo` (`etapa_preparacao|encontro|recesso|formacao|evento_encerramento`), `numero`, `data`/`data_fim` ISO, `titulo`, `fase` (DPP), `instrumentos[]`, `status`, `observacao`. Validação: `validaEventos` — encontros numerados 1..N, datas obrigatórias fora de etapa concluída, etc.

## Aceite

- CSV/PDF/XLSX/DOCX do cronograma real produzem a lista certa ou avisos acionáveis (teste de fixture cobre os 4 formatos).
- Parse fraco abre prévia com avisos, nunca grava; IA configurada melhora o rascunho a pedido.
- Salvar usa o contrato existente e aparece em `/turmas`.
- e2e app: upload CSV → prévia → salvar → card em `/turmas`.
