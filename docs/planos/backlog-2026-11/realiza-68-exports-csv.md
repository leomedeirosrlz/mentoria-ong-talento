# REALIZA-68 — Exports CSV: encontros (alias), atividades, matching, presenças

Issue: `export`,`relatorios`,`coordenacao`. Fonte: `docs/planos/issues/REALIZA-68/{README,plan,acceptance}.md` + `docs/planos/relatorios-inteligencia.md` §1b. Status: a fazer.

## O que exige vs. o que existe

`src/app/api/export/route.ts` (881 linhas) já tem o padrão consolidado: 4 tipos (`ciclo`, `pessoas`, `assinaturas`, `respostas`), gate coord-only (`:137`), ramo demo com paridade (`:36-117`), `?turma=`/`?cronograma=` via `filtraCsvCiclo` (`:193`), `;`+BOM+aspas em tudo + `celula()` anti formula-injection (`:836`), CRLF, filename datado.

O Jira pede 3 tipos novos + 1 alias — e o escopo se encosta na frente REALIZA-178:

| `tipo=` | O que é | Estado |
|---|---|---|
| `encontros` | **Alias puro de `ciclo`** — a prestação de contas já é uma linha por encontro (`csvCiclo` :504). | dispatch normaliza `encontros→ciclo`; zero código novo |
| `atividades` | Uma linha por atividade registrada — explode `registros.atividades[]` + `atividade_outro`. | novo |
| `matching` | Uma linha por pessoa disponível pra pareamento, com os campos de matching (0034/0038/0073). | novo |
| `presencas` | Uma linha por (evento `formacao` × profile marcado) — a chamada (0040) + `formacao_ok`. | novo — **esta spec é a dona do tipo**; a frente -178 (`realiza-178-relatorios-f0f1.md`) referencia, não implementa |

**Overlap resolvido:** `presencas` aparecia no catálogo f0 da doc-mestre (-178) E no escopo desta issue — fica aqui (dono único, já detalhado nos docs da -68). `supervisoes` da doc-mestre está morto (tabela dropada em 0155) — nenhuma das duas specs o cobre.

Correções do plano original ao schema real (verificadas em `database.types.ts`):

- `ciclo_eventos` **não tem** coluna `turma` (Row `:808-822` — tem `cronograma_id`); o filtro `?turma=` de `presencas` resolve via `cronograma_id → cronogramas.turma`, mesmo mapa do `filtraCsvCiclo`/`turmaDaDupla`. `?cronograma=` filtra `ciclo_eventos.cronograma_id` direto.
- `turma_inscricoes` **já existe** (0110; Row `:4995` — `profile_id|mentorado_id`, `papel_esperado`, `status`, `turma`): a coluna `fila_turmas` do `matching` e o `?turma=` por inscrição entram de verdade, não como condicional.
- `mentorados.situacao` CHECK é `('ativo','desistente','concluido')` (0077) — "elegível" = `situacao='ativo'` + sem `saiu_em` + sem dupla ativa.
- `disponibilidade` jsonb é `{celulas:[{dia,periodo}]}` canônica (0100) com forma legada tolerada — serialização via `celulasDe` + `DIAS_SEMANA_CURTOS` (`ciclo.ts:446,:379`).

## Decisões

1. **Tudo dentro de `route.ts`** — mesma estrutura do arquivo (fetcher `exportX` + `csvX` pura + ramo demo). Não cria `src/lib/relatorios/` aqui: quando a -178 aterrissar com o dir compartilhado, os `csvX` desta spec migram junto numa consolidação única (a -178 já declara a regra).
2. **`matching` exporta o universo todo com `em_dupla` marcado** — mentores por papel efetivo (união `role` ∪ `profile_papeis`, mesma régua do `tipoPessoa` :558) `ativo=true` + mentorados `situacao='ativo'`; o recorte "disponível" é do leitor da planilha. Alternativa rejeitada: só os livres — perde a visão de pool que o board `/matching` dá.
3. **Sensíveis pelo mesmo funil de `exportPessoas`** — `pref_genero_par`/`motivacao`/`experiencia_previa`/`formacao_externa`/`data_nascimento` vêm das views `profiles_pessoal`/`mentorados_pessoal` (coord-only por WHERE + grant de coluna revogado da base, 0026/0034); `form_bruto`/`dados_civis`/`documentos_pessoa` **nunca** — arquivo morto, não campo de relatório.
4. **`presencas` sem linha sintética de falta** — ausência de row = "não marcado", não "faltou" (a regra "evento passou sem chamada" é derivação de UI; exportar "faltou" inventaria dado). `formacao_ok` só preenche pra quem tem `mentor_profiles`.
5. **`atividades` explode por registro** — `atividades[]` → 1 linha cada com `origem=catalogo`, `atividade_outro` → 1 linha `origem=outro`; ~2k linhas no ciclo é trivial pra CSV. Encontro sem registro → zero linhas (não gera "sem atividade").
6. **Filename por tipo** `<tipo>-AAAA-MM-DD.csv` (mesmo `toDateStr`); o alias `encontros` herda o nome do `ciclo` (`encontros-AAAA-MM.csv` — mês, padrão já estabelecido).

