# REALIZA-168 — Migrar o registro semanal do Google Form pro `RegistroForm` nativo

**Jira:** [REALIZA-168] "Migrar import semanal Google Form → RegistroForm
nativo" — "`registros` já é a versão nativa fiel do form semanal — falta o
canal de entrada pelo mentor + lembrete"
**Tier:** B — README, plan, sdd, sdr (leve), acceptance. Sem design.md:
a superfície de entrada **já existe** (`RegistroForm` + `RegistroInline`);
o novo é o lembrete (sino + deep-link, copy no sdd).
**Status:** ABERTO — o fluxo nativo existe e funciona; a operação ainda
depende do Google Form semanal + import CSV da coord
(`importar_registros` RPC, 0082; dialog `importar-registros-dialog.tsx`).

## Resumo

O mentor **já consegue** registrar semanalmente dentro da plataforma: cada
encontro realizado sem registro aparece como card/pendência com deep-link
`#registrar-{encontroId}` que abre o `RegistroForm` inline na ficha da dupla
(`agenda-minha.ts:324`, `agenda-calendario.tsx:3378`, `registro-inline.tsx`).
O que falta, e é a issue: **ninguém lembra o mentor**. Sem o e-mail do Google
Form, a taxa de follow-up depende da coord cutucar um a um.

O trabalho então é: (a) lembrete automático de registro pendente — mesma
infra de jobs das issues 182/169; (b) plano de reconciliação do histórico
(a RPC de import já existe); (c) runbook de fechamento do Google Form.

## Escopo

- **`/api/jobs/lembretes-registro`** [NOVO] + RPC
  `processar_lembretes_registro(p_hoje)` [NOVO]: diária (07:30 UTC), varre
  encontros `realizado` sem `registros` nas duplas ativas, dispara notificação
  `registro_pendente` [NOVO tipo] pro mentor com `href` `/duplas/<id>#registrar-<enc>`
  — o deep-link já abre o form inline.
- **`registro_lembretes`** [NOVO] — ledger `(encontro_id, marco)` fire-once,
  mesmo desenho do `trilha_lembretes` da 169 (ver convergência no sdd §5 —
  se 169 aterrissar junto, uma tabela `lembretes_enviados` genérica resolve
  as duas; documentado como decisão de merge).
- **Regra do marco** (sdd §2): 1 lembrete quando `realizado_em` passou
  `D+2`, 1 reforço em `D+7`, e aí entra a fila normal da coord
  (`registro_pendente` já é sinal do semáforo — o acompanhamento humano
  assume). Sem spam semanal eterno.
- **Sem canal anônimo/token em v1** — mentor tem conta e o fluxo inteiro dele
  é logado (dupla, agenda, registro). "Link" do Jira = o deep-link do ping.
  Token público pra escrever `registros` seria RPC definer nova com escopo
  cirúrgico — só se a coord reportar mentores que não entram (BLOCKER
  registrado, não assume).
- **Import histórico** — `importar_registros` (0082) permanece pra backlog e
  respostas que chegarem ao Google Form durante a transição (idempotente,
  born-realizado `'externo'`, nunca toca `precisa_apoio` — 0082:1-30).
- **Fechamento do Google Form** — runbook (plan §runbook): piloto → anúncio
  → cutover → fecha coleta no Google → import final → arquiva CSV.

## Dependências

- Infra de jobs: `CRON_SECRET` + `vercel.json` crons — criada por quem
  aterrissar primeiro dentre 182/169/168 (mesmo esqueleto de handler).
- `enviar_lembrete` (0094) como molde de RPC — cap 48h dela **não** se aplica
  (lembrete de prazo ≠ nudge manual; mesma decisão da 169).
- `notificacoes` CHECK — adicionar tipo `registro_pendente` [NOVO].
- `EMAIL_ENVIO_LIBERADO = false` (`src/lib/email.ts:60`) — e-mail continua
  gateado; o canal é sino + WhatsApp humano. `emails_enviados` não muda.
- Deep-link `#registrar-{id}` já funciona (`registro-inline.tsx` — hash
  abre o card).

## Esforço: M

Migration (ledger + RPC + tipo) + handler + vercel.json + copy + validador.
Sem schema de dados novo pro registro em si, sem UI nova pro mentor.

## Riscos

- **Adoção do mentor** — o form nativo é mais longo que o Google (3 etapas);
  mitigação: o lembrete cai direto no card aberto + rascunho local já salva
  (`localStorage` no `registro-form.tsx`). Piloto com 1-2 mentores primeiro.
- **Duplicidade transição** — mentor responde no Google **e** na plataforma
  no mesmo encontro: o import idempotente **não sobrescreve** registro
  existente? — verificar 0082: o update mapeia campos no re-import
  (potencial de pisar no nativo). Mitigação no plano: antes do cutover,
  último import e só então fecha coleta; e a RPC já não toca `precisa_apoio`.
  Revisar no PR se o upsert do import preserva registros criados pelo mentor
  (regra recomendada: `encontro já tem registro → skip`, não update — flag
  `p_modo`? — decidir na revisão do PR; a RPC atual faz update mapeado).
- **Lembrete pra trilha especialista** — encontros de esp também geram
  registro? Se sim, mesmo marco vale; se a régua for outra, filtrar
  `trilha='dpp'` na v1 e documentar (verificar no PR como `salvarRegistro`
  trata trilha esp — `saudadeDaDupla` trata esp sem calendário: `esperado =
  feitos`, então `registro_pendente` por encontro passado vale igual).
