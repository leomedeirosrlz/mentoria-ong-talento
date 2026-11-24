# Spec — Nível em raios, conquistas por limiar e motion por faixa

**Feature:** `specs/024-gamificacao-nivel-conquistas` · **Status:** Clarified
**Fila:** gamificação rodada 2 — recon `docs/planos/issues/_recon/gamificacao-2026-11-24.md` (REALIZA a numerar) · **Dono:** Thiago · **Data:** 24/11/2026

> **Amplia a spec 016 onde diverge:** a família visual `nivel-*` deixa de ser planta/canteiro e vira raios/energia progressivos; "Seu nível" sai de dentro do card e ganha um selo no header do perfil; conquista deixa de ter um gesto único (`badge-salta` em todas as peças) e o nível passa a ter assinatura de motion própria por faixa; o catálogo ganha conquistas por limiar (combinados, horas, metas, submetas) e gerais (perfil, termo). O resto da 016 segue valendo: derivação pura sem tabela nova, estante earned-only, futuras apagadas sem cadeado, mesma régua das 4 faixas.

## Problema e resultado

- **Dor hoje:** a direção visual do nível foi rejeitada (plantinha/árvore, longe do "badass" pedido); o sistema tem um único gesto de deleite — `badge-salta` aplicado igual a marco, instrumento, contagem e nível — mais uma entrada genérica repetida em ~70 superfícies, então "parece tudo a mesma animação tosca"; a identidade de nível está enterrada dentro de `ConquistasCard`, longe do topo do perfil onde a pessoa se reconhece; e não existe conquista pelos comportamentos que o programa quer reforçar (cumprir combinados, somar horas de mentoria, fechar metas e submetas).
- **Resultado observável:** um selo "Seu nível" no header do perfil; as 4 faixas com desenho de raios/energia crescentes e uma assinatura de motion distinta por faixa; conquistas novas nomeadas, com critério honesto, raridade e copy própria, derivadas dos dados que já existem.
- **Como saberemos que funcionou:** o jovem vê o nível sem rolar até o card; as 4 faixas se distinguem à primeira vista em 40px e cada uma celebra do seu jeito; as conquistas novas aparecem ganhas ou nas futuras com progresso honesto — sem tabela, sem seed, sem número inventado.

## Fora de escopo

- Pontos, ranking, streak, leaderboard ou competição entre pessoas (reafirma 016). Raridade aqui é rótulo de catálogo, não economia nem ordenação.
- Repintura de marcos, instrumentos e contagens: só a família `nivel-*` muda de motivo — bandeira, medalha, estrela, checklist e balões ficam como estão.
- Persistir conquistas ou nível (tabela, ledger, grant): a derivação pura da 016 continua; o único DDL sugerido (`feito_em` do combinado) é opcional e de alçada do lead — a spec funciona sem ele.
- Superfícies de mentor/staff: a gamificação é do jovem; o `MarcoNotifier` do mentor e a `TrilhaJornada` não mudam.
- Animação em loop/idle, animação por JS a cada frame, canvas ou libs de motion: o vocabulário segue CSS em `transform`/`opacity` sob o guard global de `prefers-reduced-motion`.
- Renomear as faixas (decisão em Premissas), a retrospectiva "Spotify" e o card "Sua semana".

## Histórias de usuário

### US1 — "Seu nível" no header do perfil (P1)

- **Por que P1:** é o pedido literal (print 3) e o gesto mais visível: a identidade mora no topo, não dentro de um card.
- **Teste independente:** abrir `/jovem/perfil` com e sem foto, em 390px e 1440px, e sem jornada.
- **Cenários:**
  1. **Dado** um jovem com jornada **quando** abre `/jovem/perfil` **então** na linha do avatar (`items-end`, hoje vazia à direita) aparece um selo compacto: emblema da faixa atual + overline "Seu nível" + título da faixa + micro-linha ("Desde dd/mm · N dias de programa"), sem quebrar avatar, nome, badges nem bio.
  2. **Dado** o selo **quando** a pessoa o ativa **então** abre o mesmo detalhe de faixa do card (`FaixaDetalhe`): um gesto, uma fonte de verdade — nunca um segundo lugar de critério.
  3. **Dado** jornada existente mas nível ainda não alcançado (dupla criada, nenhum encontro) **quando** o selo renderiza **então** mostra a faixa Início apagada com "Primeiro nível" e o critério — mesmo fallback da vitrine, nunca um selo vazio.
  4. **Dado** que a pessoa não tem jornada **quando** a página abre **então** o selo não renderiza (mesmo gate do `ConquistasCard` hoje) e o header fica como está.
  5. **Dado** uma foto carregada **quando** a linha renderiza **então** "Remover foto" e o selo coexistem: o selo fecha a linha na ponta direita, o ghost button não colide nem some.
  6. **Dado** 390px **quando** a linha mede **então** avatar 80px + selo cabem sem overflow; em 1440px o selo pode crescer (emblema 48px, meta visível). Nome longo nunca empurra o selo pra fora.

