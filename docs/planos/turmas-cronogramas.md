# Programa → Turma → Cronograma → Dupla

Brainstorm de produto/arquitetura — não é spec de implementação. Contexto em `docs/planos/_contexto.md` e `docs/analise-transcricao-mentor.md` §7.

**Tese:** a operação **já roda dois cronogramas simultâneos** fora do sistema (ata: "turma atual tem 30 alunos em 2 cronogramas"). O modelo atual — `duplas.ciclo`/`ciclo_eventos.ciclo` como **texto solto** com default `'2026/2027'` — segura um *ciclo por vez*, mas não dois cronogramas com datas distintas no mesmo ciclo. No dia em que o segundo cronograma entrar como rows em `ciclo_eventos`, semáforo, trilha, agenda e resumos **corrompem de verdade** — e não existe nenhuma tela pra coordenação cadastrar cronograma: hoje o calendário só nasce via `seed.sql`/SQL manual. É ao mesmo tempo a bomba latente (integridade) e uma feature ausente (cadastro dinâmico).

---

## 0. O que já existe (alicerce — não reinventar)

| Peça | Onde | O que faz hoje |
|---|---|---|
| `duplas.ciclo` text | `0001_init.sql:44`, `types.ts:290` | Label do ciclo na dupla, default `'2026/2027'`. Participa do índice de vaga `duplas_ciclo_mentorado_ativa_key` — `unique(ciclo, mentorado_id, trilha) where status in ('ativa','pausada')` (`0027:21-24`) — **1 mentorado por trilha por ciclo** |
| `ciclo_eventos.ciclo` text | `0001:57`, `types.ts:190-201` (`ciclo?` opcional no tipo!) | Label do ciclo em cada evento do calendário. Sem unique por (ciclo, numero) — nada impede dois "encontro 5" |
| `cicloVigente` / `ciclosOpcoes` | `src/lib/ciclo.ts:936-961, 967-975` | Já multi-ciclo *na intenção*: vigente = ciclo cujo calendário cobre hoje; opções = distinct de eventos + ciclos usados em duplas. Assume **1 ciclo por vez** (retorna um só) |
| Select de ciclo | `nova-dupla-dialog.tsx:471-487`, `editar-dupla-dialog.tsx:50,142-147,322`; server: `actions.ts:618-623` (`createDupla` valida contra `ciclosOpcoes`) | Coord escolhe o ciclo ao formar a dupla; `iniciada_em` default já filtra eventos por `e.ciclo === ciclo` (`actions.ts:681-686`) — **o único lugar que já filtra por ciclo** |
| `presencas.ciclo_evento_id` | `0040:16-25` | Chamada FK pro evento específico — **já escopada certo por construção** (presença é no evento, não no ciclo) |
| `sync_formacao_ok` | `0040:73-109` | Trigger compara "todas as formações **do ciclo do evento marcado**" (`e.ciclo = v_ciclo`) — ciclo-aware por texto; quebra se dois cronogramas dividirem o mesmo label |
| `especialista_eventos` | `0027:27-46` | Os 5 passos da trilha curta — catálogo global sem data, **independe de cronograma** por desenho |
| RLS | `0001:259-262` | `ciclo_eventos`: select pra quem tem papel; `for all` coord. `materiais`: idem (`:264-267`). Sem noção de turma |
| Demo | `demo/data.ts:181-240` (`buildCicloEventos` — **nem preenche `ciclo`**), `:1216-1681` (duplas com `ciclo` text), `demo/queries.ts:189-193` | Um calendário só; uma dupla histórica `2025/2026` (`:1483`) |
| Calendário oficial | `seed.sql:7-31` — 24 rows: 3 marcos pré-ciclo, 2 formações, 1 abertura, 16 encontros terças, 1 recesso, 1 marco fim | Conteúdo do guia DPP (título/fase/instrumentos por nº) **misturado** com as datas — a mesma tabela é currículo e calendário |
| Escrita em `ciclo_eventos` | — | **Não existe action**: nenhuma superfície de coord cadastra/edita evento do ciclo |

---

## 1. Diagnóstico — o que quebra com 2 cronogramas

Cenário concreto: turma 2026/2027 com cronograma A (encontros às terças, como hoje) e cronograma B (mesma trilha DPP, datas diferentes — quintas, ou começando 6 semanas depois). As duas formas de gravar isso hoje — **rows novas com `ciclo='2026/2027'`** (mesmo label) ou **`ciclo='2026/2027-B'`** (label novo) — quebram de jeitos diferentes; marco `[mesmo label]`/`[label novo]`/`[ambos]` em cada item.

