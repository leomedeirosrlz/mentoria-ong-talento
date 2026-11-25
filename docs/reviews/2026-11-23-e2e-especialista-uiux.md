# Revisão e2e UI/UX — trilhas de especialista (REALIZA-510, spec 015)

- Data: 2026-11-23
- Worktree/branch: `test/e2e-especialista-integration` @ `5618b358`
- Escopo: revisão + specs e2e; **nenhuma linha de produto alterada**
- Ambiente: app local `http://localhost:3500` (`pnpm dev -p 3500`), Supabase
  local `127.0.0.1:54321` via proxy (`NEXT_PUBLIC_SUPABASE_PROXY=1`), seed
  demo + fixtures `*-e2e@realiza.test` (senha `e2e-senha-teste`)
- Fonte da verdade: `specs/015-e2e-especialista-uiux/spec.md`

## Resumo

70 testes e2e verdes (46 app + 24 demo), 24 prints em
`/tmp/realiza-510-review/` (1440×900 e 390×844, com variantes
reduced-motion). **Nenhuma falha P0/P1 de produto encontrada.** Os três
problemas achados eram specs defasados diante de decisões de produto já
integradas (REALIZA-507, REALIZA-468) mais um obstáculo real de UI (o balão
da Liza cobre o ⋯ das linhas baixas da lista de duplas — P2). A lacuna de
cobertura do US3 (registro da sessão, encerramento com devolutiva ao mentor
DPP, acesso negado UI+RLS) foi fechada com o spec novo
`tests/e2e/app/especialista-trilha.spec.ts` (3 testes, serial).

## Matriz passo × papel × viewport

| Passo | Papel | Rota | 1440×900 | 390×844 | Resultado |
|---|---|---|---|---|---|
| Home — próxima sessão esp + sugestão pendente | mentorado | `/jovem` | `us1-jovem-home-card-esp-1440` | `us1-jovem-home-card-esp-390` (+`-rm`) | ✅ "Sessão 3 com Sofia · sábado 28/11, 10h · Link da chamada" no hero; "Ricardo sugeriu um especialista — Marcos Vinicius" em Para fazer agora |
| Especialistas — sugestão do mentor | mentorado | `/jovem/especialistas` | `us1-jovem-especialistas-topo-1440` (+`-rm`) | `-topo-390` | ✅ card citando o contexto ("a Bia mencionou… editar vídeo"), Objetivo, preview do Marcos (foto, atuação, áreas, experiência), "Quero seguir" / "Agora não" |
| Suas trilhas — ativa com passo e horário | mentorado | `/jovem/especialistas#trilhas` | `-trilhas-1440` | `-trilhas-390` | ✅ Sofia × Bia "Em andamento", "2 de 5 sessões feitas", próximo passo datado, última devolutiva com autoria e data, "Ver trilha completa" |
| Pedidos em aberto — contraproposta + mural | mentorado | `/jovem/especialistas#pedidos` | `-mesa-1440` | `-mesa-390` | ✅ "Sessão com Helena — negociando", horário na mesa `terça 24/11 às 19:00` com autor da proposta, "Aceitar terça 24/11 às 19:00"; "Pedido no mural · aguardando" com "Cancelar pedido" |
| Cardápio — perfis completos e incompletos | mentorado | `/jovem/especialistas#cardapio` | `-cardapio-1440` | `-cardapio-390` | ✅ fallbacks honestos: "Pedido em andamento" (Helena), "Agenda não aberta → pedido vai pro mural" (Marcos), "Seu especialista" (Sofia), "Sem vagas" (Camila) |
| Perfil público do especialista | mentorado | `/pessoas/[id]` via "Ver perfil" | `us1-jovem-esp-perfil-preview-1440` | `-390` | ✅ foto/área/experiência/atuação; privacidade explícita: "O contato direto abre quando a sua trilha de especialista começar" |
| Agenda — slots do especialista | mentorado | `/jovem/agenda` | `us1-jovem-agenda-esp-1440` | `-390` | ✅ "Horários de Sofia", chips agrupados por dia com legenda "Em lima: encaixam na sua disponibilidade", WhatsApp pra combinar fora do app |
| Mural de pedidos | especialista | `/` (Sofia) | `us2-esp-mural-1440` | `-390` | ✅ 5 pedidos com jovem, demanda e contexto do solicitante ("pedido do jovem" × "solicitado por …"), busca, chips de área, "Horário da agenda" + "Aceitar" — sem dado sensível |
| Trilhas esp — painel read-only | coordenação | `/` (Marina) | `us2-coord-home-trilhas-1440` | — | ✅ "Somente leitura", contagens (3 ativas, 1 concluída, 9 sessões), alerta de pedido parado ≥5 dias, "Quem aceita é o especialista", "Ver ficha" por trilha |
| Registrar sessão (rota dedicada) | especialista | `/duplas/[id]/registrar/[encontroId]` | `us3-real-esp-registrar-sessao-1440` | `-390` | ✅ wizard 3 passos "Registrar sessão de especialista", sugestão do guia, "falta o registro", duração, reflexões — backend real |
| Feed de devolutivas da trilha | especialista | `/duplas/[d-esp1]?aba=encontros` | `us3-esp-ficha-devolutivas-1440` | — | ✅ feed datado + "Postar devolutiva" + "O jovem lê a devolutiva na página de especialistas dele" + "Resumo da jornada" |
| Encerrar trilha — checklist/decisão | especialista | ficha → Mais → Encerrar trilha | `us3-esp-encerrar-dialog-1440` | — | ✅ decisão "Concluir" × "Encerrar antes", motivo, "Devolutiva pro PDM" (0/4000) — explica que o DPP lê na ficha dele |
| Devolutiva do especialista | mentor DPP | `/duplas/[d-ok]?aba=pessoas` | `us3-dpp-ficha-devolutiva-1440` | `-390` | ✅ seção "Devolutivas de especialistas": Sofia e Helena fecharam trilhas com o texto "É o que segue pro PDM" — compartilhado, sem registro interno |
| Acesso negado à ficha esp | mentor DPP de outra dupla | `/duplas/[trilha esp alheia]` | `us3-real-negado-404-1440` | — | ✅ "Página não encontrada" na UI + RLS retorna vazio — sem vazar conteúdo |

