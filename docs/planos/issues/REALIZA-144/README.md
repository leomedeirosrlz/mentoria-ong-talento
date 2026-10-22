# REALIZA-144 — Forms por seções: modo wizard com paginação, progresso e transições

[Jira REALIZA-144](https://realizavc.atlassian.net/browse/REALIZA-144)

**Status: PARCIAL** — `secao` existe como divisor/estrutura (migration
`0080`, `agrupaEmSecoes` em `src/lib/forms/instrumentos.ts`), mas **não
há paginação**: o renderer público e os instrumentos são uma página única
rolável com pill de progresso. Este plano entrega o modo wizard restante.

## Já existe (não refazer)

- `secao` como campo estrutural (não-resposta) com label — verificado em
  `src/app/f/[token]/formulario-publico.tsx` e `InstrumentoFlow`.
- `agrupaEmSecoes(campos)` — reparte campos por seção, primeiro bloco sem
  seção vira grupo `secao:null`.
- Validação por campo + scroll/focus no primeiro erro (sprint forms UX v1);
  `AnimatePresence`+`fade`+`T` do vocabulário de motion; pill sticky de
  progresso; honeypot.
- Instrumentos sob-medida (`visao`/`metas`/`pdm`/`roda_vida`) já agrupam
  em capítulos internamente — a paginação deles é decisão separada
  (ver escopo).

## Restante (escopo deste plano)

O issue manda **instrumentos de jornada primeiro** ("cara de site, em
seções/etapas com progresso visível e transições animadas, tipo o wizard
de onboarding do jovem"):

1. Modo wizard **nos instrumentos sob-medida** (`InstrumentoFlow` +
   `metas`/`pdm`/`visao`/`roda_vida`): capítulos internos (já derivados
   por `agrupaEmSecoes`/`extraiEstruturaRoda`/`extraiGruposMeta`) viram
   etapas — "Etapa 2 de 5", Avançar/Voltar, validação por etapa,
   transição animada, foco no heading. Roda da vida: quadrantes viram
   etapas.
2. **Genérico** (`formulario-publico.tsx`) coberto pela mesma derivação:
   form com `secao` vira wizard; sem `secao` segue página única. Escopo
   explícito do issue é instrumentos primeiro — o genérico entra junto
   porque a mecânica é a mesma, mas se o diff pesar, pode sair como PR
   separado sem bloquear o issue.
3. Rascunho/refresh: form é uso único e **não** persiste respostas no
   servidor antes do submit — wizard não muda isso; refresh perde o
   rascunho (decisão explícita, ver plan).

## Dependências

- **Depois de REALIZA-36** (mexe nos mesmos arquivos — `formulario-publico.tsx`,
  `use-resposta.ts`): sequenciar PRs.
- Relacionado: REALIZA-69/70 (intake de ~26 campos fica utilizável via
  wizard), REALIZA-49 (nada compartilha).

## Esforço estimado: **M**

Maioria client-side: estado de passo, validação por etapa, animação,
a11y. Sem schema/RPC.

## Riscos

- Estado `valores` precisa sobreviver à troca de passo — etapas montadas
  com `hidden` (precedente `RegistroForm` wizard, BACKLOG) preserva
  FormData/rascunho.
- Progresso por etapa × "N de M respondidas" — dois contadores podem
  confundir; resolvido no design (pill vira "Etapa X de N").
- Os instrumentos têm renderers compostos (roda interativa, metas com
  ficha por N) — paginar capítulos preservando essas experiências é o
  risco real; a validação por etapa precisa mapear erro → etapa do campo.

## Documentos

- `plan.md` · `design.md` · `sdr.md` (link público + menores) ·
  `acceptance.md` · `sdd.md` (leve — sem migration).
