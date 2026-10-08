# REALIZA-30 — Modelo de eventos do cronograma

Issue: `schema`,`turma-2-operando`. Fonte: `_contexto.md` § Cronogramas reais (PDFs T1/T2 2026/2027). Complementa REALIZA-15 (entidade + escopo já entregues).

## O que o PDF real exige vs. o que existe

`ciclo_eventos` hoje: `tipo ∈ (encontro, formacao, recesso, marco)`, `data NOT NULL`, `numero`, `titulo`, `fase`, `instrumentos[]`, `data_fim`, `cronograma_id`.

O cronograma oficial tem **4 seções**:
1. **Preparação** — etapas datadas OU marcadas "Concluídos" (triagem/matching feito pela ONG parceira não tem data — tem status). Etapas: inscrições, triagem/matching, onboarding mentores, onboarding mentorados, início.
2. **Mentoria ativa** — 16 encontros com fase metodológica (já existe em `fase`) + recesso.
3. **Encerramento** — evento (15/01/2027, compartilhado T1+T2 no dado real — por cronograma no modelo).
4. **Observações operacionais** — "reposição na mesma semana", feriados municipais, cadência.

Dia da semana **variável**: T2 tem terças + 3 quintas de encontro duplo (05/11, 03/12, 10/12). O domínio já é date-driven (verificado: `eventoDaSemana`, `resumoSemanaDe`, `saudadeDaDupla`, `alvoAgendamento`/`sugeridoProximo` usam datas, não `getDay()===2`) — sobra copy/comentários e a UI assumindo 1 evento por semana.

## Schema — migration `0062_eventos_cronograma.sql`

1. **`tipo`**: check passa a `('etapa_preparacao','encontro','recesso','evento_encerramento','formacao')`. `marco` sai. Reclassificação no remoto: **1 row** ("Evento de encerramento do programa" → `evento_encerramento` — verificado: remoto tem zero marcos de preparação, só o encerramento). No seed: inscrições/triagem/matching/onboardings → `etapa_preparacao`; "Encontro de abertura com a coordenação" é o fecho do onboarding de mentorados → `etapa_preparacao`; encerramento → `evento_encerramento`. `formacao` fica (`sync_formacao_ok`/`ehEventoFormacao` filtram `tipo='formacao'`).
2. **`data` nullable** — só pra etapa concluída sem data: `check (data is not null or (tipo = 'etapa_preparacao' and status = 'concluida'))` **e** blindar meia-range: `check (data_fim is null or data is not null)`.
3. **`status text not null default 'pendente' check (status in ('pendente','concluida'))`** — vivo pra `etapa_preparacao` (a ONG entrega triagem/matching concluído). Pros demais tipos permanece 'pendente' (semântica vazia, harmless) — documentar no comentário da coluna.
4. **`observacao text`** — regras/notas do PDF ("Reposição na mesma semana", "Feriado municipal — confirmar local", "Encontro duplo").
5. **`ordem smallint not null`** — chave de ordenação única do cronograma: `data nulls last` computado não basta (joga etapas-concluída-sem-data depois do encerramento — o contrário do PDF). Backfill remoto: `row_number() over (partition by cronograma_id order by data, numero nulls last, id)` — tiebreak por `id` porque formacao e etapa-abertura caem no mesmo dia (04/09) com numero null. Seed/demo: `ordem` **explícita**, não derivada — etapas concluídas vêm antes dos encontros. Índice `(cronograma_id, ordem)` — não unique (reordenações do wizard REALIZA-46 podem criar gaps). TODO anotado: inserts futuros (-31, -46) fornecem `ordem`.

Sem tocar RLS (herda policies existentes de ciclo_eventos) nem dados de menores — sem gate humano, mas migration no remoto segue o rito da 0061: pré-flight + apply + verify + regen types.

## Domínio (`src/lib/`)

