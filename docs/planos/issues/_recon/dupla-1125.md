# Recon — Ficha da dupla, plano, especialista e combinados (25/11)

**Head:** `10ebd056` (branch `recon/dupla-1125`, base `integration/plano2` — ponta atual) · **Fonte:** `docs/planos/feedback-thiago-2026-11-25.md` §5 + §7 (transversais que tocam estas superfícies) · **Status:** recon concluído; não implementa — cada item termina em opções, ACs e o que falta decidir.

> Escopo: card da dupla na home do mentor, superfície "Combinar o plano", "Sugerir especialista" da ficha, jovem criar combinados, aba Instrumentos da ficha e PDM. Badges/perfil (§1–2), agenda/Liza (§3, §6) e materiais (§4) ficam nas frentes próprias. Recon feito com 3 subagentes explorer + verificação direta; o que não foi verificado está marcado.

## 1. Resumo executivo

| # | Item | Tipo de mudança | Arquivo-âncora | Direção recomendada |
|---|---|---|---|---|
| 1 | Header do card da dupla clicável | desenho: padrão novo já existe no repo | `mentor-home.tsx:435-502` | stretched-link no `CardHeader` ink |
| 2 | Combinar plano — nomes dos encontros | copy/dado: o título já viaja no payload | `combinar-plano.tsx:772-845` | `p.titulo` por aresta, modelo do `plano-em-dia-card.tsx:349` |
| 3 | Combinar plano — botões cobrindo texto | bug de layout (uma classe) | `combinar-plano.tsx:1243-1244` | tirar `min-h-0` do wrapper do corpo |
| 4 | Combinar plano — feedback da simulação ao juntar | decisão de domínio: fusão não move o "em dia" | `combinar-plano.tsx:731-738`, `plano-em-dia.ts:965-986` | feedback honesto local (sessões/dias) ou remodelar (spec própria) |
| 5 | Sugerir especialista mobile | anatomia de card + superfície de dialog | `especialista-seletor.tsx:93-173`, `sugerir-especialista-dialog.tsx` | card-radio sem selo + `linkPerfil` + lista animada + topo cedendo |
| 6 | Motion em forms/disclosures (§7) | lacunas pontuais; gramática 028 já vale | `combinar-plano.tsx`, `especialista-seletor.tsx` | `Collapsible`, `FadeTroca`, `.animate-enter` |
| 7 | Jovem criar combinados | permissão em 3 camadas (UI, action, RLS) | `jovem-combinados.tsx`, `actions.ts:4022-4078` | **exige migration — alçada do lead** |
| 8 | Checklist do mentor na aba Instrumentos | respondente = quem olha a tela (papel invertido) | `instrumentos-dupla.tsx:478-527, 708-711` | "Responder agora" + rótulo de ownership + subtítulo |
| 9 | PDM instrumento × PDM documento | duas superfícies legítimas com copy convergente | `duplas/[id]/page.tsx:1543-1591`, `schema.ts:218-221` | copy/proveniência primeiro; fusão se não bastar |

Duas coisas chamadas "combinado" vivem no produto e o feedback mistura as duas: **o documento do plano** (spec 020, `CombinarPlano` + `/duplas/[id]/combinado` + `/jovem/combinado`) e **os combinados-encaminhamentos** (afazeres, migration 0157, `CombinadosEncontro` + `JovemCombinados`). O item 5 do feedback ("jovens também precisam criar combinados") só faz sentido sobre os encaminhamentos — o jovem já propõe o combinado do plano (`CombinarPlano` com `lado="mentorado"` em `jovem/agenda/page.tsx:709-723`). Registrar a leitura na ficha da decisão (§9).

## 2. Header do card da dupla clicável

**Estado atual.** O card de cada dupla na home do mentor abre com um `CardHeader` em banner ink + keyline lime (`mentor-home.tsx:435-502`): overline ("Sua dupla"/"Dupla · {nome}"), `CardTitle` com `DuplaNomes`, meta de supervisor, `TrilhaPrazoBadge` na trilha especialista; na direita, contador `feitos/total` + `Link` ghost "Abrir dupla" → `/duplas/[id]` (:487-499). Só o link pequeno navega — o lockup inteiro (a âncora de identidade do card) é texto morto. O próprio código registra a decisão antiga (:485-486): "o card todo não é link — a saída pra ficha precisa de affordance própria". Os cards "Ciclos concluídos" (:823-856) repetem o mesmo padrão.

O padrão pedido já vigora no repo: `VisaoMentor` "Minhas duplas" em `duplas-lista.tsx` (REALIZA-241, card inteiro navega, ações sobem com `relative`/z-index) e `instrumentos-programa.tsx:451-464` (`Link absolute inset-0 rounded-xl`).

