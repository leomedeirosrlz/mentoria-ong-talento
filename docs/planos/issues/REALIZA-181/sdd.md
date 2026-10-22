# SDD — REALIZA-181 PDM nativo

Decisões de arquitetura do PDM como documento vivo. Tudo que é proposta nova está
marcado `[NOVO]`; afirmações sobre o sistema atual citam o arquivo verificado.

---

## D1 — PDM é tabela de domínio real, não extensão do forms engine

**A pergunta obrigatória:** o PDM fica dentro do forms engine (`formularios` +
`formulario_respostas.respostas` jsonb) ou vira tabela de domínio?

**Decisão: tabela de domínio (`pdm` + `pdm_itens`), com o forms engine mantido
como camada de coleta.** É a Alternativa C de
`docs/planos/atividades-interativas.md` (:122-151) — já recomendada lá — agora
confirmada pelos requisitos fechados da 181/141/142.

### Por que o forms engine sozinho não atende

| Requisito (141/142/181) | Por que `respostas` jsonb falha |
|---|---|
| Co-edição contínua | `formulario_links` é one-shot: `usado_em` + unique `resposta.link_id` (`0036`). Enviado é imutável — "corrigir uma meta" exige link novo que não conversa com o anterior. |
| Árvore recursiva | `submetas_N` é `texto_longo` livre (`0080:626-628`) — não há nós, não há `parent_id`, não dá pra perguntar "quais submetas abertas da dupla?" sem varrer JSONB. |
| `atingida_em` por item | Não existe conceito de estado por nó no snapshot. |
| Ordem como prioridade | A posição dentro do jsonb não é consultável nem regravável item a item. |
| Resumo da jornada / retrospectiva | `dadosResumoJornada` (`src/lib/encerramento.ts:114`) precisa de agregados — contar metas atingidas em jsonb por dupla é scan, não query. |

### Por que não abandonar o forms engine

A coleta segue sendo o fluxo do guia: "tarefa pós-2º encontro" = link tokenizado
one-shot que o jovem responde do celular, mesmo sem login
(`src/app/f/[token]/` — rascunho em localStorage, honeypot, estados). Esse
investimento (renderers `src/components/instrumentos/*`, RPCs
`formulario_por_token`/`submeter_resposta_formulario`, `InstrumentoResultado`)
permanece. A diferença: a resposta deixa de ser o destino final e vira
**insumo que projeta pro documento vivo** — o mesmo padrão nascido em `0042`
quando uma resposta de `sistema='avaliacao_360'` carimba
`encerramentos.checklist` (vigente em `0080:337-342`).

### Trade-off aceito

Dois lugares guardam "a verdade" por desenho: `formulario_respostas` = **o que
foi dito naquela rodada** (snapshot histórico, imutável, auditável) e
`pdm`/`pdm_itens` = **o documento vivo** (estado atual curado pela dupla). Eles
não divergem por acidente: a projeção é determinística por `origem_campo`
(ver §Projeção) e itens tocados manualmente nunca são sobrescritos.

---

## D2 — Uma tabela recursiva `pdm_itens`, não `pdm_metas` + `pdm_submetas`

**A pergunta obrigatória (cluster I):** `pdm_itens` com `parent_id` servindo
Metas e PDM, ou tabelas separadas?

**Decisão: `pdm_itens` única com `parent_id` — meta é o item raiz
(`parent_id is null`), submeta é qualquer item com pai.**

### Por que separadas falham