### Funções de domínio (`src/lib/ciclo.ts`) — todas consomem o array **sem filtrar pelo ciclo da dupla**

| Função | Linha | Falha |
|---|---|---|
| `encontroEsperado` | `:342-347` | `[ambos]` Conta **rows**, não números: 2 cronogramas → `esperado` infla (até 2×). |
| `saudadeDaDupla` | `:562-705` | `[ambos]` `numerosEsperados` (`:577-589`) e `esperado` (`:590-593`) contam eventos dos dois cronogramas → `atraso ≥ 2` espúrio → **falso "risco"** pra metade das duplas; `primeiroEncontroFaltante` (`:353-374`) ordena por data e pode devolver o nº do cronograma errado; preventivo (`:670-688`) usa `eventoDaSemana` global — acusa "encontro da semana não agendado" quando o oficial é do outro cronograma. |
| `eventoDaSemana` | `:388-400` | `[ambos]` `find` o 1º encontro na semana seg–dom — se os cronogramas têm encontros em dias diferentes da mesma semana, devolve um **arbitrário**; se B está deslocado, a "semana do encontro N" da coord pula entre cronogramas. Alimenta chip da agenda, dashboard e preventivo. |
| `resumoSemana` / `resumoSemanaDe` | `:424-476` | `[ambos]` Mede **todas** as duplas ativas DPP contra o evento de um cronograma só — "8 de 30 realizaram" quando na verdade são 8/15 do cronograma A e o B está noutra semana. O painel da coord mente nos dois sentidos. |
| `duplasSemEncontroDoNumero` | `:533-545` | `[ambos]` Marca dupla do cronograma B como "sem o encontro N da semana" quando o N dela é semana que vem → coorte invisível errada → nudge injusto. |
| `passosDaTrilha` | `:58-87` | `[ambos]` Devolve 32 passos com `numero` 1–16 **duplicado** → `jornadaDaDupla` (`:849-915`) renderiza 32 nós, e todo `Map` por número colide (último sobrescreve). |
| `alvoAgendamento` | `:728-778` | `[ambos]` `total` = `totalEncontros` (`:337`) conta 32 → `cicloCompleto` nunca liga com 16; `sugeridoProximo` (`:750-752`) faz `find` por número → **sugere a data do cronograma A pra dupla do B**; `faltantes` (`:756-769`) lista cada nº duas vezes com datas diferentes. |
| `totalEncontros` | `:337-339` | `[ambos]` Conta o array inteiro — 32. Usado em `/agenda` ("16 encontros semanais" vira 32), `/registros` (teto do filtro de nº). |
| `cicloVigente` | `:936-961` | `[label novo]` Devolve **um** ciclo — com dois labels sobrepostos o retorno depende da ordem do `Map` (arbitrário). `NovaDuplaDialog` defaulta o ciclo errado metade das vezes. |
| `inicioDefaultDupla` | `:920-930` | Já correto **se** o chamador filtrar por ciclo — `createDupla` filtra (`actions.ts:681-686`), único ponto são. |

### Server actions (`src/lib/actions.ts`)

| Action | Linha | Falha |
|---|---|---|
| `agendarEncontro` | `:1542-1548` | `[ambos]` `maxNum` = `max(numero)` **global** — cronograma mais curto (ex.: 10 encontros) permite agendar nº 11–16 inexistentes; cronograma mais longo trunca o outro. `encontros.numero` não tem CHECK ligando ao cronograma da dupla. |
| `registrarEncontroRetroativo` | `:1676-1685` | `[ambos]` Idem `maxNum`; **pior**: `piso = iniciada_em ?? evs[0].data` — `evs[0]` ordenado por `numero` pega o 1º encontro **de qualquer cronograma** (ordem arbitrária entre as duas rows de nº 1) → piso de data errado pra metade das duplas. |
| `salvarNotaEncontro` | `:1936-1942` | `[ambos]` `maxNum` global. |
| `criarMaterial` / `editarMaterial` | `:2208-2215`, `:2262-2269` | `[ambos]` `encontro_num` validado contra o max global — material "do encontro 12" vira ambíguo quando os cronogramas divergem em conteúdo (ver §3, decisão materiais). |
| `dadosCiclos`/`createDupla` | `:597-623` | `[label novo]` Lista e valida labels de texto — com dois labels funciona, mas o vigente (`cicloVigente`) é arbitrário e **não há como criar label novo pela UI** — o select só oferece o que já existe. |

