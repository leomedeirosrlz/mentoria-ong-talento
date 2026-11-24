# Spec — Motion de forms e wizards: um idioma de transição de etapa

**Feature:** `specs/028-motion-forms-wizards` · **Status:** Clarified
**Origem:** pedido do Thiago (24/11/2026) · **Recon:** `docs/planos/issues/_recon/motion-forms-2026-11-24.md` · **Dono:** Thiago · **Data:** 24/11/2026

> O QUÊ e o POR QUÊ. Os mecanismos citados (`hidden`+`--dir`, `focoPendente`, `fade`/`T`) são âncora do estado atual — a API final e os nomes de arquivo são do `plan.md`. Sem DDL, sem migration, sem rota nova: é spec de front-end.

## Problema e resultado

- **Dor hoje:** três idiomas diferentes de "troca de etapa" convivem no app — `key={step}`+`.animate-rise` remontando nos onboards (`onboarding-flow.tsx:1135`, `onboarding-jovem.tsx:517`), `hidden`+`.animate-enter-x`+`--dir` direcional no registro e na ficha de pessoa (`registro-form.tsx:918-1224`, `campos-pessoais.tsx:740-748`), e `motion.section` com fade genérico no `/f/[token]` (`formulario-publico.tsx:711-719`) — mais ~10 superfícies multi-etapa sem animação nenhuma (combinar plano corta seco em `combinar-plano.tsx:1116-1120`). Do lado "form → resultado", o mesmo `AnimatePresence mode="wait"` está copiado em 10 lugares e 4 deles deixam o foco órfão quando o botão que disparou desmonta. E há animação cara espalhada: `transition-all` e `transition-[width]`/`transition-[max-width]` animando layout por frame em barras de progresso.
- **Resultado observável:** um único vocabulário de transição de etapa — slide direcional curto que informa para onde o fluxo andou (avançar entra pela direita, voltar pela esquerda), com foco e dados preservados por construção, não por disciplina de cada superfície. Navegação, troca de estado e revelação progressiva ganham padrões visualmente distintos: ninguém mais confunde "fui para a próxima etapa" com "o painel mudou de estado" com "uma seção nova apareceu". Tudo com 60fps, sem layout por frame, e reduced-motion respeitado pelo guard global.
- **Como saberemos que funcionou:** o inventário de "troca de etapa" fora do kit zera (grep); em toda superfície P0 avançar e voltar deslizam em direções opostas com o foco pousando no título da etapa nova; o wizard público segue entregando o payload byte-a-byte; quatro pontos que hoje abandonam o foco passam a anunciar o painel entrante; e nenhuma superfície inventa um quarto idioma — quem precisar de exceção escreve o motivo no código.

## Fora de escopo

- Transição entre **rotas/páginas** (`template.tsx` dos grupos já usa `.animate-enter`; o item "Animações de alternância de tela" do `BACKLOG.md` — ViewTransition vs CSS — é frente própria).
- Chrome de overlay: `Dialog`/`Sheet` já têm entrada/saída via `data-open`/`data-closed` + tw-animate-css (`dialog.tsx`, `sheet.tsx`) — não tocar.
- Animações de delight já nomeadas (`badge-*`, `confirm-*`, `ia-*`, `fab-chega`, `roda-abre`) e a estante da spec 016.
- Lib nova de animação, View Transitions API, redesign visual, mudança de copy, de validação ou de regra de negócio.
- Unificar as duas técnicas de `height` que coexistem por design (Collapsible do Base UI × `motion` `height:"auto"`) — a fronteira é deliberada; a regra é não criar uma terceira.
- Entrada/stagger de listas e filtros (`.animate-enter`+`--i`) — já é convenção (`conventions-ui.md` §Movimento).
- Mudar o comportamento do `useFecharNoVoltar` (voltar do browser/sistema fecha o dialog inteiro, não volta uma etapa) — documentar o esperado, não interceptar.

## Histórias de usuário

### US1 — Um mecanismo de etapa no kit, com foco e direção embutidos (P0)

