# REALIZA-126 — Tools de escrita com confirmação nos dois canais (fase 3)

Issue: `ia`. Fonte: plano `ia-chatbot-mcp.md` §3; **absorvida pela REALIZA-179** (`docs/planos/issues/REALIZA-126/README.md` — "não implementar por aqui"; o desenho canônico é `issues/REALIZA-179/sdd.md` §6-7 + `plan.md` PR 5). Status: a fazer.

## O que exige vs. o que existe

A issue pede 5 tools de escrita delegando pras mesmas RPCs/cores das actions, com confirmação explícita em ambos os canais. Verificado no staging:

- **Infra de confirmação já entregue** — `ia_confirmacoes` (0163): `ia_confirmacao_criar` grava prévia (dono = `my_profile_id()`, hash sha256 dos args canônicos, expira em 10min, uso único); `ia_confirmacao_consumir` faz update atômico (dono + tool + args_hash + não expirada + não consumida) — inválida/divergente/de-outra-pessoa falha fechado. `executarTool` orquestra o ciclo (`tools.ts:1663-1707`): sem `confirmacao_id` → cria prévia e devolve `{pendente_confirmacao:{confirmacao_id, tool, args, resumo, expira_em_minutos:10, instrucao}}`; com ele → consome e executa. As duas chamadas gravam `ia_eventos` (o par "proposto × aprovado" já é auditável).
- **Writes hoje são MCP-only** — `tools.ts:1618-1624`: `escreve && canal !== "mcp"` → `"Esta ação ainda não está disponível neste canal"`. O chat não tem card de confirmação — falta a ponta de UI.
- **Registry já tem escritas** (chamados, `jovem_*`, `desmarcar_encontro`, solicitações — `:993+`), todas `escreve:true` operando pelo envelope. **As 5 tools do domínio não existem** — nenhuma de `registrar_interacao`, `marcar_situacao_mentorado`, `emitir_link_instrumento`, `agendar_encontro`, `editar_campo_pessoa` no catálogo.
- **Alvos de delegação verificados**:
  - `interacoes` (0008): insert policy = coord **ou** mentor_id/supervisor_id da dupla; CHECK `tipo ∈ ('nudge','contato','apoio')`; canal `'in_app'` existe desde 0094:11-12.
  - `marcarSaidaMentorado` (`actions.ts:1727`): coord-only; dupla viva (ativa/pausada) bloqueia; `desistente` exige motivo ≤300; `ativo` limpa `saiu_em`/`motivo_saida`.
  - `emitir_link_instrumento` (RPC 0080:378): definer; escopo = coord ou `mentor_dpp` da dupla viva (ativa/pausada); `sistema ∈ ('visao','roda_vida','pdm','metas')`; link serve em `/f/<token>`.
  - `agendarEncontro` (`actions.ts:3021`): **guard de domínio na action** — `eu.role === "coordenacao"` → `"Quem agenda é a dupla…"` (:3027-3030). RLS `encontros_mentor_write` deixaria a coord escrever (policy larga pra correções) — **o contrato vive no core, não no banco**: delegar ao core preserva o guard; um insert direto da tool o contornaria silenciosamente. Trilha `especialista`: sessão nova só nasce de pedido aceito — o core recusa criar, aceita remarcar (:3058-3064).
  - `editar_campo_pessoa`: allowlist da issue = `whatsapp`, `nome_social`, obs interna. `salvarCampoRelatorio` (`actions.ts:1790`, `CAMPOS_RELATORIO` :1788) cobre campos **diferentes** (nome/email/whatsapp/cidade/uf) — a tool tem allowlist própria: `whatsapp`+`nome_social` em `profiles` e `mentorados` (0034:37/91); `notas` só em `mentorados` (0001:38 — `profiles` não tem coluna de obs interna; `pessoa_notas` é tabela de notas privadas por autor, outro conceito). Escrita via RLS: `profiles_coord`/`mentorados_coord` (`for all`, 0001).
  - `jovem_agendar_encontro` já existe como tool separada (RPC `agendar_encontro_mentorado`, `:1197`) — a `agendar_encontro` nova é do **mentor** pelo core da action; mecanismos diferentes por papel, manter separados.

## Decisões

