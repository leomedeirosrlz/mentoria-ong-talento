# REALIZA-39 — Aba Pessoas por turma

- **Jira:** [REALIZA-39](https://kelyng.atlassian.net/browse/REALIZA-39) — título no manifesto: "Aba Pessoas por turma" (issue **não consta em `_issues.json`** — escopo derivado do `_manifest.md` + `_recon/issues-status.md`; confirmar texto no Jira antes de implementar).
- **Tier:** A (UI + derivação de dados)
- **Veredito da auditoria:** **ABERTO** — plano completo nesta pasta.
- **Depende de:** REALIZA-167 (`turma_inscricoes` = pertencimento); alinha com REALIZA-47 (`turma_id` quando existir).

## O que a issue pede

`/pessoas` hoje agrupa só por papel/status (`src/app/(app)/pessoas/page.tsx:29-49`, `src/components/pessoas-listas.tsx`): seções "Com acesso"/"Mentores e equipe", "Mentorados", "Fora do programa", "Inativos" + chips "Livres para dupla"/"Fora do programa" + busca + ordenação — **sem nenhuma noção de turma**. `PillTurma` existe mas só é usado em `fila-acompanhar.tsx:193` — não é evidência de agrupamento por turma em `/pessoas`.

Com duas+ turmas rodando, a coordenação precisa responder "quem é da T2?" sem atravessar listas globais.

## Escopo

- Filtro/recorte por turma em `/pessoas` (chip por turma + "Sem turma"), aplicado sobre as seções existentes — não uma página nova.
- Derivação de turma por pessoa: via `turma_inscricoes` (167) quando existir; até lá, via dupla ativa → `cronogramas.turma` / `duplas.turma` (a verificar regra exata para mentores sem dupla e equipe — ver `plan.md`).

## Estado atual (evidências)

- `src/app/(app)/pessoas/page.tsx:29-49` — carrega `getPessoas`, `getMentorados`, `getDuplas`, `getMentorProfiles`, assinaturas; distingue `souCoord`.
- `src/components/pessoas-listas.tsx:337-418` — barra de busca + chips `filterChipCls` + `Select` de ordenação (coord-only); `:448-527` seção "Com acesso"; `:532-621` "Mentorados"; `:627-666` arquivo "Fora do programa" (Collapsible); `:670-716` "Inativos".
- `FilaEspera` (`:424-434`) + `MatchingPanel` (`:439-446`) já existem no topo pra coordenação.
- Turma por pessoa hoje é derivável por: `duplas` ativas da pessoa (`duplas.turma`) — `mentorados_turma` (view `0076`) cobre o caso jovem; `profile_papeis.escopo_turma` cobre staff escopado.
- `src/lib/demo/data.ts` — demo já tem T1+T2 (cronogramas `:2100`).

## Fora de escopo

- A entidade `turmas` (47), o hub/contexto global `?turma=` (73), o escopo RLS do auxiliar (32) — esta issue é **só o recorte visual de `/pessoas`**.

## Documentos

`plan.md`, `design.md`, `sdr.md`, `acceptance.md`.

## Esforço / risco

- **P-M** — derivação de turma é o ponto sensível (mentor multi-turma? staff sem dupla?). Risco: contagem errada de "Sem turma" — mitigado por regra explícita testada.
