# Spec — Plano: recesso inequívoco, fusão sinalizada, checkbox do kit e copy do combinado

**Feature:** `specs/025-plano-recesso-fusao-copy` · **Status:** Clarified
**Fila:** `REALIZA-525` · **Dono:** Thiago · **Data:** 24/11/2026
**Base:** `integration/plano2` · **Recon:** `docs/planos/issues/_recon/plano-recesso-2026-11-24.md`

> Rodada de acabamento sobre as specs 017–020 já entregues. Toca superfícies e strings; **nenhuma migration, RPC ou regra de domínio muda**. O que esta spec decide de novo fica em "Premissas".

## Problema e resultado

- **Dor hoje:**
  1. O recesso pergunta "Vamos usar o recesso" sem dizer pra quê — `usa=true` significa **pausar os encontros no período** (a janela segue restrição, `plano-em-dia.ts:361-365`), mas o verbo "usar" lê os dois sentidos. Pior: o doc do combinado renderiza a decisão **invertida** — `usa===true` sai como "vocês seguem se encontrando" (`plano-roteiros.ts:259-263`), e o teste de unidade assera o mapeamento errado (`plano-roteiros.test.ts:162-175`).
  2. Toda aresta de fusão é uma linha idêntica com checkbox `accent-foreground` cru (`combinar-plano.tsx:786-803`) — juntar o 5º e o 6º (que pula a semana de prática) parece tão bom quanto juntar o 10º e o 11º.
  3. ~30 checkboxes nativas com `accent-*` em ~25 arquivos, mais ~8 no padrão `peer sr-only` + span — três gramáticas pro mesmo controle e o kit `src/components/ui` sem `Checkbox`.
  4. O contrato do "ficar em dia" fala burocratês: "coloca o combinado em vigor" repete com variações em 10+ lugares (card, banner, doc, toast, sino), com deslizes pontuais — travessão em texto exibido (`combinar-plano.tsx:777`), a palavra proibida "Ritmo" na agenda do jovem (`agenda/page.tsx:708`) e um `|| "—"` que vira nome de pessoa na fila (`sua-semana.ts:335`).
  5. Com combinado aberto, `PlanoEmDiaCard` renderiza a projeção inteira **embaixo** do `AcordosCentral`: duas listas de passos, dois quadrados, dois blocos de recesso — e a projeção pode divergir do que foi combinado (`duplas/[id]/page.tsx:1271-1293`).
  6. Na aba Encontros, Registro e Avaliação do jovem ficam lado a lado como dois disclosures independentes — o deep link `#registrar-{id}` abre os dois, mas o clique abre só um (`encontro-disclosure.tsx:41`, `encontro-row.tsx:565-691`).
- **Resultado observável:** a decisão de recesso diz o que acontece com os encontros em todas as superfícies; a fusão mostra quais pares são bons pra juntar e por quê, com critério acessível (texto, não só cor); toda checkbox de linha é o mesmo componente acessível do kit; o combinado fala a voz da casa ("pra valer", "valendo"); com plano vivo o card vira uma faixa que aponta pro combinado sem duplicar conteúdo; um clique abre os dois lados do encontro.
- **Como saberemos que funcionou:** nenhuma tela diz "usar o recesso" nem "em vigor"; o doc mostra "pausa combinada" quando `usa=true`; uma aresta ótima exibe chip "boa pra juntar" e uma neutra exibe o motivo; `accent-*` some dos inputs de checkbox fora das exceções declaradas; `#plano-em-dia`, `#acordos`, `#recesso-dupla` e `#registrar-{id}` continuam âncoras vivas.

## Fora de escopo

