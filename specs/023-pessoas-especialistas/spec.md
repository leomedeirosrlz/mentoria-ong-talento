# Spec — Pessoas: diretório do jovem, sua rede e o catálogo de especialistas

**Feature:** `specs/023-pessoas-especialistas` · **Status:** Clarified
**Fila:** feedback do usuário (24/11/2026, "Print 8") · recon `docs/planos/issues/_recon/pessoas-especialistas-2026-11-24.md` · **Dono:** Thiago · **Data:** 24/11/2026

## Problema e resultado

- **Dor hoje:** o diretório do jovem (`/jovem/pessoas`) é uma lista fechada da rede dele, sem busca nem filtro — quem não está numa dupla dele, na turma dele ou no catálogo de especialistas simplesmente não existe pro papel `mentorado`. Do outro lado, o `/pessoas` de staff fora da coordenação ("Print 8") oferece só busca + um Select de grupo de papel: nada de faceta por especialista, trilha ou tema. O pool de especialistas que o mentor vê pra sugerir são 4 campos num Select de nomes (e na agenda só o nome civil), enquanto o card rico já existe — mas está trancado na view gateada ao jovem. E o pedido de especialista do jovem acontece num modal-xl com uma lista simplificada, quando a própria vitrine rica do catálogo já está na página.
- **Resultado observável:** `/jovem/pessoas` reabre como diretório do programa com a faceta "Todos" como default, pills de vínculo e chips de tema, busca com destaque e contagem — e a rede dele marcada ("Sua rede", "Seu mentor", "Colega da turma"), nunca um segundo catálogo. A rede dele também ganha a seção "Sua rede" no `/jovem/perfil`, com os mesmos dados de hoje. Staff fora da coordenação ganha pills de papel/trilha e chips de área em `/pessoas` — a faceta "Especialistas" abre o catálogo rico. Uma projeção única de especialista (`especialistas_catalogo`, o mesmo select da `jovem_especialistas` com gate staff) alimenta o pool de sugestão do mentor, a solicitação da coordenação e a faceta de `/pessoas` — zero drift entre os recortes. O pedido de especialista vira fluxo em página: a seleção é a própria grade do catálogo com cards completos e o horário/texto acontece num painel inline — a sugestão do mentor idem, em painel expansível em vez de Select.
- **Como saberemos que funcionou:** o jovem abre Pessoas e vê o programa inteiro navegável, filtrável e sem vazar contato que ele não tinha antes; o mentor sugere especialista escolhendo num card com foto, bio, áreas e "Atende:", não num Select; o jovem pede trilha selecionando o próprio card do catálogo, sem modal; e nenhuma linha nova atravessa a fronteira que a matriz de visibilidade declara.

## Fora de escopo

- Qualquer canal de contato além das fronteiras atuais: WhatsApp/e-mail de especialista seguem abrindo só com a trilha (`jovem_contatos`), WhatsApp de colega segue atrás do opt-in `contato_compartilhado`, e o diretório não cria mensagem in-app nem "apresentar" — é vitrine navegável, não chat.
- Colega **sem conta** na plataforma: segue invisível (decisão registrada na 0076 — sem consentimento digital, sem vitrine).
- Filtro por turma, status, pendências e o modal de filtros para staff fora da coordenação — as fontes chegam vazias por decisão (dado operacional coord-only).
- Mudança nas RPCs do pedido de especialista (dedup por par, teto de 3, slot dentro da grade, gate da demanda) — o fluxo novo repassa os mesmos erros que hoje.
- `especialista_grade`/`excecoes` abrindo pra staff comum — só a projeção `grade_resumo`/`vagas` atravessa, igual à `jovem_especialistas`.
- Notificações novas e a Liza — nenhuma das duas entra nesta fatia.
- Consolidar ou manter `mentorados_turma` como view separada é decisão de schema do lead (a spec exige o comportamento, não a forma).

## Histórias de usuário

### US1 — Diretório do jovem com "Todos" primeiro (P1)

