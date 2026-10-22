# REALIZA-16 — SDR (segurança & privacidade)

## Modelo de ameaças

1. **Órfão silencioso**: resposta de menor sem vínculo — vira dado sem dono
   (impossível atender exclusão/acesso LGPD por titular). A própria issue é a
   mitigação; a constraint fecha a porta.
2. **Vínculo errado retroativo**: reconciliar resposta ao mentorado errado
   mistura dados sensíveis de dois menores. Mitigação: ação coord-only,
   confirmação explícita, e idealmente registrar auditoria (ver abaixo).
3. **Identidade ≠ autorização**: `mentorados.profile_id` populado não pode
   conceder acesso sozinho — `my_mentorado_id()` (0066) já separa os dois
   conceitos; policies sempre combinam com `my_role()='mentorado'`. Manter.

## LGPD (dados de menor)

- **Minimização**: a âncora é um uuid — nada de e-mail/CPF no link.
- **Finalidade**: vínculo serve pra continuidade da jornada; reconciliação
  retroativa é operação interna da coordenação.
- **Direitos do titular**: com âncora completa, "exportar tudo do jovem X"
  vira joins por `mentorado_id` — a auditoria é também o enabler do direito
  de acesso/exclusão futuro.
- **Retenção**: nada muda — a preservação é o requisito da issue; a eventual
  exclusão segue a política de retenção do programa (fora de escopo aqui,
  relacionado à REALIZA-33 revisão LGPD).

## Auditoria

- O script de auditoria (`plan.md` passo 1) roda periodicamente no CI — saída
  em log de pipeline (sem dados pessoais, só contagens e ids).
- Reconciliação manual (plano B) deveria registrar quem vinculou — usar o
  padrão `interacoes` (timeline da dupla) já existente: `interacoes.tipo`
  'vinculo_resposta' `[NOVO tipo a confirmar]` — **a verificar** se o enum de
  `interacoes.tipo` admite valor novo; se for text-check, migration amplia.

## Tokens

Sem mudança no modelo de token (`formulario_links.token` 192 bits). A issue
reforça: token é **posse**, nunca identidade — logs e Sentry seguem
scrubbando (`src/lib/sentry-scrub.ts` já cobre `/f`).