- Qualquer DDL, migration, RPC nova ou re-emissão: `dupla_recessos.usa` (semântica e tri-estado), `declarar_recesso`, `plano_*` e o planner (`recessoOptOut`, `fusaoDeArestas`, `marcarSessoes`, `gruposDeSessao`, `escopoDaProposta`) ficam **bit a bit iguais**. A regra de fusão desta spec só lê `META_PASSOS_PLANO`/`precondicao` no cliente.
- Caminho da Liza e `proporPlano` legado — nada de campo novo na RPC; a tool `declarar_recesso` só harmoniza a descrição (mesmo vocabulário, sem mudar schema).
- Documentos jurídicos (`src/lib/documentos/texto.ts`): "entra em vigor" é registro legal, não é slop.
- Ordem e mecânica do wizard "Combinar o plano" (perguntas, passos, confirmar) — só strings e a linha de fusão.
- Prints da Liza (ponto 7 do brief original) — outra frente.
- Redesenho de superfícies, trilha de especialista, novos deep links.

## Histórias de usuário

### US1 — Recesso diz o efeito, não o mecanismo (P1)

- **Por que P1:** é uma decisão da dupla que hoje pode ser respondida no sentido errado — e o documento do combinado já registra a decisão invertida.
- **Teste independente:** abrir a pergunta de recesso no wizard, o card standalone e o doc do combinado com `usa=true`, `usa=false` e pendente.
- **Cenários:**
  1. **Dado** um recesso na janela **quando** a pergunta abre no "Combinar o plano" **então** as opções são `Vamos pausar os encontros` e `Vamos seguir nos encontrando`, cada uma com a linha de efeito embaixo ("nenhuma data cai no período" / "as datas podem cair no período") — ninguém precisa adivinhar o que `usa` faz.
  2. **Dado** `usa=true` gravado **quando** qualquer superfície lê a decisão **então** ela diz `vão pausar os encontros` (status) ou `pausa combinada` (doc) — nunca "usar o recesso" e nunca "seguem se encontrando".
  3. **Dado** `usa=false` gravado **quando** o doc do combinado renderiza **então** diz `vocês seguem se encontrando` — o bug de inversão de `plano-roteiros.ts` está corrigido e coberto por teste.
  4. **Dado** a decisão pendente **quando** a superfície lê **então** segue `a dupla ainda não decidiu` — o tri-estado não muda.
  5. **Dado** o jovem na agenda dele **quando** o `RecessoDecisao` aparece **então** os botões são os mesmos da ficha — uma peça só alimenta ficha, agenda e aceite.

### US2 — Fusão com critério visível (P1)

- **Por que P1:** hoje toda aresta parece igual e a dupla só descobre o custo no aviso do confirmar.
- **Teste independente:** plano com passos 4–8 (prática), passo com `precondicao` e cadeia de 3.
- **Cenários:**
  1. **Dado** uma aresta `n → n+1` em que `META_PASSOS_PLANO[n].exige !== "pratica"`, `n+1` não tem `precondicao` e marcar não forma sessão de 3+ **quando** o passo "sessão" renderiza **então** a linha é verde (borda/fundo `--ok`) com o chip `boa pra juntar`.
  2. **Dado** uma aresta que cruza passo de prática **quando** renderiza **então** é neutra com o motivo `pula a semana de prática do {n}º` — e o aviso warn do confirmar continua exigindo gesto consciente.
  3. **Dado** `n+1` com `precondicao` **quando** renderiza **então** é neutra com `o {n+1}º pede "{precondicao}" antes`.
  4. **Dado** marcação que fecha sessão de 3+ encontros **quando** a cadeia existe **então** as arestas da cadeia mostram `sessão com {N} encontros` (ou `forma uma sessão com {N} encontros` antes de marcar) — neutras, nunca bloqueadas.
  5. **Dado** qualquer aresta **quando** a tela carrega **então** nada nasce marcado e o estado nunca depende só de cor — chip e motivo são texto lido por leitor de tela.

### US3 — Uma checkbox só, acessível (P1)