### US2 — Família visual de nível: raios/energia (P1)

- **Por que P1:** é a rejeição registrada — planta/canteiro lê "jardim", não "badass". O gerador isométrico já tem toda a gramática: falta o motivo.
- **Teste independente:** as 4 faixas lado a lado em 40px (régua), 80px (vitrine) e 112px (detalhe), ganhas e apagadas.
- **Cenários:**
  1. **Dado** as 4 faixas **quando** vistas lado a lado **então** a progressão lê quantidade e presença crescentes: `inicio` = 1 raio fino saindo de um núcleo, `constancia` = 2 raios cruzados, `veterania` = 3 raios com anel de energia, `completa` = coroa/burst de raios — distinguíveis em 40px sem ler texto.
  2. **Dado** a família nova **quando** gerada **então** usa a mesma gramática do gerador (face inclinada, extrusão `[-7,30]`, traço 11, borda-papel `CORTE=9`, paleta `CORES`) e os mesmos slugs `nivel-*.svg` — só o motivo muda: o `canteiro()` (placa+terra) vira base neutra (disco/dínamo) e o raio veste amarelo/laranja sobre base escura da paleta.
  3. **Dado** o SVG ausente ou falhando **quando** o emblema cai no squircle **então** o glifo é da família energia (`Lightning` do Phosphor, com progressão por peso), nunca `Plant`/`CalendarCheck`/`Tree`.
  4. **Dado** uma faixa futura ou o tema escuro **quando** renderiza **então** a silhueta segue legível (borda-papel + `grayscale`/`opacity-55` já existentes) e nenhuma arte nova vem de CDN ou asset externo.

### US3 — Assinatura de motion por faixa (P1)

- **Por que P1:** "tudo a mesma animação" é diagnóstico real: um `badge-salta` para todas as peças. O nível é identidade — identidade tem gesto próprio.
- **Teste independente:** abrir o perfil, o detalhe de cada faixa e alternar `prefers-reduced-motion`.
- **Cenários:**
  1. **Dado** a vitrine da faixa atual **quando** o card monta **então** a assinatura daquela faixa dispara uma vez (< 800ms): `inicio` = pop curto com leve overshoot; `constancia` = pulso duplo de carga; `veterania` = flicker elétrico curto (≤ 3 cortes de opacity, nunca > 3 flashes/s); `completa` = burst do núcleo + o `badge-brilho` já existente.
  2. **Dado** qualquer faixa ganha **quando** abre o detalhe **então** dispara a assinatura dela — nunca `badge-salta`; faixa não ganha no detalhe entra com fade simples, sem celebração emprestada.
  3. **Dado** o selo do header e a régua de faixas **quando** renderizam **então** no máximo um settle curto no primeiro paint — a assinatura cheia mora na vitrine e no detalhe; nenhuma superfície ganha loop infinito.
  4. **Dado** `prefers-reduced-motion: reduce` **quando** qualquer gatilho dispara **então** flicker e burst somem (Tier 1), pulsos e pops viram um fade ≤ 200ms (Tier 2/3) — modelo do `ia-digitando` → `ia-digitando-fade`, sem teleporte.
  5. **Dado** qualquer superfície que não é nível **quando** compara antes/depois **então** nada muda: `badge-salta` segue nas peças da estante (inclusive as conquistas novas), `badge-brilho` no detalhe ganho, `animate-enter` na entrada de listas, `fill-grow` nas barras.

### US4 — Conquistas por limiar e gerais (P2)