### Páginas e componentes

| Superfície | Arquivo:linha | Falha |
|---|---|---|
| Ficha da dupla | `duplas/[id]/page.tsx:128,177-182,282` | `[ambos]` Puxa `getCicloEventos()` inteiro → `passosDaTrilha`/`saudadeDaDupla`/`alvoAgendamento`/`eventoDaSemana` todos contaminados (acima). |
| Agenda | `agenda/page.tsx:27,43,81-86,98` + `agenda-calendario.tsx` | `[ambos]` Grade mostra os dois cronogramas **sobrepostos no mesmo mês** (dois discos oficiais/dia quando as datas colidem, sem distinguir turma); rail `encontrosRail` (`:502-508`) renderiza 32 discos 1–16×2; `passosDppPorNumero` (`:523-526`) = `Map` por nº → "sugestão do guia" mostra o título do cronograma que gravou por último; `AcaoDiaMentor` (`:2184-2191`) infere o nº do evento oficial do dia — **agenda o nº do cronograma errado** se o dia clicado é oficial do outro; chamada de formação (`page.tsx:81-86` + `getPresencas`) lista **todos** os eventos `formacao` dos dois cronogramas juntos. |
| Dashboard coord | `dashboard-coordenacao.tsx:102-106` | `[ambos]` `resumoSemana` + `saudadeDaDupla` por dupla sobre o calendário inteiro — semáforos inflados (acima). |
| Home do mentor | `mentor-home.tsx:46,59,119-122` | `[ambos]` Mesma contaminação; `eventoDaSemana` pode anunciar a semana do cronograma alheio. |
| Lista de duplas | `duplas-lista.tsx:101` + `duplas/page.tsx:23,32` | `[ambos]` Semáforo por dupla contaminado; **header hardcoded** `"N duplas no programa 2026/2027"` (`page.tsx:32`) — nem o label do ciclo é dinâmico. |
| Registros | `registros/page.tsx:94-95,116-122` | `[ambos]` `maxEncontro = totalEncontros` = 32 (filtro de nº aceita nº que não existe num cronograma); `tituloDpp` = `Map(numero→titulo)` → **título do 2º cronograma sobrescreve o do 1º** na listagem. |
| Encerramento | `actions-encerramento.ts:62-75,139-144` | `[ambos]` Resumo da jornada gravado em `encerramentos.resumo_jornada` é gerado com **todos** os eventos → "12 de 32 encontros" no relatório final — **snapshot gravado errado é dado corrompido permanente**. |
| Formação | `queries-presenca.ts:84-94` | `[label novo]` `getResumoFormacao` define vigente = `ciclo` da formação **mais recente** — mentores da turma cujo cronograma tem formação anterior exibem "0 de 0"; `[mesmo label]` o trigger `sync_formacao_ok` (`0040:81-97`) exige presença nas formações de **ambos** os cronogramas (compara por texto) → `formacao_ok` nunca acende. |
| Export CSV | `api/export/route.ts:126-138,399` | `[ambos]` `?tipo=ciclo` exporta **todas** as duplas sem coluna de ciclo/turma/cronograma — planilha mistura os dois cronogramas indistinguíveis. |
| Vaga do mentorado | índice `duplas_ciclo_mentorado_ativa_key` (`0027:21-24`) | `[label novo]` Com dois labels, o mesmo mentorado pode entrar em dupla DPP nos **dois** cronogramas da mesma turma (a regra era "por ciclo" = por turma); `[mesmo label]` ok. Detalhe: a action `createDupla` (`:643-648`) já é **mais restritiva** que o índice — bloqueia mentorado ativo em qualquer ciclo — divergência latente a resolver na mesma migração. |
| RLS `ciclo_eventos_select` | `0001:259-260` | `[ambos]` Qualquer papel lê os cronogramas todos — cronograma B visível pra mentor de A (vaza estrutura, não dado sensível; aceitável no MVP). |
| Comunicados / materiais por audiência | `0018:4-13`, `0001:106-116` | Audiência `'todos'/'dpp'/'especialista'/'coordenacao'` não tem eixo de turma — comunicado "formação sexta" vai pras duas coortes. |

### O que NÃO quebra (escopo já é por dupla/evento)

