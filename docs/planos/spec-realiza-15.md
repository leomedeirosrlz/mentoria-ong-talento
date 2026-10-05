# Spec REALIZA-15 — entidade `cronogramas` + escopo do semáforo por dupla

> Fix de integridade disfarçado de feature. Fonte: `turmas-cronogramas.md` (Modelo A da fase F1),
> decisões fechadas em `_contexto.md` § Decisões 3ª rodada. Banco real verificado em 05/10.
> **v2** — reconciliada após review adversarial duplo (design + DBA); achados incorporados.
>
> **Gate:** migration escrita mas NÃO aplicada ao remoto sem OK do Thiago (toca schema + dados reais).

## 0. Estado real do banco (preflight 05/10, PostgREST service role)

- `duplas`: 1 row, `ciclo='2026/2027'`, trilha `dpp`, status `ativa`.
- `ciclo_eventos`: 20 rows, todas `ciclo='2026/2027'` — 16 `encontro`, 2 `formacao`, 1 `recesso`, 1 `marco`.
- Violação do novo índice de vaga global `(mentorado_id, trilha)` parcial ativo: **nenhuma**.
- Backfill esperado: **1 cronograma**, 20 eventos linkados, 1 dupla linkada.

## 1. Decisões fechadas que mudam o esboço do brainstorm

| Decisão (terceira rodada) | Consequência nesta spec |
|---|---|
| Vaga do mentorado: `(mentorado_id, trilha)` **global** | Índice sai de `(ciclo, mentorado_id, trilha)` → `(mentorado_id, trilha)`. Alinha banco com `createDupla` (já global). |
| Formação é **por turma** | `sync_formacao_ok` compara `cronogramas.turma` (join), não `cronograma_id`. Invariante: eventos `formacao` de uma turma pertencem ao(s) cronograma(s) daquela turma. |
| T1 e T2 são **turmas** distintas (13 e 17 duplas) | Demo usa turmas distintas; F1 cria só a entidade, T2 entra na REALIZA-31. |
| Especialista não tem cronograma | `duplas.cronograma_id` NULLABLE; especialista = null por desenho. |
| Dupla ∈ turma **E** cronograma | `duplas.turma` (texto) + `duplas.cronograma_id` (FK) coexistem. |

**Identidade declara:** um passo/encontro oficial DPP é identificado por `(cronograma_id, numero)` — nunca por `numero` solto. Todo Map/lookup por número na agenda, ficha e exports chaveia pelo par ou opera sobre a lista já escopada por cronograma.

## 2. Modelo (F1)

```
cronogramas (NOVO) 1 ---- n ciclo_eventos      (cronograma_id NOT NULL)
                    1 ---- n duplas            (cronograma_id NULL, parcial index)
                   duplas.turma text           (ex-ciclo; label da turma)
```

- `ciclo_eventos.ciclo` **drop** — 100% derivável via `cronogramas.turma`; manter seria dupla fonte.
- `duplas.ciclo` **rename → `duplas.turma`** + **drop default** `'2026/2027'` (herdar default fantasma corromperia futuras duplas de especialista — a RPC `aceitar_solicitacao` é patcheada na mesma migration).
- Views: nenhuma referencia `ciclo` (verificado — `profiles_contato`, `*_pessoal`, `solicitacoes_mural`).

### DDL — `supabase/migrations/0061_cronogramas.sql` (ordem dentro de `begin;`/`commit;`)

