# Spec — Liza: GenUI com estado, pills vivas e o falso "nem 1 por dia"

**Feature:** `specs/026-liza-genui-pills` · **Status:** Clarified
**Origem:** relato do Thiago (prints 1–5 da /demo e/ou staging, 24/11/2026) · **Recon:** `docs/planos/issues/_recon/liza-2026-11-24.md` · **Dono:** Thiago · **Data:** 24/11/2026

> O QUÊ e o POR QUÊ. Os mecanismos citados (`emDia`, `UiPlano`, `UiDuplaMini`, `DestaqueLinha`, `sugestoes()`, `data-telemetry-alvo`) são âncora do estado atual — API final e nomes de arquivo são do `plan.md`. Sem DDL e sem migration obrigatória: a única candidata (ação nova na whitelist de `produto_eventos`) é evitável — o beacon `clique` + alvo nomeado já cobre o gesto; se o lead quiser ação própria, é decisão dele e não bloqueia nada aqui.
> Skills da rodada: `ui-ux-pro-max`, `frontend-ui-engineering`, `better-interface`, `better-layout`, `antislop-copywriting`, `humanizer`, `supabase`, `better-accessibility`.

## Problema e resultado

- **Dor hoje:** cinco sintomas do relato, todos confirmados no recon:
  1. **Pills mortas:** as sugestões do empty state da Liza são 100% hardcoded por papel+página (`sugestoes()`, `assistente-conversa.tsx:217-257`) — as mesmas 3 perguntas para sempre, sem rotação, sem memória do que já foi clicado, sem telemetria que distinga pill de texto digitado.
  2. **"2 duplas" sem estado:** perguntas de listagem e a desambiguação "qual dupla?" voltam só com nomes — `duplas_do_usuario` é índice de lookup por desenho (sem semáforo, progresso nem próximo encontro) e o ` ```escolha ` renderiza só `rotulo`. Os campos ricos existem na fonte (`projetarResumo`: semáforo, motivo, apoio, feitos/esperado, `proximo_encontro`) e o projetor `saude` simplesmente descarta o próximo encontro (`ui.ts:415-427`).
  3. **Card gigante:** `CardPlano` (`assistente-cards.tsx:871-953`) renderiza todos os passos sem cap, sem estado local, sem colapso nem scroll interno — ~3 linhas por passo, cresce linear e empurra a conversa pra fora da dobra.
  4. **Id cru na tela:** o próprio prompt ensina a pôr `dupla_id` no `valor` da escolha (`prompts.ts:81`) — e o `valor` vira a mensagem visível do usuário ao clicar (`assistente-blocos.tsx:191` → `assistente-conversa.tsx:931`). Secundários: `JSON.stringify` cru ao modelo (`api/ia/chat/route.ts:532`) sem regra anti-id e ~15 `resumo` de tools de escrita interpolando uuid no card de confirmação (`assistente-cards.tsx:1672`).
  5. **"Nem 1 por dia fecha" para quem nasceu em dia:** o planner classifica `conversa`/`conversa_coord` uma dupla da T2 que começou hoje com o 1º encontro marcado no próprio dia oficial — bug de lógica reproduzido no dataset demo (evidência abaixo), não exagero de copy nem dado errado.
- **Resultado observável:** perguntar "como ficar em dia" ou "quais são minhas duplas" devolve cards que nomeiam a dupla, mostram situação, progresso e próximo encontro e levam à ficha; o plano cabe numa dobra com o detalhe a um toque; nenhum uuid aparece em texto nenhum; as pills se renovam entre visitas sem trocar debaixo do dedo; e uma dupla em dia nunca é mandada conversar com a coordenação.
- **Como saberemos que funcionou:** as duplas T2 do dataset demo (`d-t2a`/`d-t2b`) classificam `em_dia`; um `conversa` verdadeiro exibe a data projetada e quantos encontros cabem antes do encerramento, com os caminhos nomeados; nenhum print de conversa casa regex de uuid; duas aberturas do painel mostram pills diferentes e o clique nelas aparece na telemetria como gesto próprio.

## Fora de escopo

- **Chips de continuação do modelo** (fence ` ```sugestoes ` no fim da resposta) — são contextuais por construção, não rotacionam nem entram no catálogo.
- **O card "O combinado" do jovem** (`meu_plano`/`CardPlanoJovem`) e o `PlanoEmDiaCard` da ficha — superfícies próprias; se sobrar vontade, o mesmo padrão de disclosure se aplica numa rodada seguinte.
- **Rotação por timer** das pills — descartada por a11y (troca conteúdo sob foco/dedo/leitor de tela). A rotação é por visita, só no mount do empty state.
- **Pills data-driven por dado real** ("O que falta registrar?" só quando há pendência) — fase 2; exige tool de contexto barata ou payload da página, não é pré-requisito.
- **Persistência servidor-side** do histórico de sugestões — fica no aparelho (localStorage), mesmo princípio das conversas.
- **Mudar `duplas_do_usuario`:** o índice leve segue como está — a query enxuta é consumida também por `mensagem_template`, e o modelo usa a tool pra resolver id. O panorama com estado é tool nova (premissas).
- **Nova ação na whitelist de `produto_eventos`:** evitável via `clique` + `data-telemetry-alvo` (já whitelistado); decisão do lead se quiser granularidade dedicada — não bloqueia a spec.
- Migration, RPC, policy, rota, seed — nenhuma.

