# Recon — plano "ficar em dia": recesso, fusão, checkbox, copy e cards

Data: 24/11/2026. Base: `integration/plano2` @ `aecb135e`. Recon-only: nada de código, migration, push ou PR. Insumo pra rodada de fix dos pontos 1–6 do brief (o ponto 7 — prints da Liza — fica pra outra frente).

## 1. Resumo executivo

- **Recesso (ponto 1):** a ambiguidade é real e mora num verbo só. `usa=true` significa **pausa** (o recesso é restrição no calendário), mas a opção diz "Vamos usar o recesso" — "usar pra quê" não está na tela. A pergunta de apoio já fala "param ou seguem se encontrando"; as opções não fecham com ela. Correção é só de strings em 4 superfícies (wizard, card standalone, status inline, doc do combinado). Sem migração: `dupla_recessos.usa` não muda de semântica.
- **Fusão (ponto 2):** hoje toda aresta marcável é visualmente igual (`combinar-plano.tsx:786-803`) — uma linha "Juntar o Nº e o N+1º na mesma sessão" com checkbox `accent-foreground` cru. O sinal pra separar "ótimo" de "neutro" já existe: `META_PASSOS_PLANO[*].exige === "pratica"` nos passos 4–8 e `fusaoPedeAvisoPratica` (`plano-em-dia.ts:862-869`) já calculam quais grupos pulam a semana de prática. Falta a UI usar isso por aresta e com texto, nunca só cor.
- **Checkbox (ponto 3):** ~43 `input[type="checkbox"]` em ~28 arquivos, em três padrões: (a) `peer sr-only` + span estilizado (já custom e acessível, ~8 usos), (b) nativo cru com `accent-*` (~30 usos — o "default que irrita"), (c) `CaixaSelecao` (base-ui Checkbox, mas é card de onboarding, não checkbox de linha). O kit `src/components/ui` não tem `Checkbox` — a peça a criar. `@base-ui/react` já é dependência e já provê o primitive.
- **Copy geral (ponto 4):** o núcleo está em boa voz ("Para ficar em dia", "encontros pra repor"). O slop concentra em três lugares: frases de efeito repetidas ao pé do combinado ("Um aceite da dupla coloca o combinado em vigor…" ×3 arquivos), o bloco "Como vale" do doc do combinado (`plano-roteiros.ts:269-291`) e deslizes pontuais — travessão em texto exibido (`combinar-plano.tsx:777`, proibido por `conventions-ui.md`), a palavra proibida "Ritmo" na agenda do jovem (`agenda/page.tsx:708`), e um fallback `"—"` que vira nome de pessoa (`sua-semana.ts:335`).
- **Card duplicado (ponto 5):** `mostrarPlanoEmDia` (`duplas/[id]/page.tsx:488-492`) não depende de `planoVivoFicha`. Depois de propor, o card de projeção inteiro segue na tela e o combinado real renderiza embaixo via `AcordosCentral` — lista de passos, quadrados e bloco de recesso aparecem duas vezes, e a projeção pode divergir do que foi combinado. O código já admite o conflito (o CTA vira "Ver o combinado" apontando pra `#acordos`) mas não resolve a duplicação.
- **Expandir os dois lados (ponto 6):** na aba Encontros, cada card tem dois `EncontroDisclosure` lado a lado (`lg:grid-cols-2`, `encontro-row.tsx:566-691`): Registro (esquerda) e Avaliação do jovem (direita). O hash `#registrar-{id}` já abre os dois juntos; o clique abre só o clicado (`forcado` é estado por componente, `encontro-disclosure.tsx:41`). A sincronização pedida é uma decisão de estado, não de layout.

## 2. Inventário de strings/copy (atual → problema → proposta)

Voz da casa (referência: `conventions-ui.md` §Copy e spec 017 §Copy): pt-BR, sem travessão em texto exibido, sem jargão ("ritmo" vira "encontros por semana"), "combinado" como substantivo, frases curtas, segunda pessoa "vocês" no gesto e "a dupla" na leitura de staff. Propostas abaixo são candidatas — a decisão final é do fix.

