# REALIZA-34 — plan.md (executável sem reler o Jira)

## Premissas verificadas

- Tela de revisão = passo 2 do `CronogramaBuilder` (`src/components/cronograma-builder.tsx`) — lista materializada editável já existe.
- Persistência = `criarCronograma` (`src/lib/actions-cronogramas.ts:130`) `{error}`/`{ok}` — contrato único de escrita.
- Schema canônico de saída = `EventoRascunho` (`src/lib/gerador-cronograma.ts:17-38`) + `validaEventos` + `TIPO_EVENTO_LABEL` + `FASES_DPP`.
- Parse determinístico de CSV já existe (`src/lib/importar.ts` — `parseCsv`, usado por `importar-turma2.ts` e `ImportarCsvDialog`).
- IA: nenhuma integração existente — `[NOVO]` client Gemini server-side.
- `a verificar`: dependências de parse (xlsx/docx/pdf) em `package.json`; pattern de upload (bucket vs FormData).

## PR 1 — extração + normalização determinística (sem IA)

1. `src/lib/importar-cronograma/extrair.ts` `[NOVO]` — `extrairTextoETabelas(arquivo) → {texto, tabelas}` por extensão (csv/xlsx direto; pdf via dep nova ou `pdftotext` shell — decidir por dependência real; docx via `mammoth` se já dep).
2. `src/lib/importar-cronograma/normalizar.ts` `[NOVO]` — heurística → `EventoRascunho[]` + `confianca` + `avisos[]`. Regras: bloco "preparação"→`etapa_preparacao`; "Encontro N"+data→`encontro` com `numero`; faixa de datas→`data_fim`; palavras recesso/encerramento/formação→tipos; fase por match com `FASES_DPP`.
3. Vitest cobrindo os 2 PDFs reais transcritos como fixture de texto (pedir o texto dos PDFs reais — `a verificar` localização em `docs/` ou intake) + casos: dia-da-semana variável, etapa sem data, recesso com período.
4. Server action `importarCronogramaRascunho(formData)` `[NOVO]` — recebe arquivo, roda extração+normalização, devolve `{rascunhos, avisos}` (não persiste nada).

## PR 2 — UI: modo "Importar" no builder

- `/turmas/novo`: entrada "Importar de um arquivo" `[NOVO]` ao lado do modo manual (tabs ou card inicial de escolha — microcopy "Já tem o cronograma em PDF ou planilha?").
- Upload → action → rascunhos alimentam o **mesmo passo 2** do builder (revisão completa). Estados: parseando (botão spinner `CircleNotch` padrão), falha de extração (mensagem + "tente o cadastro manual"), revisão (builder normal).

## PR 3 — Gemini fallback

- `src/lib/importar-cronograma/gemini.ts` `[NOVO]` — `normalizarComGemini(texto, tabelas) → EventoRascunho[]` com JSON schema; prompt mínimo (texto do cronograma apenas); timeout+retry.
- `importarCronogramaRascunho` chama Gemini só quando `confianca < limiar` ou usuário pede "tentar de novo com IA"; resposta faz merge por campo vazio; marca `origem`.
- `GEMINI_API_KEY` em env (Vercel prod+preview, `.env.local`); sem key → determinístico puro + aviso.

## PR 4 — auditoria + refine

- Se `ia_eventos` (180) existir: logar `{tipo:'cronograma_upload', provider, confianca, user}` via ela; senão `cronograma_importacoes` `[NOVO]` magra (id, file_name, parser, confianca, created_by, created_at, cronograma_id resultante).
- Badge "sugerido por IA" nas linhas revisadas.
- Imagem (png/jpg): entra **só** se 180 já provê visão; senão aceita o tipo mas responde "imagem ainda não suportada — converta pra PDF" (SLC: não fingir suporte).

## Demo / e2e

- Demo: builder demo mostra modo "Importar" com upload simulado — retorna rascunho fixo do dataset (T3 fake) pra revisão funcionar sem chamar nada; action devolve DEMO_MSG no submit final (padrão casa).
- e2e app: spec novo `turmas-importar.spec.ts` — upload de CSV fixture → revisão → grava → cronograma aparece em `/turmas`.

## Rollback

- PRs independentes: desligar = esconder entrada "Importar" (flag/remover card) — nada foi persistido fora do fluxo manual. Sem migration destrutiva envolvida (bucket/tabela de log são aditivos).

## Dependências

- **167 primeiro** (modelo de turma que recebe o persist) — se 167 atrasar, a 34 ainda funciona gravando com label texto (como hoje); só registra a dívida.
- **180** quando chegar: trocar o adaptador `gemini.ts` pelo pipeline dela e aposentar `cronograma_importacoes` se `ia_eventos` assumir.