- **Por que P1:** é o pedido central — hoje o papel `mentorado` não tem como "fuçar perfis": as três views `jovem_*` só cobrem a rede dele.
- **Teste independente:** jovem com rede pequena abre `/jovem/pessoas`, filtra por vínculo, por tema e por texto.
- **Cenários:**
  1. **Dado** o jovem com dupla e colegas **quando** abre `/jovem/pessoas` **então** vê o diretório inteiro do recorte dele (rede + adultos do programa + jovens do programa + catálogo de especialistas) com a faceta "Todos" ativa e a contagem "N de M pessoas" — a rede dele marcada com selo "Sua rede" e o vínculo ("Seu mentor", "Colega da turma", "Seu especialista"), nunca a mesma pessoa duplicada.
  2. **Dado** o diretório carregado **quando** o jovem toca uma pill de vínculo (Todos · Minha rede · Colegas · Mentores · Especialistas · Equipe) ou um chip de tema **então** a lista recorta sem recarregar, a URL registra o estado (`?papel`/`?area`/`?busca`) pra deep-link e a contagem anuncia o novo total.
  3. **Dado** uma busca sem resultado **quando** a lista esvazia **então** o estado vazio nomeia a busca e oferece "Limpar filtros" — a mesma gramática do `/pessoas` de staff.
  4. **Dado** um card do diretório **quando** o jovem toca **então** navega à ficha `/jovem/pessoas/[id]` — card de pessoa nunca carrega ação de contato; o contato direto mora na ficha e só pra quem já tem o canal aberto.
  5. **Dado** qualquer pessoa do diretório **quando** a ficha abre **então** ela mostra só a projeção segura da matriz: fora da rede não tem WhatsApp nem e-mail; jovem do programa tem foto, mas nunca dados civis; especialista não tem contato antes da trilha.

### US2 — Ficha da pessoa no recorte do diretório (P1)

- **Por que P1:** "fuçar perfis" só faz sentido se a ficha abrir pra quem está fora da rede — hoje cai em 404 porque `getJovemPessoa` só resolve as três fontes da rede.
- **Teste independente:** abrir a ficha de um adulto do diretório que não é da rede, de um especialista do catálogo e de um id inexistente.
- **Cenários:**
  1. **Dado** o id de um adulto do programa fora da rede do jovem **quando** a ficha abre **então** mostra a projeção pública (banner, papel, cidade/UF, bio e áreas quando existirem), sem contato direto e sem rótulo de vínculo.
  2. **Dado** o id de um especialista do catálogo **quando** a ficha abre **então** mostra a `SecaoEspecialista` atual com o apontador pro catálogo — o contato segue fechado até a trilha nascer.
  3. **Dado** o id de alguém da rede **quando** a ficha abre **então** é a ficha de hoje: contato direto, vínculo e selo de dupla.
  4. **Dado** um id fora do diretório **quando** a ficha resolve **então** 404 — sem vazar nem a existência do profile.
  5. **Dado** o id de um colega **quando** a ficha abre **então** mostra a projeção de jovem do programa (com foto; WhatsApp só se ele compartilhou; dados civis nunca), com ou sem selo de turma.

### US3 — "Sua rede" no perfil do jovem (P1)

- **Por que P1:** a rede sai do corpo principal de Pessoas (que vira diretório) e ganha lugar próprio — o pedido é "as pessoas dele como cards no perfil", sem duplicar a aba Especialistas.
- **Teste independente:** jovem com dupla ativa, jovem com trilha de especialista e jovem sem rede.
- **Cenários:**
  1. **Dado** o jovem com rede **quando** o perfil abre **então** a seção "Sua rede" na coluna principal lista mentor, auxiliar, coordenação e colegas como linhas compactas (avatar + nome + vínculo + selo de dupla, com os mesmos canais de contato de hoje) navegáveis à ficha — dados das mesmas queries `React.cache` de sempre, sem custo novo.
  2. **Dado** o especialista da trilha dele **quando** a seção renderiza **então** aparece com selo "Seu especialista" e link à ficha; a aba Especialistas não se duplica — um link discreto "Conhecer especialistas" aponta pra ela, nunca uma segunda vitrine.
  3. **Dado** rede vazia (sem dupla e sem colegas com conta) **quando** a seção renderiza **então** o estado honesto diz quando a rede aparece — a mesma voz dos textos `vazio` de hoje.
  4. **Dado** um colega sem opt-in de contato **quando** a linha renderiza **então** diz "não compartilhou o contato" — nunca um CTA quebrado.
  5. **Dado** a mesma fonte no diretório **quando** a faceta "Minha rede" filtra **então** mostra exatamente as mesmas pessoas, deduplicadas por pessoa — uma rede só, dois lugares que a mostram.

### US4 — `/pessoas` de staff com facetas de verdade (P1)

