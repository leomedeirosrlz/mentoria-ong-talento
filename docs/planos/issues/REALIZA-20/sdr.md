# REALIZA-20 — SDR

## Modelo de ameaças

1. **Rascunho vira vetor de escrita pública** — `salvar_rascunho_formulario`
   é definer e aceita `anon`. Mitigação: mesmas regras do submit atual
   (token vigente, payload cap, só chaves declaradas, coerção de tipos) +
   upsert atômico. Adicionar rate-limit por token: rejeitar se `salvo_em`
   < ~1s atrás (debounce já garante, o cap bara flood de script).
2. **Token leak em rascunho** — rascunho é posse-equivalente: mesmo modelo
   do submit (bearer). `visto_em` é setado por qualquer portador — informação
   baixa (booleano), aceitável.
3. **Enumeração via rascunho** — respostas de erro idênticas às do submit
   (genéricas; o token não revela destinatário).
4. **Devolução abusiva** — mentor só devolve resposta da própria dupla;
   coord tudo. RPC checa `dupla_id` do link, não input do client.
5. **XSS/conteúdo** — rascunho é texto: mesmo tratamento do render atual
   (React escapa; `instrumento-resultado` não injeta HTML).

## LGPD

- Rascunho de menor no servidor = dado pessoal mais cedo do que antes.
  Minimização: salva só campos do instrumento (sem telemetria); retenção do
  rascunho = vida do link (rascunho de link expirado/dupla encerrada some na
  mesma higienização das respostas — política de retenção = da resposta).
- Devolução expõe motivo ao jovem — orientação de copy: sem dados de
  terceiros no recado.

## RLS / grants

- `formulario_respostas` segue coord-only por RLS; `revoke anon` mantido —
  todo acesso público via definer.
- `devolver_resposta_formulario` grant só `authenticated` (interno); predicado
  interno = `my_role()='coordenacao' OR (has_papel('mentor_dpp') AND
  link.dupla.mentor_id=my_profile_id())`.

## Auditoria

- Devolução loga `devolvido_por`/`devolvido_em`/`devolvido_motivo` na própria
  resposta (auditoria embutida); notificação ao jovem via `notificacoes`.
- Rascunhos não geram log por save (ruído) — `salvo_em` basta.

## Concorrência

- Upsert `on conflict (link_id) do update` — último write ganha; submit usa a
  mesma linha com guard de status (`where status in ('rascunho','devolvida')
  or not exists`) — corrida rascunho×submit resolve no banco, não no client.

## Scrubbing

Tokens seguem fora de logs/Sentry (`src/lib/sentry-scrub.ts` cobre `/f`);
autosave não deve logar payload.