- **Por que P1:** três gramáticas pro mesmo controle e a nativa `accent-*` é a cara do default que a casa não tem.
- **Teste independente:** percorrer de Tab as listas do combinar plano, registro e combinados, acionando com Espaço.
- **Cenários:**
  1. **Dado** `src/components/ui/checkbox.tsx` **quando** importado **então** provê `Checkbox` (sobre `@base-ui/react/checkbox`) e `CheckboxLinha` (rótulo + caixa + conteúdo livre, alvo ≥44px) — participa de form nativo via input escondido.
  2. **Dado** qualquer superfície migrada **quando** renderiza **então** mostra checked/indeterminate/disabled/foco visível/`aria-invalid` conforme o caso — inclusive o "selecionar todos" de `pessoa-actions`/`formulario-builder`.
  3. **Dado** o form público `/f/[token]` **quando** submete **então** `name`/`value` seguem no payload — coberto pelo e2e do token.
  4. **Dado** `material-documento`, `CaixaSelecao` e `filtro-opcoes` **quando** a migração termina **então** ficam como estão — exceções declaradas (affordance de documento/impressão, card de onboarding e chip de filtro, não checkbox de linha).

### US4 — O combinado fala a voz da casa (P1)

- **Por que P1:** "em vigor" é burocratês repetido em 10+ superfícies; a casa fala "vale", "pra valer", "valendo".
- **Teste independente:** ler card, banner, doc, toast e sino nos estados proposto/aceito/ativo/contestado.
- **Cenários:**
  1. **Dado** qualquer string da família "em vigor" na UI **quando** a PR fecha **então** usa a família "valer" do inventário — uma voz só, sem sinônimo improvisado.
  2. **Dado** as superfícies tocadas **quando** revisadas **então** não há travessão em texto exibido e "Ritmo" não aparece na agenda do jovem.
  3. **Dado** um nome vazio na fila "O que precisa de você" **quando** renderiza **então** a linha não mostra "—" como se fosse pessoa.

### US5 — Card "Para ficar em dia" vira faixa com combinado aberto (P1)

- **Por que P1:** duas listas de passos e dois quadrados na mesma ficha é bug de leitura; sumir o card quebra a âncora do e-mail.
- **Teste independente:** dupla com plano `proposto` abrindo a ficha; depois contestar e ver o card voltar inteiro.
- **Cenários:**
  1. **Dado** `planoVivo` na ficha **quando** `PlanoEmDiaCard` renderiza **então** mostra faixa: cabeçalho (título + pill + "{n} encontros pra repor" + "Como o plano calcula"), "Falta N decisões" quando há, CTA `Ver o combinado` → `#acordos`, e os conteúdos exclusivos (recessos read-only, "Antes de seguir o plano") — sem lista de passos, sem `QuadradosPlano`, sem a lista de avisos.
  2. **Dado** projeção feliz com plano vivo **quando** renderiza **então** a headline "Em dia em {data}" **não** aparece — a data real é a do combinado; headline de alerta ("Não fecha até o encerramento", estado conversa) segue visível porque o combinado não a carrega.
  3. **Dado** o e-mail `…#plano-em-dia` ou a fila `…#recesso-dupla` **quando** abre **então** a âncora existe — a faixa e o bloco de recesso montam nos mesmos ids.
  4. **Dado** o combinado contestado **quando** `planoVivo` some **então** o card volta ao estado completo — a faixa é derivada de `planoVivo`, nunca de estado próprio.

### US6 — Os dois lados do encontro abrem juntos (P2)

- **Por que P2:** conveniência real na leitura (registro e avaliação são uma peça), mas não bloqueia tarefa.
- **Teste independente:** clicar no disclosure de Registro e conferir a Avaliação abrindo junto; repetir via `#registrar-{id}`.
- **Cenários:**
  1. **Dado** um encontro com registro e avaliação **quando** clica em qualquer um dos triggers **então** os dois disclosures abrem; clicar de novo fecha os dois.
  2. **Dado** `#registrar-{id}` na URL **quando** a ficha monta **então** os dois lados abrem — o deep link segue mandando como hoje, inclusive depois de cliques locais (o hash novo devolve o controle ao hash).
  3. **Dado** encontro com um lado só (registro sem avaliação) **quando** clica **então** o disclosure único funciona igual.

