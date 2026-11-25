# Recon — Pessoas e especialistas

**Head:** `aecb135e` (branch `recon/pessoas-especialistas`, base `integration/plano2`) · **Fonte:** sintomas do usuário (24/11/2026, incl. "Print 8") + leitura do código e das migrations · **Status:** diagnóstico, não implementa.

> Pipeline: feedback → recon → spec → implementação → reviews → aprovação manual.
> Migrations são alçada do lead: todo SQL abaixo é **sugestão em texto**, sem arquivo criado. As três frentes de recon foram rodadas por subagentes exploradores (RLS/dados, telas, fluxo de especialistas) e consolidadas aqui; file:line verificado no worktree.

## 1. Resumo executivo

Os seis sintomas contam uma história só: **o diretório do jovem é uma lista fechada da rede dele; o usuário quer um diretório amplo com "Ver todos" como default, e a rede dele virando cards no próprio perfil.** O app já tem quase todas as peças — o que falta é uma projeção de diretório no banco e a recombinação do que existe.

- **Acesso do jovem é view-gated, não policy-gated.** O papel `mentorado` lê **0 rows** de `profiles`/`mentorados`/`duplas` base (`profiles_select` `0141:72-81`, `mentorados_select` `0125:201-214`, `duplas_select` `0125:123-128`). Tudo chega por views `security definer` `jovem_*` escopadas em `my_role()='mentorado'` (contrato D2, `src/lib/queries-jovem.ts:42-49`). "Ver todos" exige **view/RPC nova** (ex.: `jovem_diretorio`) — não dá pra ampliar por tela.
- **"Pessoa dele" já é um recorte pronto**: `jovem_contatos` (mentor+auxiliar das duplas + coord, com WhatsApp/e-mail por default) e `mentorados_turma` (colegas com conta da mesma turma; WhatsApp atrás do opt-in `contato_compartilhado`). Mover isso pro perfil é trabalho de composição, não de dados.
- **O "card rico" já existe e é usado só pelo jovem**: `JovemEspecialistaCard` (`src/components/jovem-especialista-card.tsx`) alimentado pela view `jovem_especialistas` (bio, áreas, cargo·empresa, cidade/UF, experiência/formação, `grade_resumo`, `vagas`). O pool do mentor é `getEspecialistas()` — **4 campos** (`id, nome, nome_social, areas`, `queries-especialista.ts:268-312`) e na agenda ainda mais pobre (só `nome` civil, `agenda/page.tsx:414-417` + `agenda-por-mentorado.tsx:144-149`). A view do catálogo é gateada a `mentorado` — staff precisa de projeção própria.
- **"Print 8" é o `/pessoas` do staff sem ser coord**: a listagem inteira (busca fuzzy, pills de turma/trilha, modal de filtros, status operacional) é coord-only; fora da coordenação sobra busca + um Select "Todos" que filtra **grupo de papel** (`pessoas-listas.tsx:1033-1061`). Filtro por "especialistas" não existe como faceta para o mentor.
- **O form "solicitar especialista" do jovem é modal** (`PedirEspecialistaDialog`, `DialogContent size="xl"`) e funcional; o do mentor é um Select de nomes. O pedido do usuário (não-modal, cards completos) tem precedente na casa: seções inline expansíveis e o catálogo dedicado de `/jovem/especialistas`.
- **"Custo" não existe** em lugar nenhum do modelo — o que existe por especialista: bio, áreas, cargo·empresa, cidade/UF, experiencia_previa, formacao_externa, voluntariado, grade_resumo ("Atende: dia+período"), vagas.

Recomendação curta: fatia (a) view `jovem_diretorio` + página `/jovem/pessoas` como diretório com facetas e "Ver todos" default; (b) seção "Sua rede" no `/jovem/perfil` com os mesmos dados de hoje; (c) projeção rica de especialista pro staff + superfície não-modal de seleção; (d) pedido do jovem vira fluxo em página/seção com cards. Detalhes e decisões de produto abaixo.

## 2. Modelo de acesso atual

Arquitetura em 3 camadas (recon A): **grant por coluna** → **RLS por linha** → **views definer** (o repo não usa `security_invoker`; o gate mora no `WHERE` da view). Não existe tabela `contatos_compartilhados` — o opt-in de contato é a **coluna** `mentorados.contato_compartilhado` (`0076:15-16`) projetada como `case when` na view (`0076:85`), com RPC `set_contato_compartilhado` (`0076:104-124`), action `setContatoCompartilhado` (`actions-jovem.ts:45-59`) e UI `PrivacidadeCard` (`(jovem)/jovem/perfil/privacidade-card.tsx`).

### 2.1 Dado → quem vê → garantia

