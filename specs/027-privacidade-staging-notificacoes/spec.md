# Spec — Privacidade de avaliações, atraso em staging e notificações legíveis

**Feature:** `specs/027-privacidade-staging-notificacoes` · **Status:** Clarified
**Recon:** `docs/planos/issues/_recon/privacidade-staging-2026-11-24.md` · **Fila:** a numerar no `BACKLOG.md` · **Dono:** Thiago · **Data:** 24/11/2026

> **Decisão do lead (24/11/2026):** o toggle do jovem **continua**; compartilhar é escolha dele. Com a flag desligada, o mentor não lê a linha individual, mas as estrelas continuam compondo a média quantizada. A matriz desta spec é o contrato.

## Problema e resultado

Três frentes pequenas e ortogonais que saíram do mesmo recon:

**Dor hoje.** (a) Em staging, `mentor@realiza.test` abre a ficha e vê todas as avaliações da dupla — sem uma resposta registrada sobre se isso é bug ou intencional, e o dataset (100% opt-in) esconde o estado real da feature. (b) Nenhum login jovem em staging mostra o semáforo em atraso: `jovem@realiza.test` (Ana × Otávio, d1) só cobre "registro pendente"; o estado atraso já existe nas duplas d2/d7/d13, mas nenhuma delas tem conta de jovem. (c) O corpo da notificação trunca em uma linha e o item inteiro é um link — não existe gesto para ler a notificação completa; e "Sugestão confirmada" (título sem contexto) fica indecifrável exatamente por causa disso.

**Resultado observável.** A matriz de visibilidade das avaliações fica escrita como contrato, com o veredito sobre "ver todas"; a seed demo representa os dois estados do toggle do jovem; `jovem@realiza.test` mostra um atraso testável na semana corrente; e qualquer notificação longa se lê inteira dentro do popover, por mouse, toque, teclado e leitor de tela — incluindo entender "sugestão de quê" pelo título.

**Como saberemos que funcionou.** A ficha do Otávio mostra avaliação visível e avaliação oculta na mesma dupla, a média agregada segue aparecendo mesmo com a flag desligada, e nenhum papel fora do jovem consegue mover o toggle (caso negado coberto). `jovem@realiza.test` exibe a pendência de retroativo pelo encontro oficial vencido e a equipe vê a d1 em atenção por atraso. Uma notificação com corpo longo expande "Ler mais"/"Ler menos" sem navegar nem marcar como lida, e o título das notificações mintadas pela confirmação de sugestão identifica quem confirmou e o quê.

## Veredito — "ver todas" não é bug

Leitura definitiva do código (migrations 0071/0090/0092/0125 + `src/lib`): o modelo de privacidade **já existe e é granular por linha**. O que se observa em staging é a combinação de dois comportamentos esperados e um dataset pouco representativo:

1. **Coordenação e auxiliar com supervisão da dupla leem tudo por desenho** — o filtro da flag não se aplica a esses ramos da policy `avaliacoes_select` (`0125:92-106`). Se o observador que reportou era `coord@`/`auxiliar@`, o comportamento é o correto.
2. **O mentor DPP lê a avaliação integral só quando a linha tem `avaliacao_visivel_mentor = true`** — e a seed demo marca `true` em 100% das linhas (`scripts/seed-demo-staging.mjs:734`). Se o observador era `mentor@`, o que ele viu foi o estado "on" do toggle aplicado a todas as linhas — escolha de fixture, não vazamento.
3. **O que seria bug real** — mentor lendo linha com flag `false`, ou integral de avaliação de trilha especialista — não tem evidência hoje e passa a ter guarda explícita (FR-004).

### Matriz de visibilidade (contrato)

| Dado | Jovem (autor) | Mentor DPP da dupla | Coordenação | Auxiliar/supervisor da dupla | Especialista |
|---|---|---|---|---|---|
| Avaliação integral — estrelas, sentimento, avancei, temas, comentário, `pedir_apoio` | sempre (as próprias) | só linha com flag `true` ∧ dupla dele ∧ trilha ≠ especialista | tudo | só duplas supervisionadas | nunca |
| Estrelas de sessão especialista | sim | só `av.estrelas` (via `trilha_do_jovem`, `0125:631+`) | sim | sim | só da própria trilha e só estrelas (view `especialista_avaliacoes`, `0090:123-131`) |
| Média agregada `avaliacao_media_dpp` | lê as próprias | quantizada em 0,5, lote ≥ 3 contando **todas** as linhas da dupla — inclusive as ocultas (`0191:32-50`) | sim | sim | — |
| `avaliacao_links` (convite pendente) | o próprio | não | distribui | não | não |
| `avaliacao_pulses` | o próprio | não | sim | não | não |
| `pedir_apoio` | marca | se a linha está visível | sim, com notificação `apoio_jovem` | sim | não |
| Resumo na retrospectiva (`resumoAvaliacaoJovem`, `starSeries`) | própria | só o que a RLS devolve — linhas invisíveis não entram no agregado client-side | sim | sim | — |
| `/resumo` público (relatório) | — | — | — | — | não entra — só `registros.avaliacao` do mentor (`0110`) |