## Casos de borda

- Recesso já decidido antes da PR: só o texto muda — o dado e o tri-estado não tocam; versões antigas do doc re-renderizam com a copy certa (a montagem é determinística, não snapshot) — o bug de inversão se corrige retroativamente, que é o desejado.
- Dois recessos na janela: cada pergunta ganha o mesmo par de opções e linhas de efeito, como hoje.
- Aresta ótima marcada que depois vira cadeia de 3+: o estado é derivado da seleção corrente — a aresta fica neutra com o motivo de sessão, sem prender a escolha anterior.
- Passo travado não é aresta (régua atual); `META[16]` tem `precondicao` mas não tem `n+1` — nunca vira linha.
- `conversa` + `planoVivo`: combinação rara; a faixa mostra a headline de alerta e o "Falar com a coordenação" — honesta sobre a projeção que não fecha.
- `planoVivo` + recesso todo decidido: o bloco `#recesso-dupla` segue montando (a âncora não pode sumir com o standalone fora da tela).
- Checkbox `indeterminate` real ("selecionar todos" com filhos parciais): o primitive expõe o estado; a UI mostra o traço, não o check.
- Migration `0218` tem comentário "vamos usar o recesso" no SQL — **arquivo aplicado não se edita**; só os comentários vivos em `src/` atualizam na mesma PR.

## Requisitos funcionais

- **FR-001:** as opções de recesso dizem o efeito: `Vamos pausar os encontros` (`usa=true`) / `Vamos seguir nos encontrando` (`usa=false`), com linha de efeito `nenhuma data cai no período` / `as datas podem cair no período` na pill do wizard. Status `vão pausar os encontros` / `seguem se encontrando` / `a dupla ainda não decidiu`. Descrições alinham verbos (`pausam os encontros ou seguem se encontrando`). Superfícies: `combinar-plano.tsx` (pergunta + status + confirmar), `recesso-dupla-card.tsx` (`RecessoDecisao` alimenta card standalone, agenda do jovem, bloco no `PlanoEmDiaCard` e repensar no aceite), `plano-roteiros.ts` (doc), fila sua-semana (rótulo "recesso sem decisão da dupla" e CTA "Ver o recesso" já estão certos).
- **FR-002:** `montarDocCombinado` renderiza `usa===true` → `pausa combinada` e `usa===false` → `vocês seguem se encontrando` — hoje renderiza invertido; o teste que assera a inversão é corrigido na mesma PR.
- **FR-003:** cada aresta de fusão recebe estado derivado por função pura no domínio (ex.: `estadoArestaFusao` em `plano-em-dia.ts`): **ótima** quando `META_PASSOS_PLANO[n].exige !== "pratica"`, passo `n+1` sem `precondicao` e a seleção corrente + a aresta não fecha sessão de 3+; **neutra** com motivo nos demais casos. Ótima = borda/fundo `--ok` + chip `boa pra juntar` (gramática do chip "sugerido" do ritmo); neutra = visual default + motivo em texto. Nada nasce marcado; neutra segue clicável; o aviso de prática do confirmar segue igual.
- **FR-004:** `src/components/ui/checkbox.tsx` exporta `Checkbox` (`CheckboxPrimitive.Root` + `Indicator` + `Check` phosphor, input escondido pra form) e `CheckboxLinha` (`<label>` `flex items-start gap-3 min-h-11 cursor-pointer` + caixa + conteúdo livre). Tokens: não-marcada `border-muted-foreground/40` (hover `border-foreground`); marcada `border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]`; prop `tom="warn"` pros usos `accent-[var(--warn)]` ("Preciso de apoio/ajuda"); foco `focus-visible:ring-3 ring-ring/50` no Root; `disabled` `opacity-60`; `indeterminate` com traço; `name`/`value`/`required`/`aria-invalid`/`aria-describedby` repassados. Migração: padrão B inteiro (lista do recon §3) + consolidação do padrão A no mesmo componente; a linha de fusão (`combinar-plano.tsx`) migra junto com o tratamento verde/neutro. Recomendado: regra de lint ou item do `pnpm guard` proibindo `type="checkbox"` fora do kit + exceções nomeadas.
- **FR-005:** a família "em vigor" sai da UI conforme o inventário da seção Copy final — "põe o combinado pra valer", "valendo", "vale", "não vale mais". Zero travessão em texto exibido nas superfícies tocadas; "Ritmo" sai da agenda do jovem; `primeiro()`/`nomes` em `sua-semana.ts` não rendem "—". Comentários de código que citam os rótulos velhos (`recesso-dupla-card.tsx:10`, `types.ts:548`, `actions-recesso.ts:8`, `queries-jovem.ts:422`, `ia/tools.ts`) atualizam na mesma PR.
- **FR-006:** `PlanoEmDiaCard` com `planoVivo` renderiza a faixa do US5 — conteúdo de projeção que duplica o combinado (lista de passos, quadrados, avisos, headline feliz) não monta; conteúdo exclusivo (alerta de não-fechamento/conversa, "Falta N decisões", recessos, "Antes de seguir o plano", CTA "Ver o combinado") permanece; ids `plano-em-dia` e `recesso-dupla` continuam na faixa.
- **FR-007:** `EncontroDisclosure` aceita `open`/`onOpenChange` opcionais (controlado quando presentes, interno quando não); `EncontroRow` segura `forcado` + `hashBate` por encontro e alimenta os disclosures existentes — um gesto abre/fecha os dois; o reset em `hashchange`/`realiza:hash` migra pra row; o comentário da invariante no componente atualiza na mesma PR.