- A 142 exige submeta **com submeta em qualquer profundidade** ("uma submeta
  pode ter submetas" — caso real citado: >5 por meta). `pdm_submetas` flat por
  meta modela 1 nível; recursão exigiria self-FK na submeta — e aí ela já virou
  `pdm_itens` com nome pior.
- Metas e submetas têm os mesmos campos SMART (o guia pede IS e prazo "em
  todas" — seed `0080:625`). Duas tabelas = duas queries, dois policies, dois
  renders pra um único conceito.
- Cluster I: "as submetas do Metas e do PDM são o mesmo dado" — a rodada
  `metas` e a rodada `pdm` escrevem na mesma árvore.
- Esboço idêntico já proposto em `atividades-interativas.md:129`.

### Custo aceito

- `tipo` não vira coluna: deriva de `parent_id is null` (raiz = meta). Evita o
  invariante redundante `tipo='meta' ⇔ parent_id is null` que uma coluna
  criaria. Documentado pro consumidor (178/180): "meta" é convenção de
  profundidade, não de enum.
- Caps por classe de item exigem contagem condicional — resolvido em trigger
  + RPC (§Caps).

---

## D3 — Modelo de dados `[NOVO]`

Migration `0106_pdm_nativo.sql` (próximo número livre — última é `0105`).

```sql
-- documento vivo: 1 por dupla DPP. Nasce lazy (primeira projeção ou primeiro
-- salvar) — não criar rows vazias pra duplas sem PDM.
create table public.pdm (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null unique references public.duplas(id) on delete cascade,
  visao text,                          -- Declaração de Visão (campo declaracao_visao)
  visao_em timestamptz,                -- quando a visão foi registrada/atualizada
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pdm_itens (
  id uuid primary key default gen_random_uuid(),
  pdm_id uuid not null references public.pdm(id) on delete cascade,
  parent_id uuid references public.pdm_itens(id) on delete cascade,
  -- SMART: descrição, área de vida, indicador de sucesso, prazo, status
  titulo text not null check (length(trim(titulo)) between 1 and 300),
  porque text,                         -- "por que é importante" (metas: porque_N)
  indicador text,                      -- IS — indicador de sucesso
  area_vida text,                      -- vocabulário das 16 áreas da Roda (id do campo) ou livre
  prazo_alvo date,
  status text not null default 'ativa'
    check (status in ('ativa','atingida','descartada')),
  atingida_em timestamptz,             -- carimbo quando status→'atingida'; null ao reverter
  -- prioridade: posição entre irmãos = meta_ordem da 141 (1 = mais importante)
  ordem smallint not null default 0,
  -- procedência: quem/como nasceu. origem_campo casa o item com o campo do
  -- form que o gerou ('meta_2', 'submetas_1') — base da reconciliação idempotente
  origem text not null default 'manual'
    check (origem in ('manual','metas','pdm','visao')),
  origem_campo text,
  created_by uuid references public.profiles(id),  -- null quando veio de link anônimo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- reconciliação: um campo meta_N de form ocupa UM slot raiz por PDM — o
-- índice vale só pra raiz (filhos projetados de submetas_N são N por campo,
-- reconciliados por título normalizado dentro do grupo — ver §Projeção).
-- Manual = null, fora do índice, nunca colide.
create unique index pdm_itens_origem_slot_uk on public.pdm_itens
  (pdm_id, origem_campo)
  where origem_campo is not null and parent_id is null;

create index pdm_itens_pdm_idx on public.pdm_itens (pdm_id, parent_id, ordem);
```

**Decisões embutidas no DDL:**

- `on delete cascade` em `parent_id`: apagar uma meta leva a subárvore (ação
  destrutiva confirmada na UI; alternativa `descartada` preserva sem deletar).
- `atingida_em` separado de `status`: reverter `atingida → ativa` zera o
  carimbo; a data de quando foi atingida não é "updated_at genérico".
- `ordem smallint` por conjunto de irmãos (roots entre si; filhos entre si) —
  reordenar não toca outros pais. `meta_ordem` da 141 vira isto.
- `area_vida text` livre (sem check): o vocabulário canônico são os 16 ids de
  área do form `roda_vida` (`p_saude`, `pr_carreira`… em `0080:638+`) — travar
  no banco copiaria um enum que já mora no seed do form e pode divergir. A UI
  oferece as 16 + "Outra" (ver design.md); consumidores tratam como texto.
- Sem coluna `tipo` (ver D2). Sem `dupla_id` redundante no item — chega pela
  `pdm` (evita drift).
- **Caps no trigger** `pdm_itens_cap` `before insert`: `>10` raízes ou `>20`
  itens com `parent_id not null` por `pdm_id` → `raise exception`. O trigger
  cobre todo caminho de escrita (RPC manual e projeção); a projeção trunca
  deliberadamente ao cap em vez de explodir (ver §Projeção).
- Trigger `pdm_itens_touch` `before update` → `updated_at = now()` (idem no
  `pdm`) — carimbo de "última mexida" que a ficha mostra.

---

## D4 — RLS e RPCs

Padrão da casa: leitura por policies (`my_role()`/`my_profile_id()`/
`my_mentorado_id()` — `0066`), escrita por RPCs `security definer` (transições
atômicas, caps, guards — precedente: `emitir_instrumento_core` `0080`,
`jornada_autoemit` `0099`).

### Policies `pdm` e `pdm_itens` — select only

```sql
-- mesma régua de instrumentos_da_dupla (0080): coord lê tudo; mentor,
-- supervisor e mentorado leem a própria dupla (regra 4 do contexto:
-- "coord vê tudo de conteúdo; supervisor da dupla vê como mentor")
create policy pdm_select on public.pdm for select to authenticated using (
  my_role() = 'coordenacao'
  or exists (select 1 from duplas d
    where d.id = pdm.dupla_id and (
      d.mentor_id = my_profile_id()
      or d.supervisor_id = my_profile_id()
      or d.mentorado_id = my_mentorado_id()))
);
-- pdm_itens: idêntica via join item → pdm → dupla
```

Sem policies de insert/update/delete e **sem grants de escrita**: toda mutação
passa por RPC definer. `grant select` a `authenticated`; nada pra `anon`.

### RPCs `[NOVO]` — todas `security definer set search_path = public`

| RPC | Assinatura | Contrato |
|---|---|---|
| `pdm_da_dupla` | `(p_dupla_id uuid) returns jsonb` | Leitura: `{pdm: {id,dupla_id,visao,visao_em,updated_at}\|null, itens: [...flat], resumo:{metas,atingidas,submetas}}`. Escopo = a policy acima (mentor da dupla, mentorado via `my_mentorado_id()`, supervisor, coord). Lista flat ordenada `(ordem)` — o cliente monta a árvore (função pura testável). |
| `pdm_salvar_visao` | `(p_dupla_id uuid, p_visao text) returns void` | Upsert `pdm` (cria lazy) + `visao`/`visao_em`. |
| `pdm_salvar_item` | `(p_dupla_id uuid, p_item_id uuid, p_parent_id uuid, p_titulo text, p_porque text, p_indicador text, p_area_vida text, p_prazo_alvo date) returns uuid` | `p_item_id null` → insert (origem `manual`, `created_by = my_profile_id()`, ordem = próximo do conjunto de irmãos); senão update dos campos — **nunca** toca `status`/`atingida_em`/`ordem`/`origem`. `p_parent_id` valida mesmo `pdm_id`. |
| `pdm_status_item` | `(p_dupla_id uuid, p_item_id uuid, p_status text) returns void` | `ativa`/`atingida`/`descartada`. `atingida` → `atingida_em = now()`; sair de `atingida` → `atingida_em = null`. |
| `pdm_remover_item` | `(p_dupla_id uuid, p_item_id uuid) returns void` | Delete em cascata (subárvore). |
| `pdm_reordenar` | `(p_dupla_id uuid, p_parent_id uuid, p_item_ids uuid[]) returns void` | Recebe a ordem nova dos irmãos ativos daquele pai; valida conjunto exato (mesmos ids, sem faltar/sobrar) → `ordem = posição`. |
| `pdm_projeta_resposta` | `(p_dupla_id uuid, p_sistema text, p_respostas jsonb) returns void` | **Interna** — `revoke all`; chamada pelo wiring e pelo backfill. Ver §Projeção. |

**Gate de escrita comum (todas menos `pdm_da_dupla`/`pdm_projeta_resposta`):**
dupla existe ∧ `trilha <> 'especialista'` ∧ `status in ('ativa','pausada')` ∧
caller é `d.mentor_id = my_profile_id()` ou `d.mentorado_id = my_mentorado_id()`.
Trilha especialista não tem PDM (guia DPP — mesmo gate de `jornada_autoemit`
`0099`); dupla encerrada/concluída congela o documento (a retrospectiva acontece
antes, no rito — checklist `revisao_pdm` é manual).

**Invariantes garantidas pelo RPC/trigger:**
- ≤10 itens raiz, ≤20 itens não-raiz por PDM.
- Item só vive dentro do `pdm_id` do pai (`p_parent_id` cross-PDM rejeitado).
- Ciclos impossíveis: `parent_id` só se escolhe no insert (não há "mover pra
  outro pai" — reordenar é intra-irmãos; mudança de pai = apagar e recriar,
  decisão que simplifica o invariante sem custo real de UX: ~20 itens).
- Todo write em dupla que não é sua → `raise exception 'sem permissão'`
  (mesmo padrão de `emitir_instrumento_core`).

---

## D5 — Projeção forms → documento vivo

### Wiring

`create or replace` de `submeter_resposta_formulario` — versão vigente em
`0080:273` (acumula o gate de identidade de `0070` e `respondido_por_profile_id`;
o wiring 360 nasceu em `0042` e está restaurado em `0080:337-342`) —
acrescenta, após o insert da resposta e antes da notificação:

```sql
if l.f_sistema in ('metas','pdm') and l.dupla_id is not null then
  perform public.pdm_projeta_resposta(l.dupla_id, l.f_sistema, v_limpo);
end if;
```

Precedente exato do wiring 360→checklist (nascido em `0042:259-264`,
vigente em `0080:337-342`). `v_limpo` já é a
resposta sanitizada por `formularios_limpa_respostas` — datas `prazo_N` chegam
como ISO `YYYY-MM-DD`.

### Regras de `pdm_projeta_resposta`

1. `pdm` da dupla: insert on conflict `(dupla_id)` do nothing; se
   `declaracao_visao` veio preenchida → `visao` + `visao_em = now()`.
2. Para cada `meta_N` com texto na resposta (`metas`: `meta_1..5`; `pdm`:
   `meta_1..3`):
   - **slot** = `(pdm_id, parent null, origem_campo='meta_N')` — compartilhado
     entre os dois sistemas (a meta_1 do PDM **é** a meta_1 curada do
     worksheet; reescritas posteriores atualizam o mesmo slot — esse é o
     "mesmo dado" do cluster I).
   - Slot existe → update só de `titulo`/`indicador`/`prazo_alvo`/`porque` e
     `origem` := sistema atual. **`status`/`atingida_em`/`ordem`/`parent_id`
     preservados** — a dupla não perde progresso por reenviar o instrumento.
   - Slot livre → insert `origem=sistema`, `ordem = max(ordem dos irmãos)+1`.
3. `porque_N` (só `metas`), `is_N` e `prazo_N` (só `pdm`) alimentam o mesmo
   item do slot `meta_N`.
4. `meta_principal` (respostas antigas de `metas`): `"Meta K"` → o item do
   slot `meta_K` ganha `ordem` 0 (sobe ao topo dos irmãos ativos). Honra a
   prioridade escolhida antes da 141 remover o campo.
5. `submetas_N` (`pdm`, `texto_longo`): split por linhas não-vazias (após
   trim, removendo numeração `^\s*\d+\s*[.)-]\s*`), ≤20 filhos → filhos do
   item do slot `meta_N` com `origem_campo='submetas_N'`. Reconciliação por
   título normalizado (`lower(trim())`): linha que casa com filho existente
   preserva id/status/ordem; linha nova entra no fim; **filho projetado que
   some da resposta vira `descartada`, nunca é deletado** (preserva
   `atingida_em` e histórico; itens manuais — `origem_campo is null` — são
   intocáveis por qualquer projeção).
6. Idempotente: rodar 2× com a mesma resposta é no-op; respostas novas de
   re-emissão reconciliam em cima do estado.
7. Respeita caps: projeção trunca no cap (não explode a submissão — a resposta
   já foi gravada; o excedente é logado em `raise warning`).

### Backfill (na mesma migration 0106)

Loop idempotente sobre todas as duplas com resposta de `sistema in
('metas','pdm')` — **a resposta mais recente por (dupla, sistema)** projeta
como se acabasse de chegar. Cobre duplas vivas (PDM aparece pronto na ficha) e
encerradas (documento histórico consultável). Sem respostas → sem row `pdm`
(lazy, sem lixo). Reexecutar a migration é no-op (reconciliação por slot).

### Forms oficiais atualizados (141)

`formularios.campos` de `sistema='metas'`: remove `meta_principal`,
`rev_ajudam`, `rev_importantes`, `rev_claras`; `s_revisao.descricao` passa a
carregar a orientação ("Minhas metas me ajudam a chegar onde quero? Elas são
importantes? Consigo explicar o que quero alcançar? A ordem diz a prioridade —
a primeira é a mais importante agora."); `versao` bump. O guard
`formularios_sistema_guard` (`0042:82`) bloqueia UPDATE de `campos`/`versao`
incondicionalmente — a migration usa a saída documentada
(`alter table public.formularios disable trigger formularios_sistema_guard`,
padrão comentado em `0043:13`), atualiza, reabilita.

Respostas antigas: `respostas` jsonb intocado; `InstrumentoResultado` resolve
labels por `campos.find` e tolera campo removido (o valor só fica sem rótulo
na vista estruturada — os dados não se perdem; ver acceptance).

`formularios` de `sistema='pdm'`: **sem mudança de campos** — continua a
rodada-snapshot do guia; a árvore viva é a superfície nativa.

---

## D6 — Leituras, escritas e tipos no app

```
src/lib/pdm.ts              [NOVO]  puro/testável: tipos, montaArvore(flat),
                                  progresso(item), resumo(itens), labels status,
                                  CAPS {MAX_METAS:10, MAX_SUBMETAS:20}
src/lib/queries-pdm.ts      [NOVO]  getPdmDaDupla(duplaId) — React.cache,
                                  rpc pdm_da_dupla, fallback demo
src/lib/actions-pdm.ts      [NOVO]  salvarVisao/salvarItem/statusItem/
                                  removerItem/reordenar — {error}|{ok},
                                  validação zod leve, revalidatePath
```

Tipos (espelho do jsonb da RPC — `database.types.ts` regen cobre as tabelas):

```ts
type PdmStatus = "ativa" | "atingida" | "descartada";
type PdmItem = { id: string; parentId: string | null; titulo: string;
  porque: string | null; indicador: string | null; areaVida: string | null;
  prazoAlvo: string | null; status: PdmStatus; atingidaEm: string | null;
  ordem: number; origem: "manual"|"metas"|"pdm"|"visao"; };
type PdmDoc = { duplaId: string; visao: string | null; visaoEm: string | null;
  itens: PdmItem[] }; // flat — montaArvore transforma
type PdmNo = PdmItem & { filhos: PdmNo[]; feitas: number; total: number };
```

### Onde cada superfície lê

- **Ficha** `src/app/(app)/duplas/[id]/page.tsx`: `getPdmDaDupla(id)` paralelo
  às queries existentes → `<PdmDupla pdm={...} podeEditar={souMentor} />`
  (nova seção ao lado de `InstrumentosDupla` — o fim de `pdm_url` já deixou o
  comentário-âncora "PDM nativo" lá).
- **Portal jovem** `src/app/(jovem)/jovem/pdm/page.tsx` `[NOVO]`: mesma RPC
  (o `my_mentorado_id()` resolve o escopo); `podeEditar` sempre true — ele é
  co-autor. Link da estação "PDM" em `/jovem/materiais` (SISTEMA_DA_ESTACAO
  já mapeia `pdm`) → `/jovem/pdm`.
- **Resumo da jornada**: `dadosResumoJornada` (`src/lib/encerramento.ts:114`)
  aceita `pdm?: {metas,atingidas,atingidasLista}` opcional; ficha e
  `salvarEncerramento` (`src/lib/actions-encerramento.ts:159-168`) passam o
  agregado via `getPdmResumo(duplaId)` (nova query enxuta — reuso da mesma
  RPC, ou select direto com policy). `textoResumoJornada` ganha linha
  "Metas do PDM: X de Y atingidas" + lista com datas no snapshot.

### Performance

- `pdm_itens` ≤ ~30 rows por PDM; `pdm` ≤ 1 por dupla — volume trivial. Os
  dois índices bastam (UK de slot + `(pdm_id,parent_id,ordem)`); sem N+1: uma
  RPC retorna o documento inteiro num jsonb.
- `pdm_da_dupla` no `React.cache` — ficha + resumo na mesma render não
  duplicam a chamada.

---

## D7 — Decisões registradas (fecham perguntas do contexto)

| Pergunta (fonte) | Decisão |
|---|---|
| Coord vê conteúdo ou só agregados? (atividades-interativas §7.6) | **Conteúdo** — convenção atual de `instrumentos_da_dupla` e regra 4 do `_contexto-agentes.md`. Documentado aqui; `pdm_da_dupla` devolve tudo pra coord. |
| `duplas.pdm_url`? | Morta em `0098` (100% NULL prod). Nada a migrar; nenhuma referência nova. |
| Form × tabela: quem é a verdade? | `pdm`/`pdm_itens` = documento vivo; `formulario_respostas` = snapshot histórico da rodada (intocado, renderizado como hoje). |
| Metas × PDM: transcreve ou compartilha? (142) | **Compartilha** — mesmo `pdm_itens`, slot `meta_N` comum aos dois forms. |
| Mentorado edita direto ou só por link? | **Direto** — ele já tem login (`/jovem`, `0066`); o link segue como rodada do guia e porta de quem não loga. |
| Metas atingidas na retrospectiva: auto ou revisita? (142 aberta) | **Automático nos dados** (atingidas+datam entram no resumo) **com rito humano** — `revisao_pdm` do checklist continua manual: revisar junto é o encerramento. |
| Profundidade visual: tudo ou N níveis? (142 aberta) | Renderiza tudo com collapse por nó; sem limite de profundidade no modelo — o cap de ~20 itens não-raiz já limita o pathological case. UI sugere: a partir do 4º nível o indent trava e um badge "nível N" orienta (design.md). |
| Submeta × `encaminhamentos`? (atividades §7.3) | **Convivem**: combinado é compromisso da semana (encontro a encontro), submeta é estrutura do plano. Nenhuma FK agora — candidato a `encaminhamentos.pdm_item_id` numa iteração futura, fora de escopo. |

## Alternativas consideradas e descartadas

- **`pdm_metas` + `pdm_submetas` separadas** — morta pela recursão arbitrária
  (D2).
- **Só estender o forms com campo `metas_smart`** (Alternativa A de
  atividades-interativas) — snapshot continua snapshot; falha em co-edição,
  estado por item e queries (D1).
- **`atividade_links` multi-sessão** (REALIZA-17 original / issue 20) —
  cluster I decide a espinha de entrega; a 181 **não depende** dela: o portal
  logado do jovem já dá a superfície contínua que o multi-sessão proveria pro
  PDM. Se 20 vier, o PDM pluga nela como mais um instrumento — nada aqui
  conflita.
- **Fila de aceite** ("propostas do jovem" → mentor aprova) — atividades-
  interativas sugeria `origem='link'` + aceite; descartada: co-edição é
  decisão fechada (181) e o jovem é autor, não proponente. `origem` continua
  registrando procedência pra transparência ("veio da rodada de metas").
