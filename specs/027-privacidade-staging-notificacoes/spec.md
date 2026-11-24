# Spec — Privacidade de avaliações, atraso em staging e notificações legíveis

**Feature:** `specs/027-privacidade-staging-notificacoes` · **Status:** Clarified
**Recon:** `docs/planos/issues/_recon/privacidade-staging-2026-11-24.md` · **Fila:** a numerar no `BACKLOG.md` · **Dono:** Thiago · **Data:** 24/11/2026

> **Decisão do lead (24/11/2026):** o mentor DPP vê **somente a média agregada** das avaliações. Nenhuma avaliação individual — estrelas, texto, sentimento, temas ou `pedir_apoio` — é exposta a ele, independentemente da flag da linha. O toggle "Meu mentor pode ler esta avaliação" sai da UI; a coluna `avaliacao_visivel_mentor` permanece por compatibilidade, sem uso no ramo mentor. Coordenação e auxiliar com supervisão seguem como hoje. Esta decisão substitui o veredito anterior da spec.

## Problema e resultado

Três frentes pequenas e ortogonais que saíram do mesmo recon:

**Dor hoje.** (a) Em staging, `mentor@realiza.test` abre a ficha e vê todas as avaliações da dupla; o produto decidiu que o mentor deve ver **apenas a média**, não as respostas individuais. (b) Nenhum login jovem em staging mostra o semáforo em atraso: `jovem@realiza.test` (Ana × Otávio, d1) só cobre "registro pendente"; o estado atraso já existe nas duplas d2/d7/d13, mas nenhuma delas tem conta de jovem. (c) O corpo da notificação trunca em uma linha e o item inteiro é um link — não existe gesto para ler a notificação completa; e "Sugestão confirmada" (título sem contexto) fica indecifrável exatamente por causa disso.

**Resultado observável.** O mentor DPP vê a média quantizada e nenhuma linha individual; a UI do jovem não promete mais um toggle que não controla a leitura do mentor; a seed demo deixa de esconder o estado real; `jovem@realiza.test` mostra um atraso testável na semana corrente; e qualquer notificação longa se lê inteira dentro do popover, por mouse, toque, teclado e leitor de tela — incluindo entender "sugestão de quê" pelo título.

**Como saberemos que funcionou.** A ficha do Otávio mostra a média agregada e nenhuma avaliação individual; coordenação e auxiliar seguem com o recorte atual; a seed de staging tem uma avaliação oculta e uma visível para provar que a média cobre as duas; `jovem@realiza.test` exibe a pendência de retroativo pelo encontro oficial vencido e a equipe vê a d1 em atenção por atraso. Uma notificação com corpo longo expande "Ler mais"/"Ler menos" sem navegar nem marcar como lida, e o título das notificações mintadas pela confirmação de sugestão identifica quem confirmou e o quê.

## Decisão e contrato

A leitura de código (0071/0090/0092/0125 + `src/lib`) encontrou um modelo granular por linha: coordenação e auxiliar com supervisão leem tudo; o mentor DPP lia a linha integral quando `avaliacao_visivel_mentor = true`; a seed marcava `true` em 100% das linhas. **O produto agora fecha outra direção:** o mentor não lê nenhuma avaliação individual. Ele recebe apenas a média quantizada, com lote mínimo de 3 e todas as linhas da dupla (inclusive as que estavam ocultas), preservando o anti-differencing.

Consequências:
- a policy/consulta do mentor deixa de projetar a linha de `avaliacoes_encontro` (estrelas, sentimento, avancei, temas, comentário, `pedir_apoio`);
- o toggle do jovem sai da UI; a coluna `avaliacao_visivel_mentor` fica como legado sem efeito no ramo mentor;
- coordenação e auxiliar com supervisão mantêm o comportamento atual;
- a média continua existindo só com `n >= 3`; com menos, a ficha não mostra média nem avaliação individual.

## Matriz de visibilidade (contrato)