- **Por que P0:** hoje a parte mais difícil (direção + foco pós-commit + etapas montadas) está implementada duas vezes à mão (`registro-form`, `WizardFicha`) e falta em todas as outras. Extrair é o que torna o padrão adotável sem copy-paste — e o que impede o "remount acidental" que quebraria `FormData` e rascunho.
- **Teste independente:** `registro-form` e `WizardFicha` migram para o hook/componente compartilhado sem nenhuma mudança visual ou de comportamento observável.
- **Cenários:**
  1. **Dado** o mecanismo extraído **quando** uma superfície o consome **então** recebe num lugar só: etapa atual, direção calculada por `irPara(n)` (`n > etapa ? 1 : -1`), referência de título e contrato de foco pendente (foco no heading da etapa nova depois do commit — o botão Voltar/Avançar segue montado e não pode reter o foco).
  2. **Dado** uma superfície com inputs não-controlados/`FormData` (registro, `/f`, ficha de pessoa) **quando** troca de etapa **então** todas as etapas seguem montadas com `hidden` — `AnimatePresence`+`key` é proibido nesse modo, porque desmontar perde digitação e muda o payload (invariante REALIZA-144 §3).
  3. **Dado** uma superfície de estado controlado (onboardings, combinar plano) **quando** troca de etapa **então** o mesmo vocabulário visual se aplica no modo remount (a etapa nova entra com a mesma assinatura de movimento) — a escolha montado × remount é explícita no componente, com comentário do porquê.
  4. **Dado** o painel "form ↔ sucesso/erro" repetido 10× **quando** vira componente do kit **então** aceita alvo de foco e o painel entrante recebe `focus()` — os 4 pontos que hoje deixam o foco órfão são cobertos pela API, não por boa vontade da superfície.
  5. **Dado** o `WizardPassos` (evolução do `WizardFicha`) **quando** os 4 dialogs de pessoa renderizam **então** consomem o mesmo hook — o stepper clicável com `aria-current="step"` e o "salvar de qualquer etapa" seguem iguais.

### US2 — Wizards numerados convergem para o slide direcional (P0)

- **Por que P0:** é o pedido explícito ("slide entre etapas") nas superfícies mais usadas.
- **Teste independente:** cada superfície listada trocando etapa para frente e para trás, com foco e valores.
- **Cenários:**
  1. **Dado** o registro de encontro **quando** o mentor avança **então** a etapa nova entra deslizando da direita; ao voltar, da esquerda; os valores digitados e o `FormData` do submit não mudam (prova o sistema sem mudança visual).
  2. **Dado** "Combinar o plano" (2–5 perguntas em dialog, hoje corte seco) **quando** mentor/jovem/auxiliar/coordenação responde **então** cada pergunta entra na direção da navegação e o foco segue no título — a pergunta "Pergunta N de M" vira régua, não única pista de progresso.
  3. **Dado** o wizard público `/f/[token]` **quando** a pessoa avança de seção **então** a seção entra na direção correta (hoje só faz fade na entrada, sem direção); as seções seguem todas montadas e o payload de submit é byte-a-byte igual ao da página única.
  4. **Dado** o onboarding staff e o onboarding do jovem **quando** trocam de passo **então** o movimento informa avançar/voltar como nas outras superfícies — a entrada da Liza e o balão de conversa seguem dentro do passo (a metáfora de conversa é conteúdo, não a transição); remontar por passo continua sendo decisão deliberada deles, não acidente.
  5. **Dado** qualquer superfície P0 **quando** a etapa troca **então** o heading novo recebe foco (`tabIndex={-1}`, `outline-none`, sem ring fantasma de `:focus-visible`), `aria-current="step"` acompanha o stepper onde ele existe e Enter num input avança (não submete) até a última etapa.

### US3 — Troca de estado não é navegação (P1)