```sql
begin;

-- 1. entidade nova ------------------------------------------------------
create table if not exists public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) <= 120),
  turma text not null check (char_length(turma) <= 80),
  trilha text not null default 'dpp' check (trilha in ('dpp')),
  inicio_em date,
  fim_em date,
  encontros_esperados smallint check (encontros_esperados is null or encontros_esperados >= 0),
  status text not null default 'ativo' check (status in ('rascunho','ativo','encerrado')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.cronogramas enable row level security;
revoke all on public.cronogramas from public, anon;
grant select, insert, update, delete on public.cronogramas to authenticated;
drop policy if exists cronogramas_select on public.cronogramas;
drop policy if exists cronogramas_coord on public.cronogramas;
create policy cronogramas_select on public.cronogramas for select
  using (public.my_role() is not null);
create policy cronogramas_coord on public.cronogramas for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- 2. backfill da união dos dois domínios de ciclo (eventos ∪ duplas) ------
insert into public.cronogramas (nome, turma, inicio_em, fim_em, encontros_esperados)
  select 'Calendário oficial', v.ciclo, e.inicio, e.fim, e.esp::smallint
  from (select ciclo from public.ciclo_eventos
        union
        select ciclo from public.duplas) v(ciclo)
  left join lateral (
    select min(data) inicio,
           max(greatest(data, coalesce(data_fim, data))) fim,
           count(*) filter (where tipo = 'encontro') esp
      from public.ciclo_eventos e where e.ciclo = v.ciclo
  ) e on true;

-- 3. ciclo_eventos ganha cronograma_id, perde ciclo ----------------------
alter table public.ciclo_eventos add column if not exists cronograma_id uuid references public.cronogramas(id);
update public.ciclo_eventos e set cronograma_id = c.id
  from public.cronogramas c where c.turma = e.ciclo;
alter table public.ciclo_eventos
  alter column cronograma_id set not null,
  drop column ciclo;
create unique index if not exists ciclo_eventos_cronograma_numero_key
  on public.ciclo_eventos (cronograma_id, numero);   -- sem WHERE: serve FK lookup tb

-- 4. duplas ganha cronograma_id, ciclo vira turma ------------------------
alter table public.duplas add column if not exists cronograma_id uuid references public.cronogramas(id);
update public.duplas d set cronograma_id = c.id
  from public.cronogramas c where c.turma = d.ciclo;
alter table public.duplas rename column ciclo to turma;
alter table public.duplas alter column turma drop default;
create index if not exists duplas_cronograma_idx
  on public.duplas (cronograma_id) where cronograma_id is not null;

-- invariante: DPP ativa/pausada exige cronograma (especialista e histórica não)
alter table public.duplas drop constraint if exists duplas_dpp_precisa_cronograma;
alter table public.duplas add constraint duplas_dpp_precisa_cronograma
  check (trilha <> 'dpp' or status not in ('ativa','pausada') or cronograma_id is not null);

-- 5. vaga global por trilha (decisão fechada) ----------------------------
drop index if exists public.duplas_ciclo_mentorado_ativa_key;
create unique index if not exists duplas_mentorado_ativa_key
  on public.duplas (mentorado_id, trilha) where status in ('ativa','pausada');

-- 6. sync_formacao_ok: e.ciclo virou join; recorte por TURMA -------------
--    (PL/pgSQL não é dependency-tracked: replace DEPOIS do drop, na mesma tx)
create or replace function public.sync_formacao_ok()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_turma text;
begin
  select c.turma into v_turma
    from public.ciclo_eventos e
    join public.cronogramas c on c.id = e.cronograma_id
   where e.id = new.ciclo_evento_id and e.tipo = 'formacao';
  if not found then return new; end if;
  if exists (
    select 1 from public.ciclo_eventos e
    join public.cronogramas c on c.id = e.cronograma_id
    where c.turma = v_turma and e.tipo = 'formacao'
      and not exists (
        select 1 from public.presencas p
        where p.ciclo_evento_id = e.id and p.profile_id = new.profile_id and p.presente))
  then return new; end if;
  perform set_config('realiza.formacao_sync', '1', true);
  update public.mentor_profiles mp set formacao_ok = true
   where mp.profile_id = new.profile_id and not mp.formacao_ok;
  return new;
end $$;

-- 7. aceitar_solicitacao (0053): a dupla especialista herda a turma da DPP
--    de origem — o default '2026/2027' que carimbava não existe mais.
create or replace function public.aceitar_solicitacao(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
  -- corpo idêntico ao vivo (0053:615), exceto o insert:
  --   insert into public.duplas (mentor_id, mentorado_id, trilha, demanda, solicitacao_id, iniciada_em, turma)
  --   select meu, s.mentorado_id, 'especialista', s.demanda, s.id, current_date, d.turma
  --     from public.duplas d where d.id = s.dupla_dpp_id
$$;

-- 8. self-test: DPP ativa/pausada não pode ficar sem cronograma ----------
do $$
begin
  if exists (select 1 from public.duplas
             where cronograma_id is null and trilha = 'dpp'
               and status in ('ativa','pausada')) then
    raise exception '0061: dupla DPP ativa/pausada sem cronograma após backfill';
  end if;
end $$;

commit;
-- rollback: rename turma→ciclo + default '2026/2027' + índice antigo +
--           e.ciclo restaurado via update ... from cronogramas; drop cronogramas.
```