## Copy final — inventário (atual → proposta)

### Recesso

| Onde | Atual | Proposta |
|---|---|---|
| `combinar-plano.tsx:579` (pill) | `Vamos usar o recesso` | `Vamos pausar os encontros` + meta `nenhuma data cai no período` |
| `combinar-plano.tsx:591` (pill) | `Vamos seguir nos encontrando` | manter + meta `as datas podem cair no período` |
| `combinar-plano.tsx:537,874` · `recesso-dupla-card.tsx:151` (status) | `vão usar o recesso` | `vão pausar os encontros` |
| `recesso-dupla-card.tsx:175,187` (botões) | `Vamos usar o recesso` / `Vamos seguir nos encontrando` | `Vamos pausar os encontros` / `Vamos seguir nos encontrando` |
| `combinar-plano.tsx:556` (desc) | `…se param ou seguem se encontrando em cada período…` | `…se pausam os encontros ou seguem se encontrando em cada período…` |
| `recesso-dupla-card.tsx:88` · `plano-em-dia-card.tsx:380` · `agenda/page.tsx:637` | `se param ou seguem se encontrando` | `se pausam os encontros ou seguem se encontrando` |
| `plano-roteiros.ts:259-263` (doc) | `usa===true` → `vocês seguem se encontrando` (invertido) | `usa===true` → `pausa combinada`; `usa===false` → `vocês seguem se encontrando` |
| Comentários (`types.ts:548`, `actions-recesso.ts:8`, `queries-jovem.ts:422`, `recesso-dupla-card.tsx:10`, `ia/tools.ts:2383,2397`) | `usa=true "vamos usar o recesso"` | `usa=true = os encontros pausam no período` |

### Fusão

| Onde | Atual | Proposta |
|---|---|---|
| `combinar-plano.tsx:777-779` (desc do passo) | `…sessão de 2h — um dia a menos no calendário. É escolha de vocês: sem juntar…` (travessão) | `Encontros vizinhos podem sair juntos numa sessão de 2h, um dia a menos no calendário. Sem juntar, cada encontro segue no seu dia.` |
| linha da aresta | `Juntar o {n}º e o {n+1}º na mesma sessão` | manter o rótulo; adicionar chip/motivo |
| aresta ótima | (nada) | chip `boa pra juntar` |
| aresta com prática | (nada) | `pula a semana de prática do {n}º` |
| `n+1` com `precondicao` | (nada) | `o {n+1}º pede "{precondicao}" antes` |
| cadeia 3+ | (nada) | marcada: `sessão com {N} encontros`; ao marcar: `forma uma sessão com {N} encontros` |