## Esperado × observado — achados

### Sem P0/P1 de produto

Os fluxos mandatórios do spec 015 renderizam como especificado nos dois
viewports, com fallbacks honestos (agenda não aberta, sem vagas, pedido já
em aberto) e fronteiras de privacidade explícitas na UI ("o contato direto
abre quando a trilha começar") e na RLS (negado sem vazar).

### P2 — balão da Liza cobre ações de linhas baixas

A saudação da Liza nasce aberta ~3s após a navegação no canto inferior
direito e intercepta cliques sobre o `⋯ Ações da dupla` das linhas baixas da
lista `/duplas` (o `elementFromPoint` retorna o popover). No teste o clique
"forçado" caía no balão e o menu nunca abria — um usuário real teria o
mesmo hit roubado até dispensar a mensagem.

- Evidência: `tests/e2e/app/dupla-menu.spec.ts` falhava em "menu ⋯ em dupla
  encerrada" até o spec dispensar a Liza (`dispensarLiza`, commit desta
  revisão).
- Sugestão de issue: o popover da Liza não deveria cobrir controles de
  linha (subir o bottom-offset quando há lista à direita, ou auto-recolher
  ao primeiro scroll/toque fora).

### Specs defasados corrigidos (não são bugs de produto)

1. `tests/e2e/app/especialista-agenda.spec.ts` — a 507 (commit `9775cd42`)
   agrupou os chips por dia: o visível virou "terça 24/11" + botão "20:00";
   o rótulo completo vive no `title` ("Pedir sessão terça 24/11 às 20:00").
   Assertiva migrada de `getByText` para `getByTitle` (linhas ~362-373).
2. `tests/e2e/app/jovem-especialista.spec.ts` — a migration `0222`
   (REALIZA-468) esvaziou `sol_coords()`: pedido de especialista não toca
   o sino da coord (o radar dela é o mural/painel, como o
   `solicitacao-esp.spec.ts` já asserta 3×). Assertiva migrada para
   `toHaveLength(0)` mantendo a checagem do pool de especialistas
   (linha ~768).
3. `tests/e2e/app/dupla-menu.spec.ts` — helper `dispensarLiza` chamado
   antes de clicar no ⋯ nos três testes (ver P2 acima).

## Specs novos/alterados

| Arquivo | Mudança |
|---|---|
| `tests/e2e/app/especialista-trilha.spec.ts` | **novo** — 3 testes serial: registro da sessão pela rota dedicada (+ privacidade do jovem), encerramento com devolutiva pro PDM lida pelo mentor DPP na aba Pessoas, negado UI+RLS |
| `tests/e2e/app/especialista-agenda.spec.ts` | assertivas dos chips migradas pro formato agrupado da 507 |
| `tests/e2e/app/jovem-especialista.spec.ts` | sino da coord → `toHaveLength(0)` (sol_coords vazio por decisão da 468) |
| `tests/e2e/app/dupla-menu.spec.ts` | `dispensarLiza` antes dos cliques no ⋯ |

## Comandos de reprodução

