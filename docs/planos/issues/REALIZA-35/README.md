# REALIZA-35 — Primeiro acesso: identidade no link, orientação a e-mail não cadastrado, deliverability Hotmail/Outlook

[Jira REALIZA-35](https://realizavc.atlassian.net/browse/REALIZA-35)

**Status: ABERTO** — o fluxo auth (magic link implícito + handoff
`login_handoffs`, allowlist `0045`, `/auth/definir-senha` dispensável)
está construído e pentestado. O issue aponta três lacunas: (1) a copy não
mostra **quem** o link abre (nome/papel), (2) e-mail não pré-cadastrado
só recebe frase — sem ação real, (3) Hotmail/Outlook filtram
agressivamente e não há tratamento de remetente/deliverability.

## Contexto verificado (não refazer)

- `src/app/login/login-form.tsx`: OTP implícito via `createOtpClient`,
  nonce `?h=` no `emailRedirectTo` → `/auth/link`; poll
  `pegar_login_handoff` + `onAuthStateChange` + `visibilitychange`;
  checagem de e-mail da sessão resgatada (anti-fixação); cooldown 60s
  com parse real do 429; estados "link enviado"/"link inválido".
- `src/app/auth/link/link-landing.tsx`: aba do e-mail nunca cria sessão —
  deposita tokens via `registrar_login_handoff` → `/auth/confirmado`;
  link queimado → `falhar_login_handoff` + card sem botão.
- `supabase/templates/magic-link.html`: template completo (marca, "vale
  1h, uso único", `{{ .Email }}` visível) — **mas não mostra nome/papel**
  (GoTrue não injeta dados de `profiles` — limitação da plataforma).
- `/auth/definir-senha`: "Crie sua senha", dispensável
  (`senha_dispensada` user_metadata), modo `recovery` separado.
- Erro allowlist → "E-mail não cadastrado. Fale com a coordenação…" —
  **sem ação**.
- Remetente: `auth@realiza.vc` via SMTP Resend no Supabase (AGENTS.md);
  e-mail transacional `noreply@realiza.vc` existe.

## Escopo

1. **Identidade**: `/auth/confirmado` e `/auth/link` mostram
   "Entrando como {nome} — {papel}" vindo do RPC `registrar_login_handoff`
   (definer conhece o usuário pelos tokens → join `profiles`).
2. **Não-cadastrado**: ação real — botão "Pedir acesso" que notifica a
   coordenação (RPC nova [NOVO]) + mailto fallback.
3. **Deliverability**: copy honesta ("pode ter ido pro lixo eletrônico —
   Outlook/Hotmail filtram mais"), checklist de remetente/DNS pra ops,
   sem mudança de infra sem o Thiago.

## Esforço estimado: **M**

## Riscos / blockers

- **BLOCKER (ops/Thiago)**: SPF/DKIM/DMARC do `realiza.vc` pra auth do
  domínio no Resend + reputação — fora do repo; checklist documentado.
- `registrar_login_handoff` devolver nome/papel — expõe identidade a
  quem tem o link (o link JÁ é credencial — aceitável, ver sdr).
- `solicitar_acesso` anon-write — rate limit obrigatório.

## Documentos

`plan.md` · `design.md` · `sdr.md` · `acceptance.md` (Tier B+).
