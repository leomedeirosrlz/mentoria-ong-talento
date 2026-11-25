# REALIZA-372 — Consistência da conta de jovem (ficha ↔ profile)

Issue: `jovem`,`consistencia`. Fonte: batch `jovem-consistencia` do `_contexto.md` — sub-itens 1, 3–8 (o sub-item 2, vínculo robusto `mentorados.profile_id`, já foi entregue pela migration 0177). Implementação em voo: branch `thiago/jovem-consistencia` (worktree `auth-handoff`) — diff em working tree, não commitado. Status: em implementação.

Contexto: com a conta de jovem de pé (0066 `my_mentorado_id()`, 0171–0177 vínculo e role projetada), a pessoa passou a existir em **duas** fichas — `mentorados` (programa) e `profiles` (acesso, role `mentorado`). Esta rodada fecha as frestas de consistência entre elas.

## O que exige vs. o que existe — por sub-item

**1. `importPessoas` dedupe contra `mentorados.email`** — `src/lib/actions.ts` (~2597-2645): o import CSV monta agora um segundo `Set` (`emailsJovem`) com `select("email")` em `mentorados`, além do `noBanco` de `profiles_contato` já existente. Linha cujo e-mail bate numa ficha de jovem é pulada com `"<nome>: e-mail já é de uma ficha de jovem"` — um profile staff com o e-mail do jovem ocuparia a identidade e o `mentorados.profile_id` do login real não fecharia mais (0177). A dedupe por `normEmail` segue case-insensitive igual ao ramo staff.

**2. Vínculo robusto** — entregue por 0177 (`jovem_vinculo_robusto`), fora deste diff. Registrado pra não re-cobrir.

**3. `/pessoas/<profile_id>` de conta de jovem: casca vazia → apontador + dados mesclados** — `getPessoaPerfil` (`queries.ts` ~739-810) faz uma terceira leitura em paralelo: `mentorados ... eq("profile_id", id)` devolvendo `fichaJovem: {id, nome, nome_social, whatsapp} | null` — RLS-scoped como o resto do perfil (quem não lê a linha do mentorado recebe `null` e nada muda). A página (`pessoas/[id]/page.tsx`):

- mostra link "ficha de jovem" (`UserSwitch`) apontando pra `/pessoas/<ficha.id>` — espelho exato do "conta na plataforma" que já existia do outro lado (:535-543);
- **mescla os alvos de documento**: `docTipo`/`docId` (:337-338) — numa conta de jovem as seções `DocumentosPessoa`/`AssinaturasPessoa` apontam pra ficha canônica (`tipo="mentorado"`, id/nome/whatsapp da ficha), não pro pool de staff do profile.

**4. Badge "conta vinculada"** — `MentoradoRow` em `pessoas-listas.tsx` (:1466-1476): o gate passou de `m.email && !m.conta?.onboarded_em` pra `(m.email || m.profile_id)`, e o badge virou três estados: `profile_id` + `conta.onboarded_em` → **"conta vinculada"**; `profile_id` sem onboarding → "convite enviado"; sem `profile_id` → "não convidado". Antes, ficha com conta onboarded simplesmente perdia o badge.

**5. Notificações do ciclo de vida da dupla alcançando o `profile_id` do jovem** — ⚠ **gap: não implementado no branch.** Os três pontos de notificação seguem endereçando só mentor/supervisor: `updateDupla` (actions.ts ~2221-2280), `criarDuplasEmLote` (~2984) e `rematchDupla` (~2505). O comentário em ~2486 ainda diz "O mentorado não tem login — o sino só alcança profiles" — ficou stale: jovem com conta tem `profile_id` via `mentorados.profile_id` e receberia pelo mesmo `notificar()`. Pendência explícita pra fechar antes do merge ou abrir follow-up.

**6. Contexto de chamados pro jovem** — **verificado: já entregue em staging, o branch não precisou tocar.** `chamados_select` (0084:148-152) cobre `autor_mentorado_id = my_mentorado_id()` — chamado aberto "pelo jovem" antes de ele ter login (avaliação/resp. via ficha) passa a ser dele quando a conta vincula. `abrir_chamado` é RPC definer (0084:450+) que resolve os dois lados do autor; `chamados_fila` é view definer com mascaramento de plataforma pro auxiliar. A superfície é `JovemChamados` em `/jovem/perfil` e o ramo "autor" de `getChamados` (`queries-chamados.ts` ~86-137) já serve role `mentorado` — sem comentário interno, sem vitrine pro mentor.

**7. Pool do termo-voluntario filtra `tipo='profile'`** — `actions-assinaturas.ts`: `solicitarAssinatura` (:268-281) recusa `tipo='profile'` quando o profile_id pertence a uma ficha de jovem — `"Essa conta pertence a um jovem do programa. Emita o documento pela ficha dele."`; `emitirAssinaturasEmLote` (:358-372) remove do pool os profile_ids que têm ficha (`mentorados.profile_id in ids`) — alvo errado sai silenciosamente, não vira erro de lote.