(O corpo completo de `aceitar_solicitacao` é transcrito na migration a partir de `0053`, não deste resumo.)

## 3. Código — pontos de mudança (mapa reconciliado)

### 3.1 Tipos

```ts
export type Cronograma = { id; nome; turma; trilha: "dpp"; inicio_em; fim_em;
                           encontros_esperados: number | null; status: "rascunho"|"ativo"|"encerrado" };
CicloEvento: - ciclo, + cronograma_id: string
Dupla:      ciclo→turma (string), + cronograma_id: string | null
```
`database.types.ts` hand-patch idêntico ao regen; regen real após aplicar.

### 3.2 Domínio (`ciclo.ts`)

```ts
export function eventosDoCronograma(evs: CicloEvento[], cronId: string | null | undefined): CicloEvento[]
//   null/undefined → [] (sem calendário = trilha livre)
export function cronogramaVigente(crons: Cronograma[], evs: CicloEvento[], hoje): Cronograma | null
//   ativos cuja faixa cobre hoje → menor inicio_em → created_at → nome (tie-break determinístico);
//   senão o próximo a começar; senão o mais recente encerrado.
export function cronogramasOpcoes(crons: Cronograma[]): Cronograma[]   // ordena turma,nome; label UI `${turma} · ${nome}`
```

| Função | Mudança |
|---|---|
| `saudadeDaDupla`, `alvoAgendamento`, `primeiroEncontroFaltante` | filtro interno `eventosDoCronograma(eventos, dupla.cronograma_id)` na 1ª linha. |
| `resumoSemanaDe`, `duplasSemEncontroDoNumero` | **guarda interna**: só duplas `d.cronograma_id === evento.cronograma_id` entram no denominador (resolve "união de duplas mistas" e caller não precisa saber). |
| `passosDaTrilha`, `jornadaDaDupla`, `dadosResumoJornada`, `eventoDaSemana`, `totalEncontros`, `resumoSemana`, `inicioDefaultDupla`, `textoResumoSemana` | assinaturas idem; callers passam a lista já escopada. |

### 3.3 Queries

- `getCronogramas()` nova (`cronogramas select * order by turma, nome`, cache).
- `getResumoFormacao` (queries-presenca): turma vigente = **turma do(s) cronograma(s) das duplas do mentor**; sem dupla → formação mais recente. Denominador = eventos `formacao` dos cronogramas daquela turma. `formacao_ok` booleano global por mentor = limitação aceita de F1 (declarada).
- `getDuplasOpcoes` ganha `cronograma_id` (filtro /registros por cronograma da dupla).
- `getMentoresChamada` continua global (declarado: chamada é de todos os mentores ativos).

### 3.4 Actions

- `dadosCiclos` → `dadosCronogramas` (tabela, não distinct de texto).
- `createDupla`: field `cronograma_id` (uuid) validado contra tabela; `turma = cronograma.turma` gravado junto; `iniciada_em` âncora no 1º encontro `.eq('cronograma_id')`. **DPP sem cronograma → erro explícito** (nunca fallback silencioso).
- `updateDupla`: gate por `has("cronograma_id")`; troca atualiza `turma` junto; **DPP→especialista seta `cronograma_id: null`**; especialista→DPP exige cronograma.
- `agendarEncontro`/`registrarEncontroRetroativo`/`salvarNotaEncontro`/`updateDupla`/`registrarEncerramento`: os selects estreitos **ganham `cronograma_id`** (`status,trilha` → `status,trilha,cronograma_id` etc.) e os `max(numero)`/`evs[0]` passam a `.eq('cronograma_id', …)`; dupla DPP com null → rejeita ("vincule um cronograma na edição da dupla").
- `criarMaterial`/`editarMaterial`: `encontro_num` segue global (resíduo aceito: picker pode oferecer nº inexistente num cronograma divergente — refinamento F2/F3).
- Encerramento: `ciclo_eventos` escopado por `dupla.cronograma_id` — resumo da jornada correto; dupla sem cronograma → `esperados` nulo (especialista) ou rejeita DPP.

### 3.5 UI — seletor de cronograma compartilhado

Estado: `?cronograma=` na URL (como `?semana=`), default `cronogramaVigente`. **Mesmo componente pra coord e mentor** — mentor só o vê quando `new Set(minhasDuplas.cronograma_id).size > 1` (caso real: mentor com duplas em T1 e T2). Isso mata a "união" inteira: toda tela opera sempre sobre **um** cronograma por vez.