| Dado | Quem vê hoje | Garantia (file:line) |
|---|---|---|
| WhatsApp/e-mail de mentor/auxiliar/especialista/coord **dele** | jovem (default) | view definer `jovem_contatos` (`0097:424-459`); render `pessoas/[id]/page.tsx:233-275` |
| WhatsApp de colega de turma | jovem, só se o colega optou | `case contato_compartilhado` (`0076:85`); toggle `privacidade-card.tsx`; RPC `0076:104-121` |
| Nome/foto-path/cidade/UF/interesses de colega **com conta** | jovem da mesma turma | `mentorados_turma` (`0076:76-98`) — `profile_id not null` + `turma` textual compartilhada |
| E-mail, nascimento, gênero, escolaridade, motivação, dados civis de colega | ninguém além de coord/staff da dupla | ausentes da projeção + `mentorados_select` sem ramo mentorado (`0125:201-214`) |
| Nome/foto/bio/áreas/atuação/agenda-resumo/vagas de especialista | jovem (catálogo global desde `0101`) | `jovem_especialistas` (`0101:33-81`); slots exatos só via RPC `especialista_slots_livres` (`0073:126-222`) |
| WhatsApp/e-mail/linkedin de especialista | ninguém até a dupla nascer | ausentes da view; contato direto abre via `jovem_contatos` quando a trilha começa (`0075:5-6`) |
| Sensíveis do **próprio** jovem (dados_civis, responsavel, cor_raca…) | ele + coord | `jovem_perfil` (`0076:127-154`); `mentorados_pessoal` coord-only (`0076:187-201`) |
| Sensíveis de terceiros | só coordenação | sem grant (`0034:187-198`, `0054:89`) + `*_pessoal` coord-only (`0054:93-120`) |
| Ficha de jovem (qualquer) | mentor/auxiliar/coord da dupla | `mentorados_select` (`0125:201-214`) — jovem lê 0 rows, inclusive a dele |
| Profile de jovem | staff só se `jovem_relacionado` | `profiles_select` (`0141:72-81`) + oracle (`0076:29-44`) |
| Duplas (quem é par de quem) | staff escopado | `duplas_select` (`0125:123-128`); jovem via `jovem_duplas` (`0067:68-80`) |
| Registros/notas/intenções do mentor | staff da dupla | `registros_select` (`0125:296`), `encontro_notas` (`0125:154`), `encontro_intencoes` (`0152:64`) — jovem 0 |
| PDM da própria dupla | jovem + staff | `pdm_select` (`0125:237-247`) |
| Avaliações das duplas dele | jovem + staff | `avaliacoes_select` (`0125:92-106`) |
| Pedidos/propostas de especialista | partes envolvidas | `sol_select`/`prop_select` (`0125:309-340`), `solicitacoes_mural` (`0125:457-503`) |
| Último acesso / `profiles_acesso` | só coord | `0192:22-28` |
| Agenda crua do especialista | dono + coord | RLS `especialista_grade/excecoes` (`0073:73-117`); jovem só `grade_resumo` + slots derivados |

### 2.2 O que bloqueia hoje o "fuçar perfis" (ordem de severidade)

1. **`mentorados_select` sem ramo mentorado** (`0125:201-214`) — 0 fichas de jovem, inclusive a própria.
2. **`profiles_select` sem ramo mentorado** (`0141:72-81`) — só a própria row, e só colunas com grant; e-mail/whatsapp/dados civis dão *permission denied* até no self-select (`0034:185-198`).
3. **`duplas_select`/`mentor_profiles_select`/`profile_papeis_select` sem ramo mentorado** (`0125:123`, `0065:28`, `0085:391`) — impossível enumerar duplas/capacidades/papéis alheios.
4. **Não existe view/RPC de diretório amplo** — as únicas listas acessíveis são as 3 views escopadas; `getJovemPessoa` resolve id **só dentro delas** (`queries-jovem.ts:123-138`) e a página cai em `notFound()` (`pessoas/[id]/page.tsx:48`), sem vazar nem a existência do profile.
5. **Grants por coluna** — mesmo com row liberada, colunas sensíveis morrem no select.
6. **Embeds PostgREST herdam RLS** — `profiles:`/`mentorados:` voltam null pro mentorado; o código já depende disso e "costura" nomes pelo catálogo/`jovem_contatos` (`queries-jovem.ts:283-308`).

### 2.3 "Pessoa dele" hoje × o que faltaria pro diretório

**Hoje a rede visível é:** (a) mentor+auxiliar de todas as suas duplas (qualquer status) + coordenação escopada na turma da DPP viva, com contato direto (`jovem_contatos`, `0097:424-459`); (b) colegas com conta que dividem `turma` textual com alguma dupla dele (`mentorados_turma`, `0076:76-98` — sem filtro de status da dupla do colega); (c) catálogo global de especialistas (`jovem_especialistas`, `0101` — que exclui o próprio mentor DPP, `0101:76-81`). Fora disso, pessoa não existe pro jovem.