- **Por que P2:** dependem de fontes de verdade definidas (dedup de `sessao_id`, PDM por dupla), mas nenhuma depende de DDL. São as conquistas dos comportamentos que o programa quer ver.
- **Teste independente:** derivar a estante com datasets na fronteira de cada limiar (4→5 combinados, 6h59→7h, 0→1 meta, 2→3 submetas).
- **Cenários:**
  1. **Dado** 5 combinados feitos (`jovem_encaminhamentos.status='feito'`) **quando** a estante deriva **então** "Palavra cumprida" entra ganha; antes disso a futura mostra o progresso `n/5` — e o tile contador `conta:combinados` continua existindo ao lado (convivência decidida em Premissas).
  2. **Dado** encontros realizados com `duracao_min` **quando** soma **então** conta uma vez por `COALESCE(sessao_id, id)` (sessão fundida grava a mesma duração em todas as rows do grupo — somar por row inflaria), só a trilha da régua entra (DPP quando existe, senão especialista) e só duração registrada conta — o critério diz "horas de encontro registradas", nunca assume 60 min para null.
  3. **Dado** metas/submetas do PDM `atingida` **quando** deriva **então** meta conta só raiz (`parentId == null`), submeta conta em qualquer profundidade, `descartada` nunca conta e a data da peça é o `atingidaEm` da k-ésima atingida.
  4. **Dado** um jovem só-especialista **quando** as futuras listam **então** peças de PDM não aparecem (PDM é documento de dupla DPP — mesma regra de não-promessa do `conta:combinados`) e as contagens de tempo falam "sessão", não "encontro".
  5. **Dado** uma ação revertida (combinado desfeito, meta reaberta) **quando** a contagem cai abaixo do limiar **então** a peça volta para a área das futuras — a derivação não trava conquista: honesta nos dois sentidos.
  6. **Dado** o termo `termo-mentorando` `assinado` ou a ficha completa **quando** a estante deriva **então** a conquista geral entra mesmo antes da jornada começar — e o card passa a renderizar quando houver peças gerais, sem depender só de `temJornada` (gate ampliado, decisão em Premissas).

### US5 — Cruzamento de faixa celebrado (P2)

- **Por que P2:** o level-up é o "momento" que o selo do header prepara; o padrão já existe (`MarcoNotifier` do mentor, baseline em localStorage) e custa pouco. Se a fatia esticar, é a primeira linha de corte.
- **Teste independente:** simular baseline anterior via localStorage e recarregar o perfil.
- **Cenários:**
  1. **Dado** que a faixa derivada subiu desde a última visita **quando** o perfil carrega **então** um toast único celebra a faixa nova (a mais alta da leva), com o ícone da família energia — copy: título "Subiu de nível: {faixa}", descrição com o critério cumprido ("1 mês de programa e 4 encontros com seu mentor. Segue firme.") — cobre retroativo, remanejo e correção passiva, que é quando o número realmente muda.
  2. **Dado** demo ativa ou localStorage indisponível **quando** o perfil carrega **então** nenhum toast dispara (baseline fixo na demo, storage falho = sem festa, sem erro).

## Casos de borda

- **Jovem sem jornada:** o selo do header não renderiza; o card de conquistas passa a nascer se houver peças gerais ganhas ou a caminho (termo, perfil) — antes disso a página não mostrava nada.
- **Dupla pausada ou encerrada:** a contagem de dias já congela (estado `parada` da 016); o selo continua mostrando o nível alcançado — "o nível fica com você" — e a futura de nível não promete data.
- **Remanejo (dupla DPP trocada):** dias de programa seguem somados por união de intervalos; horas e conquistas por limiar contam na trilha da régua inteira; PDM soma nas duplas DPP do jovem (cada doc é por dupla — fetch em paralelo, bounded).
- **`duracao_min` null** (retroativo antigo ou registro sem duração): não entra na soma — critério e copy dizem "horas de encontro registradas". Se nulls forem comuns em produção, os limiares de horas ficam sub-contados: medir antes de implementar, ajustar limiar se necessário.
- **Sessão fundida (cobertura):** `duracao_min` se repete em todas as rows do `sessao_id` — o dedup é obrigatório; esquecê-lo infla as horas na cara do teste.
- **Foto presente/ausente:** "Remover foto" só existe com foto; o selo fecha a linha à direita nos dois casos, com `ml-auto` — ordem na linha: avatar | remover foto (quando há) | selo.
- **Peça geral sem carimbo:** `perfil:completo` e combinados não têm data de feito na fonte — `data: null` honesto, a linha do detalhe diz "Conquistada" sem data, nunca data inventada.
- **Leitor de tela:** desenho sempre `alt=""` + `aria-hidden`; nome + estado + data no accessible name do trigger — mesmo padrão da estante, agora também no selo.
- **WCAG de flashes:** o flicker da Veterania fica abaixo de 3 flashes/s, em área pequena (o emblema), uma vez por gatilho; sob reduced-motion não existe.