### 2.1 Recesso (ponto 1)

| Onde | Atual | Problema | Proposta |
|---|---|---|---|
| `combinar-plano.tsx:579` (pill) | `Vamos usar o recesso` | "Usar" não diz pra quê — lê-se tanto "usar o período pros encontros" quanto "tirar o recesso". O efeito real: `usa=true` = encontros **param** no período | `Vamos pausar os encontros` (alternativas: `Vamos parar no recesso`, `Vamos tirar o recesso`) |
| `combinar-plano.tsx:591` (pill) | `Vamos seguir nos encontrando` | OK — já diz o efeito | manter (opcional: `Vamos seguir nos encontrando no período` pra simetria) |
| `recesso-dupla-card.tsx:175,187` | mesmos dois botões | idem | espelhar o par escolhido |
| `recesso-dupla-card.tsx:151` · `combinar-plano.tsx:537,874` | `vão usar o recesso` | mesmo verbo ambíguo no status | `vão pausar os encontros` |
| mesmas linhas | `seguem se encontrando` | OK | manter |
| mesmas linhas | `a dupla ainda não decidiu` | OK (tri-estado honesto) | manter |
| `plano-roteiros.ts:262` (doc) | `pausa combinada` | OK — já é o rótulo claro | manter |
| `combinar-plano.tsx:556` (desc do passo) | `Vocês decidem se param ou seguem se encontrando em cada período. Qualquer um dos dois pode responder pela dupla.` | boa — é ela quem carrega a explicação que as opções deviam carregar | manter; com opções novas, alinhar verbos ("param"/"seguem") |
| `recesso-dupla-card.tsx:88` | `Vocês combinam juntos se param ou seguem se encontrando. Qualquer um dos dois pode responder pela dupla.` | OK | manter |
| `plano-em-dia-card.tsx:380` | `Vocês decidem se param ou seguem se encontrando. A resposta entra no Combinar o plano.` | OK | manter |
| `sua-semana.ts:194-196,422-426` | motivo `recesso sem decisão da dupla` → CTA `Ver o recesso` | OK | manter |
| `plano-em-dia-card.tsx:189-215` | `Se vocês seguirem se encontrando no recesso, {ritmo} já basta…` | OK — já amarra a decisão ao efeito | manter |

### 2.2 Combinado / "contrato de ficar em dia" (ponto 4)

