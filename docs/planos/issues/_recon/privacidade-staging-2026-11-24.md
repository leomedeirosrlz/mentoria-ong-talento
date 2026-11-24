# Recon — privacidade de avaliações, staging e notificações (24/11/2026)

**Head:** `aecb135e` (`recon/privacidade-staging`, base `integration/plano2`) ·
**Fonte:** mensagens do Thiago nesta sessão + print 9 (sino com itens truncados) ·
**Status:** recon concluído; nenhum código/migration alterado.

> Este arquivo é diagnóstico. Não implementa. A ordem do pipeline é:
> feedback → recon → spec → issues → implementação → reviews → iteração → aprovação manual.

## 1. Resumo executivo

- **Privacidade de avaliações já existe e é granular por linha.** A flag
  `avaliacoes_encontro.avaliacao_visivel_mentor` (bool, `default false`,
  migration `0071`) decide por avaliação se o mentor DPP lê a resposta
  integral. A RLS (`avaliacoes_select`, versão atual em
  `0125_auxiliar_escopo_turma.sql`) restringe o mentor à própria dupla,
  à trilha ≠ `especialista` e à flag. Coordenação lê tudo;
  supervisor/auxiliar lê as duplas que supervisiona; o jovem lê as
  próprias; o especialista lê só `estrelas` via view definer.
- **"O usuário vê todas as avaliações em staging" é esperado no dataset
  demo, não bug.** A seed `seed-demo-staging.mjs` insere TODA avaliação
  com `avaliacao_visivel_mentor: true` (`scripts/seed-demo-staging.mjs:734`)
  — é a fixture optando pelo estado "on" do toggle. Se o observador era
  coord/supervisor, ele veria tudo mesmo sem a flag (RLS permite).
  Se era o `mentor@realiza.test` (Otávio), vê tudo porque a seed optou.
- **"Invisível" não precisa ser proposto — já existe.** Desligar a flag
  some a avaliação integral da ficha do mentor (o agregado quantizado
  ≥3 segue via `avaliacao_media_dpp`); jovem/coord/supervisor não mudam.
  O que falta é um estado do seed que demonstre o "off".
- **Atraso para `jovem@realiza.test` (Ana, dupla d1):** hoje d1 é o
  cenário "registro pendente", sem atraso. A opção cirúrgica é tirar o
  `proximo` do plano da d1 (vigente sem data → atraso-1 a partir de
  quarta) — preserva a âncora inteira. Opções mais fortes e uma
  alternativa zero-risco (login para a Larissa, que já está em risco)
  estão na §5.
- **Notificações longas são ilegíveis de verdade:** o `corpo` renderiza
  com `truncate` (1 linha) e o item inteiro é link/botão — clicar navega
  e marca como lida, então não existe gesto para ler o resto sem sair
  da lista. "Sugestão confirmada" (mintada em `0086`) é ambígua no
  título e depende do corpo que está cortado. Proposta expansível na §6.

## 2. Matriz de visibilidade das avaliações

Fonte: `avaliacoes_encontro` (0071), policy `avaliacoes_select`
(`0125_auxiliar_escopo_turma.sql:92-106`), view `especialista_avaliacoes`
(0090), RPC `avaliacao_media_dpp` (0071) e `trilha_do_jovem` (0092/0125).