## Requisitos funcionais

- **FR-001:** o header de `/jovem/perfil` DEVE renderizar um selo "Seu nível" na linha do avatar quando `conq.temJornada` — emblema da faixa atual + overline "Seu nível" (ou "Primeiro nível" quando `nivel.atual` é null) + título + micro-linha; componente cliente que abre o `FaixaDetalhe` compartilhado com o card.
- **FR-002:** `FaixaDetalhe` DEVE ser extraído para uso nos dois lugares (selo e card) — uma única fonte de critério/estado/detalhe; o selo não inventa copy própria.
- **FR-003:** a família `nivel-*` DEVE ser redesenhada em raios/energia dentro da gramática do gerador (`scripts/gerar-badges.mjs`: face inclinada, extrusão `[-7,30]`, traço 11, borda-papel, paleta `CORES`), mantendo os slugs `nivel-inicio|constancia|veterania|completa.svg` — quantidade e forma progressivas por faixa, base neutra (disco/dínamo) no lugar do `canteiro()`; os demais desenhos (marcos, instrumentos, contagens) não mudam.
- **FR-004:** o fallback squircle de nível DEVE usar a família energia (`Lightning` com progressão por peso: regular → bold → fill, e `Sparkle` fill na completa); `Plant`, `CalendarCheck` e `Tree` saem do mapa.
- **FR-005:** cada faixa DEVE ter keyframes próprios `nivel-<faixa>-*` em `transform`/`opacity` (pontualmente `stroke-dashoffset` no detalhe), < 800ms, uma vez por gatilho: vitrine no mount, detalhe ganho na abertura, selo e régua só com settle curto — `badge-salta` nunca aplica em peça de nível.
- **FR-006:** o vocabulário de motion DEVE respeitar a separação de camadas: identidade (nível → assinatura por faixa), feedback de conquista (estante → `badge-salta` + `badge-brilho`, inclusive as peças novas de US4), entrada de superfície (`animate-enter`, `fill-grow`), microinteração (hover/focus do tile, `scale 0.96` de press). Identidade nunca reusa feedback e nenhuma superfície fora de nível muda de animação.
- **FR-007:** o catálogo DEVE ganhar as conquistas da tabela em "Entidades e dados" — cada uma com chave estável, título, critério em infinitivo, detalhe em passado, fonte nomeada, raridade e glifo; peça nova entra também na gramática isométrica do gerador (mesma paleta), com squircle Phosphor coerente de fallback.
- **FR-008:** "horas de mentoria" DEVE somar `duracao_min` dos `realizado` da trilha da régua, deduplicado por `COALESCE(sessao_id, id)`, ignorando null; `ConquistasInput.encontros` passa a carregar `duracao_min` e `sessao_id` (as colunas já vêm em `JOVEM_ENCONTRO_COLS`).
- **FR-009:** metas e submetas DEVEM derivar de `getPdmDaDupla` para cada dupla DPP do jovem (fetch em paralelo, bounded, dentro do fluxo de dados do perfil — nunca waterfall por dupla em série); meta = `parentId == null`, submeta = `parentId != null`, só `status === "atingida"` conta.
- **FR-010:** as futuras correspondentes DEVEM aparecer automaticamente com `progresso {atual, alvo}` onde há contagem honesta — combinados `n/5`, horas em minutos renderizados como "Faltam 2h05 de encontro registradas" (piso, nunca arredonda pra cima); peças de PDM nunca aparecem nas futuras de quem não tem dupla DPP; peças gerais (termo, perfil) aparecem com linha do que falta quando binárias ("Falta preencher a disponibilidade").
- **FR-011:** `Conquista` DEVE aceitar o metadado `raridade` (`inicial` | `constancia` | `marco_grande`) — rótulo de catálogo exibido no detalhe (chip/linha "Marco grande"), sem alterar ordenação cronológica, sem pontos, sem schema.
- **FR-012:** o cruzamento de faixa DEVE disparar um toast único por visita (baseline `realiza:nivel:<mentoradoId>` em localStorage, mais alto da leva, storage indisponível ou demo = sem toast) — mesmo padrão do `MarcoNotifier`, lado do jovem.
- **FR-013:** o `ConquistasCard` DEVE renderizar quando houver peças gerais ganhas ou a caminho mesmo sem jornada — o gate deixa de ser só `temJornada`; `NivelBloco` e a faixa "Próximo marco" seguem gated como hoje.
- **FR-014:** o e2e `tests/e2e/demo/jovem-conquistas.spec.ts` DEVE continuar válido onde o comportamento não muda e ser atualizado onde muda: nomes de keyframes novos (o assert `badge-salto-p` vale para peças de estante; faixas ganham assert próprio), as novas conquistas do dataset demo e o selo do header (visível, abre detalhe, ausente sem jornada).