- **Por que P1:** o Print 8 — fora da coordenação sobra busca + um Select "Todos" que filtra grupo de papel, e a trilha do mentor já chega nos chips da linha sem filtrar nada.
- **Teste independente:** mentor e auxiliar abrem `/pessoas` e usam as facetas.
- **Cenários:**
  1. **Dado** staff fora da coordenação **quando** abre `/pessoas` **então** uma linha de pills (`FilterChipRow`, mesma gramática `?cat`) substitui o Select: Todos · Coordenação e equipe · Auxiliares executivos · Mentores DPP · Especialistas · Mentorados — com contagem por pill e "N de M" total.
  2. **Dado** a faceta trilha **quando** staff filtra **então** distingue mentor DPP de mentor especialista (o híbrido conta nos dois lados, como na régua do `!inner` atual) via `?trilha`.
  3. **Dado** chips de tema **quando** staff toca uma área **então** a lista recorta pelas `areas`/interesses já exibidas nas linhas, via `?area`.
  4. **Dado** a faceta "Especialistas" **quando** staff a ativa **então** as linhas mostram a projeção rica do catálogo staff (áreas, "Atende:", vagas) — a mesma view dos fluxos de seleção da US5.
  5. **Dado** turma, status, pendências e o modal de filtros **quando** staff fora da coordenação usa a página **então** seguem fora — as fontes são coord-only por decisão, e a busca permanece dentro de `role="search"`.

### US5 — Um catálogo de especialistas só, dos dois lados (P1)

- **Por que P1:** o card rico existe (`JovemEspecialistaCard`) mas a fonte dele devolve 0 rows pra staff; o pool do mentor são 4 campos e a escolha é às cegas.
- **Teste independente:** mentor e coordenação abrem a superfície de sugestão/solicitação e veem o card completo.
- **Cenários:**
  1. **Dado** a view `especialistas_catalogo` (definer, gate staff) com o MESMO select da `jovem_especialistas` trocando só o predicado de papel **quando** staff a consome **então** recebe a projeção inteira: foto, nome/social, cargo·empresa, cidade/UF, áreas, bio, experiência, formação, voluntariado, "Atende:" e vagas.
  2. **Dado** o mentor sugerindo **quando** o pool abre **então** cada especialista aparece como card completo selecionável — não mais Select de nomes.
  3. **Dado** a coordenação solicitando **quando** o pool abre **então** vê o mesmo catálogo, no mesmo formato de card.
  4. **Dado** o shape do catálogo **quando** compara com `JovemEspecialista` **então** é idêntico — um componente de card só, com o CTA variando por superfície ("Prefiro esta pessoa"/"Pedir trilha" no jovem, "Selecionar" no staff) e zero drift entre recortes.
  5. **Dado** `grade_resumo` e `vagas` **quando** a view projeta **então** derivam das mesmas colunas da `jovem_especialistas` — `especialista_grade` segue fechada pra staff comum; a agregação nasce no banco.

### US6 — Pedir/sugerir especialista em página, com cards completos (P1)

- **Por que P1:** o form do jovem é modal-xl com lista avatar+nome+áreas; o do mentor é Select. O pedido: não-modal, cards completos e seleção clara.
- **Teste independente:** jovem pede trilha selecionando um card do catálogo; mentor sugere por card no painel.
- **Cenários:**
  1. **Dado** o jovem em `/jovem/especialistas` **quando** inicia "Pedir trilha" **então** a seleção acontece na própria grade do catálogo: cada card ganha estado "Selecionado" (texto visível + `aria-pressed`, nunca só cor) e o mural vira card próprio ("Qualquer especialista") no fim da grade.
  2. **Dado** um card selecionado **quando** o fluxo avança **então** um painel inline expansível (região sob a grade, âncora `#pedir`) oferece os slots reais dele e o texto (demanda 10–1000 ou motivo ≤500 conforme `pedidoPrecisaDemanda`) — sem Dialog; o foco move pra região ao abrir e volta ao card ao fechar, e o erro aparece inline no campo além do toast.
  3. **Dado** os estados da casa **quando** o fluxo renderiza **então** se comporta como hoje: teto de 3 batido desliga a seleção com a explicação; "Sem vagas"/"Agenda não aberta" apontam o mural; o `ConfirmarSlotDialog` segue como atalho do chip de horário (dialog pequeno de confirmação não é o problema).
  4. **Dado** o mentor **quando** sugere **então** vê painel expansível dentro da superfície atual (`SemTrilhaBlock` da agenda ou menu "Mais" da ficha) com os mesmos cards do catálogo staff e CTA "Selecionar"; a solicitação da coordenação segue o mesmo padrão — o Select sai dos dois.
  5. **Dado** qualquer seleção **quando** o pedido sai **então** passa pelos mesmos gates da RPC (dedup por par, teto, slot dentro da grade) — a UI mostra só o que o banco revalidaria.

