# REALIZA-35 — plan.md

## Frente A — identidade do link (quem está entrando)

**Problema**: template GoTrue só tem `{{ .Email }}` — nome/papel não
chegam ao e-mail. A identidade aparece **onde o token é consumido**.

### A1. `registrar_login_handoff` devolve identidade

Migration `0106+` (a verificar número livre — última é 0105):
`CREATE OR REPLACE` da função (0049) — após validar e gravar tokens,
`select nome, role` do `profiles` do `auth.uid()` dos tokens depositados
e retornar `{ok:true, nome, papel}`. Definer pode ler profiles; o
retorno vai pra aba do e-mail e pro poll da aba que pediu — ambos já
posseiros do bearer. **Invariante**: RPC segue sem criar sessão na aba
do e-mail; só devolve display-name.

### A2. `/auth/confirmado` + `link-landing.tsx`

- `link-landing`: `registrar_login_handoff` retorna `{nome,papel}` →
  repassa por query ao `/auth/confirmado?nome=&papel=&next=` —
  **query expõe nome/papel na URL**: aceitável? É info de quem já clicou
  no link (bearer). Alternativa sem vazar em URL: guardar em
  `sessionStorage` na aba do e-mail e ler em `/auth/confirmado` —
  **decisão: sessionStorage** (mesma aba, zero vazamento em URL/
  histórico/referer). Se a RPC não devolver (versão velha em staging),
  confirmado cai no copy genérico atual.
- `/auth/confirmado`: lê `sessionStorage.getItem("handoff_quem")` →
  "Tudo certo, {primeiro nome}! Você entrou como {papelLabel}." +
  "pode fechar — a aba onde você pediu o link já entrou." Fallback:
  texto atual. `papelLabel` de `lib/ciclo.ts` (helper compartilhado —
  **regra**: nunca exportar de arquivo "use client").
- Aba que pediu: entra pelo poll → `/auth/definir-senha` (1º acesso)
  mostra o mesmo "Você está entrando como {nome} — {papel}" — definir-senha
  tem sessão → `getMe` client-side ou ler do `user_metadata`? profile
  não é user_metadata — buscar `profiles` via client (sessão já criada
  → RLS deixa ler o próprio row). [NOVO] hook/fetch mínimo lá.

### A3. E-mail template

`supabase/templates/magic-link.html`: **sem nome/papel possível** —
documentar a limitação; melhoria real: subject/head já existem; rodapé
já diz "Se você não pediu, ignore". Adicionar linha **"Este link entra
como o e-mail {{ .Email }} — se não é você, não clique."** (identidade
possível = o próprio e-mail; honesta). Re-render via
`render-templates-auth.ts` + colar no dashboard (procedimento já
documentado — a verificar script path `scripts/` ou `supabase/`).

## Frente B — e-mail não cadastrado: ação real

### B1. RPC `solicitar_acesso(p_email text)` [NOVO] — definer, grant anon

- Valida formato de e-mail; se o e-mail **já** está em `profiles` →
  retorna `{error:"…já cadastrado"}` (não vaza — a pessoa que digitou
  sabe o e-mail que digitou).
- Senão: `insert into notificacoes` pra cada `role='coordenacao'`:
  tipo `pedido_acesso` [NOVO no check de tipo — a verificar constraint
  de `notificacoes.tipo`], payload `{email}`; dedup: se existe
  notificação `pedido_acesso` do mesmo e-mail <24h → `{ok:true}` sem
  duplicar (rate limit natural).

### B2. `login-form.tsx`

Erro allowlist vira card com CTA: "E-mail não cadastrado" +
`Button outline "Pedir acesso"` → `supabase.rpc("solicitar_acesso")` →
sucesso: "Pedido enviado — a coordenação libera seu acesso e te avisa."
+ `mailto:` fallback existente preservado.

## Frente C — deliverability (copy honesta + checklist ops)

### C1. Copy (código)

- Painel "Link enviado": trocar "confira o spam" por
  **"Se não chegar em alguns minutos, confira o lixo eletrônico ou spam
  — Outlook e Hotmail costumam filtrar o primeiro e-mail."** +
  sublinha "Marque como 'não é lixo' pra próximos chegarem direto."
- Card "link inválido" e erro de rede: inalterados.

### C2. Checklist ops (documento no plan — executar com Thiago)

1. Resend → domain `realiza.vc`: DKIM (CNAME) + SPF `include:` na zona
   Cloudflare; DMARC `v=DMARC1; p=quarantine` (p=none se já existe —
   **a verificar** com Thiago o estado atual).
2. Supabase Auth → SMTP: From-name "Realiza.vc" (não só endereço) —
   painel Auth→SMTP; subject do template já é pt-BR.
3. Warm-up: baixo volume já; monitorar bounce no dashboard Resend.
4. Hotmail específico: sem whitelist possível — mitigação é reputação +
   copy (C1) + WhatsApp como canal de suporte (já operacional).

**BLOCKER: acesso DNS/Cloudflare + painel Supabase = Thiago.**

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/010N_*.sql` [NOVO] | `CREATE OR REPLACE registrar_login_handoff` (+ retorno nome/papel), `solicitar_acesso`, possível check de `notificacoes.tipo` |
| `src/app/auth/link/link-landing.tsx` | sessionStorage da identidade → confirmado |
| `src/app/auth/confirmado/page.tsx` (+ client) | card "Entrando como…" |
| `src/app/auth/definir-senha/definir-senha-form.tsx` | linha de identidade no 1º acesso |
| `src/app/login/login-form.tsx` | card não-cadastrado + CTA pedir acesso; copy lixo eletrônico |
| `supabase/templates/magic-link.html` | linha "entra como {{ .Email }}" |

## Ordem/rollback

PR único (migration + UI). Ordem AGENTS: migration → staging antes do
push, prod antes do merge. Rollback = revert; RPC antiga no remoto ainda
funciona com a UI nova (confirmado cai no genérico) — forward-compatible.