## Requisitos não funcionais

- **Perf:** SVGs gerados ≤ ~8 KB cada e servidos como `<img>` estático; animação só `transform`/`opacity` (+`stroke-dashoffset` pontual) — custo de compositor, zero layout e zero JS por frame; o perfil adiciona no máximo `getPdmDaDupla` por dupla DPP em paralelo + `getJovemAssinaturas` no `Promise.all` existente; toda derivação é O(n) no módulo puro.
- **A11y:** estado sempre em texto ("Seu nível", "Alcançada"…) nunca só cor/anel; imagem `alt=""` + `aria-hidden`; accessible name do trigger = nome + estado + data; `focus-visible:ring-2` no selo e nos tiles; nenhum efeito acima de 3 flashes/s (WCAG 2.3.1); reduced-motion em camadas (Tier 1 some, Tier 2 vira fade ≤ 200ms, Tier 3 fica) — nunca teleporte, nunca kill switch total.
- **Copy:** pt-BR sem travessão em texto exibido; critério em infinitivo, detalhe em passado; nunca prometer data projetada; "submeta" vale porque a UI do PDM já usa a palavra ("Nova submeta").
- **Demo:** paridade em `demoJovem*` — o dataset já tem `duracao_min`/`sessao_id` e PDM com atingidas; completar o que faltar (assinatura, combinados suficientes para cruzar um limiar) para a persona mentorado exibir ao menos uma conquista nova ganha e uma futura com progresso.
- **RLS/dados:** nenhuma policy ou RPC nova — leituras pelas fronteiras já existentes (`jovem_encaminhamentos`, `encontros` via RLS, `pdm_da_dupla` validando `my_mentorado_id()`, `jovem_assinaturas`, `jovem_perfil`); derivação inteira no módulo puro.
- **LGPD:** nenhum dado novo — tudo já é lido pelo próprio jovem em outras superfícies.
- **Regressão e2e:** o spec demo de conquistas segue a fonte da verdade visual; mudança de arte não deve quebrar seletores por role/nome, só os asserts de keyframe e os conteúdos novos.

## Entidades e dados

**Faixas de nível (régua inalterada da 016):** `inicio` (começar a jornada) → `constancia` (30d + 4 encontros DPP; 30d + 2 sessões esp) → `veterania` (90d + 8; 60d + 3) → `completa` (total da trilha: 16 encontros / sessões). Estados `ganho`/`superado`/`futuro`, `parada` congela, sem data projetada — tudo como já é.

**Catálogo novo de conquistas (limiares e gerais):**