`encontros`, `registros`, `encaminhamentos`, `encontro_notas`, `interacoes`, `encerramentos` (por `dupla_id`), `formulario_links` (por `dupla_id`), `presencas` (por `ciclo_evento_id`), `assinaturas`, `documentos_pessoa`, `notificacoes` (por `profile_id`), `supervisoes` (por dupla/mentor), `solicitacoes_especialista`/`solicitacoes_mural`. A trilha especialista inteira é agnóstica de cronograma por desenho — mas **a dupla de especialista precisa continuar carregando turma** pra ownership/filtros.

**Resumo da bomba:** dupla corrente numa lista plana `ciclo_eventos` + semáforo com "esperado" contado por data → **dois cronogramas = falso risco em massa + trilha/agenda/resumo duplicados ou arbitrários + snapshot de encerramento corrompido pra sempre**. O remendo tático seria filtrar `eventos` por `dupla.ciclo` em ~15 pontos — mas texto livre como chave não escala pra "cadastrar cronograma pela coordenação", que é o pedido.

---

## 2. Modelos de dados

### Modelo A — cronograma como entidade mínima (FK direto)

O menor passo que vira entidade de verdade: uma tabela `cronogramas`, `ciclo_eventos` e `duplas` pendurados nela. "Turma" continua sendo o texto que hoje é `ciclo` — promovido a campo do cronograma (e mantido na dupla, porque a vaga é por turma, não por cronograma — ver §1 "Vaga do mentorado" e §6.4).

```sql
create table public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                          -- "Terças · turma 2026/2027"
  turma text not null,                         -- herda o papel do ex-'ciclo' text
  trilha text not null default 'dpp' check (trilha in ('dpp')),  -- especialista não tem cronograma
  status text not null default 'ativo' check (status in ('rascunho','ativo','encerrado')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.ciclo_eventos
  add column cronograma_id uuid references public.cronogramas(id);
alter table public.duplas
  add column cronograma_id uuid references public.cronogramas(id);
-- duplas.ciclo permanece (é a turma — chave da vaga e dos filtros);
-- ciclo_eventos.ciclo vira redundante: ou mantém pra transição ou drop.
create unique index ciclo_eventos_cronograma_numero_key
  on public.ciclo_eventos (cronograma_id, numero) where numero is not null;
```

**Impacto:**
- **Semáforo/domínio:** todas as funções de `ciclo.ts` passam a filtrar `eventos.filter(e => e.cronograma_id === dupla.cronograma_id)` — ou melhor: `getCicloEventos()` ganha shape `{cronograma_id}` e cada caller deriva o recorte da própria dupla; `resumoSemana`/`eventoDaSemana`/`duplasSemEncontroDoNumero` viram **por cronograma** (a coord escolhe qual está vendo).
- **Queries:** `getCicloEventos` (queries.ts:224) segue retornando tudo + `cronograma_id`; `CicloEvento.ciclo`/`cronograma_id` viram obrigatórios no tipo.
- **RLS:** inalterada (coord global escreve, papel lê). Escopo por turma **não** entra — decisão adiada.
- **Actions:** `maxNum`/`piso`/`faltantes` passam a filtrar pelo `cronograma_id` da dupla (join barato: `duplas` já é lida em todas elas).
- **Demo:** `buildCicloEventos` ganha `cronograma_id`; um segundo cronograma demo (ex.: quintas, 6 semanas atrás do A) exercita o caso real.
- **Cadastro:** a entidade existe mas **não tem UI de criação** — precisa do gerador (modelo C) ou aceita criar via SQL.
- **Esforço: M** (migration + backfill + ~20 pontos de filtro + selects). **Risco de migração: baixo** — backfill direto (1 cronograma por valor distinto de `ciclo`); `duplas.ciclo` mantido evita mexer no índice de vaga.
- **Prós:** resolve a bomba com o mínimo de entidade; cada decisão por turma fica adiável; rollback fácil (FK nullable primeiro).
- **Contras:** "turma" segue texto (digitação inconsistente "2026/27" ≠ "2026/2027" quebra agrupamento); sem `programas`/`turmas` plenos a ata fica meio atendida; coord não ganha tela de cronograma sozinha.

### Modelo B — entidades plenas `programas > turmas > cronogramas > duplas`

O desenho da ata, completo:

```sql
create table public.programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                 -- "Mentoria Social", "Mentoria p/ Empreendedores"...
  ativo boolean not null default true
);
create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas(id),
  nome text not null,                 -- "2026/2027"
  inicio date, fim date,
  status text not null default 'ativa' check (status in ('planejada','ativa','encerrada')),
  unique (programa_id, nome)
);
create table public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id),
  nome text not null,                 -- "Terças", "Quintas (2ª entrada)"
  trilha text not null default 'dpp',
  status text not null default 'ativo'
);
alter table public.ciclo_eventos add column cronograma_id uuid not null references public.cronogramas(id);
alter table public.duplas
  add column cronograma_id uuid references public.cronogramas(id),
  add column turma_id uuid not null references public.turmas(id);   -- vaga segue por turma
-- membership: prepara "papel por programa/turma" e escopo de coord por turma
create table public.turma_membros (
  turma_id uuid not null references public.turmas(id),
  profile_id uuid not null references public.profiles(id),
  papel text not null check (papel in ('coordenacao','supervisor','mentor_dpp','mentor_especialista')),
  primary key (turma_id, profile_id, papel)
);
```

**Impacto:**
- **RLS:** refatoração profunda. `my_role()` é global; com membership, "coordenacao" pode significar "coordena a turma X" → policies passam a consultar `turma_membros` via `duplas.turma_id` (coord de uma turma vê só ela; supervisor continua por `duplas.supervisor_id` ou vira membership também). Toca **todas** as policies do sistema e `getMe`/AppShell (uma pessoa pode ter papéis diferentes por turma — colide com a frente "papel por programa").
- **Queries:** todos os listados da §1 filtram pelo cronograma **da dupla** (mais limpo que texto); listas de coord ganham filtro de turma (`?turma=`).
- **Semáforo:** igual ao A — o filtro é pelo cronograma; a turma é só agrupamento/governança.
- **Demo:** dataset ganha 1 programa, 1–2 turmas, 2 cronogramas — `demo/queries.ts` replica escopo por membership.
- **Vaga:** índice vira `unique(turma_id, mentorado_id, trilha) where status in (...)`.
- **Esforço: XL** (3 tabelas + membership + reescrita de RLS + UI de gestão + demo + seed). **Risco de migração: médio** — dados migram bem (1 programa, 1 turma, 2 cronogramas), o risco é regressão de permissões (RLS é o coração do sistema).
- **Prós:** é o destino — suporta a ata inteira (ciclos curtos/longos, papel por programa via membership, coord por turma); `turma` para de ser texto.
- **Contras:** grande demais pra resolver a bomba rápido; membership por turma traz decisões de produto (coord global × por turma?) que ainda não estão respondidas (§6); mistura duas frentes (estrutura de calendário + governança de papéis).

### Modelo C — cronograma dinâmico (gerador)

A resposta a "cadastro dinâmico de cronogramas pela coordenação" — **ortogonal** ao modelo de dados: é sobre *como as rows de `ciclo_eventos` nascem*, não onde penduram.

**C1 — gerador materializado (recomendado):** coord informa *nº de encontros, dia da semana, data do 1º, regra de intervalos* (semanal; exceções: "+15 dias após o 8º", "recesso de X a Y") e escolhe o **template de conteúdo** ("Guia DPP oficial — 16 encontros" pré-semente, ou "copiar de cronograma existente"). O servidor gera as rows de `ciclo_eventos` já materializadas — depois editáveis uma a uma (mover data, renomear, marcar recesso/marco/formação).

```sql
-- o gerador é uma RPC definer (ou action com .insert em lote):
create or replace function public.gerar_cronograma(
  p_cronograma uuid, p_dia_semana smallint, p_primeiro_encontro date,
  p_total_encontros smallint, p_template uuid default null, -- outro cronograma como fonte
  p_gaps jsonb default '[]'   -- [{"depois":8,"dias":15}, {"depois":14,"recesso":"2026-12-16/2027-01-04"}]
) returns int ...
```

- **Por que materializado:** `presencas.ciclo_evento_id` exige **id estável** (`0040:18`); a spec da ata (bolinha → popup → agendar) trata o evento como objeto clicável com materiais vinculados; edição pontual ("essa terça é feriado, move pra quinta") exige row própria — a alternativa virtual (regra viva + projeção) não entrega nada disso.
- **RLS:** `ciclo_eventos_coord` (`0001:261`) já permite — a RPC só centraliza a regra.
- **Esforço: M** (gerador + UI wizard + CRUD mínimo de evento — hoje **não existe nenhuma** forma de editar `ciclo_eventos` pela plataforma). **Risco: baixo** — nada migra; é superfície nova.
- **Prós:** atende literalmente o pedido; template=duplicar torna o 2º cronograma trivial e consistente (mesmo guia, outras datas); exceções editáveis cobrem o calendário real (a própria seed tem gap 8→9 e recesso — qualquer gerador precisa aceitar isso).
- **Contras:** sozinho não resolve a leitura (precisa do A/B por baixo); template duplicado denormaliza currículo — se a coord corrigir um título no cronograma A, o B não segue (aceitável: títulos podem legit divergir; mitigação: edição "aplicar aos cronogramas da turma" opcional).

