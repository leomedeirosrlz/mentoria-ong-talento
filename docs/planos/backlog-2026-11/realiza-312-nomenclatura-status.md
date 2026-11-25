# REALIZA-312 — Nomenclatura canônica de status das duplas

Issue: `ux`, `copy`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

Padronizar os nomes de situação da dupla em todas as telas. Hoje o mesmo
conceito aparece com palavras diferentes — e palavras diferentes cobrem
conceitos diferentes:

1. **`encerrada` renderizado como "Desistente"** — a conflação principal.
   - `src/components/duplas-lista.tsx:131` — `STATUS_LABEL.encerrada = "Desistente"`.
   - `src/components/dashboard-coordenacao.tsx:713` — `encerrada → "Desistente"`.
   - `src/app/(app)/pessoas/[id]/page.tsx:92` — `STATUS_DUPLA.encerrada = "desistente"`.
   - `src/lib/relatorio.ts:229` — `STATUS_LABEL.encerrada = "Desistente"` (export CSV/print).
   - `src/components/editar-dupla-dialog.tsx:50` — mapa de status `encerrada: "Desistente"`,
     mas o próprio Select do dialog (:647-653) oferece a opção "Encerrada" — duas
     palavras pro mesmo valor dentro do mesmo componente.
   - `src/components/agenda-por-mentorado.tsx:1141` — trilha encerrada exibe "desistente".
   - Já correto (usa "encerrada"): `cronograma-editor.tsx:796`, `trilha-jornada.tsx:168-169`,
     `agenda-por-mentorado.tsx:654`, `saudadeDaDupla` motivo "Dupla encerrada" (`ciclo.ts:1490`).
2. **"sem data" × "sem agendamento"** — o filtro da fila já diz "Sem agendamento"
   (`fila-acompanhar.tsx:76`, `registros.ts:127`), mas o contexto do card "Para
   acompanhar" ainda escreve "Sem data para o 8" / "Encontro 8 · T1 ainda sem data"
   (`agenda-coordenacao.ts:329-334`) e o agrupamento da agenda do mentor usa
   "A agendar, sem data marcada" (`agenda-minha.ts:779`).
3. **Desistente × Concluída × Pausada já são segmentos separados** no
   `SaudePrograma` (`saude-programa.tsx:103-112`) e no `saudeDoRecorte`
   (`agenda-coordenacao.ts:1017-1023`) — o que falta é distinguir **encerrada
   formal** de **desistência** dentro do balde "desistentes": hoje
   `status='encerrada'` cai inteiro em `desistentes`
   (`agenda-coordenacao.ts:1021-1022`, `duplas-lista.tsx:477-482`), mas o enum
   `dupla_desfecho` (migration 0140) já separa os motivos:
   `desistencia_jovem | desistencia_mentor | remanejada | outro | concluida`
   (`dupla-desfecho.ts:4-9`).
4. **Semântica real hoje:** `duplas.status` é PG enum `dupla_status` com valores
   `ativa | pausada | encerrada | concluida` (`0001_init.sql:5`,
   `0037_encerramentos.sql:21`). `'desistente'` **não é** um valor de status.
   `desfecho` é o campo que diz o porquê (0140); `ehDesistente`
   (`dupla-desfecho.ts:53-58`) trata `encerrada` sem desfecho como desistência
   legada e `ehConcluida` (:48-50) lê `desfecho='concluida'`.

Mapa canônico alvo (a régua que toda tela deve falar igual):

| Conceito | Fonte | Label |
|---|---|---|
| Em andamento | `status='ativa'` (risco+atenção+em dia somam o total) | "Em andamento" |
| Em risco / Atenção / Em dia | semáforo `saudadeDaDupla` | inalterado |
| Apoio aberto | `saude.apoio.aberto` — pill sobreposta, nunca muda a situação | "Apoio aberto" |
| Pausada | `status='pausada'` | "Pausada" |
| Concluída | `status='concluida'` ou `desfecho='concluida'` | "Concluída" |
| Desistente | `desfecho IN (desistencia_jovem, desistencia_mentor)` (+ legado: `encerrada` sem desfecho) | "Desistente" |
| Encerrada | `status='encerrada'` com `desfecho IN (remanejada, outro)` — fechamento formal da coord, não desistência | "Encerrada" |
| Sem agendamento | encontro vigente sem row futura | "Sem agendamento" (nunca "sem data") |

