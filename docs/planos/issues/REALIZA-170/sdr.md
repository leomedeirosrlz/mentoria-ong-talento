# REALIZA-170 — security & data review (dado de menor em superfície pública)

## O que muda de risco

Hoje `/resumo/<slug>` é **obscuridade pura**: um slug fixo, sem senha, sem
revogação, sem auditoria. A 170 troca isso por um modelo de credencial real —
mas o preço é **mais links vivos ao mesmo tempo**, cada um autorizando um
recorte. O design inteiro parte de: *senha compartilhada é fator fraco; todo o
resto (escopo, auditoria, expiração, allowlist) é o que faz a troca valer a
pena.*

## Modelo de ameaças

| Ameaça | Cenário | Mitigação | Residual |
|---|---|---|---|
| Brute force na senha | bot varrendo `abrir_relatorio` | bcrypt `crypt('bf')` ~80ms/tentativa + `pg_sleep(0.3)` na falha + **5 falhas/15min por (slug,ip_hash)** via `resumo_acessos` + advisory lock serializa concorrentes | Senha de 8 chars do alfabeto sem ambíguos (~31⁸ ≈ 8×10¹¹) × 20 tentativas/h/IP ≈ impossível na prática; lockout por IP contornável com botnet — mitigado pelo rate **por slug também**? Ver gap §R1. |
| Enumeração de slugs | varrer `/resumo/<rand>` | slug 18B b64url (~108 bits); `relatorio_link_info` devolve só `{existe, estado, precisa_senha, titulo}` — sem oráculo de conteúdo; inexistente → 404 | Crawlers acham? `noindex` + nunca linkado; aceitável. |
| Senha viaja em claro | WhatsApp, print, histórico | Inerente ao modelo pedido; mitigações: senha gerada (sem reúso de senhas pessoais), revogação 1-clique, expiração opcional | Consciente — a senha é "segredo compartilhado de canal", não credencial pessoal. |
| Cookie de acesso roubado | XSS/dispositivo compartilhado | httpOnly + Secure + SameSite=Lax + `path=/resumo/<slug>` (não sai do slug) + 7d | Mesmo nível da senha — não piora o modelo. |
| Escalação de escopo via `config` | editar jsonb pra pedir colunas | `config` só é escrita por RPC coord; `abrir_relatorio` monta `dados` por **allowlist SQL** — uma coluna nova no config não vaza nada porque o SQL não a conhece | Invariante central — ver §allowlist. |
| Token/URL em logs | slug+senha na URL | Senha **nunca** em query string (form POST); o scrub do Sentry já cobre `token`/`code` e redacta path de `/resumo` (sentry-scrub.ts:14-15); a RPC recebe senha como arg — args não vão ao Sentry (`databaseQueryData:false`) | ✔️ |
| Senha em logs de banco | args da RPC gravados? | PostgREST não loga args; `resumo_acessos` grava só `ok/motivo` — a RPC **não** persiste a senha tentada | Invariante escrita no sdd. |
| Dados de menor | colunas no payload | Contato opt-in (`expor_contato`); `*_pessoal`/`dados_civis`/`form_bruto`/`documento_path` **nunca** no allowlist; assinaturas sem CPF/RG/IP/hash/snapshot | §LGPD. |
| Link revogado ainda aberto | sessão/cookie pré-revogação | Revogado corta na RPC — cada render re-verifica; cookie não vale nada depois | ✔️ |
| Read-time staleness | dados vivos = vazamento contínuo | `expira_em` (30/60/90d) + revogação manual; UI mostra nº acessos pra coord perceber circulação anômala | Aceitável. |

### R1 — rate limit por slug global?

O rate é por `(slug, ip_hash)`. Um atacante distribuído (botnet) foge. Segunda
régua proposta no sdd: `count(falhas do slug nas últimas 24h) >= 50` →
`motivo:'limite'` global. Custo: 1 count extra na RPC (índice parcial
`resumo_acessos_falhas` cobre). **Incluir** — é barato e fecha o caso botnet.

### R2 — info do link antes da senha