**O toggle do jovem existe.** Switch "Meu mentor pode ler esta avaliação" no detalhe da avaliação DPP (`jovem-avaliacoes.tsx:295-310`), via `definirVisibilidadeAvaliacao` → RPC `definir_visibilidade_avaliacao` (`0071:379-393`), escopada a `my_mentorado_id()` — só o próprio jovem liga/desliga; coordenação não pode coagir nem herdar. Otimista na UI com rollback no erro; o jovem pode responder sem decidir (flag default `false`).

**O que "invisível" esconde — e o que não esconde.** Com a flag desligada, a linha inteira some da visão do mentor: `avaliacao_jovem` volta `null` no embed da ficha (estrelas, sentimento, avancei, temas, comentário, `pedir_apoio`), e a avaliação não entra na trajetória nem em `temasTop` do que ele vê (`actions.ts:1057-1119`). **Mas as estrelas da linha oculta continuam alimentando a média** — `avaliacao_media_quantizada` (`0191:32-50`) conta `count(*)` e tira `avg` sobre todas as linhas da dupla, sem filtro de flag. Isso é desenho, não descuido: excluir a oculta do lote faria o toggle reabrir a janela do lote e derrotaria o anti-differencing (k = n/3·3 + quantização a 0,5). Ou seja, "só na média" é literalmente verdade — inclusive quando a oculta é uma das ≥3 do lote. Para jovem, coordenação, supervisor e especialista nada muda — a flag filtra apenas o ramo mentor DPP da policy. Duas ressalvas de copy: com menos de 3 avaliações não existe média alguma — "voltou a valer só na média" é mentira nesse caso; e o jovem pode ler "invisível" como "some de tudo", quando as estrelas seguem no agregado (FR-003 cobre as duas).

## Fora de escopo

- **Mudança no modelo de privacidade** — a regra existe e esta spec a trava como contrato; nenhuma policy, coluna ou RPC de autorização muda.
- **Página `/notificacoes` ou "carregar mais"** — hoje só as 15 mais recentes são alcançáveis (`listarNotificacoes`, top-15 desc); o resto fica inacessível. Gap registrado, merece issue própria — a expansão desta spec não finge resolver isso.
- **Backfill de notificações já mintadas** — rows de `notificacoes` são imutáveis pelo guard da 0019 (só `lida_em` atualiza); o texto antigo segue como está, legível via expansão.
- **Notificações do jovem por outros canais** (push, e-mail, WhatsApp) — fora do produto hoje.
- **Login de staff adicional em staging** — contas já existem; só entra a conta nova de jovem se a opção C for adotada.
- **E2E/demo em produção** — seed é exclusiva de staging (guarda já existente).

## Histórias de usuário

### US1 — Dataset honesto e guarda da privacidade (jovem / mentor / QA)

**Por que P1:** sem resposta registrada, "o mentor vê tudo" vira bug eterno; e com 100% opt-in na seed, ninguém — dev, QA ou demo — vê o estado que é o padrão real (flag `false`).

**Teste independente:** rodar a seed em staging e abrir a ficha de Ana como `mentor@realiza.test`: aparecem avaliações visíveis e pelo menos uma oculta (só a média agregada cobre os números); a média quantizada segue liberada com ≥ 3 avaliações.

**Cenários:**

- **Dado** que a seed roda, **quando** o Otávio abre a ficha da Ana, **então** vê avaliações com flag `true` integralmente e as com flag `false` não aparecem — mas a média agregada aparece igual.
- **Dado** a Ana com menos de 3 avaliações respondidas, **quando** ela desliga o toggle, **então** a copy não promete "só na média" — diz que o mentor deixa de ver a avaliação (e a média ainda nem existe).
- **Dado** uma conta que não é o próprio jovem (outra jovem, mentor, coord), **quando** chama `definir_visibilidade_avaliacao`, **então** a RPC recusa — caso negado testado.

