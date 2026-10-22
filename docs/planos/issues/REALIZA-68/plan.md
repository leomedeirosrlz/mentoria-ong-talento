# REALIZA-68 — plano de implementação

Descrição essencial: `GET /api/export` ganha `tipo=atividades`,
`tipo=matching`, `tipo=presencas` + alias `encontros`→`ciclo`. Mesmas
convenções (BOM, `;`, `celula()` anti-fórmula, CRLF, filename datado),
coord-only, filtros `?turma=`/`?cronograma=`, demo parity.

## Passo 0 — referências

- `src/app/api/export/route.ts` — dispatch (:30-178), `filtraCsvCiclo` (:183),
  `csvCiclo` (:463), `exportPessoas` (:196 — molde do merge
  `profiles_contato`), `celula`/`csvResponse` (:763+), ramo demo (:44-106).
- `presencas` schema (0040:16-25): `ciclo_evento_id`, `profile_id`,
  `presente`, `marcado_por`, `marcado_em`, unique par.
- Matching fields: `mentor_profiles` (`disponibilidade {celulas}`, `tipo`,
  `capacidade`, `capacidade_especialista`, `experiencia_previa`,
  `formacao_externa`), `mentorados.disponibilidade`, `*.motivacao`,
  `*.pref_genero_par` (sensíveis — `*_pessoal` coord-only, types.ts:128-186).
- `ATIVIDADES_ENCONTRO` (ciclo.ts:98) — catálogo; `registros.atividade_outro`
  é o texto livre.

## Passo 1 — dispatch

No `GET` (e no ramo demo), antes do dispatch atual:

```ts
if (tipo === "encontros") tipo = "ciclo";  // alias de nomenclatura
```

E novos ramos `atividades`/`matching`/`presencas` espelhando `exportX`.

## Passo 2 — `exportAtividades` [NOVO]

Query: `duplas(trilha,turma,cronograma_id,mentor:..(nome),mentorado:..(nome),
encontros(numero,realizado_em,status,registro:registros(atividades,
atividade_outro,created_at,avaliacao)))` — só encontros **com** registro.

Explode: `registro.atividades[]` → 1 linha cada; `atividade_outro` → 1 linha
`origem='outro'` quando presente.

```
header: turma;cronograma;trilha;dupla_mentor;dupla_mentorado;encontro_num;
        realizado_em;atividade;origem;registro_avaliacao
linha : T2 · 2026/2027;Cronograma 1;DPP;Ana;João;5;10/10/2026;
        Roda de conversa;catálogo;Boa
```

`origem`: `catálogo` (valor ∈ `ATIVIDADES_ENCONTRO`) | `outro` (texto livre
de `atividade_outro` — **passa por `celula()`**, anti-fórmula cobre).
`registro_avaliacao` rotulado por `AVALIACAO_LABEL` (já importado).
Filtros: `?turma=`/`?cronograma=` reusa `filtraCsvCiclo` (mesma estrutura de
duplas — generalizar o nome pra `filtraPorRecorte` se quiser, ou manter).
Filename: `atividades-YYYY-MM-DD.csv` (mesmo padrão `nomeCsvCiclo`).

## Passo 3 — `exportMatching` [NOVO]

Fonte: `profiles` com `role in ('mentor_dpp','mentor_especialista')` **ou**
papel em `profile_papeis` (união tipoPessoa — a função :517 já resolve;
"disponível pra parear" = **sem dupla ativa** nessa trilha + `ativo=true`)
+ `mentorados` `situacao='ativo'`(verificar o vocabulário real de
`situacao` — 'ativo'/'aguardando'? conferir o CHECK no schema no PR) sem
dupla ativa.

Merge: `mentor_profiles` por `profile_id` (tipo, capacidades,
disponibilidade, experiencia_previa, formacao_externa) + `profiles_contato`
pra email/whatsapp (mesmo molde do exportPessoas — merge por id).