## Decisões

1. **Label-only, sem valor novo no enum.** `desfecho` já carrega a distinção
   desistente × encerrada-formal — um `'desistente'` em `dupla_status`
   duplicaria informação e criaria a pergunta "qual dos dois manda?". O mapa
   deriva `status + desfecho` → rótulo. Alternativa descartada (enum novo):
   migrations de enum em prod exigem reescrita de ~15 call sites de
   `status IN ('ativa','pausada')`/`='encerrada'` em SQL/RLS sem ganho —
   a pergunta do negócio é "como chamar", não "como guardar".
2. **Fonte única: `DUPLA_SITUACAO` derivado em `src/lib/dupla-desfecho.ts`.**
   Novo tipo `SituacaoDupla = "andamento" | "pausada" | "concluida" |
   "desistente" | "encerrada"` + `situacaoDaDupla({status, desfecho})` (pura).
   `DESFECHO_LABEL`/`ehDesistente`/`ehConcluida` continuam pra usos finos
   (motivo do desfecho, filtros compostos) — a função nova responde "como a
   dupla se chama", não "por que fechou".
3. **`saudeDoRecorte` passa a contar 7 fatias:** `desistentes` vira só
   `desistencia_*` (+ legado encerrada-sem-desfecho) e `encerradas` entra como
   fatia própria (remanejada/outro). `total` inalterado em magnitude — a soma
   se reparte. `SaudeRecorte` ganha `encerradas: number`; `RecorteFatia` ganha
   `"encerrada"`; chip novo na /duplas.
4. **Apoio aberto segue sobreposição** — o popover "Como calculamos"
   (`saude-programa.tsx:24-64`) ganha a linha "Encerrada" e corrige a de
   "Desistente" (hoje diz "finalizaram por impeditivos", que é a definição de
   encerrada). Texto novo: Desistente = "o jovem ou o mentor saiu antes do
   fim"; Encerrada = "a coordenação fechou a dupla (remanejo, fim de ciclo
   fora do rito, outro motivo)".
5. **"sem agendamento" é a palavra, "sem data" sai.** Id interno `sem_data`
   (MotivoAcompanhar, `agenda-coordenacao.ts:240`) fica — identificador é
   inglês; só a copy muda.

## Schema

Nenhuma. (Label-only; `desfecho` já existe desde a 0140.)

## Domínio (src/lib/)

- **`dupla-desfecho.ts`**: `SituacaoDupla`, `situacaoDaDupla()`, `SITUACAO_DUPLA_LABEL`
  (Record canônico, capitalização de badge). `desistenteDa` de duplas-lista
  migra pra lib (única réplica hoje) e passa a mirar `desistencia_*`.
- **`agenda-coordenacao.ts`**: `SaudeRecorte.encerradas`; `saudeDoRecorte`
  reparte encerrada por desfecho (:1017-1023); `RecorteFatia` + `RECORTES_FATIA`
  com `"encerrada"`; copy do `contextoAcompanhar` "Sem data para o N" →
  "Sem agendamento pro N", "ainda sem data" → "ainda sem agendamento"
  (:317-335); comentários :266, :283-289.
- **`agenda-minha.ts`**: rótulo do grupo "A agendar, sem data marcada" →
  "A agendar, sem horário marcado" (:779 — "data" ali significa slot, não
  agendamento; ajuste fino sem mudar estrutura).
- **`relatorio.ts`**: `labelStatus` passa a receber `{status, desfecho}`
  (callers ajustam) ou ganha `labelSituacao` nova — o CSV não pode mais
  imprimir "Desistente" pra encerrada-formal (:227-236).
- **`ciclo.ts`**: `saudadeDaDupla` motivo "Dupla encerrada" (:1490) já está
  certo — manter. `SITUACAO_MENTORADO_LABEL` (:251-255) é do cadastro do
  jovem, não da dupla — fora do mapa.
- **`ia/tools.ts`** e `ia/prompts.ts`: revisar strings que descrevem o
  panorama ("duplas vivas", contagem de desistentes) pra nova partição —
  a tool `panorama` cita `saude.*` por nome de campo; adicionar `encerradas`.

