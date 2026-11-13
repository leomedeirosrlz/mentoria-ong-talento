# REALIZA-39 — Pessoas agrupadas por turma, com status e papel contextual

Issue: `pessoas`, `coord`, `ux`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

A aba `/pessoas` passa a agrupar por **turma/ciclo** (não só por papel
global), com status claros por pessoa — `convidado`, `não acessou`,
`ativo`, `documentos pendentes`, `termo pendente`, `inativo` — papel
contextual (o que a pessoa faz **naquela** turma, não o `profiles.role`
global) e ações em lote.

Existe (`src/components/pessoas-listas.tsx`, 1544 linhas — recon
verificado):

- **Agrupamento por papel global** — `GRUPO_ORDEM`
  `equipe|supervisores|mentores|mentorados|sempapel` (:83-100),
  `grupoDePessoa` deriva de `Profile.role` (:105-111); o próprio
  agrupamento virou o filtro (`cat` via URL :222-230, select :447-472).
- **Sinais já coletados**: `pendenciasPessoa` (termo, formação,
  `!user_id` "não entrou", livre p/ dupla — :116-138),
  `pendenciasMentorado` (doc por idade — :142-158), `DocsPessoa`
  assinado/pendente (:64-68), badges de convite
  `user_id ? "convite enviado" : "não convidado"` (:1113-1117,
  :1466-1470), seção `inativas` (:369-371), `foraDoPrograma`
  (`situacao`), fila "Aguardando par" (:300-347), busca com debounce +
  persistência em `?busca`/`?cat` (:217-230).
- **Modelo de turma já no schema**: `duplas.turma` (label, migration
  0061), `cronograma.turma` (`types.ts:301`), **`turma_inscricoes`**
  (0111 — `turma`, `profile_id` XOR `mentorado_id`, `papel_esperado`
  `mentor|mentorado`, `status aguardando|formada|desistiu`,
  `types.ts:1187-1204`), `escopo_turma` nos grants de auxiliar
  (`auxiliar-escopo.ts:31,46-55`), `profile_papeis` (0085).

Gaps:

1. Ninguém é agrupado por turma — a lista ignora `duplas.turma`,
   `turma_inscricoes` e `escopo_turma`.
2. Os status exigidos existem como **dados** mas não como **vocabulary
   de badge**: hoje é texto solto ("convite enviado", "não convidado"),
   sem precedência nem chip unificado.
3. Papel exibido é o global (`papelLabelComposto` sobre `profiles.role`)
   — a pessoa que é DPP na T1 e especialista na T2 aparece com um papel
   só; staff sem `role` global mas com escopo na turma cai em
   "sempapel".
4. **"não acessou" não é derivável**: `onboarded_em` distingue "convite
   enviado" de "entrou", mas nada registra o último acesso — falta
   `last_sign_in_at` (auth) exposto de forma segura.
5. Sem ações em lote (convite/termo reenviados um a um por linha).

## Decisões

1. **Derivação de turma por pessoa — sem coluna nova.**
   `turmasDePessoa(p | m, mapas)` em `src/lib/` resolve as turmas de
   cada pessoa a partir de, por ordem de evidência:
   - `duplas` onde ela é `mentor_id`/`mentorado_id` → `duplas.turma`
     (papel contextual: "Mentor DPP"/"Mentor especialista" por
     `duplas.trilha`, "Mentorado(a)");
   - `turma_inscricoes` → `papel_esperado` ("Mentor — aguardando par",
     "Mentorado(a) — aguardando par" quando `status='aguardando'`;
     `formada`/`desistiu` seguem a regra da dupla/situação);
   - `escopo_turma` do grant auxiliar → "Auxiliar executivo" na turma;
   - sem vínculo de turma → seção **"Sem turma"** (equipe global,
     pré-cadastro, sempapel — coord-only).
   Pessoa em >1 turma aparece em **todas** (a turma é recorte de
   trabalho da coord, não partição exclusiva — multi-filição é real:
   mentor híbrido T1+T2).
