# Spec — Evals das novas tools da Liza

**Feature:** `specs/014-liza-evals` · **Status:** Clarified
**Fila:** `REALIZA-514` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** as tools novas da Liza (instrumentos, agenda/registro, plano em dia, leitura de jornada) não têm evidência de eval por papel; uma regressão de tool choice ou de permissão só aparece em produção.
- **Resultado observável:** o corpus live cobre as tools novas com casos de escolha, argumentos, recusa segura e domínio; o painel `/ia` executa a grade e o histórico mostra o resultado por caso/modelo.
- **Como saberemos que funcionou:** rodar os casos localmente e ver `tools_esperadas`/`tools_nao_pode` verdes; uma tool proibida falha o caso.

## Fora de escopo

- Trocar o provider/modelo padrão.
- Criar tools novas.
- Avaliar qualidade subjetiva de texto sem rubrica.

## Histórias de usuário

### US1 — Inventário e casos das tools novas (P1)

- **Por que P1:** sem inventário não se sabe o que falta.
- **Teste independente:** listar tools e comparar com `tests/evals/casos.json`.
- **Cenários:**
  1. **Dado** o catálogo de tools **quando** o inventário roda **então** cada tool nova tem ao menos um caso de intenção ou uma justificativa de “sem eval de tool”.
  2. **Dado** um caso de instrumento **quando** o modelo responde **então** a rubrica exige a tool correta e proíbe a de outro domínio.
  3. **Dado** um papel sem permissão **quando** o caso roda **então** a tool proibida não aparece.

### US2 — Execução local e histórico (P2)

- **Por que P2:** o corpus só vale se roda no painel/CLI.
- **Teste independente:** criar um run local e ver os itens.
- **Cenários:**
  1. **Dado** um run de staff **quando** executa **então** os casos de staff rodam e os de mentorado não entram.
  2. **Dado** um run de mentorado **quando** executa **então** as tools de staff são recusadas.
  3. **Dado** uma falha de rubrica **quando** o item fecha **então** o motivo fica legível no histórico.

## Casos de borda

- Caso sem `tools_esperadas`/`tools_nao_pode` (não pode passar por omissão).
- Modelo sem suporte a tools.
- Rate limit/timeout do provider.
- Corpus inválido (JSON) não derruba o painel.
- Segredos de eval ausentes: falha clara, sem rodar contra produção.

## Requisitos funcionais

- **FR-001:** o corpus DEVE cobrir as tools novas por domínio e por papel.
- **FR-002:** cada caso DEVE declarar ferramentas esperadas e/ou proibidas quando a intenção for de tool.
- **FR-003:** o executor DEVE rodar localmente e gravar tools usadas, rubrica e motivo.
- **FR-004:** nenhum eval pode apontar para produção; ambiente local/staging de teste explícito.

## Requisitos não funcionais

- **Custo:** casos objetivos, sem repetições desnecessárias.
- **Privacidade:** não colocar PII real no corpus; usar fixtures.
- **Determinismo:** rubrica por tool/texto, não por opinião.

## Entidades e dados

`tests/evals/casos.json`, `ia_eval_runs`/`ia_eval_itens` (0164) são a fonte; nenhuma tabela nova.

## Critérios de sucesso

- **SC-001:** matriz tool × caso × papel publicada no Jira.
- **SC-002:** execução local com pelo menos um caso por tool nova.
- **SC-003:** caso de tool proibida falha de propósito e o histórico mostra o motivo.

## Premissas

- “Novas tools” = as adicionadas nas rodadas 489–509 e as de plano em dia/instrumentos.
- Eval não substitui e2e de UI; ele cobre decisão da Liza.