**Para o "Ver todos" sem vazar PII** (padrão da casa):

- **View definer nova** (sugestão: `jovem_diretorio`) com `where my_role()='mentorado'` + revoke/grant das irmãs — ou RPC definer com whitelist. Escopo é decisão de produto (§7): coorte da turma, programa inteiro, ou atrás de opt-in novo (`visivel_diretorio` — hoje `contato_compartilhado` governa só WhatsApp).
- **Campos seguros com precedente**: nome, nome_social, cidade, uf, interesses, papel/role; pra adultos: bio, cargo, empresa, areas, voluntariado, experiencia_previa, formacao_externa — tudo já projetado em `jovem_especialistas`/`mentorados_turma`.
- **Ficam fora** (como hoje): whatsapp/e-mail (opt-in/dupla), data_nascimento, genero, cor_raca, dados_civis, responsavel, documento_path, form_bruto, notas, curriculo_*, motivacao, objetivos, escolaridade, disponibilidade, situação/motivo_saida, PDM/avaliações/presenças, linkedin (grant público mas propositalmente fora do catálogo), último_acesso.
- **Atenção**: `mentorados_turma.avatar_path` **chega ao client** (`0076:81`) — "menor sem cláusula de imagem" é hoje decisão só de renderização (`pessoas/page.tsx:281-283`), e o bucket é público. No diretório amplo a fronteira deve morar na projeção, não só na tela.

## 3. Inventário de telas/componentes

### 3.1 Staff `/pessoas` — `src/app/(app)/pessoas/page.tsx` + `src/components/pessoas-listas.tsx` (2.519 linhas)

- Guards: `role==='mentorado'` → `/jovem` (`page.tsx:40`); `souCoord = role==='coordenacao'` (`:43`). Fora da coordenação **nenhum** dado operacional é buscado (`Promise.resolve([]/{})`, `:64-72`) — viria escopado pelo RLS e renderizaria badges falsos.
- `PessoasListas` (client): estado de filtros semeado de `window.location.search`, persistido por `history.replaceState` (`:368-435`, `:966-1002`). Params: `?busca ?cat ?turma ?trilha ?status ?pendencias ?ordem ?agrupar`.
- **Não-coord (Print 8)**: `Input type="search"` fuzzy + `HighlightText` (`:1013-1029`, `:471-500`) e **Select "Todos"** filtrando grupo de papel — Todos / Coordenação e equipe / Auxiliares executivos / Mentores / Mentorados (`:1033-1061`, `GRUPO_LABEL :145-151`). Pills de turma, pills de trilha, modal de filtros, status e pendências **são coord-only** (mapas chegam vazios). Meta da linha não-coord já mostra chips de `areas` pra mentor (`:1987-2008`).
- Coord: pills `FilterChipRow` de turma com contagens (`:1080-1144`), pills de trilha DPP/Especialista (`:1149-1206`), `FiltrosButton`+Dialog com rascunho→Aplicar (`:1534-1695`), status no vocabulário fechado, "N de M"+Limpar (`:1063-1076`), `FilaEspera` via `dynamic()` (`:99-101`), agrupar papel/turma, arquivos colapsáveis "Fora do programa"/"Inativos".
- `PessoaRow`/`MentoradoRow` (`:1805`, `:2264`): card-linha `Collapsible` — Link único avatar+nome+meta → `/pessoas/[id]` (`prefetch={false}`), `StatusChips` (coord), `DetalhesRegiao` (`role="region"`, `keepMounted`, `:1775-1798`), ⋮ ações.
- `/pessoas/[id]` (`pessoas/[id]/page.tsx`, 1.178 linhas): `getPessoaPerfil` resolve profile|mentorado (RLS barrou → 404, `queries.ts:800-891`); banner+avatar, chips de contato, "Resumo da mentoria" (uso X/Y só coord), "Sobre", "Cadastro" colapsável (civis/responsável coord-only), rail com Duplas/Currículo/Documentos/Notas.

### 3.2 Jovem `/jovem/pessoas` — `(jovem)/jovem/pessoas/page.tsx` (353 linhas)

