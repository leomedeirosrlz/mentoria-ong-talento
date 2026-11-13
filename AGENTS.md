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

# Estado do projeto

Vertical slice funcionando contra o **Supabase remoto** (project ref `yhjzmxleotahijinjepl`, MCP `supabase` em `.devin/mcp_config.json`). Banco com dados reais — **não re-seedar dados demo**.

- Next.js 16 (App Router) + React 19, Tailwind v4, Base UI (`src/components/ui`), Phosphor Icons.
- `pnpm dev` · antes de dar por pronto: `npx tsc --noEmit` e `npx eslint src/` — ambos saem limpos.
- Estrutura: leituras em `src/lib/queries.ts` (React.cache + getClaims), writes em `src/lib/actions.ts` (retornam `{error}`/`{ok}`, nunca lançam), domínio puro em `src/lib/ciclo.ts`.

# Docs do agente — ler sob demanda

Detalhe canônico por tema; leia **só o que a tarefa tocar**:

| Doc | Ler quando |
|---|---|
| `docs/convencoes/constitution.md` | referência estendida das regras acima + stack |
| `docs/convencoes/architecture.md` | queries/actions/RLS, domínio (semáforo, auth handoff), modo demo |
| `docs/convencoes/conventions-ui.md` | **sempre que tocar UI** — escala tipográfica, padrões (DuplaLinha, SaudePrograma, abas por URL), copy, movimento |
| `docs/convencoes/ci-e2e.md` | migrations, deploy, e2e local/preview, fixtures, staging — **obrigatório antes de push/merge/deploy** |

Backlog e pendências: **`BACKLOG.md`**.