| Dado | Jovem (autor) | Mentor DPP da dupla | Coordenação | Auxiliar/supervisor da dupla | Especialista |
|---|---|---|---|---|---|
| Avaliação integral — estrelas, sentimento, avancei, temas, comentário, `pedir_apoio` | sempre (as próprias) | **nunca** (só a média agregada) | tudo | só duplas supervisionadas | nunca |
| Estrelas de sessão especialista | sim | **nunca** | sim | sim | só da própria trilha e só estrelas (view `especialista_avaliacoes`, `0090:123-131`) |
| Média agregada `avaliacao_media_dpp` | lê as próprias | quantizada em 0,5, lote ≥ 3 contando **todas** as linhas da dupla — inclusive as ocultas (`0191:32-50`) | sim | sim | — |
| `avaliacao_links` (convite pendente) | o próprio | não | distribui | não | não |
| `avaliacao_pulses` | o próprio | não | sim | não | não |
| `pedir_apoio` | marca | **nunca** | sim, com notificação `apoio_jovem` | sim | não |
| Resumo na retrospectiva (`resumoAvaliacaoJovem`, `starSeries`) | própria | só a média agregada, nunca a linha | sim | sim | — |
| `/resumo` público (relatório) | — | — | — | — | não entra — só `registros.avaliacao` do mentor (`0110`) |

**O toggle do jovem sai.** O switch "Meu mentor pode ler esta avaliação" (`jovem-avaliacoes.tsx:295-310`) e a RPC `definir_visibilidade_avaliacao` deixam de ser oferecidos na avaliação DPP. A coluna `avaliacoes_encontro.avaliacao_visivel_mentor` permanece por compatibilidade, mas o ramo mentor não a usa mais. O jovem continua sendo o único dono da própria avaliação; coordenação/auxiliar seguem o recorte já existente.

**O que a média esconde e o que ela mostra.** A média é quantizada em 0,5 e só aparece com lote mínimo de 3 avaliações da dupla; todas as linhas entram, inclusive as que antes estavam ocultas. O mentor nunca recebe a linha individual, nem para "dar contexto" — qualquer texto, estrela ou tema individual é cortado na projeção/RLS. Com menos de 3, a ficha não promete média: mostra o estado honesto de "sem média ainda".

## Fora de escopo

- **Mudança no recorte de coordenação/auxiliar** — eles seguem lendo as linhas que a policy atual permite; esta spec só retira o integral do mentor DPP.
- **Página `/notificacoes` ou "carregar mais"** — hoje só as 15 mais recentes são alcançáveis (`listarNotificacoes`, top-15 desc); o resto fica inacessível. Gap registrado, merece issue própria — a expansão desta spec não finge resolver isso.
- **Backfill de notificações já mintadas** — rows de `notificacoes` são imutáveis pelo guard da 0019 (só `lida_em` atualiza); o texto antigo segue como está, legível via expansão.
- **Notificações do jovem por outros canais** (push, e-mail, WhatsApp) — fora do produto hoje.
- **Login de staff adicional em staging** — contas já existem; só entra a conta nova de jovem se a opção C for adotada.
- **E2E/demo em produção** — seed é exclusiva de staging (guarda já existente).

## Histórias de usuário

### US1 — Mentor vê média, não respostas (jovem / mentor / QA)

**Por que P1:** é a decisão de privacidade que o produto fechou; sem ela o mentor continua lendo texto individual e o jovem não tem controle real sobre o que compartilha.

**Teste independente:** rodar a seed em staging e abrir a ficha de Ana como `mentor@realiza.test`: aparece a média agregada (lote ≥ 3) e nenhuma linha individual; como coordenação/auxiliar, o recorte atual continua.

**Cenários:**

- **Dado** que a seed roda, **quando** o Otávio abre a ficha da Ana, **então** vê somente a média quantizada — nenhum card/linha de avaliação individual, nenhuma estrela, texto, tema ou pedido de apoio.
- **Dado** uma avaliação com flag `false` ou `true`, **quando** a média é calculada, **então** as duas entram no lote (se houver ≥ 3) e a média é a mesma; o mentor não distingue quais linhas existem.
- **Dado** a Ana com menos de 3 avaliações respondidas, **quando** a ficha do mentor renderiza, **então** não há média e a copy diz que ainda não há média — nunca uma média inventada nem uma linha individual.
- **Dado** uma conta que não é o próprio jovem (outra jovem, mentor, coord), **quando** tenta alterar a visibilidade, **então** a RPC/action recusa — caso negado coberto; a UI do jovem não oferece mais o toggle.

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
- **Mentor híbrido (dpp + especialista)** — o corte do mentor vale para as duas trilhas: nenhuma linha individual, só a média quando houver lote; a flag legada não altera isso.
- **Fixture degrada sem reseed** — com atraso intencional na d1, o contador cresce a cada terça oficial vencida (atraso-1 → -2 → risco). Aceito: o reseed recalibra, e a degradação é o próprio comportamento real do semáforo.
- **Reseed durante e2e do preview** — ranges separados (`e2e00000-*` intocado); sem conflito.