## Evidência — o falso "nem 1 por dia" (reprodução do recon)

`montarPlanoEmDia` rodado via `jiti` sobre `getDemoData()` + `cicloEventos`, `hoje = 2026-11-24`, sem `ritmo` (escada automática):

| Dupla | estado | nivel | ritmo | dataRecuperacao | encerramento | cabem | passos |
|---|---|---|---|---|---|---|---|
| Ricardo×Ana (d-ok) | `recuperacao` | ritmo_normal | 1 | 2026-12-17 | 2027-03-05 | 12/12 | travados + venceNoCaminho |
| Carlos×Caio (d-pend) | `recuperacao` | ritmo_normal | 1 | 2026-12-16 | 2027-03-05 | 12/12 | devidos + pendência registro |
| Fernanda×Dandara (d-risco) | `recuperacao` | ritmo_normal | 1 | 2027-02-21 | 2027-03-05 | 14/14 | devidos + travado hoje |
| João×Eduardo (d-atraso) | `recuperacao` | ritmo_normal | 1 | 2026-12-21 | 2027-03-05 | 13/13 | devidos + pendência limbo |
| **André×Kauã (d-t2a, T2)** | **`conversa`** | **`conversa_coord`** | **7** | **null** | 2027-03-05 | **16/16** | **só travados** |
| **Luiza×Laura (d-t2b, T2)** | **`conversa`** | **`conversa_coord`** | **7** | **null** | 2027-03-05 | **16/16** | **só travados** |
| Ricardo×Matheus (d-t2c, T2) | `recuperacao` | ritmo_normal | 1 | 2027-02-21 | 2027-03-05 | 13/13 | travado + pendências |

Cadeia causal confirmada no código (`plano-em-dia.ts`):

1. A dupla T2 está em dia de verdade: 1º encontro agendado para `2026-11-24` (a própria data oficial — a T2 começou hoje), 2º agendado `2026-12-01` (oficial idem). Nada devido, nada pendente.
2. **`emDia` (`:698-701`)** exige `!travados.some(t => t.oficialData <= hojeStr)` — trata "oficial já venceu" como "devido" sem comparar `data > oficialData`. Um passo marcado no dia oficial (ou antes dele) não está atrasado; coberto ≤ oficial nunca gera atraso — é a régua do próprio `alvo` (`:635`).
3. A caminhada cobre tudo cedo → `alvo` fica em `hojeStr` → `dataRecuperacao` só é setada com `alvo > hojeStr` (`:665-677`) → **null por convergência trivial**, não por não-cabeça.
4. `ritmoQueFecha` exige `dataRecuperacao != null` → nenhum ritmo "fecha" → `estado='conversa'`, `nivel='conversa_coord'`, `ritmo` devolvido `=7` (`:721-735`).
5. A `sugestao` (`:797`) afirma "Nem com 1 encontro por dia o plano fecha" — verdade sobre a falha da escada, **mentira sobre a dupla**.
6. "Passos todos travados" é literal: `ultimoAtrasado=0` → `passosPlano` filtra todos os futuros (`:641-652`) → o card exibe só os travados. E o estado `conversa` **esconde a evidência**: `data_projetada`, `cabem_ate_encerramento` e os avisos não saem no `UiPlano` — a UI não consegue explicar o porquê.

**Veredito do recon: bug de lógica** — afeta d-t2a/d-t2b na demo e qualquer dupla real cujo único "devido" seja um passo travado com `oficial <= hoje && data <= oficial`. Não é copy (a frase é verbatim do planner) nem dado demo (a T2 está correta). **Correção na fonte** (planner) + **o `conversa` verdadeiro ganha a evidência que hoje é descartada** — se a conclusão fosse "estado real", a exigência seria a mesma: mensagem honesta e passos destraváveis; sendo bug, os dois lados se corrigem juntos.

## Histórias de usuário

### US1 — "Em dia" nunca vira "conversa com a coordenação" (P0)

