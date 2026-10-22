# REALIZA-175 — plano de execução

## Alvos

- `src/app/(app)/registros/page.tsx` — agrupamento + largura.
- `src/components/registros-filtros.tsx` — segmented control + dialog.

## Passos

1. **`?grupo=` param** — ler `grupo` de `searchParams` (`:102`);
   validar contra `["dupla","semana","avaliacao"]`, default `"dupla"`.
   A URL combina com `?ordem=`, `?q=` etc. — gerar hrefs com helper tipo
   `sem("grupo")`/`com("grupo", v)` (o arquivo de filtros já tem `sem`).
2. **Segmentar `itens`** — função pura em `src/lib/` (ex.:
   `agruparRegistros(itens, grupo)` em `src/lib/registros.ts` [NOVO] ou
   colada em `ciclo.ts` se já houver domínio — preferir `lib`):
   - `dupla`: por `r.dupla_id`, header `mentor × mentorado` (dados já no
     card? — `RegistroCard` recebe `r`; verificar campos `r.dupla`/
     `r.mentor_nome`/`r.mentorado_nome` — `a verificar` o shape exato);
   - `semana`: bucket `segunda-feira` da semana de `r.created_at`/
     `r.encontro.realizado_em` (checar o campo de data certo — `a verificar`
     no tipo `Registro`);
   - `avaliacao`: bucket `r.avaliacao` (1-5 ★), header `Avaliação N`.
3. **Render** — `<ol>` por grupo; o rail/dot (`:230-260`) fica **dentro**
   de cada grupo (`!ultimo` passa a ser por grupo). Header entre grupos
   com `border-t` (exceto o 1º).
4. **Largura** — `max-w-3xl` → `max-w-5xl` (`:269`); quando
   `grupo === "dupla"`, `xl:grid xl:grid-cols-2 xl:gap-6` no container de
   grupos; demais grupos em coluna única.
5. **Switcher** — em `registros-filtros.tsx`, acima/ao lado da busca
   (`:341-350`): segmented `Link` pro `?grupo=` (3 opções + ativo).
6. **Dialog** — `:419` `sm:max-w-lg` → `sm:max-w-md`. Revisar o padding
   interno (`space-y-5` entre fieldsets — `a verificar` se cabe em md sem
   scroll excessivo; se sim, ok; se não, `sm:max-w-md` + `max-h-[80dvh]`).

## Campos a verificar (antes de escrever)

- `Registro`/`RegistroCard` props: nomes de mentor/mentorado acessíveis
  pro header do grupo (`r.dupla?.mentor.nome`? — ler `src/lib/types.ts` +
  `registro-card.tsx`).
- Data de agrupamento por semana: `created_at` do registro ou
  `realizado_em` do encontro — decidir pelo semântico ("semana em que
  reportaram" = `created_at`; "semana do encontro" = `realizado_em`) —
  **recomendação**: `created_at` (é o ato de reportar).
- `avaliacao` é 1-5 int — bucket direto.

## Risco / rollback

Render-side; o `?grupo=` default muda a ordem visual — garantir que o spec
e2e de registros não depende de ordem absoluta de duplas (grep
`tests/e2e` por `/registros`). Rollback = revert.

## Gates

`tsc` · `eslint` · `pnpm test` (função `agruparRegistros` pura → teste
unitário vitest) · e2e demo/app `/registros`.