**C2 — cronograma virtual (regra viva, eventos projetados):** `cronogramas` guarda a regra; os eventos são uma view/função. — **Descartável:** sem ids estáveis quebra `presencas`, `formulario_links.contexto`, `materiais.encontro_num` (ancla por nº mas a projeção muda), deep-links `?dia=`; e toda leitura vira cálculo. Esforço L+ com fragilidade alta. Registrar como caminho **não** escolhido.

### Modelo D — híbrido: A agora + C1 na sequência + turma text → tabela depois

- **A** desarma a bomba (FK + filtros).
- **C1** entrega o cadastro dinâmico (gerador + edição).
- **`cronogramas.turma` text** permanece nesta fase; quando `turmas` virar tabela (fase com membership/programas), `turma text` → `turma_id` por migração de uma linha por valor distinto — mesma técnica do backfill do ciclo.
- `programas` + `turma_membros` ficam pro momento em que "papel por programa" (outra frente da ata) virar trabalho — a estrutura A não bloqueia nem antecipa errado.

**Esforço total: M→L em duas entregas** vs XL de B de uma vez. **Risco: baixo/médio** — cada passo é revertível e o dado nunca fica em formato pior.

---

## 3. UX de coordenação

**Onde mora:** nova área de gestão do programa. Duas opções: `/turmas` (página própria, espelhando `/formularios` como padrão de "ferramenta da coordenação") ou dentro de `/agenda` (a agenda **é** a visualização do cronograma). Recomendo **`/turmas`** própria: a agenda fica de leitura/gestão do dia a dia; a turma é objeto administrativo (criar, duplicar, encerrar). A agenda ganha **seletor de cronograma** pra coord (hoje implícito único) — e quando uma turma tem 2 cronogramas, a agenda coord mostra **abas/segmentos** ("Terças · Turma 2026/2027" | "Quintas · Turma 2026/2027"), cada qual com seu rail e seus painéis. Mentor nunca escolhe: a agenda dele é a do(s) cronograma(s) das suas duplas — se o mesmo mentor tiver duplas em dois cronogramas, os eventos oficiais dos dois aparecem marcados por turma.

**Cadastrar turma (quando turma vira entidade):** dialog simples — programa (select, default "Mentoria Social"), nome ("2026/2027"), janela prevista. Antes disso, a turma nasce como campo texto do primeiro cronograma.

**Cadastrar cronograma (o pedido) — wizard em 3 passos:**
1. **Identidade:** turma (select das existentes ou "+ nova turma"), nome do cronograma ("Terças"), trilha DPP (especialista não tem cronograma — trilha livre por dupla, `ciclo.ts:23-31`).
2. **Estrutura:** template — "Guia DPP oficial (16 encontros, 6 fases)" pré-preenchido **ou** "copiar de cronograma existente" (select; clona títulos/fases/instrumentos — e só eles). Nº de encontros editável (ata pede ciclos curtos/longos).
3. **Datas:** dia da semana + 1º encontro + regra (semanal) + **editor de exceções** (pausa após o encontro N, recesso com `data_fim`, eventos avulsos `formacao`/`marco`) → **preview da lista gerada** (data + título por linha, cada data movível) → confirmar grava via RPC/action em lote.

**Duplicar cronograma de outra turma** = mesmo wizard com template = cronograma-fonte e nova data-âncora — cobre "mesmo desenho, novo semestre" e "segunda coorte da mesma turma".

**Gerenciar duplas por turma/cronograma:**
- `/duplas`: filtro por turma e cronograma (chips ou select) + o header deixa de hardcodar "programa 2026/2027" (`duplas/page.tsx:32`) → "N duplas · Turma 2026/2027 (cronograma Terças)". Cards ganham badge de cronograma quando a turma tem >1.
- `NovaDuplaDialog`: o select "Ciclo" (`:471-487`) vira **"Turma → Cronograma"** (dois selects encadeados, ou um só de cronogramas rotulados "2026/2027 · Terças"); `iniciada_em` default segue ancorado no 1º encontro **do cronograma escolhido** (já é o comportamento com o filtro de `actions.ts:681-686`, agora por FK).
- Dashboard/home coord: `resumoSemana` por cronograma selecionado (default: o cronograma cuja semana está ativa; se dois ativos, dois cartões "Semana do Nº encontro — Terças / Quintas").
- Chamada de formação: lista de eventos `formacao` passa a ser **por cronograma** (`agenda/page.tsx:81-86` filtra) — mentores chamados = os das duplas daquele cronograma + todos os mentores da turma (decisão: formação é por turma ou por cronograma? — §6).
- `/materiais`: `encontro_num` continua sendo **posição no guia** — compartilhado por cronogramas da mesma trilha enquanto o currículo for o mesmo; se um dia cronogramas divergirem em conteúdo, `materiais` ganha `cronograma_id`/escopo (adiar).
- Export `/api/export`: ganha `?turma=`/`?cronograma=` e coluna `turma`/`cronograma` no CSV do ciclo (`route.ts:126-138,399`).