| Chave | Título | Critério | Fonte de verdade | Data | Raridade | Detalhe (copy) |
|---|---|---|---|---|---|---|
| `conta:combinados-5` | Palavra cumprida | Concluir 5 combinados com seu mentor | `jovem_encaminhamentos` `status='feito'` ≥ 5 | null (sem `feito_em`) | constancia | "Cinco tarefas ditas e feitas. Combinado aqui é compromisso." |
| `conta:combinados-15` | De palavra | Concluir 15 combinados com seu mentor | idem ≥ 15 | null | marco_grande | "Quinze combinados fechados: o que você diz, acontece." |
| `conta:horas-7` | Sete horas de conversa | Somar 7 horas de encontro registradas | `encontros.duracao_min` `realizado` da trilha da régua, dedup `sessao_id` ≥ 420 min | `realizado_em` da sessão que cruzou | constancia | "Sete horas cara a cara com seu mentor, tempo que vira repertório." |
| `conta:horas-15` | Mês de conversas | Somar 15 horas de encontro registradas | idem ≥ 900 min | idem | marco_grande | "Quinze horas de mentoria somadas. Isso é um turno inteiro de troca." |
| `pdm:meta-1` | Primeira meta fechada | Marcar 1 meta do seu plano como atingida | `pdm_itens` `atingida` + `parentId == null` ≥ 1 (todas as duplas DPP) | `atingidaEm` da 1ª | constancia | "A primeira meta do seu plano saiu do papel." |
| `pdm:metas-3` | No rumo | Marcar 3 metas do seu plano como atingidas | idem ≥ 3 | `atingidaEm` da 3ª | marco_grande | "Três metas cumpridas: o plano deixou de ser intenção." |
| `pdm:submetas-3` | Passo a passo | Concluir 3 submetas do seu plano | `pdm_itens` `atingida` + `parentId != null` ≥ 3 (qualquer profundidade) | `atingidaEm` da 3ª | inicial | "Três passos concluídos: passo é como a meta grande se divide." |
| `pdm:submetas-10` | Tijolo a tijolo | Concluir 10 submetas do seu plano | idem ≥ 10 | `atingidaEm` da 10ª | marco_grande | "Dez passos fechados. Obra se faz assim." |
| `conta:avaliacoes-5` | Voz treinada | Enviar 5 avaliações de encontro | `avaliacoes` ≥ 5 (mesma fonte do contador) | `created_at` da 5ª | constancia | "Cinco notas enviadas: sua opinião guia a dupla." |
| `perfil:completo` | Cara do lugar | Completar a ficha: contato, disponibilidade e um "sobre você" | `jovem_perfil` whatsapp + disponibilidade + (`me.bio` ou `me.interesses`) | null | inicial | "Perfil completo: quem te acompanha sabe quem você é." |
| `doc:termo` | Termo assinado | Assinar o termo de participação | `jovem_assinaturas` `slug='termo-mentorando'` + `status='assinado'` | `assinado_em` | inicial | "O documento que abre a jornada, assinado." |
| `presenca:sem-falta` | Não faltou | Fazer 4 encontros seguidos sem nenhum "não aconteceu" no meio | `encontros` da trilha: run de 4 `realizado` sem `nao_aconteceu` intercalado (agendado não quebra) | `realizado_em` do 4º da sequência | marco_grande | "Presença limpa: cada encontro marcado, cada encontro feito." |

Notas do catálogo:
- Glifos Phosphor (fallback e tom): combinados → `Handshake`/`--inst-checklist`; horas → `ClockCountdown`/`TOM_MARCO` (lime "aconteceu"); metas → `Target`/`--inst-pdm`; submetas → `Checks`/`--inst-pdm`; avaliações → `Star`/`avaliacao_encontro`; perfil e termo → `IdentificationCard`/`Signature` sob `--inst-intake-mentorado` (o tom de "chegada"); presença → `CalendarCheck`/`TOM_MARCO`.
- Contadores e limiares convivem: `conta:combinados`, `conta:avaliacoes` e `conta:especialista` seguem como tiles que crescem; os limiares são as peças nomeadas. Decisão em Premissas.
- A régua de horas usa a mesma partição de sempre: uma trilha só — DPP quando existe, senão especialista (e a copy vira "sessão com especialista"; idem para "avaliações de sessão").
- Idempotência e backfill: a derivação é retrospectiva por natureza — a estante nasce com o que já cruzou, sem job nem seed; a peça é uma função determinística dos dados, não existe grant duplicável nem estado a dessincronizar. "Backfill" = nada a fazer; "idempotência" = derivar duas vezes dá o mesmo resultado.

**Inventário de superfícies de emblema e a regra de motion (mata a animação única):**