- Agrupada por cargo: **Mentoria / Especialistas / Auxiliar executivo / Coordenação** (de `jovem_contatos`, dedupe por pessoa via `agrupaContatosPorPessoa`, `jovem-contatos.ts:19-39`) + **Colegas da turma** (`mentorados_turma`). `ContatoLinha`/`ColegaLinha` → `/jovem/pessoas/[id]`; e-mail/WhatsApp diretos pra adultos; WhatsApp de colega só com opt-in (senão "não compartilhou o contato", `:346-349`). CTA "Conhecer especialistas" → `/jovem/especialistas` (`:92`). **Sem busca nem filtro nenhum.**
- `/jovem/pessoas/[id]` (`pessoas/[id]/page.tsx`, 397 linhas): resolve em 3 fontes seguras (`getJovemPessoa`) → `contato|colega|especialista`; fora → 404. `PessoaBanner`+avatar (foto só adulto), badge de vínculo ("Seu mentor", "Colega da turma"…, `rotuloContato :196-209`), `SeloDupla` ("trilha pausada"…), `SecaoEspecialista` (bio/atuação/áreas/experiência/formação/voluntariado/"Atende", `:340-396`), `SecaoContato` (mailto+wa), `SecaoColega` (cidade/UF/interesses + wa condicional).
- `/jovem/perfil` (`perfil/page.tsx`, 205 linhas): grid `xl:grid-cols-[1fr_340px]`; coluna principal = `DadosSecao`, `DisponibilidadeCard`, `FichaSecao`, `ConquistasCard`, `JovemChamados`; rail = `PrivacidadeCard` + `ContaSecao`. Composição de seções independentes — **um card "Sua rede" encaixa naturalmente** na coluna principal.
- Nav do jovem (`jovem-shell.tsx:37-48`): 7 itens — Início, Agenda, Materiais, **Especialistas** (Sparkle), **Pessoas** (Users), Perfil, Ajuda; no mobile Pessoas e Perfil ficam só no Menu lateral (`:46-60`). Staff: `/pessoas` no grupo "Dados" (`app-shell.tsx:44-61`); **não existe item "Especialistas" na nav de staff.**

### 3.3 Fluxo de especialistas

- **Mentor sugere**: `SugerirEspecialistaDialog` (`sugerir-especialista-dialog.tsx`, `DialogContent lg`) — Textarea demanda (10–1000) + objetivo (≤500) + **Select com nomes** (+`· áreas` quando a prop traz). Call-sites: `SemTrilhaBlock` na agenda "Por mentorado" (`agenda-por-mentorado.tsx:1334-1378`, pool **só `nome` civil** — a página projeta fora `nome_social`/`areas`, `agenda/page.tsx:414-417`) e menu "Mais" da ficha (`duplas/[id]/mais-menu.tsx:235-245`, pool completo de `getEspecialistas()`). Action `sugerirEspecialistaMentor` → RPC (`actions-especialista.ts:458-493`).
- **Coord solicita**: `SolicitarEspecialistaDialog` (pedido nasce `aberta`, sem passar pelo jovem); mesmo pool `getEspecialistas()`. Mesa de negociação `SolicitacoesCoordCard` na home coord; `TrilhasCoordPanel` read-only.
- **Jovem pede**: `CatalogoJovem` (`catalogo-jovem.tsx`) — wrapper client com preferência (`preferenciaId`) + UM `PedirEspecialistaDialog` (`pedir-especialista-dialog.tsx`, `DialogContent xl`, `:259`): escolha dirigido×mural (`OpcaoAlvo`, `:269-288`), lista de especialistas com **Avatar+nome+áreas** (sem bio, `:293-340`), chips de slot lazy (`buscarSlotsEspecialista`, `:194-206`), demanda 10–1000 ou motivo ≤500 conforme `pedidoPrecisaDemanda` (`jovem-especialista.ts:49-60`), footer sticky, erros via toast (RPC revalida teto/dedup/slot). `ConfirmarSlotDialog` pra atalho por chip de horário.
- **Card rico**: `JovemEspecialistaCard` (`jovem-especialista-card.tsx`) — avatar 44, nome, cargo·empresa, cidade/UF, chips áreas 4+N, bio clamp, `<details>` "Experiência e formação", "Atende: períodos", badge de variante (`varianteDoCard`, `jovem-especialista.ts:142-161`), CTA por variante. **Não navega à ficha** (só `EspecialistaPreview` na `jovem-sugestao-card.tsx:42-93` linka `/jovem/pessoas/[id]`).
- **Pool do mentor × card rico — campo a campo**: faltam `avatar_path, bio, cargo, empresa, cidade, uf, experiencia_previa, formacao_externa, voluntariado, grade_resumo, vagas` — `getEspecialistas()` traz só `{id, nome, nome_social, areas}`. E `jovem_especialistas` devolve 0 rows pra staff (gate `my_role()='mentorado'`): paridade exige projeção staff-side nova ou extensão da query.

## 4. Achados por ponto + opções + recomendação

### Ponto 1 — Jovem com acesso restrito demais

**Achado:** o jovem vê só quem já está ligado a ele (duplas, mesma turma, catálogo de especialistas). Não existe projeção de diretório: `profiles`/`mentorados`/`duplas` são 0 rows e nenhuma `jovem_*` lista pessoas fora da rede dele. Colegas **sem conta** são invisíveis (`profile_id not null`, `0076:88`) — decisão registrada e provavelmente correta (sem consentimento digital, sem vitrine).