---

## 4. Migração dos dados de produção

Base real: `ciclo_eventos` ~24 rows todas `ciclo='2026/2027'` (seed.sql + correções 0005/0035); `duplas` com `ciclo` '2026/2027' (e possíveis históricas de ciclos anteriores sem eventos — demo tem `2025/2026`, prod idem presumível). Passo a passo sem perda:

```sql
-- 006x_turmas_cronogramas.sql (esboço)
begin;
create table public.cronogramas (...);            -- modelo A
-- 1 cronograma por valor distinto de ciclo COM eventos (hoje: 1)
insert into public.cronogramas (nome, turma, trilha, status)
  select 'Calendário oficial', ciclo, 'dpp', 'ativo'
  from (select distinct ciclo from public.ciclo_eventos) t;
update public.ciclo_eventos e set cronograma_id = c.id
  from public.cronogramas c where c.turma = e.ciclo;
alter table public.ciclo_eventos
  alter column cronograma_id set not null,
  drop column ciclo;                              -- ou mantém 1 release pra rollback

alter table public.duplas add column cronograma_id uuid references public.cronogramas(id);
-- duplas do ciclo com calendário → cronograma da turma; duplas de ciclo SEM
-- eventos (históricas) ficam null e param de exigir semáforo (ver abaixo)
update public.duplas d set cronograma_id = c.id
  from public.cronogramas c where c.turma = d.ciclo;
-- ciclo text vira "turma" — renomear é opcional mas honesto:
alter table public.duplas rename column ciclo to turma;
-- índice de vaga recria com o mesmo nome de coluna:
drop index duplas_ciclo_mentorado_ativa_key;
create unique index duplas_turma_mentorado_ativa_key
  on public.duplas (turma, mentorado_id, trilha) where status in ('ativa','pausada');
commit;
```

**Decisões da migração:**
- **Dupla DPP sem cronograma (ciclo histórico sem calendário):** `cronograma_id null` — `saudadeDaDupla`/`alvoAgendamento`/`jornadaDaDupla` tratam como "sem calendário" (como a especialista hoje: esperado=feitos, sem sugestão de data). Duplas históricas estão `concluida`/`encerrada` → congeladas de qualquer jeito (`ciclo.ts:628-639`).
- **`presencas`:** intactas (FK pro evento, que ganha `cronograma_id`).
- **`materiais`/`comunicados`/`especialista_eventos`/`formularios`:** intactos — globais por trilha, não por cronograma (decisão registrada; revisitar só se currículos divergirem).
- **`sync_formacao_ok` (0040):** trocar `e.ciclo` por `e.cronograma_id` na comparação — fix de 2 linhas que **destrava** o bug latente de dois cronogramas no mesmo label.
- **`database.types.ts`:** regerar do remoto (processo já estabelecido).
- **Sem downtime:** FK nullable → backfill → NOT NULL numa segunda etapa da mesma migration; app deployado antes ou depois funciona porque todos os filtros passam a usar `cronograma_id` (e `turma` text continua existindo na row pra leitores velhos, se optar por manter 1 release).
- **O 2º cronograma real da operação** (pergunta §6.1): quando confirmado, entra como `cronogramas` novo + rows geradas pelo wizard — **não** via insert manual, pra exercitar a feature sob condições reais.

---

## 5. Recomendação + sequência MVP → visão

**Recomendação: Modelo D (= A + C1), com B fatiado depois.**