## Casos de borda

- Jovem sem dupla DPP (turma `null`): o diretório segue mostrando adultos e catálogo; "Minha rede" cai no fallback já decidido na 0097 — `has_papel` com escopo null conta papel em qualquer escopo, então a coordenação continua alcançável.
- Jovem sem ficha vinculada (`jovem_perfil` null): a página diz que o cadastro está sendo vinculado, na mesma régua de `/jovem/especialistas` — nunca uma grade muda.
- O próprio mentor DPP no diretório: aparece uma vez como "Seu mentor" — a união da view não pode duplicá-lo nem deixá-lo sumir (a `jovem_especialistas` já o exclui do catálogo; dedup por profile id com a rede vencendo o catálogo).
- Especialista inativo: some do diretório e dos dois pools; pedido em aberto pra ele segue o fluxo atual de status — a view não deve inventar tratamento novo.
- Adulto sem bio, cargo ou áreas: o card mostra o que existe — nunca "—" atrás de "—".
- Dois papéis na mesma pessoa (mentor DPP que também é especialista): a row do diretório carrega o papel que explica a presença dela pra aquele jovem (rede primeiro, catálogo depois) — nunca duas linhas.
- Seleção de card durante `pending` do envio: travada até a resposta — estado otimista sem chance de pedido duplo.
- 320px e 200% de zoom: grade do catálogo cai em uma coluna e o painel inline ocupa a largura toda; pills rolam na horizontal com o fade do `FilterChipRow`.

## Matriz de visibilidade (dado × papel)

A fronteira que a `jovem_diretorio`, a `especialistas_catalogo` e as telas não podem atravessar. "✓" = exposto; "opt-in" = só com consentimento do titular; "—" = nunca.

**O que o JOVEM vê de cada tipo de pessoa:**

| Dado | Colega de turma | Adulto da sua rede | Adulto do diretório | Especialista (catálogo) |
|---|---|---|---|---|
| Nome / nome social | ✓ | ✓ | ✓ | ✓ |
| Foto (avatar) | ✓ (decisão do lead 24/11, inclusive menor) | ✓ | ✓ | ✓ |
| Papel / vínculo com ele | "Colega da turma" | "Seu mentor" / "Seu especialista" / "Auxiliar" / "Coordenação" | papel público, sem vínculo | "Seu especialista" se há trilha |
| Cidade / UF | ✓ | ✓ | ✓ | ✓ |
| Interesses | ✓ | — | — | — |
| Áreas de atuação | — | ✓ | ✓ | ✓ |
| Bio, cargo, empresa, experiência, formação, voluntariado | — | ✓ | ✓ | ✓ |
| WhatsApp | opt-in (`contato_compartilhado`) | ✓ (via `jovem_contatos`) | — | — (abre com a trilha) |
| E-mail | — | ✓ (via `jovem_contatos`) | — | — |
| LinkedIn | — | — | — | — (fora do catálogo por decisão) |
| "Atende:" (`grade_resumo`) e vagas | — | — | — | ✓ |
| Slot exato da agenda | — | — | — | — (só via RPC de slots na negociação) |
| Disponibilidade declarada | — | — | — | — |
| Nascimento, gênero, cor/raça, escolaridade, motivação | — | — | — | — |
| Dados civis, responsável, documentos | — | — | — | — |
| Currículo, notas, form_bruto | — | — | — | — |
| PDM, metas, objetivos | — | — | — | — |
| Avaliações, registros, presenças | — | — | — | — |
| Situação, motivo de saída | — | — | — | — |
| Último acesso | — | — | — | — |

**O que o STAFF vê (a novidade é só o catálogo — o resto é o que já existe):**