- **Por que P1:** "form → sucesso/erro" já tem padrão de fato (`AnimatePresence mode="wait" initial={false}` + `fade` + `T.enter`), mas repetido 10× e com 4 focos órfãos — e usar o slide direcional aqui ensinaria a metáfora errada (não há "lugar adiante" para onde ir).
- **Teste independente:** os pontos fora do padrão e os órfãos de foco, um a um.
- **Cenários:**
  1. **Dado** `enviar-formulario`, `enviar-termos`, `formulario-links` e `enviar-instrumento-lote` **quando** o envio conclui **então** o painel de resultado entra em crossfade **e** recebe foco — quem enviou pelo teclado ouve o desfecho.
  2. **Dado** `novo-link-dialog` (early return seco), `avaliar-token-flow` (early returns), `resumo-senha-form` (`location.reload()`), pós-save do registro (evidências), `fila-espera` (fila ↔ parear) e `jovem-agendar-sugestao` **quando** trocam de painel/fase **então** usam a mesma troca de estado do kit — sem corte seco, sem reload de página, sem `.animate-enter` solto fora do contexto de lista.
  3. **Dado** a distinção de camadas **quando** alguém revisa o diff **então** encontra: slide direcional **só** em navegação de etapas; crossfade **só** em troca de estado do mesmo painel; cascata `.animate-enter`+`--i` **só** em revelação/entrada de coleção; `data-open`/`data-closed` **só** em chrome de overlay — a "mesma animação tosca em tudo" morre pela gramática, não por gosto.

### US4 — Fluxos por fases ganham a entrada certa (P1)

- **Por que P1:** são os que hoje não animam nada — cada um precisa do padrão da camada correta, não de slide genérico.
- **Teste independente:** percorrer cada fluxo de ponta a ponta.
- **Cenários:**
  1. **Dado** `cronograma-builder` (config → prévia) e `nova-turma-flow` (3 modos) **quando** trocam de fase **então** usam a troca de etapa do kit com foco no título da fase nova — hoje nem isso nem foco acontecem.
  2. **Dado** `importar-csv-dialog` e `importar-registros-dialog` (entrada → prévia → resultado) **quando** avançam de fase **então** seguem o idioma de etapas e o foco sai do `ref={(el)=>el?.focus()}` local para o contrato do kit.
  3. **Dado** `pedir-especialista-dialog` (disclosure progressivo) **quando** uma seção nova é revelada **então** ela entra em cascata de revelação (`.animate-enter`), não em slide — revelação não é navegação.
  4. **Dado** o pós-save do registro **quando** o form vira painel de evidências **então** a transição é a troca de estado do kit, não o early return atual.

### US5 — Polimento do que anima errado hoje (P2)

- **Por que P2:** débito barato e mensurável — animação que retrabalha layout por frame é a fonte conhecida de jank em tela fraca (a lição do blur no `enter-flat`, `globals.css:388-397`).
- **Teste independente:** grep pelas propriedades proibidas + inspeção visual das barras.
- **Cenários:**
  1. **Dado** as barras de progresso com `transition-all` (`onboarding-flow.tsx:1110`, `onboarding-jovem.tsx:488`, `roda-svg.tsx:192`) **quando** revisadas **então** animam só a propriedade necessária — `transition-all` não volta a entrar.
  2. **Dado** as barras com `transition-[width]` (`formulario-publico.tsx:617`, `instrumentos/flow.tsx:125`) **quando** o progresso muda **então** preenchem por `scaleX` com origem à esquerda — nunca mais layout por frame.
  3. **Dado** o `transition-[max-width]` dos onboards (`onboarding-flow.tsx:1130`, `onboarding-jovem.tsx:512`, `formulario-preview.tsx:104`) **quando** o passo largo abre **então** a largura ou vira tween deliberado documentado ou sai — decisão registrada, não esquecida.
  4. **Dado** Roda da Vida (eixo ativo), `adocao-explorador`, `resumo-senha`, `tokens-mcp` e `chamado-detalhe` (modo interno/público) **quando** trocam de conteúdo **então** usam o padrão da camada certa — na Roda, fade curto entre eixos (o gesto direto briga com slide; ferramenta interna pode ficar como está se o custo não fechar).

## Casos de borda

