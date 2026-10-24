# Feedback UX — rodada out/2026 (pós-merge da onda 184–191)

Feedback do Thiago sobre as telas entregues, organizado **por tela** em
um arquivo cada, com direção e critérios de aceite julgáveis por
subagents (inclui validação mobile 390px onde aplicável).

## Mapa

| Arquivo | Tela | Peso |
|---|---|---|
| `_prompt-original.md` | — | verbatim do pedido |
| `_revisao.md` | — | prompt × planos + decisões pendentes |
| `materiais-coord.md` | /materiais (coord) — painel jornada, biblioteca, cards, pills | grande |
| `agenda-coord.md` | /agenda coord — cobertura do ciclo, semana do programa | médio |
| `visao-geral-duplas.md` | /duplas — footer, whatsapp mobile, animação de filtro | médio |
| `chamados.md` | /chamados — menções, composer, anexos, status | grande |
| `registros-dashboards.md` | /registros + kit de viz compartilhado | médio |
| `formularios.md` | /formularios — instrumentos→materiais, ícones, builder | grande |
| `turmas.md` | /turmas — cards visuais + nomeação T1/T2 | médio |
| `relatorios.md` | /relatorios — dropdown Compartilhar | médio |
| `como-conduzir.md` | "Como conduzir" fora da ficha | pequeno |

## Convenções transversais (valem pra todos)

- **Filtros animam** — nunca repaint seco (fade/slide/FLIP ≤300ms);
  `prefers-reduced-motion` desliga. Vai pra `AGENTS.md` na 1ª task que
  implementar.
- **Número sem proporção não entra** — KPI solto só com contexto visual
  (barra/sparkline/fração).
- **Copy sem termo interno** — "estação", "pendência na janela" e afins
  viram linguagem do guia ("instrumento", "esperando resposta").
- **Thumbnail de PDF é global** — a capa curta vale pra toda superfície
  que mostra material (jovem, mentor, ficha, coord), não só coord.
- **T1/T2 sempre quebrado** — telas de coord mostram cada turma
  independente (mini-barras/contagens por turma), nunca só agregado
  global. Decisão da revisão de materiais, vale pra agenda, registros,
  duplas, painel.
- **Faixas de cards/pills: scroll lateral sempre** — nunca espremer
  tudo numa linha no desktop (regra do mobile vale pra todos os
  viewports: flex+overflow-x+snap+fade).
- **Superfície neutra, cor nos indicadores** — badge/pill/ícone carrega
  a cor de status; card nunca ganha borda lateral+fundo tintado
  redundantes (diretriz do review de chamados).
- **Mobile 390px é viewport de validação** obrigatória em todo aceite de
  UI desta rodada (sem overflow-x, alvos ≥44px onde há gesto).
- Verificação: `npx tsc --noEmit` + `npx eslint src/` limpos + specs
  e2e da área verdes no staging.

## Specs travadas (fonte visual da implementação)

| Tela | Spec | Jira |
|---|---|---|
| Materiais | `mockups/materiais/v5c.html` | 194 |
| Agenda | `mockups/agenda/v8b.html` (coord+aux+mentor) | 195 |
| Chamados | `mockups/chamados/v5.html` (polido) | 196 |
| Duplas | `mockups/duplas/v6a.html` | 197 |
| Registros | `mockups/registros/v2.html` + parametrização/animações | 198 |
| Formulários | plano `formularios.md` (instrumentos→materiais, DnD, numeração) | 199 |
| Turmas | `mockups/turmas/v1a.html` | 200 |
| Relatórios | plano `relatorios.md` (Compartilhar híbrido: dialog atual + dropdown) | 201 |
| Como conduzir | plano `como-conduzir.md` (módulo único × 4 superfícies) | 202 |
| Skeletons | plano/README | 203 |

## Pipeline de aprovação por task

1. **Implementer agent** (escopo disjunto por task, sem tocar escopo
   alheio): lê o plano + spec mock + `_referencias.md`, implementa em
   `src/`, roda `tsc`+`eslint` local.
