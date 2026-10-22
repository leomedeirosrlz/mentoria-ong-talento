# REALIZA-173 — `/materiais` coord: de catálogo-scroll a hub de cobertura

**Status: aberto.** A tela cresceu de "enviar links" pra "catálogo + links
automáticos por encontro" — a UX ficou no formato antigo: scroll longo,
copy redundante, sem resposta rápida pra "qual encontro está sem material?".

## O que existe hoje

- `src/app/(app)/materiais/page.tsx` — `getMateriais` + `getMe` +
  `getCicloEventos` em paralelo; filtra por `audiencia`; agrupa por
  `encontro_num`/`tipo`; `PainelJornada` renderiza só pra coord/supervisor.
- `src/components/material-actions.tsx` — upload/replace/remove arquivo
  (20 MB, allowlist PDF/PNG/JPG/WebP), editar (título/desc/tipo/audiencia/
  encontro/url), excluir, **envio manual por e-mail** (`EnviarEmailDialog`).
- `src/components/novo-material-dialog.tsx` — criar material.
- `src/components/painel-jornada.tsx` — matriz 7 estações × duplas por turma
  (densa, já é o modelo visual certo).
- Materiais privados via bucket privado + signed URL em `/api/material/[id]`;
  `material.path || material.url || "em breve"` é o estado legítimo.

## Proposta em uma linha

Trocar a lista plana longa por um **hub compacto por encontro** — uma linha/
chip por encontro (1-16) com **indicador de cobertura** (quantos materiais
da audiência estão lá) + um bloco "Transversais" (guias/modelos sem encontro)
— sem perder `MaterialActions`, `NovoMaterialDialog` nem `PainelJornada`.

## Decisão

Tier A, UI pura — sem schema/RPC. `design.md` é o documento principal;
`plan.md` cobre a execução.
