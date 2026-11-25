# REALIZA-18 — Roda da Vida: overlay antes × depois e superfícies de leitura

Issue: `instrumentos`, `ux`, `dpp`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

O instrumento já existe de ponta a ponta — o que falta é a **comparação
visual** que a jornada promete ("o(a) jovem refaz a Roda e vê o antes ×
depois sobre a leitura inicial", `src/lib/jornada.ts:242`) e a conferência
de visibilidade do dado sensível.

Existe (`recon` verificado):

- **Form oficial `roda_vida`** (migration `0080_instrumentos_dupla.sql`) —
  16 áreas `escala_1_10` em 4 seções-quadrante (Pessoal, Profissional,
  Relacionamentos, Qualidade de vida) + reflexão final; nomes batem com o
  guia consolidado (`docs/rag/instrumento-roda-da-vida.md`).
- **Dois momentos na jornada** — `contexto.momento` (`inicial | formal`) na
  whitelist do `emitir_link_instrumento` (0096); leitura inicial antes do
  encontro 1, aplicação formal nos encontros 11–14. `momentoRoda` /
  `entregasDoMomento` separam as duas aplicações com fallback "primeira sem
  marca = inicial" (`src/lib/jornada.ts:300-330,557-560,811-915`).
- **Preenchimento interativo** — `src/components/instrumentos/roda-vida.tsx`
  (465 linhas): arraste/touch no polígono, lista acessível `role=slider`,
  teclado, nota 1–10 por eixo; `roda-svg.tsx` desenha o radar em SVG puro
  (`RodaSvg`, viewBox compacta 320×320 e `rotuloEixos` com coroa de nomes).
- **Leitura de uma aplicação** — `RodaResultado` em
  `src/components/instrumento-resultado.tsx:90-149`: polígono único +
  barras por área agrupadas por quadrante + média geral.
- **Superfícies atuais**: dialog de entrega na ficha da dupla
  (`src/app/(app)/duplas/[id]/instrumentos-dupla.tsx`), revisão na jornada
  (`src/components/jornada-rever.tsx`), `/jovem/materiais` com chaves
  `roda_inicial`/`roda_formal` (`src/app/(jovem)/jovem/materiais/page.tsx:564-569`),
  detalhe por instrumento em `/materiais/instrumentos/[chave]` (:413-416,556-559).
- **Sem lib de gráfico**: radar é SVG feito à mão — e deve continuar assim
  (zero dependência nova).

Gap: **nenhuma superfície sobrepõe inicial × formal.** `RodaSvg` aceita um
único `RodaDaVida`; os dialogs mostram uma entrega por vez.

## Decisões

1. **Estender o instrumento-form existente — nenhum renderer ou form novo.**
   A arquitetura já é a correta: form de sistema imutável, link tokenizado
   com `contexto.momento`, `formulario_respostas` por link, componente
   sob medida por `sistema`. O trabalho é de visualização e superfícies.
2. **`RodaSvg` ganha sobreposição `anterior?: RodaDaVida`.** Quando
   presente, desenha o polígono da leitura inicial em cinza-tracejado
   (`stroke-dasharray`, sem fill ou fill `muted-foreground/15`) sob o
   polígono formal em lima — mesmo viewBox, mesmo ângulo por eixo (as 16
   áreas são fixas e ordenadas pelo form, então `areas[i]` casa nas duas).
   Guard: se a estrutura da `anterior` divergir (áreas ≠), renderiza só a
   corrente — não inventa alinhamento.
3. **`RodaComparada` (novo, em `instrumento-resultado.tsx` ou
   `instrumentos/roda-comparada.tsx`):** `RodaSvg` sobreposto + legenda
   "Leitura inicial · Aplicação formal" + lista por área com
   `nota formal − nota inicial` (Δ com sinal, neutro quando 0; sem seta
   colorida de bom/ruim — subir nem sempre é melhor, copy neutra) +
   médias das duas aplicações. A reflexão do momento corrente segue
   exibida como hoje.
4. **Onde a comparação aparece** (sempre que existir par inicial+formal da
   mesma dupla; sem par, render atual de aplicação única):
   - ficha da dupla → aba instrumentos, dialog da entrega `roda_vida`
     (mentor/coord/supervisor);
   - `/jovem/materiais` → revisão da `roda_formal` (o jovem vê a própria
     evolução — é o "antes × depois" que a jornada promete);
   - retrospectiva da dupla (REALIZA-359) consome `RodaComparada`.
5. **Aplicação formal continua "em branco" no preenchimento** — o jovem
   refaz a roda sem ver a inicial enquanto responde (o guia pede leitura
   honesta do presente; a comparação acontece na conversa do encontro 12).
   `RodaVida` (preenchimento) não recebe `anterior`.
6. **Visibilidade (dado de menor — trava explícita):** manter o modelo
   vigente da RPC `instrumentos_da_dupla`/`jovem_jornada` (security
   definer, 0080) — **jovem**: as próprias respostas e a comparação;
   **mentor da dupla**: lê a roda da sua dupla (o guia o faz conduzir a
   leitura); **supervisor da dupla e coordenação**: idem mentor; **qualquer
   outro papel**: nada. Sem coluna nova de controle — a RLS/RPC atual já é
   o corte correto; esta spec só o registra e adiciona teste de contrato.
   A reflexão final é texto livre potencialmente sensível — mesma régua,
   nunca no painel agregado (`jornada.ts:135` já garante isso).

## Schema

Nenhuma. `contexto.momento`, `formulario_links` e `formulario_respostas`
já sustentam as duas aplicações desde a 0080/0096.

## Domínio (src/lib/)

- `src/lib/forms/schema.ts`: `extraiRodaDaVida` inalterada; adicionar
  `mesmasAreas(a: RodaDaVida, b: RodaDaVida): boolean` (paridade estrutural
  por `id` de campo — o guard do overlay).
- `src/lib/jornada.ts`: reusar `entregasDoMomento(entregas, "inicial")` /
  `"formal"` para montar o par — entrega corrente de cada momento = a mais
  recente (:557-560). Exportar helper `parRoda(entregas)` se o shape da
  ficha/`/jovem` precisar de um só lugar.
- Sem mudança em `momentoRoda`, `emitir_link_instrumento`, RPCs.

## UI

- `src/components/instrumentos/roda-svg.tsx`: prop `anterior` — polígono
  ghost por baixo; `aria-label` menciona a comparação ("antes e depois").
- `src/components/instrumento-resultado.tsx`: `RodaResultado` aceita
  `respostasAnterior`/`rodaAnterior` → delega a `RodaComparada`; senão,
  layout atual.
- `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx` e
  `src/app/(jovem)/jovem/materiais/page.tsx`: ao abrir entrega `roda_vida`,
  buscar a outra aplicação da mesma dupla (já vem no payload de entregas —
  sem query nova) e passar ao resultado.
- `src/components/jornada-rever.tsx`: idem para revisão na jornada.
- Copy: legenda "Leitura inicial" / "Aplicação formal" (já é o vocabulário
  de `/jovem/materiais`), Δ como "+2" / "−1" / "=" neutro, sem
  classificação de melhoria/piora.

## Seed + demo

- `src/lib/demo/data.ts`: garantir uma dupla com **as duas** rodas
  respondidas (inicial + formal com Δ variado — áreas que subiram, caíram
  e ficaram iguais) e uma dupla só com a inicial (render de aplicação
  única).
- fixture e2e: par inicial+formal respondido pelo token, comparado na
  ficha e no `/jovem`.

## Testes

- vitest: `mesmasAreas` (paridade/ divergência), `entregasDoMomento`
  já coberto — adicionar caso "entrega refeita: mais recente vence".
- e2e/componente:
  - ficha da dupla, entrega formal com par → overlay visível com legenda;
  - `/jovem/materiais` roda_formal → comparação renderiza;
  - entrega inicial sozinha → render de aplicação única (regressão);
  - contrato de visibilidade: mentor de outra dupla / jovem de outra
    turma não leem `respostas` via RPC (teste de policy já existente —
    estender afirmando `respostas` da roda).

## Critérios de aceite

- [ ] Com as duas aplicações respondidas, a ficha e o `/jovem` mostram o
  radar sobreposto inicial×formal com legenda e Δ por área.
- [ ] Sem par, o render atual (aplicação única) é preservado byte a byte.
- [ ] A aplicação formal é respondida "às cegas" (sem overlay no
  preenchimento); o preenchimento interativo segue acessível por
  teclado/slider.
- [ ] As 16 áreas/4 quadrantes do guia permanecem as do form oficial —
  qualquer divergência estrutural desativa o overlay em vez de
  desalinhar.
- [ ] Visibilidade documentada e testada: jovem vê só a própria; mentor
  e supervisor só da(s) dupla(s) dele; coordenação todas; demais nada.
- [ ] `npx tsc --noEmit` e `npx eslint src/` limpos; testes verdes.

## Fora de escopo

- Redesenho do preenchimento interativo (gesto/axes já entregues).
- Novos momentos de aplicação (a jornada fixa inicial + formal).
- Comparação entre duplas/coortes ou analytics da roda.
- Impressão/PDF dedicado da comparação (entra via retrospectiva/-359).