2. **Agrupamento: turma vira eixo principal, papel vira o chip.**
   `?agrupar=turma|papel` — turma é o default novo (a issue pede), papel
   preservado como alternativa (o agrupamento-papel da rodada out/2026
   não morre, vira modo). Dentro da turma: subseção por papel
   contextual (mentorados, mentores, staff) + sort `nome|pendencias`
   inalterado. Labels de turma pelo vocabulário existente (`turmaLonga`
   — "Turma 1" por extenso em texto corrido).
3. **Vocabulário de status — `statusDePessoa` derivado, com
   precedência** (um badge primário + secundários quando coexistirem;
   "documentos pendentes" e "termo pendente" podem coexistir com
   "convidado"):

   | Ordem | Status | Derivação |
   |---|---|---|
   | 1 | `inativo` | `profile.ativo=false` ou `mentorado.situacao≠'ativo'` |
   | 2 | `convidado` | `user_id`/`profile_id` set + `onboarded_em` null (convite enviado, conta aguardando) |
   | 3 | `não acessou` | `onboarded_em` set + `ultimo_acesso_em` null/antigo (ver Schema — novo sinal) |
   | 4 | `termo pendente` | `!termoOk` de `pendenciasPessoa`/`pendenciasMentorado` (incl. link `assinaturas.pendente` vivo) |
   | 5 | `documentos pendentes` | `faltantes` civis não-vazio ou `documento_path` ausente quando exigido |
   | 6 | `ativo` | conta entrou, sem pendências (default) |

   `pendenciasPessoa`/`pendenciasMentorado` viram insumo de
   `statusDePessoa` — a régua de pendência é **a mesma** dos badges, não
   uma segunda lista.
4. **Papel contextual na linha:** chip por turma-membresia —
   `papelNaTurma(p, turma)`: "Mentor DPP", "Especialista",
   "Mentorado(a)", "Auxiliar executivo", "Aguardando par", "Equipe".
   Só quando a pessoa tem >1 papel contextual o card lista os dois —
   nunca o global cru quando ele diverge do papel na turma.
5. **Ações em lote (só `souCoord`):** checkbox por linha + barra sticky
   quando ≥1 selecionada: "Enviar convite" (reusa
   `enviarConvite`/`reenviarConvite` por id), "Reenviar termo"
   (assinaturas pendentes), "Copiar WhatsApp" — escopo restrito aos
   alvos elegíveis (convite só aplica a `!onboarded_em`; termo só a
   `termo pendente`). Server action `actionPessoasLote` recebe
   `{acao, ids[]}` e devolve `{ok, falhas:{id,error}[]}` — parcial
   honesto, nunca all-or-nothing. RLS inalterado (cada action por-id já
   tem gate `my_role()`); a action em lote **chama** as existentes, não
   cria bypass.
6. **`não acessou` precisa de um sinal que não existe** — ver Schema.
   Sem ele, o status 3 ficaria mentiroso; ele entra nessa entrega.
7. **Filtros existentes sobrevivem:** `?busca`, `?cat` (agora aceita
   também `turma:<slug>` quando `agrupar=turma`), "Fora do programa",
   "Aguardando par", sort — persistidos em URL como hoje.

## Schema

**Migration `0192_pessoas_acesso.sql`** (reservada do lote) — mínima:

- `profiles.ultimo_acesso_em timestamptz` + trigger/RPC que carimba no
  login (ou view `profiles_acesso` security definer lendo
  `auth.users.last_sign_in_at` — decidir na implementação qual expõe
  menos: a coluna replicada é mais simples de indexar/ler, a view evita
  duplicar dado de auth; preferência: **view definer** `profiles_acesso`
  coord-only, sem gravar nada).
- Grant/policy: leitura só `my_role()='coordenacao'` — último acesso é
  sinal operacional, não dado de diretório.

Se o kickoff mostrar que `escopo_turma` não cobre staff-na-turma
(p.ex. coord limitada), a mesma 0192 estende `turma_inscricoes` com
`papel_esperado` staff — **confirmar contra o schema real antes de
escrever o DDL**.