## Schema

Nenhuma.

## Domínio (`src/lib/` + route)

- Dispatch (`route.ts:31-32`): `let tipo = get("tipo"); if (tipo === "encontros") tipo = "ciclo";` + ramos `atividades`/`matching`/`presencas` no real e no demo; header comment `:28-30` atualizado com o catálogo e o alias documentado.
- `exportAtividades`: query `duplas(trilha,turma,cronograma_id,mentor:(nome),mentorado:(nome),encontros(numero,realizado_em,status,registro:registros(atividades,atividade_outro,created_at,avaliacao)))` — só encontros **com** registro; `filtraCsvCiclo` aplica `?turma=`/`?cronograma=` antes de explodir.
  - header: `turma;cronograma;trilha;dupla_mentor;dupla_mentorado;encontro_num;realizado_em;atividade;origem;registro_avaliacao`
  - `origem`: `catalogo` (∈ `ATIVIDADES_ENCONTRO`, ciclo.ts:102) | `outro` (`atividade_outro` — passa por `celula()`, anti-fórmula cobre); `avaliacao` por `AVALIACAO_LABEL`.
- `exportMatching`: `profiles` com `role in (mentor_dpp, mentor_especialista)` OU papel em `profile_papeis` (`!inner` dedupe por id, molde `actions-email.ts:87-96`), `ativo=true` + `mentorados situacao='ativo'` + merge `mentor_profiles` (tipo, capacidades, disponibilidade, experiencia_previa, formacao_externa, formacao_ok) + `profiles_contato` (email/whatsapp — mesmo merge por id do `exportPessoas`) + `*_pessoal` (sensíveis) + `turma_inscricoes status='aguardando'` (fila).
  - header: `nome;tipo_pessoa;trilhas;email;whatsapp;cidade_uf;capacidade_dpp;capacidade_esp;experiencia_previa;formacao_externa;disponibilidade;pref_genero_par;motivacao;em_dupla;fila_turmas`
  - `trilhas`: união de papéis efetivos de mentoria ("Mentor DPP + Mentor especialista" pro híbrido — mesma `tipoPessoa`); `capacidade_dpp`/`capacidade_esp` preenchem só quando `mentor_profiles` existe.
  - `disponibilidade`: `celulasDe()` → "seg noite | ter manhã" (`DIAS_SEMANA_CURTOS` + rótulo de período curto); `null` → "".
  - `em_dupla`: `sim|não` — dupla `status='ativa'` na trilha correspondente (mentor híbrido marca por trilha: tem dupla DPP e livre ESP → `parcial`? **não** — coluna única `em_dupla=sim` se qualquer dupla ativa; a trilha livre já se lê pelas `trilhas`/`capacidade_esp` — decisão: flag simples, o board fica pro detalhe fino).
  - `fila_turmas`: turmas onde a pessoa tem `turma_inscricoes.status='aguardando'` (`"T2 · 2026/2027 | T3"`); `?turma=` filtra **por inscrição** (a pessoa está na fila daquela turma) — efeito duplo: recorta e preenche.
