# REALIZA-21 — Checklist de intenções por encontro (não só nota livre)

- **Jira:** [REALIZA-21](https://kelyng.atlassian.net/browse/REALIZA-21)
- **Tier:** B
- **Veredito:** **ABERTO** — não existe hoje nenhum checklist estruturado por encontro.
- **Duplicata:** REALIZA-96 é clone desta issue (aponta pra cá).
- **Esforço estimado:** **M** (migration + 3 actions + componente novo + carry-over + demo)
- **Docs:** [plan.md](plan.md) · [sdd.md](sdd.md) · [design.md](design.md) · [sdr.md](sdr.md) · [acceptance.md](acceptance.md)

## O que a issue pede

> "pontos específicos pendentes" (ex.: "enviar vídeo depois do encontro") — um
> **checklist de intenções** por encontro, não só `NotaEncontro` livre. Mentor
> marca itens que precisam acontecer; itens pendentes aparecem no próximo
> encontro/nudge.

Fonte: `docs/analise-transcricao-mentor.md` §Sprint2 (backlog 168).

## Estado atual (evidência)

- `encontro_notas` (`supabase/migrations/0015_encontro_notas.sql`) — **um** texto
  livre por `(dupla_id, numero)`, autosave via `NotaEncontro`
  (`src/components/nota-encontro.tsx`) + `salvarNotaEncontro`
  (`src/lib/actions.ts:2985`). É plano de aula, não checklist — sem estado
  pendente/feito.
- `encaminhamentos` (`supabase/migrations/0001_init.sql:95`) — "combinados"
  bilaterais nascidos no registro do encontro (`registro_id`), com
  `responsavel` mentor/mentorado e `prazo`. O jovem os vê
  (`jovem_encaminhamentos`, `0070`) e marca feito (`marcar_combinado`). É a
  entidade errada: intenção é do **mentor**, pré-encontro, sem jovem no loop.
- `EncontroRow` já recebe `combinadosPendentes` e `nota`
  (`src/app/(app)/duplas/[id]/page.tsx:1419-1421`) — o card do encontro é o
  lugar natural do checklist.

## Escopo

- **[NOVO]** `encontro_intencoes` — chave `(dupla_id, numero)` igual a
  `encontro_notas` (a intenção segue o nº do guia na remarcação, não o row físico).
- Checklist editável no card do encontro da ficha (`src/components/intencoes-encontro.tsx` [NOVO]).
- **Carry-over**: pendentes de encontros anteriores aparecem no card do próximo
  encontro, marcados "do Nº encontro".
- Aviso no topo do "Hoje" da Minha agenda (`avisosDaDupla` em
  `src/lib/agenda-minha.ts:304`) quando há intenções em aberto.
- Lista read-only no `EncontroDetalheDialog` (`src/components/encontro-detalhe-dialog.tsx`)
  pra coord/supervisor, ao lado de "Plano do mentor".
- Paridade demo: fixtures + client-stub + queries.
- RLS espelhando `encontro_notas` (mentor escreve na própria dupla; coord
  tudo; supervisor lê).

## Fora de escopo

- Não mexe em `encontro_notas` nem em `NotaEncontro` (o texto livre continua).
- Não vira combinado: intenção não entra em `encaminhamentos`, não aparece pra
  jovem, não tem `prazo`/`responsavel`.
- Não entra no texto do WhatsApp do lembrete (`whatsapp-msgs.ts`,
  `lembreteDaDupla`) — o checklist é plano privado do mentor; vazá-lo ao jovem
  seria outra feature.

## Dependências / bloqueios

- Nenhuma dependência de outra issue. Conversa com REALIZA-26 (mesma janela de
  escrita no card do encontro, entidades independentes).

## Riscos

- **Confusão conceitual com Combinados** — mitigado pelo design: intenções moram
  sob a nota do encontro, com rótulo próprio ("Intenções"), nunca na seção
  Combinados.
- **Ruído de pendências** — carry-over precisa mostrar origem ("do 3º encontro")
  senão o mentor lê como item novo; ver design.md.
- **Checklist vs. nota** — risco de o mentor continuar escrevendo lista no
  texto livre; aceitável (a nota segue valendo pra plano de aula longo).