| Superfície | Arquivo | Peça | Tamanho | Motion |
|---|---|---|---|---|
| Header do perfil (novo) | `jovem/perfil/page.tsx` | selo da faixa atual | 40–48px | settle curto `nivel-chega` no primeiro paint |
| Vitrine do `NivelBloco` | `conquistas-card.tsx` | faixa atual | 80px | assinatura `nivel-<faixa>-*` uma vez no mount |
| Régua das 4 faixas | `conquistas-card.tsx` | todas as faixas | 40px | sem assinatura no mount; detalhe dispara a da faixa; hover/focus = feedback do tile |
| Estante | `conquistas-card.tsx` | conquistas ganhas (incl. novas) | 56px | `badge-salta` em hover/focus |
| Ainda por vir | `conquistas-card.tsx` | futuras apagadas | 56px | `badge-salta` em hover/focus |
| Detalhe (Dialog) | `conquistas-card.tsx` | qualquer peça | 112px | estante → `badge-salta` + `badge-brilho` no ganho; nível ganho → assinatura da faixa |
| "Próximo marco" | `materiais/marcos-a-caminho.tsx` | próximo marco de ação | 40px | estático (server); `fill-grow` só na barra |
| Toast level-up (novo) | notifier do jovem | ícone `Lightning` fill | 18px | nenhuma (o toast é o gesto) |

Regra de ouro: identidade (nível) nunca reusa feedback (`badge-salta`); feedback nunca vira assinatura; nenhuma superfície fora dessa tabela ganha animação nova; nenhum loop infinito novo entra no sistema (shimmer de idle só se o produto pedir depois, e só no raio).

## Critérios de sucesso

- **SC-001:** prints 390×844 e 1440×900 do header com o selo "Seu nível", com e sem foto, e do estado "Primeiro nível" apagado — avatar, nome, badges e "Remover foto" intactos.
- **SC-002:** prints das 4 faixas novas em 40px/80px/112px + uma futura em grayscale: distinguíveis sem texto, dentro da gramática isométrica.
- **SC-003:** gravação (ou frames em 4 tempos) da assinatura de cada faixa disparando uma vez, e a versão reduced-motion (fades ≤ 200ms, sem flicker/burst).
- **SC-004:** `conquistas.test.ts` cobrindo: limiares cruzados e não cruzados, dedup `sessao_id` nas horas, `duracao_min` null ignorado, meta/submeta `atingida`/`descartada`, jovem só-especialista sem peças de PDM, regressão honesta (combinado desfeito), futuras com progresso.
- **SC-005:** e2e demo verde: selo do header (role/nome, abre detalhe, some sem jornada), assert de keyframe por camada (estante `badge-salto-p`, nível `nivel-*`), `src` das imagens `^/badges/[a-z0-9-]+\.svg$`, `grayscale` nas futuras e o par motion/reduced-motion.
- **SC-006:** toast de level-up comprovado em teste (baseline de localStorage manipulada) e ausente na demo.

## Plano de testes

- **Unit (Vitest, prioridade):** derivação dos limiares na fronteira exata (4→5, 6h59→7h, 0→1, 2→3); dedup por `sessao_id` com sessão fundida no meio; `duracao_min` null fora da soma; `nao_aconteceu` quebrando e `agendado` não quebrando a sequência; metas/submetas com `descartada` e profundidade > 1; futuras com `progresso` e `linha` honestas; só-especialista sem peças de PDM e com copy "sessão"; regressão quando a contagem cai.
- **E2E demo:** os estados visuais da persona mentorado (selo no header, faixa atual com assinatura, conquista nova ganha e futura com progresso, reduced-motion) + fallback do SVG 404 caindo no squircle `Lightning`.
- **E2E app:** cobertura do gate novo (card sem jornada com peça geral) e do toast de level-up; nenhum papel novo nem rota pública — sem caso negado adicional.
- **Regressão a reescrever:** os asserts de keyframe que citam `badge-salto-p` passam a valer só para peças de estante; as faixas ganham assert dos keyframes `nivel-*`; o fallback de nível deixa de esperar `Plant`/`Tree`.

## Riscos

- **Flicker lê como glitch** se os cortes forem lentos demais ou cobrirem a peça inteira — mitigar com ≤ 3 cortes, área pequena e duração curta; se não convencer na revisão visual, a Veterania troca por pulso triplo e o flicker sai.
- **"Ainda por vir" inflada** com o catálogo novo — mitigar com raridade no detalhe e, se continuar ruidoso, subagrupar as gerais depois (não nesta fatia).
- **Horas sub-contadas** se `duracao_min` null for comum em produção (retroativos antigos) — medir a distribuição antes de travar 7h/15h; os limiares são constantes da lib, baratos de ajustar.
- **Selo × vitrine redundantes** — o selo é a assinatura rápida (um gesto pro detalhe), a vitrine segue com régua e progresso; se a revisão visual achar duplo, a vitrine pode sair do card depois — não antes.
- **PDM multi-dupla** (remanejo) multiplica o fetch — bounded por `duplas DPP` (na prática 1–2) e em paralelo; doc vazio não derruba a estante.
- **Toast duplicado** se nível e marco cruzarem na mesma visita — aceitável (um por sistema); se incomodar, o level-up tem prioridade.