**Causa raiz.** Decisão de desenho ultrapassada, não bug — a regra mudou com a 241 e o banner do mentor-home ficou para trás.

**Opções.**
- **A — stretched-link no header (recomendada).** `CardHeader` vira `relative`; `Link` `absolute inset-0` cobre o banner; o "Abrir dupla" sai ou permanece como affordance redundante por cima (`relative`). Zero nested-interactive por construção (o único interativo do header hoje é o próprio link; `DuplaNomes` e `TrilhaPrazoBadge` são inertes). Aplicar também nos "Ciclos concluídos".
- **B — só o lockup clicável** (overline+título+meta num `Link`). Menor alvo, descoberta menor.
- **C — título vira link, mantém botão.** Mínimo, mas o header segue majoritariamente morto.

Não esticar o link pro `CardContent` — lá dentro vivem CTAs críticos (registrar, sessão agendada, roteiro, combinados :570-798).

**ACs.** Banner inteiro navega pra `/duplas/[id]` (exceto sobre ações sobrepostas, se mantidas); `focus-visible` visível no header-link (variante lime sobre ink, como :491); `aria-label` nomeia o destino ("Abrir ficha da dupla {jovem}"); zero nested-interactive; mesmo tratamento nos cards concluídos.

**Decisão aberta.** A regra "todo header de card de dupla navega" vira convenção escrita em `conventions-ui.md`?

## 3. Combinar o plano (`combinar-plano.tsx`, 1267 linhas)

Mapa: wizard de 1–5 perguntas (ritmo → recesso → grade → sessão → confirmar) já na gramática 028 (`Etapa`/`useTrocaDeEtapa`, :59,:253-255,:1143-1157); projeção viva via `simularPlano` a cada resposta (:257-296); painel "O que a projeção diz" sempre visível abaixo das etapas (:959-1060,:1158); superfície própria — Dialog lg + `DialogFooter sticky` no desktop, Sheet bottom + footer sticky inline no mobile (:1215-1249). **Não usa `FormSurface`**: é a origem do padrão (`form-surface.tsx:6-8`) e nunca migrou; carrega cópia local de `useDesktop` (:70-76 vs `use-desktop.ts`).

### 3a. Nomes dos encontros no passo "juntar"

**Estado.** O passo `perguntaSessao` (:772-845) lista arestas como `CheckboxLinha` "Juntar o {n}º e o {n+1}º na mesma sessão" (:813) — só números, nem data nem nome. Preview de grupo (:829-842) e linha de fusão no confirmar (:918-923) idem. **O dado já está no estado**: `passosComData = aplicavel.passos` (:717) é `PassoPlano[]` com `titulo` (`plano-em-dia.ts:66`, preenchido em :501 — `guia?.titulo ?? "Encontro N"`, de `ciclo_eventos.titulo`). A tabela `encontros` não tem nome — o "nome" é o título do passo do guia ("Boas-vindas, histórias de vida e abertura" etc., `seed.sql:40-56`). O modelo de exibição já existe: `plano-em-dia-card.tsx:349` mostra `p.titulo` como linha principal + data como secundária. `estadoArestaFusao` já recebe `passosComData` (:795-799).

**Causa raiz.** A linha foi escrita sem usar `p.titulo`/`p.data` que já viajam no payload.

**Opções.** (a) linha secundária na aresta com título+data dos dois encontros (mínima, copia o modelo do card; trade-off: ~3 linhas por aresta, denso com muitas); (b) só títulos sem data (data fica no preview de grupo); (c) levar títulos também ao doc projetado (`montarDocCombinado`, `plano-roteiros.ts:237-248`) e às linhas do combinado persistido (`plano-acordos.tsx:438`) — cobre ponta a ponta, toca a lib do doc.

**ACs.** Cada aresta exibe número + título do guia + data sugerida dos dois encontros; motivos do `estadoArestaFusao` seguem referenciando número; linhas fazem wrap em 320px (títulos chegam a ~45 chars, sem fixed-width).

### 3b. Botões cobrindo conteúdo no mobile (inclui "flutuando" e "no meio do texto")

**Estado.** `SheetContent` é o scrollport: `fixed flex flex-col overflow-y-auto` (`sheet.tsx:90`) com `h-[min(85dvh,760px)] p-4` (:1235). O corpo é `<div className="mt-4 min-h-0 flex-1">{corpo}</div>` (:1243) e o rodapé `sticky bottom-0 -mx-4 -mb-4 mt-4 border-t bg-sidebar p-4` (:1244).