**Opções:**
- **A. View `jovem_diretorio`** (definer, `my_role()='mentorado'`): uma row por pessoa com a projeção segura da §2.3. Escopo a decidir: (a1) jovens só da **mesma turma** (extensão do recorte atual, sem colega novo); (a2) **programa inteiro** para adultos + mesma turma para jovens; (a3) programa inteiro para todos atrás de opt-in `visivel_diretorio`.
- **B. RPC definer** com os mesmos campos — equivalente; a view é mais simples de consultar com filtros.
- **C. Nada de view**: compor o diretório das 3 fontes atuais — **não atende**: não amplia o recorte.

**Recomendação:** A2 — diretório amplo para a **equipe/mentores/especialistas** (adultos, já com projeção pública no catálogo) e colegas **com conta da mesma turma** para jovens; opt-in de visibilidade (`visivel_diretorio`) se a decisão for programa-inteiro pra menores. É o passo que respeita a fronteira já desenhada (menor sem cláusula de imagem, WhatsApp atrás de opt-in) e ainda entrega o "fuçar perfis" com corpo denso.

### Ponto 2 — "Ver todos" default + "pessoas dele" no perfil

**Achado:** `/jovem/pessoas` hoje É a "rede dele" agrupada por cargo. O perfil (`/jovem/perfil`) é uma composição de seções independentes — card novo encaixa sem refatorar nada; os dados (`getJovemContatos`+`getJovemColegas`, ambos `React.cache` já compartilhados com a home) não custam query nova.

**Opções:**
- **A.** `/jovem/pessoas` vira diretório com faceta default "Todos"; a rede dele vira chip/aba "Minha rede" ou seção destacada no topo. Seção "Sua rede" nova no perfil com cards compactos (avatar+nome+vínculo → ficha).
- **B.** Manter a página agrupada e adicionar aba "Todos". Menor churn, mas o default continua sendo o recorte — não é o pedido.
- **C.** Rede no perfil + diretório numa rota nova (`/jovem/pessoas` mantido ou `/jovem/diretorio`). Rota nova não é pública (sem `isPublic`), mas fragmenta a nav — Pessoas já está no Menu lateral no mobile.

**Recomendação:** A — a página reabre com diretório amplo e a rede dele marcada (chip "Minha rede" como preset de filtro + seção própria no `/jovem/perfil`, p.ex. após `DadosSecao`, reutilizando `ContatoLinha`/`ColegaLinha` ou card no padrão `PessoaRow` sem ações). O invariante do regression-map:52 ("diretório do jovem é a rede dele") muda de forma — atualizar na mesma PR.

### Ponto 3 — Filtros pobres (Print 8)

**Achado:** para não-coord, `/pessoas` tem busca + select "Todos" (grupo de papel) e **nada mais**. Coord tem pills de turma/trilha, modal de filtros, status, pendências — porque os mapas chegam vazios fora dela (`page.tsx:64-72`). As trilhas do mentor chegam no chip de `areas` da linha (`:1987-2008`) mas não filtram.

**Opções:**
- **A.** Liberar pro não-coord as facetas que **não dependem de dados coord-only**: papel/trilha (DPP × especialista — derivável de `profile_papeis`/`p.papeis` que o staff já lê), áreas/temas (já na linha), busca textual (já existe). Turma segue coord-only (fontes são `mapasTurma`).
- **B.** Idem A + um faceta "Especialistas" explícita que abre o catálogo rico staff-side (resolve junto com o Ponto 4).
- **C.** Dar ao mentor a mesma visão turma da coord — vaza filiação operacional que o recorte atual esconde; não recomendado sem decisão.

**Recomendação:** A+B — pills `FilterChipRow` "Todos · Mentores DPP · Especialistas · Auxiliares · Equipe · Mentorados" + filtro por área/tema (multi-chip das áreas presentes) + busca existente. A gramática de URL já existe (`?cat ?trilha`); reutilizar `?cat`/`?trilha` pra compat de deep-link.

### Ponto 4 — Mentor vendo o mesmo card rico

**Achado:** o card rico existe (`JovemEspecialistaCard`) mas a fonte dele é gateada ao papel `mentorado`. O pool do mentor são 4 campos (e 2 na agenda). Paridade precisa de projeção staff-side com os mesmos campos.

**Opções:**
- **A.** Estender `getEspecialistas()` pra trazer a projeção pública (join `profiles`+`mentor_profiles`, `grade_resumo`/`vagas` derivados como a view faz) — shape idêntico a `JovemEspecialista`, card reusável direto. RLS: staff já lê `profiles`/`mentor_profiles`/`profile_papeis`; `especialista_grade` é dono/coord — `grade_resumo` pra staff precisa nascer na query (agregação das mesmas colunas da view, mas a tabela fecha pra mentor comum → **exige view definer ou RPC staff-side**, não select crua).
- **B.** View `especialistas_catalogo` (definer, `my_role() in (staff…)`) com o MESMO select da `jovem_especialistas` menos o gate de papel — uma fonte, dois recortes, zero drift. É o padrão `profiles_contato`/`profiles_pessoal` da casa.
- **C.** Mentor lê a `jovem_especialistas` (abrir o gate pra staff) — quebra o contrato "jovem_* = recorte do mentorado"; não recomendado.