## Requisitos funcionais

- **FR-001:** A matriz desta spec é o contrato. O mentor DPP NUNCA recebe linha individual de avaliação (estrelas, sentimento, avancei, temas, comentário, `pedir_apoio`); recebe somente a média agregada `avaliacao_media_dpp`, quantizada em 0,5 e com lote mínimo de 3, contando todas as linhas da dupla.
- **FR-002:** A projeção/RLS do ramo mentor deixa de expor `avaliacoes_encontro`; a média continua vindo da RPC/agregado existente. Nenhuma tela do mentor pode receber a linha integral por embed, action ou view — teste negativo cobre `select` direto e a ficha.
- **FR-003:** O toggle "Meu mentor pode ler esta avaliação" sai da UI do jovem e a action `definirVisibilidadeAvaliacao` deixa de ser oferecida para DPP. A coluna `avaliacao_visivel_mentor` permanece por compatibilidade, sem efeito no ramo mentor; coordenação/auxiliar seguem o recorte atual.
- **FR-004:** Com menos de 3 avaliações não existe média; a ficha do mentor mostra o estado "sem média ainda" e nunca uma linha individual. A copy do jovem explica que a resposta individual não é exibida ao mentor e que a média só aparece com 3 ou mais avaliações.
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

- **RLS/RPC:** a policy do ramo mentor muda para não expor `avaliacoes_encontro`; a média segue em RPC definer. A autorização continua no banco (constitution A2); o caso negativo do antigo toggle vira teste de regressão da nova matriz.
- **A11y:** gestos distintos para expandir e navegar; toggle alcançável por teclado com foco visível e `aria-expanded`/`aria-controls`; área de toque ≥ 24px/44px; expansão sem animação obrigatória (respeita reduced-motion); nada depende só de cor. `conventions-ui.md`: metadado trunca, texto importante não — o corpo da notificação é texto importante.
- **Copy:** pt-BR, sem travessão em texto exibido; "Ler mais"/"Ler menos" (ou equivalente); títulos de notificação respondem "o quê, de quem" sozinhos.
- **LGPD:** nenhum dado novo; a exposição ao mentor diminui (média em vez de linha). A flag existente permanece como legado sem uso no ramo mentor.
- **Demo (`/demo`):** paridade obrigatória (A7) — `comAvaliacaoJovem` replica o corte do mentor (sem linha individual, só média); o dataset em memória mantém pelo menos uma avaliação oculta para provar que a média a cobre e uma notificação de corpo longo + a "Sugestão confirmada".
- **Perf:** expansão é estado local por item — sem request, sem N+1; a lista segue renderizando as 15 sem custo extra.
- **Seed:** nunca produção — guarda de ref mantida; critérios de reset e idempotência documentados no cabeçalho do script.

## Entidades e dados

- `avaliacoes_encontro.avaliacao_visivel_mentor` — bool, default `false`, existente (0071). Legado sem efeito no ramo mentor; nenhuma mudança de schema nesta rodada.
- `avaliacoes_encontro` (linha integral) — cortada da projeção do mentor; coordenação/auxiliar conforme a matriz; agregado `avaliacao_media_dpp` independente da flag.
- `avaliacao_links` — o patch de exceção `pendente → expirado` da seed (`:874-876`) precisa apontar para um encontro que exista na d1 nova (enc. 5), senão a avaliação pendente vira `expirado`.
- `notificacoes` — `corpo` ≤ 1000 chars (`sol_notificar`); rows imutáveis exceto `lida_em` (guard da 0019). Nenhuma coluna nova.
- `PLANO_ENCONTROS` / `D.d1` — fixture da seed; cenário passa de "registro pendente" para "registro pendente + atraso + avaliação pendente", documentado no mapa do cabeçalho.
- Expansão da notificação — estado client-side por item, não persistido.

## Critérios de sucesso