- `exportPresencas`: `ciclo_eventos(id,titulo,data,tipo,cronograma_id)` `tipo='formacao'` + `presencas(profile_id,presente,marcado_em)` + `profiles(nome,role)` + `mentor_profiles(formacao_ok)`; nomes de cronograma/turma via mapa (mesmo fetch de `cronogramas` do ciclo).
  - header: `evento;data;turma;cronograma;nome;papel;presente;marcado_em;formacao_ok`
  - grão: (evento, profile marcado) — sem row → não exporta; `?turma=` casa pela turma do cronograma do evento; `?cronograma=` por `cronograma_id`.
- `csvEncontros`: é `csvCiclo` — o alias não duplica função.

## UI

Nenhuma tela nova. Onde a UI já linka export (`/relatorios` toolbar "Baixar CSV" do builder é client-side, outro formato — não tocar; o card de export que existir aponta pro tipo correspondente — verificar se há entry point de `/api/export?tipo=` hoje: os tipos novos são endereçáveis por URL e pelo hub da -178).

## Seed + demo

- Ramo demo por tipo (route `:36-117`): dataset cobre — registros com `atividades`/`atividade_outro` (`demo/data.ts`), `presencas` (:3657), `turma_inscricoes` (ids 68xx :158), `mentor_profiles`/`mentorados`/`profiles`/`profile_papeis`. Tipo sem dado demo coberto → CSV header-only (consistente, nunca 500).
- Sem mudança de `seed.sql`.

## Testes

- **vitest**: `csvAtividades` (explode catálogo+outro, origem correta, `atividade_outro` com `=` sai escapado, registro sem atividade → zero linhas); `csvMatching` (híbrido trilhas/capacidades, `em_dupla`, `disponibilidade` serializada, `fila_turmas` com 2 turmas); `csvPresencas` (grão evento×profile, `formacao_ok` só mentor, evento sem chamada → sem linha); alias `encontros→ciclo` produz CSV idêntico.
- **e2e** (`tests/e2e/app`): cada tipo → 200 `text/csv` + BOM + header esperado; `?turma=` recorta; mentor/supervisor → 403 (o gate é o mesmo — spec mínima, não re-testa implementação); turma sem evento `formacao` → 200 header-only.

## Critérios de aceite

- [ ] `GET /api/export?tipo=encontros` devolve **byte a byte** o mesmo CSV de `?tipo=ciclo` (header + linhas).
- [ ] Os 3 tipos novos: `text/csv; charset=utf-8`, BOM `\uFEFF` primeiro char, `;`, CRLF, filename datado, todas as células por `celula()`.
- [ ] `tipo=atividades`: registro com `atividades=['Roda de conversa','Leitura']` + `atividade_outro` → 3 linhas (`origem` correto); encontro sem registro → zero linhas; `?turma=`/`?cronograma=` recortam.
- [ ] `tipo=matching`: só `role`/`papeis` de mentoria ativos + mentorados `situacao='ativo'`; `pref_genero_par`/`motivacao`/`experiencia_previa`/`formacao_externa` presentes; `form_bruto`/`dados_civis` ausentes; `fila_turmas` reflete `turma_inscricoes aguardando`; `?turma=` filtra por inscrição.
- [ ] `tipo=presencas`: grão (evento formacao × profile marcado) com `presente`/`marcado_em`; `formacao_ok` vazio pra não-mentor; `?turma=`/`?cronograma=` via cronograma do evento; evento sem chamada pra alguém → sem linha (não sintetiza "faltou").
- [ ] Coord-only inalterado (mesmo gate); paridade demo nos 4 tipos (coord demo → CSV real, sem 500).
- [ ] Header comment da rota lista catálogo completo + alias.
- [ ] `tsc --noEmit` + `eslint src/` limpos; sem migration → sem regen de types.

## Fora de escopo

- Os outros tipos da doc-mestre (`aderencia`, `assinaturas-pendentes`, `interacoes`, `solicitacoes`, `encerramento`, `forms-taxa`) — são da spec -178 f0f1; `supervisoes` está morto (0155).
- Filtros novos além de `?turma=`/`?cronograma=` (período, status) — o recorte da casa é por turma; refinamento fica pro hub/planilha.
- Extração de helpers pra `src/lib/relatorios/` — a -178 consolida; aqui fica file-local de propósito (diff mínimo).
- UI dedicada de export — endereçável por URL; o hub da -178 adiciona os botões.
