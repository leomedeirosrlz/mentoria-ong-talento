# REALIZA-51 — Distribuição de atividades: disparo em lote por e-mail + compartilhar WhatsApp

- **Jira**: REALIZA-51 (migrada de REALIZA-48) · Feature · Medium · Depende de REALIZA-20
- **Veredito**: **PARCIAL→ABERTO** — o lado WhatsApp individual já existe; falta o disparo **em lote por e-mail** e, se quiser, o compartilhar em lote.

## O que já existe (verificado)

- **WhatsApp deep link individual**: `waLink`/`msgsContato` (`src/lib/whatsapp-msgs.ts`) + `NudgeButton` + `CopiarLink` no card do instrumento na ficha (`instrumentos-dupla.tsx`) — "mandar no WhatsApp" por link já é real.
- **E-mail transacional**: Resend integrado (`src/lib/email.ts`) com kill switch `EMAIL_ENVIO_LIBERADO=false` + log `emails_enviados` (tipos: comunicado/material/assinatura/apoio_jovem/chamado — 0084).
- **Emissão por dupla**: `emitir_link_instrumento`/`emitir_instrumento_core` (0099) reusável; autoemit já emite sem clique quando a jornada alcança.
- **Mentor encaminha**: já pode copiar/WhatsApp o link da própria dupla.

## O que falta

- **Disparo em lote por e-mail**: coord seleciona instrumento + escopo (turma ou lista de duplas) → emite links em massa → envia e-mail com o link tokenizado pra cada mentorado (e/ou mentor, fallback quando o jovem não tem e-mail).
- **Emissão em lote atômica**: loop de `emitir_instrumento_core` numa RPC definer [NOVO] (transação única, relatório por dupla).
- **Tipo de log**: `emails_enviados.tipo` precisa do valor `'instrumento'` [NOVO] — check constraint em migration.
- **Template de e-mail**: novo template `email-templates.ts` [NOVO] com o link + nome do instrumento + prazo.
- **UI do lote**: superfície natural = painel `/materiais` coord (`painel-jornada.tsx` já mostra progresso por instrumento×dupla — ação "Enviar em lote" por estação) ou `/formularios`.
- WhatsApp **em lote** não é automatizável sem API Business — fica manual por link (documentar).

## Dependências / bloqueios

- REALIZA-20 (a espinha do link — na prática pronta; o lote usa `emitir_instrumento_core`).
- BLOCKER: o e-mail do lote vai pro **mentorado** (`mentorados.email` existe — mas preenchimento real? **a verificar** cobertura) com fallback pro mentor repassar? Ou sempre pro mentor? A issue sugere o link chegar ao jovem — confirmar com Thiago.
- `EMAIL_ENVIO_LIBERADO=false` hoje — envio real depende do Thiago ligar a chave em produção (já há Resend configurado).

## Esforço: **M**

## Riscos

- Disparo em massa → spam/bounce se e-mails do intake estiverem ruins; mitigar com lista de pulados + log por destinatário.
- Reenvio duplicado: a RPC de emissão já reusa link pendente — idempotente por natureza.

> DECIDIDO (Thiago): e-mail do lote vai pro mentorado (mentorados.email) com fallback pro mentor repassar.