### US2 — Jovem com atraso testável em staging (QA / demo / coordenação)

**Por que P1:** o estado "atraso" do semáforo — e as pendências que o jovem vê por causa dele (`registro_retroativo`, `encontro_sem_desfecho`) — não tem hoje nenhum login jovem para ser exercitado.

**Teste independente:** logar como `jovem@realiza.test` em staging e ver a pendência de retroativo do encontro oficial vencido sem row; como `coord@`, ver a d1 em atenção por atraso-1.

**Cenários:**

- **Dado** a seed nova rodada, **quando** é terça-feira ou depois dentro da semana corrente, **então** a d1 mostra atraso-1 (encontro oficial desta semana vencido sem row) e a Ana vê "Vocês se encontraram?" para o número em falta. Se a variante `proximo: false` for adotada, domingo–segunda também mostra o preventivo "oficial da semana sem agendamento" — com enc. 7 agendado o gate `!proximo` suprime o preventivo, o que é o comportamento real ("a próxima já está marcada").
- **Dado** a seed rodada duas vezes seguidas, **quando** se compara o estado, **então** é idêntico — `limpar()` apaga e recria só o range `de000000-*`; nada do range `e2e00000-*` é tocado.
- **Dado** `.env.local` apontando para staging, **quando** a seed roda, **então** executa; **quando** aponta para produção, **então** a guarda existente aborta antes de qualquer write.

### US3 — Notificação longa legível no popover (qualquer papel)

**Por que P1:** o corpo trunca em uma linha e o item inteiro é um link — não há gesto para ler; o único escape hoje é adivinhar pelo título.

**Teste independente:** receber (ou semear no demo) uma notificação com corpo de 3+ linhas e ler o texto completo dentro do popover, sem navegar e sem a notificação ser marcada como lida.

**Cenários:**

- **Dado** uma notificação cujo corpo excede o clamp, **quando** o usuário aciona "Ler mais" (mouse, toque ou Enter/Espaço no toggle focado), **então** o corpo expande in-place com `aria-expanded` atualizado — e o item continua clicável para navegar/marcar lida.
- **Dado** a mesma notificação em zoom 200% ou viewport 320px, **quando** o popover abre, **então** título, corpo expandido e toggle cabem sem overflow horizontal.
- **Dado** uma notificação com corpo curto ou `null`, **quando** renderiza, **então** nenhum toggle aparece — não se promete expansão que não existe.

### US4 — "Sugestão confirmada" diz o quê (coordenação)

**Por que P2:** o título sozinho ("Sugestão confirmada") é ambíguo — sugestão de quê, confirmada por quem? Com a expansão do US3 o corpo já resolve, mas o título é o que o sino mostra na lista e o que uma futura superfície (e-mail, push) herdaria.

**Teste independente:** confirmar uma sugestão de especialista e ler no título da notificação quem confirmou e o que foi confirmado — sem depender do corpo.

**Cenários:**

- **Dado** uma sugestão de especialista registrada por um mentor, **quando** ela é confirmada e a notificação chega ao autor da sugestão, **então** o título identifica quem confirmou e o que foi confirmado, e o corpo diz o próximo passo (o pedido seguiu / a trilha começou) — sem ambiguidade "sugestão de quê".

## Casos de borda

- **Corpo `null` ou curto** — sem toggle; o item renderiza como hoje.
- **Corpo gigante** — `sol_notificar` já corta em 1000 chars (`0125:617`); o expandido mostra o corpo inteiro que existe; não se adiciona scroll interno ao popover.
- **Notificação sem `href`** — permanece botão; o toggle convive sem mudar o gesto.
- **Expandir não marca lida** — expansão é gesto de leitura local; "lida" segue pelos gestos existentes (abrir o link / "Marcar como lida").
- **Estado de expansão não persiste** — é visual/local, não vira coluna nem preferência; reabrir o popover volta clampado.
- **Leitor de tela hoje já lê o corpo inteiro** — o texto clampado segue no DOM; o que falta é o gesto visual. Requisito é não piorar: o corpo expandido segue em fluxo de leitura e o toggle anuncia estado.
- **Jovem com < 3 avaliações** — não existe média para "valer só na média"; copy precisa ser honesta nos dois lados do lote.
- **Mentor híbrido (dpp + especialista)** — autocensura já implementada: a integral das sessões de trilha especialista dele nunca aparece; o mix da seed não altera isso.
- **Fixture degrada sem reseed** — com atraso intencional na d1, o contador cresce a cada terça oficial vencida (atraso-1 → -2 → risco). Aceito: o reseed recalibra, e a degradação é o próprio comportamento real do semáforo.
- **Reseed durante e2e do preview** — ranges separados (`e2e00000-*` intocado); sem conflito.

