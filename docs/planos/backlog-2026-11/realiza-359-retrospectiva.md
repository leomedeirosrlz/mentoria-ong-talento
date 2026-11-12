# REALIZA-359 — Retrospectiva da jornada no encontro 16

Issue: `jornada`, `dpp`, `ux`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

A dupla que chega ao 16º encontro ganha uma **retrospectiva**: a jornada
montada num só lugar — registros, combinados, Roda inicial × formal, PDM e
a revisitação do checklist de competências do mentor (doc P020 do guia) —
visível pro mentor e pro mentorado.

Existe (`recon` verificado):

- **`ResumoJornadaSection`** (`src/components/resumo-jornada.tsx`) — bloco
  print-friendly da ficha: nomes, trilha, início/fim, encontros n/total vs.
  esperados, média 1–4 das avaliações de registro, últimos 3 registros,
  combinados feitos/total, metas PDM atingidas. Derivação única em
  `dadosResumoJornada` (`src/lib/encerramento.ts:121-183`) + snapshot
  textual `textoResumoJornada` (:198-236) gravado em
  `encerramentos.resumo_jornada` (`types.ts:914`).
- **Fechamento orquestrado** — `EncerramentoDupla`
  (`src/components/encerramento-dupla.tsx`): checklist da coordenação
  (`CHECKLIST_ENCERRAMENTO`, `encerramento.ts:32-53`) com celebração,
  feedback mútuo, revisão PDM+Roda e 360º (auto-marcada quando a resposta
  chega); row criada no último encontro pela 0102; `fechamentoEmFoco` na
  ficha (`duplas/[id]/page.tsx:525-533`).
- **Avaliações finais** — dois instrumentos de sistema
  (`avaliacao_final_mentor` + `avaliacao_final_mentorado`, migration 0130)
  por link tokenizado.
- **Checklist de competências** — hoje é **documento nativo**
  (`src/lib/materiais-documentos.ts:135-137`, corpus
  `docs/rag/checklist-competencias.md`): as 10 competências do mentor,
  "marcar antes do ciclo e revisitar no fechamento". Não é instrumento
  respondível — não existe resposta gravada.
- **Roda inicial × formal** — dados e momentos prontos (REALIZA-18: a
  sobreposição `RodaComparada` é dependency desta spec).

Gap: não existe artefato que **monte** tudo isso pra mentor e mentorado; o
resumo é um relatório de números pra staff, o checklist de competências
não tem estado respondido, e o jovem não tem nenhuma superfície de
retrospectiva em `/jovem`.

## Decisões

1. **Forma: tela in-app, não documento gerado.** A retrospectiva é uma
   seção dedicada — estende `ResumoJornada`, não o substitui (o resumo
   segue o relatório compacto print-friendly; a retrospectiva é a
   narrativa visual da jornada). Duas superfícies:
   - **Ficha da dupla** (`/duplas/[id]`) — nova `RetrospectivaJornada` no
     bloco de fechamento (onde `ResumoJornadaSection` renderiza hoje,
     `page.tsx:1100` e `:1214`), visível a mentor, supervisor e coord.
   - **`/jovem`** — card "Sua jornada" na trilha/home do jovem (mesma
     derivação, recorte da perspectiva dele — ver item 5).
2. **Conteúdo (ordem da narrativa):** cabeçalho da dupla (nomes, trilha,
   início→fim) → linha do tempo dos encontros (número, data, tema do
   registro, avaliação do mentor — todos os realizados, não só 3) →
   combinados feitos/total → **Roda inicial × formal** (`RodaComparada` da
   -18; se só inicial existe, aplicação única) → PDM (metas atingidas com
   datas, `pdm` já no `ResumoJornada`) → trechos de registros (últimos
   temas/reflexões) → **checklist de competências revisitado** (só na
   visão do mentor/staff).