- **Passo condicional que some** (papel trocado, ficha async ainda não chegou): o índice nunca aponta para fora da lista — o clamp do `WizardFicha` (`campos-pessoais.tsx:558`) vira parte do contrato do hook.
- **`reportValidity()` em etapa `hidden` falha calado** (controle infocável no Chrome): validação que força navegação reporta **depois** do passo ficar visível — o `invalidoPendente` faz parte do mecanismo, não é exercício por superfície.
- **Enter implícito** em qualquer input que não seja da última etapa avança em vez de submeter; na última, submete. Voltar nunca valida nem perde dados.
- **Stepper clicável** pulando mais de uma etapa: a direção vem do sinal do delta; a validação das etapas puladas segue sendo regra da superfície.
- **Wizard de uma etapa só** ou form sem seções: sem transição e sem régua de progresso falsa ("1 de 1" não é progresso).
- **Altura entre etapas**: a troca muda a altura do documento sem animar `height` no container do wizard — iniciado por input fica fora do score de CLS, mas header/footer sticky não podem pular e nenhuma leitura de layout pode intercalar com escrita (layout thrash banido).
- **Reduced motion ligado no meio do fluxo**: o guard global + `MotionConfig reducedMotion="user"` reagem sem reload; a etapa troca como mudança de estado instantânea e o foco segue chegando ao título.
- **Voltar do browser/gesto dentro de dialog** fecha o dialog inteiro (`useFecharNoVoltar`) — não volta uma etapa; o comportamento esperado fica escrito no componente para ninguém "corrigir" errado.
- **StrictMode**: o foco pendente é ref + efeito pós-commit (padrão atual), não ref-callback de mount nem state — os dois estilos que hoje coexistem (`focoPendente` × `ref={(el)=>el?.focus()}` dos importadores) convergem para um só no hook.

## Requisitos funcionais

- **FR-001:** existe **um** mecanismo de troca de etapa no kit (hook de estado + componente de painel), cobrindo etapa atual, direção, foco pós-commit no heading e foco em campo inválido diferido — os dois consumidores canônicos (`registro-form`, `WizardFicha`) migram para ele sem mudança visual, provando a extração.
- **FR-002:** a transição de etapa é direcional e curta: avançar entra pela direita, voltar pela esquerda (LTR), deslocamento ≤8px + opacity, 200–260ms em `--ease-snappy` — viagem longa lê como "o template andou" e custa repaint em tela fraca.
- **FR-003:** em superfície com inputs não-controlados/`FormData` as etapas ficam **sempre montadas** (`hidden`, que já as tira da ordem de tab); `AnimatePresence`+`key` é proibido nesse modo — o submit segue byte-a-byte igual ao não-wizard. Em superfície de estado controlado o modo remount é permitido com o mesmo vocabulário visual; a escolha é explícita e comentada no componente.
- **FR-004:** o foco acompanha a etapa: `focus()` no heading novo (`tabIndex={-1}`, `outline-none`) depois do commit; validação que força navegação reporta `reportValidity()` só com o campo visível; Enter em input fora da última etapa = Avançar; Voltar nunca valida nem perde dados. Sem `aria-live` duplicado — o foco no heading já anuncia.
- **FR-005:** a troca de estado "form ↔ resultado/fase" vira componente único do kit (crossfade ~180ms, saída mais curta que a entrada) com prop de foco no painel entrante; os 10 pontos que hoje repetem o padrão migram, e os que o violam (`novo-link-dialog`, `avaliar-token-flow`, `resumo-senha-form`, pós-save do registro, `fila-espera`, `jovem-agendar-sugestao`) adotam — incluindo o fim do `location.reload()`.
- **FR-006:** a gramática por camada é a da tabela do recon §3 e é obrigatória: **navegação de etapa** = slide direcional; **troca de estado** = crossfade do kit; **revelação progressiva** = cascata `.animate-enter`+`--i`; **chrome de overlay** = `data-open`/`data-closed` CSS (intocado); **feedback** = CSS existente (`scale .96`, `animate-spin`, `flash-ok`); **shared-element/`height:"auto"`/exit de lista** = `motion.tsx` onde já está. Nenhuma superfície cria idioma novo nem usa `motion/react` no caminho de etapas.
- **FR-007:** adoção P0 obrigatória: `registro-form`, `WizardFicha` (com os 4 dialogs de pessoa por herança), `combinar-plano`, `formulario-publico` (ganha direção; seções seguem montadas — REALIZA-144), `onboarding-flow` e `onboarding-jovem`.
- **FR-008:** adoção P1: `cronograma-builder`, `nova-turma-flow`, `importar-csv-dialog`, `importar-registros-dialog`, `pedir-especialista-dialog` (cascata de revelação), pós-save do registro, `fila-espera`, e os pontos do FR-005.
- **FR-009:** débitos de propriedade cara zerados: `transition-all` das barras vira transição explícita; `transition-[width]` de progresso vira `scaleX` (origem esquerda; updates contínuos via `--p`+`transition-transform`); `transition-[max-width]` dos onboards é decidido e registrado. Nenhum dos três padrões volta a entrar.
- **FR-010:** altura honesta: nenhuma animação de `height` nova no container de wizard; `min-height` artificial para "prevenir pulo" é proibido; onde já existe técnica de altura (Collapsible ou `height:"auto"` do `motion.tsx`) ela segue — terceira técnica não entra.
- **FR-011:** `WizardPassos` (evolução do `WizardFicha`) expõe `passos[] {titulo, icone, conteudo}` + stepper com `aria-current="step"` + footer Voltar/Avançar/Salvar — API já provada nos 4 dialogs de pessoa.