| Dado | Não-coord → adulto | Não-coord → jovem fora da dupla | Coordenação |
|---|---|---|---|
| Ficha operacional (nome, contato, foto, áreas, bio…) | ✓ (`profiles_select`) | — (fora do `jovem_relacionado` nem existe) | ✓ |
| Projeção rica de especialista (`especialistas_catalogo`) | ✓ **(novo)** | — | ✓ |
| Agenda exata do especialista | — (só `grade_resumo`) | — | ✓ |
| Jovem da própria dupla | ✓ ficha operacional | — | ✓ |
| Sensíveis (`*_pessoal`, civis, cor/raça, anamnese, documentos) | — | — | ✓ |
| Status operacional, pendências, turma, último acesso | — | — | ✓ |

## Requisitos funcionais

- **FR-001:** `/jovem/pessoas` passa a ser o diretório do jovem, servido por projeção de banco nova (sugestão: view definer `jovem_diretorio`, `where my_role()='mentorado'`, revoke public/anon + grant select authenticated, a disciplina das irmãs `jovem_*`). A projeção traz `id`, `tipo` (`colega` | `adulto` | `especialista`), `nome`, `nome_social`, `papel`, `avatar_path` (visível também pra jovem do programa; dados civis nunca entram), `cidade`, `uf`, `interesses`/`areas`, `bio`, `cargo`, `empresa`, `experiencia_previa`, `formacao_externa`, `voluntariado`, `grade_resumo`, `vagas`, `minha_rede` (bool), `minha_turma` (bool). Escopo default: adultos ativos com papel do programa + **todos os jovens com conta no programa** + o catálogo de especialistas — decisão do lead em 24/11, inclusive menores e foto. **WhatsApp e e-mail nunca entram na projeção** — o contato da rede segue chegando pela `jovem_contatos` e a ficha costura as duas fontes.
- **FR-002:** o diretório abre na faceta "Todos"; pills de vínculo (Todos · Minha rede · Colegas · Mentores · Especialistas · Equipe) + chips de tema/área + busca fuzzy com `HighlightText`; estado persistido na URL (`?busca`/`?papel`/`?area`) por `history.replaceState`; contagem "N de M pessoas" anunciada; sem refetch por letra (filtro client-side sobre o payload SSR, como `/pessoas` já faz).
- **FR-003:** cards do diretório navegáveis à ficha com Link único de nome acessível (`aria-label="Abrir perfil de {nome}"`, `prefetch={false}`); selo "Sua rede" + vínculo quando `minha_rede`; o card de especialista é o rico (`JovemEspecialistaCard`) adaptado pra navegar — hoje ele não linka, lacuna confirmada no recon; nenhuma ação de contato no card.
- **FR-004:** `getJovemPessoa` resolve id primeiro no diretório, depois mantém o detalhe pelas fontes atuais (contato → colega → especialista) — id fora do diretório cai no mesmo 404 de quem não existe.
- **FR-005:** seção "Sua rede" na coluna principal de `/jovem/perfil` (após `FichaSecao`): as mesmas linhas de hoje (adulto com e-mail/WhatsApp, colega com WhatsApp condicionado ou "não compartilhou o contato") extraídas pra componente compartilhado que perfil e diretório consomem; dedupe por pessoa+papel via `agrupaContatosPorPessoa`; selo de dupla não-ativa preservado; estado vazio honesto; link discreto "Conhecer especialistas" → `/jovem/especialistas`, sem segunda vitrine.
- **FR-006:** `/pessoas` fora da coordenação ganha as facetas que não dependem de dado coord-only: pills de papel (`?cat`, incluindo "Especialistas" como faceta explícita), faceta trilha DPP×Especialista (`?trilha`), chips de área/tema (`?area`) e a busca existente — tudo com contagens e contagem "N de M" anunciada. Turma, status, pendências, modal de filtros e agrupar por turma seguem coord-only.
- **FR-007:** projeção staff do catálogo (sugestão: view definer `especialistas_catalogo`, gate `my_role()` nos papéis staff) com o MESMO select da `jovem_especialistas` menos o predicado de papel — uma fonte, dois recortes; consumida por um getter dedicado (`getEspecialistasCatalogo()` ou extensão do `getEspecialistas()`), com shape idêntico a `JovemEspecialista`.
- **FR-008:** um componente de card de catálogo só — a anatomia de `JovemEspecialistaCard` (avatar, nome, cargo·empresa, cidade/UF, chips de área 4+N, bio em clamp, recolhível "Experiência e formação", "Atende:", badge de estado) extraída com CTA variando por superfície; usada no catálogo do jovem, no painel do mentor, no painel da coordenação e na prévia da ficha.
- **FR-009:** o pedido do jovem sai do modal: a seleção acontece na grade do catálogo (estado "Selecionado" com `aria-pressed` + texto visível; o mural vira card próprio "Qualquer especialista" no fim da grade) e a etapa de horário+texto acontece em painel inline expansível com foco gerenciado — `PedirEspecialistaDialog` sai do caminho principal; `ConfirmarSlotDialog` permanece como atalho do chip de horário.
- **FR-010:** os forms de staff (`SugerirEspecialistaDialog`, `SolicitarEspecialistaDialog`) trocam o Select pelo mesmo padrão: painel expansível na superfície atual com os cards do catálogo staff, seleção por card e os campos de demanda/objetivo inline.
- **FR-011:** validação e estados idênticos aos gates atuais: demanda 10–1000 / motivo ≤500 por `pedidoPrecisaDemanda`, dedup/teto/slot revalidados pela RPC com o erro repassado; erro também inline no campo (`aria-invalid` + `aria-describedby`), não só toast; `lotado`, `sem_vagas` e `sem_agenda` com a mesma honestidade dos badges de hoje; submit desabilita só durante o envio, com spinner e o rótulo original.
- **FR-012:** a ficha `/jovem/pessoas/[id]` ganha o contexto "pessoa do diretório" (adulto fora da rede e especialista do catálogo): projeção pública sem contato direto e sem vínculo, apontando pro catálogo quando couber — mantendo os contextos atuais de contato e colega.

