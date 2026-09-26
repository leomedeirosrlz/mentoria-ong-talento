<div align="center">
  <a href="#root"><img src="./banner.svg?v=1" alt="Realiza.vc — Programa de Mentoria Social" width="100%"/></a>
</div>

> 🇺🇸 [English version](../README.md) · plataforma, interface e dados em pt-BR por definição.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <pre lang="bash"><code>$ realiza.vc / briefing
------------------------------------------------
• produto : plataforma do Programa de Mentoria Social
• entidade: dupla · mentor ↔ mentorado (matching)
• ciclo   : 16 encontros · ciclo_eventos (terças)
• saúde   : semáforo · ok / atenção / risco
• auth    : magic link + handoff entre abas (nonce)</code></pre>
    </td>
    <td width="50%" valign="top">
      <pre lang="python"><code>class Plataforma:
    stack    = ["next 16.3 + react 19", "tailwind v4 · base ui",
                "supabase · 54 migrations · rls"]
    auth     = "fluxo implícito + login_handoffs (ttl 10min)"
    surfaces = ["/demo público", "/f/[token]", "/assinar"]
    testes   = 156      # vitest, funções puras
    pwa      = True</code></pre>
    </td>
  </tr>
</table>

### ❯ badges

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.3-a2ca44?style=flat-square&logo=nextdotjs&logoColor=ffffff&labelColor=262626" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-a2ca44?style=flat-square&logo=react&logoColor=ffffff&labelColor=262626" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-RLS_%2B_storage-a2ca44?style=flat-square&logo=supabase&logoColor=ffffff&labelColor=262626" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-a2ca44?style=flat-square&logo=tailwindcss&logoColor=ffffff&labelColor=262626" alt="Tailwind" />
  <img src="https://img.shields.io/badge/pnpm-11.3-a2ca44?style=flat-square&logo=pnpm&logoColor=ffffff&labelColor=262626" alt="pnpm" />
  <img src="https://img.shields.io/badge/testes-156_pass-ffd531?style=flat-square&labelColor=262626" alt="testes" />
  <img src="https://img.shields.io/badge/deploy-vercel-262626?style=flat-square&logo=vercel&logoColor=ffffff&labelColor=f1f2ec" alt="Vercel" />
</p>

---

### ❯ o_que_é

A plataforma operacional do **Programa de Mentoria Social** do Instituto Realiza.vc. Cada mentor voluntário é pareado com um mentorado num ciclo de 16 encontros; o app acompanha se as duplas realmente se encontram, o que foi combinado e quais duplas pedem atenção. A coordenação age a partir de um semáforo, não de planilhas.

Não é um CRM genérico: as telas espelham os guias do programa (DPP). O form semanal de acompanhamento, o checklist de encerramento, os nudges por WhatsApp e a trilha do mentor especialista existem porque os guias mandam.

---

### ❯ domínio

<div align="center">
  <img src="./dominio.svg?v=1" alt="Domínio: dupla, ciclo, registros, semáforo, escopo RLS" width="100%"/>
</div>