## Requisitos funcionais

- **FR-001:** A matriz da seção "Veredito" é o contrato. Qualquer divergência observada entre ela e o comportamento do app é bug — e passa a existir resposta única para "é bug ou intencional".
- **FR-002:** A seed demo gera mix `avaliacao_visivel_mentor`: toda dupla DPP demo com ≥ 3 avaliações respondidas tem ao menos uma linha `false`, e a d1 (Ana × Otávio) mostra os dois estados na ficha do Otávio. Regra determinística por número do encontro (ex.: oculta a avaliação mais recente respondida, ou `i % 3 === 0`) — o importante é reprodutível e coberto.
- **FR-003:** Copy de privacidade honesta nos dois lados do lote — `PRIVACIDADE_AVALIACAO.dpp`, o texto do toggle e os toasts ("Seu mentor agora lê esta avaliação." / "Voltou a valer só na média.") não prometem média quando `n < 3`. Versão sugerida para o caso "sem média ainda": "Seu mentor deixa de ver esta avaliação. Ainda não há média para ele ver."
- **FR-004:** O toggle segue exclusivo do jovem — `definir_visibilidade_avaliacao` escopada a `my_mentorado_id()`; caso negado (outra jovem, mentor ou coord chamando a RPC) recusado e coberto por teste.
- **FR-005:** `PLANO_ENCONTROS[D.d1]` passa a gerar atraso testável na semana corrente. Mudança sugerida (opção B′): `{ feitos: 5, hora: "19:00", proximo: true, duracao: 90, pendente: 5, avalPendente: 5 }` e repontar a exceção do patch de `avaliacao_links` do enc. 6 para o enc. 5 (`uid((0x300 << 8) + 5)` em `:874-876`). Resultado: enc. 6 oficial da semana vence sem row → **atraso-1 de terça em diante** + `registro_retroativo` na home da Ana ("O 6º encontro era na semana de dd/mm… Vocês se encontraram?") + registro pendente no enc. 5 + avaliação pendente viva no enc. 5. Duas correções ao recon: **(a)** a opção A literal (`proximo: false` apenas, 1 linha) **só produz atraso a partir da terça da semana seguinte** — o vigente que fica sem row é o enc. 7, cujo oficial é a próxima terça (`dataT1(7)`); "de quarta em diante" está uma semana adiantado; **(b)** com `proximo: true` o preventivo **não** dispara — o enc. 7 agendado satisfaz o gate `!proximo` (`ciclo.ts:1936`), que lê "a dupla já marcou algo" sem olhar o número. Se o preventivo na d1 também for desejado, usar `proximo: false` (ritmo idêntico ao d2: preventivo dom–seg + atraso ter–sáb) — custo: a ficha fica sem próximo agendado, o que também é a história ("vigente sem data"). A opção A (âncora 100% intacta) fica como fallback se a d1 não puder perder o enc. 6.
- **FR-006:** Reseed idempotente e seguro — mantém o range `de000000-*`, o `limpar()` prévio e a guarda de produção (aborta se o ref for o de prod); o mapa de cenários do cabeçalho do script (`:13-48`) é atualizado para descrever a d1 nova. Se adotada, a opção C (login `larissa.campos@realiza.test` para a d13, já em risco hoje) é uma linha em `garantirAuthUser` — entrega um segundo jovem em atraso real desde já, sem custo de fixture.
- **FR-007:** Notificação com corpo que excede o clamp se lê completa dentro do popover — `line-clamp-2` no corpo + toggle "Ler mais"/"Ler menos", ou `<details>` nativo equivalente. O gesto de expandir é distinto do de navegar: nem navega, nem marca como lida, nem fecha o popover.
- **FR-008:** O toggle é irmão do link dentro do `<li>` (nunca aninhado em `<a>`): `type="button"`, `aria-expanded`, `aria-controls` → id do corpo, rótulo visível em pt-BR, na ordem de tab natural, área de toque ≥ 24px (≥ 44px no mobile). Só aparece quando há o que expandir (medição de overflow ou heurística — detalhe de implementação).
- **FR-009:** A estrutura do item se reorganiza para acabar com o clique ambíguo: o link/botão cobre ícone + título + tempo; o corpo sai de dentro do link e vira bloco irmão (clicar no texto do corpo não navega). A marca `sr-only` "Não lida" e o botão "Marcar como lida" seguem funcionando.
- **FR-010:** `title` com o corpo completo no elemento do corpo como piso de um atributo — complemento ao toggle, não substituto (mobile e teclado não têm hover).
- **FR-011:** A notificação mintada em `confirmar_sugestao_especialista` (`0086:271-276`) passa a identificar no título quem confirmou e o quê — ex.: `"<Nome> confirmou a sua sugestão de especialista"`, e o corpo traz o próximo passo (e a demanda, se couber sem redundância). Dois caminhos, decisão de implementação: **(a)** re-emissão da função em migration nova — alçada do lead, SQL sugerido abaixo — afeta só notificações futuras; **(b)** reescrita na leitura, no molde de `relerPlanoPropostoDeMembro` (`src/lib/notificar.ts`), que cobre também as rows antigas sem migration. Recomendado: (a) para a mint + (b) se houver volume antigo relevante.
- **FR-012:** Mesmo passe nos demais títulos que exigem corpo para fazer sentido — critério: o título sozinho responde "o quê, de quem".