- `types.ts`/`database.types.ts`: `CicloEvento` ganha `observacao: string | null`, `status: "pendente"|"concluida"`, `ordem: number`; `data` vira `string | null`; `tipo` ganha os 2 novos literais; `marco` sai.
- `eventosDoCronograma` (queries + demo): ordena por `ordem`.
- **`data: string | null` — blast radius verificado no review** (~40 sites, não só os 4 da spec original). Convenção: **guard `e.data != null` independente do tipo** (o filter por `tipo='encontro'` NÃO basta — `porDia`, `minSemana/maxSemana`, `eventosDoMes`, lista "Cobertura", `demoCicloEventos`, `criarDupla`, `dadosResumoJornada`, `mentor-home.sugeridoSeguinte` iteram CicloEvento de qualquer tipo). Armadilhas reais mapeadas: `porDia` com `data=null` (`null <= fim` = true → `mapa.set(null)` → `mesIndice(null)` crash); sorts `a.data.localeCompare(b.data)` → TypeError em runtime (usar `ordem` ou comparador `nulls last`); `new Date(\`${e.data}T12:00:00\`)` com null → RangeError via fmt; `sugerido={oficial.data}`/props `string|null` → `?? undefined`; `diaCompacto`/`parseDia`/`mesIndice` não aceitam null.
- Helpers de teste (`tests/helpers.ts` `mkEvento`, `CICLO_16`, literais inline) ganham os campos novos.
- Copy "terças/calendário de terças" → "calendário oficial" (agenda-calendario rodapé, comentários). Prefill do agendar já usa `oficial.data` — sem mudança funcional.
- `totalEncontros`/`encontroEventos` seguem filtrando `tipo='encontro'` — etapas e encerramento não entram no denominador.
- **Duas datas de encontro na mesma semana** (quinta dupla T2): `eventoDaSemana` escolhe a de **menor numero** (fixar a regra por `numero`, não pela coincidência data asc ≡ numero asc). `oficialSemana` vira `oficiaisSemana: CicloEvento[]`; header do board mostra "Semana do Nº encontro" ou "Semana dos encontros N e N+1"; o resumo agrega só pelo primeiro oficial (os `resumoSemanaDe` por evento já corretos continuam na visão lista). Decisão registrada: manchete é do primeiro encontro da semana; o segundo aparece na grade/lista com seu resumo.
- **Presenças/chamada**: só `tipo='formacao'` recebe chamada (inalterado). Etapas de preparação — inclusive "onboarding mentores" — são marcos operacionais sem chamada; sessão que precisa de presença usa `formacao`.

## UI

- **Agenda** (`agenda-calendario.tsx`): `TIPO_PALAVRA` (:304), `MarcadorTipo` (:347), `rotuloSemana` (:1058), header semana (:1822) e a célula do grid (:1710) são exhaustivos em `tipo` — todos ganham os 2 novos e perdem `marco`. Etapas **datadas** entram na grade como marcador discreto (faixa quando `data_fim` presente, como o recesso, mas estilo de etapa); `evento_encerramento` = destaque. Detalhe do dia mostra `observacao` quando existe. Etapas **sem data** (status "Concluídos") ficam fora da grade: painel "Etapas de preparação" colapsável no topo da visão do cronograma (contexto, não protagonista), com badge de status.
- **Lista "Cobertura do ciclo"**: ordena por `ordem`; etapa sem data renderiza "Concluída" no lugar da data.
- **Ficha/registros/materiais**: inalterados — consomem só encontros (filtrado).
- **`encontro-detalhe-dialog`**: mostra `observacao` do evento quando presente.

## Seed + demo

- `seed.sql` T1: marcos→etapas (`inscrições`, `triagem e matching`, `onboarding mentores`, `onboarding mentorados`, `início`), encerramento vira `evento_encerramento`; +`observacao` nas terças relevantes (recesso com nota, encontro 8→9 gap de 15 dias).
- `data.ts` demo: T2 ganha o padrão real — semanas com **quinta extra** (encontro duplo: duas linhas `encontro` na mesma semana, numero N e N+1 — uma na terça, uma na quinta) cobrindo os 3 casos do PDF. Etapas de preparação da T2 com `status='concluida'` sem data (triagem/matching pela ONG Cidadão Pró-Mundo — `observacao` explica). Prova: semáforo/resumo continuam corretos com 2 encontros numa semana.
- Remote real T1+T2 = REALIZA-31 (não inserir dados reais aqui).

## Testes (vitest)

- `eventoDaSemana`/`resumoSemanaDe` com encontro em quinta + duas datas na mesma semana (escolhe a de menor numero; denominador certo).
- Ordenação por `ordem` com etapa `data=null` no meio.
- `saudadeDaDupla` ignora `etapa_preparacao`/`evento_encerramento`/`formacao` no denominador.
- `alvoAgendamento.sugeridoProximo` cai numa quinta quando o oficial é quinta.

## Fora de escopo

- Wizard de criação de cronograma (REALIZA-46), cadastro das turmas reais (REALIZA-31), RLS por turma do auxiliar (REALIZA-32).
- `fase` continua texto descritivo (as 6 fases do PDF já são os valores) — instrumento deriva da fase já hoje.