- **`src/lib/escritas.ts` [NOVO]** — extrai os cores `agendarEncontro`, `marcarSaidaMentorado` (e o normalizador de campo de pessoa) das actions com assinatura `(supabase, eu, params) → {error}|{ok}`; as actions viram wrappers (sessão + `demoAtivo` + revalidate) chamando o core; as tools chamam o core com o client escopado do canal. **Sem duplicar regra** — o guard "a dupla agenda" e as validações de motivo/dupla-viva vêm de graça (179 PR 5).
- **Envelope `pendente_confirmacao` é o contrato único** — não implementar o `requer_confirmacao`/`confirmado:true` do sdd 179 §7. A implementação divergiu por design: estado no servidor (linha atômica) em vez de flag no args — o client não pode se auto-aprovar reenviando `confirmado:true`, e o consumo é idempotente/transacional. O sdd 179 fica desatualizado neste ponto; esta spec é o contrato vigente.
- **No chat, o `confirmacao_id` nunca chega ao modelo.** A rota intercepta `dados.pendente_confirmacao` antes de devolver o resultado da tool ao loop: emite bloco `ui` `confirmacao` pro cliente e alimenta o modelo com resultado sanitizado `{status:"aguardando_confirmacao_humana"}` (sem id, sem args). Se o envelope fosse repassado, o modelo poderia re-chamar a tool com o próprio `confirmacao_id` — auto-aprovação que anularia o portão humano.
- **Confirmação fora do modelo: `POST /api/ia/confirmacao`.** O botão "Confirmar" do card chama endpoint dedicado `{confirmacao_id, tool, args}` → sessão do usuário → `executarTool` canal `"chat"` → `ia_confirmacao_consumir` → executa → devolve `{ok, refId}|{erro}`. Determinístico (zero LLM no caminho de aprovação), audita via `ia_eventos` normal, reusa 100% do envelope MCP. "Cancelar" não chama nada — a prévia expira em 10min sozinha.
- **Gate de escrita no chat**: em vez do erro `:1620`, `escreve` no canal chat passa a produzir o mesmo `pendente_confirmacao` (a diferença é só o transporte de volta). Kill-switch: env `IA_ESCRITAS=0` restaura o comportamento atual (erro no chat; MCP continua igual se quisermos granularidade — decidir na implementação se um env basta; o default da spec é **um env só** pros dois canais, já que MCP writes já estão live sem flag).
- **Roles por tool** (defesa cedo + RLS garante):
  | Tool | roles | Delega pra |
  |---|---|---|
  | `registrar_interacao` | coord, supervisor, mentor_dpp, mentor_especialista | insert `interacoes` — `canal:'in_app'` fixo, `tipo ∈ contato\|apoio` (`nudge` fora: nudge é artefato do fluxo Lembrar com link wa.me, não um log solto), `nota` ≤300 |
  | `marcar_situacao_mentorado` | coord | `marcarSaidaCore` — motivo obrigatório p/ desistente; dupla viva bloqueia |
  | `emitir_link_instrumento` | coord, mentor_dpp | RPC homônima — devolve `{url:"/f/<token>", reutilizado}` |
  | `agendar_encontro` | mentor_dpp, mentor_especialista | `agendarEncontroCore` — coord nem vê a tool; se chamada mesmo assim o core devolve a recusa real. `roles` sem coord é belt+suspenders, não o guard |
  | `editar_campo_pessoa` | coord | allowlist `{whatsapp, nome_social}` profiles+mentorados, `{notas}` só mentorados; resolve a tabela por lookup do `pessoa_id` (uuid não colide entre tabelas) e valida campo×tabela |
- **`agendar_encontro` da tool ≠ `jovem_agendar_encontro` existente** — a do jovem segue pela RPC `agendar_encontro_mentorado` (policy própria); nenhuma unificação aqui.

## Schema

**Nenhuma.** `ia_confirmacoes` (0163), `ia_eventos` (0083/0159), `interacoes` (0008/0094), RPC `emitir_link_instrumento` (0080) e as policies de update em `profiles`/`mentorados`/`encontros`/`interacoes` já cobrem tudo. Números 0187+ ficam reservados sem uso.

## Domínio (src/lib/)

- `src/lib/escritas.ts` [NOVO] — `agendarEncontroCore`, `marcarSaidaMentoradoCore`, `editarCampoPessoaCore` (normalização whatsapp/`nomeProprio`/teto notas), `registrarInteracaoCore` (thin, por simetria). Cada um recebe o client escopado + `eu` (profile resolvido) e devolve `{error}|{ok}` — actions e tools consomem o mesmo corpo.
- `src/lib/actions.ts` — `agendarEncontro`/`marcarSaidaMentorado`/`salvarCampoRelatorio` viram wrappers do core (comportamento idêntico; refactor verificado por testes existentes).
- `src/lib/ia/tools.ts` — 5 tools novas com `escreve:true` + `resumo` (prévia pt-BR da ação, ex.: "Agendar encontro 6 da dupla Ana · Luisa pra 12/03 19h?"); o gate `canal !== "mcp"` vira `IA_ESCRITAS=0`-ou-canal, liberando `pendente_confirmacao` no chat.
- `src/app/api/ia/chat/route.ts` — intercepta `pendente_confirmacao` (não devolve ao modelo), emite `ui` `confirmacao`, alimenta tool-result sanitizado.
- `src/app/api/ia/confirmacao/route.ts` [NOVO] — sessão → `executarTool` → resultado. Mesma família de auth do `/api/ia/chat` (cookie/session, não PAT).
- `src/lib/ia/ui.ts` — `UiConfirmacao` no union `UiBloco` (`kind:"confirmacao"`, `resumo`, `tool`, `confirmacao_id`, `expira_em_minutos`); `STATUS_TOOL` pros nomes novos.

## UI

