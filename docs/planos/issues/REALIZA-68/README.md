# REALIZA-68 — Exports CSV: encontros (alias), atividades, matching, presenças

**Jira:** [REALIZA-68] "Exports CSV por tipo (encontros, atividades,
matching, presenças)" — fonte `docs/planos/relatorios-inteligencia.md`
**Tier:** C (parcial — estende endpoint existente) — doc set reduzido:
README, plan (com schema de colunas), acceptance.
**Status:** PARCIAL — `src/app/api/export/route.ts` já tem `ciclo`,
`pessoas`, `assinaturas`, `respostas` com as convenções
`;`+BOM+quote+anti-fórmula (`celula`, `csvResponse` :763) e filtro
`?turma=`/`?cronograma=` (`filtraCsvCiclo` :183).

## Resumo

Adicionar 3 tipos novos e 1 alias:

| `tipo=` | O que é | Nota |
|---|---|---|
| `encontros` | **Alias de `ciclo`** — a prestação de contas já é uma linha por encontro (`csvCiclo` :463). | Zero código novo: dispatch normaliza `encontros→ciclo`. O Jira lista "encontros" porque a nomenclatura do usuário é essa; documentar o alias no cabeçalho. |
| `atividades` [NOVO] | Uma linha por atividade registrada — explode `registros.atividades[]` + `atividade_outro`. | Responde "quais atividades as duplas fazem" (o `join(' | ')` do csvCiclo não é analisável). |
| `matching` [NOVO] | Uma linha por pessoa disponível pra pareamento, com os campos de matching (0034/0038). | Prestação offline do board `/matching`. |
| `presencas` [NOVO] | Uma linha por evento×profile (chamada de formação, 0040). | Quem foi/faltou por evento + `formacao_ok`. |

Tudo coord-only (mesmo gate), `?turma=`/`?cronograma=` onde fizer sentido,
mesmas convenções CSV, demo parity (o route já tem ramo demo :44-106).

## Fora de escopo

Os tipos adicionais do plano de inteligência (`aderencia`,
`assinaturas-pendentes`, `supervisoes`, `interacoes`, `solicitacoes`,
`encerramento`, `forms-taxa` — relatorios-inteligencia.md:138) **não** são
esta issue — registrar como follow-up natural (mesma mecânica).

## Riscos

- **`atividades` explode linhas** — ~40 duplas × 16 encontros × ~3 atividades
  ≈ 2k linhas: ok pra CSV; ordenar por turma/dupla/encontro.
- **`matching` carrega sensíveis** — mesmo recorte de `pessoas`
  (`*_pessoal` coord-only por design); `form_bruto`/`dados_civis` ficam fora.
- **`presencas` sem evento** — turma sem `ciclo_eventos` tipo `formacao` →
  CSV só com header (comportamento consistente com `respostas` vazio).
- Dependência suave da **167**: se `turma_inscricoes` existir, `matching`
  filtra/marca "na fila da turma X"; sem ela, "disponível" = sem dupla ativa
  (mesma regra dos `ativos*` do relatorio.ts).