2. **Skills obrigatórias durante implementação** (todas em
   `.devin/skills/`, auto-ativas por descrição):
   - `ux-review` — self-critique da tela antes de declarar pronto;
   - `60fps-animation` — toda animação é transform/opacity (filtros,
     FLIP, stagger);
   - `accessible-animation` — `prefers-reduced-motion` em tiers, não
     all-or-nothing;
   - `micro-interaction` — send animation de chamados, hover/states;
   - `chart-animation` — transições de gráficos (registros 198, agenda
     195);
   - `vercel-react-best-practices` — 62 regras React/Next (waterfalls,
     re-render, bundle) — Vercel oficial, instalada 23/out;
   - `tailwind-design-system` — Tailwind v4 `@theme`/design tokens/dark
     mode — instalada 23/out;
   - `ui-ux-pro-max` — catálogo pesquisável (25 chart types, 119
     guidelines, 105 ícones, paletas/font pairings) — instalar 23/out;
   - **globais** (`~/.config/devin/skills/`): `impeccable` (design/audit
     de dashboards — instalada 23/out), `antislop-ui`/`antislop`,
     `taste`, `better-typography/colors/layout/interface`,
     `interface-review`, `design-catalogs`, `frontend-ui-engineering`,
     `web-design-reviewer`, `web-quality-audit`, `code-review-expert`,
     `react-doctor`, `building-components`, `react-dev`,
     `mastering-typescript`, `typescript-clean-code`,
     `agent-browser`/`chrome-devtools`/`webapp-testing` (capturas e
     probes no app real) — todas instaladas/expandidas 23/out;
   - `supabase` + `supabase-postgres-best-practices` — migrações/RLS/
     RPC quando a task tocar banco (201 senha, 199 instrumentos) —
     oficiais Supabase, instaladas 23/out;
   - `playwright-best-practices` — specs e2e da área — oficial
     Currents, instalada 23/out;
   - `context7-mcp` — docs de Base UI/lib antes de inventar primitivo.
   **Atenção**: nosso Next é versão custom — skills genéricas de
   Next.js NÃO substituem `node_modules/next/dist/docs` (regra do
   AGENTS.md); em conflito, a doc local vence.
3. **Painel de reviewers por ótica** (read-only, mesmo escopo,
   instruções e skills distintas — cobertura máxima de superfície;
   um por ótica, sem sobreposição de julgamento):
   - **UX/produto** — `ux-review`, `impeccable`, `interface-review`,
     `ui-ux-pro-max`: hierarquia, job-to-be-done, estados (vazio/erro/
     loading/permissão), convenções transversais.
   - **Visual/craft** — `antislop-ui`, `taste`, `better-typography/
     colors/layout/interface`, `web-design-reviewer`: polimento,
     consistência de tokens, anti-slop, densidade.
   - **Motion/interação** — `60fps-animation`, `accessible-animation`,
     `micro-interaction`, `ui-animation`, `chart-animation`,
     `framer-motion-animator`: transform-only, reduced-motion,
     easing/duração, micro-interações.
   - **Copy/a11y** — `better-writing`, `antislop-copywriting`,
     `better-accessibility`, `accessible-animation`: pt-BR, termos do
     guia (não internos), ARIA/foco/teclado, contraste.
   - **Engenharia/perf** — `vercel-react-best-practices`,
     `typescript-clean-code`, `code-review-expert`, `react-doctor`,
     `mastering-typescript`, `supabase`/`supabase-postgres-best-
     practices` (quando tocar banco): diff, re-render, queries/RPC.
   - **e2e/comportamento** — `playwright-best-practices`,
     `playwright-cli`, `agent-browser`, `webapp-testing`: specs da
     área + probes no app real.
   - **Todos recebem contexto do projeto, não só o diff**: plano da
     tela + spec mock + `_prompt-original.md` (as intenções do Thiago)
     + AGENTS.md + convenções transversais — e screenshots app × mock
     em 1280×900 e 390×844 (produzem eles mesmos via Playwright).
   - **Dúvidas não viram decisão silenciosa**: reviewer levanta no
     relatório (com a leitura que acha certa); ambiguidade de produto
     volta pro Thiago ou alinha o plano antes de fechar. Analisar os
     docs antes de julgar é obrigatório.
   - Cada um reporta `aprovado | aprovado-com-ressalvas | reprovado`
     + itens; implementer corrige e re-submete só os itens afetados.
4. **e2e**: specs da área verdes contra staging. **Atualizar specs que
   assertam a UI antiga faz parte da implementação** (a suíte tem
   asserts de checkbox fieldsets, copy "estação", faixa-footer do card
   — vão quebrar de propósito; padrão `convergirPiso` do AGENTS.md).
5. **Thiago**: spot-check final (screenshots do app real) → merge.

## Status (pós-clarificação)

- Todos os mocks escolhidos e revisados pelo Thiago (incl. 2 rodadas de
  correção: materiais v5c, agenda v8b, chamados polish).
- Decisões travadas em `_revisao.md`; Jira REALIZA-194–203 comentadas.
- Pronto pra pipeline de implementação.