SQL sugerido para FR-011(a) — alçada do lead, arquivo novo na próxima lacuna:

```sql
-- dentro de confirmar_sugestao_especialista, substituir o sol_notificar:
perform sol_notificar(
  s.created_by,
  'solicitacao_registrada',
  format('%s confirmou a sua sugestão de especialista', v_nome_quem),
  format('A sugestão%s seguiu para a coordenação. Você recebe o retorno por aqui.',
         coalesce(' (tema: ' || s.demanda || ')', '')),
  format('/duplas/%s', v_dpp), p_solicitacao);
```

*(verificar a variável real do nome de quem confirma e o campo `demanda` na função vigente antes de escrever a migration — sugestão de conteúdo, não texto final.)*

## Requisitos não funcionais

- **RLS/RPC:** nenhuma policy muda; o toggle continua RPC escopada a `my_mentorado_id()`; a autorização segue no banco (constitution A2) — e passa a ter o caso negado que o regression-map cobra (`docs/regression-map.md`, gap das 251 policies).
- **A11y:** gestos distintos para expandir e navegar; toggle alcançável por teclado com foco visível e `aria-expanded`/`aria-controls`; área de toque ≥ 24px/44px; expansão sem animação obrigatória (respeita reduced-motion); nada depende só de cor. `conventions-ui.md`: metadado trunca, texto importante não — o corpo da notificação é texto importante.
- **Copy:** pt-BR, sem travessão em texto exibido; "Ler mais"/"Ler menos" (ou equivalente); títulos de notificação respondem "o quê, de quem" sozinhos.
- **LGPD:** nenhum dado novo — flag, seed e expansão usam o que já existe; o toggle reforça o princípio do mínimo (padrão `false`).
- **Demo (`/demo`):** paridade obrigatória (A7) — `comAvaliacaoJovem` já replica os cortes da RLS; o dataset em memória ganha o mix on/off nas avaliações e ao menos uma notificação de corpo longo + a "Sugestão confirmada" para o toggle ser demonstrável.
- **Perf:** expansão é estado local por item — sem request, sem N+1; a lista segue renderizando as 15 sem custo extra.
- **Seed:** nunca produção — guarda de ref mantida; critérios de reset e idempotência documentados no cabeçalho do script.

## Entidades e dados

- `avaliacoes_encontro.avaliacao_visivel_mentor` — bool, default `false`, existente (0071). Per-row opt-in do jovem. Nenhuma mudança de schema.
- `avaliacoes_encontro` (linha integral) — cortada pela policy `avaliacoes_select` conforme a matriz; agregado `avaliacao_media_dpp` independente da flag.
- `avaliacao_links` — o patch de exceção `pendente → expirado` da seed (`:874-876`) precisa apontar para um encontro que exista na d1 nova (enc. 5), senão a avaliação pendente vira `expirado`.
- `notificacoes` — `corpo` ≤ 1000 chars (`sol_notificar`); rows imutáveis exceto `lida_em` (guard da 0019). Nenhuma coluna nova.
- `PLANO_ENCONTROS` / `D.d1` — fixture da seed; cenário passa de "registro pendente" para "registro pendente + atraso + avaliação pendente", documentado no mapa do cabeçalho.
- Expansão da notificação — estado client-side por item, não persistido.

## Critérios de sucesso

