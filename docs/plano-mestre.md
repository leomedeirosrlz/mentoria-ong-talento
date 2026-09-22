# Plano mestre — o que resta (pós-waves 1–4)

Decisões D1–D10 tomadas. Migrations 0033–0038 aplicadas no remoto. Abaixo, o restante — delegável agora vs. depende do Thiago.

## Wave A — rituais do programa que faltam (schema + feature, paralelo)

### A1. Formulários de sistema + wiring de avaliação (`0039_formularios_sistema.sql`)
- `formularios.sistema text` (null | chave canônica) — marca formulários oficiais do programa, não editáveis/deletáveis.
- Seed de formulários-oficiais derivados dos docs: **Anamnese Social** (onboarding do mentorado, do cronograma JS + campos do form BP), **Avaliação 360º** (guia cap. 14 — único form do programa), **Autoavaliação do mentor** (5 perguntas do guia).
- Auto-wiring: resposta submetida via link com `dupla_id` + `sistema='avaliacao_360'` → marca `encerramentos.checklist.avaliacao_360_enviada=true` (na RPC `submeter_resposta_formulario`) + notificação à coordenação (`tipo` novo `formulario_respondido`).
- UI: item do checklist mostra origem ("recebida via formulário em dd/mm"), botão "Enviar anamnese" na ficha do mentorado, badge de status de resposta nos links.
- **Owner de**: `src/lib/forms/*`, `actions-formularios.ts`, componentes de formulário/encerramento, seção da ficha da dupla (encerramento).

### A2. Presença em formação (`0040_presencas.sql`)
- `presencas` (id, ciclo_evento_id, profile_id, presente, marcado_por, marcado_em) — coord marca a chamada nos 2 encontros de formação (e qualquer `ciclo_evento` tipo formacao/marco presencial).
- `profiles.formacao_ok` vira derivado: trigger marca quando o profile tem presença nos 2 encontros de formação do ciclo (coord ainda pode forçar manual — exceção documentada).
- UI: no detalhe do dia da agenda (evento `formacao`), coord vê lista de mentores do ciclo com toggle presente; na ficha da pessoa, chip "formação: 2/2 encontros".
- **Owner de**: agenda/detalhe, novo `src/lib/actions-presenca.ts`, `queries-presenca.ts`, componente `presenca-lista.tsx`.

### A3. Sessões de supervisão (`0041_supervisoes.sql`)
- `supervisoes` (id, supervisor_id, mentor_id, dupla_id null, data, resumo, created_by, created_at).
- RLS: supervisor escreve/lê as suas; coord lê tudo; mentor lê as que o citam.
- UI: supervisor registra sessão (dialog na home ou na ficha da dupla supervisionada); timeline na ficha da dupla + no perfil do mentor; coord vê listagem.
- **Owner de**: novo `actions-supervisao.ts`, `queries-supervisao.ts`, `supervisao-dialog.tsx`, `supervisoes-section.tsx`.

## Wave B — depois da A (arquivos compartilhados)

### B1. Quick-fixes do backlog (1 agente)
- `duplas.ciclo` com seletor na criação/edição de dupla (default do ciclo vigente).
- Trigger banco: bloquear `realizado`→outro status (defesa TOCTOU residual).
- Statuses mortos `remarcado`/`cancelado`/`atrasado`: remover do enum se zerados no remoto (verificar via query primeiro).
- `duplas.pdm_url` (`0042_pdm_url.sql`) — link Drive/Docs do PDM, editável pelo mentor, visível na ficha.
- `sonner richColors` → tokens da marca; `importar-csv` `file.text()` catch + input reset; `cn` padronizado; `me()` early-return; excluir pessoa com vínculo histórico → disabled explicado; `material-actions` inline; fetch sem estado de erro nos dialogs de dupla.
- Órfãos `registro-anexos`: delete de objetos no `deleteDupla`/`deleteRegistro` (storage.delete via action antes do delete da row).
- Export CSV de pessoas/mentorados (botão coord, mesma pegada do CSV de registros).
- Signup → allowlist: trigger `handle_new_user` rejeita e-mail sem `profiles` pré-cadastrado (migração — fecha o signup aberto sem tocar dashboard).

### B2. Vitest (1 agente)
- Setup + testes das puras: `saudadeDaDupla`, `parseCsv`, `normWhatsapp`, `mapRole`, `erroAmigavel`, `primeiroEncontroFaltante`, `alvoAgendamento`, `disponibilidadeTexto`, checklist helpers.

### B3. Types gerados (1 agente)
- `supabase gen types --linked` → `src/lib/database.types.ts`; remover `as unknown as` onde seguro (manter narrows manuais onde o tipo gerado é largo demais — decisão caso a caso).

### B4. Demo parity (1 agente — dono único de `src/lib/demo/*`)
- Fixtures pra presenças, supervisões e respostas de formulário; `client-stub` cobre as novas tabelas/RPCs; onboarding de cada persona menciona as novidades se fizer sentido.

## Wave C — integração e validação (eu)
- Aplicar migrations 0039–0042+ no remoto (ordem, sem `db push` cego).
- `tsc --noEmit` + `eslint src/` limpos; agente validador read-only no diff total.
- `BACKLOG.md`/`AGENTS.md` reconciliados.

## Depende do Thiago (não delegável)
- Resend: deletar `realiza.vc` da outra conta → recriar aqui → DNS → API key → sender `no-reply@realiza.vc` no Supabase Auth.
- Dashboard Supabase Auth: Site URL `https://realizavc.vercel.app` + Redirect `https://realizavc.vercel.app/**`.
- Após SMTP: e-mail pra coord quando `precisa_apoio`.
- Decisão: nudges iniciados pelo mentor ("Falar com mentorado") entram no log `interacoes`? (hoje não logam — privacy vs. rastro)

## Fora de escopo confirmado
- Avaliação por sessão — outra plataforma por ora (D5).
- Login do mentorado — nunca (D5).
- EaD — opcional, não modelar (D3).
- Matching algorítmico — curadoria humana é decisão registrada.