**Recomendação:** B — view definer compartilhando a projeção (mesmo conjunto de colunas, gate por papel staff), consumida por `getEspecialistas()` extendido ou getter novo `getEspecialistasCatalogo()`. Mantém `jovem_especialistas` intacta e dá ao mentor/coord o card completo (foto, temas, bio, atuação, "Atende", vagas).

### Ponto 5 — Form de solicitação não-modal com cards completos

**Achado:** o form do jovem é `PedirEspecialistaDialog` (modal xl): alvo dirigido×mural → lista avatar+nome+áreas → slots → texto. Funciona, mas a seleção é lista simplificada dentro de overlay — é exatamente o "modal com lista simples" do feedback. O do mentor é ainda mais pobre (Select de nomes). Precedentes de não-modal na casa: seção inline expansível (`<details>`/expansão — padrão dominante: `SemTrilhaBlock`, `TrilhasAnteriores`, devolutivas, `<details>` do próprio card rico), bottom sheet 85dvh (`combinar-plano.tsx:1194-1211`), página/seção dedicada (o próprio `/jovem/especialistas` com âncoras `#trilhas`/`#pedidos`/`#catalogo-titulo`).

**Opções:**
- **A. Fluxo em página/seção** — a seleção vira o próprio catálogo: cada `JovemEspecialistaCard` ganha estado "Selecionado"; tocar em "Pedir trilha" abre a etapa de horário+texto **inline** (painel expansível sob o card ou seção âncora `#pedir`), não em Dialog. O mural vira card próprio no fim da grade. Prós: zero overlay, reutiliza o card rico que já é a vitrine, resolve "seleção clara" de graça. Contras: mais estado na página client (`CatalogoJovem` já é o wrapper).
- **B. Bottom sheet grande** — mesmo conteúdo do dialog xl dentro de `Sheet` (precedente `combinar-plano`). Prós: porte direto do form atual. Contras: continua overlay; a queixa era "modal".
- **C. Página dedicada `/jovem/especialistas/pedir`** — wizard de 2 passos (quem → quando/porquê) com cards completos; deep-link `?esp=` dos cards. Prós: espaço total, URL compartilhável, "Voltar" grátis. Contras: uma rota a mais; o catálogo já fica na mesma página — o ganho sobre A é pequeno.

**Recomendação:** A (jovem) — a etapa de escolha passa a ser a grade do catálogo com cards completos (foto, temas, bio, "Atende", vagas já estão lá) + painel inline de horário/demanda; manter `ConfirmarSlotDialog` como atalho (dialog pequeno de confirmação não é o problema). Para o **mentor**: a mesma anatomia dentro do `SemTrilhaBlock`/ficha — seleção por cards (projeção do Ponto 4) em painel expansível, não Select; se o espaço apertar, sheet ou seção dedicada na ficha.

### Ponto 6 — Pills de filtro úteis (Print 8)

Coberto no Ponto 3 — a faceta "especialistas" é a mais valiosa porque abre o catálogo staff-side. Para o diretório do **jovem**, facetas propostas na §5.

## 5. Proposta de informação, filtros e catálogo

### 5.1 Diretório do jovem (`/jovem/pessoas`, "Ver todos" default)

- **Fonte**: view `jovem_diretorio` (sugestão de SQL pro lead — projeção da §2.3): `id, tipo ('colega'|'adulto'|'especialista'), nome, nome_social, papel, avatar_path(adulto only), cidade, uf, interesses|areas, bio, cargo, empresa, minha_rede bool, minha_turma bool`. Colega menor sem foto na projeção (fronteira no banco, não na tela).
- **Facetas** (gramática de URL já usada: `?busca ?papel ?area ?rede`):
  - **Papel/vínculo** (pills `FilterChipRow`): Todos · Minha rede · Colegas · Mentores · Especialistas · Equipe.
  - **Tema/área**: chips das `areas`/`interesses` presentes (multi-select leve, mesmo padrão das pills de turma).
  - **Texto**: busca fuzzy (`fuzzyMatch`/`HighlightText` — já em `/pessoas` e `/registros`).
  - Turma: filtrar "minha turma" só faz sentido se o diretório exceder a turma — expor como pill quando (a2/a3) for decidido.
  - Disponibilidade: **não filtrar** — é dado operacional; "Atende: períodos" já aparece no card do especialista.