| Dado | Jovem (autor) | Mentor DPP | Coordenação | Auxiliar/Supervisor | Especialista |
|---|---|---|---|---|---|
| **Avaliação integral** (estrelas, sentimento, avancei, temas, comentário, pedir_apoio) | ✅ sempre (próprias, via `jovem_duplas`) | ✅ **só se** `avaliacao_visivel_mentor` ∧ dupla dele ∧ trilha ≠ especialista | ✅ tudo | ✅ só duplas supervisionadas (`supervisiona_dupla`) | ❌ nunca (autocensura — 0090 removeu o ramo DPP do híbrido pra trilha esp) |
| **Estrelas de sessão esp** | ✅ | ✅ só `av.estrelas` via `trilha_do_jovem` (0092; 0125:631+) | ✅ | ✅ (mesma RPC) | ✅ própria trilha, só `estrelas` via view `especialista_avaliacoes` (0090) |
| **Média agregada** (`avaliacao_media_dpp`) | — (lê as próprias linhas) | ✅ quantizada a 0.5, liberada em lotes ≥3 (anti-differencing, 0071) | ✅ (tem as linhas) | ✅ | — |
| **`avaliacao_links`** (bearer token do link de avaliação) | próprio (UI lista pendentes) | ❌ | ✅ distribui/reenvia | ❌ | ❌ |
| **`pedir_apoio`** | marca na própria avaliação | ✅ se a linha estiver visível | ✅ + notificação `apoio_jovem` | ✅ | ❌ |
| **Resumo na retrospectiva/resumo_jornada** (`resumoAvaliacaoJovem`, `starSeries`) | própria | ✅ o que a RLS devolve (só linhas visíveis entram no agregado client-side) | ✅ | ✅ | — |
| **/resumo público (relatório)** | — | — | — | — | — (só `registros.avaliacao` do mentor entra; a avaliação do jovem não — `0110_relatorio_links.sql`) |

Significado de "invisível" hoje (`avaliacao_visivel_mentor = false`):
a linha some da ficha da dupla para o mentor (`avaliacao_jovem` volta
`null` no embed — `demo/queries.ts:comAvaliacaoJovem` espelha a policy),
não entra em trajetória/temasTop na visão dele, e a média agregada só
cai fora do lote quando o total visível ficar <3. Para jovem, coord,
supervisor e para o contador de pendências nada muda.

## 3. Diagnóstico: bug ou esperado?

**Esperado — o sintoma vem do dataset, não do código.**

- `scripts/seed-demo-staging.mjs:734` insere cada avaliação com
  `avaliacao_visivel_mentor: true`. A seed nunca gera uma linha "off",
  então em staging **toda** avaliação está opt-in por definição.
- Se a conta observada era `coord@`/`supervisora@`: a RLS autoriza ler
  tudo sem depender da flag (`0125:92-106`, ramos `coordenacao` e
  `has_papel('supervisor') ∧ supervisiona_dupla`). Também é esperado.
- Se a conta era `mentor@realiza.test` (Otávio, mentor da d1 e da d13):
  ele lê a integral porque a flag veio `true` da seed — comportamento
  correto do produto, dataset pouco representativo do mundo real.
- O que seria bug: o mentor ler linha com flag `false`, ou ler
  comentário de trilha `especialista` (0090 bloqueia os dois; a projeção
  de `trilha_do_jovem` só expõe `estrelas`). Nenhum evidência disso.

**Como seria com o jovem deixando invisível:** a mesma ficha passa a
mostrar o encontro sem bloco de avaliação do jovem; o agregado do mentor
continua só média quantizada. Na home do mentor, o "Para acompanhar"
não muda (atraso/registro pendente não dependem da avaliação).

**Detalhe de produto a decidir (§8):** o seed opta `true` em massa —
útil pra mostrar o estado "on", enganoso porque o default real do app é
`false` e nenhuma linha demo mostra o "off".

## 4. Proposta de "invisível" e impactos

A feature **já existe**; o que falta é cobertura de demo e guarda de
regressão, não modelo novo.

1. **Seed:** gerar mix no `de000000-*` — ex.: avaliações da Ana com
   `true` em 4 de 5 e `false` na mais recente (a do enc. 5, mesma que
   já tem história própria: registro pendente). Custo: uma expressão
   condicional na linha 734 em vez de literal. Ganho: a ficha do Otávio
   demonstra os dois estados e a média ≥3 continua funcionando.
