# REALIZA-177 — Sweep de todos os modais: overlay × conteúdo, densidade, consistência

**Status: aberto.** ~51 arquivos usam `DialogContent`; a base é sólida mas
as larguras foram escolhidas ad-hoc — e alguns dialogs redeclaram scroll/
altura que a base já dá.

## Inventário real (grep sobre `DialogContent` + `sm:max-w-*`)

Base: `src/components/ui/dialog.tsx:56` — `max-w-[calc(100%-2rem)]`,
`max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`, `p-4`, `gap-4`,
`sm:max-w-sm` **default**.

Larguras em uso (não-default):

| Largura | Arquivos (exemplos) |
|---|---|
| `sm:max-w-md` | formulários: anamnese, cronograma-editor, editar-dupla, encaminhamentos, enviar-email, enviar-formulario, material-actions, remanejar, saida-mentorado, formulario-links, perfil-form (partes) |
| `sm:max-w-lg` | confirmações/listas: encerrar-dupla, encerrar-trilha, supervisao, mentorado-actions, pessoas-dialogs×2, pessoa-actions, enviar-termos, evento-cronograma, **registros-filtros** |
| `sm:max-w-xl` | conteúdo rico: agenda-calendario, encontro-detalhe, jovem-avaliacoes, formulario-preview, perfil-form×~5 |
| `sm:max-w-2xl` | importar-csv, jornada-rever, instrumentos-dupla |
| `sm:max-w-6xl` | **importar-registros** (`:439`) — prévia tabular, outlier real |
| default `sm:max-w-sm` | capacidade-mentor + todos sem override |

Redundâncias confirmadas: `evento-cronograma-dialog.tsx:72`,
`jornada-rever.tsx:54`, `instrumentos-dupla.tsx:213` redeclaram
`max-h-[85-90dvh] overflow-y-auto` que a base já fornece
(`max-h-[calc(100dvh-2rem)]` + `overflow-y-auto`).

## Sintomas

- **Fundo maior que o conteúdo**: dialogs `sm:max-w-lg`/`xl` cujo corpo é
  só texto+poucos campos (ex.: `registros-filtros` com fieldsets de
  pílulas; `pessoas-dialogs` em lg) — overlay largo com ar vazio.
- **Inconsistência**: confirmações em `lg`, formulários simples em `md`,
  previews em `xl` — sem escala semântica.
- **Duplo scroll**: overrides de `max-h` competem com o da base.

## Proposta em uma linha

Escala semântica de 4 larguras (`sm` confirmação curta / `md` form padrão /
`lg` form com 2 colunas ou lista / `xl` rich content / `2xl`+ só para
prévias tabulares) + remoção dos overrides redundantes + padding `p-4`
uniforme (a base já garante).

## Decisão

Tier A, UI pura. `design.md` carrega a escala e os critérios; `plan.md`
o roteiro do sweep arquivo a arquivo.