| Onde | Atual | Problema | Proposta |
|---|---|---|---|
| `plano-acordos.tsx:389-391` | `{equipe} propôs esse plano. Um aceite da dupla já coloca o combinado em vigor; o outro lado é avisado.` | "coloca em vigor" é burocratês; repete 3× com variantes | staff: `Um aceite da dupla já põe o combinado pra valer. O outro lado recebe o aviso.` |
| `plano-acordos.tsx:394-397` | `Você já respondeu. Um aceite da dupla já coloca o combinado em vigor.` | idem | `Você já respondeu. Um aceite da dupla põe o combinado pra valer.` |
| `plano-roteiros.ts:273` (doc "Como vale") | `Um aceite da dupla coloca o combinado em vigor e avisa o outro lado.` | idem | `Um aceite da dupla põe o combinado pra valer e avisa o outro lado.` |
| `plano-roteiros.ts:274` | `Se não servir, a contestação encerra esta versão. Um acordo novo nasce como versão nova.` | nominalizado ("a contestação"), "nasce" duplicado | `Se não servir, contestar encerra esta versão. Um combinado novo pode nascer como versão nova.` |
| `plano-roteiros.ts:275` | `O combinado só vale depois do aceite, mesmo com encontro já marcado.` | OK, denso | manter |
| `plano-roteiros.ts:279` | `O combinado vale enquanto a dupla seguir nele. Pra mudar, nasce uma versão nova.` | sujeito some ("nasce") | `O combinado vale enquanto vocês seguem nele. Pra mudar, vocês combinam uma versão nova.` |
| `plano-roteiros.ts:280` | `Os roteiros das semanas nascem a partir deste combinado.` | OK | `Os roteiros de cada semana saem deste combinado.` (opcional) |
| `plano-roteiros.ts:281` | `Encontro feito é feito: versão nova não desmarca o que já aconteceu.` | boa — curta e concreta | manter |
| `plano-roteiros.ts:285` | `Esta versão não está mais em vigor. Um acordo novo nasce como versão nova.` | "em vigor" + "nasce" | `Esta versão não vale mais. Um combinado novo pode nascer como versão nova.` |
| `plano-roteiros.ts:161-166` (frases de status do doc) | `a proposta espera um aceite da dupla pra entrar em vigor` / `a proposta foi aceita: vale como combinado` / etc. | "entrar em vigor" burocrático | `a proposta espera um aceite da dupla pra valer` / `a proposta foi aceita: já vale como combinado` |
| `plano-acordos.tsx:177` (pill) | `Proposto, falta um aceite da dupla` | OK | manter (ou `Falta um aceite da dupla` se quiser encurtar) |
| `(jovem)/jovem/agenda/page.tsx:707-710` | `Atrasaram? Vocês podem combinar um plano pra ficar em dia. Ritmo, recesso e dias livres viram uma pergunta por vez.` | "Ritmo" é palavra proibida na UI (spec 017 §Copy) e "viram uma pergunta por vez" é slop | `Atrasaram? Vocês podem combinar um plano pra ficar em dia. Vocês respondem uma pergunta por vez.` |
| `combinar-plano.tsx:777-779` | `Encontros vizinhos podem sair juntos numa sessão de 2h — um dia a menos no calendário. É escolha de vocês: sem juntar, cada encontro segue no seu dia.` | **travessão em texto exibido** (proibido) | `Encontros vizinhos podem sair juntos numa sessão de 2h. É um dia a menos no calendário. Escolha de vocês: sem juntar, cada encontro segue no seu dia.` |
| `combinar-plano.tsx:1183-1185,1203` | `Uma pergunta por vez. O combinado só sai no último passo.` | OK — "sai" é da casa | manter |
| `plano-contestar.tsx` | `Não serve pra mim` → toast `Combinado contestado. A equipe foi avisada.` | OK, direto | manter |
| `plano-acordos.tsx:215` | toast `Versão recalculada já está em vigor.` | "em vigor" | `Versão recalculada já vale.` |
| `actions-plano.ts:84-85` (e-mail) | `Tem um combinado pra você no Realiza.` | OK | manter |
| `sua-semana.ts:335` | `(nome ?? "").split(" ")[0] \|\| "—"` | o travessão vira **nome de pessoa** quando o nome vem vazio | resolver o dado (fallback `""`/`você`), não exibir "—" |
| `combinar-plano.tsx:865` | `{n} encontros no plano. De {a} a {b}.` | OK | manter |
| `plano-acordos.tsx` (linhas de passo) | `sugestão {dia} às {hora}` + `[Confirmar]` `[Outra data]`; sessão: `Marcar sessão` | OK — já testado na 482 | manter |

## 3. Achados por ponto

### Ponto 1 — copy do recesso

**Fatos.** A decisão é tri-estado (518): sem row em `dupla_recessos` = pendente; `usa=true` = "vamos usar o recesso" = a janela segue **restrição** (pausa — planner não sugere datas dentro); `usa=false` = seguem se encontrando e datas podem cair na janela (`plano-em-dia.ts:361-388`, spec 017 FR-005). A pergunta aparece em: wizard "Combinar o plano" (`combinar-plano.tsx:508-599`), card standalone `RecessoDuplaCard` (`recesso-dupla-card.tsx`), agenda do jovem (`agenda/page.tsx:620-649`, reusa `RecessoDecisao`), bloco read-only dentro de `PlanoEmDiaCard` (`plano-em-dia-card.tsx:369-393`), repensar no aceite (`plano-acordos.tsx` via `RecessoDecisao`) e doc do combinado (`plano-roteiros.ts:253-263`).

**Opções.** (a) Renomear só o rótulo ambíguo: "Vamos usar o recesso" → "Vamos pausar os encontros" (minimamente invasivo, 4 arquivos de copy). (b) Re-enquadrar a pergunta: legend vira "O que vocês fazem no {título}?" e opções "Pausamos os encontros" / "Seguimos nos encontrando". (c) Manter rótulo + linha de efeito por opção ("as datas pulam o período" / "as datas podem cair no período").