## Requisitos não funcionais

- **RLS/RPC:** as views novas seguem a disciplina das irmãs (definer, `search_path` fixo, gate `my_role()` no WHERE externo, revoke public/anon, grant select authenticated); nenhuma policy de tabela base muda e nenhum grant novo em `profiles`/`mentorados`/`duplas` — o papel `mentorado` continua lendo 0 rows nelas. Embeds PostgREST seguem voltando null pro jovem; nomes se resolvem pelo diretório, como hoje. Caso e2e "papel negado via REST" pra cada objeto novo.
- **A11y:** pills com `role="group"` + `aria-label` + `aria-pressed` por chip; busca dentro de `role="search"` (fecha a lacuna atual de `/pessoas`); contagem "N de M" dentro de `role="status"`/`aria-live="polite"` (hoje não anuncia); card de pessoa com Link único e nome acessível completo — nada de `<div onClick>`; estado selecionado com texto visível além do indicador; painel inline move o foco ao abrir, `aria-expanded` no trigger, Escape/fechar devolve foco ao card; todos os alvos com hit ≥44px (`min-h-11`) e `focus-visible` visível; teclado completo em chips, pills, cards e painel; `prefers-reduced-motion` respeitado nas entradas e expansões; sem scroll horizontal no 320.
- **Copy:** pt-BR, sem travessão em texto exibido, sem jargão interno; "Sua rede" e "Minha rede" com a voz da casa; erro diz como recuperar; estado vazio nomeia a busca; "não compartilhou o contato" segue a formulação atual.
- **LGPD (A5):** nenhum dado pessoal novo é criado — as views projetam colunas existentes; a exposição nova (adultos do programa visíveis a todos os jovens; a projeção rica de especialista visível a todo staff) entra como linha em `docs/lgpd/inventario-dados.md` na mesma PR; a foto de menor segue visível por decisão do lead (24/11), mas os dados civis e contatos continuam fora da projeção.
- **Demo (A7):** `demoJovemDiretorio` e `demoEspecialistasCatalogo` espelham as views com o mesmo contrato de chaves — teste de paridade junto do `diretorio-jovem.test.ts`, senão a demo ensina errado.
- **Perf:** projeção segura sem join em dados civis; N esperado pequeno (dezenas) — filtro client-side sobre payload SSR; `prefetch={false}` nos links de ficha; avatar via `avatarPublicUrl` com `<img>` lazy default; busca debounced 300ms; `history.replaceState`, nunca `router.replace`; sem `dynamic()` novo — `JovemEspecialistaCard`/`FilterChipRow` já estão no bundle.
- **Docs na mesma PR:** a linha 52 do `docs/regression-map.md` ("o diretório do jovem é a rede dele") muda de invariante — reescrita na mesma PR; `specs/README.md` ganha a linha da 023; comentário do contrato D2 em `queries-jovem.ts` menciona a view nova.