- **Por que P0:** é a mentira mais grave do conjunto — classifica errado e ainda manda a pessoa pelo caminho errado, com copy que acusa impossível o que não precisava de esforço nenhum.
- **Teste independente:** `montarPlanoEmDia` sobre `d-t2a`, `d-t2b`, `d-ok`, `d-t2c` do dataset demo e um `conversa` verdadeiro sintético.
- **Cenários:**
  1. **Dado** uma dupla cujo único candidato a "devido" é um passo travado marcado **no dia oficial** (ou antes dele) — a T2 que começou hoje **quando** o planner classifica **então** `emDia=true`, `estado='em_dia'` e nenhuma sugestão de conversa com a coordenação. "Marcado no oficial ou antes" não é atraso; "oficial vencido com data ≤ oficial" idem.
  2. **Dado** um travado marcado **depois** do oficial (oficial 24/11, marcado 03/12 — regressão da `d-ok`) **quando** classifica **então** segue devido: `estado='recuperacao'`, a escada nomeia o ritmo mais leve que fecha e `data_recuperacao` sai 17/12 — o fix não afrouxa o que é atraso de verdade.
  3. **Dado** uma caminhada que converge com `alvo <= hoje` (nada atrasado de fato) **quando** a heurística de travado ainda sinalizasse devido **então** o resultado é `em_dia` — convergência trivial nunca mais cai em `conversa` (segundo guard, cinto e suspensórios).
  4. **Dado** uma dupla que não fecha nem a 1/dia antes do encerramento **quando** classifica **então** `estado='conversa'` **e** o payload expõe `data_projetada` ("em dia só em X, depois do encerramento") e `cabem_ate_encerramento` (`{cabem, faltam}`) — a evidência viaja com o veredito.
  5. **Dado** o estado `conversa` **quando** o plano lista passos **então** inclui os futuros que estouram o encerramento (marcados como tal), não só os travados — o card mostra onde a conta quebra em vez de parecer vazio.
  6. **Dado** a `sugestao` **quando** é montada **então** "nem 1 por dia" + `CAMINHOS_COORD` só saem de `conversa` verdadeiro — e mesmo nele o texto diz quando o plano fecha (`data_projetada`), nunca decreta impossível sem a data.

### US2 — O card "Para ficar em dia" cabe na conversa e diz de quem é (P1)

- **Por que P1:** é o card mais longo do chat e o veículo do bug — hoje não nomeia a dupla, não resume o custo e esconde a evidência do `conversa`.
- **Teste independente:** payload de `plano_em_dia` com 6+ passos, com `conversa` e com `em_dia`, no desktop e no sheet mobile.
- **Cenários:**
  1. **Dado** um plano com mais de 4 passos **quando** o card renderiza **então** a dobra inicial mostra header + meta (veredito), **a identidade da dupla** (nomes, link pra ficha), o resumo de custo (ritmo em palavras via `rotuloRitmo`, "N passos a marcar · M já marcados", `nivel` como pill) e os 4 primeiros passos — o resto fica sob um toggle "Ver os N passos" (`<button>` real, `aria-expanded`, `aria-controls`, molde `FonteItem`), default **fechado**.
  2. **Dado** um plano com ≤4 passos **quando** renderiza **então** mostra tudo aberto — o toggle só existe quando esconde algo.
  3. **Dado** pendências de registro **quando** renderiza **então** o resumo sinaliza "N pendências pra resolver antes" — a lista completa mora no expandido; ninguém descobre o pré-requisito só depois de abrir.
  4. **Dado** estado `conversa` **quando** renderiza **então** o resumo diz "em dia só em {dataProjetada}, depois do encerramento ({encerramento})" e quantos encontros cabem/faltam, com os caminhos nomeados como linhas acionáveis (seguir no ritmo possível, rever o pareamento, encerrar a trilha DPP seguindo com especialista) — nunca só "não fecha".
  5. **Dado** estado `em_dia` **quando** renderiza **então** o meta diz "em dia" (sem depender de `data_recuperacao`) e os passos já marcados aparecem — o estado positivo é explícito, não um card mudo.
  6. **Dado** reduced-motion **quando** o toggle abre/fecha **então** sem animação de altura (o guard global cobre); a 320px a primeira dobra do card cabe em <1 viewport dentro do sheet, sem scroll interno e sem CTA cortado; o rodapé mantém "Ver encontros na ficha" e ganha âncora direta `#plano-em-dia`.

### US3 — "Quais duplas?" com situação, não só nomes (P1)