## Domínio (src/lib/)

- `src/lib/pessoas-status.ts` (novo, puro): `statusDePessoa`,
  `papelNaTurma`, `turmasDePessoa` — entrada = maps já carregados na
  página (duplas, inscricoes, escopo, assinaturas, faltantes, acesso);
  saída = `{turmas:[{turma,papel}], statusPrimario, statusSecundarios}`.
- `src/lib/queries.ts`: `getPessoas`/`getMentorados` — adicionar
  `turma_inscricoes` (select por turma do recorte) e `escopo_turma` dos
  grants aos props da página; `profiles_acesso` (coord) no mapa.
- `turma_inscricoes` leitura já existe parcial
  (`queries.ts:1399-1440` `InscricaoFilaTurma`) — ampliar ou reutilizar.

## UI

- `pessoas-listas.tsx`: modo `agrupar=turma` — cabeçalho de grupo =
  `turmaLonga` + count; chip de papel contextual na linha; badges de
  status do vocabulário único (substituir os textos soltos "convite
  enviado"/"não convidado"); barra de seleção em lote (sticky bottom,
  `animate-enter`); filtro `?agrupar` e `?cat=turma:<slug>` na URL.
- `src/lib/actions-pessoas.ts` (ou actions existente): `actionPessoasLote`
  — reusa `enviarConvite`, termo e waLink por id; retorno `{ok, falhas}`.
- Copy pt-BR; badges seguem a gramática de status do design system
  (cor semântica + texto, nunca só cor).

## Seed + demo

- `src/lib/demo/data.ts`: duas turmas (T1/T2) com sobreposição real —
  mentor híbrido nas duas, mentorado aguardando em T2 via
  `turma_inscricoes`, 1 pessoa `convidado`, 1 `não acessou`, 1 com
  termo pendente, 1 inativa — todos os status têm de aparecer na demo.
- fixtures e2e: lote convida 2 elegíveis + 1 inelegível → falha
  parcial reportada.

## Testes

- vitest `pessoas-status.test.ts`: precedência (inativo ganha de tudo;
  termo+docs coexistem; convidado→não acessou na virada do
  `ultimo_acesso_em`), `turmasDePessoa` (dupla + inscrição + escopo,
  multi-turma, sem turma), `papelNaTurma`.
- e2e/componente:
  - `?agrupar=turma` agrupa por turma; pessoa multi-turma aparece nas
    duas; "Sem turma" ao fim;
  - badges: convidado → não acessou → ativo conforme sinais mudam;
  - seleção em lote: convite em 2 perfis → `{ok, falhas}` honesto;
    não-coord não vê checkboxes nem a barra;
  - `?busca`/`?cat`/`?agrupar` persistem e sobrevivem a reload;
  - diretório não-coord: mesma lista sem badges operacionais (regra
    atual preservada).

## Critérios de aceite

- [ ] `/pessoas` agrupa por turma por default; `?agrupar=papel` restaura
  o modo anterior.
- [ ] Cada pessoa exibe o badge primário pela precedência e os
  secundários aplicáveis — os 6 status do vocabulário são os únicos
  usados.
- [ ] O papel exibido é o contextual da turma do grupo — híbrido DPP+esp
  em turmas diferentes aparece certo em cada uma.
- [ ] `não acessou` só aparece com o sinal de último acesso (0192);
  sem a migration, o badge não existe (não é fake).
- [ ] Ações em lote restritas à coord, aplicáveis só a alvos elegíveis,
  com relatório de falhas por item — sem bypass de RLS.
- [ ] `npx tsc --noEmit`, `npx eslint src/` limpos; vitest/e2e verdes.

## Fora de escopo

- CRUD de turmas (criar/renomear turma é outra issue — aqui turma é só
  eixo de leitura).
- Reordenar membros dentro de dupla nem mover pessoas entre turmas.
- Mudar regras de pendência (a régua é a já implementada — só vira
  vocabulário de status).
- Notificações automáticas por status ("avise quem não acessou").