## Requisitos não funcionais

- **Reduced motion é global, nunca local:** o guard em `globals.css:865-902` zera o CSS e `MotionConfig reducedMotion="user"` (`layout.tsx:97`) torna transform/layout do motion instantâneos mantendo fades — nenhum media query por componente, nenhum `useReducedMotion` novo fora de necessidade real de JS (os 5 existentes seguem). A troca de etapa com reduce vira mudança de estado instantânea com foco intacto; nenhuma exceção funcional nova entra no guard sem justificativa comentada (precedente: spinner e `ia-*`).
- **Só compositor por frame:** `transform`, `opacity` e `background-color` animam; `filter`/`blur`, `width`/`height`/`max-width`/`top`/`left`, `margin` e `transition-all` não entram em transição nenhuma; `will-change` só just-in-time no padrão do `sheet.tsx`. Deslocamento máximo 8px em form; spring só com `bounce: 0` (`T.pill` já documenta) e nunca em superfície de form.
- **CLS e thrash:** troca de etapa não pode gerar deslocamento extra além da altura do documento (header/footer sticky ancorados); batch de leituras `getBoundingClientRect` antes de qualquer escrita quando houver medição — leitura intercalada com escrita é bug, não estilo.
- **Teclado e leitor de tela:** Enter avança (não submete) até a última etapa; stepper com `aria-current="step"`; régua de progresso com `role="progressbar"` + `aria-valuetext` quando não é a lista de etapas; foco no heading sem ring fantasma; sem `aria-live` redundante ao foco.
- **Mobile:** 8px/opacity é o teto de deslocamento; nada de overshoot; hit targets dos steppers ≥40px como já estão.
- **Sem mudança de dados:** nenhuma migration, RPC, action ou payload muda — paridade de `FormData` é invariante testado.
- **Gates do repo:** `pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard`; e2e por superfície tocada conforme `docs/convencoes/ci-e2e.md`.

## Superfícies e adoção

Inventário priorizado (recon §2/§5; P0 = pedido explícito + prova do sistema):