- `dupla`: mentor ↔ mentorado, montada no matching board (grade de disponibilidade, afinidade, aviso de menor de idade).
- `ciclo_eventos`: calendário oficial, 16 encontros sempre às terças. O semáforo compara os encontros esperados até hoje com os marcados `realizado`.
- `encontros` / `registros`: a dupla agenda os próprios encontros (`unique(dupla_id, numero)`); depois de cada um o mentor preenche o follow-up semanal (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`) com combinados e anexos.
- `semáforo`: `risco` quando há pedido de apoio, avaliação baixa + dificuldade, ou ≥2 encontros atrasados; `atencao` com 1 atraso, avaliação baixa, registro pendente ou encaminhamento vencido.
- `trilha` do mentor_especialista: fluxo de solicitação em 5 passos (solicitação → mural → aceite atômico) com prazo de 3 meses.
- `encerramento`: checklist do rito por dupla + resumo da jornada print-friendly na ficha.

---

### ❯ papéis_e_escopo

Toda leitura e escrita passa por RLS no Postgres via `my_role()` / `my_profile_id()`:

| papel | escopo |
|---|---|
| `coordenacao` | acesso total: duplas, pessoas, formulários, assinaturas, matching, exportações |
| `supervisor` | lê as duplas supervisionadas, registra supervisões |
| `mentor` | escreve só na própria dupla: agenda, registros, anexos |
| `mentor_especialista` | própria dupla + trilha de especialista (solicitação/aceite) |
| público | `/demo`, formulários `/f/[token]`, assinatura do responsável `/assinar/[token]`, `/privacidade` |

O signup é por allowlist (migration `0045`): um e-mail só entra se a coordenação já o cadastrou em `profiles`. Campos sensíveis (`*_pessoal`, `dados_civis`) são coord-only.

---

### ❯ features

- A **forms engine** deixa a coordenação montar formulários (8 tipos de campo) e gerar links individuais por token; o público responde em `/f/[token]` sem conta. Os formulários oficiais (Anamnese Social, Avaliação 360º, Autoavaliação) são imutáveis (`sistema=true`), e a resposta do 360º já marca o checklist de encerramento sozinha.
- **Assinatura eletrônica** de termos: documentos versionados, CPF com dígito verificador, IP + user-agent + hash SHA-256 e página de evidências embutida no PDF gerado (pdf-lib). O responsável assina por link público de uso único em `/assinar/[token]`, reemitível na ficha da pessoa.
- **Handoff do magic link**: auth em fluxo implícito + nonce (`?h=`). O link cai em `/auth/link`, publica a sessão em `login_handoffs` via RPC, e a aba que pediu resgata o handoff por poll (uso único, TTL de 10 min). O login sobrevive ao e-mail abrir num browser diferente do que pediu.
- **Modo demo**: `/demo` roda sem login — cookie `demo_role`, um client supabase-js falso (`src/lib/demo/client-stub.ts`) e um dataset evergreen cujas datas derivam de `new Date()`.
- **Nudges de WhatsApp**: deep links `wa.me` com mensagens pt-BR prontas para follow-up atrasado e lembrete de encontro (`src/lib/whatsapp-msgs.ts`).
- **PWA**: manifest instalável, ícones maskable, Mitr + JetBrains Mono self-hosted via `next/font`.
- **Mídia privada**: buckets `materiais` e `registro-anexos` servidos por signed URLs (300s) em route handlers escopados (`/api/material/[id]`, `/api/anexo/[id]`).

<div align="center">
  <img src="./demo.svg?v=1" alt="Modo demo público em /demo" width="420"/>
</div>

---

### ❯ arquitetura

- `src/lib/queries.ts` — leituras server-side com `React.cache` + `auth.getClaims()` (valida o JWT local, sem round-trip).
- `src/lib/actions.ts` — server actions retornam `{ error }` ou `{ ok }`, nunca lançam.
- `src/lib/ciclo.ts` — domínio puro: semáforo (`saudadeDaDupla`), labels dos enums, datas, `waLink`.
- `src/lib/supabase/{server,client,middleware}.ts` — um client por contexto; o middleware protege tudo exceto `/login`, `/auth/*` e as rotas públicas por token.
- 54 migrations SQL, RLS-first; escritas sensíveis passam por RPC (delete é coord-only, `realizado` é imutável, signup é allowlist).
- CSP + `frame-ancestors 'none'` no `next.config.ts`: `/f/[token]` e `/assinar/[token]` nunca viram iframe de phishing.

---

### ❯ stack

| camada | tech |
|---|---|
| app | Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript |
| ui | Tailwind v4 · shadcn + Base UI · Phosphor Icons · motion 13 · sonner |
| dados | Supabase (Postgres + Auth + Storage + RPC) · 54 migrations |
| docs | pdf-lib · Resend (e-mail transacional) |
| tooling | pnpm 11.3 · Vitest 5 · Vercel |

---

### ❯ quickstart

```bash
pnpm i

# .env.local — projeto Supabase remoto
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

pnpm dev    # http://localhost:3000 · demo público em /demo
```

Só entra quem está pré-cadastrado em `profiles` (allowlist). Para explorar sem conta, abra `/demo` e troque de papel na barra da demo.

---

### ❯ testes

```bash
pnpm test    # vitest run → 156 testes, 10 arquivos, ~400ms
```

Tudo função pura de domínio: regras do semáforo (`ciclo-semaforo`), agendamento e semana (`ciclo-agendamento`, `ciclo-semana`), formatação (`ciclo-formatacao`), checklist de encerramento (`encerramento`), schema de formulários (`forms-schema`), importação CSV do intake (`importar`).

---

### ❯ estrutura

<pre lang="text"><code>src/app/(app)/       shell autenticado — agenda, duplas, pessoas, registros,
                     formularios, materiais, perfil, assinar
src/app/auth/        pouso do link, confirmação do handoff, definir-senha
src/app/{demo,f,assinar,login,privacidade}/
                     superfícies públicas (sem sessão)
src/app/api/         downloads assinados, export CSV, log de nudge
src/lib/             queries · actions · ciclo (domínio) · demo/ · forms/ · documentos/
supabase/migrations/ 0001–0055 · RLS-first
tests/               156 testes unitários de funções puras</code></pre>

---

### ❯ docs

`../AGENTS.md` (regras + estado vivo do domínio) · `../BACKLOG.md` (roadmap priorizado) · `plano-mestre.md`, `roteiro-demo.md` · `fontes/` (guias oficiais do programa, pt-BR).