- **Por que P1:** listar duplas sem estado é a resposta mais comum e menos útil do conjunto — e a informação já existe, é descartada na projeção.
- **Teste independente:** staff pergunta "como estão minhas duplas?"; ambiguidade "mensagem pra dupla da Ana" com duas Anas no escopo.
- **Cenários:**
  1. **Dado** uma pergunta de listagem/panorama **quando** a tool nova `duplas_panorama` responde **então** cada linha traz situação (semáforo + apoio), motivo, "N de M esperados", próximo encontro e nomes — e o card `duplas` linka a ficha de cada uma (≤6 linhas, "Ver todas as duplas" → `/duplas` quando `truncado`).
  2. **Dado** o resumo da semana **quando** o projetor monta os destaques **então** `proximo_encontro` deixa de ser descartado — `UiDuplaMini.proximo` alimenta a mesma linha no card novo e nos destaques existentes.
  3. **Dado** uma desambiguação ("qual dupla?") **quando** a escolha renderiza **então** cada opção pode trazer `detalhe` (linha curta — situação/turma, fato vindo de tool, nunca texto inventado) além do `rotulo`.
  4. **Dado** o índice `duplas_do_usuario` **quando** o modelo só precisa resolver um id **então** shape e custo seguem iguais — o cálculo de saúde por dupla fica na tool nova, não no lookup.
  5. **Dado** um papel fora da allowlist (jovem) **quando** pede panorama **então** a tool não existe pra ele — a recusa honesta de hoje se mantém.

### US4 — Nenhum uuid cru chega à tela (P1)