| Superfície | Mudança |
|---|---|
| agenda | seletor no topo; `idsFormacao` = formações dos cronogramas da **turma selecionada**; `eventoDaSemana`/`semana` computados por cronograma selecionado (client); `passosDppPorNumero`, `numerosOficiais`/`itensPorNumero`, `encontrosRail`, `AcaoDiaMentor`, "fora do dia oficial" — todos operam sobre o recorte escopado. |
| dashboard coord | `resumoSemana` por cronograma (1 cartão por ativo, `nome` como label). |
| mentor-home / agenda mentor | recorte do cronograma selecionado (ou único). |
| `/duplas` | header dinâmico `"N duplas"`; filtro chips por turma/cronograma. |
| `/registros` | `maxEncontro` do cronograma da dupla filtrada; `tituloDpp` por `(cronograma,numero)` da dupla da linha. |
| `duplas/[id]` | `eventosDoCronograma` antes de tudo; **fallback**: `passos=[]` com dupla tendo encontros → renderiza as rows direto de `dupla.encontros` (histórica sem calendário não perde a trilha visual). |
| dialogs nova/editar dupla | `name="cronograma_id"`; `select` não renderiza pra mentor especialista; `turma` nunca editável (derivada). |
| `api/export` `?tipo=ciclo` | colunas `turma`+`cronograma` (via `Map` de `getCronogramas`); params `?turma=`/`?cronograma=`; demo espelha. |
| `agenda/loading` | discos = `encontros_esperados` ?? 16. |

### 3.6 Encontros órfãos (numero sem oficial no cronograma)

Encontros reais da dupla **sempre renderizam e contam** — o oficial é overlay. `resumoSemanaDe`/`duplasSemEncontroDoNumero` só consideram números presentes no cronograma do evento. Jornada: `porNumero` fora da janela continua visível via fallback da ficha.

### 3.7 Demo

- `DemoData.cronogramas`: A `"T1 · 2026/2027"` (terças, o calendário atual) + B `"T2 · 2026/2027"` (terças+quintas duplas, deslocado ~1 mês) — **turmas distintas** (decisão: são turmas, não cronogramas irmãos). B com suas próprias `formacao`.
- `buildCicloEventos` preenche `cronograma_id`; `duplaFim` (histórica) → `null` (exercita fallback); todas as duplas `ciclo:` → `turma:` + `cronograma_id`.
- `demoResumoFormacao` por turma das duplas do mentor; `client-stub` expõe `cronogramas`; stub de `getDuplasOpcoes`/export coerente.

### 3.8 Testes novos (além dos 6 da v1)

- `resumoSemanaDe`/`duplasSemEncontroDoNumero` com duplas mistas (guarda interna).
- Ficha/jornada com `passos=[]` + encontros (fallback).
- `getResumoFormacao` com 2 turmas (re-baseline não contamina).
- `updateDupla` DPP→especialista limpa `cronograma_id`.
- Encerramento escopado por cronograma.
- `cronogramaVigente` tie-break com 2 ativos sobrepostos.
- Fixtures: `mkEvento` ganha `cronograma_id`; `mkDupla` `ciclo`→`turma`+`cronograma_id`; `CICLO_B` novo.

## 4. Deploy e rollback

- **Ordem:** aplicar migration (gate) → regen types → deploy. Janela ~minutos, aceita.
- **Rollback:** SQL de reversão completo no rodapé do arquivo da migration.
- **`duplas.ciclo` dependentes resolvidos:** índice de vaga (recorde global), default (dropado), `aceitar_solicitacao` (patcheada). Nenhuma view/policy lê `ciclo`.
- **F1 não tem UI de cronograma** — 2º cronograma real entra por SQL até REALIZA-46; critério de pronto exercitado no demo + via insert manual.

## 5. Critério de pronto (inalterado)

Inserir 2º cronograma + 1 dupla → semáforos corretos, agenda por cronograma, trilha certa, resumoSemana por coorte, encerramento correto, CSV com coluna cronograma.

## 6. Fora de escopo

F2 wizard (REALIZA-46), F3 turmas/programas (REALIZA-47), F4 membership, REALIZA-31 (cadastro T1+T2), REALIZA-30 (modelo de eventos rico).
