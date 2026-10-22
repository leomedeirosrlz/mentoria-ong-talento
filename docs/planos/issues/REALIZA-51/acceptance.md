# REALIZA-51 — Critérios de aceite

1. **Lote feliz** — coord seleciona instrumento + 5 duplas com jovem de
   e-mail válido → RPC emite 5 links; 5 e-mails saem com link correto por
   linha; `emails_enviados` registra 5 linhas tipo 'instrumento'.
2. **Idempotência** — rodar o mesmo lote 2× não cria link duplicado (reuse
   de pendente); relatório marca "reutilizado".
3. **Sem e-mail** — dupla cujo jovem não tem `mentorados.email` → linha
   "pulada · sem e-mail"; se fallback mentor ligado, e-mail vai pro mentor
   com copy de repasse.
4. **Dupla encerrada/trilha esp** — incluída por engano na seleção → RPC
   devolve erro por linha ("jornada encerrada"/"trilha"), demais seguem.
5. **Kill switch** — `EMAIL_ENVIO_LIBERADO=false`: nenhum call ao Resend;
   links emitidos ficam utilizáveis; relatório marca "envio desligado".
6. **Permissão** — mentor chamando `emitir_instrumento_lote` → erro de
   papel; UI nem mostra a ação pra não-coord.
7. **Cap** — `p_dupla_ids` > 100 → RPC rejeita com erro claro.
8. **Template** — e-mail contém só: nome, instrumento, link `/f/{token}`,
   copy sem-senha; nenhum dado de resposta/outros jovens.
9. **WhatsApp manual** — linha pulada/falha oferece `wa.me` deep link com
   mensagem pré-preenchida contendo o token certo daquela dupla.
10. **Schema-contract** — migration no remoto antes do merge; check verde;
    `emails_enviados` antigos intactos.
11. **Demo** — action demo retorna relatório fake; painel demo cobre a
    ação sem enviar nada.
12. **e2e** — spec app: coord dispara lote em staging (fixtures e2e),
    asseres na UI do relatório + linha em `emails_enviados` (via service
    role no spec ou tela de log se existir).