## Entidades e dados

- **`jovem_diretorio` (view definer nova — sugestão de SQL pro lead):** `union all` de três braços — (a) adultos ativos com papel do programa (`has_papel` em `mentor_dpp`/`mentor_especialista`/`supervisor`/`coordenacao`, dedup por profile), (b) **todos os jovens com conta no programa** (não só a mesma turma; `minha_turma` vira selo), (c) o catálogo `jovem_especialistas` — com `tipo`, `minha_rede` (exists em `jovem_contatos` ∪ `mentorados_turma`) e `minha_turma` derivados no select; `avatar_path` visível também no braço jovem; `whatsapp`/`email` e dados civis ausentes do select inteiro.
- **`especialistas_catalogo` (view definer nova):** verbatim do select da `jovem_especialistas`, gate `my_role()` em `('coordenacao','mentor_dpp','mentor_especialista','supervisor')` — decidir no plano se ela também carrega `ativo` pra fila da coordenação.
- **`JovemPessoa` (`src/lib/types`):** novo `tipo: "diretorio"` com a projeção segura — a ficha resolve diretório → contato → colega → especialista nessa ordem.
- **`JovemEspecialista`:** vira o shape canônico do catálogo nos dois lados — o getter staff devolve o mesmo tipo.
- **`mentorados.contato_compartilhado`:** sem mudança — governa WhatsApp de colega, não presença no diretório. A decisão de 24/11 é programa inteiro para jovens com conta; não nasce opt-in novo nesta rodada.
- **`jovem_contatos` / `mentorados_turma` / `jovem_especialistas`:** seguem como estão — o diretório compõe; absorver `mentorados_turma` na view nova é opção de schema do lead, não exigência.

## Critérios de sucesso

- **SC-001:** e2e do jovem: `/jovem/pessoas` abre em "Todos" com o diretório completo do recorte; pills de vínculo, chips de tema e busca filtram sem recarregar, com contagem anunciada e URL atualizada; "Minha rede" mostra exatamente as pessoas da seção do perfil.
- **SC-002:** e2e da ficha: adulto fora da rede renderiza projeção pública sem contato; especialista abre a `SecaoEspecialista`; contato da rede abre com WhatsApp/e-mail; id fora do diretório → 404.
- **SC-003:** e2e do perfil: "Sua rede" lista mentor, auxiliar, coordenação e colegas com vínculo e selo de dupla; especialista marcado; colega sem opt-in mostra "não compartilhou o contato".
- **SC-004:** e2e staff não-coord: pills com contagem, faceta "Especialistas" mostrando a projeção rica, faceta trilha, chips de área; deep-link `?cat=especialistas` abre filtrado; coord segue com todas as facetas atuais.
- **SC-005:** e2e do fluxo: mentor sugere por card selecionado → sugestão registrada → jovem confirma; jovem seleciona card na grade → painel inline → pedido dirigido enviado; pedido pro mural; teto de 3 respeitado nos dois lados.
- **SC-006:** e2e REST por papel: `mentorado` na `jovem_diretorio` recebe só a projeção segura (sem `whatsapp`, `email`, `linkedin`, nada civil); `anon` → 0 rows; `especialistas_catalogo` → staff lê, `mentorado` recebe 0; staff comum não lê `especialista_grade` direto.
- **SC-007:** prints 1440×900 e 390×844: diretório (Todos + Minha rede), "Sua rede" no perfil, `/pessoas` com pills novas, painel do mentor com cards, fluxo inline do jovem.
- **SC-008:** unit: dedup rede×catálogo (uma pessoa, um card, selo certo), merge dos tipos do diretório, seleção/selecionado do painel, paridade `demoJovemDiretorio`/`demoEspecialistasCatalogo` com as projeções.

## Plano de testes