| Fase | Escopo | Por quê agora/depois |
|---|---|---|
| **F1 — desarmar a bomba (M)** | `cronogramas` + `ciclo_eventos.cronograma_id` + `duplas.cronograma_id` + `duplas.ciclo→turma`; **todos** os pontos da §1 filtram por cronograma da dupla; `resumoSemana`/`eventoDaSemana` por cronograma; selects "Turma→Cronograma" nos dialogs; seletor de cronograma na agenda coord; header de `/duplas` dinâmico; `sync_formacao_ok` por cronograma; export com `?turma=`; demo ganha 2º cronograma | É o mínimo que torna um segundo cronograma **seguro** — pode entrar mesmo via SQL pela coord enquanto a UI não existe |
| **F2 — cadastro dinâmico (M)** | `/turmas` com wizard de cronograma (gerador materializado, template oficial do guia + "copiar de…", editor de exceções, preview editável) + CRUD de evento (mover data, marcar recesso/formação, renomear) | É o pedido literal; sem ele o cronograma 2 entra por SQL e a feature continua inexistente |
| **F3 — turma entidade (M)** | `turmas`/`programas` tabelas (promove `turma` text), filtro por turma em `/duplas`/`/pessoas`/`/registros`/exports, comunicados/materiais por turma (opcional), versionamento de form por turma (ata) | Só quando houver 2ª turma real ou a frente "papel por programa" puxar membership |
| **F4 — membership por turma (L→XL)** | `turma_membros`, coord por turma, papel por programa/turma — colado na frente de perfis da ata | XL; depende de decisões de governança (§6) que não estão tomadas; fazer junto com a refatoração de `profiles.role` |

**Por que não B agora:** XL de uma vez carrega a refatoração de RLS por membership — que depende de perguntas de ops ainda abertas (§6.2–6.4) — e atrasa a correção da bomba, que é barata sozinha. A sequência F1→F4 nunca escreve dado em formato que precise ser desfeito: `cronogramas` é subconjunto estrito do modelo final.

**Critério de pronto da F1 (testável):** inserir um segundo cronograma com datas deslocadas e uma dupla nele → semáforo dos dois lados correto, agenda separa por cronograma, trilha da dupla B mostra os passos de B, `resumoSemana` conta cada coorte contra o próprio calendário, resumo de encerramento certo.

---

## 6. Perguntas abertas (Thiago/Léo)

1. **O 2º cronograma real já tem datas definidas?** Mesma turma com dia da semana diferente (terça × quinta), ou coorte que entrou depois no mesmo calendário de terças? A resposta decide se F1 sozinho destrava a operação ou se já precisa do gerador (F2) na primeira entrega — e valida o formato "mesma turma, datas distintas" que o modelo assume.
2. **Coordenação por turma ou global?** Léo coordena as duas coortes sozinho? Se houver sub-coordenador por cronograma/turma, membership (F4) sobe de prioridade; se coord é sempre global, F4 pode esperar indefinidamente.
3. **Supervisor: por dupla (hoje) ou por turma?** O modelo atual ancora em `duplas.supervisor_id` — supervisor novo numa turma enxerga o quê? Manter por-dupla é consistente com "assistente de coordenação" (renomeação decidida na ata).
4. **Vaga do mentorado: por turma (regra atual) ou por cronograma?** Se a mesma pessoa puder estar em dupla DPP nos dois cronogramas da mesma turma, o índice muda de `(turma,…)` pra `(cronograma_id,…)` — hoje a action (`actions.ts:643-648`) é ainda mais restritiva que o índice (bloqueia em qualquer ciclo): alinhar as três camadas numa decisão só.
5. **Formação é do cronograma ou da turma?** Dois cronogramas compartilham os encontros de formação (mesma turma assiste junto) ou cada um tem os seus? Muda se `formacao` vive por cronograma ou se `presencas` passa a ter escopo de turma. Hoje `sync_formacao_ok` assume "do ciclo do evento".
6. **Comunicados e materiais por turma?** Audiência atual é por trilha. "Aviso pros mentorados da turma X" é necessidade real ou o WhatsApp segue sendo o canal?
7. **Ciclos curtos/longos mudam o currículo ou só as datas?** Ata pede flexibilidade de duração — se um cronograma de 10 encontros usa títulos diferentes do guia de 16, o template precisa ser editável na estrutura, não só nas datas (wizard ganha edição de títulos/fases).
8. **Turmas encerradas: arquivo morto ou navegável?** `/duplas` e exports filtram turma encerrada por default? (Hoje a dupla `2025/2026` do demo sugere que histórico importa — resumo da jornada é consultável.)
9. **Mentor com duplas em cronogramas diferentes:** a agenda dele mostra os dois conjuntos de oficiais? (Provável sim — os dias oficiais de cada dupla dele.) Confirmar com a Kelyng se a visualização mesclada confunde.
