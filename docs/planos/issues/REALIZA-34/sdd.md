# REALIZA-34 — sdd.md

## Pipeline (contratos entre etapas)

```
upload ─→ extração ─→ normalização ─→ revisão humana ─→ persist
(file)    (por formato)  (determinístico   (builder     (criarCronograma)
           text/tables    + Gemini          editável)     existente)
                          fallback)
```

### 1. Upload

- Rota: dentro de `/turmas/novo` — nova aba/modo "Importar de arquivo" `[NOVO]` (ou `/turmas/importar` — decisão no design; recomendado: modo dentro do builder, que já é a tela de revisão).
- Arquivo vai pro bucket privado novo `intake-cronogramas` `[NOVO]` (policies: `authenticated` coord-only write/read do próprio prefixo; sem `anon`) — ou storage inline na action se <10MB multipart. Preferência: server action com `FormData` (padrão da casa são actions, não route handlers novos — a verificar se há route de upload existente: `/api/material/[id]` é só download signed).
- Tipos aceitos: `.pdf`, `.xlsx`/`.csv`, `.docx`, `.png`/`.jpg` (imagem → exige visão; fora do mínimo se a 180 não existir — ver escopo abaixo).

### 2. Extração determinística (sem IA)

`src/lib/importar-cronograma/` `[NOVO]` módulo:

- **xlsx/csv**: parse tabular direto (`parseCsv` existe em `src/lib/importar.ts`; pra xlsx, lib a definir — `a verificar` se `xlsx`/`exceljs` já é dependência em `package.json`; se não, csv first, xlsx via conversão ou dep. nova justificada).
- **pdf**: `pdftotext`-equivalente em node (`a verificar` dependência — `pdf-parse`/`pdfjs-dist` candidatas; se nenhuma presente, marcar dep. nova `[NOVO]`).
- **docx**: `mammoth` ou extração XML — `a verificar` dependências.
- Saída comum: `texto` + `tabelas` normalizadas (rows de células), não schema de domínio ainda.

### 3. Normalização → `EventoRascunho[]`

Camadas, nesta ordem, cada uma devolvendo `(rascunhos, confianca)`:

1. **Heurística determinística**: detectar blocos por regex/estrutura — "Preparação", "Encontro <n>", datas `dd/mm`, "recesso", "encerramento", fase por proximidade com `FASES_DPP` (`gerador-cronograma.ts:48`). Reusável em Vitest puro.
2. **Gemini fallback/normalizador** `[NOVO]`: quando a heurística falha ou devolve baixa confiança — prompt com o texto/tabelas extraídas pedindo JSON no schema `EventoRascunho[]` (schema Zod compartilhado `[NOVO]`). Só o texto do cronograma viaja — cronograma é documento operacional (datas/títulos/fases), **sem nomes de menores nem dados civis** (ver `sdr.md`).
3. **Merge**: campos vazios do determinístico são preenchidos pelo Gemini (nunca sobrescreve o determinístico de alta confiança); conflitos marcam `origem='ia'` no rascunho pra badge na revisão.

### 4. Revisão humana obrigatória

- A saída do passo 3 **entra no passo 2 do `CronogramaBuilder`** como `Linha[]` pré-preenchida — a UI de revisão já existe (edição inline, dialog por evento, mover/excluir).
- Badge "IA" nos eventos normalizados pelo Gemini `[NOVO]` — a pessoa revisora sabe onde olhar.
- Gate: submit chama `validaEventos` (já existe) — e o CHECK do banco é a última palavra.

### 5. Persistência

- `criarCronograma` (`actions-cronogramas.ts:130`) **inalterada** — recebe `{turma/…, eventos}` como hoje. Se 47 já migrou, `turma_id`; senão label texto (compat pelo `rotulo`).
- Upload flow **nunca** escreve `ciclo_eventos` direto — sempre pela action (validação + auth centralizadas).

## Schema novo

| Objeto | Status |
|---|---|
| bucket `intake-cronogramas` | `[NOVO]` (ou nenhum — se FormData direto na action) |
| `cronograma_importacoes` (log: arquivo, parser usado, confiança, revisor, resultado) | `[NOVO]` opcional — recomendado pra auditoria; se a 180 existir, usar `ia_eventos` dela em vez de tabela paralela (não duplicar — decisão: preferir `ia_eventos` quando disponível) |
| `ia_eventos` | da REALIZA-180 — esta issue **usa, não cria** |

## Config

- `GEMINI_API_KEY` env var `[NOVO]` — server-only (nunca `NEXT_PUBLIC_`); sem a key, o fluxo roda só determinístico e marca "sem normalização IA" (degrada, não quebra).
- Rate limit: upload é coord-only (interno), mas a chamada Gemini deve ter timeout (~30s) e retry 1× — sem fila por ora (a verificar necessidade com volume real).