- **SC-001:** Em staging, `mentor@` vê na ficha da Ana somente a média agregada — nenhuma avaliação individual; a média cobre a linha oculta e a visível.
- **SC-002:** A matriz é contrato; um teste REST negativo prova que o mentor não seleciona `avaliacoes_encontro` e que coordenação/auxiliar mantêm o recorte atual.
- **SC-003:** `jovem@realiza.test` mostra `registro_retroativo` do encontro oficial vencido a partir de terça (e, com `proximo: false`, o preventivo dom–seg antes disso) e mantém avaliação pendente + registro pendente — tudo reseedável com `node scripts/seed-demo-staging.mjs`.
- **SC-004:** Dois reruns seguidos da seed produzem estado idêntico no range `de000000-*`; nada fora do range muda; a guarda aborta com ref de produção.
- **SC-005:** Qualquer notificação com corpo truncável expande e recolhe in-place por mouse, toque e teclado, com `aria-expanded` correto — sem navegar nem marcar lida.
- **SC-006:** O título da notificação de confirmação de sugestão responde sozinho "quem confirmou o quê".
- **SC-007:** Caso negado coberto: nenhuma outra conta consegue mudar a visibilidade/avaliação do jovem; a UI não oferece mais o toggle. Teste DB-level/e2e.

## Plano de testes

**Unit (Vitest):** agregação da média (lote ≥ 3, linha oculta incluída); heurística "corpo excede o clamp" se for função pura; formatação do novo título da notificação.

**E2E app (Playwright):** estender `tests/e2e/app/avaliacao.spec.ts:370-397` — mentor na ficha vê a média e nenhuma linha individual; coordenação/auxiliar mantêm o recorte; caso negado de leitura direta; notificação longa expande por teclado, `aria-expanded` alterna, link do item ainda navega, expansão não marca lida.

**E2E demo (paridade):** dataset demo com média e nenhuma linha individual no mentor, notificação longa e a "Sugestão confirmada" novas — mesmo caminho feliz do app.

**Regressão:** semáforo (atraso/preventivo por `proximo`, `pendente`, `feitos`), home do jovem (`registro_retroativo`, `encontro_sem_desfecho`), popover de notificações (lida, navegação, Esc), RPC `definir_visibilidade_avaliacao`, view `especialista_avaliacoes`.

## Riscos

- **Média sozinha parece pouco** — o mentor pode sentir falta do texto; é a decisão de privacidade. Mitigação: a ficha mostra a média com o rótulo do lote e o caminho para conversar com a coordenação, sem prometer acesso individual.
- **Exceção do patch esquecida** — repontar `encAna6 → enc. 5` é o passo que mantém a avaliação pendente viva; se esquecido, ela vira `expirado` silenciosamente. Coberto por FR-005 + SC-003.
- **Opção A adotada por economia** — produz atraso só na semana seguinte (correção registrada em FR-005); se a âncora da d1 for intocável, aceitar o atraso diferido + a opção C cobre o "testável hoje".
- **Toggle dentro do link** — aninhamento interativo é inválido (HTML + a11y); FR-008/FR-009 exigem a reestruturação como irmão. Custo: o item inteiro deixa de ser uma parada única de teclado — aceito, é o preço do gesto distinto.
- **Copy "<3 avaliações" esquecida** — sem média, a tela precisa dizer isso; FR-004 cobre.
- **Fixture degrada** — o atraso intencional cresce a cada terça sem reseed (atenção → risco). É o comportamento real; o reseed recalibra.

## Premissas

- **Decisão do lead 24/11:** o mentor vê só a média. A flag antiga fica como legado; se surgir evidência de linha individual chegando ao mentor, é bug da nova matriz (FR-002).
- **A seed mantém uma linha oculta e uma visível** só para provar que a média cobre as duas; não há mais mix de leitura do mentor.
- **Opção B′ adotada para a d1** (atraso já nesta semana, âncora de registro pendente preservada no enc. 5) — o enc. 6 integral sai do dataset, o que muda a âncora originalmente desenhada; se isso for inaceitável, cair para A + C.
- **Expansão in-place adotada** (toggle/details) em vez de página dedicada — o gap do top-15 segue registrado para issue própria.
- **"Sugestão confirmada" corrigida na mint e/ou na leitura** — não basta `title` attribute; o texto exibido precisa carregar o contexto.
- **Expansão é leitura local** — não persiste, não vira dado, não marca lida.