2. **Copy:** `src/lib/avaliacao-privacidade.ts` já tem o texto por
   trilha; o Switch "Meu mentor pode ler esta avaliação"
   (`src/components/jovem-avaliacoes.tsx`) já é DPP-only. Nada a
   acrescentar — só garantir que o texto "off" deixe claro que a
   média agregada continua existindo (hoje diz "Seu mentor vê só a
   média das notas" — verificar se cobre o caso <3 avaliações).
3. **E2E:** `tests/e2e/app/avaliacao.spec.ts:372-397` já testa toggle
   on→off via Switch + check na coluna. Falta o assert do lado do
   mentor (entrar como mentor e ver a linha sumir da ficha). O
   regression-map sinaliza que as 251 policies não têm teste a nível
   de banco — esse caso seria o piloto.
4. **Impacto zero** para coord/supervisor/jovem — a flag é um filtro
   exclusivo do ramo `mentor_dpp` da policy.

## 5. Seed staging para atraso (`jovem@realiza.test` = Ana, dupla d1)

Estado atual da d1 (`scripts/seed-demo-staging.mjs:610`):
`{ feitos: 6, hora: "19:00", proximo: true, duracao: 90, avalPendente: 6, pendente: 5 }`
= 6 encontros realizados, 7º agendado, registro do 5º pendente,
avaliação do 6º pendente (link mintado pelo trigger e mantido
`pendente` pelo patch em `:874-876`). Cenário "atenção" estável a
semana toda — **nenhum atraso**.

Atraso = oficial vencido sem row realizado (mapa do header `:13-48`).
O que o jovem vê nesse estado: pendência `registro_retroativo`
("O Nº encontro era na semana de dd/mm… Vocês se encontraram?",
`src/lib/pendencias-jovem.ts:305-333`), `encontro_sem_desfecho` se
houver agendado vencido (`:271-303`), e o plano "ficar em dia" via
`jovem_plano` (`queries-jovem.ts:445+`, spec `specs/013-ficar-em-dia/`).

### Opção A — mínima e preserva a âncora (recomendada)

Mudar `proximo: true` → `proximo: false` (ou remover a chave) em
`PLANO_ENCONTROS[D.d1]` (`:610`).

- O vigente (enc. 7, oficial na terça 19h — `dataT1`) fica sem data:
  seg–ter lê "preventivo/sem agendamento", **de quarta em diante vira
  atraso-1** (mesma régua evergreen do d2, `:27-28`).
- Mantém: registro pendente do 5º, avaliação pendente do 6º (patch de
  `:874-876` continua válido), instrumentos, PDM, terceiros, sugestão.
- Custo: o semáforo da d1 deixa de ser "atenção estável a semana toda"
  — dom–seg mostra preventivo, qua–sáb atraso. Documentar no mapa do
  header (linha 20).

### Opção B — atraso garantido a semana toda

`{ feitos: 5, hora: "19:00", proximo: true, duracao: 90, pendente: 5 }`
(o enc. 6 oficial venceu sem row → atraso-1 ter–sáb; enc. 7 agendado).

- Custo: **perde a avaliação pendente da Ana** (`avalPendente: 6` pede
  enc. 6 realizado; sem a row o trigger não minta o link e o patch de
  `:874-876` vira no-op). O "Para fazer" da Ana perde o item de avaliar.
- Alternativa para manter uma avaliação pendente: apontar o patch para
  o enc. 5 — `uid((0x300 << 8) + 5)` em `:874` — e trocar
  `avalPendente: 6` por `avalPendente: 5`. Funciona (enc. 5 realizado
  sem row de avaliação → link minta e fica pendente), mas são 3
  linhas tocadas em vez de 1.

### Opção C — zero risco à fixture

Criar login para a Larissa (`larissaProfile` já existe na seed):
`garantirAuthUser("larissa.campos@realiza.test", larissaProfile)`
após `:1234`. A d13 já é risco com 2–3 atrasos — um jovem "em atraso"
real em 1 linha, idempotente, sem tocar na d1.
Custo: não é `jovem@realiza.test`; o teste acontece em outra conta.

### Opção D — patch manual pontual (não idempotente)

SQL direto no staging para simular sem mexer na seed — ex.:
`update encontros set status='faltou', realizado_em=null where id='<enc6>'`.
Reverte no próximo reseed (o range `de000000-*` é apagado e recriado).
Serve para explorar a UI uma vez, não como estado estável.

### Reset/idempotência

`node scripts/seed-demo-staging.mjs` com `E2E_SUPABASE_URL` +
`E2E_SUPABASE_SERVICE_ROLE_KEY` apontados para o staging; `limpar()`
apaga `de000000-*` e reinsere — qualquer das opções A–C é revertida
por `git checkout` + re-run. Nunca apontar para produção
(`yhjzmxleotahijinjepl`).

## 6. Notificações: anatomia atual e proposta expansível

### Anatomia (`src/components/notificacoes.tsx`)

- **Bell:** `Popover` (@base-ui) + `PopoverTrigger` com badge de
  contagem não-lida (lime, `9+` acima de 9), `aria-label` com contagem,
  pop animado só quando a contagem sobe (`:300-325`). Provider
  compartilha estado entre os sinos mobile (`app-shell.tsx:244` /
  `jovem-shell.tsx:147`, `side="bottom"`) e desktop (`:296`/`:228`,
  `side="right"`); poll a cada 60s (`POLL_MS`, `:61`) + ao abrir + ao
  voltar `visibilitychange`.
- **Lista:** `<ul>` `max-h-[min(24rem,…)]` scroll próprio (`:355`),
  `divide-y`, não-lida com `bg-muted/40`. Fetch: `listarNotificacoes`
  (`src/lib/actions.ts:5298`) — **top 15 por created_at desc**, mais
  `count exact` de não-lidas para o badge. Sem "ver mais"/paginação.
- **Item:** ícone por `tipo` (`:214-264`), título `line-clamp-2`
  (`:374`), tempo relativo, **`corpo` com `truncate` = 1 linha**
  (`:381`). Sem `title`, sem tooltip, sem expansão — convenção
  conventions-ui diz que "quando o texto importa ele fica íntegro em
  title/sr-only ou na ficha de destino"; aqui o corpo não vai íntegro
  para lugar nenhum antes do clique.
- **Clique ambíguo:** o item inteiro é `<Link>` quando
  `pathInterno(n.href)` (`:364,394-397`) ou `<button>` (`:399-401`); o
  handler marca como lida **e** fecha o popover **e** navega (`:390-393`).
  Não há gesto "ler tudo" — para ver o corpo cortado é preciso navegar
  para o destino, que muitas vezes não resolve a dúvida ("Sugestão
  confirmada" → ficha da dupla, que não diz qual sugestão).
- **Ações por item:** não-lida ganha botão ghost "Marcar como lida"
  (`:404-415`, `aria-label` + `title` — único tooltip da lista).
- **Fonte dos textos:** fan-out `src/lib/notificar.ts` (helper
  `sol_notificar` no banco minta a maioria); `relerPlanoPropostoDeMembro`
  reescreve corpo de `plano_proposto` na leitura (`actions.ts:5327`).
  RLS (`0019_notificacoes_hardening.sql`): insert só coord ou
  `pedido_apoio` staff; update limitado a `lida_em` por trigger guard;
  href restrito a `^/[^/\\]` (bloqueia `//evil.com`).

### "Sugestão confirmada" (print 9)

Mintada em `0086_especialista_sugestao_devolutivas.sql:271-274`, para
`s.created_by` (o mentor autor): título "Sugestão confirmada", corpo
`"<Nome> confirmou a sua sugestão de especialista — o pedido seguiu."`,
href `/duplas/<dpp>`. O título sozinho é ambíguo ("sugestão de quê?") e
o corpo esclarecedor trunca em ~40 chars no `w-80` do popover.

### Proposta expansível

1. **Corpo com clamp-2 + expansão in-place:** `line-clamp-2` no corpo
   (consistente com o título) e, quando o texto excede, um toggle
   "Ler mais / Ler menos" (botão `ghost size-xs` dentro do item, com
   `aria-expanded` + `aria-controls` apontando o span do corpo). O
   toggle é irmão do link — clicar nele **não** navega nem marca lida.
2. **Alternativa sem JS extra:** `<details>` nativo no bloco do corpo
   (summary="Ver completo") — zero estado, teclado grátis, mas o
   summary dentro de `<a>` tem cuidado de aninhamento: mover o corpo
   para fora do link (estrutura `<li>` com link no título + details
   irmão) resolve e ainda desambigua o clique.
3. **Tooltip `title` como piso mínimo:** custo 1 atributo, cobre
   desktop; não cobre mobile nem leitor de tela — não substituir a
   expansão.
4. **Destino ambíguo:** para tipos cujo href é só contexto
   (`/duplas/<id>`), avaliar corpo mais rico por tipo em `notificar.ts`
   — ex.: `solicitacao_registrada` "Sugestão confirmada" poderia levar
   o tema da demanda no título (`"Ana confirmou a trilha de ansiedade"`)
   ou no corpo já no insert. Decisão de produto (§8).
5. **Teclado/mobile:** popover já fecha em Esc (base-ui) e o toggle
   entra no tab order natural; no mobile o popover abre para baixo com
   `max-w-[calc(100vw-2rem)]` — clamp-2 mantém 3–4 itens visíveis por
   fold; checar zoom 200% (conventions-ui).
6. **Limite 15:** itens além do top-15 ficam inacessíveis (o badge
   conta certo mas a lista não tem "ver todas"). Fora do escopo do
   print 9, mas registrado como gap — proposta honesta é uma página
   `/notificacoes` ou "carregar mais" incremental.

## 7. Critérios de aceite / testes

**Privacidade**
- [ ] Com `avaliacao_visivel_mentor=false`, o mentor não vê a linha na
      ficha nem no agregado; jovem/coord/supervisor inalterados. (e2e
      estende `avaliacao.spec.ts` ou assert em `queries-avaliacao`.)
- [ ] Mentor jamais lê avaliação de trilha `especialista` integral —
      só `estrelas` (coberto por projeção; teste DB-level no piloto do
      regression-map).
- [ ] Toggle só pelo jovem (`definir_visibilidade_avaliacao` escopada
      a `my_mentorado_id()`; coord não coage — já é código, falta spec
      de regressão).
- [ ] Seed gera pelo menos 1 avaliação "off" por dupla demo, para a
      ficha do Otávio mostrar os dois estados.

**Staging (atraso)**
- [ ] `jovem@realiza.test` com ≥1 atraso: a home do jovem mostra
      `registro_retroativo`/`encontro_sem_desfecho` e o staff vê a
      d1 em atenção/risco conforme a régua.
- [ ] Reseed é idempotente: `node scripts/seed-demo-staging.mjs` duas
      vezes → mesmo estado; nada fora de `de000000-*` tocado.
- [ ] Mapa do header (`:13-48`) atualizado com o novo cenário da d1.

**Notificações**
- [ ] Corpo longo lê-se completo dentro do popover (toggle ou details),
      sem navegar; clique de navegação e clique de expansão são gestos
      distintos e ambíguos nunca coexistem.
- [ ] `aria-expanded` correto; expansão alcançável por teclado;
      sr-only "Não lida" preservado.
- [ ] Título ambíguo ("Sugestão confirmada") resolve-se no corpo
      expandido ou ganha o tema no próprio texto.
- [ ] Zoom 200% / mobile ≤360px: lista utilizável, sem overflow.

## 8. Decisões de produto

1. **Seed opta `avaliacao_visivel_mentor:true` em 100% das linhas.**
   Manter (demonstra o "on"), migrar para mix (mais fiel ao default
   `false` real), ou documentar que staging é um mundo "tudo opt-in"?
2. **Conta de observação do sintoma:** quem viu "todas as avaliações"
   era coord/supervisor (legítimo pela RLS) ou o mentor (legítimo pela
   flag do seed)? Muda a moldura do diagnóstico apresentado acima.
3. **Atraso da Ana:** aceitar a d1 com atraso-1 (opção A/B) ou manter
   a âncora "em dia" e adicionar login da Larissa (opção C)?
4. **"Sugestão confirmada"**: título com o tema (`"Ana confirmou sua
   sugestão de trilha"`) vs. expansão genérica do corpo vs. ambos —
   e vale backfill de copy por `tipo` em `notificar.ts`?
5. **Limite 15 + sem página de notificações:** aceitar o teto ou abrir
   issue para `/notificacoes`/"carregar mais"?
6. **Demo in-memory (`/demo`)**: `demoAvaliacoes`/`comAvaliacaoJovem`
   espelham a flag — quer paridade do mix on/off lá também?
