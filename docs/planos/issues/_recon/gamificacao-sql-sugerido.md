# SQL sugerido — 024 gamificação (nível, famílias com tiers)

A spec 024 foi implementada **sem DDL**: toda a derivação é pura em
`src/lib/conquistas.ts` sobre leituras já existentes (`jovem_encontros`
com `duracao_min`/`sessao_id`, `jovem_encaminhamentos`,
`jovem_assinaturas`, RPC `pdm_da_dupla`, `jovem_perfil`). Nenhuma
migration foi criada nem é necessária.

## Sugestões opcionais (melhoria honesta, não bloqueio)

### 1. `jovem_encaminhamentos.feito_em` — carimbo dos tiers de combinados

A família **combinados** (tiers 5/15/30/50) deriva a contagem do status
`feito`, mas a view `jovem_encaminhamentos` (migração 0070) não projeta
`encaminhamentos.feito_em` — que existe na tabela e já é projetado em
outras views (ex.: `encaminhamentos` staff). Resultado atual: os tiers
ganhos da família chegam com `data: null` e a peça ordena no fim da
estante — honesto, mas sem carimbo.

Se um dia quisermos a data "Conquistado em …" no degrau de combinados:

```sql
-- ALTER VIEW, não ALTER TABLE: só expõe coluna já existente na tabela.
create or replace view public.jovem_encaminhamentos as
select
  e.id, e.dupla_id, e.descricao, e.prazo, e.status,
  e.feito_em,            -- ← novo (carimbo do combinado feito)
  e.created_at
from public.encaminhamentos e
where e.responsavel = 'mentorado'
  and exists (
    select 1 from public.jovem_duplas d where d.id = e.dupla_id
  );
```

> Atenção: o `select` acima é ilustrativo — copiar a projeção verbatim da
> definição atual da view (`pg_get_viewdef`) e só acrescentar a coluna, na
> ordem que o lead preferir (o diff de view costuma ser recriada inteira).

Efeito colateral previsto: `database.types.ts` regenerado passa a expor
`feito_em` no tipo `JovemEncaminhamento`; `ConquistasInput.encaminhamentos`
ganharia o campo opcional e `emiteFamilia` de combinados passaria a
carimbar a data do limiar cruzado.

### 2. Nada mais

- `sessao_id`/`duracao_min` já chegam por `getJovemEncontros` (colunas da
  própria tabela `encontros`, policy da 0068) — dedup e soma de horas são
  puramente derivados.
- Metas/submetas leem `pdm_da_dupla` (RPC já escopada à dupla) — nenhuma
  leitura nova de tabela.
- `termo-mentorando` é lido da view `jovem_assinaturas` existente — o
  slug já vem projetado.
- Persistir conquistas/tiers em tabela própria foi explicitamente
  descartado pela spec (derivação pura, sem ranking nem streak).