3. **Checklist de competências vira instrumento respondível.** Novo
   `sistema='competencias_mentor'` no forms engine: 10 itens do guia
   (documento `checklist-competencias`) + campo livre "o que quero
   desenvolver", emitido por link `emitir_link_instrumento` com
   `contexto.momento` **`inicio`** (formação da dupla) e **`final`**
   (encerramento) — mesmo padrão das duas aplicações da Roda (whitelist da
   0096 já aceita `momento`; confirmar vocabulário do contexto). Na
   retrospectiva, as duas marcações lado a lado = a revisitação que o
   P020 pede. Render sob medida simples (lista de 10 itens + textarea) —
   não precisa de componente interativo novo; `RespostaLista` pode
   bastar para o resultado.
4. **Disparo: 16º encontro registrado como `realizado`** — mesmo evento
   que auto-conclui a dupla (0102) e cria a row de `encerramentos`. A
   retrospectiva **desbloqueia** nesse ponto (banner/aba) e permanece
   legível após o fechamento. Trilha especialista (sem encontro 16):
   desbloqueia quando `dupla.status ∈ (concluida, encerrada)` ou o marco
   de 3 meses passou (`prazoTrilhaEspecialista`).
5. **Visibilidade por papel** (recortes do mesmo derivado):
   - **mentor**: retrospectiva completa, incl. seu checklist de
     competências inicio×final;
   - **mentorado** (`/jovem`): a jornada compartilhada — encontros,
     combinados, sua Roda antes×depois, PDM — **sem** o checklist do
     mentor (desenvolvimento do mentor, não do jovem), sem `pedir_apoio`,
     sem notas internas de registro (`observacoes` é do mentor/staff);
   - **supervisor da dupla e coordenação**: completo (incl. checklist do
     mentor — supervisão do desenvolvimento dele);
   - **demais papéis**: nada — mesma régua das entregas via
     `instrumentos_da_dupla`/`jovem_jornada`.
6. **Estabilidade do artefato:** a retrospectiva deriva dos dados vivos
   até o fechamento; `encerramentos.resumo_jornada` (texto, 0102+) segue
   o snapshot imutável do fechamento. Depois de decidido o rito, a tela
   é somente-leitura — nenhum write acontece por ela (o checklist de
   competências `final` fecha no envio, não na tela).

## Schema

**Migration `0190_competencias_mentor.sql`** (número reservado do lote):

- `INSERT` em `formularios`: `sistema='competencias_mentor'`,
  `ativo=true`, `sistema=true`, título "Checklist de competências do
  mentor"; `INSERT` de `formulario_campos`: as 10 competências
  (vocabulário verbatim de `docs/rag/checklist-competencias.md`), tipo
  `escala_1_10` **ou** `sim_nao` — decidir pelo texto do guia (a marcação
  do guia é "marco as que quero desenvolver" → candidata `checkbox`
  multi ou `escala` de autopercepção; travar no kickoff com o corpus) +
  `textarea` livre.
- `emitir_link_instrumento`: garantir `momento` no whitelist para
  `inicio`/`final` (já aceito pela 0096 — confirmar valores exatos; se o
  enum de momento só tiver `inicial|formal`, reutilizá-los em vez de
  criar vocabulário paralelo).
- `jovem_jornada`/`painel_instrumentos_jornada`: fora do painel do jovem
  (o instrumento é do mentor) — verificar que o painel não o lista como
  estação do jovem; dest é `mentor_id`.
- RLS: nenhuma policy nova — leitura segue `formulario_links`/`respostas`
  das entregas (mentor lê as suas; staff via `instrumentos_da_dupla`).

Se `emitir_link_instrumento` não distinguir destinatário mentor, incluir o
ajuste na mesma 0190 (link para `dest_mentor_id`).

## Domínio (src/lib/)

- `src/lib/encerramento.ts`: `dadosRetrospectiva(dupla, entregas,
  pdmResumo)` — compõe `ResumoJornada` + timeline completa de registros +
  par de rodas (`entregasDoMomento`) + par de checklists do mentor
  (inicio×final). Pura, testável, reusa `dadosResumoJornada` por dentro.
