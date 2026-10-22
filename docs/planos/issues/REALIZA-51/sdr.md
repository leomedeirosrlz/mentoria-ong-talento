# REALIZA-51 — SDR

## Ameaças

1. **Token por e-mail** — e-mail é inbox compartilhável (pais, escola);
   o link é bearer por design (mesmo modelo atual). Aceito pelo produto:
   o instrumento não é segredo de estado; mitigação: nunca embutir dados
   da resposta no e-mail — só o link.
2. **Disparo em massa = spam/bounce** — e-mails do intake podem estar
   velhos/errados. Mitigação: relatório por linha + log `emails_enviados`
   (dá pra medir falhas); não há webhook de bounce hoje — **a verificar**
   se o Resend da conta tem (melhoria futura, não bloqueante).
3. **Vazamento em massa** — um erro de template mandando link errado pra
   N pessoas. Mitigação: RPC devolve par dupla↔token do banco (não input
   do client); template usa `{{link}}` da linha, sem concatenação manual;
   dry-run/preview no dialog mostra o que sai.
4. **Abuso do lote** — coord-only; `emitir_instrumento_lote` guarda papel
   dentro da definer (autenticado qualquer tenta, só coord passa).
5. **E-mail do mentorado** — `mentorados.email` é PII de menor; o lote
   não a expõe a outros destinatários (1 e-mail por link, BCC desnecessário
   porque são mensagens individuais).

## LGPD

- Minimização: e-mail contém nome próprio + link — nada de resposta/
  avaliação.
- Base legal: execução do programa (o jovem/responsável consente ao
  ingressar); log `emails_enviados` audita o que saiu, pra quem, quando.
- Retenção do log = padrão `emails_enviados` existente.

## Auditoria / retenção / rate limit

- `emails_enviados` tipo 'instrumento' + `ref_id` link + `dest` — trilha
  completa coord→e-mail→link.
- Rate limit natural: RPC/action sem loop externo; Resend com cap da
  conta. Adicionar sanity cap: `p_dupla_ids <= 100` por chamada na RPC
  (defesa contra chamada gigante acidental).
- `EMAIL_ENVIO_LIBERADO` segue como kill switch operacional.