**8. Estado demo "ficha não vinculada"** — `demoPessoaPerfil` (`demo/queries.ts` ~672-695) computa `fichaJovem` com o mesmo escopo de `mentorados_select`: coord sempre; os demais só se a ficha for de um mentorado das duplas dele. O dataset já cobre os estados sem fixture nova: fichas `profile_id: null` (T2 — "não convidado"), contas de jovem vinculadas (anaLogin/caioLogin/dandaraLogin) e profiles de jovem sem ficha apontando de volta → `fichaJovem: null`.

## Decisões

- **A ficha é o canônico, a conta é a porta.** Na página do profile de jovem, documentos/assinaturas apontam pra `mentorados.id` — o histórico do programa não se divide por onde a coordenação clicou. Mesma lógica do lado inverso ("conta na plataforma" na ficha desde a promoção REALIZA-159).
- **`fichaJovem` via leitura RLS, não via RPC.** O escopo herda de graça da policy `mentorados_select` — um definer novo precisaria reimplementar "coord / mentor da dupla / supervisor" à mão.
- **Pool fechado no servidor, silêncio no lote.** `solicitarAssinatura` explica o erro (a coordenação clicou numa ficha específica); no lote, conta de jovem é filtrada como tipo estranho — a emissão certa dela é pela ficha, e falhar o lote inteiro por um alvo misto seria pior.
- **Sem migration nova.** Tudo resolvido em app-code sobre a infra existente (0066, 0084, 0177, 0180).

## Schema

**Nenhuma migration adicionada pelo branch.** 0183/0184 estavam reservados pra este batch e ficaram **não usados** — disponíveis pra próxima spec que precisar. Sub-item 5, se entrar, provavelmente segue app-code (`notificar` aceita `profile_id` arbitrário; bastaria resolver `mentorados.profile_id` por dupla) — sem DDL também.

## Domínio (src/lib/)

- `queries.ts` — `getPessoaPerfil` devolve `+ fichaJovem`; tipo `FichaJovemPerfil` exportado.
- `actions.ts` — `importPessoas`: `emailsJovem` + regra de pulada.
- `actions-assinaturas.ts` — `solicitarAssinatura` + `emitirAssinaturasEmLote`: guardas de conta-de-jovem no pool `tipo='profile'`.
- `demo/queries.ts` — `demoPessoaPerfil` espelha `fichaJovem` com escopo por papel.

## UI

- `pessoas/[id]/page.tsx` — link "ficha de jovem" (UserSwitch, `text-xs text-muted-foreground` — metadado-link padrão), `docTipo`/`docId` mesclados pras seções de documentos e assinaturas.
- `pessoas-listas.tsx` — badge tri-estado de vínculo na linha do mentorado.

## Seed + demo

- `demoPessoaPerfil` retorna `fichaJovem` (escopado). Dataset inalterado — os três estados de vínculo já existiam nas fixtures (vinculado / convite pendente / não convidado).

## Testes

- ⚠ **gap: zero cobertura nova no branch.** Sem vitest pra dedupe do `importPessoas`, pro tri-estado do badge, pras guardas de assinatura ou pro lookup `fichaJovem`; sem spec e2e. O diff é pequeno mas toca regra de unicidade (e-mail) e escopo de RLS — os dois lugares onde regressão silenciosa mais custa.

## Critérios de aceite

- [x] Import CSV pula linha cujo e-mail já é de `mentorados.email`, com motivo "e-mail já é de uma ficha de jovem".
- [x] `/pessoas/<profile_id>` de conta de jovem mostra link "ficha de jovem" pra ficha canônica — e só pra quem lê a ficha pelo RLS.
- [x] Na conta de jovem, `DocumentosPessoa` e `AssinaturasPessoa` operam sobre a ficha (`tipo="mentorado"`, id/nome/whatsapp da ficha).
- [x] Linha do mentorado em /pessoas mostra "conta vinculada" (onboarded), "convite enviado" (profile_id sem onboarding) ou "não convidado" — mesmo sem `email` na ficha.
- [x] `solicitarAssinatura`/`emitirAssinaturasEmLote` com `tipo='profile'` recusam/filtram conta de jovem — termo-voluntario nunca é emitido pro profile errado.
- [x] Jovem abre/lê os próprios chamados em `/jovem/perfil` (`autor_mentorado_id = my_mentorado_id()`, já em staging).
- [x] Demo reproduz os três estados de vínculo sem fixture nova.
- [ ] ⚠ gap (sub-item 5): notificações de formar/pausar/encerrar/remanejar dupla **não** chegam ao `profile_id` do jovem — `notificar()` segue endereçando só mentor/supervisor; comentário stale em actions.ts ~2486.
- [ ] ⚠ gap: nenhum teste novo — adicionar cobertura mínima (dedupe + badge + guarda de assinatura) ou assumir o risco explicitamente no review.

## Fora de escopo

- Sub-item 2 (vínculo robusto) — já entregue por 0177.
- Tela "merged view" completa da conta (o branch escolheu o apontador + mescla de documentos, não a fusão das duas páginas).
- Notificações ao jovem (sub-item 5) — listado acima como pendência do próprio escopo, a decidir: fecha aqui ou vira follow-up.
- Backfill de dados reais / e-mail de jovem em prod (OP-ops).
