# REALIZA-70 — sdd.md (link multi-uso + intake — referência também pro REALIZA-69)

## O problema

`formulario_links` foi desenhado uso-único: `usado_em` marca consumo e
`formulario_respostas.link_id UNIQUE` (`0036:65`) garante corrida.
Intake público = **uma URL, N respostas anônimas** — o modelo precisa
estender sem quebrar a invariante dos links individuais.

## Alternativas

| Opção | Veredito |
|---|---|
| **A. `multi_uso` flag + trigger de unicidade** (escolhido) | ✅ mesma rota `/f/[token]`, mesmas RPCs, mesma tabela de respostas; a exceção fica explícita na flag |
| B. Auto-mint: cada submit cria um link novo + resposta | ⚠️ zero mudança de constraint, mas polui `formulario_links` com 1 row por respondente e o "link público" vira campanha implícita |
| C. Tabela separada `intake_respostas` | ❌ duplica renderer/RPC/resumo/grade pra nada — a resposta tem o mesmo shape |

## Schema

```sql
alter table public.formulario_links
  add column multi_uso boolean not null default false,
  add column origem text not null default 'manual'
    check (origem in ('manual','intake'));

alter table public.formulario_respostas
  drop constraint formulario_respostas_link_id_key;  -- nome exato a verificar

alter table public.formulario_respostas
  add column promovido_profile_id uuid null references profiles(id);

-- trigger preserva "1 resposta por link" pra links não-multi
create function resposta_unica_guard() returns trigger ...
  select l.multi_uso into v from formulario_links l where l.id=new.link_id;
  if not v and exists (select 1 from formulario_respostas r
                       where r.link_id=new.link_id) then
    raise exception 'link já respondido';
```

## RPCs alteradas (`CREATE OR REPLACE`, definer, grants mantidos)

- `submeter_resposta_formulario`: `if not link.multi_uso` → mantém
  `usado_em=now()` + checagem de "já respondido"; multi_uso → pula ambos.
  Rate: `count(respostas link) >= 500` ou `>=50` no dia → erro.
- `formulario_por_token`: sem mudança de assinatura — `expira_em` nulo
  (link intake não expira por padrão) já é suportado? — **a verificar**
  o check de expiração atual; se `expira_em` é NOT NULL, multi-uso usa
  expiração longa ou `ativo` — decisão no código da migration.
- `formulario_respostas` continua `security definer` — anon nunca toca.

## Action nova

```ts
gerarLinkIntake(formularioId) → { url } | { error }   // coord-only
promoverRespostaIntake(respostaId) → { prefill } | { error }  // coord-only
```

## Mapeamento resposta → profile (promoção)

| Campo do form | Destino em `profiles` |
|---|---|
| `nome_civil` | `nome` (+ `nome_social` — a verificar coluna) |
| `email` | `email` |
| `telefone` | `whatsapp` via `normWhatsapp` |
| `nascimento` | `nascimento` (a verificar nome) |
| `disponibilidade` | `disponibilidade` jsonb — **zero-copy** se shape = `disponibilidade_ok` |
| `genero`, `cor_raca`, `cidade`, `cargo`, `empresa`, `linkedin` | colunas `*_pessoal`/matching de `0034`/`0038` — **a verificar nomes exatos** antes de escrever o mapper |
| `curriculo`, `foto`, docs | `documentos_pessoa`/`avatar_path` — mover objeto do bucket `form-anexos` pro destino canônico ou registrar path (decisão: copiar path pro campo correto — `avatar_path` pra foto, `documento_path` pra RG? — a verificar estrutura `documentos_pessoa`) |

## Invariantes

1. Link `multi_uso` nunca ganha `usado_em`; link manual nunca aceita 2ª
   resposta (trigger garante no banco, não no RPC).
2. Resposta de intake tem `link.dest_*` nulo — identidade mora nas
   respostas (e-mail/telefone do próprio form) até promoção.
3. `sistema` forms são imutáveis — correção de typo = migration nova.
4. Grade da disponibilidade no shape `disponibilidade_ok` — matching
   consome sem adapter.

## Performance

- Trigger `resposta_unica_guard`: 1 select por insert — trivial.
- Rate check por link: `count` em `formulario_respostas(link_id)` —
  indexar se não houver (FK sem índice? a verificar).
