# REALIZA-183 — critérios de aceite

## Funcional

1. Dado um GET válido em `/resumo/<RESUMO_SLUG_T2>`, então existe exatamente 1
   row em `resumo_acessos` com `slug = 't2-x7k4m9qf2w8j'`, `acessado_em` ~agora,
   `user_agent` não nulo e `params` contendo `turma`/`gran`/`col` conforme a URL
   (`{}` se sem query).
2. Dado GET em `/resumo/slug-errado`, então a página responde 404 **e nenhuma**
   row é inserida (log só de slug válido).
3. Dado um request sem `x-forwarded-for`/`x-real-ip` (ex.: curl sem headers de
   proxy), então `ip_hash` é NULL (não vazio, não "unknown").
4. Dado o mesmo IP em dois acessos, então `ip_hash` é idêntico (determinístico);
   e dado outro IP, hash diferente. Em nenhum dos dois a coluna contém o IP em
   claro nem substring reconhecível (ex.: `192.168` ausente).
5. Dado `params` com query `?turma=T2+%C2%B7+2026%2F2027&gran=duplas&col=mentor`,
   então `params` registra exatamente esses valores; query extra (`?foo=bar`)
   não aparece.
6. Dado `resumo_acessos` indisponível (tabela dropada em staging / insert
   falhando), então `/resumo/<slug>` renderiza normalmente (o log nunca é gate).

## Segurança / RLS (validador REST `_valida_0106_rest.mjs`)

7. Como `anon`: `GET /rest/v1/resumo_acessos` → erro de permissão (grant
   revogado); `POST` idem.
8. Como mentor autenticado: `GET /rest/v1/resumo_acessos?select=*` → `[]`
   (policy coord-only devolve vazio, não erro).
9. Como coord autenticado: `GET` → vê as rows. Como service role: `insert` → 201.
10. `update`/`delete` por qualquer papel via REST → negado (não há policies).

## Gates

11. `npx tsc --noEmit` limpo; `npx eslint src/` limpo; `database.types.ts`
    regen commitado (gate de freshness do e2e-app).
12. `schema-contract` CI verde: a tabela existe em prod **antes** do merge que a
    referencia — ordem migration→prod→merge respeitada.
13. Sem e2e novo obrigatório (superfície server-side); se adicionado, spec
    `demo` apenas se o modo demo ganhar um caminho de resumo — hoje não tem.

## Rollout

14. Migration aplicada em staging → validador REST → prod → merge → verificar 1
    acesso real em produção (`select * from resumo_acessos order by acessado_em
    desc limit 1` depois de abrir o link uma vez).