- `src/components/assistente-cards.tsx` — `ConfirmacaoCard`: resumo da ação, botões "Confirmar" (chama `/api/ia/confirmacao`, estado loading, mostra `{ok}` ou `{erro}` inline) e "Cancelar" (descarta; a prévia expira). Copy pt-BR sem travessão; o card expira visualmente após `expira_em_minutos`.
- `assistente-conversa.tsx` — renderiza o novo `kind` no `UiCard` (:1273); após confirmar, o card trava (uso único) e a conversa segue — o resultado da escrita aparece no card, não numa nova rodada do modelo.
- MCP externo: o client (Claude etc.) recebe o `pendente_confirmacao` no resultado da tool e pede approve pelo UX próprio — nada a fazer no app.

## Seed + demo

- Demo: tools `escreve` não rodam (sem sessão/`my_profile_id`); a conversa demo com respostas enlatadas não propõe escritas — nada a fazer além de garantir que o card de confirmação não aparece em demo.
- `seed-e2e-staging.mjs`: nenhuma fixture nova exigida (a dupla `…030` mentor+jovem cobre os casos); se o e2e de escrita quiser isolar, pode criar encontro/interacao próprios e limpar com os helpers existentes.

## Testes

- **vitest `tests/`**: cores extraídos — `agendarEncontroCore` recusa coord com a mensagem real; dupla pausada/encerrada recusa; esp sem pedido aceito recusa criar; `marcarSaidaMentoradoCore` bloqueia dupla viva e exige motivo p/ desistente; allowlist `editarCampoPessoaCore` rejeita `email`/`papel`/`dados_civis` (allowlist, não blocklist — campo fora da lista = "não editável por aqui").
- **`tests/ia-tools.test.ts`** (estender o padrão do supaFake): cada uma das 5 — 1ª chamada devolve `pendente_confirmacao` sem tocar RPC/insert de domínio; `confirmacao_id` inválido não executa; consumo válido executa (rpc/update esperado); gate `roles` nega mentor/jovem onde cabe.
- **Rota chat**: `pendente_confirmacao` não vaza `confirmacao_id` no tool-result do modelo (assert do payload sanitizado); `ui` `confirmacao` emitida.
- **e2e** (`assistente.spec.ts` ou spec própria): mentor propõe `agendar_encontro` → card aparece → Confirmar executa → encontro agendado visível; coord chama `agendar_encontro` via MCP → recebe a recusa "Quem agenda é a dupla".

## Critérios de aceite

- [ ] As 5 tools existem no registry com `escreve:true`, `roles` e `resumo` — e delegam aos cores/RPC existentes (zero regra reimplementada; o diff de `actions.ts` é extração, não cópia).
- [ ] `registrar_interacao` grava em `interacoes` com `canal='in_app'` e `tipo ∈ {contato, apoio}`; mentor só loga na própria dupla (policy); coord em qualquer uma.
- [ ] `marcar_situacao_mentorado` honra motivo-obrigatório (desistente) e bloqueio de dupla viva — mesmos erros do core da action.
- [ ] `agendar_encontro` chamada por coord (chat ou MCP) devolve "Quem agenda é a dupla…" — o guard sobrevive à tool; mentor agenda só na própria dupla (RLS); trilha especialista recusa criação fora do pedido aceito.
- [ ] `editar_campo_pessoa` só edita `whatsapp`/`nome_social` (profiles e mentorados) e `notas` (só mentorados); qualquer outro campo rejeita.
- [ ] `emitir_link_instrumento` devolve `/f/<token>` só pra coord/mentor_dpp da dupla — demais papéis recebem o erro da RPC.
- [ ] Ciclo completo: propor → confirmar → executar → **2 `ia_eventos`** (a prévia e a execução) com mesmo `request_id`/profile — rastro "o que foi aprovado" auditável.
- [ ] Confirmação é atômica: dono errado, tool divergente, args alterados, expirada (>10min) ou já usada → falha sem efeito colateral.
- [ ] No chat o `confirmacao_id` não aparece no tool-result do modelo (sanitizado); o card é a única via de approve — nenhuma escrita executa sem o clique.
- [ ] `IA_ESCRITAS=0` desativa as escritas novas nos dois canais sem quebrar as de chamados já live.

## Fora de escopo

- Novos campos no `editar_campo_pessoa` além dos 3 (email, papel, dados civis, datas) — o "editar coisas fáceis" é allowlist por design.
- Tools de escrita fora das 5 (desfecho de dupla, encaminhamentos, solicitações já existentes fora do lote) — entram por issues próprias.
- `pessoa_notas` (notas privadas por autor) — conceito diferente de `mentorados.notas`; não entra na allowlist.
- Rollback genérico "desfazer escrita" — a confirmação é o ponto de não-retorno; desfazer é gesto de tela.
- OAuth/alternate Bearer no endpoint de confirmação — chat é sessão de app; MCP não usa o endpoint (aprova no client).
- O contrato `requer_confirmacao`/`confirmado:true` do sdd 179 §7 — substituído pelo envelope `pendente_confirmacao` já implementado; sdd fica como registro histórico.