- **Cards**: reusar a anatomia `ContatoLinha`/`ColegaLinha` em grade `sm:grid-cols-2` com selo "Sua rede" e vínculo ("Seu mentor", "Colega da turma") quando `minha_rede`; o card de especialista mantém o rico (`JovemEspecialistaCard` adaptado pra navegar à ficha — hoje ele não linka, lacuna confirmada).
- **Estados**: busca vazia com query citada + "Limpar filtros"; diretório vazio; loading skeleton.

### 5.2 "Sua rede" no perfil do jovem

- Seção na coluna principal de `/jovem/perfil` (após `DadosSecao`/`FichaSecao`), card `rounded-xl bg-card` da casa com linhas compactas: avatar+nome+vínculo+selo de dupla → `/jovem/pessoas/[id]` (navegação, sem botões de contato — o contato direto continua na ficha; alternativa: manter os chips wa/mailto, já autorizados pela `jovem_contatos`).
- Dados: `getJovemContatos` + `getJovemColegas` (já cacheados, zero custo novo) + `porDupla` pra selo — mesmo código da página atual, extrair pra componente compartilhado (`components/jovem-rede.tsx` ou similar) consumido pelos dois lugares.

### 5.3 Catálogo staff-side (mentor/coord)

- View `especialistas_catalogo` (definer, gate `my_role() != 'mentorado'` ou staff-list) com o MESMO conjunto de colunas de `jovem_especialistas` (+`ativo`, talvez `vagas`/`grade_resumo` idem) — uma projeção, dois recortes.
- `getEspecialistas()` extendido ou getter paralelo consumindo essa view; `SugerirEspecialistaDialog`/`SolicitarEspecialistaDialog`/`PedirEspecialista`-equivalente staff trocam Select por seleção com cards (mesma anatomia, CTA "Selecionar").
- Faceta "Especialistas" no `/pessoas` não-coord abre essa mesma projeção (catálogo pra sugerir) — resolve o Print 8 e o Ponto 4 num gesto só.

## 6. Critérios de aceite

**Acessibilidade** (padrão da casa + WCAG 2.1 AA; alvos **mín. 44×44px** em touch, já `min-h-11` no código):

- Toda lista filtrável: pills com `role="group"` + `aria-label` + `aria-pressed` por chip (padrão `pessoas-listas.tsx:1084-1144`); busca dentro de `role="search"` (lacuna atual em `/pessoas` — existe em `/registros`, `registros-filtros.tsx:284`).
- Contagem "N de M" dentro de `role="status"`/`aria-live="polite"` — hoje não anuncia (`pessoas-listas.tsx:1063`); novo diretório deve anunciar.
- Cards de pessoa navegáveis com Link único de nome acessível + `aria-label="Abrir perfil de X"`; nada de `<div onClick>`. Estado "selecionado" via `aria-pressed` com texto visível (nunca só cor/borda).
- Painel inline do pedido: foco movido para a região ao abrir, `aria-expanded` no trigger, Escape/fechar devolve foco; erro inline `aria-invalid`+`aria-describedby` (hoje só toast — manter toast E adicionar inline no campo).
- Teclado completo: chips de slot e cards de seleção operáveis por Tab/Enter/Espaço; nenhuma interação pointer-only. Focus-visible ring em todo alvo (padrão `focus-visible:ring-3` da casa).
- `prefers-reduced-motion`: `animate-enter`/stagger já são leves; painel expansível sem slide brusco.
- pt-BR: copy sem travessão nas mensagens novas (regra do repo); erros dizem como recuperar; empty state nomeia a query.

**Performance:**

- View do diretório projetando só colunas seguras (sem join em dados civis); N esperado pequeno (dezenas) — filtro client-side sobre payload SSR é suficiente, como `/pessoas` já faz.
- Manter `prefetch={false}` nos links de ficha (padrão atual, evita N prefetches); avatar via `avatarPublicUrl` lazy por `<img>` default.
- Busca debounced (300ms, padrão `:449-453`); sem refetch por letra — `history.replaceState`, não `router.replace`.
- Sem regressão de chunk: reusar `JovemEspecialistaCard`/`FilterChipRow` já no bundle; nada de `dynamic()` novo pra diretório.

## 7. Riscos (privacidade/RLS) e decisões de produto

**Decisões que só o lead/produto fecha:**