| Pri | Superfície | Estado da etapa hoje | Padrão alvo |
|---|---|---|---|
| P0 | `registro-form.tsx` (3 etapas + pós-save) | `hidden`+`enter-x`+`--dir`, direção e foco | migra pro hook — zero mudança visual |
| P0 | `campos-pessoais.tsx` `WizardFicha` → NovaPessoa/NovoMentorado/EditarPessoa/EditarMentorado | idem | migra pro hook via `WizardPassos` |
| P0 | `combinar-plano.tsx` (dialog, 2–5 perguntas) | corte seco, foco existe | slide direcional (remount ok — estado controlado) |
| P0 | `f/[token]/formulario-publico.tsx` (seções) | `motion.section` fade s/ direção, montadas | `enter-x`+`--dir` mantendo montagem e payload |
| P0 | `onboarding-flow.tsx` + `onboarding-jovem.tsx` | `key={step}`+`.animate-rise` remonta | idioma direcional (modo remount); Liza segue dentro do passo |
| P1 | `cronograma-builder.tsx`, `nova-turma-flow.tsx` | early return, sem foco | etapa do kit + foco |
| P1 | `importar-csv-dialog.tsx`, `importar-registros-dialog.tsx` | ref-callback de foco | etapa do kit + foco do hook |
| P1 | registro pós-save, `fila-espera.tsx` (fila↔parear) | corte | `FadeTroca` |
| P1 | `pedir-especialista-dialog.tsx` | disclosure progressivo | cascata `.animate-enter` |
| P1 | `novo-link-dialog`, `avaliar-token-flow`, `resumo-senha-form`, `jovem-agendar-sugestao` + 4 enviar órfãos de foco | fora do padrão/órfão | `FadeTroca` + foco |
| P2 | progressbars (`onboarding-*`, `roda-svg`, `formulario-publico`, `instrumentos/flow`), `max-width` dos onboards, `roda-vida` eixo, `adocao-explorador`, `tokens-mcp`, `chamado-detalhe` | propriedade cara/sem padrão | scaleX + padrão por camada |

## Critérios de sucesso

- **SC-001 (unificação):** grep por `hidden={`+`animate-enter-x`, `.animate-rise` e `key={step}` como transição de etapa fora do kit = zero; `registro-form` e `WizardFicha` renderizam etapas pelo componente compartilhado.
- **SC-002 (direção):** em toda superfície P0, avançar entra pela direita e voltar pela esquerda — assert e2e no `--dir`/transform ou screenshot mid-transição.
- **SC-003 (foco/teclado):** o heading da etapa nova recebe foco em toda superfície P0/P1 (assert `document.activeElement`); `aria-current="step"` correto; Enter avança sem submeter até a última etapa; voltar preserva valores.
- **SC-004 (dados):** payload de submit byte-a-byte igual ao atual no `/f` e no registro; "salvar de qualquer etapa" do `WizardFicha` segue enviando o form inteiro.
- **SC-005 (reduced motion):** com `reducedMotion: "reduce"` a etapa troca instantaneamente (assert `animationDuration < 0.05s`, padrão de `jovem-conquistas.spec.ts:183`) **e** o foco continua chegando ao título — em pelo menos um spec por superfície P0.
- **SC-006 (performance):** zero `transition-all`/`transition-[width]`/`transition-[max-width]` novos (grep guard em CI ou revisão); durante a troca de etapa não há banda Layout/Paint por frame no DevTools Performance; barras de progresso preenchem por transform.
- **SC-007 (estabilidade visual):** header/footer sticky e a régua de progresso não deslocam durante a transição (screenshot antes/durante/depois a 390×844 e 1440×900).
- **SC-008 (foco órfão):** os 4 pontos `enviar-*`/`formulario-links` anunciam o painel de resultado via foco — assert e2e de `activeElement` dentro do painel entrante.
- **SC-009 (a11y limpa):** `axe` sem violação nova nas superfícies P0; nenhum `aria-live` duplicando o anúncio do foco.

## Plano de testes

