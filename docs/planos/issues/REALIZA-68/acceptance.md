# REALIZA-68 — critérios de aceite

## Dispatch / convenções

1. `GET /api/export?tipo=encontros` → 200, **mesmo** CSV de `tipo=ciclo`
   (header + linhas idênticas — alias puro).
2. Todo tipo novo: `content-type` text/csv, BOM `\uFEFF` na primeira posição,
   `;` como delimitador, CRLF entre linhas, filename `<tipo>-YYYY-MM-DD.csv`,
   todas as células por `celula()` (aspas + anti-fórmula).
3. Coord-only inalterado: mentor/supervisor/anon → o gate existente
   responde como hoje (403/redirect — não re-testar a implementação, só
   confirmar que os tipos novos passam pelo mesmo ramo).

## tipo=atividades

4. Registro com `atividades=['Roda de conversa','Leitura']` + `atividade_outro`
   → 3 linhas: 2 `origem=catálogo` + 1 `origem=outro` com o texto.
5. Encontro sem registro / registro sem atividades → nenhuma linha desse
   encontro.
6. `atividade_outro` começando com `=`/`+`/`-`/`@` → sai com prefixo de
   escape (mesmo guard do resto).
7. `?turma=`/`?cronograma=` recortam (mesma `filtraCsvCiclo`).

## tipo=matching

8. Linhas só de pessoas elegíveis: mentors (`role`/`papeis` com
   mentor_dpp/mentor_especialista, ativo) + mentorados sem saída — com
   `em_dupla` marcando o estado atual.
9. `trilhas` mostra "DPP + Especialista" pra híbrido (mesma união
   `tipoPessoa`); `capacidade_dpp`/`capacidade_esp` preenchidas quando o
   `mentor_profiles` existe.
10. `disponibilidade` serializa `celulas` legível ("seg noite | ter manhã")
    ou vazio quando null.
11. `pref_genero_par`/`motivacao`/`experiencia_previa`/`formacao_externa`
    aparecem pra coord (sensíveis `*_pessoal` — mesma autoridade do
    `exportPessoas`); `form_bruto`/`dados_civis` **não** aparecem.
12. Com `turma_inscricoes` (se 167 merged): `fila_turmas` lista onde a
    pessoa aguarda; `?turma=` filtra por inscrição. Sem a tabela: coluna
    ausente e `?turma=` ignorado — conforme decisão do PR.

## tipo=presencas

13. Grain = linha por `(evento formação, profile marcado)` com `presente`
    sim/não e `marcado_em`; `formacao_ok` só preenchido pra mentor.
14. Evento passado sem chamada pra alguém → **não** gera linha (ausência =
    não-marcado, não "faltou" — a derivação é da UI, não do CSV).
15. `?turma=` recorta por `ciclo_eventos.turma`; `?cronograma=` só se a
    coluna existir no evento (decisão do PR).
16. Turma sem eventos formação → CSV só com header (200, não 404).

## Demo / gates

17. `/demo` coord: os 4 tipos retornam CSV com dados canned (sem erro 500).
18. `tsc`/`eslint` limpos; nenhuma migration.
19. Header comments do route atualizados (o bloco :27-29 lista os tipos —
    incluir os novos e o alias).