**Recomendação:** (a) + a linha de efeito de (c) sob cada opção. O par "pausar os encontros / seguir nos encontrando" já fecha com a descrição existente ("param ou seguem") e diz exatamente o que acontece com os encontros. Renomear o status correspondente ("vão pausar os encontros") e conferir `plano-roteiros.ts` ("pausa combinada" já está certa — a propósito, é prova de que "pausa" é a palavra da casa pra `usa=true`).

### Ponto 2 — fusão verde/neutro

**Fatos.** Arestas candidatas = pares adjacentes de passos agendáveis do plano (`arestasFusao` em `combinar-plano.tsx`; grupos via `fusaoDeArestas`, `plano-em-dia.ts:874-888`). Sinais disponíveis por aresta `n → n+1`: `META_PASSOS_PLANO[n].exige === "pratica"` (passos 4–8 pedem semana de prática antes do próximo — a aresta pula essa semana; já dispara `avisoPratica` quando o grupo cruza), `passo.precondicao` no `n+1` (ex.: "Roda da Vida respondida" — fundir puxa a pré-condição pra antes da sessão) e tamanho do grupo resultante (arestas em cadeia formam sessão de 3+). Spec 018: juntar 2 adjacentes em 2h é o default; qualquer outra combinação é **avisada, nunca bloqueada**.

**Recomendação:** ver §4 — aresta `n` é **verde** quando `META[n].exige !== "pratica"`, `n+1` não tem `precondicao` e a marcação não forma sessão de 3+; **neutra** nos demais casos, sempre com o motivo em texto. Verde ≠ "certo": é "boa pra juntar"; neutro continua clicável.

### Ponto 3 — checkboxes

**Fatos.** Inventário completo (~43 ocorrências em ~28 arquivos):

- **Padrão A — já custom acessível** (`input.peer.sr-only` + span com check SVG e `peer-focus-visible` ring): `encaminhamentos-list.tsx:149`, `combinados-encontro.tsx:343`, `combinado-check.tsx:44`, `jovem-combinados.tsx:70`, `assistente-blocos.tsx:521`, `chamada-formacao.tsx:145`, `enviar-email-dialog.tsx:186`, `filtro-opcoes.tsx:71` (chip de filtro).
- **Padrão B — nativo `accent-*`** (o "default que irrita"): `combinar-plano.tsx:799` (`accent-foreground`, é a checkbox do print), `registro-form.tsx:1028,1076,1212` (+2), `avaliacao-encontro-form.tsx:325,365,384`, `instrumentos/campos.tsx:441,473`, `campos-pessoais.tsx:493`, `pessoa-actions.tsx:254,258,321`, `pessoas-dialogs.tsx:332`, `terceiros-dupla.tsx:705`, `remanejar-dupla-dialog.tsx:571`, `encerrar-dupla-dialog.tsx:104`, `enviar-termos-dialog.tsx:147`, `novo-link-dialog.tsx`, `digest-config-card.tsx:165,182,221`, `formulario-publico.tsx:1224,1237,1265`, `formulario-builder.tsx:1287`, `formulario-links.tsx`, `assinatura-form.tsx:473`, `destino-check-row.tsx:36`, `ia-evals/novo-run.tsx`.
- **Caso especial — `material-documento.tsx:137,278,431`:** checkboxes de documento (ficha de marcação, tarefa, lista riscável). Dois são `peer` pra line-through sem JS; a ficha de marcação imprime marcado (`print:[-webkit-print-color-adjust:exact]`). Migrar com cuidado ou declarar exceção — decisão de produto, ver §7.
- **Padrão C — `CaixaSelecao`** (`ui/caixa-selecao.tsx`): base-ui `Checkbox` como card de onboarding. Provê que o primitive funciona, mas não é o componente pedido.