### Combinado ("em vigor" → família "valer")

| Onde | Atual | Proposta |
|---|---|---|
| `plano-acordos.tsx:389-391` | `…Um aceite da dupla já coloca o combinado em vigor; o outro lado é avisado.` | `…Um aceite da dupla põe o combinado pra valer. O outro lado recebe o aviso.` |
| `plano-acordos.tsx:394-397` | `Você já respondeu. Um aceite da dupla já coloca o combinado em vigor.` | `Você já respondeu. Um aceite da dupla põe o combinado pra valer.` |
| `plano-acordos.tsx:669` | `O combinado está em vigor. Se algo mudou…` | `O combinado vale. Se algo mudou…` |
| `plano-acordos.tsx:177` (pill) · `plano-em-dia-pecas.tsx:217` (pill) | `Em vigor` / `Plano em vigor` | `Valendo` / `Plano valendo` |
| `plano-acordos.tsx:215` (toast) | `Versão recalculada já está em vigor.` | `Versão recalculada já vale.` |
| `plano-em-dia-pecas.tsx:202,210` | `…já coloca o combinado em vigor; …` | `…põe o combinado pra valer; …` |
| `combinar-plano.tsx:413` (toast) | `Combinado em vigor. O outro lado foi avisado.` | `Combinado valendo. O outro lado foi avisado.` |
| `combinar-plano.tsx:1052` | `Já existe um combinado em vigor pra essa dupla.` | `Já existe um combinado valendo pra essa dupla.` |
| `plano-roteiros.ts:161` (STATUS_DOC) | `…pra entrar em vigor` | `…pra valer` |
| `plano-roteiros.ts:273` | `Um aceite da dupla coloca o combinado em vigor e avisa o outro lado.` | `Um aceite da dupla põe o combinado pra valer e avisa o outro lado.` |
| `plano-roteiros.ts:274` | `Se não servir, a contestação encerra esta versão. Um acordo novo nasce como versão nova.` | `Se não servir, contestar encerra esta versão. Um combinado novo pode nascer como versão nova.` |
| `plano-roteiros.ts:275` | `O combinado só vale depois do aceite, mesmo com encontro já marcado.` | `Mesmo com encontro marcado, o combinado só vale depois do aceite.` |
| `plano-roteiros.ts:279` | `O combinado vale enquanto a dupla seguir nele. Pra mudar, nasce uma versão nova.` | `O combinado vale enquanto vocês seguem nele. Pra mudar, vocês combinam uma versão nova.` |
| `plano-roteiros.ts:280` | `Os roteiros das semanas nascem a partir deste combinado.` | `Os roteiros das semanas saem deste combinado.` |
| `plano-roteiros.ts:285` | `Esta versão não está mais em vigor. Um acordo novo nasce como versão nova.` | `Esta versão não vale mais. Um combinado novo pode nascer como versão nova.` |
| `notificar.ts:91-92` | `Plano "ficar em dia" em vigor` · `Ele já está em vigor; veja as datas combinadas.` | `Plano "ficar em dia" valendo` · `{nome} combinou o plano. Já vale; veja as datas combinadas.` |
| `actions-roteiros.ts:75` (erro) | `Essa dupla não tem um combinado em vigor.` | `Essa dupla não tem um combinado valendo.` |
| `ia/tools.ts:854,906` (desc da tool) | `coloca o plano em vigor` | `põe o plano pra valer` (harmonização barata, mesma voz) |
| `agenda/page.tsx:707-710` | `…ficar em dia. Ritmo, recesso e dias livres viram uma pergunta por vez.` | `Atrasaram? Vocês podem combinar um plano pra ficar em dia. A proposta sai respondendo uma pergunta por vez.` |
| `sua-semana.ts:335` | `(nome ?? "").split(" ")[0] \|\| "—"` | `primeiro` devolve `""`; `nomes` junta só os lados com nome — "—" nunca vira pessoa |