**Causa raiz.** `min-h-0 flex-1` foi escrito como se o corpo fosse o scrollport interno ("header fixo / corpo rola / footer fixo"), mas falta `overflow-y-auto` nele — quem rola é o popup inteiro. A caixa do corpo encolhe para o espaço livre, o conteúdo transborda `overflow:visible` para a área de scroll, e a posição in-flow do footer fica **logo abaixo da caixa encolhida** (perto do topo do documento). Resultado: o footer sticky cobre permanentemente uma faixa de ~70px no meio do texto — é exatamente "botões no meio do texto" quando o `<details>` do documento abre (§3d) e "flutuando muito em cima". Padding-bottom extra no corpo (o "margin-bottom" pedido) ajuda a última linha mas **não resolve** — a faixa coberta está no meio do documento, não no fim. No desktop, `DialogFooter sticky` está no fim do conteúdo e funciona (footer flutua ao rolar, assenta no fim).

**Opções.**
- **A — tirar `min-h-0` (recomendada).** `min-height:auto` = min-content → a caixa nunca fica menor que o conteúdo → o footer natural vai pro fim; com conteúdo curto o `flex-1` segue empurrando o footer pro pé da folha. Fix de uma classe.
- **B — corpo como scrollport** (`min-h-0 flex-1 overflow-y-auto` no wrapper): header/footer viram chrome estável e o footer nunca sobrepõe; diverge do FormSurface e exige padding-bottom próprio no corpo; no desktop o Dialog seguiria sticky (dois modelos).
- **C — migrar pro `FormSurface`** (`h-auto max-h-[85dvh]`): deduplica o padrão, mas a folha encolhe com conteúdo curto (resize entre passos) e o rodapé empilha botões no mobile (`flex-col-reverse`) — mudança visual além do pedido.

Complemento: `pb-*` a mais no corpo/scrollport melhora a última linha antes do footer.

**ACs.** Em 360–414px, com qualquer passo/conteúdo longo, todo o texto é alcançável por scroll — o footer nunca cobre texto permanentemente; com conteúdo curto, footer ancorado no pé da folha; desktop inalterado. **Não verificado em browser** — análise de CSS por inferência forte; repro no device antes do fix.

### 3c. Feedback da simulação ao juntar encontros

**Estado.** `alternarAresta` (:731-738) dispara `simular({fusao: grupos})` a cada toggle → `simularPlano` → `marcarSessoes`, que **só carimba `sessao` nos passos — "sem mexer na matemática (a caminhada já rodou)"** (`plano-em-dia.ts:965-986`; teste `plano-em-dia.test.ts:556`). Logo `dataRecuperacao`, `avisos`, `alternativaRitmo`, `emDia`, `estado` **não mudam com a fusão**. O painel "Com {ritmo} ficam em dia em {data}" não reage aos checkboxes. O que existe hoje no passo: preview "Nº e Nº saem juntos em {data} · sessão de 2h" (:829-842), chip/motivo por aresta (`estadoArestaFusao`, :795-822) e `avisoPratica` (:743-770).

**Decisão de domínio.** O pedido ("em que dia a dupla fica em dia conforme a quantidade juntada") só é honesto se a fusão entrar na caminhada do planner — hoje o escopo colapsa o grupo para a data mais cedo **só na gravação** (`escopoDaProposta`, `plano-em-dia.ts:1030-1064`). Mostrar "fica em dia mais cedo" sem remodelar seria mentira visual — viola a regra do próprio card ("nunca promete o que o calendário não comporta", `plano-em-dia-card.tsx:41-42`). A ambiguidade da §8.4 ("sempre visível ou só ao selecionar?") fica respondida parcialmente: o painel global já é sempre visível; a dúvida real é onde mora o efeito específico da fusão.

**Opções.**
- **A — feedback derivado local (recomendada):** sob os checkboxes, "junta N encontros em M sessões de 2h — M dias a menos no calendário" derivado de `gruposFusao`/`dataDoGrupo` (extende o preview de :829-842). Zero mudança de domínio, não promete "em dia" que o modelo não computa.
- **B — linha condicionada no painel** ("Juntando, os encontros Nº… saem em {data}"): usa a superfície existente; decisão sempre-visível × só-ao-selecionar segue aberta.
- **C — modelar a fusão na caminhada:** passos fundidos tomam a data do grupo e gaps/semanas recalculam → `dataRecuperacao` pode adiantar. Pesado: `montarPlanoEmDia` + paridade com `plano_aplicar_sessao` no banco + testes (`plano-em-dia.test.ts:535-620`). Spec própria se o produto quiser o efeito real.

**ACs.** Marcar/desmarcar aresta produz feedback textual do efeito (sessões, dias de calendário, custo de prática) sem prometer "em dia" não computado; decisão "sempre visível × só ao selecionar" registrada antes de implementar.

### 3d. "Ler o documento do combinado" — botões no meio do texto

**Estado.** `<details>` nativo :929-941 com `<summary>` custom + `CaretDown` rotativo; conteúdo `DocBlocos` (`plano-roteiros.ts:173-296`), potencialmente alto. Vive dentro do `Etapa` confirmar → dentro do corpo do Sheet.