**Recomendação:** criar `src/components/ui/checkbox.tsx` sobre `@base-ui/react/checkbox` (§5) e migrar o padrão B inteiro + consolidar o padrão A no mesmo componente. A aresta da fusão (`combinar-plano.tsx:795-800`) é o primeiro caso de uso do componente com a marca verde/neutra do ponto 2.

### Ponto 5 — card "Para ficar em dia" depois do combinado

**Fatos.** `mostrarPlanoEmDia` (aplicável + não em dia + ≥2 agendáveis + dupla ativa) não olha `planoVivoFicha`. Com combinado aberto, a ficha empilha: `PlanoEmDiaCard` (projeção: headline "Em dia em {data}", quadrados `QuadradosPlano`, lista de passos com "sugestão {data}", pendências de registro, recesso read-only, CTA "Ver o combinado" → `#acordos`) e depois `AcordosCentral` (combinado real: pill de status, `QuadradosCombinado`, aceites, passos com datas do escopo, repensar recesso quando `proposto`, roteiros quando aceito/ativo). Duplicam: lista de passos (projeção vs acordado — podem divergir em ritmo/fusão), quadrados (dois formatos do mesmo progresso), recesso (read-only vs editável), headline vs janela.

**Cuidado:** `#plano-em-dia` é o deep link do e-mail de aviso (`actions-plano.ts:78` — `/duplas/{id}#plano-em-dia`). Se o card sumir por completo quando `planoVivo`, o link de quem acabou de propor quebra. Alvos exclusivos do card: `pendenciasRegistro` ("Antes de seguir o plano"), recesso **pendente** (standalone só monta com `!mostrarPlanoEmDia`), estado "conversa" + "Falar com a coordenação", `alternativaRecesso`.

**Opções.** (a) Gate `mostrarPlanoEmDia && !planoVivoFicha` — some de vez; mover: recesso pendente pro standalone (mudar seu gate pra `!mostrarPlanoEmDia || planoVivo`), `pendenciasRegistro` pra um bloco próprio ou pra `AcordosCentral`, e-mail pra `#acordos`. (b) Modo compacto: com `planoVivo`, o card vira faixa — headline + "Ver o combinado" + recesso pendente/pendências de registro **se existirem**, sem lista nem quadrados. Âncora e conteúdos exclusivos preservados. (c) Manter.

**Recomendação:** (b). Mata a duplicação sem perder a âncora do e-mail nem órfãos de conteúdo; e o fallback natural já existe (contestado → `planoVivo` some → card inteiro volta). (a) é o destino se o produto quiser um card só, mas exige replantar três conteúdos e tocar o e-mail — custo real por ganho cosmético.

### Ponto 6 — expandir os dois lados na aba Encontros

**Fatos.** `encontro-row.tsx:565-691`: grid `lg:grid-cols-2`, esquerda `EncontroDisclosure` "Registro", direita `EncontroDisclosure` "Avaliação do jovem" (ou `AvaliacaoPendenteLinha`/caixa "Sem avaliação" quando não há disclosure). Cada um tem `forcado` próprio; `hashBate` (`#registrar-{id}`) é compartilhado — o deep link abre os dois, o clique abre um. O comentário do componente documenta a invariante atual: "Clicar num trigger não mexe no hash nem fecha o irmão (não é acordeão)" — a mudança altera exatamente isso.

**Opções.** (a) Estado controlado: `EncontroDisclosure` ganha `open`/`onOpenChange` opcionais; `EncontroRow` segura um `abertoDoc` único e alimenta os dois. Um clique abre/fecha os dois; hash continua forçando os dois. (b) Estado compartilhado por `encontroId` num contexto/mapa (estilo `abertoPorBloco` de `combinados-encontro.tsx:32`) — resolve sem tocar na API, mas espalha estado global. (c) "Abrir um abre o outro, fechar é independente" — assimétrico, estranho.

**Recomendação:** (a) — a API controlada é a forma idiomática de base-ui e preserva o caso de um lado só (reg sem avaliação: a coluna direita nem sempre tem disclosure; o único existente segue funcionando). Abrir abre os dois, fechar fecha os dois — o hash já trata o par como uma peça só. Atualizar o comentário da invariante no mesmo fix.