## UI

- **`saude-programa.tsx`**: `REGRAS` com 8 termos (+Encerrada, Desistente
  corrigida); segmento novo `encerradas` (mesmo cinza de concluída mas
  textura distinta — proposta: tracejado neutro `viz-hatch` variante ou
  `bg-muted-foreground/60`; NÃO cor de alerta); atalho `?recorte=encerrada`;
  ariaLabel atualizado.
- **`duplas-lista.tsx`**: `STATUS_LABEL.encerrada` → "Encerrada";
  `desistenteDa` restrito a `desistencia_*` + legado; `CATS` + chip
  "Encerradas"; `resumoDaLista`/`ResumoLinha` com a fatia nova no sufixo.
- **`dashboard-coordenacao.tsx:712-714`**: encerrada → "Encerrada".
- **`pessoas/[id]/page.tsx:88-93`**: `STATUS_DUPLA` → "encerrada" (e revisar
  :382 "Concluída" — já correto).
- **`editar-dupla-dialog.tsx:48-50`**: rótulo "Encerrada" (alinhar com o
  Select que já diz isso); o hint de efeito "Encerrada sai do acompanhamento"
  (:670-677) já está correto.
- **`trilha-jornada.tsx:168`**, **`agenda-por-mentorado.tsx:654,1141`**,
  **`encerramento-dupla.tsx:85`**: "encerrada" onde hoje diz "desistente";
  caption da jornada mantém "Dupla encerrada".
- **`fila-acompanhar.tsx`**: já correto ("Sem agendamento", :76).
- **`encontro-detalhe-dialog.tsx:41-47`** e **`estado-encontro.ts:21-26`**:
  inalterados (são status de encontro, não de dupla — fora do mapa, mas
  conferir que nenhum vaza "sem data").
- **Sweep final:** `rg -n "Desistente|sem data" src/` deve zerar fora dos
  mapas canônicos e comentários; `rg "encerrada.*desistente|desistente.*encerrada"`.

## Seed + demo

- `src/lib/demo/data.ts`: garantir ao menos 1 dupla `encerrada` com
  `desfecho='remanejada'` (encerrada-formal) e 1 com `desistencia_*` — as duas
  fatias novas têm que aparecer distintas no SaudePrograma e na /duplas demo.
- `seed.sql`/fixtures e2e: revisar specs que afirmam "Desistente" sobre
  encerrada (grep `Desistente` em `tests/`).

## Testes

- vitest `dupla-desfecho.test.ts`: `situacaoDaDupla` cobre os 5 casos
  (ativa, pausada, concluida-status, concluida-por-desfecho, desistencia_jovem,
  desistencia_mentor, remanejada→encerrada, outro→encerrada, encerrada
  legada-sem-desfecho→desistente).
- vitest `saudeDoRecorte`: encerrada-remanejada conta em `encerradas`, não
  em `desistentes`; total inalterado.
- e2e: chip "Encerradas" filtra a lista; popover mostra os 8 termos.

## Critérios de aceite

- [ ] Nenhuma tela exibe "Desistente" para `status='encerrada'` com
  `desfecho IN (remanejada, outro)`.
- [ ] `saudeDoRecorte` devolve `encerradas` separado de `desistentes`;
  `emAndamento = risco + atencao + emDia` continua somando as ativas.
- [ ] "Sem agendamento" é a única grafia visível pro motivo `sem_data`.
- [ ] O mapa `SITUACAO_DUPLA_LABEL` é a única fonte de rótulos de situação;
  os 9 render sites listados consomem dele (ou justificam exceção em
  comentário).
- [ ] Apoio aberto continua pill sobreposta — nunca fatia da barra.
- [ ] `npx tsc --noEmit` e `npx eslint src/` limpos; vitest verde.

## Fora de escopo

- Renomear `dupla_status` no banco ou adicionar valor ao enum (label-only).
- Copy dos motivos de desfecho (`DESFECHO_MOTIVOS`) e do dialog de saída de
  mentorado (`MOTIVOS_SAIDA`).
- Status de encontro (`agendado/remarcado/...`) e de cronograma/formulário.