**Causa raiz.** A mesma da §3b: o doc aberto incha o conteúdo que transborda a caixa `min-h-0`; o footer fica preso na posição in-flow logo abaixo da caixa encolhida e cobre o documento. Corrigir §3b resolve a sobreposição; a animação pedida (§5) recomenda trocar `<details>` por `Collapsible` do kit (Base UI — `encontro-disclosure.tsx:113-126` é o precedente), que ganha `transition-[height]` (exceção já canonizada) e mantém o conteúdo montado entre etapas.

**ACs.** Com o doc aberto no mobile, todo o texto é alcançável por scroll; abrir/fechar anima; estado do disclosure preservado ao Voltar/Avançar (já garantido — Etapas seguem montadas).

## 4. "Sugerir especialista" mobile

**Estado.** `SugerirEspecialistaDialog` (`sugerir-especialista-dialog.tsx`, 184 linhas) abre pela ficha via menu "Mais" (`mais-menu.tsx:232-241`, modo controlado) e pela agenda (`agenda-por-mentorado.tsx:1359`); `DialogContent size="lg"` (:113) — mesmo Dialog centrado no mobile, `max-h-[calc(100dvh-2rem)] overflow-y-auto` (`dialog.tsx:108`). O seletor vive em `EspecialistaSeletor` (`especialista-seletor.tsx`), usado em 3 superfícies: aqui (:159-167), `solicitar-especialista-dialog.tsx:135-143` e `jovem-sugestao-card.tsx:241-249` — **só o jovem passa `linkPerfil`**.

### 4a. Badge/botão/ícone espremendo + "Selecionado"

**Estado.** O card "qualquer" do pool (:100-137) é uma linha `flex items-center gap-3` com ícone `size-10` + texto `min-w-0 flex-1` + `Badge` "Selecionado" nowrap (:114-119) + `Button` "✓ Selecionado"/"Selecionar" (:121-135) — a copy aparece **duas vezes** no mesmo card e o texto morre espremido. Nos cards do catálogo, o selo `shrink-0` no `blocoTopo` come o espaço do nome (`especialista-catalogo-card.tsx:51-78`). Ocorrências da copy: `especialista-seletor.tsx:58,118,130,147,163`; raio de impacto inclui `jovem-especialista-card.tsx:54` e `catalogo-jovem.tsx:145`.

**Detalhe de token.** "Borda accent" literal não existe: `--accent` aqui é superfície neutra de hover (`globals.css:71`), não cor de ação. A gramática de seleção vigente é `border-primary bg-primary/5` + `CheckCircle` (`pedir-especialista-dialog.tsx:69-70,:110-111,:307-337`); rádio nativo sr-only + `has-checked` existe em `ui/filtro-opcoes.tsx`. Não há RadioGroup no kit.

**Opções.**
- **A — card-radio (recomendada).** Seleção por card clicável com `aria-pressed`/radio sr-only + indicador visual (anel/dot ou `CheckCircle`) + `border-primary bg-primary/5`; sem a copy "Selecionado". Resolve squeeze e estado num gesto só.
- **B — selo mínimo.** Manter botão "Selecionar" e trocar badge por indicador; menos cirúrgico, ainda carrega duas afordâncias.

**ACs.** Seleção indicada por radio/check + borda/fundo primary + `aria-pressed`, sem a copy "Selecionado"; nome completo legível a 360px; comportamento idêntico nas 3 superfícies do seletor (alinhar com a cópia do jovem é decisão — ver §9).

### 4b. Card abre perfil

**Estado.** `EspecialistaCatalogoCard` já aceita `href` e envolve avatar+nome num `Link` com `aria-label="Abrir perfil de …"` (:84-95); `EspecialistaSeletor.linkPerfil` repassa (:37,:56,:143). Os dois dialogs staff não passam. Rota existe: `/pessoas/[id]` resolve profile ou mentorado (`queries.ts:801-869`); `especialistas_catalogo.id` é `profiles.id` (`0101:35`, `0239`).

**Conflito a resolver.** Hoje o card seleciona pelo botão do rodapé; "card abre perfil" colide com "card seleciona". Anatomia explícita: nome/avatar = link pro perfil (`/pessoas/${e.id}` no staff), resto do card = seleção; ou CTA "Selecionar" minimal + card-link. **Não verificado** se a ficha `/pessoas/[id]` renderiza completa pro papel mentor DPP (RLS decide; a página não tem gate de papel).

**ACs.** Tocar nome/avatar abre `/pessoas/[id]` (staff); seleção segue em alvo separado e inconfundível; sem nested-interactive inválido.

### 4c. "Subir o topo do form" ao abrir a lista