## 4. Regras de fusão e estados verde/neutro

### Regra proposta (por aresta `n → n+1`)

| Condição | Estado | Sinal visual | Texto junto |
|---|---|---|---|
| `META_PASSOS_PLANO[n].exige !== "pratica"` **e** `n+1` sem `precondicao` **e** marcar não fecha sessão de 3+ | **verde** (ótima) | borda `var(--ok)`, fundo `var(--ok-bg)`, check verde | chip `boa pra juntar` (mesma gramática do chip "sugerido" do ritmo) |
| `META[n].exige === "pratica"` | **neutra** | borda/fundo neutros | `pula a semana de prática do {n}º` inline; o aviso warn de hoje continua no confirmar |
| `n+1` tem `precondicao` | **neutra** | neutro | `o {n+1}º pede "{precondicao}" antes` |
| marcação encadeia 3+ encontros | **neutra** (as arestas da cadeia) | neutro | `sessão com 3 encontros` (ou N) |

Regras: nunca bloquear (spec 018 "avisar sempre, bloquear nunca"); o verde é recomendação, não default — nenhuma aresta nasce marcada; estado não pode depender só de cor (chip/texto em todas), foco visível e hit ≥44px já garantidos pela linha rótulo.

**Fonte dos dados:** `META_PASSOS_PLANO` em `plano-em-dia.data.ts`; `fusaoPedeAvisoPratica`/`fusaoDeArestas`/`marcarSessoes`/`escopoDaProposta` em `plano-em-dia.ts:862-1000`; `precondicao` sai no `PassoPlano` da simulação (`plano.passos[*].precondicao`). Tudo client-side na prévia — sem chamada nova.

## 5. Componente de checkbox

### Anatomia (proposta para `src/components/ui/checkbox.tsx`)

```tsx
<Checkbox.Root        // @base-ui/react/checkbox — button real, role=checkbox
  className="grid size-4.5 shrink-0 place-items-center rounded-md border …">
  <Checkbox.Indicator>
    <Check />          // phosphor, como caixa-selecao e o padrão A
  </Checkbox.Indicator>
</Checkbox.Root>
```

Mais um wrapper de linha (o caso dominante): `<label className="flex items-start gap-3 min-h-11 cursor-pointer">` com `<Checkbox.Root>` + conteúdo livre (título + meta), espelhando `encaminhamentos-list.tsx:142-198` — já é o melhor padrão da casa.

### Estados

- `unchecked` / `checked` / `indeterminate` (`indeterminate` prop do primitive — caso "selecionar todos" existe em `pessoa-actions`/`formulario-builder`), `disabled`, `required`/`name`/`value` (o primitive emite input escondido — participa de form nativo, essencial pros forms públicos), `aria-invalid` + `aria-describedby` (erros de `instrumentos/campos`).
- Visual: não-marcado `border-muted-foreground/40` (hover `border-foreground`); marcado `border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]`; warn onde hoje é `accent-[var(--warn)]` ("Preciso de apoio"/"Preciso de ajuda") → `border-[var(--warn)] bg-[var(--warn)]`. Foco: `focus-visible:ring-3 ring-ring/50` no Root (o primitive é focável de verdade — sem depender de `peer-focus-visible`). Pendente: `opacity-60` + disabled (padrão já usado nas transitions).
- Movimento: check com `confirm-pop`/`confirm-draw` só no clique da sessão (a gramática de `encaminhamentos-list`); o guard global de `prefers-reduced-motion` (`globals.css:865`) cobre — sem media query por componente.

### Onde aplicar

1. **Padrão B (nativo `accent-*`)** — toda a lista do §3: migrar pro `Checkbox`/`CheckboxLinha`. A linha da fusão em `combinar-plano.tsx:786-803` migra junto com o tratamento verde/neutro do §4.
2. **Padrão A (`sr-only peer` + span)** — migrar pro mesmo componente (comportamento idêntico, um desenho só).
3. **`material-documento.tsx`** — decisão pendente (§7): são affordances de documento/impressão, não controles de dados.
4. **`CaixaSelecao`** — fica como está (card de onboarding, outro objeto).
5. **`filtro-opcoes.tsx`** — é chip de filtro; manter ou migrar conforme encaixe visual — decisão do fix.

