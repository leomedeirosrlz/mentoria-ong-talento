# Spec — Relatórios de novembro (grade livre + operacionais acionáveis + demo)

**Feature:** `specs/003-relatorios-nov` · **Status:** Approved (implementação em curso)
**Fila:** `REALIZA-375`, `REALIZA-389`, `REALIZA-407` · **Data:** nov/2025

## Problema e resultado

- **Dor hoje:** a coordenação abre `/relatorios` e cai num hub de tabelas densas;
  os relatórios operacionais exigem leitura linha a linha para descobrir quem
  precisa de ação, e em staging/demo várias seções nascem vazias.
- **Resultado observável:** `/relatorios` abre direto na grade livre (o
  workbench de consulta); os relatórios operacionais ficam um nível abaixo,
  cada seção abre com resumo visual e fila acionável que leva à ficha com a
  ação contextual; staging e `/demo` mostram o workbench inteiro com dados
  representativos no primeiro acesso.
- **Como saberemos que funcionou:** abrir `/relatorios` mostra o builder sem
  tabstrip; cada aba operacional priorizada tem resumo + fila clicável;
  `/demo` e staging exibem as seções sem "nada aqui ainda".

## Auditoria (estado encontrado, nov/2025)

| Issue | Estado | Evidência |
| --- | --- | --- |
| 375 | **cumprido** | `page.tsx` de `/relatorios` renderiza `RelatorioBuilder` + botão "Outros relatórios"; `?aba=` redireciona preservando recorte; e2e `tests/e2e/app/relatorios.spec.ts` cobre. Não mexer. |
| 389 | **parcial** | `SecaoAderencia` e `SecaoEncerramento` já seguem o padrão resumo+fila+tabela colapsada; assinaturas, interações, especialistas e formulários ainda renderizam `RelatorioSecao` (dump de tabela). |
| 407 | **parcial** | `src/lib/demo/*` já cobre todas as seções; `scripts/seed-demo-staging.mjs` só insere ritos decididos (sem pendente na fila), não semeia `terceiros_*` nem assinatura expirada. |

## Fora de escopo

- REALIZA-379 (Wrapped da retrospectiva) — feature à parte.
- Reprojetar a grade livre ou as abas Saúde/Adoção (já visuais).
- Mudanças de schema/RLS: nenhuma. Seed é dado, não estrutura.

## Histórias de usuário

### US1 — seções operacionais acionáveis (P1)

- **Por que P1:** é o critério central da 389 que falta.
- **Teste independente:** abrir cada aba em `/relatorios/operacionais` —
  resumo no topo, fila clicável no meio, prévia do export colapsada embaixo.
- **Cenários:**
  1. **Dado** assinaturas pendentes e expiradas **quando** abro a aba
     **então** vejo o resumo (pendências, expiradas, documento mais antigo)
     e a fila por pessoa com link para a ficha.
  2. **Dado** interações registradas **quando** abro a aba **então** vejo
     contagem por tipo/canal e a lista que leva à ficha da dupla.
  3. **Dado** solicitações em estados variados **quando** abro Especialistas
     **então** vejo o funil (triagem, abertas, negociação, decididas) e a
     fila do que espera ação, com link para a ficha (negociação).
  4. **Dado** links de formulário emitidos **quando** abro Formulários
     **então** vejo a taxa de resposta e os pendentes, com link para o
     formulário ou a ficha do destinatário.
  5. **Dado** recorte `?turma=`/`?cronograma=` ativo **quando** troco de aba
     **então** resumo, fila e CSV seguem no mesmo recorte.

### US2 — staging semeia as seções vazias (P1)

- **Por que P1:** o critério da 407 pede que nenhuma seção nasça vazia em
  staging/demo; a demo in-memory já cobre, o seed ainda não.
- **Teste independente:** rodar o seed de staging, abrir Encerramento
  (fila "Aguardando decisão" com rito pendente), a ficha da dupla com
  avaliação por terceiros respondida, e Assinaturas (uma expirada).
- **Cenários:**
  1. **Dado** o seed de staging aplicado **quando** abro Encerramento
     **então** a fila "Aguardando decisão" mostra ritos pendentes com
     checklist parcial.
  2. **Dado** o seed aplicado **quando** abro a ficha da dupla âncora
     **então** a avaliação por terceiros aparece com respostas e
     consolidação.
  3. **Dado** o seed aplicado **quando** abro Assinaturas **então** vejo ao
     menos uma pendência e uma expirada.

## Requisitos funcionais

- **FR-001:** cada seção redesenhada mostra primeiro o resumo (cards
  derivados das mesmas linhas do CSV), depois a fila acionável clicável,
  por último a `RelatorioTabela` colapsada — paridade literal com o export.
- **FR-002:** as filas usam `DuplaLinha` quando a linha é uma dupla e a
  linha canônica de pessoa/pedido quando não é; link esticado, uma ação
  contextual, "Ver ficha".
- **FR-003:** os fetchers novos devolvem o id de drill-down junto da linha —
  uma derivação só alimenta resumo, fila e CSV.
- **FR-004:** `?turma=`, `?cronograma=`, os hrefs de CSV, os links públicos,
  o digest e os deep links `?aba=` seguem funcionando igual.
- **FR-005:** o seed de staging insere ritos pendentes variados (checklist
  parcial e completo), convites/respostas/consolidação de terceiros para a
  dupla âncora e uma assinatura expirada — idempotente, cleanup restrito ao
  range `de000000-*`.
- **FR-006:** o dataset demo não precisa de dados novos — só garantir que as
  seções redesenhadas leem o que já existe (paridade demo × real).

## Requisitos não funcionais

- **RLS:** nenhuma policy nova; fetchers seguem client da sessão.
- **Auth:** nenhuma rota pública nova.
- **LGPD:** nenhum dado novo — os ids já circulam nas mesmas queries.
- **Demo:** as seções acionáveis leem `demoData`/`getDemoFormularios` — as
  mesmas linhas do export demo.
- **A11y/perf:** link esticado com `prefetch={false}`, pill nunca só cor,
  `hiddenUntilFound` nas colapsáveis; piso de 12px no mobile.

## Entidades e dados

- `assinaturas` (pendente/expirado), `interacoes`, `solicitacoes_mural`
  (status_efetivo), `formulario_links` + `formulario_respostas`,
  `encerramentos` (pendente/decidido), `terceiros_contatos` +
  `terceiros_respostas` + `terceiros_consolidacao`.
- Rito pendente = `encerramentos.tipo = 'pendente'` (decidido_por NULL —
  acoplamento da 0156), criado pela conclusão automática ou registrado.

## Critérios de sucesso

- **SC-001:** nenhuma das seções operacionais priorizadas abre com dump de
  tabela; cada uma tem resumo + fila ou lista com drill-down.
- **SC-002:** em staging, Encerramento mostra rito pendente na fila e a
  ficha da dupla âncora mostra terceiros respondidos.
- **SC-003:** `pnpm test` + `pnpm guard` + e2e `relatorios.spec.ts` (app e
  demo) verdes; `typegen+tsc` e `eslint src/` limpos.

## Premissas

- A fila de Encerramento já exibe rito pendente corretamente — só faltava
  dado. Confirmado pela migration 0156 e pelo `resumoEncerramento`.
- A priorização da 389 cobre as 4 seções restantes; Saúde e Adoção já
  atendem ao padrão visual.
- O copy "Acumulando histórico" da aba Saúde é estado legítimo e permanece;
  o critério da 407 é preencher dados, não esconder o estado vazio real.