**Estado.** A lista `<ul className="max-h-96 … overflow-y-auto">` (:93-98, 384px) monta no fluxo e empurra o `DialogFooter` (não-sticky, :168) para fora — nada rola automaticamente (zero `scrollIntoView`). Acima do seletor ficam `demanda` (obrigatória) e `objetivo` (:122-158). `DialogFooter sticky` existe (`dialog.tsx:150-166`) e `pedir-especialista-dialog.tsx:449` já usa pelo mesmo motivo.

**Opções.**
- **A — topo cede (leitura mais fiel ao pedido).** Ao abrir o pool, a parte superior (header + campos já respondidos) colapsa/recolhe — mesmo gesto do resumo `espSel && !aberto` (:52-74) — liberando a área útil; ao fechar, restaura.
- **B — dialog rola até o seletor** (`scrollIntoView` no `<ul>` ao abrir) + `DialogFooter sticky`: topo segue acessível por scroll, barato.
- **C — migrar a superfície** pro `FormSurface` (Sheet bottom no mobile, footer preso): resolve superfície inteira de uma vez; maior escopo, e a spec 023 já admitia "sheet grande ou seção dedicada" como saída para a ficha apertada.

**ACs.** Com a lista aberta no mobile, a área útil prioriza o pool; ao fechar, o form volta ao estado anterior; footer/ações sempre alcançáveis.

### 4d. Motion no seletor

**Estado.** `{aberto && <ul>}` monta instantâneo (:93); resumo↔trigger troca a seco (:52-92); seleção muda badge/botão sem transição. Gramática disponível: `Collapsible.Panel` com `h-[var(--collapsible-panel-height)] transition-[height]` (exceção canonizada — `combinados-encontro.tsx:401`), `FadeTroca` (`ui/etapa.tsx:196-241`), `.animate-enter`+`--i` (`globals.css:446-459`; `pedir-especialista-painel.tsx:167` já usa).

**ACs.** Abrir/fechar lista anima (Collapsible height ou animate-enter); resumo↔lista e seleção transicionam dentro da gramática; zero `transition-all`; reduced-motion coberto pelo guard global.

## 5. Motion transversal nas superfícies desta frente (§7)

A gramática da 028 já está vigente e o combinar-plano **já migrou** (`Etapa` direcional + foco no h3 por etapa — o recon de 24/11 que o listava como "P0" está desatualizado). O que ainda está **a seco**:

| Superfície | Local | Corte seco | Remédio na gramática |
|---|---|---|---|
| Combinar plano | doc `<details>` :929-941 | abre/fecha instantâneo | `Collapsible` Base UI + `transition-[height]` |
| Combinar plano | loading→wizard / erro / terminal :1109-1133 | troca de fase sem crossfade | `FadeTroca` (só no nível das fases — nunca dentro dos `Etapa`, que precisam seguir montados p/ `FormData`) |
| Combinar plano | `avisoPratica` :743-770, preview grupos :829-842, input "Outro" :473-498, linhas `role=status` :944-955 | revelação instantânea | `.animate-enter` (fade+slide ≤300ms) |
| Combinar plano | `painel` :961-1060 | texto troca seco a cada sim | fade sutil/`opacity` durante `simulando` (manter `role=status`) |
| Especialista seletor | pool :93, resumo↔trigger :52-92 | monta/desmonta instantâneo | `Collapsible`/`FadeTroca` |
| Checklist/combinados | — | já animados: `Collapsible.Panel` `transition-[height]` (`combinados-encontro.tsx:401`), pendente com `motion.span`+`fade` (`instrumentos-dupla.tsx:479-497`) | — |

**ACs transversais.** Toda troca de estado/disclosure/seleção usa idioma da gramática (`Etapa`, `FadeTroca`, `.animate-enter`, `data-open` do kit, `transition-colors/transform`, `Collapsible` height); só transform/opacity/background-color animam (+ `transition-[height]` do Collapsible); nada de `transition-all` novo; `prefers-reduced-motion` pelo guard global (`globals.css:970-1023`) + `MotionConfig` — sem media query por componente; foco continua pousando no h3 da etapa (`tituloEtapaRef`) e, onde couber, `FadeTroca foco` leva o foco junto.

## 6. Jovem criar combinados (encaminhamentos)

**Estado.** O mentor cria em dois lugares: form inline por encontro (`CombinadosEncontro` "+ Adicionar combinado" — descrição + "quem faz" mentor/mentorado + prazo, :424-515, montado em `encontro-row.tsx:708-717`) e em lote dentro do registro (`salvarRegistro` reconcilia linhas, `actions.ts:3790-3864`). Editar/excluir via `CombinadoMenu`/`EditarCombinadoDialog`/`ExcluirCombinadoConfirm` (`combinado-acoes.tsx`); marcar feito via `toggleEncaminhamento` (`actions.ts:4134`) — coord só marca, mentor edita (`page.tsx:1354-1357`).