## 6. Critérios de aceite

**Copy / recesso**
- Nenhuma superfície usa "usar o recesso"; a opção diz o efeito nos encontros ("pausar"/"seguir") nos 4 lugares (wizard, card standalone, status, doc).
- Zero travessão em texto exibido nas superfícies tocadas; "ritmo" não aparece como palavra na UI (`agenda/page.tsx:708` corrigida).
- `dupla_recessos.usa` sem mudança de semântica; `declarar_recesso` intocada.

**Fusão**
- Aresta sem conflito de prática renderiza verde com rótulo de texto; aresta com prática/precondição/cadeia 3+ renderiza neutra com o motivo em texto.
- Nada nasce marcado; o aviso de prática no confirmar segue aparecendo quando grupo cruza passo 4–8; screen reader recebe o motivo, não só a cor.

**Checkbox**
- `src/components/ui/checkbox.tsx` existe no kit, sobre `@base-ui/react/checkbox`, com estados checked/indeterminate/disabled/invalid e foco visível real (Tab/Space funcionam, anel visível).
- Nenhum `input[type="checkbox"]` com `accent-*` sobra fora das exceções decididas (documento de impressão).
- Teste de teclado nos fluxos principais (combinar plano, registro, combinados); forms públicos seguem submetendo `name`/`value`.

**Cards**
- Com `planoVivo`, a ficha não mostra duas listas de passos nem dois quadrados; `#plano-em-dia` e `#acordos` continuam âncoras válidas; recesso pendente e "Antes de seguir o plano" não ficam órfãos.

**Expandir**
- Um clique no disclosure de Registro abre também a Avaliação (e vice-versa); fechar fecha os dois; `#registrar-{id}` continua abrindo os dois; encontro sem um dos lados segue funcional.

**Gates (definição de pronto do AGENTS.md)**
- `pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard`.

## 7. Riscos e decisões de produto

**Decisões que o fix precisa travar antes de codar**

1. Rótulo final do recesso — "Vamos pausar os encontros" × "Vamos parar no recesso" × outro. Toca 4 superfícies + doc; semantica do banco não muda.
2. Definição de "ótimo" na fusão — mínimo (só prática) ou completo (prática + precondição + 3+). Recomendo completo: os três sinais já existem.
3. Escopo do checkbox — `material-documento.tsx` entra ou é exceção declarada (affordance de doc/print)? `filtro-opcoes` migra ou fica?
4. Card "Para ficar em dia" — colapsar pra faixa (b, recomendado) ou sumir (a)? Se sumir: replantar recesso pendente, pendências de registro e o link `#plano-em-dia` do e-mail.
5. Expandir os dois lados — fechar também fecha os dois (simétrico, recomendado) ou fecha só o clicado? E o título da seção muda com o comportamento?

**Riscos**

- **Âncora quebrada:** esconder `PlanoEmDiaCard` inteiro invalida `#plano-em-dia` (e-mail de aviso) — mitigar mantendo a faixa ou reescrevendo o link do e-mail junto.
- **Órfãos de conteúdo** na mesma mudança: recesso pendente e `pendenciasRegistro` moram no card; qualquer simplificação precisa de casa pra eles.
- **Estado vs hash** nos disclosures: a máquina `forcado ?? hashBate` reseta no `realiza:hash`/hashchange; a versão controlada precisa manter esse reset ou o deep link para de mandar.
- **Checkbox em form público** (`/f/[token]`): trocar por base-ui mantém `name`/`value` via input escondido — validar submissão real no e2e do token.
- **Cadeia na fusão:** hoje arestas adjacentes podem formar sessão de 3+; se a regra de "ótimo" travar em par único, uma cadeia existente de 2 arestas precisa continuar renderizável (marcar a 2ª aresta quando a 1ª já está marcada).
- **Liza/outras portas:** `proporPlano` legado e o caminho da Liza não passam pela UI — mudança de copy/fusão não pode exigir campo novo na RPC.
