# REALIZA-16 — SDD

## Alternativas consideradas

**A. Adicionar `mentorado_id` direto em `formulario_respostas`** — desnormalizar
a âncora pra leitura direta. Pró: join de uma tabela a menos. Contra: duplica
fato que já vive no link (deriva possível = divergência possível); toda
escrita nova teria que lembrar de preencher. **Rejeitada** — a âncora via
link já resolve com um join e é a única fonte.

**B. Check constraint exigindo âncora em `formulario_links`** (escolhida,
com a correção da revisão dba §4). `num_nonnulls(...)>=1 or multi_uso or
origem='intake'` — barato, no banco, impossível de contornar por action
futura. A exceção cobre o único genérico legítimo respondido pelo BLOCKER:
o link de campanha do intake (0115), anônimo por desenho e reconciliado por
`promovido_profile_id`. Link genérico *manual* sai de cena de vez (emissão
removida da action e da UI). Nasce `NOT VALID`: o histórico órfão não
explode a migration e a resposta legada segue legível — o `validate` roda
depois que a auditoria zerar (aceite #9).

**C. Só auditoria, sem constraint** — detecta órfão mas não impede. Mantida
como complemento (a auditoria cobre também as outras tabelas e históricos
anteriores à constraint).

## Modelo de dados

Sem tabela nova. Mudança proposta `[NOVO]`:

```sql
-- 0116 (idempotente):
alter table public.formulario_links
  drop constraint if exists formulario_links_tem_ancora;
alter table public.formulario_links
  add constraint formulario_links_tem_ancora
  check (
    num_nonnulls(dest_profile_id, dest_mentorado_id, dupla_id) >= 1
    or multi_uso or origem = 'intake'
  ) not valid;
-- + interacoes_tipo_check drop/add com 'vinculo_resposta' (trilha da
--   reconciliação manual — CHECK fechado desde 0008)
```

Semântica: um link sempre sabe **pra quem** (dest_*) ou **em que contexto**
(`dupla_id`) a resposta pertence — nunca flutua. A reconciliação dos órfãos
legados é `vincularRespostaOrfa` (coord-only): carimba `dest_mentorado_id`
+ a dupla DPP quando houver e registra autor/timestamp (`interacoes.tipo`
'vinculo_resposta' com dupla; `pessoa_notas` na ficha quando não há).

## RLS / security definer

Nenhuma policy nova: `formulario_links`/`formulario_respostas` já são
coord-only por RLS (0036) e `revoke all … from anon` — o público só toca via
RPCs definer existentes. A auditoria roda com service-role no CI (mesmo padrão
do `scripts/check-schema-contract.mjs`).

## Contratos TS

- `src/lib/forms/actions.ts` — `DestinoLink.tipo === "generico"`: se a
  constraint entrar, ou o tipo sai do union ou passa a exigir `duplaId`
  obrigatório no input; ajustar `gerarLinksFormulario` + call sites.
- `src/lib/identidade-ancora.ts` `[NOVO]` — matriz declarativa
  `ANCORAS: { tabela, ancora, via }[]` consumida pelo teste Vitest e pelo
  script de auditoria (fonte única da matriz).

## Invariantes

1. Toda linha de `formulario_respostas` resolve pra `mentorados.id` via
   `link.dest_mentorado_id` ou `link.dupla_id → duplas.mentorado_id`.
2. `mentorados.profile_id` pode ser null — identidade ≠ conta; nunca se
   apaga por conveniência (0066: sem `on delete set null`).
3. Link genérico só existe com reconciliação documentada (caso B do plano).
4. Nenhuma superfície nova de coleta (rascunho 20, PDF 55, PDM 181) persiste
   dado sem `dupla_id`/`mentorado_id`.

## Vínculo com a futura conta

Quando `mentorados.profile_id` é populado (hoje: coord vincula no
cadastro/convite, `src/lib/actions.ts:851`; `my_mentorado_id()` resolve
depois), **todo** o histórico já aparece por join — nenhuma migração de dado
é necessária, porque nada aponta pra "identidade de token". Isso é o que a
issue quer provar.