Mantidas de propósito (já estão na voz): `pausa combinada`, `decisão pendente`, `a dupla ainda não decidiu`, `a proposta foi aceita: vale como combinado`, `Encontro feito é feito…`, `Uma pergunta por vez. O combinado só sai no último passo.`, `Falta um aceite da dupla`, `Não serve pra mim`, `Combinado contestado. A equipe foi avisada.`, `recesso sem decisão da dupla`, `Ver o recesso`, `Tem um combinado pra você no Realiza` (e-mail).

## Requisitos não funcionais

- **RLS/RPC:** zero mudança — nenhuma policy, RPC ou leitura escopada toca. Autorização segue no banco como está.
- **A11y:** checkbox do kit é botão real focável (Tab/Espaço de graça, `focus-visible` visível); alvo ≥44px por linha-rótulo; estado de fusão nunca só por cor (chip/motivo são texto); o `role="status"`/`aria-live` da projeção segue; movimento coberto pelo guard global de `prefers-reduced-motion` (`globals.css:865`) — `confirm-pop`/`confirm-draw` só onde a gramática já existe (check desta sessão), sem media query por componente.
- **Copy:** pt-BR, sem travessão em texto exibido (inclusive em `src/lib` e doc montado), "combinado" como substantivo, família "valer" única, segunda pessoa "vocês" no gesto e "a dupla" na leitura de staff.
- **LGPD:** nenhum dado novo.
- **Demo:** o dataset já cobre os estados (recesso decidido `d-ok`, pendente `d-pend`, plano vivo); os e2e demo que asseram rótulos velhos são atualizados, não contornados.
- **Perf:** a regra da aresta é O(arestas) no cliente com dados já carregados — sem chamada nova.

## Entidades e dados

- **Sem DDL.** `dupla_recessos.usa`, `dupla_planos.escopo`, `META_PASSOS_PLANO`, `precondicao` e o estado dos disclosures são lidos, não alterados.
- Estado novo de fusão é derivado: `{ tom: "otima" | "neutra"; motivo: string | null }` por aresta, calculado de `META_PASSOS_PLANO` + `passos[].precondicao` + `fusaoDeArestas(seleção ∪ {n})` — vive no módulo puro pra UI e teste lerem a mesma régua.
- Estado novo do card é derivado de `planoVivo` (já calculado na ficha) — nada de estado persistido.
- Estado novo do disclosure é `forcado ?? hashBate` na row — o que era por componente vira por encontro.

## Critérios de sucesso

- **SC-001:** unit: regra da aresta cobre os 4 casos (ótima, prática, precondição, cadeia 3+ marcada e a-marcar); `montarDocCombinado` mapeia `usa=true→"pausa combinada"` e `usa=false→"seguem se encontrando"`; `fraseDoCombinado`/STATUS_DOC/toasts rendem a família "valer"; `primeiro()` não produz "—".
- **SC-002:** e2e app: mentor declara recesso pelos novos rótulos e o jovem lê/decide na agenda; passo "sessão" mostra aresta verde com chip e neutra com motivo (e o aviso warn segue no confirmar); disclosures abrem/fecham juntos com clique e com `#registrar-{id}`; ficha com plano vivo mostra faixa sem lista/quadrados duplicados e com as âncoras vivas; teclado marca checkbox no wizard (Tab + Espaço).
- **SC-003:** e2e demo: `plano-em-dia.spec.ts` e `sua-semana.spec.ts` atualizadas pros rótulos novos, verdes; form público submete `name`/`value` com a checkbox migrada.
- **SC-004:** prints 1440×900 e 390×844: pergunta de recesso (par de opções + linhas de efeito), passo de sessão (verde + neutras com motivos), faixa do card com plano vivo, disclosures abertos.
- **SC-005:** `pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard` verdes; zero `type="checkbox"` com `accent-*` fora das exceções declaradas.

