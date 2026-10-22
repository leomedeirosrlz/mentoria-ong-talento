# REALIZA-172 — plano (7 débitos independentes)

Cada item é um passo isolado — podem ir num PR único de "faxina" ou em PRs
separados; nenhum depende de outro.

## 1. `atribuido_nome` morto no portal do jovem — **decidir e executar**

O ramo jovem de `getChamados` (`src/lib/queries-chamados.ts:~80-97`) popula
`atribuido_nome` mas `JovemChamados` não renderiza.

**Recomendação**: renderizar — informação útil e sem risco (o jovem já se
relaciona com a equipe por nome). No card do chamado aberto em
`src/components/jovem-chamados.tsx`, linha secundária:
`Responsável: {primeiroNome(atribuido_nome)}` quando `atribuido_nome` e
status ≠ resolvido. Alternativa mínima (se a decisão for esconder): parar de
resolver nomes no ramo jovem — remove o fetch batched de `profiles`
(`:84-88`) quando `papel === "mentorado"`. Não manter os dois (dado morto
carregado = custo + confusão).

## 2. `getCicloEventos` morto na agenda do jovem — **remover, não trocar de fonte**

`src/app/(jovem)/jovem/agenda/page.tsx`:

- Remover `getCicloEventos` do `Promise.all` (`:86-97`) e o import (`:54`).
- `oficialPorNumero` (`:136-144`) morre junto — RLS zera `eventos` pra
  mentorado (comentário `:129-132` já admite). `numerosLivres` (`:146-153`)
  perde só o hint `data`; o `Select` continua listando o nº (a RPC mede o
  teto real — `:131-132`).
- **Não** repontar pra `getJovemJornada().cronograma`: a agenda já tem 8
  queries; adicionar uma 9ª pra um hint de data em `<option>` é custo sem
  ganho. Se o Thiago quiser a data oficial no select, `jovem_jornada`
  (RPC 0096) tem `cronograma[]` com `tipo/numero/data` — mas fica como
  melhoria futura, fora deste débito.
- Atualizar o comentário `:128-132` removendo a referência a `ciclo_eventos`.

## 3. Agenda sem CTA de encerramento — **motivo novo em "Para acompanhar"**

Hoje `encerramentos` pendente não vira ação em lugar nenhum. Superfície
correta: `src/lib/agenda-coordenacao.ts` — motivo novo em
`paraAcompanhar`/`linhas`: **"encerramento pendente"** quando
`dupla.status === 'concluida'` e existe `encerramentos` row `pendente`
pra dupla (o rito vive na ficha — `EncerramentoDupla`). CTA = link pra
`/duplas/[id]` (a ficha já carrega o checklist completo — não duplicar na
agenda). Microcopy: `"Rito de encerramento pendente — concluir na ficha"`.

Espelho pro mentor: `a verificar` se `agenda-minha`/`agenda-por-mentorado`
já sinalizam dupla concluída aguardando encerramento; se não, badge
"Encerramento pendente" na linha da dupla com o mesmo link.
Demo: dataset precisa de uma dupla `concluida` com `encerramentos` pendente
pra o caso ser visível (a verificar se já existe).

## 4. `/assinar/[token]` sem faixa demo — **adicionar a faixa**

`src/app/assinar/[token]/page.tsx` é rota pública por token; no modo demo
(`demoRole()` → stub `assinatura_por_token`) nada indica simulação. Adicionar
a mesma faixa padrão de página pública — **a verificar** o componente
canônico (`DemoBar`? faixa inline? ver `src/app/t/[token]/page.tsx` e
`src/app/f/[token]/page.tsx` — se eles têm faixa, copiar o padrão; se não
têm, criar inline mínimo: `bg-[var(--warn)]/10 text-[var(--warn-text)]`
"Demonstração — nada aqui é assinado de verdade"). Local: topo da página,
antes do `EstadoCard`/form.

## 5. Dataset demo sem `outra_pessoa` — **cenário novo no stub**

`src/lib/demo/queries.ts:1938` — `assinatura_por_token` demo sempre `'anon'`.
Para exercitar `src/app/assinar/[token]/page.tsx:169`, o stub precisa de um
token cuja identidade resolva "logado ≠ quem assina":

- Quando `demoRole()` retorna um papel **logado** (ex.: `mentorado`/`coordenacao`)
  e o token pede responsável, devolver `{ identidade: "outra_pessoa", … }`.
- Ou (mais explícito e sem acoplar a cookie): um token-fixture dedicado no
  `demo/` data que sempre resolve `outra_pessoa` — documentado como "token
  de teste do ramo outra_pessoa".
- Decisão a documentar no PR; e2e demo cobrindo o card "Este link é para
  outra pessoa".

## 6. Edição de evento esp apaga `cronograma_id` — **verificar primeiro**

Caminho confirmado-OK: `EventoCronogramaDialog` → `salvarEventoCronograma`
com `cronograma_id: cronograma.id` (`cronograma-editor.tsx:704-715`,
`actions-cronogramas.ts:294-358`).

Verificar:
- `salvarEventoCronograma` no branch update: o `.update()` lista quais
  campos? Se faz `upsert`/update com payload que omite ou zera
  `cronograma_id` — bug confirmado.
- `especialista_eventos` (catálogo de 5 passos, PK numero): tem algum editor
  admin que reescreve `ciclo_eventos` a partir dele? grep em
  `src/lib/actions-especialista.ts` mostra comentário sobre turma→cronograma
  (`:372`) — ler a função que consome isso.
- `evento-cronograma-dialog.tsx` — o `rascunho` pode carregar `cronograma_id`
  implícito que sobrescreve o do input?

Se confirmado: fix = incluir/preservar `cronograma_id` no update + teste de
regressão (`vitest` na função pura ou e2e no editor). Se **não** confirmado:
registrar "não reproduzido — verificado em `salvarEventoCronograma` e
`cronograma-editor`" e fechar o item.

## 7. Card "expirado" de terceiros inalcançável — **verificar a RPC**

O card existe e está correto (`src/app/t/[token]/page.tsx:100-115`). A
pergunta é se `terceiro_por_token` (RPC, `src/lib/terceiros/queries.ts:149-165`)
pode devolver `status: "expirado"`. O comentário em
`src/app/(app)/duplas/[id]/terceiros-dupla.tsx:90-95` diz que expiração é
**lazy** ("só vira 'expirado' quando o link é tocado") — o "tocar" é
exatamente essa RPC.

Verificar `pg_get_functiondef('terceiro_por_token')` no staging:
- Se a função faz `UPDATE … SET status='expirado' WHERE status='pendente'
  AND expira_em < now()` antes de ler → card alcançável, fechar o item.
- Se a função só lê o status cru e nunca expira → bug confirmado: fix na RPC
  (flip lazy dentro dela) OU no retorno — preferir o flip na função
  (consistência com o comentário lazy); migration `[NOVO]` se DDL mudar.

## Gates

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · e2e demo (agenda
jovem, /assinar token, /t token) + e2e app onde aplicável.