O jovem vê "Meus combinados" na home (`jovem/page.tsx:930-942`) → `JovemCombinados`: **só checkbox** via `marcarCombinadoFeito` → RPC `marcar_combinado` (definer, `0070:40-68`). O comentário do componente registra a premissa: "o único write é o checkbox… quem criou o combinado foi o mentor" (`jovem-combinados.tsx:14-19`). A view `jovem_encaminhamentos` só devolve `responsavel='mentorado'` (`0070:26-35`) — combinado do mentor ele nem vê.

**Bloqueio em 3 camadas, não só UI:**
- **Action:** allowlist `temPapel(eu, "mentor_dpp"|"mentor_especialista")` em criar/editar/excluir (`actions.ts:4033,4167,4206` — o comentário explica que a allowlist existe pra não depender da RLS).
- **RLS:** `encaminhamentos_mentor_write FOR ALL` = coordenação ou mentor da própria dupla (`0001:243-256`). **O mentorado não tem policy de insert/update** — o banco nega; por isso o write dele passa só pela RPC `marcar_combinado`. Select idem: ele lê pela view definer.
- **UI:** `JovemCombinados` não tem gesto de criar/editar; `CombinadosEncontro` está ancorado em `numero` (nº do passo do guia) e a action rejeita `numero` fora de 1..maxNum (`:4058-4060`). `numero` é nullable desde 0157 — caminho sem âncora é viável.

**Opções.**
- **A — jovem cria pra si (`responsavel='mentorado'`).** "+ Adicionar" no `JovemCombinados`; escopo mínimo, o checkbox já serve. Não cobre combinado pro mentor.
- **B — jovem cria pra ambos** (escolhe quem faz, como o mentor). Fiel a "como os mentores"; trade-off: atribuir tarefa ao mentor sem confirmação é decisão de produto, e o que ele criar "pro mentor" não volta pra view dele — ou a view muda ou fica cego.
- **C — proposta com aceite** (jovem sugere, mentor confirma — modelo da sugestão de especialista). Correto produtivamente, muito mais caro (status/fluxo novo).

Em qualquer uma: definir âncora `numero` (próximo encontro × atual × null), autoria (`created_by` já existe, `0157:18` — pode virar rótulo "criado por {jovem}" na ficha staff) e escrita no banco — **policy nova ou RPC definer, alçada do lead** (este recon só sugere).

**ACs.** Jovem vê "+ Adicionar combinado" em "Meus combinados" com os campos da opção escolhida; o item aparece pra ele (e na ficha staff com autoria); `marcar_combinado` segue valendo no item criado por ele; o reconcile do `salvarRegistro` não apaga item do jovem (só toca o `registro_id` dele — `actions.ts:3841-3847`, provar em teste); action retorna `{ ok }/{ error }` pt-BR; copy do estado vazio revista ("eles saem do papo com seu mentor" deixa de ser verdade).

**Risco.** É o único item da frente que **exige migration** — travar decisão de produto antes de codar.

## 7. Aba Instrumentos — "Checklist de competências do mentor"

**Estado — o instrumento funciona ponta a ponta:** migration 0190 (destinatário = mentor via `dest_profile_id`; momentos `inicio`/`final`; autoemit na formação e no encontro 15); RPC `instrumentos_da_dupla` devolve `destino='mentor'` e remove a linha inteira pro mentorado (`0190:494-501`); `/f/<token>` responde pelo renderer genérico (decisão deliberada); `InstrumentoResultado` → `CompetenciasResultado` com comparação início×fim (`instrumento-resultado.tsx:609-616`).

**Onde quebra.** Na seção "Instrumentos da jornada" (`instrumentos-dupla.tsx`):
- **"Aparece como do mentorado":** o subtítulo diz "o jovem responde por link único" (:708-711) — afirma o respondente errado pra linha do checklist; as 5 linhas renderizam idênticas e o único sinal de ownership é o fim do resumo muted ("…responde o mentor", `schema.ts:226-229`); o badge de pendente diz "link enviado" (:317) — copy do fluxo equipe→jovem (o link autoemitido do checklist não foi "enviado" a ninguém).
- **"Não abre":** nenhum gesto abre o instrumento pra responder. Em `pendente` (estado normal — autoemit) a primária é "Copiar link" (:478-498) e o ⋯ tem "Enviar no WhatsApp" apontando pro **próprio número do mentor** (:551-573, dest por sistema :247-252). O caminho real hoje: copiar `/f/<token>` → colar no navegador → responder. Pra quem olha a ficha, não existe "Responder agora". Na régua de `/materiais` o checklist não tem card próprio (cai no fallback "Ver instrumentos") — a linha da ficha é o único ponto de ação.

