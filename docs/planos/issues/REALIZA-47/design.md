# REALIZA-47 — design.md (superfícies afetadas)

## Persona & JTBD

- **Coordenação** ("Marina"): "quero filtrar a operação por turma sem contaminação" e "quero criar a T3 sem deploy".
- **Supervisor/auxiliar**: vê turmas no escopo dele (depende da 32).
- **Mentor/jovem**: turma é contexto passivo (pill, agrupamento) — não escolhe.

## Mudanças visíveis

### `/turmas` — de lista de cronogramas a gestão de turmas

Hoje (`src/app/(app)/turmas/page.tsx`): cards de cronograma ordenados por status. Com a entidade:

- Card = **turma** (rotulo forte via `partesTurma` → "Turma 1" + ano discreto, padrão já decidido em REALIZA-151): nº de cronogramas, nº de duplas ativas, status.
- Empty state existente (`:60-90` a verificar linhas) ganha "Criar turma" antes de "Novo cronograma".
- Componentes novos `[NOVO]`: `TurmaCard` (composição de `Badge`, `buttonVariants`, ícones Phosphor — sem lib nova).

### `/turmas/novo` — step 0 de turma

`CronogramaBuilder` (`src/components/cronograma-builder.tsx`) ganha primeira pergunta: "Para qual turma?" — `Select` (Base UI, mesmo padrão dos outros selects do builder `:36-41`) listando turmas existentes + opção "Nova turma" que abre `Input` de rótulo + datas. Microcopy: "Ex.: T3 · 2026/2027".

### Filtros por turma

- `/duplas`: `duplas-lista.tsx` já tem a UI de chips (`:1087-1118`) — só troca a fonte de dados. **Nenhuma mudança visual.**
- `/registros`: `Select` "Turma" novo `[NOVO]` ao lado dos filtros existentes (padrão `filterChipCls`/`Select` de `pessoas-listas.tsx:394-415`), aparecendo só quando >1 turma.
- `/pessoas`: fora de escopo — é a REALIZA-39.
- Home: hub de turmas é a REALIZA-73 — 47 só fornece a entidade.

### Estados

- Loading: skeleton não existe no codebase — manter padrão server-side (página async, sem spinner client).
- Turma sem cronograma: card mostra "Sem cronograma ainda" + CTA "Criar cronograma" → `/turmas/novo?turma=<id>`.
- Erro de label duplicado ao criar turma: action retorna `{error: "Já existe uma turma com esse nome."}` → `toast.error` (padrão `sonner` do builder).

### Mobile → desktop

Chips de filtro wrap (padrão existente `flex flex-wrap`); cards de turma em grid `grid-cols-1 sm:grid-cols-2` seguindo o grid atual de `/turmas`.

### Acessibilidade

- Chips de filtro com `aria-pressed` (padrão `duplas-lista.tsx:1097-1108`).
- `Select` com `aria-label` descritivo ("Filtrar por turma").

## Não-escopo

Não redesenhar `/turmas` do zero; não mexer em `/pessoas` (39), home (73), nem escopo do auxiliar (32).