## Premissas

- **Escopo da repintura:** só a família `nivel-*` vira raios/energia — marcos, instrumentos e contagens ficam; o `trophy` do marco "Jornada completa" continua apontando para `nivel-completa.svg` (a peça é uma só, agora em burst de raios).
- **Nomes das faixas ficam:** Início/Constância/Veterania/Jornada completa descrevem a régua (tempo + participação), não o desenho — trocar nome quebraria e2e e copy sem ganho pedido.
- **Contador × limiar:** convivem. O contador mede acúmulo ("3 combinados feitos"), o limiar nomeia o momento ("Palavra cumprida"). Fundir seria mais limpo de estante e mais confuso de critério — fica para uma próxima revisão se a estante pesar.
- **Horas honestas:** só `duracao_min` registrado conta, dedup por `sessao_id`, na trilha da régua; o critério diz "horas de encontro registradas". Assumir 60 min para null violaria a regra de não inventar número.
- **Combinados:** a fonte é `jovem_encaminhamentos` (`responsavel='mentorado'` — o que ele se comprometeu); sem `feito_em` na view, as peças ficam com `data: null` honesto até o DDL opcional.
- **Derivação pura, sem trava:** peça pode regredir pra futura quando a contagem cai — honesta nos dois sentidos, coerente com os contadores atuais.
- **Selo = um gesto:** abre o `FaixaDetalhe` compartilhado (não link âncora); "Remover foto" segue como ghost button e o selo sempre fecha a linha na direita.
- **O `NivelBloco` fica no card:** régua das 4 faixas + "o que falta" moram lá; o header leva só o selo — sem duplicar progresso.
- **Raridade é rótulo:** `inicial`/`constancia`/`marco_grande` aparecem só no detalhe; não ordenam, não pontuam.
- **Card sem jornada:** renderiza quando houver conquistas gerais (ganhas ou a caminho) — as peças de chegada (termo, perfil) são as primeiras da estante de quem ainda não tem dupla.
- **Sem idle:** nenhuma animação em loop entra nesta fatia; uma varredura de luz lenta no raio fica como candidato futuro se o produto pedir "vivo" — só no desenho, nunca no card.

## SQL sugerido (alçada do lead — NÃO aplicar)

Nenhum DDL é necessário para esta spec. O único ganho real seria datar o combinado feito; se o lead quiser:

```sql
-- SUGESTÃO para o lead revisar/numerar — NÃO aplicar.
-- Datar a conclusão do combinado: hoje jovem_encaminhamentos não expõe
-- quando o jovem marcou feito (a conquista fica sem carimbo).

alter table public.encaminhamentos
  add column if not exists feito_em timestamptz;

-- marcar_combinado (0070) passa a carimbar/limpar junto do flip:
--   set status = case when p_feito then 'feito' else 'pendente' end,
--       feito_em = case when p_feito then now() else null end
-- e a view ganha a coluna:
create or replace view public.jovem_encaminhamentos as
select e.id, e.dupla_id, e.descricao, e.prazo, e.status, e.feito_em, e.created_at
from public.encaminhamentos e
where public.my_role() = 'mentorado'
  and e.responsavel = 'mentorado'
  and exists (
    select 1 from public.duplas d
    where d.id = e.dupla_id
      and d.mentorado_id = public.my_mentorado_id()
  );
```

- Alternativa sem coluna nova: expor `registros.created_at` via `registro_id` como proxy da data — frágil (combinado pode ser feito sem registro posterior). A coluna é o caminho honesto.
- Se um dia a decisão for persistir "quando cada conquista cruzou" (para ordenar a estante sem depender de carimbos terceiros), aí nasce uma `conquistas_ganhas(mentorado_id, chave, ganha_em)` — mas a 016 decidiu derivação pura e esta spec mantém essa linha.
