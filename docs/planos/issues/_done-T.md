# _done-T — Cluster T (Turmas & Cronogramas): 15, 30, 31, 32, 34, 39, 46, 47, 73, 103

## Produzido

### READMEs de evidência (veredito **FEITO** — só fechar Jira)

- `REALIZA-15/README.md` — entidade `cronogramas` + FKs + consumo: `0061_cronogramas.sql`, `src/lib/ciclo.ts` (`eventosDoCronograma`, `cronogramaVigente`), `types.ts:285`, `nova-dupla-dialog.tsx:656+`, `/turmas`, demo data. Resto (entidade turma) = 167/47.
- `REALIZA-30/README.md` — calendário parametrizável: `0062_eventos_cronograma.sql` (tipos/ordem/status/data nullable), `gerador-cronograma.ts`, `actions-cronogramas.ts`, builder passo 2.
- `REALIZA-31/README.md` — import T2: backfill `0061` + `scripts/importar-turma2.ts` (dry-run, idempotente). **Nota explícita: parametrização T3 é REALIZA-167.**
- `REALIZA-46/README.md` — cadastro via UI: `/turmas/novo` + `cronograma-builder.tsx` + `criarCronograma`.
- `REALIZA-103/README.md` — edição: `cronograma-editor.tsx` (StatusBadge/Acoes/Eventos/Duplas) + `atualizarCronograma`/`salvarEvento`/`moverEvento`/`excluirEvento`.

### Planos completos (veredito **ABERTO**)

- `REALIZA-47/` — **Tier A completo** (README+plan+sdd+design+sdr+acceptance). Turma entidade plena: `programas`/`turmas` `[NOVO]`, `turma_id` FKs com backfill por match de label, `mentorados_turma` por FK, filtros em `/duplas`/`/registros`/export. **Ponte documentada: 167 primeiro, 47 depois** — tabela label→id cobre `turma_inscricoes`/`resumo_links`/`escopo_turma`.
- `REALIZA-32/` — **Tier A completo**. Auxiliar por turma: **BLOCKER registrado** ("turma inteira × só designadas", com Opção A recomendada); designação via `profile_papeis.escopo_turma` (sem tabela nova no mínimo); RLS aditiva via `minhas_turmas_supervisionadas()` security definer; `duplas.supervisor_id` mantido como responsável/write-scope.
- `REALIZA-34/` — completo. Upload→extração determinística→Gemini fallback→revisão obrigatória (passo 2 do builder)→`criarCronograma` inalterada. **Destinos parciais citados: 167 (parametrização) e 180 (pipeline inteligente/`ia_eventos`)**.
- `REALIZA-39/` — completo. Chips de turma em `/pessoas` (mesma gramática dos filtros existentes); `turmasDe()` pura derivando de dupla ativa + `escopo_turma` + `turma_inscricoes`; "Sem turma"; multi-turma documentado. Dep 167.
- `REALIZA-73/` — completo, marcada **PARCIAL**: `/turmas` já existe — plano cobre só hub na home + `?turma=`/cookie `turma_foco` (param > cookie > "todas") + propagação para agenda/duplas/registros/pessoas/export. Dep 167.

## Grafo de dependências registrado

**167 → 47 → {32, 39, 73}** · 34 depende de 167 e absorve parcialmente 180.

## Vereditos x auditoria

| Issue | Veredito | Entrega |
|---|---|---|
| 15, 30, 31, 46, 103 | FEITO | README evidência — fechar Jira |
| 47, 32 | ABERTO | Tier A: 6 docs |
| 34 | ABERTO | 6 docs (167/180 como destinos parciais) |
| 39 | ABERTO | 5 docs (sem sdd — derivação no plan) |
| 73 | PARCIAL | 5 docs (só hub+contexto) |

## Ressalvas

- REALIZA-39 não consta em `_issues.json` — escopo derivado do `_manifest.md`/recon; README sinaliza confirmar no Jira.
- `a verificar` marcado onde o repo não confirma (dependências de parse na 34, policies exatas a alterar na 32, mecanismo de cookie na 73, `has_papel` signature).