- `src/lib/jornada.ts`: reusar `entregasDoMomento` para a roda; generalizar
  o bucket de momento para `competencias_mentor` (hoje a regra "primeira
  sem marca = inicial" é específica de roda — extrair ou estender).
- `textoResumoJornada`: opcional — acrescentar linha "Checklist de
  competências revisitado" no snapshot quando as duas marcações existirem
  (snapshot continua texto derivado, nunca livre).

## UI

- `src/components/retrospectiva-jornada.tsx` (novo): seções na ordem do
  item 2; reusa `RodaComparada` (-18), `ImprimirButton`, a gramática
  visual do `ResumoJornadaSection`; motion `.animate-enter` por seção.
- `src/app/(app)/duplas/[id]/page.tsx`: renderiza quando
  `fechamentoEmFoco || retrospectivaDesbloqueada` (16º realizado /
  status fechado / marco especialista).
- `src/app/(jovem)/jovem/page.tsx` (ou materiais): card retrospectiva do
  jovem — recorte sem checklist do mentor e sem campos internos.
- `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx`: entregas
  `competencias_mentor` entram na aba instrumentos como as demais
  (ícone próprio em `instrumento-icone.tsx`).
- Emissão do link `final`: na `EncerramentoDupla`, ação "enviar checklist
  de revisitação" junto aos links 360º existentes (mesmo padrão de
  `EnviarFormularioDialog`).

## Seed + demo

- `src/lib/demo/data.ts`: uma dupla DPP no fim do ciclo com as duas rodas,
  PDM com metas atingidas, registros completos e checklist de
  competências marcado nos dois momentos — a retrospectiva demo precisa
  mostrar o estado completo.
- seed/e2e: form `competencias_mentor` criado pela 0190; fixture de dupla
  com 16 realizado + links emitidos.

## Testes

- vitest `encerramento.test.ts`: `dadosRetrospectiva` — timeline ordenada,
  par de rodas por momento, par de checklist, recorte por papel (mentor
  sem campos do jovem; jovem sem checklist nem `observacoes`).
- e2e:
  - 16º encontro → `realizado` → retrospectiva desbloqueia na ficha
    (mentor) e em `/jovem` (mentorado);
  - jovem não vê checklist do mentor nem `observacoes` de registro;
  - checklist `final` enviado → entregas lado a lado na retrospectiva;
  - fechamento decidido → tela somente-leitura;
  - snapshot `resumo_jornada` não muda quando dados posteriores mudam.

## Critérios de aceite

- [ ] Com o 16º encontro `realizado`, mentor e mentorado veem a
  retrospectiva nas suas superfícies, sem ação da coordenação.
- [ ] A retrospectiva monta: timeline de registros, combinados, Roda
  inicial×formal (quando existir), PDM e checklist de competências
  inicio×final (mentor/staff).
- [ ] O jovem nunca vê o checklist do mentor, `pedir_apoio` ou
  `observacoes` de registro.
- [ ] `competencias_mentor` responde por link tokenizado nos momentos
  `inicio` e `final`; entregas aparecem na aba instrumentos da ficha.
- [ ] Dados faltantes degradam com elegância (seção ausente, nunca erro):
  sem roda formal → aplicação única; sem PDM → seção some.
- [ ] `npx tsc --noEmit`, `npx eslint src/` limpos; migration aplicada no
  staging antes do push.

## Fora de escopo

- Mudar o rito de encerramento (checklist/desfecho/ritual da coord).
- Edição da retrospectiva (é derivada, não campo livre) e export PDF
  dedicado (o print do resumo já existe).
- Retrospectiva comparativa entre duplas ou de coorte.
- Notificações/WhatsApp automáticos de "sua retrospectiva está pronta"
  (fase 2; o disparo é só o desbloqueio).