**Causa raiz.** A `LinhaInstrumento` foi desenhada pro fluxo "equipe emite → outra pessoa responde". No checklist o respondente é quem está olhando. O `destino='mentor'` já chega da RPC mas só alimenta `destNome`/`destWhatsapp` — nunca vira affordance nem rótulo.

**Opções.**
- **A — "Responder agora" (recomendada).** Quando `sistema='competencias_mentor'` e quem vê é o mentor da dupla (prop nova `souMentor` em `InstrumentosDupla` — `page.tsx:1554-1565` hoje só passa `remetenteMentorNome` (a página já tem `souMentor` à mão)), a primária em `pendente` vira `Link → /f/<tokenVivo>`; "Enviar no WhatsApp" pra si mesmo sai do ⋯ (além de sem sentido, loga nudge na dupla e pode queimar cooldown). Coord/supervisor seguem com Copiar/WhatsApp ao mentor.
- **B — rótulo de ownership.** Metadado "responde o mentor" junto ao chip de janela (ou derivado de `entrega.destino`, já no payload) + subtítulo revisto ("o jovem responde por link; o checklist é autoavaliação sua").
- **C — sub-grupo próprio** ("Autoavaliação do mentor" separado das 4 linhas do jovem). Mais claro, quebra simetria.

Sugestão: A + B. A alternativa maior — responder in-app autenticado em vez do link anônimo — muda o contrato de submissão e fica como decisão (§9). Cuidado com colisão de nome: "checklist" também é o rito de encerramento da coord (`encerramento-dupla.tsx:118-208`) — nas copy ao mentor, "autoavaliação" pode ler melhor.

**ACs.** Mentor responde o checklist em 1 clique a partir da ficha; coord/supervisor seguem emitindo/reenviando ao mentor; subtítulo não afirma que todos respondem o jovem; linha identifica "responde o mentor" antes do estado; respondido segue abrindo a comparação início×fim; mentorado nunca vê a linha (já garantido pela RPC — manter).

## 8. PDM — instrumento × documento vivo

**Estado.** Duas superfícies na mesma aba: a linha `pdm` em "Links e envio" (`page.tsx:1543-1567` — título "PDM", resumo "O documento central: visão e de 3 a 8 metas…") e o `PdmDupla` em "Documentos da jornada" (:1569-1591 — "Plano de desenvolvimento", árvore editável, `podeEditar` = mentor/mentorado da dupla viva). O conteúdo converge por desenho: o submit do form chama `pdm_projeta_resposta` (`0109:788-795`) que materializa `pdm.visao`+`pdm_itens` — as metas respondidas viram nós vivos do doc. "Ver resposta" (snapshot) e a árvore exibem as mesmas metas lado a lado; o jovem vê o doc em `/jovem/pdm`. A separação "Links e envio" × "Documentos" organiza os grupos mas não a percepção. Agravante de copy: a linha do instrumento se descreve como "O documento central" — rótulo do doc aplicado ao form; `GUIA_ENCONTRO.pdm` idem ("documento vivo").

**O que o usuário confirmou.** O feedback registra: achou que era duplicado, depois confirmou que os dados aparecem. A arquitetura é deliberada e correta (resposta = evidência imutável; doc = trabalho contínuo editável; divergência posterior é esperada). O defeito é de apresentação: nomes convergentes, conteúdo idêntico na primeira leitura, nenhum conectivo de proveniência.

**Opções.**
- **A — copy + proveniência (recomendada).** A linha passa a se declarar resposta ("o form que o jovem responde nos enc. 1–4 — as metas caem no Plano de desenvolvimento abaixo"); no `PdmDupla`, proveniência por item via `origem`/`origem_campo` (já no payload de `pdm_da_dupla`) — "meta vinda do instrumento PDM".
- **B — fundir.** `PdmDupla` absorve o estado do instrumento (badge, "Ver resposta", emitir) e a linha sai da lista — um "PDM" só; precisa portar emit/refazer/`GUIA_ENCONTRO` pro card.
- **C — conectivo mínimo.** "Ver no plano" → `#pdm` na linha; "resposta original" no doc.

**ACs.** Inequívoco o que é resposta (evidência, envio) vs. documento (edição, acompanhamento); nenhuma copy descreve um pelo outro; proveniência legível por item; decisão se a linha do instrumento PDM segue visível após respondida (é a única via de re-emissão e leitura do snapshot). Renomear toca `/jovem/pdm`, `arquivos-dupla.tsx`, régua de `/materiais` e deep-links `#pdm` — mapear antes.

## 9. Riscos e decisões abertas

**Decisões de produto que travam implementação:**