```
header: nome;tipo_pessoa;trilhas;email;whatsapp;cidade_uf;
        capacidade_dpp;capacidade_esp;experiencia_previa;formacao_externa;
        disponibilidade;pref_genero_par;motivacao;em_dupla
linha : Ana;Mentor DPP;DPP + Especialista;ana@…;;São Paulo/SP;2;1;
        "já fui monitora";"…";"seg noite | ter manhã";indiferente;
        "quero devolver";não
```

- `disponibilidade`: serializa `celulas[]` → "seg noite | ter manhã"
  (`DIA_LABEL`/`PERIODO_LABEL` se existirem em ciclo.ts — verificar o mapa de
  labels; senão `dia + ' ' + periodo`).
- `em_dupla`: `sim|não` — o filtro "disponível" é do leitor da planilha;
  exportar todos marca o estado (mais útil que omitir — a coord filtra).
- `pref_genero_par`/`motivacao`/`experiencia_previa`/`formacao_externa` são
  `*_pessoal` — coord-only por grant de coluna; o select passa pelo mesmo
  caminho do `exportPessoas` (join/merge — confirmar se `profiles` comum já
  traz ou se precisa da view `profiles_pessoal`/`mentorados_pessoal` —
  verificar como exportPessoas busca os sensíveis :199+ e copiar).
- Se `turma_inscricoes` (167) existir: coluna extra `fila_turmas` (turmas
  onde `aguardando`); sem a tabela, a coluna sai (feature-detect? **não** —
  depende da ordem de merge; se 167 ainda não foi, a coluna fica vazia/omite
  — decidir no PR conforme ordem real; documentado nos dois planos).
- `?turma=` aplica **só se** 167 existe (inscrição filtra); sem ela, o
  parâmetro é ignorado — documentar no header comment.

## Passo 4 — `exportPresencas` [NOVO]

Query: `ciclo_eventos(id,nome,data,tipo,turma)` tipo `'formacao'` +
`presencas(profile_id, presente, marcado_em)` + `profiles(id,nome,role)`
+ `mentor_profiles(formacao_ok)`.

Grain: **uma linha por (evento, profile marcado)** — chamada é o registro
da coord; ausência de row `presencas` pra alguém = "não marcado" (não
"faltou" — não exportar linha sintética; a regra "faltou = evento passou
sem presenca" é derivada no card da 56, não no CSV).

```
header: evento;data;turma;nome;papel;presente;marcado_em;formacao_ok
linha : Encontro de formação 3;05/10/2026;T2 · 2026/2027;Ana;Mentor DPP;sim;
        05/10/2026 20:14;não
```

- Filtro `?turma=` → `ciclo_eventos.turma`. `?cronograma=` não se aplica
  (eventos de formação não são por cronograma de dupla? — verificar: se
  `ciclo_eventos.cronograma_id` existir, aplicar também; checar coluna no PR).
- `formacao_ok` preenche só pra mentor (vazio pra outros papéis).
- Sem rows → CSV só com header (consistente).

## Passo 5 — demo

O ramo demo (:44-106) precisa de cada tipo novo: dataset em
`src/lib/demo/data.ts` (atividades de registros demo, presencas demo,
matching = pessoas demo sem dupla) → `csvAtividades(demo…)` etc. Sem isso o
export em demo quebra — paridade é regra do projeto.

## Passo 6 — gates

- `tsc`/`eslint` limpos; sem migration → sem regen/validador.
- Teste manual (ou spec e2e app `export.spec.ts` se existir — verificar):
  cada tipo novo retorna 200, `content-type` csv, BOM presente, primeira
  linha é o header esperado, `?turma=` recorta, mentor logado → 403/redirect
  (o gate do route já cobre — não re-testar o gate em si).
- Edge: texto livre `atividade_outro` começando com `=` → celula() prefixa
  `' ` (verificar o guard de fórmula real — já testado pelos existentes).

## Rollout / rollback

Código puro, merge normal. Rollback = revert (tipos novos somem, nada quebra).

## Questões em aberto

- `situacao` real de mentorados (vocabulário) e se `ciclo_eventos` tem
  `cronograma_id`/`turma` — conferir no schema antes do PR (os dois
  checks são `information_schema` rápidos).
- Coluna `fila_turmas` em `matching` — depende da ordem com a 167.
