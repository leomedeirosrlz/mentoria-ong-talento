<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Regras do projeto (Thiago)

- **SLC, não MVP.** Uma vertical slice completa e polida. Nada de placeholder, stub, template genérico ou "depois a gente melhora". Cada tela sai pronta.
- **Sem gambiarras.** Não contornar infra quebrada com workarounds. Se uma integração não está pronta, faz o passo a passo correto — não inventa caminho alternativo.
- **Integrações reais quando forem necessárias.** Resend, Supabase, Vercel, WhatsApp Cloud API: quando entrar, entra de verdade — config, keys, fluxo completo.
- **Supabase:** usar `supabase start` oficial do CLI. Docker local quebrado (iptables) → pedir `sudo systemctl restart docker` ao Thiago; não montar stack manual.
- **Copy em pt-BR** em toda interface.
- Fonte da verdade do domínio: os guias do programa (PDFs). A dupla agenda os encontros; a coordenação monitora e faz nudge — não agenda por ela.

# Estado do projeto (set/2026)

Plataforma operacional do Programa de Mentoria — vertical slice funcionando contra o **Supabase remoto** (project ref `yhjzmxleotahijinjepl`, MCP `supabase` em `.devin/mcp_config.json`). `.env.local` aponta pra nuvem; o `supabase start` local não está em uso no dia a dia. Banco com dados reais — **não re-seedar dados demo** (o `seed.sql` agora só tem domínio: `ciclo_eventos` + `materiais`).

## Stack & verificação

- Next.js 16 (App Router) + React 19, Tailwind v4, Base UI (`src/components/ui`), Phosphor Icons.
- `pnpm dev` · antes de dar por pronto: `npx tsc --noEmit` e `npx eslint src/` — ambos saem limpos.

## Arquitetura

- `src/lib/queries.ts` — leituras server-side com `React.cache` + `auth.getClaims()` (valida JWT local, sem round-trip).
- `src/lib/actions.ts` — server actions; retornam `{ error }` ou `{ ok }`, nunca lançam.
- `src/lib/ciclo.ts` — domínio puro: semáforo (`saudadeDaDupla`), labels/opções dos enums, datas, `waLink`.
- `src/lib/supabase/{server,client,middleware}.ts` — um client por contexto; middleware protege tudo exceto `/login` e `/auth/*`.

## Domínio

- `ciclo_eventos` = calendário oficial do ciclo (16 encontros, terças). O semáforo compara encontros esperados (datas já passadas) vs. realizados.
- `encontros` são agendados pela dupla (`unique(dupla_id, numero)`); `registros` = follow-up pós-encontro com os campos do form semanal de mentores (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`) + tema/instrumento do guia.
- Semáforo: pedido de apoio, avaliação baixa **+** dificuldade, ou ≥2 encontros atrasados → `risco`; 1 atraso, avaliação baixa, dificuldade identificada, registro pendente ou encaminhamento vencido → `atencao`.
- RLS inteiro via `my_role()` / `my_profile_id()`; mentor escreve só na própria dupla, supervisor lê as supervisionadas, coordenação tudo.
- Auth: magic link; profiles pré-cadastrados pela coordenação e o trigger `handle_new_user` vincula `user_id` no 1º login (sem papel → tela "cadastro recebido"). Login por senha existe só pra teste.

## Pendências conhecidas

Backlog completo e priorizado em **`BACKLOG.md`**. Resumo do que mais dói:

- Trilha `mentor_especialista` (5 encontros) não modelada — a UI deixa criar, mas cai num ciclo de 16/DPP errado. Decidir antes de popular dados.
- Materiais com upload real (`0010`): `materiais.path` + bucket privado `materiais` + policies de storage espelhando audiência; `/api/material/[id]` → signed URL 300s. Documentos oficiais chegam ao longo do ciclo — material sem `path` nem `url` renderiza "em breve" (estado legítimo). Anexos de evidência por registro seguem separados (`registro_anexos` + bucket `registro-anexos`).
- "Meu perfil" pra self-edit de nome/WhatsApp não existe.
- Produção: SMTP Resend pro magic link, `SITE_URL`/`redirect_urls` de prod, remover login por senha, deploy Vercel.