1. **"Borda accent"** — o token `--accent` é hover neutro, não ação. Assumir a gramática `border-primary bg-primary/5` + indicador (como `pedir-especialista-dialog.tsx`) ou confirmar outra cor com o Thiago.
2. **Simulação do juntar** — o modelo não move `dataRecuperacao` com fusão. Opção honesta barata (sessões/dias) × remodelar a caminhada (spec própria). Responder também o §8.4 do feedback (sempre visível × só ao selecionar).
3. **"Subir o topo"** — colapsar os campos acima × scroll até o seletor × migrar a superfície pra Sheet. A leitura "o topo cede" parece a mais fiel; confirmar.
4. **Combinados do jovem** — pra si × pros dois × com aceite; âncora `numero` (próximo × atual × null); e se o feedback quis dizer o **documento** do plano (o jovem já pode — alinhar antes). Migration é alçada do lead em qualquer caso.
5. **Checklist** — "Responder agora" via `/f/<token>` anônimo (modelo atual) × responder autenticado in-app (contrato novo). Colisão de nome com o checklist de encerramento da coord.
6. **Selo "Selecionado"** — o mesmo selo vive em `jovem-especialista-card.tsx` e `catalogo-jovem.tsx`; alinhar a anatomia nas duas superfícies ou divergir por papel.
7. **Header clicável** — a regra "todo header de card de dupla navega" vira convenção em `conventions-ui.md` (a decisão antiga `mentor-home.tsx:485` é explicitamente revertida)?
8. **PDM** — copy/proveniência basta ou a linha do instrumento some após respondida (fundir no doc)?

**Riscos técnicos:**

- O fix do footer (§3b) muda geometria de scroll do Sheet — verificar em device real; `tituloEtapaRef.focus()` e o posicionamento do `<details>` podem interagir.
- `FadeTroca` no `corpo` do combinar-plano só no nível das fases — desmontar `Etapa` perde `FormData`/rascunho dos fieldsets.
- E2e existente pode asserir o texto "Selecionado" (specs da 023) — varrer antes de remover a copy.
- `linkPerfil` staff: confirmar que `/pessoas/[id]` renderiza pro papel mentor (RLS, não gate de página).
- "Enviar no WhatsApp" pro próprio mentor loga `interacao` de nudge — esconder evita queimar cooldown.
- Jovem criar combinado: `salvarRegistro` faz delete-por-diferença só do registro editado (`actions.ts:3841-3847`) — provar que o item do jovem sobrevive; copy do estado vazio deixa de ser verdade.

## 10. Testes que provam o comportamento

**Existentes a estender:** `tests/plano-em-dia.test.ts` (fusão: `:535-620` — se opção C de simulação, é aqui que mora), `tests/plano-roteiros.test.ts:153-173` (se o doc ganhar títulos), `tests/plano-combinado.test.ts` + `tests/plano-acordos.test.tsx` (sessão combinada), `tests/diretorio-jovem.test.ts` (projeções do jovem — se view de encaminhamentos mudar), `tests/e2e/app/plano-acordo.spec.ts` e `tests/e2e/demo/*plano*` (fluxo do CombinarPlano), `tests/e2e/app/jovem-*.spec.ts` (combinados do jovem), `tests/e2e/app/solicitacao-esp.spec.ts` + `tests/e2e/app/jovem-especialista*.spec.ts` (seletor — prováveis asserções de "Selecionado" a varrer), `tests/pdm.test.ts` + `tests/e2e/app/pdm.spec.ts` (projeção/autoria do PDM — invariante na linha 42 do regression-map), `tests/form-surface-convencao.test.ts` (guard da convenção, se combinar-plano migrar).

**A criar:** unit — derivação "N sessões · M dias" (se opção A de feedback); rótulo/ownership por `destino` na linha de instrumento; `JovemCombinados` criar (perfil de render por papel). e2e — header do card navega por clique e por teclado; sheet do combinar-plano com doc aberto rola todo o texto (viewport 360px); seletor mobile: seleção sem "Selecionado", card→perfil, lista abre/fecha animada e topo cedendo; mentor responde o checklist em 1 clique a partir da ficha; jovem cria combinado e o marca feito (papel negado via REST, padrão `relatorios.spec.ts` — prova da policy/RPC nova); PDM: aba mostra proveniência e a linha não se descreve como "documento central". a11y — `aria-pressed`/radio no card-radio, foco no `Etapa`/`FadeTroca`, alvos ≥44px no card clicável, anel `focus-visible` no header-link do mentor-home.

---

### Apêndice — skills carregadas neste recon

`ui-ux-pro-max`, `frontend-ui-engineering`, `better-layout`, `better-accessibility`, `better-interface`, `accessible-animation`, `antislop-copywriting` — aplicadas na anatomia dos cards (squeeze de largura, alvos, nested-interactive), na gramática de motion da 028 (tiering e reduced-motion), na geometria do sticky footer e nas opções de copy pt-BR. Recon feito com 3 subagentes `explorer` (ficha/instrumentos/PDM; combinar-plano; especialista/combinados) + leitura direta dos arquivos citados.
