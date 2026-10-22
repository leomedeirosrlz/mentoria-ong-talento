# REALIZA-51 — SDD

## Alternativas

**A. Loop client-side** — UI chama `enviarInstrumentoMentorado` N vezes.
Contra: N round-trips, parcial-visitível (aba fechada no meio), sem
relatório atômico. Rejeitada.

**B. RPC definer em lote + envio síncrono na action** (escolhida) — a RPC
faz a emissão transacional e devolve tokens+e-mails; a action orquestra o
Resend (que não pode sair do banco). Relatório por linha alimenta UI+log.

**C. Queue + worker** — não existe infra (sem pg_cron/pg_net/edge fns no
projeto). Sincrono cobre dezenas de destinatários; se crescer, vira
evolução futura com a infra que entrar (REALIZA-169/182 resolvem jobs).

## Modelo de dados

- Sem tabela nova: links em `formulario_links` (padrão), log em
  `emails_enviados` com `tipo='instrumento'` [NOVO] + `ref_id=link.id`.
- A RPC retorna `jsonb` relatório `[{dupla_id, ok, token, motivo_erro,
  destinatarios:{jovem:{email,nome}, mentor:{email,nome}}}]`.

## RLS / definer

- `emitir_instrumento_lote`: `security definer`, `grant authenticated`,
  guard `my_role()='coordenacao'` — mentor segue emitindo só a própria
  dupla pela RPC existente. Definer necessário porque insere em
  `formulario_links` pra qualquer dupla.
- Envio usa `enviarEmail` server-side (service context) — nunca expõe
  `RESEND_API_KEY` (já é assim em `email.ts`).

## Contratos

```ts
enviarInstrumentoLote(sistema: InstrumentoSistema, duplaIds: string[]):
  {error} | {ok:true, enviados:number, pulados:number, falhas:
    {dupla_id, motivo}[]}
// motivos: 'sem_email', 'dupla_encerrada', 'trilha_especialista',
//          'email_falhou', 'emit_falhou'
```

## Invariantes

1. Idempotente: `emitir_instrumento_core` reusa pendente → rodar o lote
   duas vezes não duplica link (e o e-mail re-envia pro mesmo token — ou
   pular "já tinha link pendente e já foi e-mail enviado"? **decisão**:
   registrar `emails_enviados` por chamada e deixar a UI mostrar
   "reutilizados" — o coord decide se manda de novo).
2. Falha por linha não aborta o lote — relatório completo sempre.
3. Respeita `EMAIL_ENVIO_LIBERADO` — flag off = nenhum Resend call
   (relatório marca `pulado: envio_desligado`), comportamento alinhado
   aos demais tipos não-críticos.

## Performance

Loop SQL de N duplas: O(N) inserts — trivial. Resend N chamadas
sequenciais na action: ~N×300ms; pra N>50 considerar `Promise.allSettled`
em lotes de 10 com limite (Resend rate ~10/s — **a verificar** limite da
conta).
