# Plano — PDM cascateado e seletor de mentorado

**Spec:** `specs/011-pdm-cascata/spec.md` · **Status:** Draft

## Resumo técnico

- Reaproveitar `SubmetasEditor` e mudar a composição de `FichasPdm`: o campo `submetas_N` da meta N é resolvido pelo grupo, não pelo capítulo.
- O capítulo “Mapa de submetas” passa a ser um fallback para campos órfãos; não duplica os já aninhados.
- Reutilizar `MentoradoSeletor` na régua (`instrumentos-programa.tsx`) e na página por instrumento; remover “Na ficha” como único controle.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- `src/lib/forms/instrumentos.ts` já tem `extraiGruposMeta`; `src/lib/pdm.ts` tem o parser de submetas e o limite.
- Testes Vitest + Playwright; demo e app.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Núcleo de UI + persistência por rascunho | e2e |
| A2 RLS | Não muda | — |
| A3 escritas/domínio | Reutiliza action/RPC existentes | sem action nova |
| A4 rota pública | `/f` já existe | — |
| A5 LGPD | Nenhum dado novo | — |
| A6 UI | kit/tokens, foco, mobile | prints |
| A7 demo | 1 e 4 mentorados no dataset | demo e2e |
| A8 gates | DoD | — |
| A9 migrations | Só se o limite exigir; decidir antes de codar | plan |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
src/components/instrumentos/pdm.tsx             # FichasPdm: aninhar submetas
src/components/instrumentos/submetas-editor.tsx # reutilizar
src/components/instrumentos/metas.tsx           # paridade de add meta
src/lib/forms/instrumentos.ts                   # resolução submetas_N ↔ meta N
src/app/(app)/materiais/instrumentos-programa.tsx # nomes na régua
src/app/(app)/materiais/instrumentos/[chave]/page.tsx # seletor
src/components/mentorado-seletor.tsx            # pills/dropdown
src/lib/demo/data.ts                            # fixtures 1/4 mentorados
tests/...                                       # unit + demo
```

## Dados e migrations

- Sem migration para o aninhamento: o contrato `submetas_N` já existe e a ficha nativa já lê a árvore.
- Metas extras: validar o template e o limite `8`; se precisar de campos novos, criar migration **nova** antes do código e registrar aqui. Não editar migration aplicada.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| ler PDM da dupla | ✅ | ✅ | ✅ (própria) | ❌ | ✅ (próprio) | ❌ |
| editar PDM | ✅ | ❌ | ✅ (própria) | ❌ | ✅ (próprio) | ❌ |

Manter as regras atuais; não ampliar.

## Superfícies e rotas

- Nenhuma rota nova. O seletor usa `?dupla=` e `scroll={false}`.
- `hrefBase` da régua e do detalhe precisa preservar o instrumento.

## Paridade demo

- Dataset com uma dupla e com quatro duplas (ou fixture de seletor) para os dois modos.
- Nenhuma mutação demo nova.

## Testes

- **Unit:** `extraiGruposMeta` resolve `submetas_N` da meta N; fallback órfão.
- **E2E demo:** form PDM com submeta sob meta; seletor com 4 nomes.
- **E2E app:** mentor com 2 duplas filtra e mantém `?dupla=`; escrita real do PDM não regride.
- **Visual:** prints 1440/390.

## Observabilidade e erro

- Erro de RPC continua inline; nenhuma mensagem nova de infra.

## Rollout

1. provar o aninhamento em unit/demo; 2. UI do seletor; 3. gates; 4. review; 5. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| Limite de metas pode exigir migration | paridade form × nativo | esconder “Nova meta” |