- **SC-001:** Em staging, `mentor@` vê na ficha da Ana ao menos uma avaliação integral e ao menos uma ausente pela flag — e a média agregada aparece mesmo com a oculta.
- **SC-002:** Resposta única registrada para "ver todas": intencional por RLS (coord/supervisor) + dataset 100% opt-in (mentor); a seed deixa de esconder o estado real.
- **SC-003:** `jovem@realiza.test` mostra `registro_retroativo` do encontro oficial vencido a partir de terça (e, com `proximo: false`, o preventivo dom–seg antes disso) e mantém avaliação pendente + registro pendente — tudo reseedável com `node scripts/seed-demo-staging.mjs`.
- **SC-004:** Dois reruns seguidos da seed produzem estado idêntico no range `de000000-*`; nada fora do range muda; a guarda aborta com ref de produção.
- **SC-005:** Qualquer notificação com corpo truncável expande e recolhe in-place por mouse, toque e teclado, com `aria-expanded` correto — sem navegar nem marcar lida.
- **SC-006:** O título da notificação de confirmação de sugestão responde sozinho "quem confirmou o quê".
- **SC-007:** Caso negado coberto: `definir_visibilidade_avaliacao` chamada por papel que não é o próprio jovem é recusada — em e2e e/ou teste DB-level (piloto do gap do regression-map).

## Plano de testes

**Unit (Vitest):** regra do mix da seed (determinismo do on/off por número); heurística "corpo excede o clamp" se for função pura; formatação do novo título da notificação.

**E2E app (Playwright):** estender `tests/e2e/app/avaliacao.spec.ts:370-397` — mentor na ficha com linha flag-off ausente + média visível; caso negado do toggle por papel errado; notificação longa expande por teclado, `aria-expanded` alterna, link do item ainda navega, expansão não marca lida.

**E2E demo (paridade):** dataset demo com mix on/off (a oculta some da ficha), notificação longa e a "Sugestão confirmada" novas — mesmo caminho feliz do app.

**Regressão:** semáforo (atraso/preventivo por `proximo`, `pendente`, `feitos`), home do jovem (`registro_retroativo`, `encontro_sem_desfecho`), popover de notificações (lida, navegação, Esc), RPC `definir_visibilidade_avaliacao`, view `especialista_avaliacoes`.

## Riscos

- **Mix "off" lido como dado sumido** — quem assiste a demo pode achar que a avaliação desapareceu; é o comportamento real, e a ficha do mentor passa a ensiná-lo. Mitigação: SC-001 verificado na mesma tela que mostra a média.
- **Exceção do patch esquecida** — repontar `encAna6 → enc. 5` é o passo que mantém a avaliação pendente viva; se esquecido, ela vira `expirado` silenciosamente. Coberto por FR-005 + SC-003.
- **Opção A adotada por economia** — produz atraso só na semana seguinte (correção registrada em FR-005); se a âncora da d1 for intocável, aceitar o atraso diferido + a opção C cobre o "testável hoje".
- **Toggle dentro do link** — aninhamento interativo é inválido (HTML + a11y); FR-008/FR-009 exigem a reestruturação como irmão. Custo: o item inteiro deixa de ser uma parada única de teclado — aceito, é o preço do gesto distinto.
- **Copy "<3 avaliações" esquecida** — o toast atual mente nesse caso; FR-003 lista os quatro pontos de texto a revisar.
- **Fixture degrada** — o atraso intencional cresce a cada terça sem reseed (atenção → risco). É o comportamento real; o reseed recalibra.

## Premissas

- **"Ver todas" é comportamento esperado + dataset pouco representativo** (veredito acima). Se surgir evidência de mentor lendo linha flag-off, vira bug — e a guarda do FR-004 passa a detectá-lo.
- **Mix on/off adotado** em vez de "tudo opt-in" — decisão de produto assumida para a seed demo; alternativa seria manter 100% e documentar a resposta.
- **Opção B′ adotada para a d1** (atraso já nesta semana, âncora de registro pendente preservada no enc. 5) — o enc. 6 integral sai do dataset, o que muda a âncora originalmente desenhada; se isso for inaceitável, cair para A + C.
- **Expansão in-place adotada** (toggle/details) em vez de página dedicada — o gap do top-15 segue registrado para issue própria.
- **"Sugestão confirmada" corrigida na mint e/ou na leitura** — não basta `title` attribute; o texto exibido precisa carregar o contexto.
- **Expansão é leitura local** — não persiste, não vira dado, não marca lida.
