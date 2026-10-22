# REALIZA-47 — sdr.md (segurança, privacidade, LGPD)

## Modelo de ameaça

- **Vazamento entre turmas** (o risco que motivou o cluster): jovem/mentor da T1 ver dados da T2. `mentorados_turma` recriada por `turma_id` mantém o isolamento — e passa a ser impossível um typo de label juntar turmas por acidente (hoje a string casa exato, então já é segura, mas frágil: "T1 · 2026/2027" vs "T1·2026/2027" criaria turmas-irmãs invisíveis).
- **Escalada via escopo**: `profile_papeis.escopo_turma_id` FK impede escopo apontando pra turma inexistente. RLS de `profile_papeis` (`0085`) já restringe leitura (self + staff) e escrita (coord-only) — herda.
- **Anon**: `turmas`/`programas` sem grant pra `anon`. Rotas públicas (`/f/[token]`, `/resumo/[slug]`) não expõem turma além do que já expõem hoje via RPC security definer — `resumo_links` da 167 ganha FK mas a RPC continua projetando só o resumo. A verificar: RPCs públicas que hoje retornam label de turma (ex.: resumo) devem seguir retornando `turmas.rotulo`, nada mais.

## LGPD / minimização

- `turmas`/`programas` são metadados organizacionais — **sem dado pessoal**. Única interseção: `turma_inscricoes` (167) liga pessoa→turma; a FK não muda a sensibilidade.
- **Menores**: `mentorados_turma` é a única via de exposição entre pares; mantém exatamente as colunas atuais (nome/avatar — a verificar definição completa em `0076`), só troca o join.
- Auditabilidade: `created_by`/`created_at` em `turmas` `[NOVO]`; quem criou turma/erroneamente uniu labels fica rastreável.
- Retenção: turma encerrada (`status='encerrada'`) retém histórico — não deletar. Sem anonimização nesta issue (política de retenção é REALIZA-33).

## Rollout / risco operacional

- Migration com backfill em produção contém dados reais — rodar em staging primeiro (`db push --db-url` staging), validar `select count(*) from duplas where turma_id is null and turma is not null` = 0, depois prod antes do merge (ordem CI da casa).
- Rollback seguro até PR 4 (texto legado intacto).