- **Unit (Vitest):** hook de troca de etapa — direção por `irPara`, clamp de índice, foco pendente consumido uma vez, inválido diferido reportado após visível; componente de etapa — `hidden` correto, `--dir` propagado; `FadeTroca` — painel entrante recebe foco; `WizardPassos` — stepper emite `aria-current` e `pularPara` respeita direção.
- **E2E app (`tests/e2e/app`):** registro — avançar/voltar com valores preservados, erro que salta para a etapa do campo inválido com foco, Enter avançando; combinar plano — fluxo completo com slide e foco; WizardFicha via dialog de pessoa — salvar de etapa intermediária; importadores — fases com foco; cronograma e nova turma — troca de fase.
- **E2E demo (`tests/e2e/demo`):** `/f` wizard público — direção, seções montadas, payload, foco; Roda da Vida — fade entre eixos se entregar.
- **Reduced motion:** contexto `reducedMotion: "reduce"` (ou `emulateMedia`) repetindo o fluxo principal de cada superfície P0 — troca instantânea, foco chega, `aria-current` correto.
- **Visual:** prints 1440×900 e 390×844 mid-transição e settled dos wizards P0 + "Combinar o plano"; evidência de DevTools Performance sem Layout/Paint por frame.
- **Regressão que deve seguir verde:** specs do wizard `/f` (REALIZA-144), `registro-rota`, `plano-em-dia`/`plano-acordo` (combinar), `pessoas`/`duplas` (dialogs de ficha), onboarding demo.
- **Mapa de regressão:** adicionar linha ao `docs/regression-map.md` ligando "etapas montadas + foco + direção nos wizards" aos specs acima.

## Riscos

- **Foco órfão como cosmético:** animar sem embutir o foco na API repete o erro atual — por isso o contrato `focoPendente`+`tituloRef` (ou equivalente) é parte do componente, não exercício por superfície.
- **Remount acidental:** "padronizar" tudo para `AnimatePresence`+`key` quebraria `FormData`, rascunho e "salvar de qualquer etapa" — a restrição de montagem por modo fica escrita no componente e vira teste.
- **Perda de personalidade do onboarding:** o `animate-rise` é a metáfora de conversa (balão que sobe). Premissa abaixo fixa a decisão; se design preferir preservar, a variante `--dir` do `rise` é o fallback documentado — mas ainda um idioma só.
- **Dois sistemas convivendo por design:** CSS no chrome, motion no conteúdo, Collapsible com height própria — resistir à tentação de unificar; a fronteira fica escrita no componente (`motion.tsx` já faz isso).
- **StrictMode/SSR:** `focoPendente` (ref + efeito) × ref-callback de mount (importadores) — escolher um só no hook; `MotionConfig` no root já evita hydration mismatch.
- **`useFecharNoVoltar`:** voltar do sistema fecha o dialog inteiro, não a etapa — documentar para não "corrigir" errado depois.
- **Repaint móvel:** tela fraca já sofreu com blur (`enter-flat`) — manter ≤8px + opacity, `bounce:0`, `will-change` just-in-time.

## Premissas

- O idioma canônico é o do `registro-form`/`WizardFicha` (montadas `hidden` + `.animate-enter-x` + `--dir` + foco pós-commit) — canoniza o que já funciona em vez de inventar um quarto idioma; **nenhuma lib nova** entra.
- **Onboardings:** a recomendação do recon é convergir para o mesmo slide direcional (a entrada da Liza/balão segue dentro do passo). Se design decidir preservar a metáfora de conversa, o `rise` ganha variante `--dir` — decisão registrada no `plan.md`; o que não se admite é um terceiro idioma sem nome nem motivo. O remount por passo deles é deliberado (FormData montado por passo, `onboarding-flow.tsx:247`) e não vira `hidden` por acidente.
- Reduced motion se resolve na camada global (guard + `MotionConfig`), nunca em media query local nem kill switch por componente — tiers: some o deslocamento, fica a mudança de estado e o foco.
- Distinção de camadas é regra de revisão: slide = navegação, crossfade = troca de estado, cascata = revelação, `data-open` = overlay. Animação fora da camada certa é bug de design, não preferência.
- Tudo front-end: zero migration, zero mudança de schema/RLS/RPC/action/payload, zero rota nova — `isPublic` intocado.
- Copy das réguas ("Passo N de M", "Seção N de M", "Pergunta N de M") segue a de cada superfície — unificação de texto não é desta spec.