## Plano de testes

- **Unit (Vitest, prioridade):** `estadoArestaFusao` (ou equivalente) nos 4 casos + cadeia evoluindo com a seleção; `montarDocCombinado` recesso nas duas direções + pendente + bloco "Como vale" com strings novas; `fraseDoCombinado` nos estados que mudam; `primeiro()`/`nomes` sem "—"; render do `Checkbox`/`CheckboxLinha` (checked, indeterminate, disabled, `aria-invalid`, name/value no form).
- **E2E app:** os cenários do SC-002; form público `/f/[token]` submetendo checkbox; papel negado segue igual (nenhuma permissão mudou — sem caso novo).
- **E2E demo:** `d-ok` lê `vão pausar os encontros` + autoria; `d-pend` monta `#recesso-dupla` e staff não ganha botão; faixa com combinado aberto na `d-pend`.
- **Visual:** os prints do SC-004 no PR.
- **Regressão a reescrever na mesma PR:** `plano-roteiros.test.ts:162-175` (assera a inversão — o teste estava errado junto com o código); `plano-combinado.test.ts`/`plano2-auditoria.test.ts` onde espera "em vigor"/pill velha; `tests/e2e/demo/plano-em-dia.spec.ts:157,174` e `sua-semana.spec.ts:118` (rótulos de recesso); qualquer expectativa de "Combinado em vigor"/"Um aceite…em vigor".

## Riscos

- `Vamos pausar os encontros` pode ler como "pausar a dupla" — mitigado pela linha de efeito e pela descrição alinhada; "pausa" já é a palavra do doc (`pausa combinada`) e do status.
- Verde lido como "resposta certa" — o chip diz `boa pra juntar`, nada nasce marcado e neutra segue clicável; aviso de prática continua exigindo gesto.
- Faixa esconder conteúdo — mitigado mantendo todos os blocos exclusivos (recesso, pendências, alerta de não-fechamento) e os dois ids de âncora; o que sai é só o que duplica o combinado.
- Sync dos disclosures quebrar o deep link — o reset por `realiza:hash`/`hashchange` migra pra row na mesma mudança, coberto por e2e.
- Checkbox em form público perder `name`/`value` — o primitive emite input escondido; e2e do token cobre.
- `material-documento` virar exceção eterna — declarada como affordance de documento/impressão (sem form, com `print:`), revisitável se virar controle de dados.
- Trocar "em vigor" por "valer" e escorregar noutro sinônimo — a família é fechada na seção Copy final; qualquer variante nova é achado de revisão.

## Premissas

- **Rótulo do recesso:** `Vamos pausar os encontros` (venceu "Vamos parar no recesso"/"Vamos tirar o recesso") — diz o efeito, casa com `pausa combinada` do doc e com a descrição "pausam ou seguem". O par fica `pausar`/`seguir`.
- **"Ótimo" completo:** prática + precondição + cadeia 3+ (os três sinais já existem no cliente); a alternativa "só prática" perdeu por deixar pré-condição e sessão gigante parecerem iguais ao ótimo.
- **Card vira faixa (não some):** preserva `#plano-em-dia` (link do e-mail), `#recesso-dupla` (link da fila), "Antes de seguir o plano" e o recesso pendente — sem replantar conteúdo nem tocar template de e-mail.
- **Disclosures simétricos:** abrir abre os dois, fechar fecha os dois — o hash já trata o par como peça única; estado controlado na row, não contexto.
- **Exceções do checkbox:** `material-documento` (affordance de doc/impressão), `CaixaSelecao` (card de onboarding) e `filtro-opcoes` (chip de filtro) não migram — declarado aqui pra não reabrir no fix.
- **Família "valer":** "em vigor" sai de toda a UI; jurídico fica. Se o lead preferir outro verbo, a troca cobre a família inteira — nunca metade.