- **A estender:** `tests/diretorio-jovem.test.ts` (contrato de chaves e fronteira das projeções novas, espelho demo); `tests/e2e/app/jovem-pessoas.spec.ts` + `tests/e2e/demo/jovem-pessoas.spec.ts` (default "Todos", facetas, selo "Sua rede", jovem com foto e sem dados civis, 404 fora do diretório); `tests/e2e/app/jovem-especialista*.spec.ts` (seleção por card, fluxo não-modal, lotado/mural); `tests/jovem-especialista.test.ts` (variantes seguem).
- **A criar:** spec e2e REST da `jovem_diretorio` (papel mentorado → projeção segura; anon/negado → 0) e da `especialistas_catalogo` (staff lê, mentorado não) — padrão `relatorios.spec.ts`; unit do merge do diretório e do estado "Selecionado"; e2e do fluxo staff completo (sugestão por card → confirmação do jovem).
- **A11y:** tab-order no diretório e no painel inline; `aria-pressed`, `role="group"`, `role="status"` e `role="search"` assertivos nos specs de página.
- **Reescrever na mesma PR:** a linha do invariante no `docs/regression-map.md` e as expectativas que dizem "o diretório do jovem é a rede dele" — o invariante novo é "o diretório do jovem é o recorte seguro da `jovem_diretorio`; a rede dele é a faceta marcada".

## Riscos

- View definer com `OR` solto no WHERE abre o catálogo inteiro — mitigação: gate único `my_role()='mentorado'` no WHERE externo da view, revisão do lead e e2e REST do papel negado (precedente `relatorios.spec.ts`).
- Diretório vira vitrine de menores — decisão do lead (24/11): programa inteiro, com foto, limitado a quem tem conta; dados civis, documentos, contatos e avaliações seguem fora da projeção. A mitigação é a matriz, não o recorte de turma.
- Marcar "Sua rede" em tela compartilhada revela os vínculos dele a quem olha por cima — aceitável (é a visão dele); o risco real seria projetar vínculo de terceiros, que a view não faz (`minha_rede` é sempre do caller).
- Dedup errado duplica a pessoa ou some o próprio mentor — coberto por unit do merge + e2e.
- Preferência marcada no fluxo inline se perde no refresh — `onEnviado` limpa explicitamente, como o `CatalogoJovem` já faz.
- Painel do mentor aperta a ficha — fallback admitido: sheet grande ou seção dedicada da ficha, decidido no plano sem trocar a seleção por cards.
- Demo sem espelho mente o recorte — `demoJovem*` obrigatório com teste de paridade, senão a vitrine ensina errado.

## Decisões de produto abertas

Decisões que só o lead/produto fecha — a spec está escrita com o **default recomendado** de cada uma; mudar qualquer uma altera só o predicado da view e os testes, não as superfícies.

1. **Escopo do diretório pra menores — decidido em 24/11:** programa inteiro, incluindo menores, limitado a quem tem conta. Sem opt-in `visivel_diretorio` nesta rodada.
2. **Foto de menor no diretório — decidido em 24/11:** visível, inclusive para menores; dados civis/documentos nunca entram. O contato segue opt-in como hoje.
3. **Adultos no diretório do jovem:** todo adulto ativo com papel (recomendado — mentores, auxiliares e equipe já têm projeção pública no programa) × escopo reduzido.
4. **Coordenação no diretório:** hoje entra escopada na turma da DPP viva via `jovem_contatos`; no diretório amplo ela aparece por papel, sem vínculo — ok se a projeção é a mesma dos demais adultos (recomendado).
5. **`mentorados_turma` continua?** absorver como braço da `jovem_diretorio` (recomendado — uma fonte, zero drift) × manter as duas (menos churn nos testes).
6. **Opt-in de visibilidade do adulto:** adultos já consentem o papel no programa e o diretório é interno — recomendado sem opt-in novo; registrar se mudar.
7. **"Minha rede" mostra selo de dupla não-ativa** ("trilha concluída", "mentoria pausada") no diretório também, ou só no perfil — recomendado: nos dois, mesma etiqueta.

## Premissas

- "Ver todos" é o default e "Minha rede" é faceta marcada, não página separada — decisão tomada no pedido do usuário.
- O diretório é vitrine: não cria canal de contato novo, não mostra dado que a matriz marca "—", e toda ação sensível segue nas superfícies atuais (ficha, catálogo, mesa de negociação).
- "Pessoas dele" no perfil mantém os canais de contato de hoje (e-mail/WhatsApp de adulto, WhatsApp de colega atrás do opt-in) — a seção move a anatomia, não fecha funcionalidade.
- O pedido do jovem mora em `/jovem/especialistas` (a grade do catálogo é a etapa de seleção); os forms de staff moram em painel expansível nas superfícies onde já vivem.
- Migrations são alçada do lead: todo nome de view/RPC e todo SQL citado aqui é sugestão em texto — o lead numera, revisa e aplica.