1. **Escopo do diretório do jovem**: mesma turma × programa inteiro × opt-in `visivel_diretorio`. Recomendado: adultos programa-inteiro, jovens mesma turma (Ponto 1). Se programa-inteiro pra menores, opt-in novo é quase obrigatório (menor + LGPD).
2. **Foto de menor no diretório**: `avatar_path` de colega já chega ao client e não é renderizada — na view nova, projetar `null` pra colega direto no SQL (decisão hoje só na tela, `pessoas/page.tsx:281-283`).
3. **"Minha rede" expõe estrutura social?** Marcar "Seu mentor"/"Sua dupla" no diretório revela vínculos a quem vê a tela por cima do ombro — mas o jovem já vê isso; o risco é um *diretório público interno* exibir vínculos dele pra terceiros. A faceta "Minha rede" filtra a visão DELE; vínculos de outros pares **não** devem aparecer (não projetar `dupla_id` de terceiros).
4. **Coord no diretório do jovem**: hoje a coord entra escopada na turma (`0097:447-457`); no diretório amplo, equipe/coord listada por papel (sem vínculo) — ok se a projeção for a mesma dos demais adultos.
5. **`mentorados_turma` continua?** A view do diretório pode absorvê-la (colega vira row tipo `colega`) — manter as duas ou consolidar é decisão de schema; consolidar reduz drift mas reescreve testes (`diretorio-jovem.test.ts`).
6. **Invariante do regression-map**: a linha 52 promete "o diretório do jovem é a rede dele". O Ver-todos muda o invariante — a doc precisa ser corrigida na mesma PR (regra do AGENTS.md).

**Riscos técnicos:**

- View definer com a mesma disciplina das irmãs (revoke public/anon, grant select authenticated, gate `my_role()='mentorado'`) — qualquer `OR` solto no WHERE abre o catálogo inteiro; exigir teste e2e "papel negado via REST" (precedente em `relatorios.spec.ts`).
- `jovem_especialistas` exclui o mentor DPP do próprio jovem (`0101:76-81`) — no diretório, ele deve aparecer como "Seu mentor" (vem de `jovem_contatos`); cuidado pra não deduplicar errado nem duplicar a pessoa.
- Embeds continuam voltando null pro mentorado — nomes em threads se resolvem pelo diretório/catálogo, como hoje.
- Demo: toda view `jovem_*` tem espelho `demoJovem*` em `src/lib/demo/queries.ts` com teste de paridade — `jovem_diretorio` precisa de `demoJovemDiretorio` + teste, senão a demo (persona mentorado) mente.

## 8. Testes que provam o comportamento

**Já existem (a estender):**

- `tests/diretorio-jovem.test.ts` — trava a fronteira das projeções (colega só mesma turma+conta, whatsapp opt-in, chaves da linha). Estender pra `demoJovemDiretorio`: mesmo contrato.
- `tests/e2e/demo/jovem-pessoas.spec.ts` + `tests/e2e/app/jovem-pessoas.spec.ts` — diretório do jovem; casos novos: default "Todos", facetas, card "Sua rede", colega sem foto, id fora das fontes → 404.
- `tests/e2e/app/jovem-especialista*.spec.ts` (wp6/wp6r2) — catálogo/pedido; casos novos: seleção por card, fluxo não-modal, estados lotado/mural.
- `tests/jovem-especialista.test.ts` + `tests/agenda-especialista.test.ts` + `tests/horarios-especialista.test.ts` — lógica pura de variantes/slots.

**A criar (provam o comportamento novo):**

- **RLS**: REST com papel mentorado → `jovem_diretorio` devolve só a projeção segura (sem whatsapp/email/linkedin/dados civis de ninguém); papel negado (ex.: anon) → 0 rows; `especialistas_catalogo` → staff lê, mentorado não (ou o inverso conforme gate decidido). Padrão: specs e2e que batem na API REST (`tests/e2e/app/relatorios.spec.ts` já faz "papel negado via REST").
- **Unit**: `varianteDoCard`/`agrupaContatosPorPessoa` seguem; novo teste pra seleção de card (estado "selecionado"×preferência) e pro merge da rede no diretório (sem duplicar pessoa, selo correto).
- **e2e fluxo**: mentor abre a superfície de sugestão → vê card rico (foto/áreas/bio/"Atende") → seleciona → registra sugestão; jovem confirma. Jovem: abre `/jovem/especialistas` → escolhe card → painel inline → envia pedido (dirigido e mural), teto de 3 respeitado.
- **A11y**: tab-order no diretório e no painel; `aria-pressed`/`role="status"` verificados (axe nos specs de página, se já houver harness — senão asserções de atributo nos specs).
- **Perfil**: "Sua rede" lista mentor+auxiliar+coord+colegas; colega sem opt-in mostra "não compartilhou", adulto mostra contato.

---

### Apêndice — skills carregadas neste recon

`ui-ux-pro-max`, `frontend-ui-engineering`, `better-interface`, `better-layout`, `better-accessibility`, `better-writing`, `antislop-copywriting`, `supabase`, `supabase-postgres-best-practices` — aplicadas na leitura de RLS (definer views, grants por coluna, opt-in), no inventário de telas (padrões de filtro, anatomia de cards) e nos critérios de aceite (44px, teclado, SR, copy pt-BR).