```bash
# ambiente
pnpm dev -p 3500
export E2E_BASE_URL=http://localhost:3500
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export E2E_SUPABASE_SERVICE_ROLE_KEY=<service key do .env.local>
export E2E_MENTOR_PASSWORD=e2e-senha-teste

# suíte app — 46 verdes
npx playwright test tests/e2e/app/jovem.spec.ts \
  tests/e2e/app/jovem-especialista.spec.ts \
  tests/e2e/app/jovem-especialista-wp6.spec.ts \
  tests/e2e/app/jovem-especialista-wp6r2.spec.ts \
  tests/e2e/app/especialista-agenda.spec.ts \
  tests/e2e/app/especialista-trilha.spec.ts \
  tests/e2e/app/solicitacao-esp.spec.ts \
  tests/e2e/app/registro-rota.spec.ts \
  tests/e2e/app/dupla-menu.spec.ts
# → 46 passed (4.3m)

# suíte demo — 24 verdes
npx playwright test tests/e2e/demo/jovem-especialistas.spec.ts \
  tests/e2e/demo/jovem-jornada.spec.ts \
  tests/e2e/demo/agenda-especialista.spec.ts
# → 21 passed (47.2s) + 3 passed (5.0s)

# prints — scripts em /tmp/realiza-510-review/capture-review{,-2}.mjs
node /tmp/realiza-510-review/capture-review.mjs && \
  node /tmp/realiza-510-review/capture-review-2.mjs
```

## Cobertura dos estados de borda

| Estado | Onde valida |
|---|---|
| sem sugestão / jovem sem trilha | `jovem-especialista.spec.ts` "card-CTA — trilha em andamento × convite quieto"; cardápio demo |
| sugestão dispensada | `jovem-especialista-wp6.spec.ts` "jovem dispensa → 'cancelada'" |
| pedido aberto (mural) | `jovem-especialista.spec.ts` broadcast; demo "Pedido no mural" |
| contraproposta | `solicitacao-esp.spec.ts` + `jovem-especialista.spec.ts` + mesa demo |
| sessão sem horário | ficha esp demo: passo 5 "Encerramento… Data a combinar" (print `us3-esp-ficha-devolutivas-1440`) |
| pedido/sessão vencida | `solicitacao-esp.spec.ts` "horário vencido lê expirado" |
| especialista incompleto | cardápio demo: "Agenda não aberta", "Sem vagas" (prints + spec linhas 272-280) |
| dupla encerrada / rito | `dupla-menu.spec.ts` (menu em encerrada/decidida); demo `d-rito` |
| teclado/foco | `mais-menu.spec.ts` — menu ⋯, dialog abre, Esc fecha e foco volta (inclui a ficha `d-esp1`); botões da sugestão são nativos |
| prefers-reduced-motion | `jovem-jornada.spec.ts` "a entrada não bloqueia a leitura"; prints `*-rm` |
| 1440×900 e 390×844 | matriz acima — nenhum estouro horizontal (agenda-especialista mobile spec cobre <768px) |
| fuso | labels de slot ("terça 24/11 às 19:00") e tempos relativos ("há 19h") renderizam consistentes em pt-BR local nos prints e specs |
| leitor de tela | **fora de escopo viável** — a suíte não tem harness de a11y tree; cobertura indireta por roles/names acessíveis nos locators |

## Validado / fora de escopo

Validado: catálogo com preview (foto, área, experiência), sugestão
confirmar/dispensar, pedido aberto e contraproposta, trilha ativa com
passo/horário/devolutiva, registro da sessão pela rota dedicada (3 passos,
privacidade do jovem), encerramento com decisão + motivo + devolutiva pro
PDM, leitura da devolutiva pelo mentor DPP, painel read-only da coord,
negado UI+RLS, fallbacks honestos, reduced-motion, dois viewports.

Fora: leitor de tela real (sem harness), contraste medido (revisão visual
nos prints — textos secundários `text-muted-foreground` sobre fundo claro
parecem ok, mas sem medida formal), e2e de fuso real (só renderização
consistente, sem mudar TZ do browser), transição de pausa de dupla
existente (fixture pausada existe mas o fluxo de pausar não é da trilha
esp).

## Gates do worktree

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `pnpm exec next typegen && npx tsc --noEmit` | ✅ 0 erros |
| Lint | `npx eslint tests/e2e/app/{especialista-trilha,dupla-menu,especialista-agenda,jovem-especialista}.spec.ts` | ✅ 0 warnings |
| Unit | `pnpm test` (vitest run) | ✅ 2863 passed, 1 skipped (180 arquivos, 15.5s) |
| Guard | `node scripts/repo-guard.mjs` | ✅ 10/10 (R6 actionlint: warn por ferramenta ausente local — roda no CI) |
| Build | — | **não rodado** — nenhum arquivo de produto alterado |

Nota: `next typegen` reescreve `next-env.d.ts` apontando pra `.next/types`
(o R8 espera os caminhos de `next dev`); após o typecheck o arquivo foi
restaurado com `git checkout -- next-env.d.ts` e o guard ficou 10/10.