- **Por que P1:** vazamento visível e **ensinado pelo próprio prompt** — o exemplo oficial pede `dupla_id` dentro do `valor` que vira fala do usuário.
- **Teste independente:** fluxo `mensagem_template` com 2 duplas + qualquer card de confirmação de escrita + grep de uuid nos textos renderizados.
- **Cenários:**
  1. **Dado** uma escolha de dupla **quando** a pessoa clica **então** a mensagem visível contém só o pedido com nomes ("mensagem de preparação pra dupla da Ana") — nunca `dupla_id …`; o modelo resolve o id do contexto, não da fala.
  2. **Dado** o prompt revisado **quando** o modelo escreve prosa, `rotulo` ou `valor` **então** ids aparecem só em `href` e args estruturados de tool — nunca em texto renderizado. O exemplo do ` ```escolha ` é corrigido pra valor-só-nome.
  3. **Dado** qualquer escrita (desmarcar/marcar encontro, chamados, template, solicitações, marcar situação…) **quando** o card de confirmação renderiza `resumo` **então** ele nomeia por nomes ("o 5º encontro de Ana e Ricardo") — zero uuid em todos os pontos interpolados, incluindo o fallback `canonico()`.
  4. **Dado** o tool-result que volta ao modelo **quando** `JSON.stringify` serializa o payload **então** os ids seguem estruturados (o modelo precisa deles pra args) — a regra anti-id vale pra saída, não pro contexto: prosa, blocos e `valor` limpos; `href`/args com id normal.

### US5 — Pills que se renovam a cada visita (P2)

- **Por que P2:** polimento real com critério próprio, mas não bloqueia os itens acima.
- **Teste independente:** abrir o painel vazio duas vezes seguidas na mesma página; clicar pills até esgotar o catálogo.
- **Cenários:**
  1. **Dado** o catálogo `sugestoes(papeis, pagina)` **quando** o empty state monta **então** sorteia 3 de 6–8 opções do contexto — cada pergunta mapeada 1:1 numa tool que aquele papel tem na allowlist (o mapeamento é validado por teste), ≤60 chars, pt-BR sem travessão.
  2. **Dada** uma segunda abertura do painel na mesma página **quando** o catálogo ainda tem itens não sorteados **então** as pills são outras — rotação por visita, sem repetição até esgotar; esgotado, o baralho reseta.
  3. **Dada** uma pill já clicada antes **quando** o sorteio roda **então** ela sai do baralho (localStorage por papel, padrão `liza:falas`) até o reset — a sugestão nunca repete o que já foi perguntado.
  4. **Dado** o usuário lendo/com foco numa pill **quando** o tempo passa **então** nada troca — rotação só no mount; nunca sob foco, hover ou clique, nunca por timer.
  5. **Dado** o clique numa pill **quando** a mensagem vai **então** o gesto é registrado com alvo próprio via `data-telemetry-alvo` no beacon `clique` existente (sem migration), e o envio carrega `origem:"pill"` — a rota distingue sugestão de digitado e registra a origem em `ia_eventos`.
  6. **Dado** o container das pills **quando** renderiza **então** `role="group"` + `aria-label` nomeia a região; `key` por conteúdo se mantém; nenhuma animação nova entra (o stagger `.animate-enter` existente já respeita o guard).

## Casos de borda

- **Dupla pausada, encerrada ou trilha especialista:** `aplicavel:false` segue sem card (invariante atual) — o fix do `emDia` não alcança quem o planner já devolve não aplicável.
- **Dupla recém-nascida em dia após o fix:** `em_dia` com passos só travados — o card mostra "em dia" + os marcados; nunca lista vazia muda nem `conversa`.
- **`conversa` no fim do ciclo com zero passos que estouram:** o card mostra a evidência do encerramento mesmo sem passos — a mensagem não depende de passo pra ser honesta.
- **localStorage indisponível ou corrompido** (modo privado, quota): catálogo inteiro por visita, sem persistência — a rotação segue funcionando na sessão e nunca derruba o empty state.
- **Empty state só existe com `msgs.length===0` e conversa restaurada:** a rotação não afeta conversa em andamento nem transcript.
- **Pill clicada durante stream:** a fila de envio já existente segura o texto (comportamento de hoje) — sem regime novo.
- **Opção de escolha sem dado de situação:** `detalhe` omitido — opcional de verdade; o modelo nunca inventa o detalhe.
- **Contexto com menos de 6 perguntas válidas no catálogo:** mostra o que existe — nunca repete na mesma visita nem fabrica pergunta que nenhuma tool responde.
- **Coordenação com mais de 6 duplas:** cap 6 + `total` honesto + "Ver todas" — o radar completo continua em `/duplas` e `resumo_semana`.
- **Demo com pergunta nomeando dupla** ("e a dupla do Caio?"): `responderDemoIa` resolve a dupla nomeada antes de iterar — a correção da atribuição silenciosa (`demo/ia.ts:226-263`) é caso coberto, não efeito colateral.
- **`valor` de escolha digitável:** a pessoa pode responder a pergunta da escolha por texto livre — a regra anti-id não bloqueia a pessoa, só o modelo e os resumos de sistema.

## Requisitos funcionais

- **FR-001 (planner — devido de verdade):** `emDia` só reprova travado **realmente atrasado**: passo marcado conta como devido quando `data > oficialData`; "oficial já venceu" com data marcada ≤ oficial não é atraso — alinhado à régua `coberto > oficial` do `alvo`.
- **FR-002 (planner — convergência trivial):** caminhada que converge com `alvo <= hoje` implica `em_dia` mesmo se a heurística falhar — `conversa` nunca sai de convergência trivial.
- **FR-003 (planner — conversa com evidência):** `conversa` verdadeiro expõe `data_projetada` e `cabem_ate_encerramento` e inclui nos `passos` os futuros que estouram o encerramento; `sugestao`/`CAMINHOS_COORD` só se aplica a `conversa` real.
- **FR-004 (`UiPlano`):** a tool passa a devolver `mentor`/`mentorado` (a dupla já vem carregada, só não é serializada) e a projeção passa a carregar `mentor`, `mentorado`, `data_projetada`, `cabem_ate_encerramento`, `encerramento`, avisos completos (sem o cap de 3) e, por passo, `encontro_id`, `data_oficial`, `vence_no_caminho` — tudo o que a tool já devolve e o projetor hoje descarta.
- **FR-005 (card colapsável):** header/meta nomeia a dupla com link `/duplas/<id>`; resumo sempre visível com veredito + ritmo em palavras + contagem de passos + `nivel` como pill + contagem de pendências; passos com cap de 4 + toggle `<button>` `aria-expanded`/`aria-controls` (default fechado quando >4, molde `FonteItem`); estado `em_dia` mostra "em dia"; `conversa` mostra data projetada + cabem/faltam + caminhos; sem scroll interno; rodapé "Ver encontros na ficha" + âncora `#plano-em-dia`.
- **FR-006 (`duplas_panorama`):** tool nova com os mesmos roles de `duplas_do_usuario`, devolvendo por dupla `dupla_id, mentor, mentorado, trilha, status, semaforo, motivo, apoio, esperado, feitos, registro_pendente, proximo_encontro{numero,data_hora}` — ≤6 itens ordenados por prioridade de ação (apoio → risco → atenção → ok, mesma régua do `projetarResumo`), com `total`/`truncado` honestos. `duplas_do_usuario` não muda.
- **FR-007 (card `duplas`):** `UiDuplaMini` ganha `proximo` (o projetor `saude` passa a copiar `proximo_encontro`); `UiBloco` novo `kind:"duplas"` renderiza linhas no molde `DestaqueLinha` (pill situação + apoio, nomes, motivo clamp-2, "N de M esperados", próximo encontro, link esticado pra ficha) + rodapé "Ver todas as duplas".
- **FR-008 (`escolha` com detalhe):** `escolhaSchema.opcoes[]` ganha `detalhe` opcional (≤60) renderizado como segunda linha; o prompt instrui `detalhe` = fato da tool (situação/turma), nunca texto livre.
- **FR-009 (prompt anti-id):** a regra explícita passa a ser "ids só em `href` e args de tool — nunca em prosa, `rotulo`, `detalhe` ou `valor`"; o exemplo do ` ```escolha ` vira valor-só-nome; descrições de tools que ensinam "devolve o dupla_id" são revistas no mesmo espírito.
- **FR-010 (resumos de escrita):** todo `resumo` de tool `escreve` nomeia por nomes e número de encontro ("o 5º encontro de Ana e Ricardo") — zero uuid em texto visível, incluindo o fallback `canonico()` que hoje serializa args inteiros.
- **FR-011 (catálogo de pills):** `sugestoes(papeis, pagina)` devolve 6–8 perguntas por contexto, cada uma respondível por uma tool presente na allowlist do papel — o mapa pergunta→tool é dado (não convenção), e um teste cruza catálogo × allowlist × tools existentes pra nunca prometer o que a Liza não responde.
- **FR-012 (rotação por visita):** a cada mount do empty state, lote de 3 por shuffle determinístico sem repetição até esgotar o catálogo do contexto; esgotado, reseta. Nunca por timer, nunca sob foco/hover/clique — a decisão de sorteio acontece no mount e o lote é estável até o unmount.
- **FR-013 (persistência de clicadas):** textos de pill já clicados ficam em `localStorage` por papel (padrão `liza:falas`), saem do sorteio até o catálogo esgotar, e o set reseta junto — falha de parse/escrita degrada pro catálogo inteiro.
- **FR-014 (telemetria de pill):** chips carregam `data-telemetry-alvo` próprio (ex.: `liza-sugestao`) → o clique sai no beacon `clique` existente com a superfície da página; o envio da mensagem carrega `origem:"pill"` num campo opcional novo do `Body` (schema `.strict()` da rota) e a rota registra a origem no evento de `ia_eventos` — distinguindo pill de digitado sem SQL nem migration.
- **FR-015 (a11y do conjunto):** container das pills com `role="group"` + `aria-label`; toggle do card teclado-operável com `aria-expanded`/`aria-controls`; reduced-motion sem animação de altura no toggle e sem animação nova nas pills; a 320px a primeira dobra do card cabe sem scroll interno nem CTA fora do sheet.
- **FR-016 (paridade demo A7):** `responderDemoIa` resolve a dupla nomeada na pergunta antes de iterar (nunca mostra a primeira `!emDia` de outra); o payload demo do "ficar em dia" ganha `estado`, `data_projetada` e `cabem_ate_encerramento`; a rotação de pills é client-side e cobre a demo de graça.

## Requisitos não funcionais

- **RLS/RPC/migration:** nenhuma — todas as leituras passam pelas queries escopadas existentes (`duplas_panorama` reusa `getDuplasVivasIa` + `getCicloEventosIa`, mesma fronteira RLS de `resumo_semana`); `produto_eventos` usa a ação `clique` já whitelistada. Ação dedicada de telemetria é opcional e decisão do lead.
- **A11y:** conforme FR-015; chips ≥ `min-h-9` (piso WCAG 2.5.8, subir pra 44px no touch onde a densidade permitir); nenhum conteúdo depende de cor; o toggle não rouba foco ao abrir/fechar.
- **Perf:** `duplas_panorama` paga `saudadeDaDupla` por dupla do escopo — mesmo custo de `resumo_semana` (queries `cache()` por request); o card capa em 6 linhas + total; `CardPlano` sem scroll interno nem virtualização (passos ≤ ~20 no pior caso); o shuffle é O(catálogo).
- **LGPD:** nada novo — `localStorage` já é o padrão das conversas; o `alvo` de telemetria é rótulo estático do catálogo, nunca texto livre; `origem:"pill"` não é dado pessoal.
- **Prompt/modelo:** a regra anti-id não pode refrear ids em args — args são estruturados no function-calling e o teste de eval cobre; a proibição vale só pra texto renderizado.
- **Demo:** paridade A7 — rotação, payload e atribuição iguais aos do app.
- **Copy:** pt-BR, sem travessão, pill ≤60 (`sugestoesSchema` já exige); "ritmo" nunca na UI (é `rotuloRitmo` — "encontros por semana"); os caminhos do `conversa` nomeados em linguagem de produto, não de mecanismo.

## Entidades e dados

- **`UiPlano`** (projeção tool→UI): ganha `mentor`, `mentorado`, `data_projetada`, `cabem_ate_encerramento`, `encerramento`, `avisos` completos; por passo: `encontro_id`, `data_oficial`, `vence_no_caminho`.
- **`UiDuplaMini`**: ganha `proximo?: {numero, data_hora} | null` — o projetor `saude` copia o `proximo_encontro` que hoje descarta.
- **`UiBloco` `kind:"duplas"`** (novo): `{itens: UiDuplaMini[], total, truncado}` — alimentado por `duplas_panorama` e pelo destaque do `saude`.
- **`BlocoEscolha.opcoes[]`**: `detalhe?: string` opcional ≤60 (schema `escolhaSchema` + `Escolha` renderiza segunda linha).
- **Planner `montarPlanoEmDia`**: predicado de travado devido vira `data > oficialData`; guard novo `convergiu && alvo <= hoje → em_dia`; `passos` do `conversa` inclui futuros que estouram; a tool `plano_em_dia` ganha `mentor`/`mentorado` no payload e já carrega `data_projetada`/`cabem_ate_encerramento` — o grosso da mudança é o projetor parar de descartar.
- **`sugestoes()`**: catálogo por contexto vira estrutura declarada `{texto, tool}` (6–8 por papel×página) — a lista pública segue devolvendo `string[]`; o mapa existe pra validar 1:1 com a allowlist.
- **`localStorage["assistente:sugestoes:vistas"]`**: set de textos clicados por papel (mesmo padrão `liza:falas` — parse tolerante, TTL/dedup igual ao existente onde couber).
- **`Body` do `/api/ia/chat`**: campo opcional `origem:"pill"` (o schema `.strict()` ganha a chave; requests antigas seguem válidas; o valor nunca entra em `messages` nem no prompt).
- **`produto_eventos`**: `acao:"clique"` + `meta.alvo="liza-sugestao"` (+ superfície da página pelo beacon) — sem entrada nova na whitelist.
- **`ia_eventos`**: origem da mensagem registrada na meta do evento da request — distingue pill de digitado na auditoria.

## Critérios de sucesso

- **SC-001 (planner):** `montarPlanoEmDia` sobre o dataset demo: `d-t2a`/`d-t2b` → `em_dia`; `d-ok` → `recuperacao` com `data_recuperacao` 17/12 (regressão); `d-t2c` → `recuperacao`; e `conversa` só sai de dupla que não fecha de verdade — sempre com `data_projetada` + `cabem_ate_encerramento` no payload.
- **SC-002 (ids):** regex `[0-9a-f]{8}-[0-9a-f]{4}-` não casa em nenhum texto visível: `resumo` de toda tool `escreve`, `rotulo`/`valor`/`detalhe` de `escolha`, bolha do usuário após clique e card de confirmação — coberto por teste de unidade + um fluxo e2e.
- **SC-003 (card):** `CardPlano` com >4 passos ocupa <1 viewport fechado a 390px; toggle abre por teclado (`aria-expanded` correto); `conversa` exibe data projetada, cabem/faltam e caminhos; todo card nomeia a dupla com link pra ficha.
- **SC-004 (duplas com estado):** "como estão minhas duplas?" renderiza o card de linhas com situação, motivo, progresso e próximo encontro por dupla + link; `truncado` honesto com "Ver todas"; `escolha` mostra `detalhe` quando a tool o deu.
- **SC-005 (pills):** duas aberturas do painel na mesma página mostram pills diferentes (até esgotar o catálogo); pill clicada não volta até o reset; `produto_eventos`/`ia_eventos` distinguem pill de digitado; nada troca sob foco ou por timer.
- **SC-006 (visual):** prints 390×844 e 1440×900 do card colapsado/expandido, do `conversa` honesto, do card `duplas`, da `escolha` com detalhe e do empty state rotacionado.

## Plano de testes

- **Unit — planner (prioridade):** `tests/plano-em-dia.test.ts`/`src/lib/plano-em-dia.test.ts` — "agendado no dia oficial" e "agendado antes do oficial" não contam como devido; "agendado depois do oficial" segue devido (regressão `d-ok`); convergência trivial → `em_dia`; `conversa` real → `estado` + `data_projetada` + `cabem` + passos que estouram. Linha nova no `docs/regression-map.md` ligando o invariante "em dia ≠ conversa" a este teste.
- **Unit — tools/UI/prompt:** `tests/ia-ui.test.ts` — `UiPlano` com os campos novos e `UiDuplaMini.proximo`; `tests/ia-tools.test.ts` — `resumo` das escritas sem uuid (regex sobre todos os sites) + payload/roles de `duplas_panorama`; `tests/ia-render.test.ts` — `escolha.detalhe` no schema; `tests/ia-prompts.test.ts` — regra anti-id presente e exemplo do `valor` corrigido; `tests/ia-mensagens.test.ts`/`tests/ia-route.test.ts` — `origem:"pill"` aceito pelo `Body` e registrado; `tests/demo-ia.test.ts` — atribuição da dupla nomeada no branch "ficar em dia".
- **Unit — catálogo/rotação:** `sugestoes()` devolve 6–8 por contexto; o mapa texto→tool só aponta pra tool na allowlist do papel; shuffle sem repetição até esgotar; clicadas excluídas até reset; parse quebrado de localStorage = catálogo inteiro.
- **E2E app (`tests/e2e/app/`):** staff pergunta "como a dupla X fica em dia?" → card nomeia a dupla, nasce colapsado com >4 passos, toggle opera; `conversa` mostra evidência + caminhos; fluxo `mensagem_template` com 2 duplas → `escolha` sem uuid na bolha do usuário.
- **E2E demo (`tests/e2e/demo/`):** pills mudam entre duas visitas ao painel; clique em pill envia a pergunta; "e a dupla do Caio?" mostra a dupla nomeada, não a primeira atrasada; card `duplas`/`escolha` com detalhe.
- **Evals:** `tests/evals/casos.json` — caso anti-id (pergunta ambígua → `escolha` com `valor` sem uuid) e caso "como ficar em dia" (resposta cita a dupla nomeada no payload).
- **Reduced motion:** toggle do card abre sem animação de altura sob `prefers-reduced-motion` (herdado do guard via molde `FonteItem`).

## Riscos

1. **`emDia` toca invariante protegida** — o predicado muda o estado devolvido pra duplas com travado no dia oficial em produção. Consumidores a verificar: `escopoDaProposta` só propõe em `recuperacao`; `plano_propor` revalida no servidor; o semáforo não lê `emDia`. O teste de regressão da US1 é a condição de merge — sem ele, o fix não entra.
2. **Escopo de passos no `conversa`** aumenta o payload (futuros que estouram entram na lista) — cap honesto documentado no `plan.md`; o card já resolve isso com o colapso.
3. **Catálogo 6–8 × (papel × página)** pode gerar pergunta sem resposta real — mitigado pelo mapa texto→tool validado em teste; perguntas de guia apontam pra `guia_consulta`.
4. **`duplas_panorama` em escopo grande** paga saúde por dupla — mesmo custo de `resumo_semana` hoje; se a coordenação com 60+ duplas pesar, o `plan.md` decide cap de cálculo × cap de exibição.
5. **Prompt anti-id** pode refrear ids em args — os args são estruturados no function-calling e a regra é explícita sobre valer só pra texto; eval novo cobre.
6. **`detalhe` na `escolha`** pode virar texto inventado — schema ≤60 + prompt restringindo a fato da tool + teste de eval.
7. **`origem:"pill"` no `Body`** — campo novo precisa ser ignorado com segurança por clients antigos e nunca vazar pro prompt (não entra em `messages`); coberto por teste de rota.
8. **Atribuição do print 5** — se `ia_eventos` em staging mostrar que o modelo rodou a tool na dupla errada (em vez do falso negativo), a spec já cobre: card nomeia a dupla + correção da demo + eval de "narrar a dupla do payload". Checar `ia_eventos` antes de implementar é recomendação barata, não bloqueio.

## Premissas

- **O "nem 1 por dia" é bug do planner** (reproduzido no dataset demo), não copy nem dado — corrige na fonte (predicado + guard de convergência trivial). Se a análise de `ia_eventos` revelar atribuição errada no print original, a mitigação (card nomeia dupla + eval) já está dentro da spec — nenhum trabalho extra.
- **`duplas_do_usuario` segue índice leve** — o panorama rico é tool nova (`duplas_panorama`): o índice é consumido por `mensagem_template` e pelo modelo pra resolver id, e o custo de `saudadeDaDupla` por dupla não cabe num lookup. (Alternativa rejeitada: enriquecer a própria tool — paga o custo em todo call e incha o contexto de quem só queria um id.)
- **Telemetria de pill via `clique` + `data-telemetry-alvo`** — a ação já existe na whitelist; ação dedicada seria migration e fica como decisão do lead, não bloqueante.
- **`origem:"pill"`** viaja num campo opcional do `Body` (schema strict ganha a chave) e é registrado em `ia_eventos` — sem SQL.
- **Molde de colapso:** `FonteItem` (`<button>` + `aria-expanded`/`aria-controls` + `AnimatePresence` height auto) — já aceito no codebase e reduced-motion-safe pelo guard global; nenhuma técnica de colapso nova entra.
- **Pills giram só no empty state;** as de continuação do modelo ficam fora — contextuais por construção.
- **Estado `em_dia` no card é explícito** ("em dia" no meta) mesmo sem passos devidos — o silêncio de hoje lê como card quebrado.