`relatorio_link_info` devolve `titulo` pra quem tem o slug, sem senha. Título
pode conter nome de turma/pessoa ("Prestação T2"). Risco pequeno (slug já era
secreto), mas o título é escolha da coord — documentar na UI: "o título aparece
antes da senha — não coloque dado sensível nele". Microcopy incluída no dialog.

## LGPD — análise de exposição

Dados de menores (`mentorados`) no payload:

| Tipo | Coluna | Público? | Justificativa |
|---|---|---|---|
| grade | nome, cidade/uf, papel, par, status, demanda | sim (default) | Operacional mínimo — é o que o link atual já serve |
| grade | email, whatsapp | só `expor_contato` | Contato direto de menor = maior risco; opt-in explícito + aviso na UI |
| grade | data_nascimento, genero, cor_raca, motivacao, dados_civis, form_bruto, responsavel | **nunca** | Sensível (`*_pessoal` = coord-only por design 0034/0054) |
| ciclo | encontro: numero, datas, status, motivo_reagendamento, duracao | sim | Agenda da dupla — já visível no export interno |
| ciclo | registro: created_at, avaliacao, atividades | sim | Avaliação é enum; atividades é catálogo fechado (sem "outro" livre? — **atividades[] pode carregar texto livre do campo "outro"** — filtrar: só valores do `ATIVIDADES_ENCONTRO` saem; custom text dropado no SQL/app) |
| ciclo | tema, ferramenta, reflexoes, observacoes, *_detalhe, precisa_apoio | **nunca** | Texto livre do mentor + flag interna de apoio |
| assinaturas | nome, tipo, documento, versao, status, datas | sim | Prestação de contas de contratos |
| assinaturas | dados_snapshot, assinatura_texto, ip, user_agent, hash_documento, token, url_pdf | **nunca** | Evidências + PII civil (CPF/RG) — ficam no export coord-only |
| respostas | — | **fora de v1** | Respostas incluem anamnese social e 360º — texto livre **sobre e por** menores (LGPD Art. 11). A janela pública de senha compartilhada não é canal adequado; se precisar, o CSV coord-only segue interno. Reversível: adicionar tipo depois com allowlist por formulário. |

**Minimização:** allowlist por tipo no SQL (não "select * menos"); contato
opt-in; título sem PII (recomendação UX).

**Retenção do log:** proposta na 183 — poda lazy `>13 meses` dentro da RPC
de abertura (molde `login_handoffs`). Aceitar quando a RPC existir.

**Direito de exclusão:** `resumo_acessos` pseudonimizado (hash) — resposta
padrão "não é possível identificar o acesso individual" é compatível com o
desenho (documentar em `/privacidade` quando a página de privacidade for
atualizada — fora de escopo aqui).

## RLS / grants

- `relatorio_links`/`resumo_acessos`: `revoke all from public, anon`;
  `authenticated` só `select` em `relatorio_links` (policy coord) e
  `resumo_acessos` (policy coord). Escrita só por RPCs definer ou service role.
- As 2 RPCs públicas são `security definer` — executam como dono; grant
  `execute to anon, authenticated` é a única porta. Nenhuma policy na tabela
  autoriza anon diretamente — mesmo padrão `login_handoffs`.

## Auditoria

Cada acesso/tentativa grava `resumo_acessos`: `slug`, `link_id`, `ip_hash`,
`user_agent`, `params`, `ok`, `motivo`, `acessado_em`. A UI da coord mostra por
link: último acesso, total, motivos de falha recentes (alimenta "alguém está
tentando?"). Não há alerta ativo (sem e-mail em volume — fora de escopo; a
revisão do painel de links é o controle).

## Checklist de conformidade do codebase

- `revoke/grant` explícitos na migration (molde 0103)
- RPCs `security definer` + `set search_path to 'public'` (molde 0094/0103)
- Advisory lock no check de rate (molde `pg_advisory_xact_lock` 0094)
- Senha fora de URL/log/Sentry; cookie httpOnly+Secure+path-scoped
- Falha indistinguível externamente (`{ok:false}` genérico; motivo só no log)
- `noindex`/`nofollow` já presente na metadata
